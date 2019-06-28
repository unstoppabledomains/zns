#!/usr/bin/env node

import * as commander from 'commander'
import {Zilliqa} from '@zilliqa-js/zilliqa'
import {BN, Long} from '@zilliqa-js/util'
import {TxParams} from '@zilliqa-js/account'
import {readFileSync} from 'fs'
import {contract_info as auction_registrar_contract_info} from '../contract_info/auction_registrar.json'
import {contract_info as marketplace_contract_info} from '../contract_info/marketplace.json'
import {contract_info as registry_contract_info} from '../contract_info/registry.json'
import {contract_info as resolver_contract_info} from '../contract_info/resolver.json'
import {contract_info as simple_registrar_contract_info} from '../contract_info/simple_registrar.json'
import {contract_info as holding_contract_info} from '../contract_info/holding.json'
import {generateMapperFromContractInfo} from '../lib/params'
import * as hashjs from 'hash.js'
import * as records from './small.json'
import * as pricing from './pricing.json'

// kayaConfig.constants.smart_contract.SCILLA_RUNNER = `${__dirname}/runner/bin/scilla-runner`
// kayaConfig.constants.smart_contract.SCILLA_CHECKER = `${__dirname}/runner/bin/scilla-checker`

const auctionRegistrarData = generateMapperFromContractInfo(
  auction_registrar_contract_info,
)
const registryData = generateMapperFromContractInfo(registry_contract_info)
const resolverData = generateMapperFromContractInfo(resolver_contract_info)
const holdingData = generateMapperFromContractInfo(holding_contract_info)

const {testnet} = commander
  .option('-t --testnet', 'use the testnet')
  .parse(process.argv)
  .opts()

const version = testnet ? 21823489 : 65537
const url = testnet ? 'https://dev-api.zilliqa.com' : 'https://api.zilliqa.com'

const defaultParams = {
  version,
  toAddr: '0x' + '0'.repeat(40),
  amount: new BN(0),
  gasPrice: new BN(1000000000),
  gasLimit: Long.fromNumber(25000),
}

const zilliqa = new Zilliqa(url)

const privateKey =
  'a68c7b791f65cc61ee8367ba017191356c112d224ab0650b7d8e0a509d524a78'

const address = zilliqa.wallet.addByPrivateKey(privateKey)
zilliqa.wallet.setDefault(address)

function sha256(buffer) {
  return Buffer.from(
    hashjs
      .sha256()
      .update(buffer)
      .digest(),
  )
}

function namehash(name) {
  if (name.match(/^(0x)?[0-9a-f]+$/i)) {
    if (!name.startsWith('0x')) {
      name = '0x' + name
    }
    return name
  }
  let node = Buffer.alloc(32, 0)

  if (name) {
    let labels = name.split('.')

    for (let i = labels.length - 1; i >= 0; i--) {
      node = sha256(Buffer.concat([node, sha256(labels[i])]))
    }
  }

  return '0x' + node.toString('hex')
}

async function deployRegistry(
  zilliqa: Zilliqa,
  {initialOwner, rootNode, _creation_block = '0'},
  params: Partial<TxParams> = {},
) {
  return zilliqa.contracts
    .new(
      readFileSync('./scilla/registry.scilla', 'utf8'),
      registryData.init({initialOwner, rootNode}).concat({
        vname: '_creation_block',
        type: 'BNum',
        value: _creation_block.toString(),
      }),
    )
    .deploy({
      ...defaultParams,
      ...params,
      pubKey: zilliqa.wallet.defaultAccount.publicKey,
      nonce: (await zilliqa.blockchain.getBalance(address)).result.nonce,
    })
}

async function deployAuctionRegistrar(
  zilliqa: Zilliqa,
  {
    owner,
    registry,
    ownedNode,
    initialAuctionLength,
    minimumAuctionLength,
    initialDefaultPrice,
    bidIncrementNumerator,
    bidIncrementDenominator,
    initialPricePerLi,
    initialMaxPriceUSD,
    _creation_block = '0',
  },
  params: Partial<TxParams> = {},
) {
  return zilliqa.contracts
    .new(
      readFileSync('./scilla/auction_registrar.scilla', 'utf8'),
      auctionRegistrarData
        .init({
          owner,
          registry,
          ownedNode,
          initialAuctionLength,
          minimumAuctionLength,
          initialDefaultPrice,
          bidIncrementNumerator,
          bidIncrementDenominator,
          initialPricePerLi,
          initialMaxPriceUSD,
        })
        .concat({
          vname: '_creation_block',
          type: 'BNum',
          value: _creation_block.toString(),
        }),
    )
    .deploy({
      ...defaultParams,
      ...params,
      pubKey: zilliqa.wallet.defaultAccount.publicKey,
      nonce: (await zilliqa.blockchain.getBalance(address)).result.nonce,
    })
}

