const child_process = require('child_process')
const fs = require('fs')
const path = require('path')

const paths = require('../paths')
const scillaTmpDirWrap = require('./scillaTmpDirWrap')

module.exports = function checker({
  init,
  libdirs = [paths.stdlibDir],
  code,
  input,
  strict,
  cashflow,
}) {
  return scillaTmpDirWrap(tmpDir => {
    const args = ['-jsonerrors']

    if (cashflow) {
      args.push('-cf')
    }

    if (init) {
      const initPath = path.join(tmpDir, 'init.json')

      fs.writeFileSync(initPath, JSON.stringify(init))

      args.push('-init', initPath)
    }

    if (libdirs) args.push('-libdir', libdirs.join(':'))

    if (input) {
      args.push(input)
    } else {
      const inputPath = path.join(tmpDir, 'contract.scilla')
      fs.writeFileSync(inputPath, code)
      args.push(inputPath)
    }

    const stdout = child_process
      .execFileSync(paths.checkerBin, args, {stdio: 'pipe'})
      .toString()

    const json = JSON.parse(stdout.toString())
    if (strict && stdout.length > 0) {
      if (json.warnings.length > 0) {
        throw new Error(JSON.stringify(json, null, 2))
        const newError = new Error(json.warnings[0].warning_message)
        newError.errorJSON = json
        throw newError
      }
    }
    return json
  })
}
