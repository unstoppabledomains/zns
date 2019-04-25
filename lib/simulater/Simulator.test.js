const fs = require('fs')
const Simulator = require('./Simulator')

it('should deploy contract correctly', () => {
  const blockchain = new Simulator()

  const address = blockchain.CreateAccount(10 ** 15)

  blockchain.CreateTransaction({
    toAddr: null,
    fromAddr: address,
    code: fs
      .readFileSync(
        '/Users/laptop3/ZilliqaNameService/scilla/tests/contracts/helloWorld.scilla',
      )
      .toString(),

    gasLimit: 10000,
    data: [
      {
        vname: '_creation_block',
        type: 'BNum',
        value: blockchain.state.blockNumber.toString(),
      },
      {
        vname: '_scilla_version',
        type: 'Uint32',
        value: '0',
      },
      {
        vname: '_this_address',
        type: 'ByStr20',
        value: '0xdead1234dead1234dead1234dead1234dead1234',
      },
      {
        vname: 'owner',
        type: 'ByStr20',
        value: address,
      },
    ],
  })

  expect(blockchain.GetSnapShot(true)).toMatchSnapshot()
})

it('should deploy contract correctly', () => {
  const blockchain = new Simulator()

  const address = blockchain.CreateAccount(10 ** 15)

  blockchain.CreateTransaction({
    toAddr: null,
    fromAddr: address,
    code: fs
      .readFileSync(
        '/Users/laptop3/ZilliqaNameService/scilla/tests/contracts/helloWorld.scilla',
      )
      .toString(),

    gasLimit: 10000,
    data: [
      {
        vname: '_creation_block',
        type: 'BNum',
        value: blockchain.state.blockNumber.toString(),
      },
      {
        vname: '_scilla_version',
        type: 'Uint32',
        value: '0',
      },
      {
        vname: '_this_address',
        type: 'ByStr20',
        value: '0xdead1234dead1234dead1234dead1234dead1234',
      },
      {
        vname: 'owner',
        type: 'ByStr20',
        value: address,
      },
    ],
  })

  expect(blockchain.GetSnapShot(true)).toMatchSnapshot()
})
