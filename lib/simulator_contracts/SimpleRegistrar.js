const Contract = require('./Contract')
const path = require('path')

module.exports = class SimpleRegistrar extends Contract {
  constructor(initializer, {registry, ownedNode, owner, price}) {
    super({
      ...initializer,
      code: undefined,
      input: path.join(__dirname, '../../scilla/simple_registrar.scilla'),
      data: [
        {vname: 'registry', type: 'ByStr20', value: registry},
        {vname: 'ownedNode', type: 'ByStr32', value: ownedNode},
        {vname: 'owner', type: 'ByStr20', value: owner},
        {vname: 'price', type: 'Uint128', value: price},
      ],
    })

    this.registerFunction(
      'onZNSRecordReceived',
      ({origin, node, parent, label, owner, resolver}) => [
        {vname: 'origin', type: 'ByStr20', value: origin},
        {vname: 'node', type: 'ByStr32', value: node},
        {vname: 'parent', type: 'ByStr32', value: parent},
        {vname: 'label', type: 'String', value: label},
        {vname: 'owner', type: 'ByStr20', value: owner},
        {vname: 'resolver', type: 'ByStr20', value: resolver},
      ],
    )

    this.registerFunction('withdraw', (address, amount) => [
      {vname: 'address', type: 'ByStr20', value: address},
      {vname: 'amount', type: 'Uint128', value: amount},
    ])
  }
}
