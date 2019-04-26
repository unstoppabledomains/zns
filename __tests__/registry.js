const Simulator = require('../lib/simulater/Simulator')
const fs = require('fs')

class Registry {
  constructor({sim, fromAddr}) {
    this.sim = sim
    const {TranID} = this.sim.CreateTransaction({
      toAddr: null,
      amount: 0,
      input: __dirname + '/../scilla/registry.scilla',
      data: [
        {
          vname: '_creation_block',
          type: 'BNum',
          value: this.sim.state.blockNumber.toString(),
        },
        {
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        },
        {
          vname: '_this_address',
          type: 'ByStr20',
          value: this.sim.randomAddress(),
        },
        {
          vname: 'initial_owner',
          type: 'ByStr20',
          value: fromAddr,
        },
      ],
      gasLimit: 1000000,
      fromAddr,
    })

    this.TranID = TranID
    this.address = sim.GetTransaction(TranID).meta.contractAddress
  }

  GetState() {
    return this.sim.state.accounts[this.address].state
  }

  GetInit() {
    return this.sim.state.accounts[this.address].init
  }

  GetCode() {
    return (
      this.sim.state.accounts[this.address].code ||
      fs.readFileSync(this.sim.state.accounts[this.address].input).toString()
    )
  }

  addAdmin({fromAddr, node, admin}) {
    return this.sim.CreateTransaction({
      toAddr: this.address,
      fromAddr,
      gasLimit: 10000,
      data: {
        _tag: 'addAdmin',
        _amount: '0',
        _sender: fromAddr,
        params: [
          {vname: 'node', type: 'ByStr32', value: node},
          {vname: 'admin', type: 'ByStr20', value: admin},
        ],
      },
    })
  }

  removeAdmin({fromAddr, node, admin}) {
    return this.sim.CreateTransaction({
      toAddr: this.address,
      fromAddr,
      gasLimit: 10000,
      data: {
        _tag: 'removeAdmin',
        _amount: '0',
        _sender: fromAddr,
        params: [
          {vname: 'node', type: 'ByStr32', value: node},
          {vname: 'admin', type: 'ByStr20', value: admin},
        ],
      },
    })
  }

  assign({fromAddr, parent, label, owner}) {
    return this.sim.CreateTransaction({
      toAddr: this.address,
      fromAddr,
      gasLimit: 10000,
      data: {
        _tag: 'assign',
        _amount: '0',
        _sender: fromAddr,
        params: [
          {vname: 'parent', type: 'ByStr32', value: parent},
          {vname: 'label', type: 'String', value: label},
          {vname: 'owner', type: 'String', value: owner},
        ],
      },
    })
  }

  transfer({fromAddr, node, owner}) {
    return this.sim.CreateTransaction({
      toAddr: this.address,
      fromAddr,
      gasLimit: 10000,
      data: {
        _tag: 'transfer',
        _amount: '0',
        _sender: fromAddr,
        params: [
          {vname: 'node', type: 'ByStr32', value: node},
          {vname: 'owner', type: 'ByStr20', value: owner},
        ],
      },
    })
  }

  configure({fromAddr, node, resolver, owner}) {
    return this.sim.CreateTransaction({
      toAddr: this.address,
      fromAddr,
      gasLimit: 10000,
      data: {
        _tag: 'configure',
        _amount: '0',
        _sender: fromAddr,
        params: [
          {vname: 'node', type: 'ByStr32', value: node},
          {vname: 'resolver', type: 'ByStr20', value: resolver},
          {vname: 'owner', type: 'ByStr20', value: owner},
        ],
      },
    })
  }

  sendZNSRecordTo({recipient, parent, label, amount}) {
    return this.sim.CreateTransaction({
      toAddr: this.address,
      fromAddr,
      gasLimit: 10000,
      amount: amount,
      data: {
        _tag: 'sendZNSRecordTo',
        _amount: amount.toString(),
        _sender: fromAddr,
        params: [
          {vname: 'parent', type: 'ByStr32', value: parent},
          {vname: 'label', type: 'String', value: label},
          {vname: 'recipient', type: 'ByStr20', value: recipient},
        ],
      },
    })
  }
}

function makeBaseSim() {
  const sim = new Simulator()
  const address = sim.CreateAccount(10 ** 15) // 100 ZIL
  return {
    sim,
    registry: new Registry({sim, fromAddr: address}),
    address,
  }
}

