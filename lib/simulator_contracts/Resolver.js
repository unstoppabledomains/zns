const Contract = require('./Contract')
const path = require('path')

module.exports = class Resolver extends Contract {
  constructor(initializer, {owner}) {
    super({
      ...initializer,
      input: path.join(__dirname, '../../scilla/resolver.scilla'),
      data: [{vname: 'owner', type: 'ByStr20', value: owner}],
    })

    this.registerFunction('set', (key, value) => [
      {vname: 'key', type: 'String', value: key},
      {vname: 'value', type: 'ByStr', value: value},
    ])

    this.registerFunction('unset', key => [
      {vname: 'key', type: 'String', value: key},
    ])
  }
}
