const fs = require('fs')
const Simulator = require('./Simulator')
const path = require('path')

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
        vname: 'owner',
        type: 'ByStr20',
        value: address,
      },
    ],
  })

  expect(blockchain.GetSnapShot(true)).toMatchSnapshot()
})

it('chain tx', () => {
  const s = new Simulator()

  const fromAddr = s.CreateAccount(10 ** 15)

  const dtx = s.CreateTransaction({
    gasLimit: 10000,
    fromAddr,
    input: path.join(__dirname, '../example_contracts/chain.scilla'),
    data: [
      {
        vname: '_scilla_version',
        type: 'Uint32',
        value: '0',
      },
    ],
  })

  const c = s.state.accounts[s.GetContractAddressFromTransactionID(dtx.TranID)]

  const tx = s.CreateTransaction({
    toAddr: c.address,
    fromAddr,
    gasLimit: 10000,
    data: {
      _tag: 'part1',
      params: [],
    },
  })

  expect(s.GetSnapShot(true)).toMatchSnapshot()
})
