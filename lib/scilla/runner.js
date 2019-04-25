const child_process = require('child_process')
const fs = require('fs')
const path = require('path')

const paths = require('../paths')
const scillaTmpDirWrap = require('./scillaTmpDirWrap')

module.exports = function runner({
  init,
  blockchain,
  gaslimit,
  state,
  message,
  libdirs = [paths.stdlibDir],
  code,
  input,
}) {
  return scillaTmpDirWrap(tmpDir => {
    if (!init || !blockchain || !gaslimit) {
      throw new TypeError('init, blockchain and gaslimit are required')
    }

    const outputPath = path.join(tmpDir, 'output.json')

    const args = ['-jsonerrors', '-o', outputPath, '-gaslimit', gaslimit]

    if (input) {
      args.push('-i', input)
    } else {
      const inputPath = path.join(tmpDir, 'contract.scilla')
      fs.writeFileSync(inputPath, code)
      args.push('-i', inputPath)
    }

    const initPath = path.join(tmpDir, 'init.json')
    const blockchainPath = path.join(tmpDir, 'blockchain.json')

    fs.writeFileSync(initPath, JSON.stringify(init))
    fs.writeFileSync(blockchainPath, JSON.stringify(blockchain))

    args.push(
      '-init',
      initPath,

      '-iblockchain',
      blockchainPath,
    )

    if (state && message) {
      const statePath = path.join(tmpDir, 'state.json')
      const messagePath = path.join(tmpDir, 'message.json')

      fs.writeFileSync(statePath, JSON.stringify(state))
      fs.writeFileSync(messagePath, JSON.stringify(message))

      args.push(
        '-istate',
        statePath,

        '-imessage',
        messagePath,
      )
    }

    if (libdirs) args.push('-libdir', libdirs.join(':'))

    child_process.execFileSync(paths.runnerBin, args, {stdio: 'pipe'})

    return JSON.parse(fs.readFileSync(outputPath).toString())
  })
}
