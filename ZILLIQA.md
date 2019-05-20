# Zilliqa

## Resources

- [Website](https://zilliqa.com)
- [Github](https://github.com/Zilliqa)
- [API Reference](https://apidocs.zilliqa.com/)
- [Testnet Wallet/Faucet](https://dev-wallet.zilliqa.com/home)
- [Viewblock Explorer](https://viewblock.io/zilliqa)
- [FAQ](https://docs.zilliqa.com/techfaq.pdf)

## Notes

- Zilliqa uses the same Account/Gas model that Ethereum does.

- `kaya` doesn't work with multi-contract calls. So we made the `lib/simulator`.

# Scilla

## Installation

1. `git clone`
2. Follow `INSTALL.md`
3. `make clean; make`
4. Add `scilla/bin` to path

## Resources

- [Website](https://scilla-lang.org)
- [Github](https://github.com/Zilliqa/scilla)
- [Docs](https://scilla.readthedocs.io/en/latest/)

## Notes

- Two binaries `scilla-checker` and `scilla-runner`

  - The binaries read from json files.
  - `scilla-checker` is a typecheker.
  - `scilla-runner` is a state transition function for deploys and `transition`
    calls.
  - `-libdir` should only be the STD Libdir at `scilla/src/stdlib`.
  - There are some great example contracts in `scilla/tests/contracts`.

- Don't use the Savant IDE or the scilla language server, use the binaries.

- No throwing. We use `Error` events instead.

- No event filtering for now. Viewblock has an API though.

- No specific state lookups. The only way to get contract state is getting the
  entire state at once see `GetSmartContractState`.

- No `eth_call` or `eth_estimateGas` equivalent. All transactions submitted are
  final.

- No timestamps. The only unit of time available is Blocknumbers
  `BNum`/`BLOCKNUMBER`.

* Can send **1** `Message` per `transition`. **6** `transition`s per
  transaction.

* Messages are only sent out at the end of a transition and only one message can
  be sent at a time. This means that information flow in Scilla is linear for
  the most part. That means you need to source all the information required at
  the beginning of a transaction.
