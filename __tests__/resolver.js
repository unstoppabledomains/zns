const Simulator = require('../lib/simulater/Simulator')
const {Resolver} = require('../lib/simulator_contracts')

function makeBaseSim() {
  const sim = new Simulator()
  const address = sim.CreateAccount(10 ** 15) // 100 ZIL
  return {
    sim,
    resolver: new Resolver(
      {sim, fromAddr: address, gasLimit: 10000},
      {owner: address},
    ),
    address,
  }
}

describe('resolver users', () => {
  it('should be able to set values', () => {
    const {sim, resolver, address} = makeBaseSim()

    resolver.f.set({fromAddr: address, gasLimit: 10000}, 'test', '0x7357')

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should be able to unset values', () => {
    const {sim, resolver, address} = makeBaseSim()

    resolver.f.set({fromAddr: address, gasLimit: 10000}, 'test', '0x7357')
    resolver.f.unset({fromAddr: address, gasLimit: 10000}, 'test', '0x7357')

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to set values if not the resolver owner', () => {
    const {sim, resolver, address} = makeBaseSim()

    resolver.f.set(
      {fromAddr: sim.CreateAccount(10 ** 15), gasLimit: 10000},
      'test',
      '0x7357',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to unset values if not the resolver owner', () => {
    const {sim, resolver, address} = makeBaseSim()

    resolver.f.set({fromAddr: address, gasLimit: 10000}, 'test', '0x7357')
    resolver.f.unset(
      {fromAddr: sim.CreateAccount(10 ** 15), gasLimit: 10000},
      'test',
      '0x7357',
    )

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should fail to unset values if no keys exist', () => {
    const {sim, resolver, address} = makeBaseSim()

    resolver.f.unset({fromAddr: address, gasLimit: 10000}, 'test', '0x7357')

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })
})