describe('users', () => {
  it('should be able to configure node', () => {
    const {sim, registry, address} = makeBaseSim()

    const user = sim.CreateAccount(10 ** 15)

    const {TranID} = registry.assign({
      fromAddr: address,
      parent: rootNode,
      label: 'label',
      owner: user,
    })

    const node = sim.state.events[
      sim
        .GetTransaction(TranID)
        .meta.events.find(
          key => sim.state.events[key]._eventname === 'Transfer',
        )
    ].params.find(param => param.vname === 'node').value

    registry.configure({
      fromAddr: user,
      owner: sim.CreateAccount(0),
      node,
      resolver: sim.randomAddress(),
    })

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should be able to transfer node', () => {
    const {sim, registry, address} = makeBaseSim()

    const user = sim.CreateAccount(10 ** 15)

    const {TranID} = registry.assign({
      fromAddr: address,
      parent: rootNode,
      label: 'label',
      owner: user,
    })

    const node = sim.state.events[
      sim
        .GetTransaction(TranID)
        .meta.events.find(
          key => sim.state.events[key]._eventname === 'Transfer',
        )
    ].params.find(param => param.vname === 'node').value

    registry.transfer({
      fromAddr: user,
      owner: sim.CreateAccount(0),
      node,
    })

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  it('should be able to assign subnode', () => {
    const {sim, registry, address} = makeBaseSim()

    const user = sim.CreateAccount(10 ** 15)

    const {TranID} = registry.assign({
      fromAddr: address,
      parent: rootNode,
      label: 'label',
      owner: user,
    })

    const node = sim.state.events[
      sim
        .GetTransaction(TranID)
        .meta.events.find(
          key => sim.state.events[key]._eventname === 'Transfer',
        )
    ].params.find(param => param.vname === 'node').value

    registry.assign({
      fromAddr: user,
      owner: sim.CreateAccount(0),
      parent: node,
      label: 'subnode',
    })

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })
})

const rootNode =
  '0x0000000000000000000000000000000000000000000000000000000000000000'

describe('admin', () => {
  it('should be allowed to freely configure nodes', () => {
    const {sim, registry, address} = makeBaseSim()

    const {TranID} = registry.assign({
      fromAddr: address,
      parent: rootNode,
      label: 'label',
      owner: address,
    })

    const transaction = sim.GetTransaction(TranID)

    const node = sim.state.events[
      transaction.meta.events.find(
        key => sim.state.events[key]._eventname === 'Transfer',
      )
    ].params.find(param => param.vname === 'node').value

    // expect(node).toBe(sha3(rootNode + sha3('label')))

    registry.configure({
      fromAddr: address,
      node,
      owner: address,
      resolver: sim.randomAddress(),
    })

    expect(sim.GetSnapShot(true)).toMatchSnapshot()
  })

  describe('addition', () => {
    it('should succeed if you own the node', () => {
      const {sim, registry, address} = makeBaseSim()

      registry.addAdmin({
        fromAddr: address,
        node: rootNode,
        admin: sim.CreateAccount(0),
      })

      expect(sim.GetSnapShot(true)).toMatchSnapshot()
    })

    it("should fail if you don't own the node", () => {
      const {sim, registry} = makeBaseSim()

      registry.addAdmin({
        fromAddr: sim.CreateAccount(10 ** 15),
        node: rootNode,
        admin: sim.CreateAccount(0),
      })

      expect(sim.GetSnapShot(true)).toMatchSnapshot()
    })

    it('should gracefully fail if it already exists', () => {
      const {sim, registry, address} = makeBaseSim()

      const randomAddress = sim.CreateAccount(0)

      registry.addAdmin({
        fromAddr: address,
        node: rootNode,
        admin: randomAddress,
      })

      registry.addAdmin({
        fromAddr: address,
        node: rootNode,
        admin: randomAddress,
      })

      expect(sim.GetSnapShot(true)).toMatchSnapshot()
    })
  })

  describe('removal', () => {
    it('should remove an admin if you own the node', () => {
      const {sim, registry, address} = makeBaseSim()

      const randomAddress = sim.CreateAccount(0)

      registry.addAdmin({
        fromAddr: address,
        node: rootNode,
        admin: randomAddress,
      })

      registry.removeAdmin({
        fromAddr: address,
        node: rootNode,
        admin: randomAddress,
      })

      expect(sim.GetSnapShot(true)).toMatchSnapshot()
    })

    it("should fail if you don't own the node", () => {
      const {sim, registry, address} = makeBaseSim()

      registry.removeAdmin({
        fromAddr: sim.CreateAccount(10 ** 15),
        node: rootNode,
        admin: address,
      })

      expect(sim.GetSnapShot(true)).toMatchSnapshot()
    })

    it("should gracefully fail an admin if it doesn't exist", () => {
      const {sim, registry, address} = makeBaseSim()

      registry.removeAdmin({
        fromAddr: address,
        node: rootNode,
        admin: sim.CreateAccount(0),
      })

      expect(sim.GetSnapShot(true)).toMatchSnapshot()
    })
  })
})
