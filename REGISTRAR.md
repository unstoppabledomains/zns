# Registrar

The registrars give out the names.

## Auction

A open auction registrar. Send a record to this contract for the right price and
it will assign you a name permanently.

The auction has a few characteristics.

- Open or Public, everyone can see all the names at auction.
- Ascending Price, the minimum bid is incremented by a pre-set fraction of the
  price. Calculated via
  `bidIncrementNumerator + bidIncrementDenominator / bidIncrementDenominator`
- Variable Length, the auction has an initial length and a minimum length it
  needs to be after a every bid.
  - For example the auction could initially be 1 week long with a minimum length
    of 1h. People would bid on the name durning the week, but if a bid were to
    be submitted less than 1h before the end of the auction the auction length
    would be extended til 1h after the time of submission.
- Needs to be started and closed.

### Structure

- `onZNSRecordReceived(origin: ByStr20, node: ByStr32, parent: ByStr32, label: String, owner: ByStr20, resolver: ByStr20)` -
  This receiver starts an auction on the name. This function requires a minimum
  bid.

- `bid(node: ByStr32)` - If the bidder has a valid bid (amount, node etc.) the
  function will ensure that the auction is of a certain length, save the new
  auction state, and refund the old bidder. If invalid no ZIL will be accepted.

- `close(node: ByStr32)` - If past the ending block any account can call this
  function to close an auction and `assign` the name to the winning bidder.

- `setRunning(newRunning: Bool, )` - Allows `owner` to start and stop the
  ability to start auctions.

- `withdraw(address: ByStr20, amount: Uint128)` - Allows `owner` to withdraw an
  `amount` of funds to specified `address`.

## Simple

A fixed price registrar. Send a record to this contract for the right price and
it will assign you a name permanently.

### Structure

- `onZNSRecordReceived(origin: ByStr20, node: ByStr32, parent: ByStr32, label: String, owner: ByStr20, resolver: ByStr20)` -
  If paid the correct price for a `label` that isn't owned, the contract will
  `assign` that name to you.

- `withdraw(address: ByStr20, amount: Uint128)` - Allows `owner` to withdraw an
  `amount` of funds to specified `address`.
