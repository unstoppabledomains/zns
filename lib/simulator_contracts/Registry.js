const Contract = require('./Contract')
const path = require('path')

module.exports = class Registry extends Contract {
  constructor(initializer, {initialOwner}) {
    super({
      ...initializer,
      code: undefined,
      input: path.join(__dirname, '../../scilla/registry.scilla'),
      data: [{vname: 'initialOwner', type: 'ByStr20', value: initialOwner}],
    })

    this.registerFunction('approve', (node, address) => [
      {vname: 'node', type: 'ByStr32', value: node},
      {vname: 'address', type: 'ByStr20', value: address},
    ])

    this.registerFunction('setAdmin', (address, isApproved) => [
      {vname: 'address', type: 'ByStr20', value: address},

      {
        vname: 'isApproved',
        type: 'Bool',
        value: {constructor: isApproved, argtypes: [], arguments: []},
      },
    ])

    this.registerFunction('approveFor', (address, isApproved) => [
      {vname: 'address', type: 'ByStr20', value: address},
      {
        vname: 'isApproved',
        type: 'Bool',
        value: {constructor: isApproved, argtypes: [], arguments: []},
      },
    ])

    this.registerFunction('transfer', (node, owner) => [
      {vname: 'node', type: 'ByStr32', value: node},
      {vname: 'owner', type: 'ByStr20', value: owner},
    ])

    this.registerFunction('assign', (parent, label, owner) => [
      {vname: 'parent', type: 'ByStr32', value: parent},
      {vname: 'label', type: 'String', value: label},
      {vname: 'owner', type: 'ByStr20', value: owner},
    ])

    this.registerFunction('bestow', (parent, label, owner) => [
      {vname: 'parent', type: 'ByStr32', value: parent},
      {vname: 'label', type: 'String', value: label},
      {vname: 'owner', type: 'ByStr20', value: owner},
    ])

    this.registerFunction('configure', (node, owner, resolver) => [
      {vname: 'node', type: 'ByStr32', value: node},
      {vname: 'owner', type: 'ByStr20', value: owner},
      {vname: 'resolver', type: 'ByStr20', value: resolver},
    ])

    this.registerFunction('sendZNSRecordTo', (address, parent, label) => [
      {vname: 'address', type: 'ByStr20', value: address},
      {vname: 'parent', type: 'ByStr32', value: parent},
      {vname: 'label', type: 'String', value: label},
    ])
  }
}
