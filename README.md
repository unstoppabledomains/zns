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

### Running tests

```sh
yarn install
```

```sh
yarn test
```

## Contracts

There are 3 ZNS contract variants.

- Registry – This contract where the ZNS names are stored. The Registry provides
  two functions, managing name ownership (similar to DNS Zone-like management)
  and directing names to their resolver contracts (where name data is stored).
  Registry mechanics are explained in detail in the
  [Registry Reference](./REGISTRY.md).

- Resolvers – In order to keep the size of the main ZNS contract low the actual
  data resolved when you look up a name is stored inside separate contracts
  called **resolvers**. Resolvers just store a map of strings to bytes.
  Resolvers mechanics are explained in detail in the
  [Resolvers Reference](./RESOLVERS.md).

- Registrars – These contracts manage the distribution of ZNS names. ZNS has 2
  of them. An auction registrar, which implements open, ascending price,
  variable length auction. And a simple registrar listing all names for a fixed
  price for after the initial auction period. Registrar mechanics are explained
  in detail in the [Registrar Reference](./REGISTRAR.md).

For more on general contract structure look at the [./SCILLA.md](./SCILLA.md)

## License

ZNS is [MIT licensed](./LICENSE).
