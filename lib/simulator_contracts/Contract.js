module.exports = class Contract {
  constructor({sim, input, code, fromAddr, gasLimit, gasPrice, data}) {
    this.f = {}
    this.sim = sim

    const {TranID} = sim.CreateTransaction({
      toAddr: null,
      amount: 0,
      code,
      input,
      gasLimit,
      gasPrice,
      data,
      fromAddr,
    })

    this.address = sim.GetContractAddressFromTransactionID(TranID)
  }

  GetCode() {
    return this.sim.GetSmartContractCode(this.address)
  }

  GetState() {
    return this.sim.GetSmartContractState(this.address)
  }

  GetInit() {
    return this.sim.GetSmartContractInit(this.address)
  }

  registerFunction(_tag, fn = () => []) {
    this.f[_tag] = ({fromAddr, gasLimit, amount, gasPrice}, ...params) =>
      this.sim.CreateTransaction({
        toAddr: this.address,
        fromAddr,
        gasLimit,
        amount,
        gasPrice,
        data: {
          _tag,
          params: fn(...params),
        },
      })
  }
}
