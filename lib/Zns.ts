import {TxParams} from '@zilliqa-js/account'
import {Zilliqa} from '@zilliqa-js/zilliqa'
import {Contract} from '@zilliqa-js/contract'
import {BN, bytes, Long} from '@zilliqa-js/util'
import * as fs from 'fs'
import * as _ from 'lodash'

import {contract_info as registryContractInfo} from '../contract_info/registry.json'
import {generateMapperFromContractInfo} from './params'

type Address = string
type Domain = string
type Node = string
type Resolution = any

const registryData = generateMapperFromContractInfo(registryContractInfo)

class ZnsError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
  }
}

class PermissionError extends ZnsError {

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


  zilliqa: Zilliqa
  address: Address
  version: string
  txParams: Partial<TxParams>
  contract: Contract

  static async deployRegistry(
    zilliqa: Zilliqa,
    contractParams: {owner: Address, root: Node} =
      {owner: zilliqa.wallet.defaultAccount && '0x' + zilliqa.wallet.defaultAccount.address, root: Zns.NULL_NODE},
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
    if (registryTx.isConfirmed()) {
      return new Zns(zilliqa, registry, _.pick(txParams, ...Zns.REUSABLE_TX_PARAMS))
    } else {
      throw new ZnsError("Failed to deploy the registry")
    }
  }

  static deployResolver(domain: Domain, resolution: Resolution) {

  }

  static contractSourceCode(name: string): string {
    return fs.readFileSync(__dirname + `/../scilla/${name}.scilla`, 'utf8')
  }

  constructor(zilliqa: Zilliqa, registry: Address | Contract, txParams: Partial<TxParams>) {
    this.zilliqa = zilliqa
    if (typeof(registry) == "string") {
      this.address = registry
    } else {
      this.contract = registry
      this.address = registry.address
    }
    this.txParams = {...Zns.DEFAULT_TX_PARAMS, ...txParams}
  }

  async getRegistryContract(): Promise<Contract> {
    this.contract = this.contract || await this.zilliqa.contracts.at(this.address)
    return this.contract
  }
}
