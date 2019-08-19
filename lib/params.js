function normalizeValue(value) {
  switch(typeof(value)) {
    case "number": return value.toString()
    case "boolean":
      value = value.toString()
      value = value.charAt(0).toUpperCase() + value.slice(1)
      return {constructor: value, argtypes: [], arguments: []}
    case "object": return value
    default:       return value.toString()
  }
}
function generateMapperForParams(params) {
  return (values) => {
    return params.map((v, i) => {
      return ({...v, value: normalizeValue(values[v.vname])})
    })
  }
}

let defaultParams = [
  {
    vname: '_scilla_version',
    type: 'Uint32',
  },
  {
    vname: '_creation_block',
    type: 'BNum',
  }
]
let defaultValues = {
  _scilla_version: 0,
  _creation_block: 0,
}

function generateMapperFromContractInfo(info) {
  const initMapper = generateMapperForParams(info.params.concat(defaultParams))

  return {
    init: (values) => {
      return initMapper({...defaultValues, ...values})
    },
    f: info.transitions.reduce(
      (a, v) => ({...a, [v.vname]: generateMapperForParams(v.params)}),
      {},
    ),
  }
}

module.exports.generateMapperForParams = generateMapperForParams
module.exports.generateMapperFromContractInfo = generateMapperFromContractInfo
