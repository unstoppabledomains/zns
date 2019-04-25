const fs = require('fs')
const path = require('path')
const rimraf = require('rimraf')
const uuid = require('uuid/v4')

module.exports = function scillaTmpDirWrap(cb) {
  const tmpDir = path.join('/tmp', 'scilla-' + uuid())

  fs.mkdirSync(tmpDir, {recursive: true})

  try {
    return cb(tmpDir)
  } catch (error) {
    if (error.stderr) {
      const errorJSON = JSON.parse(error.stderr.toString())
      throw new Error(JSON.stringify(errorJSON, null, 2))
      const newError = new Error(errorJSON.errors[0].error_message)
      newError.errorJSON = errorJSON
      throw newError
    } else throw error
  } finally {
    rimraf.sync(tmpDir)
  }
}
