import {TxParams} from '@zilliqa-js/account'
import {BN, bytes, Long} from '@zilliqa-js/util'
import {Zilliqa} from '@zilliqa-js/zilliqa'
import {readFileSync} from 'fs'
import {readdirSync} from 'fs'
import * as hashjs from 'hash.js'
import * as KayaProvider from 'kaya-cli/src/provider'
import * as kayaConfig from 'kaya-cli/src/config'
import {basename, join} from 'path'
import * as uuid from 'uuid/v4'
import {contract_info as auction_registrar_contract_info} from './contract_info/auction_registrar.json'
import {contract_info as marketplace_contract_info} from './contract_info/marketplace.json'
import {contract_info as registry_contract_info} from './contract_info/registry.json'
import {contract_info as resolver_contract_info} from './contract_info/resolver.json'
import {contract_info as simple_registrar_contract_info} from './contract_info/simple_registrar.json'
import {generateMapperFromContractInfo} from './lib/params'
import Zns from './lib/Zns'

kayaConfig.constants.smart_contract.SCILLA_RUNNER = `${__dirname}/runner/bin/scilla-runner`
kayaConfig.constants.smart_contract.SCILLA_CHECKER = `${__dirname}/runner/bin/scilla-checker`

const auctionRegistrarData = generateMapperFromContractInfo(
  auction_registrar_contract_info,
)
const marketplaceData = generateMapperFromContractInfo(
  marketplace_contract_info,
)
const registryData = generateMapperFromContractInfo(registry_contract_info)
const resolverData = generateMapperFromContractInfo(resolver_contract_info)
const simpleRegistrarData = generateMapperFromContractInfo(
  simple_registrar_contract_info,
)

const version = bytes.pack(111, 1)

const defaultParams: TxParams = {
  version,
  toAddr: '0x' + '0'.repeat(40),
  amount: new BN(0),
  gasPrice: new BN(1000000000),
  gasLimit: Long.fromNumber(25000),
}

function deployMarketplace(
  zilliqa: Zilliqa,
  {registry, seller, zone},
  params: Partial<TxParams> = {},
) {
  return zilliqa.contracts
    .new(
      readFileSync('./scilla/marketplace.scilla', 'utf8'),
      marketplaceData.init({registry, seller, zone}),
    )
    .deploy({...defaultParams, ...params})
}

function deploySimpleRegistrar(
  zilliqa: Zilliqa,
  {
    registry,
    ownedNode,
    owner,
    initialDefaultPrice, // = 1,
    initialQaPerUSD, // 0.017 * 10 ** 12,
  },
  params: Partial<TxParams> = {},
) {
  return zilliqa.contracts
    .new(
      readFileSync('./scilla/simple_registrar.scilla', 'utf8'),
      simpleRegistrarData
        .init({
          registry,
          ownedNode,
          owner,
          initialDefaultPrice,
          initialQaPerUSD,
        }),
    )
    .deploy({...defaultParams, ...params})
}

function deployAuctionRegistrar(
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
    initialPricePerQa,
    initialMaxPriceUSD,
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
          initialPricePerQa,
          initialMaxPriceUSD,
        }),
    )
    .deploy({...defaultParams, ...params})
}

const address = '0xd90f2e538ce0df89c8273cad3b63ec44a3c4ed82'
const privateKey =
  'e53d1c3edaffc7a7bab5418eb836cf75819a82872b4a1a0f1c7fcf5c3e020b89'
const address2 = '0x2f4f79ef6abfc0368f5a7e2c2df82e1afdfe7204'
const privateKey2 =
  '1234567890123456789012345678901234567890123456789012345678901234'

const rootNode = '0x' + '0'.repeat(64)
const nullAddress = '0x' + '0'.repeat(40)

const resolverInitState = {
  owner: address,
  registry: address,
  node: Zns.namehash('test'),
  ada: '',
  btc: '',
  eos: '',
  eth: '',
  xlm: '',
  xrp: '',
  zil: '',
}

function sha256(buffer) {
  return Buffer.from(
    hashjs
      .sha256()
      .update(buffer)
      .digest(),
  )
}

