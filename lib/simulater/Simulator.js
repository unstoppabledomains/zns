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
    this.randomBytes = new RandomBytesGeneratorFunction()
    this.chainId = 7357
    this.msgVersion = 0
    this.version = 30134273
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

  randomAddress() {
    return this.randomBytes(40)
  }

  createUser({balance = BigInt(0), address = this.randomAddress()}) {
    return {
      balance: BigInt(balance),
      address,
      smartContracts: [],
      transactions: [],
    }
  }

  createContract({
    code,
    input,
    init,
    balance = BigInt(0),
    address = this.randomAddress(),
  }) {
    return {
      balance: BigInt(balance),
      address,
      transactions: [],
      state: [
        {
          vname: '_balance',
          type: 'Uint128',
          value: BigInt(balance).toString(),
        },
      ],
      init,
      code,
      input,
    }
  }

  getBlockchainJSON() {
    return [
      {
        vname: 'BLOCKNUMBER',
        type: 'BNum',
        value: this.state.blockNumber.toString(),
      },
    ]
  }

  addTransactionToCurrentBlock({
    amount,
    gasLimit,
    gasPrice,
    toAddr,
    fromAddr,
    meta,
    cumulative_gas,
  }) {
    const id = this.randomBytes(64)

    const transaction = {
      ID: id,
      amount: amount.toString(),
      gasLimit: gasLimit.toString(),
      gasPrice: gasPrice.toString(),
      nonce: (this.state.accounts[fromAddr].nonce + 1).toString(),
      receipt: {
        cumulative_gas: cumulative_gas.toString(),
        epoch_num: this.state.currentBlock.length.toString(),
        success: true,
      },
      toAddr,
      fromAddr,
      meta,
      version: this.version.toString(),
    }

    this.state.currentBlock.push(id)
    this.state.transactions[id] = transaction

    return id
  }

  transactionPreFlightCheck({amount, gasPrice, gasLimit, fromAddr}) {
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

  deploy({amount, gasPrice, gasLimit, code, input, data, fromAddr}) {
    this.transactionPreFlightCheck({amount, gasPrice, gasLimit, fromAddr})

    const fromAccount = this.state.accounts[fromAddr]

    scilla.checker({
      init: data,
      code,
      input,
    })

    const output = scilla.runner({
      blockchain: this.getBlockchainJSON(),
      init: data,
      gaslimit: gasLimit,
      code,
      input,
    })

    fromAccount.balance -=
      BigInt(amount) +
      BigInt(gasPrice) * BigInt(gasLimit) -
      BigInt(output.gas_remaining)

    const contract = this.createContract({
      address: data.find(param => param.vname === '_this_address').value,
      code,
      input,
      init: data,
      balance: amount,
    })

    this.state.accounts[contract.address] = contract

    return {
      Info: 'Contract-deployment txn',
      TranID: this.addTransactionToCurrentBlock({
        toAddr: nilAdderss,
        amount,
        gasPrice,
        gasLimit,
        fromAddr,
        cumulative_gas:
          BigInt(gasPrice) * BigInt(gasLimit) - BigInt(output.gas_remaining),
        meta: {
          contractAddress: contract.address,
        },
      }),
    }
  }

  call({toAddr, amount, gasPrice, gasLimit, data, fromAddr}) {
    this.transactionPreFlightCheck({amount, gasPrice, gasLimit, fromAddr})

    let events = []

    const snapshot = this.GetSnapShot(true)

    try {
      const sendMsg = ({toAddr, fromAddr, amount, gasLimit, message}) => {
        const fromAccount = this.state.accounts[fromAddr]

        const toAccount = this.state.accounts[toAddr]

        if (!toAccount.code && !toAccount.input) {
          throw new Error(
            'Failed to create transaction. Account ' +
              toAccount.address +
              " isn't a contract",
          )
        }

        const output = scilla.runner({
          blockchain: this.getBlockchainJSON(),
          code: toAccount.code,
          input: toAccount.input,
          init: toAccount.init,
          state: toAccount.state,
          message,
          gaslimit: gasLimit,
        })

        output.events.forEach(event => {
          const id = this.randomBytes(64)
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

        if (toAccount.code && output.message) {
          sendMsg({
            toAddr: output.message._recipient,
            amount: output.message._amount,
            fromAddr: toAddr,
            gasLimit: output.gas_remaining,
            message: output.message,
          })
        }
      }

      sendMsg({toAddr, amount, message: data, gasLimit, fromAddr})
    } catch (error) {
      this.UseSnapShot(snapshot)
      throw error
    }

    return {
      Info: 'Contract-call txn',
      TranID: this.addTransactionToCurrentBlock({
        toAddr,
        amount,
        gasPrice,
        gasLimit,
        fromAddr,
        cumulative_gas: 0,
        // BigInt(gasPrice) * BigInt(gasLimit) - BigInt(output.gas_remaining),
        meta: {events},
      }),
    }
  }

  transfer({toAddr, amount, gasPrice, gasLimit, fromAddr}) {
    this.transactionPreFlightCheck({amount, gasPrice, gasLimit, fromAddr})

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
      TranID: this.addTransactionToCurrentBlock({
        toAddr,
        amount,
        gasPrice,
        gasLimit,
        fromAddr,
        cumulative_gas: gasPrice,
      }),
    }
  }

  /////////////////////////
  // Blockchain Methods //
  /////////////////////////

  GetNumTransactions() {
    return Object.keys(this.state.transactions).length.toString()
  }

  GetNetworkId() {
    return this.chainId.toString()
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
    // version,
    // nonce,
    // signature,
    // priority,
  }) {
    if (toAddr === nilAdderss || toAddr == null) {
      return this.deploy({
        amount,
        gasPrice,
        gasLimit,
        code,
        input,
        data,
        fromAddr,
      })
    } else if (data) {
      return this.call({
        toAddr,
        amount,
        gasPrice,
        gasLimit,
        data,
        fromAddr,
      })
    } else {
      return this.transfer({
        toAddr,
        amount,
        gasPrice,
        gasLimit,
        fromAddr,
      })
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
    return this.state.transactions[id].contractAddress
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

  CreateAccount(balance) {
    const user = this.createUser({balance})
    this.state.accounts[user.address] = user
    return user.address
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
    if (this.state.blocks.length >= blockNumber) {
      throw new Error('new blocknumber not largeEnough')
    }
    this.state.blockNumber = blockNumber
  }

  FundAccount(address, amount) {
    this.state.accounts[address].balance += BigInt(amount)
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
}
