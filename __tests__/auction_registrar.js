const Simulator = require('../lib/simulater/Simulator')
const {Registry, AuctionRegistrar} = require('../lib/simulator_contracts')

const rootNode =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

function makeBaseSim() {
  const sim = new Simulator()
  const address = sim.CreateAccount(10 ** 15) // 100 ZIL

  const registry = new Registry(
    {sim, fromAddr: address, gasLimit: 100000},
    {initialOwner: address},
  )

  const registrar = new AuctionRegistrar(
    {sim, fromAddr: address, gasLimit: 100000},
    {
      owner: address,
      registry: registry.address,
      scale: '100',
      increment: '2',
      ownedNode: rootNode,
      minimumBid: '1',
      minimumAuctionLength: '2',
      initialAuctionLength: '3',
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

describe('running', () => {
  it('should properly set running', () => {
    const {sim, registrar, address} = makeBaseSim()
    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')
    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })
})

describe('starting an auction', () => {
  it('should properly start an auction', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
      registrar.address,
      rootNode,
      'label',
    )

    sim.Mine()

    registrar.f.bid(
      {fromAddr: address, gasLimit: 10000, amount: '3'},
      '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
    )

    sim.Mine()
    sim.Mine()
    sim.Mine()

    registrar.f.close(
      {fromAddr: address, gasLimit: 10000, amount: '3'},
      '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to start an auction if not running', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
      registrar.address,
      rootNode,
      'label',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to start an auction if already started', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
      registrar.address,
      rootNode,
      'label',
    )

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
      registrar.address,
      rootNode,
      'label',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to start an auction if not enough funds supplied', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '1'},
      registrar.address,
      rootNode,
      'label',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to start an auction if already owned', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registry.f.assign(
      {fromAddr: address, gasLimit: 10000},
      rootNode,
      'label',
      address,
    )

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '1'},
      registrar.address,
      rootNode,
      'label',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to start an auction if not fed record', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registry.f.assign(
      {fromAddr: address, gasLimit: 10000},
      rootNode,
      'label',
      address,
    )

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registrar.f.onZNSRecordReceived(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
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

describe('bidding on auction', () => {
  it('should properly bid on auction', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
      registrar.address,
      rootNode,
      'label',
    )

    sim.Mine()

    registrar.f.bid(
      {fromAddr: address, gasLimit: 10000, amount: '3'},
      '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to bid on auction if closed', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
      registrar.address,
      rootNode,
      'label',
    )

    sim.Mine()
    sim.Mine()
    sim.Mine()

    registrar.f.bid(
      {fromAddr: address, gasLimit: 10000, amount: '3'},
      '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to bid on auction if bid is not high enough', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
      registrar.address,
      rootNode,
      'label',
    )

    sim.Mine()

    registrar.f.bid(
      {fromAddr: address, gasLimit: 10000, amount: '0'},
      '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })
})

describe('closing an auction', () => {
  it('should properly close auction', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
      registrar.address,
      rootNode,
      'label',
    )

    sim.Mine()

    registrar.f.bid(
      {fromAddr: address, gasLimit: 10000, amount: '3'},
      '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
    )

    sim.Mine()
    sim.Mine()
    sim.Mine()

    registrar.f.close(
      {fromAddr: address, gasLimit: 10000, amount: '3'},
      '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to close auction if not ended', () => {
    const {sim, registrar, registry, address} = makeBaseSim()

    registrar.f.setRunning({fromAddr: address, gasLimit: 10000}, 'True')

    registry.f.sendZNSRecordTo(
      {fromAddr: address, gasLimit: 10000, amount: '2'},
      registrar.address,
      rootNode,
      'label',
    )

    sim.Mine()

    registrar.f.bid(
      {fromAddr: address, gasLimit: 10000, amount: '3'},
      '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
    )

    sim.Mine()
    sim.Mine()

    registrar.f.close(
      {fromAddr: address, gasLimit: 10000, amount: '3'},
      '0x75d7fb79d628a67a623235349c36992c89624fd6ec37ef5e1f3b9ba2bce1052d',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })
})

describe('withdrawing funds', () => {
  it.todo('should properly withdraw funds')
  it.todo('should fail to withdraw funds if not owner')
  it.todo('should fail to withdraw funds if too much is requested')
})
