# ZNS Registry

The registry contract is where all ZNS records are stored. And provides two main
functions, managing name ownership (similar to DNS Zone-like management) and
relaying name lookups to their resolver contracts (where name data is stored).
For more on resolvers look at the [Resolvers Reference](./RESOLVERS.md).

## Contract structure

The name registry is a tree structure with each label (section of a domain)
representing a node.

These names

```
foo.rand.
bar.zil.
baz.zil.
```

Are represented like this inside ZNS

```
     (root)
     /    \
  (rand) (zil)
   /      / \
(foo) (bar) (baz)
```

ZNS Nodes have a few properties:

- Each node is owned by a Zilliqa Address.
- Each node has direct control over it's children ownership.
- Each node is identified by the sha256 (Not Keccack256!) hash of it's hashed
  label concatanated with it's parent id.

  - This was directly inspired by ENS's `namehash` algorithm.

  - `foo.rand.` is `sha256(sha256(root + sha256(rand)) + sha256(foo))`

- Each node is stored inside a map keyed by it's id.
- Each node stores it's owner and resolver addresses.
- The root nodes' id is
  `0x0000000000000000000000000000000000000000000000000000000000000000` and is
  owned by a multi-sig Zilliqa account specified on deploy.

### IAM

ZNS's IAM model is similar to the ERC721 approval, operator model. However, are
also global admins. ZNS provides the following functions for these purposes

- `setAdmin(address: ByStr20, isApproved: Bool)` - Allows the root nodes' owner
  to approve or unapprove an admin.
- `approve(node: ByStr32, address: ByStr20)` - Allows the nodes' owner to
  approve of one address to freely configure a node.
- `approveFor(address: ByStr20, isApproved: Bool)` - Allows the sender account
  to approve or unapprove an address to act on it's behalf.

### Management

All node owners, admins, approved accounts and operators can call each of these
functions.

- `configure(node: ByStr32, owner: ByStr20, resolver: ByStr20)` - Configure an
  existing `node`s' `owner` and `resolver` addresses.
- `transfer(node: ByStr32, owner: ByStr20)` - Transfer an existing `node` to an
  `owner`. This is a convenience function, equivalent to calling
  `approve(node, burnAddress)` and then `configure(node, owner, burnAddress)` at
  the same time.
- `assign(parent: ByStr32, label: String, owner: ByStr20)` - Transfer a subnode
  to an account. This is the only way to create a new node. `assign` uses the
  same mechanics as `transfer`, but checks whether or not the sender has
  permission to modify `parent`.

### Forwarding

Because of the one-way nature of Scilla we have a function that forwards a
node's records and funds to an account.

- `sendZNSRecordTo(address: ByStr20, parent: ByStr32, label: String)` - Forward
  a record to a recipient `address` using the `onZNSRecordReceived` receiver
  function.

- `onZNSRecordReceived(origin: ByStr20, node: ByStr32, parent: ByStr32, label: String, owner: ByStr20, resolver: ByStr20)` -
  The receiver function for `sendZNSRecordTo`. All `onZNSRecordReceived` should
  probably obey a list of behaviors.

  - All transactions should verify that the transaction sender is the Registry.
  - All failed transactions that accepted ZIL should refund the `origin`
    account.
  - All transactions should verify that they can manage either `node` or
    `parent`.
