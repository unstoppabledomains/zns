import * as hashjs from 'hash.js'
import {Transaction, TxParams} from '@zilliqa-js/account'
import {Zilliqa} from '@zilliqa-js/zilliqa'
import {Contract} from '@zilliqa-js/contract'
import {BN, bytes, Long} from '@zilliqa-js/util'
import * as fs from 'fs'
import * as _ from 'lodash'

import {contract_info as registryContractInfo} from '../contract_info/registry.json'
import {contract_info as resolver_contract_info} from '../contract_info/resolver.json'
import {generateMapperFromContractInfo} from './params'

type Address = string
type Domain = string
type Node = string
type Resolution = any
type Records = {[key: string]: string}

const registryData = generateMapperFromContractInfo(registryContractInfo)
const resolverData = generateMapperFromContractInfo(resolver_contract_info)

function sha256(buffer) {
  return Buffer.from(
    hashjs
      .sha256()
      .update(buffer)
      .digest(),
  )
}

let contractField = async (contract: Contract, name: string, init: boolean = false) => {
  let state = init ? await contract.getInit() : await contract.getState()
  const field = state.find(v => v.vname === name)
  if (!field) {
    throw new Error(`Unknown contract field ${name}`)
  }
  return field.value
}

let isDefaultResolution = (resolution: Resolution) => {
}

let normalizeAddress = (address: Address) => {
  if (!address) {
    return null
  }
  address = address.toLowerCase()
  if (!address.startsWith("0x")) {
    address = "0x" + address
  }
  return address
}

let normalizeContractAddress = (zilliqa: Zilliqa, argument: Address | Contract): [Address, Contract] => {
    if (typeof(argument) == "string") {
      let address = normalizeAddress(argument)
      return [address, getContract(zilliqa, address)]
    } else {
      return [normalizeAddress(argument.address), argument]
    }
}

let defaultWalletAddress = (zilliqa: Zilliqa): Address => {
  return zilliqa.wallet.defaultAccount && normalizeAddress(zilliqa.wallet.defaultAccount.address)
}

let getContract = (zilliqa: Zilliqa, address: Address): Contract => {
  return zilliqa.contracts.at(normalizeAddress(address).slice(2))
}

let isInitResolution = (resolution: Resolution): boolean => {
  let keys = Object.keys(resolution)
  return _.difference(keys, ['crypto']) == [] &&
    _.difference(_.keys(resolution.crypto), DEFAULT_CURRENCIES) == [] &&
    _.every(_.values(resolution.crypto), v => _.difference(_.keys(v), ['address']) == [])

}

let addressKey = (currency: string): string => {
  return `crypto.${currency.toUpperCase()}.address`
}

//TODO improve message
let ensureTxConfirmed = (tx: Transaction, message: string = "Transaction is not confirmed"): Transaction => {
  if (!tx.isConfirmed()) {
    throw new ZnsError(message)
  }
  return tx
}

class ZnsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

class PermissionError extends ZnsError {

}

let DEFAULT_CURRENCIES = ['ADA', 'BTC', 'EOS', 'ETH', 'XLM', 'XRP', 'ZIL']
class Resolver {
  readonly address: Address
  contract: Contract
  readonly domain: Domain
  owner: Address
  readonly registry: Zns
  records: Records

  constructor(
    registry: Zns,
    resolver: Address | Contract,
    domain: Domain,
    owner: Address,
    records: Records
  ) {
    this.domain = domain
    let [address, contract] = normalizeContractAddress(registry.zilliqa, resolver)
    this.address = address
    this.contract = contract
    this.owner = owner
    this.registry = registry
    this.records = records
  }

  async reload(): Promise<this> {
    this.contract = getContract(this.registry.zilliqa, this.address)
    this.records = (await contractField(this.contract, 'records') as any)
      .reduce((a, v) => ({...a, [v.key]: v.val}), {})
    this.owner = normalizeAddress(await contractField(this.contract, 'owner', true) as Address)
    return this
  }

  //TODO
  async set(key: string, value: string, txParams?: Partial<TxParams>): Promise<Transaction> {
    const tx = await this.contract.call(
      'set',
      resolverData.f.set({key, value}),
      this.fullTxParams(txParams),
    )
    ensureTxConfirmed(tx)
    this.records[key] = value
    return tx
  }

  //TODO
  async unset(key: string, txParams?: Partial<TxParams>): Promise<Transaction> {
    const tx = await this.contract.call(
      'unset',
      resolverData.f.unset({key}),
      this.fullTxParams(txParams),
    )
    ensureTxConfirmed(tx)
    delete this.records[key]
    return tx
  }