const asHash = params => {
  return params.reduce((a, v) => ({...a, [v.vname]: v.value}), {})
}

const contractField = async (contract, name) => {
  const field = (await contract.getState()).find(v => v.vname === name)
  if (!field) {
    throw new Error(`Unknown contract field ${name}`)
  }
  return field.value
}

const expectUnchangedState = async (contract, block) => {
  const oldState = await contract.getState()
  const result = await block.call()
  expect(await contract.getState()).toEqual(oldState)
  return result
}

const contractMapValue = async (contract, field, key) => {
  const map = await contractField(contract, field)
  const record = map.find(r => r.key == key) || null
  return record && record.val
}

const transactionEvents = tx => {
  const events = tx.txParams.receipt.event_logs || []
  // Following the original reverse order of events
  return events.map(event => {
    return {_eventname: event._eventname, ...asHash(event.params)}
  })
}

describe('smart contracts', () => {
  let provider
  beforeEach(() => {
    jest.resetModules()

    const id = uuid()

    provider = new KayaProvider(
      {dataPath: `/tmp/kaya_${id}_`},
      {
        // 1,000,000,000 ZIL
        [address.replace('0x', '')]: {privateKey, amount: '100000000000000', nonce: 0},
        [address2.replace('0x', '')]: {
          privateKey: privateKey2,
          amount: '100000000000000',
          nonce: 0,
        },
      },
    )
  })

  describe('resolver.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const resolver = await (new Zns(zilliqa, address, {version})).deployResolver('test')

      await resolver.reload()
      expect(resolver.records).toEqual({})
    })
    it('should deploy non-blank initial state', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      const resolver = await (new Zns(zilliqa, address, {version})).deployResolver('hello', {crypto: {
        ADA: {address: '0x1111'},
        BTC: {address: '0x2222'},
        EOS: {address: '0x3333'},
        ETH: {address: '0x4444'},
        XLM: {address: '0x5555'},
        XRP: {address: '0x6666'},
        ZIL: {address: '0x7777'},
      }})

      let records = {
        'crypto.ADA.address': '0x1111',
        'crypto.BTC.address': '0x2222',
        'crypto.EOS.address': '0x3333',
        'crypto.ETH.address': '0x4444',
        'crypto.XLM.address': '0x5555',
        'crypto.XRP.address': '0x6666',
        'crypto.ZIL.address': '0x7777',
      }
      expect(resolver.records).toEqual(records)
      expect((await resolver.reload()).records).toEqual(records)
      expect(await resolver.isLive()).toBeFalsy()
    })
    it('should set and unset records', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const resolver = await zns.deployResolver('tld')
      await zns.bestow('tld', address, resolver.address)
      expect(await resolver.isLive()).toBeTruthy()
      expect(await resolver.isDetached()).toBeFalsy()

      await resolver.reload()
      expect(resolver.records).toEqual({})

      const setTx = await resolver.set('crypto.ADA.address', '0x7357')
      expect(resolver.records).toEqual({
        'crypto.ADA.address': '0x7357',
      })
      await resolver.reload()
      expect(resolver.records).toEqual({
        'crypto.ADA.address': '0x7357',
      })
      expect(await transactionEvents(setTx)).toEqual([resolver.configuredEvent])

      const unsetTx = await resolver.unset('crypto.ADA.address')
      expect(resolver.records).toEqual({})
      await resolver.reload()
      expect(resolver.records).toEqual({})
      expect(await transactionEvents(unsetTx)).toEqual([resolver.configuredEvent])
    })

    it('should fail to set and unset records if sender not owner', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      let zns = new Zns(zilliqa, address, {version})
      let resolver = await zns.deployResolver('hello.zil')
      let {contract} = resolver


      //////////////////////////////////////////////////////////////////////////
      // fail to set record using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await expectUnchangedState(contract, async () => {
        await expect(
          resolver.set('test', '0x7357')
        ).rejects.toThrow('Resolver record is not set')
      })

      //////////////////////////////////////////////////////////////////////////
      // set record then fail to unset record using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(address.replace('0x', ''))

      await resolver.set('test', '0x7357')

      await resolver.reload()
      expect(resolver.records).toEqual({test: '0x7357'})

      zilliqa.wallet.setDefault(address2.replace("0x", ""))

      await expectUnchangedState(contract, async () => {
        await expect(
          resolver.unset('test')
        ).rejects.toThrow('Resolver record is not removed: Sender not owner or key does not exist')
      })
    })

    it("should gracefully fail to unset records if they don't exist", async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      let zns = new Zns(zilliqa, address, {version})
      const resolver = await zns.deployResolver('hello.zil')

      await expectUnchangedState(resolver.contract, async () => {
        await expect(resolver.unset('does_not_exist'))
          .rejects.toThrow('Resolver record is not removed: Sender not owner or key does not exist')
      })
    })
  })

  describe('registry.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      expect(await zns.contract.getInit()).toHaveLength(5)
    })

    it('should disallow onResolverConfigured call from unauthorized resources', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      await zns.bestow('tld', address, address2)

      const onResolverConfiguredTx = await registry.call(
        'onResolverConfigured',
        registryData.f.onResolverConfigured({
          node: Zns.namehash('tld'),
        }),
        defaultParams,
      )
      expect(onResolverConfiguredTx.isConfirmed()).toBeTruthy()
      expect(await transactionEvents(onResolverConfiguredTx)).toEqual([])
      const onResolverConfiguredTx2 = await registry.call(
        'onResolverConfigured',
        registryData.f.onResolverConfigured({
          node: Zns.namehash('unknown'),
        }),
        defaultParams,
      )
      expect(onResolverConfiguredTx2.isConfirmed()).toBeTruthy()
      expect(await transactionEvents(onResolverConfiguredTx2)).toEqual([])
    })

    it('should approve addresses and set and unset operators for addresses', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // approve normally
      //////////////////////////////////////////////////////////////////////////

      await zns.setApprovedAddress(rootNode, address2)
      expect(await zns.getApprovedAddress(rootNode)).toEqual(address2)

      //////////////////////////////////////////////////////////////////////////
      // approve null address
      //////////////////////////////////////////////////////////////////////////

      await zns.setApprovedAddress(rootNode, nullAddress)
      expect(await zns.getApprovedAddress(rootNode)).toEqual(nullAddress)

      //////////////////////////////////////////////////////////////////////////
      // fail to approve node owned by someone else
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await expect(
          zns.setApprovedAddress('node-owned-by-someone-else', address2)
        ).rejects.toThrow("Approved address is not set: Sender not node owner")
      })

      //////////////////////////////////////////////////////////////////////////
      // add operator
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approveFor',
        registryData.f.approveFor({
          address: address2,
          isApproved: true,
        }),
        defaultParams,
      )

      expect(
        await await contractMapValue(
          registry,
          'operators',
          '0xd90f2e538ce0df89c8273cad3b63ec44a3c4ed82',
        ),
      ).toEqual(['0x2f4f79ef6abfc0368f5a7e2c2df82e1afdfe7204'])

      //////////////////////////////////////////////////////////////////////////
      // remove operator
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approveFor',
        registryData.f.approveFor({
          address: address2,
          isApproved: false,
        }),
        defaultParams,
      )
      expect(
        await contractMapValue(
          registry,
          'operators',
          '0xd90f2e538ce0df89c8273cad3b63ec44a3c4ed82',
        ),
      ).toEqual([])
    })

    it('should add and remove admins if currently admin', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // add admin
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'setAdmin',
        registryData.f.setAdmin({
          address: address2,
          isApproved: true,
        }),
        defaultParams,
      )

      expect(await contractField(registry, 'admins')).toEqual([
        address2,
        address,
      ])

      //////////////////////////////////////////////////////////////////////////
      // remove admin
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'setAdmin',
        registryData.f.setAdmin({
          address: address2,
          isApproved: false,
        }),
        defaultParams,
      )

      expect(await contractField(registry, 'admins')).toEqual([address])

      //////////////////////////////////////////////////////////////////////////
      // fail to set admin using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'setAdmin',
          registryData.f.setAdmin({
            address: address2,
            isApproved: true,
          }),
          defaultParams,
        )
      })
    })

    it('should freely configure names properly', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // configure resolver
      //////////////////////////////////////////////////////////////////////////

      const configureResolverTx = await registry.call(
        'configureResolver',
        registryData.f.configureResolver({
          node: rootNode,
          resolver: address2,
        }),
        defaultParams,
      )

      expect(configureResolverTx.isConfirmed()).toBeTruthy()
      expect(transactionEvents(configureResolverTx)).toEqual([
        {
          _eventname: 'Configured',
          node: rootNode,
          owner: address,
          resolver: address2,
        },
      ])

      expect(await zns.getResolverAddress(rootNode)).toEqual(address2)
      expect(await zns.getOwnerAddress(rootNode)).toEqual(address)

      //////////////////////////////////////////////////////////////////////////
      // configure node
      //////////////////////////////////////////////////////////////////////////

      const configureNodeTx = await registry.call(
        'configureNode',
        registryData.f.configureNode({
          node: rootNode,
          owner: address2,
          resolver: address2,
        }),
        defaultParams,
      )
      expect(configureNodeTx.isConfirmed()).toBeTruthy()
      expect(transactionEvents(configureNodeTx)).toEqual([
        {
          _eventname: 'Configured',
          node: rootNode,
          owner: address2,
          resolver: address2,
        },
      ])

      expect(await zns.getResolverAddress(rootNode)).toEqual(address2)
      expect(await zns.getOwnerAddress(rootNode)).toEqual(address2)

      //////////////////////////////////////////////////////////////////////////
      // fail to configure resolver using bad address
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'configureResolver',
          registryData.f.configureResolver({
            node: rootNode,
            resolver: address,
          }),
          defaultParams,
        )
      })

      //////////////////////////////////////////////////////////////////////////
      // fail to configure node using bad address
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'configureNode',
          registryData.f.configureNode({
            node: rootNode,
            owner: address,
            resolver: address,
          }),
          defaultParams,
        )
      })
    })

    it('should freely transfer names properly', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // approve address to check transfer
      //////////////////////////////////////////////////////////////////////////

      await zns.setApprovedAddress(rootNode, address)

      const transferTx = await registry.call(
        'transfer',
        registryData.f.transfer({
          node: rootNode,
          owner: address2,
        }),
        defaultParams,
      )
      expect(transferTx.isConfirmed()).toBeTruthy
      expect(await transactionEvents(transferTx)).toEqual([
        {
          _eventname: 'Configured',
          node: rootNode,
          owner: address2,
          resolver: nullAddress,
        },
      ])

      expect(await zns.getOwnerAddress(rootNode)).toEqual(address2)
      expect(await zns.getResolverAddress(rootNode)).toEqual(nullAddress)

      //////////////////////////////////////////////////////////////////////////
      // fail to transfer using bad address
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'transfer',
          registryData.f.transfer({
            node: rootNode,
            owner: address,
          }),
          defaultParams,
        )
      })
    })

    it('should freely assign names properly', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // assign subdomain
      //////////////////////////////////////////////////////////////////////////

      await zns.setApprovedAddress(rootNode, address)

      const assignTx = await registry.call(
        'assign',
        registryData.f.assign({
          parent: rootNode,
          label: 'tld',
          owner: address,
        }),
        defaultParams,
      )
      expect(assignTx.isConfirmed()).toBeTruthy
      expect(await transactionEvents(assignTx)).toEqual([
        {
          _eventname: 'Configured',
          node: Zns.namehash('tld'),
          owner: address,
          resolver: nullAddress,
        },
        {
          _eventname: 'NewDomain',
          parent: rootNode,
          label: 'tld',
        },
      ])
      expect(await zns.getOwnerAddress(rootNode)).toEqual(address)
      expect(await zns.getResolverAddress(rootNode)).toEqual(nullAddress)
      expect(await zns.getOwnerAddress('tld')).toEqual(address)
      expect(await zns.getResolverAddress('tld')).toEqual(nullAddress)

      //////////////////////////////////////////////////////////////////////////
      // assign owned subdomain
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'assign',
        registryData.f.assign({
          parent: rootNode,
          label: 'tld',
          owner: address2,
        }),
        defaultParams,
      )
      expect(await zns.getOwnerAddress(rootNode)).toEqual(address)
      expect(await zns.getResolverAddress(rootNode)).toEqual(nullAddress)
      expect(await zns.getOwnerAddress('tld')).toEqual(address2)
      expect(await zns.getResolverAddress('tld')).toEqual(nullAddress)

      //////////////////////////////////////////////////////////////////////////
      // fail to assign subdomain using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'assign',
          registryData.f.assign({
            parent: rootNode,
            label: 'tld',
            owner: nullAddress,
          }),
          defaultParams,
        )
      })
    })

    it('should freely bestow names properly', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // bestow name
      //////////////////////////////////////////////////////////////////////////

      const bestowTx = await zns.bestow('tld', address, address)
      expect(await transactionEvents(bestowTx)).toEqual([
        {
          _eventname: 'Configured',
          node: Zns.namehash('tld'),
          owner: address,
          resolver: address,
        },
        {
          _eventname: 'NewDomain',
          parent: rootNode,
          label: 'tld',
        },
      ])

      expect(await zns.getOwnerAddress(rootNode)).toEqual(address)
      expect(await zns.getOwnerAddress('tld')).toEqual(address)
      expect(await zns.getOwnerAddress('unknown')).toEqual(undefined)
      expect(await zns.getResolverAddress(rootNode)).toEqual(nullAddress)
      expect(await zns.getResolverAddress('tld')).toEqual(address)
      expect(await zns.getResolverAddress('unknown')).toEqual(undefined)

      //////////////////////////////////////////////////////////////////////////
      // fail to bestow owned name
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await expect(
          zns.bestow('tld', address2, address2)
        ).rejects.toThrow('Transaction threw an Error event: Sender admin')
      })

      //////////////////////////////////////////////////////////////////////////
      // fail to bestow owned using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await expectUnchangedState(registry, async () => {
        await expect(zns.bestow('other-tld', address2, address2))
          .rejects.toThrow('Transaction threw an Error event: Sender admin')
      })
    })

    it('should allow admins to set registrar', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // set registrar address
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'setRegistrar',
        registryData.f.setRegistrar({address: address2}),
        defaultParams,
      )

      expect(await contractField(registry, 'registrar')).toEqual(
        address2,
      )

      //////////////////////////////////////////////////////////////////////////
      // fail to set registrar address using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'setRegistrar',
          registryData.f.setRegistrar({address: address}),
          defaultParams,
        )
      })
    })
  })

  describe('simple_registrar.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [registrarTx, registrar] = await deploySimpleRegistrar(
        zilliqa,
        {
          registry: '0x' + '0'.repeat(40),
          owner: '0x' + '0'.repeat(40),
          ownedNode: rootNode,
          initialDefaultPrice: '1',
          initialQaPerUSD: '1',
        },
        {gasLimit: Long.fromNumber(100000)},
      )
      expect(registrarTx.isConfirmed()).toBeTruthy()
      expect(await registrar.getInit()).toHaveLength(8)
    })

    it('should register name', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      const [, registrar] = await deploySimpleRegistrar(
        zilliqa,
        {
          registry: zns.address,
          owner: address,
          ownedNode: rootNode,
          initialDefaultPrice: '1',
          initialQaPerUSD: '1',
        },
        {gasLimit: Long.fromNumber(100000)},
      )

      await registry.call(
        'setRegistrar',
        registryData.f.setRegistrar({address: '0x' + registrar.address}),
        defaultParams,
      )

      //////////////////////////////////////////////////////////////////////////
      // register name
      //////////////////////////////////////////////////////////////////////////

      const registerTx = await registry.call(
        'register',
        registryData.f.register({parent: rootNode, label: 'name'}),
        {
          ...defaultParams,
          amount: new BN(1),
        },
      )

      expect(registerTx.isConfirmed()).toBeTruthy()
      expect(await transactionEvents(registerTx)).toEqual([
        {
          _eventname: 'Configured',
          node: Zns.namehash('name'),
          owner: address,
          resolver: nullAddress,
        },
        {
          _eventname: 'NewDomain',
          parent: rootNode,
          label: 'name',
        },
      ])

      expect(await zns.getOwnerAddress(rootNode)).toEqual(address)
      expect(await zns.getResolverAddress(rootNode)).toEqual(nullAddress)
      expect(await zns.getOwnerAddress('name')).toEqual(address)
      expect(await zns.getResolverAddress('name')).toEqual(nullAddress)

      //////////////////////////////////////////////////////////////////////////
      // fail to register name using bad amount
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'register',
          registryData.f.register({
            parent: rootNode,
            label: 'not-enough-funds',
          }),
          defaultParams,
        )
      })

      //////////////////////////////////////////////////////////////////////////
      // fail to register name using owned name
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'register',
          registryData.f.register({parent: rootNode, label: 'name'}),
          {
            ...defaultParams,
            amount: new BN(1),
          },
        )
      })

      //////////////////////////////////////////////////////////////////////////
      // fail to register name using bad sender
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registrar, async () => {
        await registrar.call(
          'register',
          simpleRegistrarData.f.register({
            node: Zns.namehash('bad-sender'),
            parent: rootNode,
            label: 'bad-sender',
            origin: address,
          }),
          {
            ...defaultParams,
            amount: new BN(1),
          },
        )
      })
    })
  })

  describe('auction_registrar.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [registrarTx, registrar] = await deployAuctionRegistrar(
        zilliqa,
        {
          owner: '0x' + '0'.repeat(40),
          registry: '0x' + '0'.repeat(40),
          ownedNode: rootNode,
          initialAuctionLength: '1',
          minimumAuctionLength: '1',
          initialDefaultPrice: '1',
          bidIncrementNumerator: '1',
          bidIncrementDenominator: '100',
          initialPricePerQa: '100',
          initialMaxPriceUSD: '1000',
        },
        {gasLimit: Long.fromNumber(100000)},
      )
      expect(registrarTx.isConfirmed()).toBeTruthy()
      expect(await registrar.getInit()).toHaveLength(13)
    })

    it('should start, bid and end auction', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      const [, registrar] = await deployAuctionRegistrar(
        zilliqa,
        {
          owner: address,
          registry: zns.address,
          ownedNode: rootNode,
          initialAuctionLength: '3',
          minimumAuctionLength: '2',
          initialDefaultPrice: '100',
          bidIncrementNumerator: '1',
          bidIncrementDenominator: '100',
          initialPricePerQa: '1',
          initialMaxPriceUSD: '1000',
        },
        {gasLimit: Long.fromNumber(100000)},
      )

      await registry.call(
        'setRegistrar',
        registryData.f.setRegistrar({address: '0x' + registrar.address}),
        defaultParams,
      )

      await registry.call(
        'setAdmin',
        registryData.f.setAdmin({
          address: '0x' + registrar.address,
          isApproved: true,
        }),
        defaultParams,
      )

      //////////////////////////////////////////////////////////////////////////
      // run auctions
      //////////////////////////////////////////////////////////////////////////

      await registrar.call(
        'setRunning',
        auctionRegistrarData.f.setRunning({
          newRunning: true,
        }),
        defaultParams,
      )

      expect(await contractField(registrar, 'running')).toMatchObject({
        constructor: 'True',
        argtypes: [],
        arguments: [],
      })

      //////////////////////////////////////////////////////////////////////////
      // open an auction
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'register',
        registryData.f.register({parent: rootNode, label: 'name'}),
        {
          ...defaultParams,
          amount: new BN(200),
        },
      )

      expect(await zns.getOwnerAddress(rootNode)).toEqual(address)
      expect(await zns.getResolverAddress(rootNode)).toEqual(nullAddress)

      expect(await zns.getOwnerAddress('name')).toEqual('0x' + registrar.address)
      expect(await zns.getResolverAddress('name')).toEqual(nullAddress)

      expect(
        await contractMapValue(registrar, 'auctions', Zns.namehash('name')),
      ).toMatchObject({
        constructor: 'Auction',
        argtypes: [],
        arguments: [
          address,
          '200',
          expect.stringMatching(/^\d+$/),
          'name',
        ],
      })

      //////////////////////////////////////////////////////////////////////////
      // bid on an auction
      //////////////////////////////////////////////////////////////////////////

      await registrar.call(
        'bid',
        auctionRegistrarData.f.bid({node: Zns.namehash('name')}),
        {...defaultParams, amount: new BN(300)},
      )

      expect(
        await contractMapValue(registrar, 'auctions', Zns.namehash('name')),
      ).toMatchObject({
        constructor: 'Auction',
        argtypes: [],
        arguments: [
          address,
          '300',
          expect.stringMatching(/^\d*$/),
          'name',
        ],
      })

      //////////////////////////////////////////////////////////////////////////
      // close an auction
      //////////////////////////////////////////////////////////////////////////

      await zilliqa.provider.send('KayaMine')
      await zilliqa.provider.send('KayaMine')
      await zilliqa.provider.send('KayaMine')
      await zilliqa.provider.send('KayaMine') // {result: '4'}

      await registrar.call(
        'close',
        auctionRegistrarData.f.close({node: Zns.namehash('name')}),
        defaultParams,
      )

      expect(await zns.getOwnerAddress(rootNode)).toEqual(address)
      expect(await zns.getResolverAddress(rootNode)).toEqual(nullAddress)
      expect(await zns.getOwnerAddress('name')).toEqual(address)
      expect(await zns.getResolverAddress('name')).toEqual(nullAddress)

      expect(await contractField(registrar, 'auctions')).toHaveLength(0)

      //////////////////////////////////////////////////////////////////////////
      // close an auction on register
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'register',
        registryData.f.register({parent: rootNode, label: 'registered-name'}),
        {
          ...defaultParams,
          amount: new BN(2000),
        },
      )

      expect(await zns.getOwnerAddress(rootNode)).toEqual(address)
      expect(await zns.getResolverAddress(rootNode)).toEqual(nullAddress)
      expect(await zns.getOwnerAddress('name')).toEqual(address)
      expect(await zns.getResolverAddress('name')).toEqual(nullAddress)

      expect(await contractField(registrar, 'auctions')).toHaveLength(0)

      //////////////////////////////////////////////////////////////////////////
      // close an auction on bid
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'register',
        registryData.f.register({parent: rootNode, label: 'bid-name'}),
        {
          ...defaultParams,
          amount: new BN(200),
        },
      )

      await registrar.call(
        'bid',
        auctionRegistrarData.f.bid({node: Zns.namehash('bid-name')}),
        {...defaultParams, amount: new BN(2000)},
      )

      await zilliqa.provider.send('KayaMine')

      await registrar.call(
        'close',
        auctionRegistrarData.f.close({node: Zns.namehash('bid-name')}),
        defaultParams,
      )

      expect(await zns.getOwnerAddress('bid-name')).toEqual(address)
      expect(await zns.getResolverAddress('bid-name')).toEqual(nullAddress)

      expect(await contractField(registrar, 'auctions')).toHaveLength(0)
    })
  })

  describe('marketplace.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [marketplaceTx, marketplace] = await deployMarketplace(zilliqa, {
        registry: '0x' + '0'.repeat(40),
        seller: '0x' + '0'.repeat(40),
        zone: rootNode,
      })

      expect(marketplaceTx.isConfirmed()).toBeTruthy()
      expect(await marketplace.getInit()).toHaveLength(6)
    })

    it('should enable buying and selling of names', async () => {
      const zilliqa = new Zilliqa(null, provider)
      const soldDomain = 'domain'
      const soldNode = Zns.namehash('domain')
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, {version})
      const registry = zns.contract

      const [, marketplace] = await deployMarketplace(zilliqa, {
        registry: zns.address,
        seller: address,
        zone: rootNode,
      })

      await zns.bestow(soldDomain, address, nullAddress)
      expect(await zns.getOwnerAddress(soldDomain)).toBe(address)

      //////////////////////////////////////////////////////////////////////////
      // approve marketplace to operate on names
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approveFor',
        registryData.f.approveFor({
          address: '0x' + marketplace.address,
          isApproved: true,
        }),
        defaultParams,
      )

      //////////////////////////////////////////////////////////////////////////
      // make and cancel offers
      //////////////////////////////////////////////////////////////////////////

      await marketplace.call(
        'offer',
        marketplaceData.f.offer({
          parent: rootNode,
          label: soldDomain,
          price: '1000000000000',
        }),
        defaultParams,
      )

      expect(await contractMapValue(marketplace, 'offers', soldNode)).toBe(
        '1000000000000',
      )

      await marketplace.call(
        'cancelOffer',
        marketplaceData.f.cancelOffer({node: soldNode}),
        defaultParams,
      )

      expect(await contractMapValue(marketplace, 'offers', soldNode)).toBeNull()

      await marketplace.call(
        'offer',
        marketplaceData.f.offer({
          parent: rootNode,
          label: soldDomain,
          price: '1000000000000',
        }),
        defaultParams,
      )

      expect(await contractMapValue(marketplace, 'offers', soldNode)).toBe(
        '1000000000000',
      )

      //////////////////////////////////////////////////////////////////////////
      // purchase name and verify balance was transfered
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      let address1BalancePre = await zilliqa.blockchain.getBalance(address)

      await marketplace.call('buy', marketplaceData.f.buy({node: soldNode}), {
        ...defaultParams,
        amount: new BN('1000000000000'),
      })

      let address1BalancePost = await zilliqa.blockchain.getBalance(address)

      // FIX: This is a kaya balance problem
      // expect(Number(address1BalancePre.result.balance) + 1000000000000).toBe(
      //   Number(address1BalancePost.result.balance),
      // )

      expect(await zns.getOwnerAddress(soldDomain)).toBe(address2)
      expect(await contractMapValue(marketplace, 'offers', soldNode)).toBeNull()

      //////////////////////////////////////////////////////////////////////////
      // fail to purchase unlisted name
      //////////////////////////////////////////////////////////////////////////

      address1BalancePre = await zilliqa.blockchain.getBalance(address.replace('0x', ''))
      let address2BalancePre = await zilliqa.blockchain.getBalance(address.replace('0x', ''))

      let tx = await expectUnchangedState(marketplace, async () => {
        return await marketplace.call(
          'buy',
          marketplaceData.f.buy({node: Zns.namehash('not-offered')}),
          {
            ...defaultParams,
            amount: new BN('1000000000000'),
          },
        )
      })

      address1BalancePost = await zilliqa.blockchain.getBalance(address.replace('0x', ''))
      let address2BalancePost = await zilliqa.blockchain.getBalance(address.replace('0x', ''))

      expect(Number(address1BalancePre.result.balance)).toBe(
        Number(address1BalancePost.result.balance),
      )
      // FIX: This is a kaya balance problem. Contract -> Regular account
      // expect(Number(address2BalancePre.result.balance)).toBe(
      //   Number(address2BalancePost.result.balance) +
      //     tx.txParams.receipt.cumulative_gas * tx.txParams.gasPrice.toNumber(),
      // )
    })
  })

  it('should disallow to sell domain outside the zone', async () => {
    const zilliqa = new Zilliqa(null, provider)
    zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

    const [, marketplace] = await deployMarketplace(zilliqa, {
      registry: nullAddress,
      seller: address,
      zone: Zns.namehash('zil'),
    })

    await marketplace.call(
      'offer',
      marketplaceData.f.offer({
        parent: Zns.namehash('com'),
        label: 'value',
        price: '1000000000000',
      }),
      defaultParams,
    )
    await marketplace.call(
      'offer',
      marketplaceData.f.offer({
        parent: Zns.namehash('zil'),
        label: 'value',
        price: '1000000000000',
      }),
      defaultParams,
    )

    expect(
      await contractMapValue(marketplace, 'offers', Zns.namehash('value.com')),
    ).toEqual(null)
    expect(
      await contractMapValue(marketplace, 'offers', Zns.namehash('value.zil')),
    ).toEqual('1000000000000')
  })
})
