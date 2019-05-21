import {TxParams} from '@zilliqa-js/account'
import {BN, bytes, Long} from '@zilliqa-js/util'
import {Zilliqa} from '@zilliqa-js/zilliqa'
import {readFileSync} from 'fs'
import {readdirSync} from 'fs'
import * as hashjs from 'hash.js'
import * as KayaProvider from 'kaya-cli/src/provider'
import {basename, join} from 'path'
import * as uuid from 'uuid/v4'
import {
  contract_info as auction_registrar_contract_info,
} from './contract_info/auction_registrar.json'
import {
  contract_info as registry_contract_info,
} from './contract_info/registry.json'
import {
  contract_info as resolver_contract_info,
} from './contract_info/resolver.json'
import {
  contract_info as simple_registrar_contract_info,
} from './contract_info/simple_registrar.json'
import {generateMapperFromContractInfo} from './lib/params'
// import {checker} from '../lib/scilla'

const auctionRegistrarData = generateMapperFromContractInfo(
  auction_registrar_contract_info,
)
const registryData = generateMapperFromContractInfo(registry_contract_info)
const resolverData = generateMapperFromContractInfo(resolver_contract_info)
const simpleRegistrarData = generateMapperFromContractInfo(
  simple_registrar_contract_info,
)

const version = bytes.pack(111, 1)

const defaultParams: TxParams = {
  version,
  toAddr: '0'.repeat(40),
  amount: new BN(0),
  gasPrice: new BN(1000000000),
  gasLimit: Long.fromNumber(25000),
}

