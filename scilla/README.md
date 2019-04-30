# Contracts

## Architecture

### Registry

The registry contract is where all ZNS records are stored. A ZNS record contains it's owners' address and a resolver contracts' address.

ZNS Records are stored as a mapping of `256bit` hashes to `(owner, resolver)` tuples. The hash is a recursive hash of the names similar to the `namehash` function that ENS uses. i.e.
`bob.zil -> sha256(concat(sha256(bob), sha256(concat(sha256(zil), 0x0000000000000000000000000000000000000000000000000000000000000000))))`

ZNS's IAM model is similar to the ERC721 approval, opperator model. There are also global admins. You access the admin interface with these transition

- `setAdmin(address: ByStr20, isApproved: Bool)` - Approve or unapprove an admin address.
- `approve(node: ByStr32)` - Set the one approved address for a `node`.
- `approveFor(address: ByStr20, isApproved: Bool)` - Set and unset a users operator admins.

ZNS

- `assign(parent: ByStr32, label: String, owner: ByStr20)` - Transfer a subnode to a new `owner`.
- `transfer(node: ByStr32, owner: ByStr20)` - Transfer a `node` to a new owner. This is a convenience function equivalent to calling `approve` and `configure` at the same time.
- `configure(node: ByStr32, owner: ByStr20, resolver: ByStr20)` - Configure a node `owner` and `resolver`.

### Auction Registrar

### Simple Registrar

### Default Resolver

Resolver keys are organized in string notation as if they were javascript object accessors. Take a look at the `lodash.get` npm package to

```js
const object = {a: [{b: {c: 3}}]}

_.get(object, 'a[0].b.c')
```
