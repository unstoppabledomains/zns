import {TxParams} from '@zilliqa-js/account'
import {Zilliqa} from '@zilliqa-js/zilliqa'
import {Contract} from '@zilliqa-js/contract'
import {BN, bytes, Long} from '@zilliqa-js/util'
import * as fs from 'fs'
import * as _ from 'lodash'

import {contract_info as registryContractInfo} from '../contract_info/registry.json'
import {generateMapperFromContractInfo} from './params'

type Address = string
type Node = string

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


  zilliqa: Zilliqa
  address: Address
  version: string
  txParams: Partial<TxParams>
  contract: Contract

  static async deploy(
    zilliqa: Zilliqa,
    owner: Address,
    contractParams: {root: Node, _creation_block: number} = {root: Zns.NULL_NODE, _creation_block: 0},
    txParams: Partial<TxParams> = {}
  ): Promise<Zns> {
    let contract = zilliqa.contracts
    .new(
      fs.readFileSync('./scilla/registry.scilla', 'utf8'),
      registryData.init({initialOwner: owner, rootNode: contractParams.root}).concat({
        vname: '_creation_block',
        type: 'BNum',
        value: contractParams._creation_block.toString(),
      }),
    )
    let fullTxParams = {...Zns.DEFAULT_TX_PARAMS, ...txParams} as TxParams
    let [registryTx, registry] = await contract.deploy(fullTxParams)
    if (registryTx.isConfirmed()) {
      return new Zns(zilliqa, registry, _.pick(txParams))
    } else {
      throw new ZnsError("Failed to deploy the registry")
    }
  }

  constructor(zilliqa: Zilliqa, registry: Address | Contract, txParams: Partial<TxParams>) {
    this.zilliqa = zilliqa
    if (typeof(registry) == "string") {
      this.address = registry
    } else {
      this.contract = registry
      this.address = registry.address
    }
    this.txParams = txParams
  }

  async getRegistryContract(): Promise<Contract> {
    this.contract = this.contract || await this.zilliqa.contracts.at(this.address)
    return this.contract
  }
}
