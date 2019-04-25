const {checker} = require('../lib/scilla')

it('should pass registry.scilla', () => {
  checker({input: './scilla/registry.scilla'})
})

it('should pass auction_registrar.scilla', () => {
  checker({input: './scilla/auction_registrar.scilla'})
})

it('should pass simple_registrar.scilla', () => {
  checker({input: './scilla/simple_registrar.scilla'})
})

xit('should pass renewals.scilla', () => {
  checker({input: './scilla/renewals.scilla'})
})

xit('should pass resolver.scilla', () => {
  checker({input: './scilla/resolver.scilla'})
})
