# ZNS

The Zilliqa Name Service (ZNS) is a suite of smart contracts to make a naming
system like DNS on the blockchain. ZNS connects the familiar and powerful name
system mechanics to blockchain assets like addresses, websites and application
data, as well as traditional dns records.


## Getting Started

### Requirements

- The [Scilla Toolchain](https://github.com/Zilliqa/scilla). It requires a fair
  amount of space. The
  [build requirements are listed here](https://github.com/Zilliqa/scilla/blob/master/INSTALL.md).
- Nodejs and Yarn are required as well.

### Installing

```sh
yarn install
# Symlink scilla toolchain
ln -s <scilla-toolchain-path> runner
# Ensure scilla toolchain is ready
yarn verify
```

### Testing

```
yarn test
```

For more on development look at the [Testing Guide](./TESTING.md).

## Contracts

For an introduction to Zilliqa and Scilla and some of the design considerations
look at the [Zilliqa Reference](./ZILLIQA.md).

There are 3 ZNS contract variants.

- Registry – This contract where the ZNS names are stored. Registry mechanics
  are explained in detail in the [Registry Reference](./REGISTRY.md).

- Resolvers – In order to keep the size of the main ZNS contract low, the ZNS resolution is stored in separate contracts called
  Resolvers. Resolvers mechanics are explained in detail in the
  [Resolvers Reference](./RESOLVERS.md).

- Registrars – These contracts manage the registration of new ZNS names. ZNS has 2
  of them. An auction registrar, which implements open, ascending price,
  variable length auction. And a simple registrar listing all names for a fixed
  price designed to be put in place after the initial auction period. Registrar
  mechanics are explained in detail in the
  [Registrar Reference](./REGISTRAR.md).

For more thoughts on ZNS look at the [List of Concerns](./CONCERNS.md).

## Example Flow

1. **Pre-order**

   - `new registry(initialOwner)`
   - `registry.setAdmin(...pre_configuration_admins, true)`
   - `registry.bestow(...pre_orders)`
   - `registry.bestow(rootNode, zil, burn)`
   - `registry.transfer(rootNode, burn)`

2. **Auctions**

   - `new auction_registrar(registry, zil, auction_stats)`
   - `registry.setAdmin(auction_registrar, true)`
   - `registry.register(zilNode, myname)`
     - `auction_registrar.register(...) - Starts auction`
     - `registry.bestow(zilNode, myname, auction_registrar, burn)`
   - `auction_registrar.bid(mynameNode)`
   - `auction_registrar.close(mynameNode)`

3. **Fixed price**

   - `new simple_registrar(registry, zil, price)`
   - `registry.setAdmin(simple_registrar, true)`
   - `registry.sendZNSRecordTo(simple_registrar, zilNode, myname)`
     - `simple_registrar.onZNSRecordReceived(...) - Purchases name`
     - `registry.bestow(zilNode, myname, origin, burn)`

4. **CC Purchases**

   - `registry.setAdmin(cc_registration_account, true)`
   - `registry.bestow(zilNode, myname, cc_purchaser, resolver)`

## License

ZNS is [MIT licensed](./LICENSE).
