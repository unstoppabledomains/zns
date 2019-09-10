import * as hashjs from 'hash.js'
import {Transaction, TxParams} from '@zilliqa-js/account'
import {Zilliqa} from '@zilliqa-js/zilliqa'
import {Contract} from '@zilliqa-js/contract'
import {BN, bytes, Long} from '@zilliqa-js/util'
import * as fs from 'fs'
import * as _ from 'lodash'

import {contract_info as registryContractInfo} from '../contract_info/registry.json'
import {contract_info as resolverContractInfo} from '../contract_info/resolver.json'
import {generateMapperFromContractInfo} from './params'

type Address = string
type Domain = string
type Node = string
type Resolution = {[key: string]: NestedResolution}
type NestedResolution = string | null | undefined | {[key: string]: NestedResolution} | {[key: number]: NestedResolution}
type Records = {[key: string]: string}

type TransactionEvent = {_eventname: string, [key: string]: string};

const registryData = generateMapperFromContractInfo(registryContractInfo)
const resolverData = generateMapperFromContractInfo(resolverContractInfo)

function sha256(buffer) {
  return Buffer.from(
    hashjs
      .sha256()
      .update(buffer)
      .digest(),
  )
}

let contractField = async (contract: Contract, name: string, init: boolean = false): Promise<any> => {
  let state = init ? await contract.getInit() : await contract.getState()
  if (!state) {
    return null;
  }
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

let addressKey = (currency: string): string => {
  return `crypto.${currency.toUpperCase()}.address`
}

let ensureTxConfirmed = (tx: Transaction, message?: string): Transaction => {
  if (!tx.isConfirmed()) {
    throw new ZnsTxError(message ||  "Transaction is not confirmed", tx)
  }
  let errorEvent = transactionEvent(tx, "Error")
  if (errorEvent) {
    throw new ZnsTxError(message || "Transaction threw an Error event", tx)
  }
  return tx
}
let ensureTxEvent = (tx: Transaction, name: string, message: string): Transaction => {
  ensureTxConfirmed(tx);
  let event = transactionEvent(tx, name)
  if (!event) {
    throw new ZnsTxError(message, tx);
  }
  return tx;
}
let ensureAnyTxEvent = (tx: Transaction, names: string[], message: string) => {
  for(let name of names) {
    try {
      ensureTxEvent(tx, name, message)
      return
    } catch {}
  }
  ensureTxEvent(tx, names[0], message)
}

const asHash = params => {
  return params.reduce((a, v) => ({...a, [v.vname]: v.value}), {})
}
const transactionEvents = (tx: Transaction): TransactionEvent[] => {
  const events = tx.txParams.receipt.event_logs || []
  // Following the original reverse order of events
  return events.map(event => {
    return {_eventname: event._eventname, ...asHash(event.params)}
  })
}

const transactionEvent = (tx: Transaction, name: string): TransactionEvent | undefined => {

  return transactionEvents(tx).find(e => e._eventname == name);
}

class ZnsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

class ZnsTxError extends ZnsError {
  readonly tx: Transaction
  readonly eventErrorMessage: string | undefined
  constructor(message: string, tx: Transaction) {
    super(message)
    this.tx = tx
    let errorEvent = transactionEvent(this.tx, 'Error');
    this.eventErrorMessage = errorEvent.msg || errorEvent.message;
    if (this.eventErrorMessage) {
      this.message += `: ${this.eventErrorMessage}`
    }
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
    this.records = (await contractField(this.contract, 'records'))
      .reduce((a, v) => ({...a, [v.key]: v.val}), {})
    this.owner = normalizeAddress(await contractField(this.contract, 'owner', true) as Address)
    return this
  }

  async set(key: string, value: string, txParams?: Partial<TxParams>): Promise<Transaction> {
    const tx = await this.contract.call(
      'set',
      resolverData.f.set({key, value}),
      this.fullTxParams(txParams),
    )
    ensureTxConfirmed(tx,  "Resolver record is not set")
    this.records[key] = value
    return tx
  }

  async unset(key: string, txParams?: Partial<TxParams>): Promise<Transaction> {
    const tx = await this.contract.call(
      'unset',
      resolverData.f.unset({key}),
      this.fullTxParams(txParams),
    )
    ensureTxConfirmed(tx,  "Resolver record is not removed")
    delete this.records[key]
    return tx
  }

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

  async isLive(): Promise<boolean> {
    let records = await contractField(this.registry.contract, "records");
    let record = (records || []).find(r => r.key == this.node);
    if (!record) {
      return false;
    }
    return this.address == normalizeAddress(record.val.arguments[1]);
  }

  async isDetached(): Promise<boolean> {
    return !await this.isLive();
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
  readonly defaultTxParams: Partial<TxParams>

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

  static isInitResolution(resolution: Resolution): boolean {
    if (_.isEmpty(resolution)) {
      return true;
    }
    return _.isEqual(_.keys(resolution), ['crypto']) &&
      !_.difference(_.keys(resolution.crypto), DEFAULT_CURRENCIES).length &&
      _.every(_.values(resolution.crypto), v => _.isEqual(_.keys(v), ['address']));
  }

  constructor(zilliqa: Zilliqa, registry: Address | Contract, txParams?: Partial<TxParams>) {
    this.zilliqa = zilliqa
    let [address, contract] = normalizeContractAddress(zilliqa, registry)
    this.address = address
    this.contract = contract
    this.owner = defaultWalletAddress(zilliqa)
    this.defaultTxParams = {...Zns.DEFAULT_TX_PARAMS, ...txParams}
  }

  async deployResolver(domain: Domain, resolution: Resolution = {}, txParams: Partial<TxParams> = {}): Promise<Resolver> {
    let node = Zns.namehash(domain)
    let owner = this.owner

    if (!Zns.isInitResolution(resolution)) {
      throw new ZnsError("Resolver can not be initialized with non-standard resolution")
    }
    let addresses = _(DEFAULT_CURRENCIES).map(currency => {
      return [currency.toLowerCase(), _.get(resolution, addressKey(currency)) || '']
    }).fromPairs().value()
    let records = _.mapKeys(addresses, (v, k) => addressKey(k))

    let [tx, resolver] = await this.zilliqa.contracts
      .new(
        Zns.contractSourceCode('resolver'),
        resolverData
        .init({owner, registry: this.address, node, ...addresses})
      )
      .deploy({...this.defaultTxParams, ...txParams} as TxParams)
    ensureTxConfirmed(tx, 'Failed to deploy resolver')
    return new Resolver(this, resolver, domain, owner, records)
  }

  async bestow(domain: Domain, owner: Address, resolver: Address, txParams: Partial<TxParams> = {}) {

    let tokens = domain.split('.')
    //TODO: ensure domain is a subnode of registry root
    let tx = await this.contract.call(
      'bestow',
      registryData.f.bestow({
        label: tokens[0],
        owner: normalizeAddress(owner),
        resolver: normalizeAddress(resolver),
      }),
      this.fullTxParams(txParams)
    )
    ensureTxEvent(tx, "Configured", 'Failed to bestow a domain')
    return tx;
  }

  async setApprovedAddress(domain: Domain, address: Address, txParams: Partial<TxParams> = {}): Promise<Transaction> {
    let tx =  await this.contract.call(
      'approve',
      registryData.f.approve({
        node: Zns.namehash(domain),
        address: normalizeAddress(address),
      }),
      this.fullTxParams(txParams),
    )
    ensureTxConfirmed(tx, "Approved address is not set")
    return tx;
  }

  private fullTxParams(txParams: Partial<TxParams>): TxParams {
    return {...this.defaultTxParams, ...txParams} as TxParams
  }
}
