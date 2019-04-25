describe('running', () => {
  it.todo('should properly set running')
})

describe('starting an auction', () => {
  it.todo('should properly start an auction')
  it.todo('should fail to start an auction if not running')
  it.todo('should fail to start an auction if already started')
  it.todo('should fail to start an auction if not enough funds supplied')
  it.todo('should fail to start an auction if already owned')
  it.todo('should fail to start an auction if not feed record')
})

describe('bidding on auction', () => {
  it.todo('should properly bid on auction')
  it.todo('should fail to bid on auction if closed')
  it.todo('should fail to bid on auction if bid is not high enough')
})

describe('closing an auction', () => {
  it.todo('should properly close auction')
  it.todo('should fail to close auction if not ended')
})

describe('withdrawing funds', () => {
  it.todo('should properly withdraw funds')
  it.todo('should fail to withdraw funds if not owner')
  it.todo('should fail to withdraw funds if too much is requested')
})
