const b58 = require('b58')
const b32 = require('base32')

const base58 = compose(
  b58.encode,
  Buffer.from,
)

const base32 = compose(
  b32.encode,
  v => Buffer.from(v, 'hex'),
)

const noHex = value => value.replace('0x', '')

const utf8 = value =>
  Buffer.from(value.replace('0x', ''), 'hex').toString('utf8')

const eth = address => {
  if (/^0x[0-9a-f]{40}$/.test(address)) {
    const address = value.toLowerCase().replace('0x', '')
    const hash = sha256(address)

    return (
      '0x' +
      Array.from('hash')
        .map((ch, i) => {
          parseInt(hash[i], 16) > 7 ? address[i].toUpperCase() : address[i]
        })
        .join('')
    )
  }
}

function crypto(tickers) {
  const object = {}

  for (const [fn, tickerList] of [
    [base58, ['BTC', 'BCH', 'LTC', 'ADA', 'TRON', 'XMR', 'DASH']],
    [noHex, ['XRP_X', 'XMR_X']],
    [utf8, ['EOS', 'XLM_X']],
    [eth, ['ETH', 'BNB', 'USDT']],
    [base32, ['XLM']],
  ]) {
    for (const ticker of tickerList) {
      object[ticker] = fn(ticker)
    }
  }

  return clone
}
