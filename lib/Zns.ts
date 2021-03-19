import * as hashjs from 'hash.js'
import {Transaction, TxParams} from '@zilliqa-js/account'
import {Zilliqa} from '@zilliqa-js/zilliqa'
import {Contract} from '@zilliqa-js/contract'
import {toChecksumAddress} from '@zilliqa-js/crypto'
import {BN, bytes, Long} from '@zilliqa-js/util'
import * as fs from 'fs'
import _ from 'lodash'

import {contract_info as registryContractInfo} from '../contract_info/registry.json'
import {contract_info as resolverContractInfo} from '../contract_info/resolver.json'
import {generateMapperFromContractInfo} from './params'
import {getAddressFromPrivateKey} from '@zilliqa-js/crypto'

type Address = string
type Domain = string
type Node = string
type Resolution = {[key: string]: NestedResolution}
type NestedResolution =
  | string
  | null
  | undefined
  | {[key: string]: NestedResolution}
  | {[key: number]: NestedResolution}
type Records = {[key: string]: string}

type TransactionEvent = {_eventname: string; [key: string]: string}

const registryData = generateMapperFromContractInfo(registryContractInfo)
const resolverData = generateMapperFromContractInfo(resolverContractInfo)

function sha256(buffer) {
  return Buffer.from(hashjs.sha256().update(buffer).digest())
}

let contractField = async (
  contract: Contract,
  name: string,
  init: boolean = false,
): Promise<any> => {
  let state = init ? await contract.getInit() : await contract.getState()
  if (!state) {
    return null
  }
  const value = state[name]
  if (!value) {
    throw new Error(`Unknown contract field ${name}`)
  }
  return value
}

let contractMapField = async (
  contract: Contract,
  name: string,
): Promise<{[key: string]: any}> => {
  let value = (await contractField(contract, name)) as {key: string; val: any}[]
  if (!value) {
    return {}
  }

  if (Array.isArray(value)) {
    return value.reduce((a, v) => ({...a, [v.key]: v.val}), {})
  }

  return value
}
let isDefaultResolution = (resolution: Resolution) => {}

let normalizeAddress = (address: Address) => {
  if (!address) {
    return null
  }
  address = address.toLowerCase()
  if (!address.startsWith('0x')) {
    address = '0x' + address
  }
  return address
}

let tokenize = (domain: Domain): [Node, string] => {
  let tokens = domain.split('.')
  let label = tokens.shift()
  let parent = tokens.length ? Zns.namehash(tokens.join('.')) : Zns.NullNode
  return [parent, label]
}

let normalizeContractAddress = (
  zilliqa: Zilliqa,
  argument: Address | Contract,
): [Address, Contract] => {
  if (typeof argument == 'string') {
    let address = normalizeAddress(argument)
    return [address, getContract(zilliqa, address)]
  } else {
    return [normalizeAddress(argument.address), argument]
  }
}

let defaultWalletAddress = (zilliqa: Zilliqa): Address => {
  return (
    zilliqa.wallet.defaultAccount &&
    normalizeAddress(zilliqa.wallet.defaultAccount.address)
  )
}

let getContract = (zilliqa: Zilliqa, address: Address): Contract => {
  return zilliqa.contracts.at(toChecksumAddress(normalizeAddress(address)))
}

let addressKey = (currency: string): string => {
  return `crypto.${currency.toUpperCase()}.address`
}

let ensureTxConfirmed = (tx: Transaction, message?: string): Transaction => {
  if (!tx.isConfirmed()) {
    throw new ZnsTxError(message || 'Transaction is not confirmed', tx)
  }
  let errorEvent = transactionEvent(tx, 'Error')
  if (errorEvent) {
    console.log('EVENT', errorEvent)
    throw new ZnsTxError(message || 'Transaction threw an Error event', tx)
  }
  return tx
}

let ensureTxEvent = (
  tx: Transaction,
  name: string,
  message: string,
): Transaction => {
  ensureTxConfirmed(tx)
  let event = transactionEvent(tx, name)
  if (!event) {
    throw new ZnsTxError(message, tx)
  }
  return tx
}

let ensureAnyTxEvent = (tx: Transaction, names: string[], message: string) => {
  for (let name of names) {
    try {
      ensureTxEvent(tx, name, message)
      return
    } catch {}
  }
  ensureTxEvent(tx, names[0], message)
}

const resolutionToKeyValue = (
  data: Record<string, any>,
  prefix?: string,
): Record<string, string> => {
  let result = {}
  for (const key in data) {
    const value = data[key]
    const namespace = prefix ? `${prefix}.${key}` : key
    if (_.isObject(value)) {
      result = {...result, ...resolutionToKeyValue(value, namespace)}
    } else {
      result[namespace] = value.toString()
    }
  }
  return result
}

const asHash = (params) => {
  return params.reduce((a, v) => ({...a, [v.vname]: v.value}), {})
}

const transactionEvents = (tx: Transaction): TransactionEvent[] => {
  const events = tx.txParams.receipt ? tx.txParams.receipt.event_logs || [] : []
  // Following the original reverse order of events
  return events.map((event) => {
    return {_eventname: event._eventname, ...asHash(event.params)}
  })
}

