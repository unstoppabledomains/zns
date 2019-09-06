import Zns from './Zns'

describe("Zns", () => {
  describe(".isInitResolution", () => {
    it("works", () => {
      expect(Zns.isInitResolution({})).toEqual(true)
      expect(Zns.isInitResolution({crypto: {}})).toEqual(true)
      expect(Zns.isInitResolution({crypto: {'BTC': {address: null}}})).toEqual(true)
      expect(Zns.isInitResolution({crypto: {'BTC': {address: '0x1'}}})).toEqual(true)
      expect(Zns.isInitResolution({crypto: {
        'ADA': {address: '0x1'},
        'BTC': {address: '0x1'},
        'EOS': {address: '0x1'},
        'ETH': {address: '0x1'},
        'XLM': {address: '0x1'},
        'XRP': {address: '0x1'},
        'ZIL': {address: '0x1'},
      }})).toEqual(true)

      expect(Zns.isInitResolution({crypto: {'BTC': {address: '0x1'}, 'WTF': {address: '038282'}}})).toEqual(false)
      expect(Zns.isInitResolution({crypto: {'BTC': {}}})).toEqual(false)
      expect(Zns.isInitResolution({brypto: {'BTC': {address: '0x1'}}})).toEqual(false)
    })
  })
})