function deployHolding(
  zilliqa: Zilliqa,
  {initialAdmin, registry, _creation_block = '0'},
  params: Partial<TxParams> = {},
) {
  return zilliqa.contracts
    .new(
      readFileSync('./scilla/holding.scilla', 'utf8'),
      holdingData.init({initialAdmin, registry}).concat({
        vname: '_creation_block',
        type: 'BNum',
        value: _creation_block.toString(),
      }),
    )
    .deploy({...defaultParams, ...params})
}

const blockTimeMs = 86400000 / (testnet ? 1130 : 2750)

const minimumAuctionLengthMs = 1000 * 60 * 60 // 1h
const initialAuctionLengthMs = 1000 * 60 * 60 * 24 * 4 // 4d

const zilPerUSD = 0.023811

async function preconfigureAucitonPrices(auctionRegistrarAddress) {
  const auctionRegistrar = zilliqa.contracts.at(auctionRegistrarAddress)

  const defaultPriceTx = await auctionRegistrar.call(
    'setDefaultPriceUSD',
    auctionRegistrarData.f.setDefaultPriceUSD({
      newPrice: pricing.default.toString(),
    }),
    defaultParams,
  )

  console.log('defaultPriceTx.id', defaultPriceTx.id)

  for (const [length, price] of Object.entries(pricing.length)) {
    const lengthPriceTx = await auctionRegistrar.call(
      'setLengthPriceInUSD',
      auctionRegistrarData.f.setLengthPriceInUSD({
        length: length.toString(),
        newPrice: price.toString(),
      }),
      defaultParams,
    )

    console.log('lengthPriceTx.id', lengthPriceTx.id)
  }

  for (const [label, price] of Object.entries(pricing.custom)) {
    const customPriceTx = await auctionRegistrar.call(
      'setCustomPriceInUSD',
      auctionRegistrarData.f.setCustomPriceInUSD({
        node: namehash(label + '.zil'),
        newPrice: price.toString(),
      }),
      defaultParams,
    )

    console.log('customPriceTx.id', customPriceTx.id)
  }
}

async function main() {
  const registry = await deployRegistry(zilliqa, {
    initialOwner: address,
    rootNode: namehash('zil'),
  })

  console.log('registry:', registry)

  const [auctionRegistrarTx, auctionRegistrar] = await deployAuctionRegistrar(
    zilliqa,
    {
      owner: '0x' + address,
      registry: '0x' + registry[1].address,
      ownedNode: namehash('zil'),
      initialAuctionLength: Math.round(
        initialAuctionLengthMs / blockTimeMs,
      ).toString(), // 4d
      minimumAuctionLength: Math.round(
        minimumAuctionLengthMs / blockTimeMs,
      ).toString(), // 1h
      initialDefaultPrice: '20', // $20
      bidIncrementNumerator: '1', // 5% increment
      bidIncrementDenominator: '20',
      initialPricePerLi: Math.round(10 ** 12 * zilPerUSD),
      initialMaxPriceUSD: '10000',
    },
  )

  console.log('auctionRegistrarTx:', auctionRegistrarTx)

  // const [holdingTx, holding] = await deployHolding(zilliqa, {
  //   initialAdmin: '0x' + address,
  //   registry: '0x' + registry.address,
  // })

  // console.log('holdingTx.id:', holdingTx.id)
  // console.log('holdingTx.txParams.receipt:', holdingTx.txParams.receipt)

  // await preconfigureAucitonPrices(auctionRegistrar.address)
}

main().catch(e => {
  console.error(e)
  process.exit(-1)
})

// const records = {
//   label: {},
//   label2: {},
// }

// const txProcessor = new TxProcessor('https://localhost:3000')

// const holding = zilliqa.contracts.at('')
// const registry = zilliqa.contracts.at('')

// async function claim(address) {
//   for (const label of Object.keys(records)) {
//     const {ada, btc, eos, eth, xlm, xrp, zil} = records[label]

//     await txProcessor.send('zil', {
//       toAddr: '0x' + holding.address,
//       data: holdingData.transfer({
//         owner: '0x' + address,
//         node: namehash(label + '.zil'),
//       }),
//     })

//     await txProcessor.send('zil', {
//       toAddr: '0x' + registry.address,
//       code: readFileSync('./scilla/resolver.scilla', 'utf8'),
//       gasLimit: '10000',
//       data: resolverData.init({
//         owner: '0x' + address,
//         registry: '0' + registry.address,
//         node: namehash(label + '.zil'),
//         ada: ada ? '0x' + Buffer.from(ada).toString('hex') : '0x',
//         btc: btc ? '0x' + Buffer.from(btc).toString('hex') : '0x',
//         eos: eos ? '0x' + Buffer.from(eos).toString('hex') : '0x',
//         eth: eth ? '0x' + Buffer.from(eth).toString('hex') : '0x',
//         xlm: xlm ? '0x' + Buffer.from(xlm).toString('hex') : '0x',
//         xrp: xrp ? '0x' + Buffer.from(xrp).toString('hex') : '0x',
//         zil: zil ? '0x' + Buffer.from(zil).toString('hex') : '0x',
//       }),
//     })
//   }
// }
