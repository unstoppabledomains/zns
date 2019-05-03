const Contract = require('./Contract')
const path = require('path')

module.exports = class AuctionRegistrar extends Contract {
  constructor(
    initializer,
    {
      owner,
      registry,
      ownedNode,
      bidIncrementNumerator,
      bidIncrementDenominator,
      minimumAuctionLength,
      initialAuctionLength,
      initialMinimumBid,
    },
  ) {
    super({
      ...initializer,
      code: undefined,
      input: path.join(__dirname, '../../scilla/auction_registrar.scilla'),
      data: [
        {vname: 'owner', type: 'ByStr20', value: owner},
        {vname: 'registry', type: 'ByStr20', value: registry},
        {vname: 'ownedNode', type: 'ByStr32', value: ownedNode},
        {
          vname: 'bidIncrementNumerator',
          type: 'Uint128',
          value: bidIncrementNumerator,
        },
        {
          vname: 'bidIncrementDenominator',
          type: 'Uint128',
          value: bidIncrementDenominator,
        },
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
        {vname: 'initialMinimumBid', type: 'Uint128', value: initialMinimumBid},
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
