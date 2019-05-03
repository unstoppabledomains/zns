const Simulator = require('../lib/simulater/Simulator')
const {Registry, SimpleRegistrar} = require('../lib/simulator_contracts')

const rootNode =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

function makeBaseSim() {
  const sim = new Simulator()
  const address = sim.CreateAccount(10 ** 15) // 100 ZIL

  const registry = new Registry(
    {sim, fromAddr: address, gasLimit: 100000},
    {initialOwner: address},
  )

  const registrar = new SimpleRegistrar(
    {sim, fromAddr: address, gasLimit: 100000},
    {
      owner: address,
      registry: registry.address,
      ownedNode: rootNode,
      initialPrice: '1',
    },
  )

  registry.f.approve(
    {fromAddr: address, gasLimit: 1000},
    rootNode,
    registrar.address,
    // 'True',
  )

  return {
    sim,
    registry,
    registrar,
    address,
  }
}

describe('simple registrar users', () => {
  it('should be able to properly register a name', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '1'},
      registrar.address,
      rootNode,
      'label',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to register a name if not enough balance', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '0'},
      registrar.address,
      rootNode,
      'label',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })
  it('should fail to register a name if already owned', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registry.f.assign(
      {fromAddr: address, gasLimit: 10000},
      rootNode,
      'label',
      address,
    )

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '0'},
      registrar.address,
      rootNode,
      'label',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to register a name if not fed record', () => {
    const {sim, registrar, address} = makeBaseSim()

    registrar.f.onZNSRecordReceived(
      {fromAddr: address, gasLimit: 10000, amount: '1'},
      {
        origin: address,
        node:
          '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
        parent: rootNode,
        label: 'label',
        owner: '0x0000000000000000000000000000000000000000',
        resolver: '0x0000000000000000000000000000000000000000',
      },
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })
})
