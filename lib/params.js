function generateMapperForParams(params) {
  return (values) => {
    return params.map((v, i) => ({...v, value: values[v.vname]}))
  }
}

function generateMapperFromContractInfo(info) {
  const initMapper = generateMapperForParams(info.params)

  return {
    init: (values) => {
      return initMapper(values).concat({
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
