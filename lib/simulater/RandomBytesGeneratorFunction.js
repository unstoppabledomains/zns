const crypto = require('crypto')

module.exports = class RandomBytesGeneratorFunction {
  constructor() {
    let i = 0
    return length => {
      i++
      return (
        '0x' +
        crypto
          .pbkdf2Sync('secret', 'salt' + String(i), 1, length, 'sha512')
          .toString('hex')
          .slice(0, length)
      )
    }
  }
}
