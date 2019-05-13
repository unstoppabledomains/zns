const records = require('./small.json')

const {Simulater} = require('../lib/simulater')
const {Registry} = require('../lib/simulator_contracts')

const sim = new Simulater()

const initialAdmin = sim.CreateAccount(10 ** 15)

const registry = new Registry()

const burn = '0x0000000000000000000000000000000000000000'

const rootNode =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const zilNode =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

registry.f.bestow(rootNode, 'zil', burn)

for (const name of Object.keys(records)) {
  const record = records[name]

  if (record.ZIL) {
    registry.f.bestow(rootNode, 'zil', burn)
  }
}
