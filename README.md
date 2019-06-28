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

ZNS uses Kaya - an official Zilliqa node simulation library.
However, mainstream version of Kaya has bugs that are fixed in [our fork](https://github.com/unstoppabledomains/kaya)

Zilliqa RPC calls are made using [Zilliqa-JavaScript-Library](https://github.com/Zilliqa/Zilliqa-JavaScript-Library) by configuring it with Kaya provider instead of default HTTP provider 
This ensures the Zilliqa node simulator and the test suite exist in the same process.

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

## License


