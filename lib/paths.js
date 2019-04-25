const path = require('path')

exports.scillaDir =
  process.env.SCILLA_PROJECT_DIR || path.join(__dirname, '../../scilla')
exports.binDir = path.join(exports.scillaDir, 'bin')
exports.checkerBin = path.join(exports.binDir, 'scilla-checker')
exports.runnerBin = path.join(exports.binDir, 'scilla-runner')
exports.stdlibDir = path.join(exports.scillaDir, 'src/stdlib')
