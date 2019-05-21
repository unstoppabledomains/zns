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

#### Transfering to a different owner

When a node is transfered to a different owner via any of the transition, a `onZNSTransfer` event with a `node` address as the paramter is sent to the new owner to process the record in case the new owner is a contract (like a marketplace, auction).


  - All contract  should verify that the event sender is the Registry.
    account.
  - All conracts should verify that they can manage either `node`.

### Admins

Admins are special addresses that have the following rights:

- give out names that are not owned by anyone
- assign the registrar contract address that defines a procedure (most commonly just price) to purchase an unowned domain