  //TODO convert into property
  get resolution(): Resolution {
    return _.reduce(this.records,
      (result, value, key) => _.set(result, key, value), {})
  }

  get node(): Node {
    return Zns.namehash(this.domain)
  }

  get configuredEvent() {
    return {
      _eventname: 'Configured',
      node: this.node,
      owner: this.owner,
      resolver: this.address,
    }
  }

  private fullTxParams(txParams: Partial<TxParams>): TxParams {
      return {...this.registry.defaultTxParams, ...txParams} as TxParams
  }
}


export default class Zns {
  static NULL_ADDRESS = '0x' + '0'.repeat(40)
  static NULL_NODE = '0x' + '0'.repeat(64)
  static DEFAULT_CHAIN_ID = 1
  static DEFAULT_TX_PARAMS: Partial<TxParams> =  {
    version: bytes.pack(Zns.DEFAULT_CHAIN_ID, 1),
    toAddr: Zns.NULL_ADDRESS,
    amount: new BN(0),
    gasPrice: new BN(1000000000),
    gasLimit: Long.fromNumber(25000),
  }
  static REUSABLE_TX_PARAMS = ['version', 'gasPrice', 'gasLimit']


  readonly zilliqa: Zilliqa
  readonly address: Address
  readonly contract: Contract
  readonly owner: Address
  defaultTxParams: Partial<TxParams>

  static namehash(name: Domain): Node {
    if (name.match(/^(0x)?[0-9a-f]+$/i)) {
      return normalizeAddress(name)
    }
    let node = Buffer.alloc(32, 0)

    if (name) {
      let labels = name.split('.')

      for (let i = labels.length - 1; i >= 0; i--) {
        node = sha256(Buffer.concat([node, sha256(labels[i])]))
      }
    }

    return normalizeAddress(node.toString('hex'))
  }
  static async deployRegistry(
    zilliqa: Zilliqa,
    contractParams: {owner: Address, root: Node} =
      {owner: defaultWalletAddress(zilliqa), root: Zns.NULL_NODE},
    txParams: Partial<TxParams> = {}
  ): Promise<Zns> {
    if (!contractParams.owner) {
      throw new ZnsError("owner is not specified")
    }
    let contract = zilliqa.contracts.new(
      Zns.contractSourceCode('registry'),
      registryData.init({initialOwner: contractParams.owner, rootNode: contractParams.root}),
    )
    let fullTxParams = {...Zns.DEFAULT_TX_PARAMS, ...txParams} as TxParams
    let [registryTx, registry] = await contract.deploy(fullTxParams)
    ensureTxConfirmed(registryTx, "Failed to deploy the registry")
    return new Zns(zilliqa, registry, _.pick(txParams, ...Zns.REUSABLE_TX_PARAMS))
  }

  static contractSourceCode(name: string): string {
    return fs.readFileSync(__dirname + `/../scilla/${name}.scilla`, 'utf8')
  }

  constructor(zilliqa: Zilliqa, registry: Address | Contract, txParams?: Partial<TxParams>) {
    this.zilliqa = zilliqa
    let [address, contract] = normalizeContractAddress(zilliqa, registry)
    this.address = address
    this.contract = contract
    this.owner = defaultWalletAddress(zilliqa)
    this.defaultTxParams = {...Zns.DEFAULT_TX_PARAMS, ...txParams}
  }

  async deployResolver(domain: Domain, resolution: Resolution = {}, txParams: Partial<TxParams> = {}) {
    let node = Zns.namehash(domain)
    let owner = this.owner

    //TODO
    //if (!isInitResolution(resolution)) {
      //throw new ZnsError("Resolver can not be initialized with non-standard resolution")
    //}
    let addresses = _(DEFAULT_CURRENCIES).map(currency => {
      return [currency.toLowerCase(), _.get(resolution, addressKey(currency)) || '']
    }).fromPairs().value()
    let records = _.mapKeys(addresses, (v, k) => addressKey(k))

    let [tx, contract] = await this.zilliqa.contracts
      .new(
        Zns.contractSourceCode('resolver'),
        resolverData
        .init({owner, registry: this.address, node, ...addresses})
      )
      .deploy({...this.defaultTxParams, ...txParams} as TxParams)
    ensureTxConfirmed(tx, 'Failed to deploy resolver')
    return new Resolver(this, contract, domain, owner, records)
  }
}