const transactionEvent = (
  tx: Transaction,
  name: string,
): TransactionEvent | undefined => {
  return transactionEvents(tx).find((e) => e._eventname == name)
}

const isNode = (node: string): boolean => {
  return !!node.match(/0x[0-9a-f]{40}/)
}

class ZnsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

class ZnsTxError extends ZnsError {
  readonly tx: Transaction
  readonly eventErrorMessage?: string
  readonly transition?: string
  constructor(message: string, tx: Transaction) {
    super(message)
    this.tx = tx
    let errorEvent = transactionEvent(this.tx, 'Error')
    const {receipt} = this.tx.txParams
    const errorCodes = Object.values(receipt?.errors || {})
    if (errorCodes.length) {
      this.message += `code: ${errorCodes.join(',')}`
    }

    if (errorEvent) {
      this.eventErrorMessage = errorEvent.msg || errorEvent.message
    }
    this.transition = JSON.parse(this.tx.txParams.data)._tag
    if (this.transition) {
      this.message += ` on transition ${JSON.stringify(this.transition)}`
    }
    if (this.eventErrorMessage) {
      this.message += `: ${this.eventErrorMessage}`
    }
  }
}

let DefaultCurrencies = ['ADA', 'BTC', 'EOS', 'ETH', 'XLM', 'XRP', 'ZIL']
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
    records: Records,
  ) {
    this.domain = domain
    let [address, contract] = normalizeContractAddress(
      registry.zilliqa,
      resolver,
    )
    this.address = address
    this.contract = contract
    this.owner = owner
    this.registry = registry
    this.records = records
  }

  async reload(): Promise<this> {
    this.contract = getContract(this.registry.zilliqa, this.address)
    this.records = await contractMapField(this.contract, 'records')
    this.owner = normalizeAddress(
      (await contractField(this.contract, 'owner', false)) as Address,
    )
    return this
  }

  async set(
    key: string,
    value: string,
    txParams?: Partial<TxParams>,
  ): Promise<Transaction> {
    let tx = await this.callTransition('set', {key, value})
    this.records[key] = value
    return tx
  }

  async unset(key: string, txParams?: Partial<TxParams>): Promise<Transaction> {
    const tx = await this.callTransition('unset', {key})
    delete this.records[key]
    return tx
  }

  get resolution(): Resolution {
    return _.reduce(
      this.records,
      (result, value, key) => _.set(result, key, value),
      {},
    )
  }

  get node(): Node {
    return Zns.namehash(this.domain)
  }

  getRecordsSetEvent() {
    return {
      _eventname: 'RecordsSet',
      node: this.node,
      registry: this.registry.address,
    }
  }

  get configuredEvent() {
    return {
      _eventname: 'Configured',
      node: this.node,
      owner: this.owner,
      resolver: this.address,
    }
  }

  async isLive(): Promise<boolean> {
    const records = await contractField(this.registry.contract, 'records')
    if (!records) {
      return false
    }

    const record = records[this.node] || records.find((r) => r.key == this.node)
    const recordArguments = record.val || record

    return (
      recordArguments &&
      this.address == normalizeAddress(recordArguments.arguments[1])
    )
  }

  async isDetached(): Promise<boolean> {
    return !(await this.isLive())
  }

  private async callTransition(
    name: string,
    args: object,
    txParams: Partial<TxParams> = {},
  ): Promise<Transaction> {
    let tx = await this.contract.call(name, resolverData.f[name](args), {
      ...this.registry.defaultTxParams,
      ...txParams,
    } as TxParams)
    ensureTxConfirmed(tx)
    return tx
  }
}

export default class Zns {
  static NullAddress = '0x' + '0'.repeat(40)
  static NullNode = '0x' + '0'.repeat(64)
  static DefaultChainId = 1
  static DefaultTxParams: Partial<TxParams> = {
    version: bytes.pack(Zns.DefaultChainId, 1),
    toAddr: Zns.NullAddress,
    amount: new BN(0),
    gasPrice: new BN(1000000000),
    gasLimit: Long.fromNumber(25000),
  }
  static ReusableTxParams = ['version', 'gasPrice', 'gasLimit']

  readonly zilliqa: Zilliqa
  readonly address: Address
  readonly contract: Contract
  readonly owner: Address
  readonly defaultTxParams: Partial<TxParams>

  static namehash(name: Domain | Node): Node {
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

    return '0x' + node.toString('hex')
  }

  static async deployRegistry(
    zilliqa: Zilliqa,
    owner: Address = defaultWalletAddress(zilliqa),
    root: Node = Zns.NullNode,
    txParams: Partial<TxParams> = {},
  ): Promise<Zns> {
    if (!owner) {
      throw new ZnsError('owner is not specified')
    }
    let contract = zilliqa.contracts.new(
      Zns.contractSourceCode('registry'),
      registryData.init({initialOwner: owner, rootNode: root}),
    )
    let fullTxParams = {...Zns.DefaultTxParams, ...txParams} as TxParams
    let [registryTx, registry] = await contract.deploy(fullTxParams)
    ensureTxConfirmed(registryTx, 'Failed to deploy the registry')
    return new Zns(zilliqa, registry, _.pick(txParams, ...Zns.ReusableTxParams))
  }