function deployRegistry(
  zilliqa: Zilliqa,
  {initialOwner, _creation_block = '0'},
  params: Partial<TxParams> = {},
) {
  return zilliqa.contracts
    .new(
      readFileSync('./scilla/registry.scilla', 'utf8'),
      registryData.init({initialOwner}).concat({
        vname: '_creation_block',
        type: 'BNum',
        value: _creation_block.toString(),
      }),
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
    initialLiPerUSD, // 0.017 * 10 ** 12,
    _creation_block = '0',
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
          initialLiPerUSD,
        })
        .concat({
          vname: '_creation_block',
          type: 'BNum',
          value: _creation_block.toString(),
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
    .deploy({...defaultParams, ...params})
}

function deployResolver(
  zilliqa: Zilliqa,
  {owner, _creation_block = '0'},
  params: Partial<TxParams> = {},
) {
  return zilliqa.contracts
    .new(
      readFileSync('./scilla/resolver.scilla', 'utf8'),
      resolverData.init({owner}).concat({
        vname: '_creation_block',
        type: 'BNum',
        value: _creation_block.toString(),
      }),
    )
    .deploy({...defaultParams, ...params})
}

function sha256(buffer) {
  return Buffer.from(
    hashjs
      .sha256()
      .update(buffer)
      .digest(),
  )
}

function namehash(name) {
  let node = Buffer.alloc(32, 0)

  if (name) {
    let labels = name.split('.')

    for (let i = labels.length - 1; i >= 0; i--) {
      node = sha256(Buffer.concat([node, sha256(labels[i])]))
    }
  }

  return '0x' + node.toString('hex')
}

const address = 'd90f2e538ce0df89c8273cad3b63ec44a3c4ed82'
const privateKey =
  'e53d1c3edaffc7a7bab5418eb836cf75819a82872b4a1a0f1c7fcf5c3e020b89'
const address2 = '2f4f79ef6abfc0368f5a7e2c2df82e1afdfe7204'
const privateKey2 =
  '1234567890123456789012345678901234567890123456789012345678901234'

const rootNode = '0x' + '0'.repeat(64)

describe('checks', () => {
  for (const input of readdirSync(join(process.cwd(), 'scilla'))
    .map(v => join(process.cwd(), 'scilla', v))
    .filter(v => v.endsWith('.scilla'))) {
    it.todo(
      `should successfully type-check ${basename(
        input,
      )}` /* , () =>
      checker({input}) */,
    )
  }
})

describe('smart contracts', () => {
  let provider
  beforeEach(() => {
    jest.resetModules()

    const id = uuid()

    provider = new KayaProvider(
      {dataPath: `/tmp/kaya_${id}_`},
      {
        [address]: {privateKey, amount: '1000000000000000000000', nonce: 0},
        [address2]: {
          privateKey: privateKey2,
          amount: '1000000000000000000000',
          nonce: 0,
        },
      },
    )
  })

  describe('resolver.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [resolverTx, resolver] = await deployResolver(zilliqa, {
        owner: '0x' + address,
      })
      expect(resolverTx.isConfirmed()).toBeTruthy()
      expect(await resolver.getInit()).toHaveLength(4) //owner,this,cblock,version
    })

    it('should set and unset records', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      const [, resolver] = await deployResolver(zilliqa, {
        owner: '0x' + address,
      })

      //////////////////////////////////////////////////////////////////////////
      // set record
      //////////////////////////////////////////////////////////////////////////

      await resolver.call(
        'set',
        resolverData.f.set({key: 'test', value: '0x7357'}),
        defaultParams,
      )

      expect(
        (await resolver.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([{key: 'test', val: '0x7357'}])

      //////////////////////////////////////////////////////////////////////////
      // unset record
      //////////////////////////////////////////////////////////////////////////

      await resolver.call(
        'unset',
        resolverData.f.unset({key: 'test'}),
        defaultParams,
      )

      expect(
        (await resolver.getState()).find(v => v.vname === 'records').value,
      ).toHaveLength(0)
    })

    it('should fail to set and unset records if sender not owner', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      const [, resolver] = await deployResolver(zilliqa, {
        owner: '0x' + address,
      })

      //////////////////////////////////////////////////////////////////////////
      // fail to set record using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await resolver.call(
        'set',
        resolverData.f.set({key: 'test', value: '0x7357'}),
        defaultParams,
      )

      expect(
        (await resolver.getState()).find(v => v.vname === 'records').value,
      ).toHaveLength(0)

      //////////////////////////////////////////////////////////////////////////
      // set record then fail to unset record using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(address)

      await resolver.call(
        'set',
        resolverData.f.set({key: 'test', value: '0x7357'}),
        defaultParams,
      )

      expect(
        (await resolver.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([{key: 'test', val: '0x7357'}])

      zilliqa.wallet.setDefault(address2)

      await resolver.call(
        'unset',
        resolverData.f.unset({key: 'test'}),
        defaultParams,
      )

      expect(
        (await resolver.getState()).find(v => v.vname === 'records').value,
      ).toHaveLength(1)
    })

    it("should gracefully fail to unset records if they don't exist", async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))
      const [, resolver] = await deployResolver(zilliqa, {
        owner: '0x' + address,
      })

      //////////////////////////////////////////////////////////////////////////
      // shouldn't do anything
      //////////////////////////////////////////////////////////////////////////

      await resolver.call(
        'unset',
        resolverData.f.unset({key: 'does_not_exist'}),
        defaultParams,
      )

      expect(
        (await resolver.getState()).find(v => v.vname === 'records').value,
      ).toHaveLength(0)
    })
  })

  describe('registry.scilla', () => {
    it('should deploy', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [registryTx, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )
      expect(registryTx.isConfirmed()).toBeTruthy()
      expect(await registry.getInit()).toHaveLength(4)
    })

    it('should approve addresses and set and unset operators for addresses', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )

      //////////////////////////////////////////////////////////////////////////
      // approve normally
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approve',
        registryData.f.approve({node: rootNode, address: '0x' + address2}),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'approvals').value,
      ).toMatchObject([{key: rootNode, val: '0x' + address2}])

      //////////////////////////////////////////////////////////////////////////
      // approve null address
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approve',
        registryData.f.approve({
          node: rootNode,
          address: '0x' + '0'.repeat(40),
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'approvals').value,
      ).toMatchObject([{key: rootNode, val: '0x' + '0'.repeat(40)}])

      //////////////////////////////////////////////////////////////////////////
      // fail to approve node owned by someone else
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approve',
        registryData.f.approve({
          node: namehash('node-owned-by-someone-else'),
          address: '0x' + address2,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'approvals').value,
      ).toMatchObject([{key: rootNode, val: '0x' + '0'.repeat(40)}])

      //////////////////////////////////////////////////////////////////////////
      // add operator
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approveFor',
        registryData.f.approveFor({
          address: '0x' + address2,
          isApproved: {constructor: 'True', argtypes: [], arguments: []},
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'operators').value,
      ).toMatchObject([
        {
          key: '0xd90f2e538ce0df89c8273cad3b63ec44a3c4ed82',
          val: ['0x2f4f79ef6abfc0368f5a7e2c2df82e1afdfe7204'],
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // remove operator
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approveFor',
        registryData.f.approveFor({
          address: '0x' + address2,
          isApproved: {constructor: 'False', argtypes: [], arguments: []},
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'operators').value,
      ).toMatchObject([
        {key: '0xd90f2e538ce0df89c8273cad3b63ec44a3c4ed82', val: []},
      ])
    })

    it('should add and remove admins if currently admin', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )

      //////////////////////////////////////////////////////////////////////////
      // add admin
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'setAdmin',
        registryData.f.setAdmin({
          address: '0x' + address2,
          isApproved: {constructor: 'True', argtypes: [], arguments: []},
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'admins').value,
      ).toMatchObject(['0x' + address2, '0x' + address])

      //////////////////////////////////////////////////////////////////////////
      // remove admin
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'setAdmin',
        registryData.f.setAdmin({
          address: '0x' + address2,
          isApproved: {constructor: 'False', argtypes: [], arguments: []},
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'admins').value,
      ).toMatchObject(['0x' + address])

      //////////////////////////////////////////////////////////////////////////
      // fail to set admin using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await registry.call(
        'setAdmin',
        registryData.f.setAdmin({
          address: '0x' + address2,
          isApproved: {constructor: 'True', argtypes: [], arguments: []},
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'admins').value,
      ).toMatchObject(['0x' + address])
    })

    it('should freely configure names properly', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )

      //////////////////////////////////////////////////////////////////////////
      // configure resolver
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'configureResolver',
        registryData.f.configureResolver({
          node: rootNode,
          resolver: '0x' + address2,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + address2],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // configure node
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'configureNode',
        registryData.f.configureNode({
          node: rootNode,
          owner: '0x' + address2,
          resolver: '0x' + address2,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address2, '0x' + address2],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // fail to configure resolver using bad address
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'configureResolver',
        registryData.f.configureResolver({
          node: rootNode,
          resolver: '0x' + address,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address2, '0x' + address2],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // fail to configure node using bad address
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'configureNode',
        registryData.f.configureNode({
          node: rootNode,
          owner: '0x' + address,
          resolver: '0x' + address,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address2, '0x' + address2],
          },
        },
      ])
    })

    it('should freely transfer names properly', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )

      //////////////////////////////////////////////////////////////////////////
      // approve address to check transfer
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approve',
        registryData.f.approve({node: rootNode, address: '0x' + address}),
        defaultParams,
      )

      await registry.call(
        'transfer',
        registryData.f.transfer({
          node: rootNode,
          owner: '0x' + address2,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address2, '0x' + '0'.repeat(40)],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // fail to transfer using bad address
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'transfer',
        registryData.f.transfer({
          node: rootNode,
          owner: '0x' + address,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address2, '0x' + '0'.repeat(40)],
          },
        },
      ])
    })

    it('should freely assign names properly', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )

      //////////////////////////////////////////////////////////////////////////
      // assign subdomain
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'approve',
        registryData.f.approve({node: rootNode, address: '0x' + address}),
        defaultParams,
      )

      await registry.call(
        'assign',
        registryData.f.assign({
          parent: rootNode,
          label: 'tld',
          owner: '0x' + address,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('tld'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // assign owned subdomain
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'assign',
        registryData.f.assign({
          parent: rootNode,
          label: 'tld',
          owner: '0x' + address2,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('tld'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address2, '0x' + '0'.repeat(40)],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // fail to assign subdomain using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await registry.call(
        'assign',
        registryData.f.assign({
          parent: rootNode,
          label: 'tld',
          owner: '0x' + address2,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('tld'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address2, '0x' + '0'.repeat(40)],
          },
        },
      ])
    })

    it('should freely bestow names properly', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )

      //////////////////////////////////////////////////////////////////////////
      // bestow name
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'bestow',
        registryData.f.bestow({
          parent: rootNode,
          label: 'tld',
          owner: '0x' + address,
          resolver: '0x' + address,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('tld'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + address],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // fail to bestow owned name
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'bestow',
        registryData.f.bestow({
          parent: rootNode,
          label: 'tld',
          owner: '0x' + address2,
          resolver: '0x' + address2,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('tld'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + address],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // fail to bestow owned using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await registry.call(
        'bestow',
        registryData.f.bestow({
          parent: rootNode,
          label: 'other-tld',
          owner: '0x' + address2,
          resolver: '0x' + address2,
        }),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('tld'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + address],
          },
        },
      ])
    })

    it('should allow admins to set registrar', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )

      //////////////////////////////////////////////////////////////////////////
      // set registrar address
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'setRegistrar',
        registryData.f.setRegistrar({address: '0x' + address2}),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'registrar').value,
      ).toBe('0x' + address2)

      //////////////////////////////////////////////////////////////////////////
      // fail to set registrar address using bad address
      //////////////////////////////////////////////////////////////////////////

      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey2))

      await registry.call(
        'setRegistrar',
        registryData.f.setRegistrar({address: '0x' + address}),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'registrar').value,
      ).toBe('0x' + address2)
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
          initialLiPerUSD: '1',
        },
        {gasLimit: Long.fromNumber(100000)},
      )
      expect(registrarTx.isConfirmed()).toBeTruthy()
      expect(await registrar.getInit()).toHaveLength(8)
    })

    it('should register name', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )

      const [, registrar] = await deploySimpleRegistrar(
        zilliqa,
        {
          registry: '0x' + registry.address,
          owner: '0x' + address,
          ownedNode: rootNode,
          initialDefaultPrice: '1',
          initialLiPerUSD: '1',
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

      await registry.call(
        'register',
        registryData.f.register({parent: rootNode, label: 'name'}),
        {
          ...defaultParams,
          amount: new BN(1),
        },
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('name'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // fail to register name using bad amount
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'register',
        registryData.f.register({parent: rootNode, label: 'not-enough-funds'}),
        defaultParams,
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('name'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // fail to register name using owned name
      //////////////////////////////////////////////////////////////////////////

      await registry.call(
        'register',
        registryData.f.register({parent: rootNode, label: 'name'}),
        {
          ...defaultParams,
          amount: new BN(1),
        },
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('name'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
      ])

      //////////////////////////////////////////////////////////////////////////
      // fail to register name using bad sender
      //////////////////////////////////////////////////////////////////////////

      await registrar.call(
        'register',
        simpleRegistrarData.f.register({
          node: namehash('bad-sender'),
          parent: rootNode,
          label: 'bad-sender',
          origin: '0x' + address,
        }),
        {
          ...defaultParams,
          amount: new BN(1),
        },
      )

      expect(
        (await registry.getState()).find(v => v.vname === 'records').value,
      ).toMatchObject([
        {
          key: rootNode,
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
        {
          key: namehash('name'),
          val: {
            constructor: 'Record',
            argtypes: [],
            arguments: ['0x' + address, '0x' + '0'.repeat(40)],
          },
        },
      ])
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
          initialPricePerLi: '100',
          initialMaxPriceUSD: '1000',
        },
        {gasLimit: Long.fromNumber(100000)},
      )
      expect(registrarTx.isConfirmed()).toBeTruthy()
      expect(await registrar.getInit()).toHaveLength(13)
    })

    xit('should start, bid and end auction', async () => {
      const zilliqa = new Zilliqa(null, provider)
      zilliqa.wallet.setDefault(zilliqa.wallet.addByPrivateKey(privateKey))

      const [, registry] = await deployRegistry(
        zilliqa,
        {initialOwner: '0x' + address},
        {gasLimit: Long.fromNumber(100000)},
      )

      const [, registrar] = await deployAuctionRegistrar(
        zilliqa,
        {
          owner: '0x' + '0'.repeat(40),
          registry: '0x' + '0'.repeat(40),
          ownedNode: rootNode,
          initialAuctionLength: '3',
          minimumAuctionLength: '2',
          initialDefaultPrice: '100',
          bidIncrementNumerator: '1',
          bidIncrementDenominator: '100',
          initialPricePerLi: '1',
          initialMaxPriceUSD: '1000',
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

      const tx = await registry.call(
        'register',
        registryData.f.register({parent: rootNode, label: 'name'}),
        {
          ...defaultParams,
          amount: new BN(100000),
        },
      )

      console.log(tx)

      console.log(
        'registry.getState()',
        JSON.stringify(await registry.getState(), null, 2),
      )

      console.log(
        'registrar.getState()',
        JSON.stringify(await registrar.getState(), null, 2),
      )
    })
  })
})
