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

## Simple

A fixed price registrar. Send a record to this contract for the right price and
it will assign you a name permanently.