  static contractSourceCode(name: string): string {
    return fs.readFileSync(__dirname + `/../scilla/${name}.scilla`, 'utf8')
  }

  static isInitResolution(resolution: Resolution): boolean {
    if (_.isEmpty(resolution)) {
      return true
    }
    return (
      _.isEqual(_.keys(resolution), ['crypto']) &&
      !_.difference(_.keys(resolution.crypto), DefaultCurrencies).length &&
      _.every(_.values(resolution.crypto), (v) =>
        _.isEqual(_.keys(v), ['address']),
      )
    )
  }

  constructor(
    zilliqa: Zilliqa,
    registry: Address | Contract,
    txParams?: Partial<TxParams>,
  ) {
    this.zilliqa = zilliqa
    let [address, contract] = normalizeContractAddress(zilliqa, registry)
    this.address = address
    this.contract = contract
    this.owner = defaultWalletAddress(zilliqa)
    this.defaultTxParams = {...Zns.DefaultTxParams, ...txParams}
  }

  async deployResolver(
    domain: Domain,
    resolution: Resolution = {},
    txParams: Partial<TxParams> = {},
  ): Promise<Resolver> {
    let node = Zns.namehash(domain)
    let owner = this.owner

    let initialRecords = resolutionToKeyValue(resolution)

    let [tx, resolver] = await this.zilliqa.contracts
      .new(
        Zns.contractSourceCode('resolver'),
        resolverData.init({
          initialOwner: owner,
          registry: this.address,
          node,
          initialRecords,
        }),
      )
      .deploy({...this.defaultTxParams, ...txParams} as TxParams)
    ensureTxConfirmed(tx, 'Failed to deploy resolver')
    return new Resolver(this, resolver, domain, owner, initialRecords)
  }

  async bestow(
    domain: Domain,
    owner: Address,
    resolver: Address = Zns.NullAddress,
    txParams: Partial<TxParams> = {},
  ) {
    let [, label] = tokenize(domain)
    //TODO: ensure domain is a subnode of registry root
    let tx = await this.callTransition('bestow', {
      label,
      owner: normalizeAddress(owner),
      resolver: normalizeAddress(resolver),
    })
    ensureTxEvent(tx, 'Configured', 'Failed to bestow a domain')
    return tx
  }

  async setApprovedAddress(
    domain: Domain | Node,
    address: Address,
    txParams: Partial<TxParams> = {},
  ): Promise<Transaction> {
    let tx = await this.callTransition('approve', {
      node: Zns.namehash(domain),
      address: normalizeAddress(address),
    })
    return tx
  }

  async register(
    domain: Domain,
    amount: BN | number,
    txParams: Partial<TxParams> = {},
  ): Promise<Transaction> {
    if (typeof amount == 'number') {
      amount = new BN(amount)
    }
    let [parent, label] = tokenize(domain)
    let tx = await this.callTransition('register', {parent, label}, {amount})
    ensureTxEvent(tx, 'Configured', 'Transaction did not register a domain')
    return tx
  }

  async setAdmin(address: Address, value: boolean = true) {
    return await this.callTransition('setAdmin', {
      address: normalizeAddress(address),
      isApproved: value,
    })
  }

  async rotateAdmin(newAdminPrivateKey: string) {
    const newAddress = getAddressFromPrivateKey(newAdminPrivateKey)
    const oldAddress = this.zilliqa.wallet.defaultAccount!.address
    const tx1 = await this.setAdmin(newAddress)
    this.zilliqa.wallet.addByPrivateKey(newAdminPrivateKey)
    this.zilliqa.wallet.setDefault(newAddress)
    const tx2 = await this.setAdmin(oldAddress, false)
    return [tx1, tx2]
  }

  async getRegistryRecord(
    domain: Domain | Node,
  ): Promise<[Address, Address] | []> {
    let records = await contractMapField(this.contract, 'records')
    let node = isNode(domain) ? domain : Zns.namehash(domain)
    let record = records[node]
    return record ? record.arguments.map(normalizeAddress) : []
  }

  async getOwnerAddress(domain: Domain | Node): Promise<Address> {
    return (await this.getRegistryRecord(domain))[0]
  }

  async getResolverAddress(domain: Domain | Node): Promise<Address> {
    return (await this.getRegistryRecord(domain))[1]
  }

  async getApprovedAddress(domain: Domain | Node): Promise<Address> {
    let approvals = await contractMapField(this.contract, 'approvals')
    return approvals[Zns.namehash(domain)]
  }

  async getAdminAddresses(): Promise<Address[]> {
    return await contractField(this.contract, 'admins')
  }

  private async callTransition(
    name: string,
    args: object,
    txParams: Partial<TxParams> = {},
  ): Promise<Transaction> {
    const params = {...this.defaultTxParams, ...txParams} as TxParams
    let tx = await this.contract.call(name, registryData.f[name](args), params)
    ensureTxConfirmed(tx)
    return tx
  }
}
