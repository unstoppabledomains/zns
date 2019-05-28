const {Long, BN, bytes} = require('@zilliqa-js/util')
const {Zilliqa} = require('@zilliqa-js/zilliqa')
const {readFileSync} = require('fs')
const path = require('path')
const hashjs = require('hash.js')

const {contract_info: registryInfo} = require('../contract_info/registry.json')
const {
  contract_info: simpleRegistrarInfo,
} = require('../contract_info/simple_registrar.json')
const {contract_info: resolverInfo} = require('../contract_info/resolver.json')
const {
  contract_info: auctionRegistrarInfo,
} = require('../contract_info/auction_registrar.json')

const {generateMapperFromContractInfo} = require('../lib/params')

const resolverData = generateMapperFromContractInfo(resolverInfo)
const registryData = generateMapperFromContractInfo(registryInfo)
const simpleRegistrarData = generateMapperFromContractInfo(simpleRegistrarInfo)
const auctionRegistrarData = generateMapperFromContractInfo(
  auctionRegistrarInfo,
)

function sha256(buffer) {
  return Buffer.from(
    hashjs
      .sha256()
      .update(buffer.toString('hex'), 'hex')
      .digest(),
  )
}

function namehash(name) {
  let node = Buffer.alloc(32)

  if (name) {
    let labels = name.split('.')

    for (let i = labels.length - 1; i >= 0; i--) {
      node = sha256(Buffer.concat([node, sha256(labels[i])]))
    }
  }

  return '0x' + node.toString('hex')
}

async function deploy(privateKey, testnet = true) {
  console.log('privateKey:', privateKey)

  const version = testnet ? 21823489 : 65537 // bytes.pack(111, 1)
  const url =
    // 'http://127.0.0.1:4200'
    testnet ? 'https://dev-api.zilliqa.com' : 'https://api.zilliqa.com'

  console.log('version:', version)
  console.log('url:', url)

  const zilliqa = new Zilliqa(url)
  const gasPrice = new BN(
    (await zilliqa.blockchain.getMinimumGasPrice()).result,
  ) // .mul(new BN(5))

  zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

  console.log('zilliqa.wallet.defaultAccount:', zilliqa.wallet.defaultAccount)
  console.log('gasPrice:', gasPrice.toString())

  const balance = await zilliqa.blockchain.getBalance(
    zilliqa.wallet.defaultAccount.address,
  )

  console.log('balance:', balance.result)

  // const testTx = await zilliqa.blockchain.createTransaction(
  //   zilliqa.transactions.new({
  //     version,
  //     nonce:
  //       (await zilliqa.blockchain.getBalance(
  //         zilliqa.wallet.defaultAccount.address,
  //       ).result.nonce) + 1,
  //     pubKey: zilliqa.wallet.defaultAccount.publicKey,
  //     toAddr: zilliqa.wallet.defaultAccount.address,
  //     amount: new BN('1'),
  //     gasPrice,
  //     gasLimit: Long.fromNumber(100),
  //   }),
  // )

  // console.log('testTx:', testTx)

  const [registryTx, registry] = await zilliqa.contracts
    .new(
      readFileSync(
        path.join(__dirname, '../scilla/registry.scilla'),
      ).toString(),
      registryData.init({
        initialOwner: `0x${zilliqa.wallet.defaultAccount.address}`,
        initialRegistrar: '0x0000000000000000000000000000000000000000',
      }),
    )
    .deploy({
      version,
      gasPrice,
      gasLimit: Long.fromNumber(100000),
    })

  console.log('registryTx:', registryTx)
  console.log('registry address:', registry.address);

  const assignTx = await registry.call(
    'assign',
    registryData.f.assign({
      parent:
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      label: 'label',
      owner: `0x${zilliqa.wallet.defaultAccount.address}`,
    }),
    {
      version,
      amount: new BN(0),
      gasPrice,
      gasLimit: Long.fromNumber(100000),
    },
  )

  console.log('assignTx:', assignTx)

  const [resolverTx, resolver] = await zilliqa.contracts
    .new(
      readFileSync(
        path.join(__dirname, '../scilla/resolver.scilla'),
      ).toString(),
      registryData.init({
        owner: `0x${zilliqa.wallet.defaultAccount.address}`,
      }),
    )
    .deploy({
      version,
      gasPrice,
      gasLimit: Long.fromNumber(100000),
    })

  console.log('resolverTx:', resolverTx)

  const configureTx = await registry.call(
    'assign',
    registryData.f.assign({
      node: namehash('label'),
      owner: `0x${zilliqa.wallet.defaultAccount.address}`,
      resolver: `0x${resolver.address}`,
    }),
    {
      version,
      amount: new BN(0),
      gasPrice,
      gasLimit: Long.fromNumber(100000),
    },
  )

  console.log('configureTx:', configureTx)

  const setTx = await resolver.call(
    'set',
    resolverData.f.set({
      key: 'crypto.ZIL.address',
      value: `0x${zilliqa.wallet.defaultAccount.address}`,
    }),
    {
      version,
      amount: new BN(0),
      gasPrice,
      gasLimit: Long.fromNumber(100000),
    },
  )

  console.log('setTx:', setTx)

  return {
    zilliqa,
    registry,
    resolver,
  }
}

const key = 'a68c7b791f65cc61ee8367ba017191356c112d224ab0650b7d8e0a509d524a78'

deploy(key, true)
  .then(console.log)
  .catch(console.error)

// const [, auction_registrar] = zilliqa.contracts
// .new(
//   readFileSync(path.join(__dirname, '../scilla/auction_registrar.scilla')).toString(),
//   [{}],
// )
// .deploy({
//   version,
// })

// const [simple_registrar] = zilliqa.contracts
// .new(
//   readFileSync(path.join(__dirname, '../scilla/simple_registrar.scilla')).toString(),
//   [{}],
// )
// .deploy({
//   version,
// })
