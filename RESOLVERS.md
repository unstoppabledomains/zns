# Resolvers

## Contract Structure

The storage mechanism for resolvers is a key-value system.

```
field records: Map String ByStr
```

In order to store complex and nested data ZNS supports a very flexible keying
system.

##### Example

Instead of a flat representation of records like DNS.

```
A     127.0.0.1
A     1.2.3.4
AAAA  ::1
BTC   13xb4...
ETH   0x12345...
```

We represent a nested structure of keys and values inside a simple map.

```
dns.A[0]=127.0.0.1
dns.A[1]=1.2.3.4
dns.AAAA[0]=::1
crypto.BTC.address=13xb4...
crypto.ETH.address=0x12345...
```

And on request transform them into this:

```json
{
  "dns": {
    "A": ["127.0.0.1", "1.2.3.4"],
    "AAAA": ["::1"]
  },
  "crypto": {
    "BTC": { address: "13xb4..." },
    "ETH": { address: "0x123..." }
  }
}
```

This enables us to use flexible JSON-Schema/Protobuf/OpenAPI standardizing to
iterate faster.

## Reference

Here is a tentative list of record types.

### `crypto.*`

The `crypto.*` records are for receiving cryptocurrency. The system uses the
standard codes/symbols found on [coinmarketcap](https://coinmarketcap.com).

For a Bitcoin address the key is

```
crypto.BTC.address=1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2
```

The Ethereum address the key is

```
crypto.ETH.address=0x0b8202db02472ecf3d4d0185eb26998889663cf2
```

If a currency requires the use of a custodial address like a Memo, Destination
Tag, or Payment ID i.e. currencies like EOS (EOS), Ripple (XRP), Stellar Lumens
(XLM), Binance Coin (BNB), or Monero (XMR), an extra field can be specified besides `address`.

This means an EOS address is represented as an account name and public key

```
crypto.EOS.address=eosisawesome
crypto.EOS.memo=EOStWeu4m4GFg7MSEYsxJtqTFn5AaNVN2MSEYstWetqTFn5Au4m47
```

A Stellar address can be represented as an account id and memo

```
crypto.XLM.address=G5CHCGSNFHEJMRZOX3Z6YVXM3XGCEZWKCA5VLDNRLN3RPROJMDS674JZ
crypto.XLM.memo=random@email.com*bittrex.com
```

**TODO:** Take a look at the
[full list of crypto keys that we support](./crypto_tickers.csv).

### `ttl`

The `ttl` record behaves like a DNS TTL, instructing clients to cache their
records for a specified number of seconds. If this record does not exist it
defaults to 0.

```
ttl=86400
```

### `tod`

The `tod` record specifies a Unix time where all records become invalid. If not
specified all records are valid forever.

```
tod=1576872110
```

### `img.*`

The `img.*` records link to various images to be used in GUIs.

#### `img.icon(_(height)x(width))`

The `img.icon` record provides a URL to a small image used to identify a user.
Optionally you can supply smaller sizes inside the keys. The plain `img.icon`
record, if provided, is assumed to be the largest image.

```
img.icon_32x32=https://someurl.com/icon-32x32
img.icon_192x192=https://someurl.com/icon-192x192
img.icon=https://someurl.com/icon-512x512
```

### `dns.*`

The `dns.*` records simulate traditional DNS records. All standard records
supported by the RFCs are supported. And all records that can support multiple
entries are arrays. i.e. `A`, `AAAA`.

```
dns.PTR=somdomain.com
dns.A[0]=1.2.3.4
dns.A[1]=5.6.7.8
```

### `allowed_nodes[]`

The `allowed_nodes[]` records specify what ZNS nodes are allowed to resolve to a
name in the client. If left blank all names can point their resolver address
validly to the resolver.

```
allowed_nodes[0]=0xaa66da5bca1d0fc6475c2f88ae7b7591df79abcb92923bac79e41ccc44a89efc
allowed_nodes[1]=0xca74b52c4e518ee0e376a629a4a3d6670c479fff114af9e2ecec1b790107dd12
```

### `app.*`

The `app.*` records are where all ZNS application integrations will go.

### `website.*`

The `website.*` records are used to specify the assets for a website. The
`website.type` is used as a discriminant when specifying how the website is
hosted.

A url based website with `website.type` of `url`

```
website.type=url
website.url=https://google.com
```

An IPFS based website with a `website.type` of `ipfs`

```
website.type=ipfs
website.hash=Qmed66a3479fe37f17ca74b5214af9e2ecc6a6f4e518e0c029a4ec1b790107dd12
```

A Swarm based website with a `website.type` of `swarm`

```
website.type=swarm
website.hash=0x37f17caf4e518e0c029a4ec1b7901e74b5214af9e2ecc6a6d66a3479fe07dd12
```

An DNS based website with a `website.type` of `dns`

```
website.type=dns
dns.A[0]=1.2.3.4
```

## Record Ideas

### `prefix`

The `prefix` record specifies a prefix to be added on to each key.

```
app.twitter.user=Maisie_Williams
app.twitter.verification_signature=0x029a4ec1b7901e74b5214a37f17caf4e518e0cf9e2ecc6a6d66a3479fe07dd12
```

Is equivalent to

```
prefix=app.twitter
user=Maisie_Williams
verification_signature=0x029a4ec1b7901e74b5214a37f17caf4e518e0cf9e2ecc6a6d66a3479fe07dd12
```

If you have an application that you only want to publish certain data you could
make a resolver that hardcodes a prefix for you to only allow certain types of
data to be read off of some subdomain. This is probably most useful inside an
application specific context.

### `invalid.*`

The `invalid.*` records are all invalid. To be used in conjunction with `prefix`
to disable resolver.
