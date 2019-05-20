function generateMapperForParams(params) {
  return (...args) => {
    if (args.length > 1) {
      if (params.length !== args.length) {
        throw new RangeError('not enough arguments')
      } else {
        return params.map((v, i) => ({...v, value: args[i]}))
      }
    } else {
      if (params.length > 1) {
        return params.map((v, i) => ({...v, value: args[0][v.vname]}))
      } else if (params.length === 1) {
        if (typeof args[0] === 'object') {
          return [{...params[0], value: args[0][params[0].vname]}]
        } else {
          return [{...params[0], value: args[0]}]
        }
      } else return []
    }
  }
}

function generateMapperFromContractInfo(info) {
  const initMapper = generateMapperForParams(info.params)

  return {
    init: (...args) => {
      return initMapper(...args).concat({
        vname: '_scilla_version',
        type: 'Uint32',
        value: '0',
      })
    },
    f: info.transitions.reduce(
      (a, v) => ({...a, [v.vname]: generateMapperForParams(v.params)}),
      {},
    ),
  }
}

module.exports.generateMapperForParams = generateMapperForParams
module.exports.generateMapperFromContractInfo = generateMapperFromContractInfo
