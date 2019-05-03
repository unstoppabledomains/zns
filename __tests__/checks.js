const {checker} = require('../lib/scilla')
const path = require('path')
const fs = require('fs')

for (const input of fs
  .readdirSync(path.join(__dirname, '../scilla'))
  .map(v => path.join(__dirname, '../scilla', v))
  .filter(v => v.endsWith('.scilla'))) {
  it(`should successfully type-check ${path.basename(input)}`, () => {
    checker({input})
  })
}
