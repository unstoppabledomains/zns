const runner = require('./runner')
const fs = require('fs')

it('should deploy without state or message', () => {
  expect(
    runner({
      init: [
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: '_this_address',
          type: 'ByStr20',
          value: '0xabfeccdc9012345678901234567890f777567890',
        },
        {
          vname: '_creation_block',
          type: 'BNum',
          value: '1',
        },
        {
          vname: 'owner',
          type: 'ByStr20',
          value: '0xabfeccdc9012345678901234567890f777567890',
        },
      ],
      blockchain: [{vname: 'BLOCKNUMBER', type: 'BNum', value: '100'}],
      gaslimit: 10000,
      libdirs: ['/Users/laptop3/ZilliqaNameService/scilla/src/stdlib'],
      code: fs.readFileSync(
        '/Users/laptop3/ZilliqaNameService/scilla/tests/contracts/helloWorld.scilla',
      ),
    }),
  ).toMatchSnapshot()
})

it('should run function with state and message', () => {
  expect(
    runner({
      init: [
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: '_this_address',
          type: 'ByStr20',
          value: '0xabfeccdc9012345678901234567890f777567890',
        },
        {
          vname: '_creation_block',
          type: 'BNum',
          value: '1',
        },
        {
          vname: 'owner',
          type: 'ByStr20',
          value: '0xabfeccdc9012345678901234567890f777567890',
        },
      ],
      blockchain: [{vname: 'BLOCKNUMBER', type: 'BNum', value: '100'}],
      state: [
        {
          vname: '_balance',
          type: 'Uint128',
          value: '0',
        },
      ],
      message: {
        _tag: 'setHello',
        _amount: '0',
        _sender: '0x1234567890123456789012345678901234567890',
        params: [
          {
            vname: 'msg',
            type: 'String',
            value: 'Hello World',
          },
        ],
      },
      gaslimit: 1000,
      libdirs: ['/Users/laptop3/ZilliqaNameService/scilla/src/stdlib'],
      code: fs.readFileSync(
        '/Users/laptop3/ZilliqaNameService/scilla/tests/contracts/helloWorld.scilla',
      ),
    }),
  ).toMatchSnapshot()
})
