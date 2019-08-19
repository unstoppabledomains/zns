import {Zilliqa} from '@zilliqa-js/zilliqa'

namespace Zns {
  export type Address = string
  export type Node = string
  export type Domain = string
  export interface Resolution {
    crypto: {
      [key: string]: {address: string}
    }
  }
  export interface Record {
    owner: Address
    name: string
    node: Node
    resolver: Address
  }
  export interface Options {
    registry: Zns.Address
    url: string
    privateKey: string
  }
  export type Resolver = any
}
class PermissionError extends Error {

}

class Resolver {
  zilliqa: Zilliqa
  domain: Zns.Domain
  node: Node
  address: Zns.Address
  records: {[key: string]: string}
  resolution: Zns.Resolution

  set(key: string, value: string) {}
  unset(key: string) {}

}

abstract class Zns {
  zilliqa: Zilliqa
  address: Zns.Address

  static NULL_ADDRESS = "0x00000"
  static NULL_NODE = '0x00000'
  static Resolver = Resolver

  static async deployRegistry(zilliqa: Zilliqa, owner: Zns.Address, root: Zns.Node = Zns.NULL_NODE): Promise<Zns> {
    return {} as Zns
  }
  static namehash(domain: Zns.Domain): Zns.Node {
    return "0x3827324"
  }
  constructor(zilliqa: Zilliqa, address: Zns.Address) {
    this.zilliqa = zilliqa
    this.address = address
  }

  abstract getRecord(domain: Zns.Domain): Promise<Zns.Record>
  abstract setOwner(domain: Zns.Domain, address: Zns.Address): Promise<Zns.Record>
  abstract getOwner(domain: Zns.Domain): Promise<Zns.Address>
  abstract transfer(domain, address: Zns.Address): Promise<Zns.Record>

  abstract getResolverAddress(domain: Zns.Domain): Promise<Zns.Address>
  abstract getResolver(domain: Zns.Domain): Promise<Zns.Resolver>
  abstract getResolution(domain: Zns.Domain): Promise<Zns.Resolution>
  abstract setResolver(domain: Zns.Domain, resolver: Zns.Address | Zns.Resolver | Zns.Resolution): Promise<Zns.Record>
  //override existing resolution by deploying a new resolver
  abstract setResolution(domain: Zns.Domain, resolution: Zns.Resolution): Promise<Zns.Resolver>
  //update existing resolver by setting new records
  abstract updateResolution(domain: Zns.Domain, key: string, value: string): Promise<Zns.Resolver>

  abstract setApporvedAddress(domain: Zns.Domain, address: Zns.Address): Promise<void>
  // value is true by default, if set to false - removes the operator
  abstract setOperator(domain: Zns.Domain, address: Zns.Address, value: boolean): Promise<boolean>
  abstract addOperator(domain: Zns.Domain, address: Zns.Address): Promise<boolean>
  abstract removeOperator(domain: Zns.Domain, address: Zns.Address): Promise<boolean>
  abstract getOperators(domain: Zns.Domain): Promise<Zns.Address[]>
  abstract register(domain: Zns.Domain): Promise<Zns.Record>

  abstract getRegistrarAddress(): Promise<Zns.Address>
  abstract getAdmins(): Promise<Zns.Address[]>

  admin: {
      setAdmin(address: Zns.Address, value: boolean)
      addAdmin(address: Zns.Address): Promise<boolean>
      removeAdmin(address: Zns.Address): Promise<boolean>

      removeAdmin(address: Zns.Address)
      bestow(domain, owner: Zns.Address, resolver?: Zns.Address)
      bestow(domain, owner: Zns.Address, resolution?: Zns.Resolution)
      setRegistrar(address: Zns.Address)
    }
}
