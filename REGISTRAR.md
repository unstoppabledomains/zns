# Registrar

The registrars give out the names.

## Auction

A open auction registrar. It can accept bids for domains from the registry to allow people to compete for best domains.

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
- An auction needs to be started from the registry by calling `register` transition
- An auction suppose to close automatically after blockchain reaches a block number of the auction. However, Zilliqa technology doesn't allow to execute transition by time. That is why an auction needs to be manually closed and anyone can do this making it impossible to prevent the auction from being closed.
- All domains on the auction have a minimum price.


## Simple

A fixed price registrar. Send a record to this contract for the right price and
it will assign you a name permanently. The price of the domain is different. Some predefined premium domains have fixed price. Short domains (like less than 6 characters) also have specific prices for each length tier. All other domain have a default price.

