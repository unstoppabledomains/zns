# Concerns

## General

- Unnecessarily bulky `Error` events
- Should `.zil` root be `0x0` or `sha256(0x0 + sha256(zil))`?
- Does the std library increase gas cost on import?
- Phishing?
- No string validation in scilla

## Contracts

### `registry.scilla`

- Gas usage because of unnecessary reads, specificity in the management
  functions.
- IAM all working correctly. NO: see -> `operators[_sender].find(address)`.
- Admins only benevolent assigning.

### `simple_registrar.scilla`

- All `onZNSRecordRecieved` requirements being correct see [here](./REGISTRY.md)

### `auction_registrar.scilla`

- All `onZNSRecordRecieved` requirements being correct see [here](./REGISTRY.md)
- Withdrawing too much too soon.
- All the gt, lt and eq comparisons in `bid` and `close`.
- Storing the label inside the auction.
