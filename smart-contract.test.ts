import {Transaction, TxParams} from '@zilliqa-js/account'
import {BN, bytes, Long} from '@zilliqa-js/util'
import {toChecksumAddress} from '@zilliqa-js/crypto'
import {Zilliqa} from '@zilliqa-js/zilliqa'
import {Contract} from '@zilliqa-js/contract'
import {readFileSync} from 'fs'
import {contract_info as account_funder_contract_info} from './contract_info/account_funder.json'
import {contract_info as auction_registrar_contract_info} from './contract_info/auction_registrar.json'
import {contract_info as marketplace_contract_info} from './contract_info/marketplace.json'
import {contract_info as registry_contract_info} from './contract_info/registry.json'
import {contract_info as resolver_contract_info} from './contract_info/resolver.json'
import {contract_info as simple_registrar_contract_info} from './contract_info/simple_registrar.json'
import {generateMapperFromContractInfo} from './lib/params'
import Zns from './lib/Zns'

const accountFunderData = generateMapperFromContractInfo(
  account_funder_contract_info,
)
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

const getZilliqaNodeType = (): string => {
  const environmentVariable = process.env.ZIL_NODE_TYPE // kaya, testnet
  if (['testnet', 'standalone-node'].includes(environmentVariable)) {
    return environmentVariable
  }

  console.warn(
    "ZIL_NODE_TYPE environment variable should set as either 'kaya' or 'testnet'. 'kaya' is set by default",
  )
  return 'kaya'
}

const zilliqaNodeType = getZilliqaNodeType()

const testParams = {
  testnet: {
    jestTimeout: 15 * 60 * 1000,
  },
  'standalone-node': {
    jestTimeout: 15 * 60 * 1000,
  },
}[zilliqaNodeType]

const zilliqaTestnetNodeParams = {
  chainId: 333,
  msgVersion: 1,
  url: 'https://dev-api.zilliqa.com',
}

const standaloneNode = {
  chainId: 1,
  msgVersion: 1,
  url: 'http://127.0.0.1:5555',
}

const zilliqaNodeParams = {
  testnet: zilliqaTestnetNodeParams,
  'standalone-node': standaloneNode,
}[zilliqaNodeType]

const getZilliqa = () => new Zilliqa(zilliqaNodeParams.url)

const version = bytes.pack(
  zilliqaNodeParams.chainId,
  zilliqaNodeParams.msgVersion,
)

const defaultParams: TxParams = {
  version,
  toAddr: '0x' + '0'.repeat(40),
  amount: new BN(0),
  gasPrice: new BN(2000000000),
  gasLimit: Long.fromNumber(25000),
}

