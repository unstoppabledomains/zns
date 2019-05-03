const paths = require('../paths')
const scilla = require('../scilla')
const RandomBytesGeneratorFunction = require('./RandomBytesGeneratorFunction')

const nilAdderss = '0x0000000000000000000000000000000000000000'

module.exports = class Simulator {
  static fromSnapShot(json) {
    const simulation = new Simulation()

    simulation.useSnapShot(json)

    return simulation
  }

  constructor() {
    this.RandomBytes = new RandomBytesGeneratorFunction()
    this.ChainId = 7357
    this.MsgVersion = 0
    this.Version = 30134273
    this.state = {
      currentBlock: [],
      blocks: [],
      transactions: {},
      events: {},
      accounts: {},
      blockNumber: 0,
    }
    this.snapshot = this.GetSnapShot()
  }

  _getBlockchainJSON() {
    return [
      {
        vname: 'BLOCKNUMBER',
        type: 'BNum',
        value: this.state.blockNumber.toString(),
      },
    ]
  }

  _addTransactionToCurrentBlock({
    amount,
    gasLimit,
    gasPrice,
    toAddr,
    fromAddr,
    meta,
    cumulative_gas,
  }) {
    const id = this.RandomBytes(64)

    const transaction = {
      ID: id,
      amount: amount.toString(),
      gasLimit: gasLimit.toString(),
      gasPrice: gasPrice.toString(),
      nonce: (this.state.accounts[fromAddr].transactions.length + 1).toString(),
      receipt: {
        cumulative_gas: cumulative_gas.toString(),
        epoch_num: this.state.currentBlock.length.toString(),
        success: true,
      },
      toAddr,
      fromAddr,
      meta,
      version: this.Version.toString(),
    }

    this.state.currentBlock.push(id)
    this.state.accounts[fromAddr].transactions.push(id)

    this.state.transactions[id] = transaction

    return id
  }

  _transactionPreFlightCheck({amount, gasPrice, gasLimit, fromAddr}) {
    const fromAccount = this.state.accounts[fromAddr]

    if (!fromAccount) {
      throw new Error(
        'Failed to create transaction. Account ' + fromAddr + " doesn't exist",
      )
    } else if (
      fromAccount.balance <
      BigInt(amount) + BigInt(gasPrice) * BigInt(gasLimit)
    ) {
      throw new Error('Failed to create transaction. Not enough balance')
    } else if (BigInt(this.GetMinimumGasPrice()) > BigInt(gasPrice)) {
      throw new Error('Failed to create transaction. Gas price too low')
    } else if (BigInt(1) > BigInt(gasLimit)) {
      throw new Error('Failed to create transaction. Gas limit too low')
    }
  }

  /////////////////////////
  // Blockchain Methods //
  /////////////////////////

  GetNumTransactions() {
    return Object.keys(this.state.transactions).length.toString()
  }

  GetNetworkId() {
    return this.ChainId.toString()
  }

  // Unsupported Methods

  //
  // GetBlockchainInfo
  // GetDsBlock
  // GetLatestDsBlock
  // GetNumDSBlocks
  // GetDSBlockRate
  // DSBlockListing
  // GetTxBlock
  // GetLatestTxBlock
  // GetNumTxBlocks
  // GetTxBlockRate
  // TxBlockListing
  // GetTransactionRate
  // GetCurrentMiniEpoch
  // GetCurrentDSEpoch
  // GetPrevDifficulty
  // GetPrevDSDifficulty

  /////////////////////////
  // Transaction Methods //
  /////////////////////////

  // has been slightly modified
  CreateTransaction({
    toAddr,
    amount = 0,
    gasPrice = this.GetMinimumGasPrice(),
    gasLimit,
    code,
    input,
    data,

    // Different no signatures or the like
    fromAddr,

    // pubKey,
    // Version,
    // nonce,
    // signature,
    // priority,
  }) {
    if (toAddr === nilAdderss || toAddr == null) {
      this._transactionPreFlightCheck({amount, gasPrice, gasLimit, fromAddr})

      const fromAccount = this.state.accounts[fromAddr]

      const init = data || []

      if (!init.find(param => param.vname === '_creation_block')) {
        init.push({
          vname: '_creation_block',
          type: 'BNum',
          value: this.state.blockNumber.toString(),
        })
      }
      if (!init.find(param => param.vname === '_scilla_version')) {
        init.push({
          vname: '_scilla_version',
          type: 'Uint32',
          value: '0',
        })
      }
      if (!init.find(param => param.vname === '_this_address')) {
        init.push({
          vname: '_this_address',
          type: 'ByStr20',
          value: this.RandomBytes(40),
        })
      }

      scilla.checker({
        init,
        code,
        input,
      })

      const output = scilla.runner({
        blockchain: this._getBlockchainJSON(),
        init,
        gaslimit: gasLimit,
        code,
        input,
      })

      fromAccount.balance -=
        BigInt(amount) +
        BigInt(gasPrice) * BigInt(gasLimit) -
        BigInt(output.gas_remaining)

      const address = data.find(param => param.vname === '_this_address').value

      this.state.accounts[address] = {
        balance: BigInt(amount),
        address,
        state: [
          {
            vname: '_balance',
            type: 'Uint128',
            value: BigInt(amount).toString(),
          },
        ],
        init: data,
        code,
        input,
      }

      this.state.accounts[fromAddr].smartContracts.push(address)

      return {
        Info: 'Contract-deployment txn',
        TranID: this._addTransactionToCurrentBlock({
          toAddr: nilAdderss,
          amount,
          gasPrice,
          gasLimit,
          fromAddr,
          cumulative_gas:
            BigInt(gasPrice) * BigInt(gasLimit) - BigInt(output.gas_remaining),
          meta: {
            contractAddress: address,
          },
        }),
      }
    } else if (data) {
      this._transactionPreFlightCheck({amount, gasPrice, gasLimit, fromAddr})

      let events = []

      const snapshot = this.GetSnapShot(true)

      try {
        const sendMsg = ({
          toAddr,
          fromAddr,
          amount,
          gasLimit,
          message,
          callsLeft = 6,
        }) => {
          const fromAccount = this.state.accounts[fromAddr]

          const toAccount = this.state.accounts[toAddr]

          if (!toAccount.code && !toAccount.input) {
            return {gas_remaining: gasLimit}
            throw new Error(
              'Failed to create transaction. Account ' +
                toAccount.address +
                " isn't a contract",
            )
          }

          const output = scilla.runner({
            blockchain: this._getBlockchainJSON(),
            code: toAccount.code,
            input: toAccount.input,
            init: toAccount.init,
            state: toAccount.state,
            message,
            gaslimit: gasLimit,
          })

          if (callsLeft === 0 && output.message) {
            throw new Error("You're limited to 6 calls per function call")
          }

          output.events.forEach(event => {
            const id = this.RandomBytes(64)
            this.state.events[id] = {...event, address: toAccount.address}
            events.push(id)
          })

          toAccount.state = output.states

          fromAccount.balance -=
            BigInt(gasPrice) * BigInt(gasLimit) - BigInt(output.gas_remaining)

          if (output._accepted === 'true') {
            fromAccount.balance -= BigInt(amount)
            toAccount.balance += BigInt(amount)
          }

          if ((toAccount.code || toAccount.input) && output.message) {
            return sendMsg({
              toAddr: output.message._recipient,
              amount: output.message._amount,
              fromAddr: toAddr,
              gasLimit: output.gas_remaining,
              message: {...output.message, _sender: toAccount.address},
              callsLeft: callsLeft - 1,
            })
          } else return output
        }

        const output = sendMsg({
          toAddr,
          amount,
          message: {
            ...data,
            _sender: fromAddr,
            _amount: amount.toString() || '0',
          },
          gasLimit,
          fromAddr,
        })

        return {
          Info: 'Contract-call txn',
          TranID: this._addTransactionToCurrentBlock({
            toAddr,
            amount,
            gasPrice,
            gasLimit,
            fromAddr,
            //0,
            cumulative_gas: (
              BigInt(gasLimit) - BigInt(output.gas_remaining)
            ).toString(),
            meta: {events},
          }),
        }
      } catch (error) {
        this.UseSnapShot(snapshot)
        throw error
      }
    } else {
      this._transactionPreFlightCheck({amount, gasPrice, gasLimit, fromAddr})

      const fromAccount = this.state.accounts[fromAddr]

      if (!this.state.accounts[toAddr]) {
        this.state.accounts[toAddr] = this.createUser({
          balance: amount,
          address: toAddr,
        })
      } else {
        this.FundAccount(toAddr, amount)
      }

      fromAccount.balance -= BigInt(amount) + BigInt(gasPrice)

      return {
        Info: 'Non-contract txn',
        TranID: this._addTransactionToCurrentBlock({
          toAddr,
          amount,
          gasPrice,
          gasLimit,
          fromAddr,
          cumulative_gas: gasPrice,
        }),
      }
    }
  }

  // has been slightly modified
  GetTransaction(id) {
    return this.state.transactions[id]
  }

  GetRecentTransactions(address) {
    return this.state.accounts[address].transactions
  }

  GetMinimumGasPrice() {
    return '100'
  }

  // Unsupported Methods

  // GetTransactionsForTxBlock
  // GetNumTxnsTxEpoch
  // GetNumTxnsDSEpoch

  //////////////////////
  // Contract Methods //
  //////////////////////

  GetSmartContractCode(address) {
    return {code: this.state.accounts[address].code}
  }

  GetSmartContractInit(address) {
    return this.state.accounts[address].init
  }

  GetSmartContractState(address) {
    return this.state.accounts[address].state
  }

  GetSmartContracts(address) {
    return this.state.accounts[address].smartContracts.map(
      smartContractAddress => ({
        address: smartContractAddress,
        state: this.GetSmartContractState(smartContractAddress),
      }),
    )
  }

  GetContractAddressFromTransactionID(id) {
    return this.state.transactions[id].meta.contractAddress
  }

  /////////////////////
  // Account Methods //
  /////////////////////

  GetBalance(address) {
    return {
      balance: this.state.accounts[address].balance.toString(),
      nonce: this.state.accounts[address].transactions.length,
    }
  }

  ////////////////////
  // Custom Methods //
  ////////////////////

  CreateAccount(balance = BigInt(0), address = this.RandomBytes(40)) {
    this.state.accounts[address] = {
      balance: BigInt(balance),
      address,
      smartContracts: [],
      transactions: [],
    }
    return address
  }

  FundAccount(address, amount) {
    this.state.accounts[address].balance += BigInt(amount)
  }

  Mine() {
    this.state.blocks[this.state.blockNumber] = this.state.currentBlock
    this.state.currentBlock = []
    this.state.blockNumber += 1

    this.snapshot = this.GetSnapShot()
  }

  Clear() {
    this.UseSnapShot(this.snapshot)
  }

  FastForward(blockNumber) {
    this.Clear()
    if (this.state.blocks.length >= blockNumber) {
      throw new Error('new blocknumber not largeEnough')
    }
    this.state.blockNumber = blockNumber
  }

  GetSnapShot(exact) {
    if (exact) {
      return {...this.state}
    } else {
      return {
        blocks: [...this.state.blocks],
        transactions: {...this.state.transactions},
        events: {...this.state.events},
        accounts: {...this.state.accounts},
      }
    }
  }

  GetTransactionsInBlockByNumber(blockNumber) {
    return {TxnHashes: this.state.blocks[blockNumber] || []}
  }

  UseSnapShot({
    blocks,
    transactions,
    accounts,
    currentBlock = [],
    blockNumber = blocks.length,
  }) {
    this.state = {
      currentBlock,
      blocks,
      transactions,
      accounts,
      blockNumber,
    }
  }

  DeployContract({input, code, fromAddr, gasLimit, gasPrice}) {
    return new Contract()
  }
}
