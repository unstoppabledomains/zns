## Marketplace

- `Marketplace` deployed by untrusted party. NO FIX Structural we need to track
  this inside UD DB
- Buyer may lose funds. FIXED (moved accept down)

## Registry

- Possibility of locked Zillings in the `Registry`
- Owner of the root node / Undocumented deployment process. FIXED burn root to
  0xdead0000... or no initialOwner change to initialAdmin
- Admin should control only domains not subdomains. FIXED bestow only uses
  rootNode which is configurable at the start
- registry.scilla most defined errors are never used. FIXED deleted codes
- Unrestricted charset and length for domains. NO FIX
- Actually delete mapping entry instead of setting it to zero. FIXED delete on
  transfer and assign, and got rid of bestow assign delete.
- Rounding errors - Division before multiplication. FIXED swapped mul/div

## Auction Registrar

- Winning auctions at the starting price. FIX Changed refund tag to be onRefund
- Funds lost if Registrar is changed while auctions are ongoing. FIX Use
  transfer on close
- More Zillings required than the starting price. NOT FIXED
- Unnecessary transition onZNSTransfer. FIXED deleted
- Entries in mappings lengthPricesUSD and customPricesUSD cannot be deleted.
  PARTIALLY FIXED new price of zero deletes entry, NO ZERO PROTECTION

## Simple Registrar

- Event created but not emitted. FIXED emitted e
- Wrong variable used. FIXED use amount

## Recomendations

- [ ] Both Registrar contracts, AuctionRegistrar and SimpleRegistrar could
      benefit from input validation
- [ ] As Scilla is an interpreted language, the source code including comments
      is public. We should strip comments check out kaya
- [x] The code indentation in the transition buy of the Marketplace contract
      should be fixed.
- [x] If transition close of the AuctionRegistrar contract is executed but the
      ending block of the auction has not yet been exceeded, the transaction
      completes silently without emitting a hint why it didn’t close the
      auction.
- [x] delete getIsOwner

### ... rest of stuff