function deployAccountFunder(zilliqa: Zilliqa, params: Partial<TxParams> = {}) {
  return zilliqa.contracts
    .new(
      readFileSync('./scilla/account_funder.scilla', 'utf8'),
      accountFunderData.init({}),
    )
    .deploy({...defaultParams, ...params})
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
      simpleRegistrarData.init({
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
      auctionRegistrarData.init({
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
const address2 = '0x7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8'
const privateKey2 =
  'db11cfa086b92497c8ed5a4cc6edb3a5bfe3a640c43ffb9fc6aa0873c56f2ee3'

const defaultRootDomain = 'zil'

const defaultRootNode = Zns.namehash(defaultRootDomain)
const nullAddress = '0x' + '0'.repeat(40)

const asHash = (params) => {
  return params.reduce((a, v) => ({...a, [v.vname]: v.value}), {})
}

const contractField = async (contract: Contract, name) => {
  const value = (await contract.getState())[name]
  if (!value) {
    throw new Error(`Unknown contract field ${name}`)
  }
  return value
}

const expectUnchangedState = async (contract: Contract, block) => {
  const oldState = await contract.getState()
  const result = await block.call()
  expect(await contract.getState()).toEqual(oldState)
  return result
}

const contractMapValue = async (contract, field, key) => {
  const map = await contractField(contract, field)
  return map[key] || null
}

const transactionEvents = (tx: Transaction): Array<object> => {
  const events = tx.txParams.receipt.event_logs || []
  // Following the original reverse order of events
  return events.map((event) => {
    return {_eventname: event._eventname, ...asHash(event.params)}
  })
}

describe('smart contracts', () => {
  jest.setTimeout(testParams.jestTimeout)
  beforeEach(() => {
    jest.resetModules()
  })

  describe('resolver.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const resolver = await new Zns(zilliqa, address, {
        version,
      }).deployResolver('test')

      await resolver.reload()
      expect(resolver.records).toEqual({})
    })
    it('should deploy non-blank initial state', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      const resolver = await new Zns(zilliqa, address, {
        version,
      }).deployResolver('hello', {
        crypto: {
          ADA: {address: '0x1111'},
          BTC: {address: '0x2222'},
          EOS: {address: '0x3333'},
          ETH: {address: '0x4444'},
          XLM: {address: '0x5555'},
          XRP: {address: '0x6666'},
          ZIL: {address: '0x7777'},
        },
      })

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
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      const zns = await Zns.deployRegistry(zilliqa, undefined, undefined, {
        version,
      })
      const domain = 'tld'
      const resolver = await zns.deployResolver(domain)
      await zns.bestow(domain, address, resolver.address)
      expect(await resolver.isLive()).toBeTruthy()
      expect(await resolver.isDetached()).toBeFalsy()

      await resolver.reload()
      expect(resolver.records).toEqual({})

      const keyForSetTx = 'crypto.ADA.address'
      const valueForSetTx = '0x7357'
      const setTx = await resolver.set(keyForSetTx, valueForSetTx)

      const recordsSetEvent = {
        _eventname: 'RecordsSet',
        node: Zns.namehash(domain),
        registry: zns.address.toLowerCase(),
      }

      const configuredEvent = {
        _eventname: 'Configured',
        node: Zns.namehash(domain),
        owner: address,
        resolver: resolver.address.toLowerCase(),
      }

      expect(resolver.records).toEqual({
        [keyForSetTx]: valueForSetTx,
      })
      await resolver.reload()
      expect(resolver.records).toEqual({
        [keyForSetTx]: valueForSetTx,
      })
      expect(await transactionEvents(setTx)).toEqual([
        resolver.getRecordsSetEvent(),
        resolver.configuredEvent,
      ])

      const unsetTx = await resolver.unset(keyForSetTx)
      expect(resolver.records).toEqual({})
      await resolver.reload()
      expect(resolver.records).toEqual({})
      expect(await transactionEvents(setTx)).toEqual([
        resolver.getRecordsSetEvent(),
        resolver.configuredEvent,
      ])

      await resolver.set(keyForSetTx, valueForSetTx)
      await resolver.set(keyForSetTx, '')
      await resolver.reload()
      expect(resolver.records).toEqual({})
    })

    it('should setMulti records and unset empty ones', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      const zns = await Zns.deployRegistry(zilliqa, undefined, undefined, {
        version,
      })
      const domain = 'tld'
      const resolver = await zns.deployResolver(domain, {
        crypto: {ETH: {address: '0x0000'}},
      })
      await zns.bestow(domain, address, resolver.address)
      expect(await resolver.isLive()).toBeTruthy()

      //////////////////////////////////////////////////////////////////////////
      // setMulti records
      //////////////////////////////////////////////////////////////////////////

      const pair1 = ['crypto.ADA.address', '0x1111']
      const pair2 = ['crypto.BTC.address', '0x2222']
      const pair3 = ['crypto.ETH.address', '']

      const resolverAddress = resolver.contract.address.toLowerCase();
      const values = resolverData.f.setMulti({
        newRecords: [
          {constructor: `${resolverAddress}.RecordKeyValue`, argtypes: [], arguments: pair1},
          {constructor: `${resolverAddress}.RecordKeyValue`, argtypes: [], arguments: pair2},
          {constructor: `${resolverAddress}.RecordKeyValue`, argtypes: [], arguments: pair3},
        ],
      });
      values[0].type = `List (${resolverAddress}.RecordKeyValue)`;
     
      const setMultiTx = await resolver.contract.call(
        'setMulti',
        values,
        defaultParams,
      )

      const recordsSetEvent = {
        _eventname: 'RecordsSet',
        node: Zns.namehash(domain),
        registry: zns.address.toLowerCase(),
      }

      const configuredEvent = {
        _eventname: 'Configured',
        node: Zns.namehash(domain),
        owner: address,
        resolver: resolver.address.toLowerCase(),
      }

      await resolver.reload()
      expect(resolver.records).toEqual({
        [pair1[0]]: pair1[1],
        [pair2[0]]: pair2[1],
      })
      expect(await transactionEvents(setMultiTx)).toEqual([
        resolver.getRecordsSetEvent(),
        resolver.configuredEvent,
      ])
    })

    it('should fail to set, unset and setMulti records if sender not owner', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      let zns = new Zns(zilliqa, address, {version})
      let resolver = await zns.deployResolver('hello.zil')
      let {contract} = resolver

      //////////////////////////////////////////////////////////////////////////
      // fail to set record using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await expectUnchangedState(contract, async () => {
        await expect(resolver.set('test', '0x7357')).rejects.toThrow(
          /Sender not owner/,
        )
      })

      //////////////////////////////////////////////////////////////////////////
      // set record then fail to unset record using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(toChecksumAddress(address))

      await resolver.set('test', '0x7357')

      await resolver.reload()
      expect(resolver.records).toEqual({test: '0x7357'})

      zilliqa.wallet.setDefault(toChecksumAddress(address2))

      await expectUnchangedState(contract, async () => {
        await expect(resolver.unset('test')).rejects.toThrow(
          /Sender not owner or key does not exist/,
        )
      })

      //////////////////////////////////////////////////////////////////////////
      // fail to call setMulti using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(toChecksumAddress(address2))

      const resolverAddress = resolver.contract.address.toLowerCase();
      const values = resolverData.f.setMulti({
        newRecords: [
          {
            constructor: `${resolverAddress}.RecordKeyValue`,
            argtypes: [],
            arguments: ['test', '0x7357'],
          },
        ],
      });
      values[0].type = `List (${resolverAddress}.RecordKeyValue)`;

      await expectUnchangedState(resolver.contract, async () => {
        await resolver.contract.call(
          'setMulti',
          values,
          defaultParams,
        )
      })
    })

    it("should gracefully fail to unset records if they don't exist", async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      let zns = new Zns(zilliqa, address, {version})
      const resolver = await zns.deployResolver('hello.zil')

      await expectUnchangedState(resolver.contract, async () => {
        await expect(resolver.unset('does_not_exist')).rejects.toThrow(
          /Sender not owner or key does not exist/,
        )
      })
    })
  })

  describe('registry.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, undefined, {
        version,
      })
      expect(await zns.contract.getInit()).toHaveLength(5)
    })

    it('should disallow onResolverConfigured call from unauthorized resources', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, undefined, {
        version,
      })
      const registry = zns.contract

      await zns.bestow('tld', address, address2)

      const onResolverConfiguredTx = await registry.call(
        'onResolverConfigured',
        registryData.f.onResolverConfigured({
          node: Zns.namehash('tld.zil'),
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
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(
        zilliqa,
        undefined,
        defaultRootNode,
        {version},
      )
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // approve normally
      //////////////////////////////////////////////////////////////////////////

      await zns.setApprovedAddress(defaultRootNode, address2)
      expect(await zns.getApprovedAddress(defaultRootNode)).toEqual(address2)

      //////////////////////////////////////////////////////////////////////////
      // approve null address
      //////////////////////////////////////////////////////////////////////////

      await zns.setApprovedAddress(defaultRootNode, nullAddress)
      expect(await zns.getApprovedAddress(defaultRootNode)).toEqual(nullAddress)

      //////////////////////////////////////////////////////////////////////////
      // fail to approve node owned by someone else
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await expect(
          zns.setApprovedAddress('node-owned-by-someone-else', address2),
        ).rejects.toThrow(/Sender not node owner/)
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

      expect(await contractMapValue(registry, 'operators', address)).toEqual([
        '0x7bb3b0e8a59f3f61d9bff038f4aeb42cae2ecce8',
      ])

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
      expect(await contractMapValue(registry, 'operators', address)).toEqual([])
    })

    it('should add and remove admins if currently admin', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, undefined, {
        version,
      })
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // add admin
      //////////////////////////////////////////////////////////////////////////

      await zns.setAdmin(address2)

      expect(await zns.getAdminAddresses()).toEqual([address2, address])

      //////////////////////////////////////////////////////////////////////////
      // remove admin
      //////////////////////////////////////////////////////////////////////////

      await zns.setAdmin(address2, false)

      expect(await zns.getAdminAddresses()).toEqual([address])

      //////////////////////////////////////////////////////////////////////////
      // fail to set admin using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await expectUnchangedState(registry, async () => {
        await expect(zns.setAdmin(address2, true)).rejects.toThrow(
          /Sender not root node owner/,
        )
      })
    })

    it('rotates admin key', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, undefined, {
        version,
      })
      expect(await zns.getAdminAddresses()).toEqual([address])

      const registry = zns.contract
      await zns.rotateAdmin(privateKey2)
      expect(await zns.getAdminAddresses()).toEqual([address2])
    })

    it('should freely configure names properly', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(
        zilliqa,
        undefined,
        defaultRootNode,
        {version},
      )
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // configure resolver
      //////////////////////////////////////////////////////////////////////////

      const configureResolverTx = await registry.call(
        'configureResolver',
        registryData.f.configureResolver({
          node: defaultRootNode,
          resolver: address2,
        }),
        defaultParams,
      )

      expect(configureResolverTx.isConfirmed()).toBeTruthy()
      expect(transactionEvents(configureResolverTx)).toEqual([
        {
          _eventname: 'Configured',
          node: defaultRootNode,
          owner: address,
          resolver: address2,
        },
      ])

      expect(await zns.getResolverAddress(defaultRootNode)).toEqual(address2)
      expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address)

      //////////////////////////////////////////////////////////////////////////
      // configure node
      //////////////////////////////////////////////////////////////////////////

      const configureNodeTx = await registry.call(
        'configureNode',
        registryData.f.configureNode({
          node: defaultRootNode,
          owner: address2,
          resolver: address2,
        }),
        defaultParams,
      )
      expect(configureNodeTx.isConfirmed()).toBeTruthy()
      expect(transactionEvents(configureNodeTx)).toEqual([
        {
          _eventname: 'Configured',
          node: defaultRootNode,
          owner: address2,
          resolver: address2,
        },
      ])

      expect(await zns.getResolverAddress(defaultRootNode)).toEqual(address2)
      expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address2)

      //////////////////////////////////////////////////////////////////////////
      // fail to configure resolver using bad address
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'configureResolver',
          registryData.f.configureResolver({
            node: defaultRootNode,
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
            node: defaultRootNode,
            owner: address,
            resolver: address,
          }),
          defaultParams,
        )
      })
    })

    it('should freely transfer names properly', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(
        zilliqa,
        undefined,
        defaultRootNode,
        {version},
      )
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // approve address to check transfer
      //////////////////////////////////////////////////////////////////////////

      await zns.setApprovedAddress(defaultRootNode, address)

      const transferTx = await registry.call(
        'transfer',
        registryData.f.transfer({
          node: defaultRootNode,
          owner: address2,
        }),
        defaultParams,
      )
      expect(transferTx.isConfirmed()).toBeTruthy
      expect(await transactionEvents(transferTx)).toEqual([
        {
          _eventname: 'Configured',
          node: defaultRootNode,
          owner: address2,
          resolver: nullAddress,
        },
      ])

      expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address2)
      expect(await zns.getResolverAddress(defaultRootNode)).toEqual(nullAddress)

      //////////////////////////////////////////////////////////////////////////
      // fail to transfer using bad address
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'transfer',
          registryData.f.transfer({
            node: defaultRootNode,
            owner: address,
          }),
          defaultParams,
        )
      })
    })

    it('should freely assign names properly', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(
        zilliqa,
        undefined,
        defaultRootNode,
        {version},
      )
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // assign subdomain
      //////////////////////////////////////////////////////////////////////////

      await zns.setApprovedAddress(defaultRootNode, address)

      const assignTx = await registry.call(
        'assign',
        registryData.f.assign({
          parent: defaultRootNode,
          label: 'tld',
          owner: address,
        }),
        defaultParams,
      )
      expect(assignTx.isConfirmed()).toBeTruthy
      expect(await transactionEvents(assignTx)).toEqual([
        {
          _eventname: 'Configured',
          node: Zns.namehash('tld.zil'),
          owner: address,
          resolver: nullAddress,
        },
        {
          _eventname: 'NewDomain',
          parent: defaultRootNode,
          label: 'tld',
        },
      ])
      expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address)
      expect(await zns.getResolverAddress(defaultRootNode)).toEqual(nullAddress)
      expect(await zns.getOwnerAddress('tld.zil')).toEqual(address)
      expect(await zns.getResolverAddress('tld.zil')).toEqual(nullAddress)

      //////////////////////////////////////////////////////////////////////////
      // assign owned subdomain
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'assign',
        registryData.f.assign({
          parent: defaultRootNode,
          label: 'tld',
          owner: address2,
        }),
        defaultParams,
      )
      expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address)
      expect(await zns.getResolverAddress(defaultRootNode)).toEqual(nullAddress)
      expect(await zns.getOwnerAddress('tld.zil')).toEqual(address2)
      expect(await zns.getResolverAddress('tld.zil')).toEqual(nullAddress)

      //////////////////////////////////////////////////////////////////////////
      // fail to assign subdomain using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await expectUnchangedState(registry, async () => {
        await registry.call(
          'assign',
          registryData.f.assign({
            parent: defaultRootNode,
            label: 'tld',
            owner: nullAddress,
          }),
          defaultParams,
        )
      })
    })

    it('should freely bestow names properly', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(
        zilliqa,
        undefined,
        defaultRootNode,
        {version},
      )
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // bestow name
      //////////////////////////////////////////////////////////////////////////

      const bestowTx = await zns.bestow('tld', address, address)
      expect(await transactionEvents(bestowTx)).toEqual([
        {
          _eventname: 'Configured',
          node: Zns.namehash('tld.zil'),
          owner: address,
          resolver: address,
        },
        {
          _eventname: 'NewDomain',
          parent: defaultRootNode,
          label: 'tld',
        },
      ])

      expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address)
      expect(await zns.getOwnerAddress('tld.zil')).toEqual(address)
      expect(await zns.getOwnerAddress('unknown')).toEqual(undefined)
      expect(await zns.getResolverAddress(defaultRootNode)).toEqual(nullAddress)
      expect(await zns.getResolverAddress('tld.zil')).toEqual(address)
      expect(await zns.getResolverAddress('unknown')).toEqual(undefined)

      //////////////////////////////////////////////////////////////////////////
      // fail to bestow owned name
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await expect(zns.bestow('tld', address2, address2)).rejects.toThrow(
          /Sender admin/,
        )
      })

      //////////////////////////////////////////////////////////////////////////
      // fail to bestow owned using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await expectUnchangedState(registry, async () => {
        await expect(
          zns.bestow('other-tld', address2, address2),
        ).rejects.toThrow(/Sender admin/)
      })
    })

    it('should allow admins to set registrar', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, undefined, {
        version,
      })
      const registry = zns.contract

      //////////////////////////////////////////////////////////////////////////
      // set registrar address
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'setRegistrar',
        registryData.f.setRegistrar({address: address2}),
        defaultParams,
      )

      expect(await contractField(registry, 'registrar')).toEqual(address2)

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
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [registrarTx, registrar] = await deploySimpleRegistrar(
        zilliqa,
        {
          registry: '0x' + '0'.repeat(40),
          owner: '0x' + '0'.repeat(40),
          ownedNode: defaultRootNode,
          initialDefaultPrice: '1',
          initialQaPerUSD: '1',
        },
        {gasLimit: Long.fromNumber(100000)},
      )
      expect(registrarTx.isConfirmed()).toBeTruthy()
      expect(await registrar.getInit()).toHaveLength(8)
    })

    it('should register name', async () => {
      const labelToRegister = 'name'
      const domainToRegister = `${labelToRegister}.${defaultRootDomain}`
      const nodeToRegister = Zns.namehash(domainToRegister)
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(
        zilliqa,
        undefined,
        defaultRootNode,
        {version},
      )
      const registry = zns.contract

      const [, registrar] = await deploySimpleRegistrar(
        zilliqa,
        {
          registry: zns.address,
          owner: address,
          ownedNode: defaultRootNode,
          initialDefaultPrice: '1',
          initialQaPerUSD: '1',
        },
        {gasLimit: Long.fromNumber(100000)},
      )

      await registry.call(
        'setRegistrar',
        registryData.f.setRegistrar({address: registrar.address}),
        defaultParams,
      )

      //////////////////////////////////////////////////////////////////////////
      // register name
      //////////////////////////////////////////////////////////////////////////

      const registerTx = await zns.register(domainToRegister, 1)

      expect(registerTx.isConfirmed()).toBeTruthy()
      expect(await transactionEvents(registerTx)).toEqual([
        {
          _eventname: 'Register',
          node: nodeToRegister,
          owner: address,
          price: '1',
        },
        {
          _eventname: 'Configured',
          node: nodeToRegister,
          owner: address,
          resolver: nullAddress,
        },
        {
          _eventname: 'NewDomain',
          parent: defaultRootNode,
          label: labelToRegister,
        },
      ])

      expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address)
      expect(await zns.getResolverAddress(defaultRootNode)).toEqual(nullAddress)
      expect(await zns.getOwnerAddress(domainToRegister)).toEqual(address)
      expect(await zns.getResolverAddress(domainToRegister)).toEqual(
        nullAddress,
      )

      //////////////////////////////////////////////////////////////////////////
      // fail to register name using bad amount
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await expect(zns.register('example', 0)).rejects.toThrow(
          /Not valid parent, record owner, amount or sender/,
        )
      })

      //////////////////////////////////////////////////////////////////////////
      // fail to register name using owned name
      //////////////////////////////////////////////////////////////////////////

      await expectUnchangedState(registry, async () => {
        await expect(zns.register(domainToRegister, 1)).rejects.toThrow(
          'Transaction did not register a domain',
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
            parent: defaultRootNode,
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
  ;(zilliqaNodeType === 'kaya' ? describe : describe.skip)(
    'auction_registrar.scilla',
    () => {
      it('should deploy', async () => {
        const zilliqa = getZilliqa()
        zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

        const [registrarTx, registrar] = await deployAuctionRegistrar(
          zilliqa,
          {
            owner: '0x' + '0'.repeat(40),
            registry: '0x' + '0'.repeat(40),
            ownedNode: defaultRootNode,
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
        const zilliqa = getZilliqa()
        zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

        const zns = await Zns.deployRegistry(
          zilliqa,
          undefined,
          defaultRootNode,
          {version},
        )
        const registry = zns.contract

        const [, registrar] = await deployAuctionRegistrar(
          zilliqa,
          {
            owner: address,
            registry: zns.address,
            ownedNode: defaultRootNode,
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
          registryData.f.setRegistrar({address: registrar.address}),
          defaultParams,
        )

        await registry.call(
          'setAdmin',
          registryData.f.setAdmin({
            address: registrar.address,
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

        const labelForTest = 'name'
        const domainForTest = `${labelForTest}.${defaultRootDomain}`
        const nodeForTest = Zns.namehash(domainForTest)
        const labelForRegisterTest = 'registered-name.zil'
        const labelForBidTest = 'bid-name'
        const domainForBidTest = `${labelForBidTest}.${defaultRootDomain}`
        const nodeForBidTest = Zns.namehash(domainForBidTest)

        //////////////////////////////////////////////////////////////////////////
        // open an auction
        //////////////////////////////////////////////////////////////////////////

        await zns.register(domainForTest, 200)

        expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address)
        expect(await zns.getResolverAddress(defaultRootNode)).toEqual(
          nullAddress,
        )

        expect(await zns.getOwnerAddress(domainForTest)).toEqual(
          registrar.address.toLowerCase(),
        )
        expect(await zns.getResolverAddress(domainForTest)).toEqual(nullAddress)

        expect(
          await contractMapValue(registrar, 'auctions', nodeForTest),
        ).toMatchObject({
          constructor: 'Auction',
          argtypes: [],
          arguments: [
            address,
            '200',
            expect.stringMatching(/^\d+$/),
            labelForTest,
          ],
        })

        //////////////////////////////////////////////////////////////////////////
        // bid on an auction
        //////////////////////////////////////////////////////////////////////////

        await registrar.call(
          'bid',
          auctionRegistrarData.f.bid({node: nodeForTest}),
          {...defaultParams, amount: new BN(300)},
        )

        expect(
          await contractMapValue(registrar, 'auctions', nodeForTest),
        ).toMatchObject({
          constructor: 'Auction',
          argtypes: [],
          arguments: [
            address,
            '300',
            expect.stringMatching(/^\d*$/),
            labelForTest,
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
          auctionRegistrarData.f.close({node: nodeForTest}),
          defaultParams,
        )

        expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address)
        expect(await zns.getResolverAddress(defaultRootNode)).toEqual(
          nullAddress,
        )
        expect(await zns.getOwnerAddress(domainForTest)).toEqual(address)
        expect(await zns.getResolverAddress(domainForTest)).toEqual(nullAddress)

        expect(await contractField(registrar, 'auctions')).toHaveLength(0)

        //////////////////////////////////////////////////////////////////////////
        // close an auction on register
        //////////////////////////////////////////////////////////////////////////

        await zns.register(labelForRegisterTest, 2000)

        expect(await zns.getOwnerAddress(defaultRootNode)).toEqual(address)
        expect(await zns.getResolverAddress(defaultRootNode)).toEqual(
          nullAddress,
        )
        expect(await zns.getOwnerAddress(domainForTest)).toEqual(address)
        expect(await zns.getResolverAddress(domainForTest)).toEqual(nullAddress)

        expect(await contractField(registrar, 'auctions')).toHaveLength(0)

        //////////////////////////////////////////////////////////////////////////
        // close an auction on bid
        //////////////////////////////////////////////////////////////////////////

        await zns.register(domainForBidTest, 200)

        await registrar.call(
          'bid',
          auctionRegistrarData.f.bid({node: nodeForBidTest}),
          {...defaultParams, amount: new BN(2000)},
        )

        await zilliqa.provider.send('KayaMine')

        await registrar.call(
          'close',
          auctionRegistrarData.f.close({node: nodeForBidTest}),
          defaultParams,
        )

        expect(await zns.getOwnerAddress(domainForBidTest)).toEqual(address)
        expect(await zns.getResolverAddress(domainForBidTest)).toEqual(
          nullAddress,
        )

        expect(await contractField(registrar, 'auctions')).toHaveLength(0)
      })
    },
  )

  describe('marketplace.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [marketplaceTx, marketplace] = await deployMarketplace(zilliqa, {
        registry: '0x' + '0'.repeat(40),
        seller: '0x' + '0'.repeat(40),
        zone: defaultRootNode,
      })

      expect(marketplaceTx.isConfirmed()).toBeTruthy()
      expect(await marketplace.getInit()).toHaveLength(6)
    })

    it.skip('should enable buying and selling of names', async () => {
      const zilliqa = getZilliqa()
      const soldDomain = 'domain'
      const soldNode = Zns.namehash(`${soldDomain}.${defaultRootDomain}`)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const zns = await Zns.deployRegistry(zilliqa, undefined, undefined, {
        version,
      })
      const registry = zns.contract

      const [, marketplace] = await deployMarketplace(zilliqa, {
        registry: zns.address,
        seller: address,
        zone: defaultRootNode,
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
          parent: defaultRootNode,
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
          parent: defaultRootNode,
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

      address1BalancePre = await zilliqa.blockchain.getBalance(
        address.replace('0x', ''),
      )
      let address2BalancePre = await zilliqa.blockchain.getBalance(
        address.replace('0x', ''),
      )

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

      address1BalancePost = await zilliqa.blockchain.getBalance(
        address.replace('0x', ''),
      )
      let address2BalancePost = await zilliqa.blockchain.getBalance(
        address.replace('0x', ''),
      )

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

  describe('account_funder.scilla', () => {
    it('distributes funds', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.addByPrivateKey(privateKey)

      const [, accountFunder] = await deployAccountFunder(zilliqa)

      const args = [
        {account: zilliqa.wallet.create(), value: '400'},
        {account: zilliqa.wallet.create(), value: '100'},
        {account: zilliqa.wallet.create(), value: '500'},
      ]
      const accountsToLoad = args.reduce((accounts, arg) => {
        accounts[arg.account.replace('0x', '').toLowerCase()] = {
          privateKey: zilliqa.wallet.accounts[arg.account].privateKey,
          amount: '0',
          nonce: 0,
        }
        return accounts
      }, {})


     const accountFunderAddress = accountFunder.address.toLowerCase();
     const values = accountFunderData.f.sendFunds({
        accountValues: args.map((arg) => ({
          constructor: `${accountFunderAddress}.AccountValue`,
          argtypes: [],
          arguments: [arg.account, arg.value],
        })),
      })
      values[0].type = `List (${accountFunderAddress}.AccountValue)`;

      const sendFundsTx = await accountFunder.call(
        'sendFunds',
        values,
        {
          ...defaultParams,
          amount: new BN(1000),
          nonce: 0,
        },
      )
      expect(sendFundsTx.isConfirmed()).toBe(true)

      const balances = await Promise.all(
        args.map((arg) => zilliqa.blockchain.getBalance(arg.account)),
      )
      const expectedBalances = args.map((arg) => arg.value)
      expect(balances.map((res) => res.result.balance)).toEqual(
        expectedBalances,
      )
    })

    it('fails if amount is not equal to fund sum', async () => {
      const zilliqa = getZilliqa()
      zilliqa.wallet.addByPrivateKey(privateKey)

      const [, accountFunder] = await deployAccountFunder(zilliqa)

      const args = [
        {account: zilliqa.wallet.create(), value: '400'},
        {account: zilliqa.wallet.create(), value: '600'},
      ]
      const accountsToLoad = args.reduce((accounts, arg) => {
        accounts[arg.account.replace('0x', '').toLowerCase()] = {
          privateKey: zilliqa.wallet.accounts[arg.account].privateKey,
          amount: '0',
          nonce: 0,
        }
        return accounts
      }, {})

      const accountFunderAddress = accountFunder.address.toLowerCase();
      const values = accountFunderData.f.sendFunds({
        accountValues: args.map((arg) => ({
          constructor: `${accountFunderAddress}.AccountValue`,
          argtypes: [],
          arguments: [arg.account, arg.value],
        })),
      });
      values[0].type = `List (${accountFunderAddress}.AccountValue)`;

      const sendFundsTx = await accountFunder.call(
        'sendFunds',
        values,
        {
          ...defaultParams,
          amount: new BN(1100),
          nonce: 0,
        },
      )
      expect(sendFundsTx.isConfirmed()).toBe(false)

      const responseErrors = (
        await Promise.all(
          args.map((arg) => zilliqa.blockchain.getBalance(arg.account)),
        )
      ).map((response) => response.error.code)
      const expectedErrors = [-5, -5]
      expect(responseErrors).toEqual(expectedErrors)
    })
  })

  it('should disallow to sell domain outside the zone', async () => {
    const zilliqa = getZilliqa()
    zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

    const [, marketplace] = await deployMarketplace(zilliqa, {
      registry: nullAddress,
      seller: address,
      zone: defaultRootNode,
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
        parent: defaultRootNode,
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
