const Contract = require('./Contract')
const path = require('path')

module.exports = class AuctionRegistrar extends Contract {
  constructor(
    initializer,
    {
      owner,
      registry,
      increment,
      ownedNode,
      scale,
      minimumBid,
      minimumAuctionLength,
      initialAuctionLength,
    },
  ) {
    super({
      ...initializer,
      code: undefined,
      input: path.join(__dirname, '../../scilla/auction_registrar.scilla'),
      data: [
        {vname: 'owner', type: 'ByStr20', value: owner},
        {vname: 'registry', type: 'ByStr20', value: registry},
        {vname: 'increment', type: 'Uint128', value: increment},
        {vname: 'ownedNode', type: 'ByStr32', value: ownedNode},
        {vname: 'scale', type: 'Uint128', value: scale},
        {vname: 'minimumBid', type: 'Uint128', value: minimumBid},
        {
          vname: 'minimumAuctionLength',
          type: 'Uint64',
          value: minimumAuctionLength,
        },
        {
          vname: 'initialAuctionLength',
          type: 'Uint64',
          value: initialAuctionLength,
        },
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

    this.registerFunction('bid', node => [
      {vname: 'node', type: 'ByStr32', value: node},
    ])

    this.registerFunction('close', node => [
      {vname: 'node', type: 'ByStr32', value: node},
    ])

    this.registerFunction('setRunning', newRunning => [
      {
        vname: 'newRunning',
        type: 'Bool',
        value: {constructor: newRunning, argtypes: [], arguments: []},
      },
    ])

    this.registerFunction('withdraw', (address, amount) => [
      {vname: 'address', type: 'ByStr20', value: address},
      {vname: 'amount', type: 'Uint128', value: amount},
    ])
  }
}
