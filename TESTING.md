# Testing

Testing utilities for Scilla are inside the `lib` directory

### `lib/scilla/`

This folder contains the nodejs bindings for the scilla binaries. Make sure that
`lib/paths.js` is properly configured.

### `lib/simulator/`

This folder contains a virtual blockchain similar to Ganache for Ethereum. The
program is synchronous by design. There is no error-handling at all, but all
successful code works.

It closely mimics the Zilliqa API except in a few.

- There are no cryptographic functions whatsoever. Instead it uses a
  pseudorandom number generator for all hashs/accounts/ids.
- `CreateTransaction` uses a `fromAddr` instead of a `pubkey`/`signature` combo.
- There are extra methods.

  - `CreateAccount` - Initializes new account with a specified balance
  - `FundAccount` - Adds balance to account
  - `Mine` - Mines current block
  - `Clear` - Clears current block / transaction pool
  - `FastForward` - Calls Clear and jumps ahead to a block
  - `GetSnapShot` - Generates a snapshot of the current state
  - `UseSnapShot` - Restores the state of the simulation with a snapshot
  - `GetTransactionsInBlockByNumber` - Gets a list of Transaction hashes inside
    a block

- There are missing methods.

  - `GetBlockchainInfo`
  - `GetDsBlock`
  - `GetLatestDsBlock`
  - `GetNumDSBlocks`
  - `GetDSBlockRate`
  - `DSBlockListing`
  - `GetTxBlock`
  - `GetLatestTxBlock`
  - `GetNumTxBlocks`
  - `GetTxBlockRate`
  - `TxBlockListing`
  - `GetTransactionRate`
  - `GetCurrentMiniEpoch`
  - `GetCurrentDSEpoch`
  - `GetPrevDifficulty`
  - `GetPrevDSDifficulty`
  - `GetTransactionsForTxBlock`
  - `GetNumTxnsTxEpoch`
  - `GetNumTxnsDSEpoch`

### `lib/simulator_contracts/`

These are some shallow wrappers around the ZNS contracts. They all extend the
`lib/simulator_contracts/Contract.js` class.

### `__tests__/`

Here is where all the tests are. We use `jest` on it's default settings.

We rely on [snapshot testing](https://jestjs.io/docs/en/snapshot-testing)
heavily.
