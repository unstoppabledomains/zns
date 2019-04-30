const rootNode =
  '0x0000000000000000000000000000000000000000000000000000000000000000'
const nullAddress = '0x0000000000000000000000000000000000000000'

const hash = () =>
  '0x' +
  new Array(64).fill().map(() => Math.floor(Math.random() * 16).toString(16))

class Registry {
  admins = {[rootNode]: []}
  records = {}

  _isOwner(node, _sender) {
    return (records[node] || {}).owner === _sender
  }

  _isRootAdmin(_sender) {
    return this.admins[rootNode].includes(_sender)
  }

  _isAdmin(node, _sender) {
    return this.admins[node].includes(_sender)
  }

  _isOkSender(node, _sender) {
    return (
      this._isOwner(node, _sender) ||
      this._isRootAdmin(_sender) ||
      this._isAdmin(node, _sender)
    )
  }

  addAdmin(node, address, _sender) {
    if (this._isOwner(node, _sender))
      this.admins[node] = (this.admins[node] || []).concat(address)
  }

  removeAdmin(node, address, _sender) {
    if (this._isOwner(node, _sender))
      this.admins[node] = (this.admins[node] || []).filter(a => a !== address)
  }

  configure(node, owner, resolver, _sender) {
    if (this._isOkSender(node, _sender)) this.records[node] = {owner, resolver}
  }

  transfer(node, owner, _sender) {
    if (this._isOkSender(node, _sender)) {
      this.records[node] = {owner, resolver: nullAddress}
      this.admins[node] = []
    }
  }

  assign(parent, label, owner, _sender) {
    if (this._isOkSender(parent, _sender)) {
      const node = hash(parent, label)
      this.records[node] = {owner, resolver: nullAddress}
      this.admins[node] = []
    }
  }

  sendZNSRecordTo(parent, label, address, _sender) {
    const node = hash(parent, label)

    return this.records[node]
  }
}
