function resolverStateToMap(state) {
  const records = state.find(
    param => param.vname === 'records' && param.type === 'Map (String) (ByStr)',
  )

  if (records) {
    return records.value.reduce((a, {key, val}) => {
      a[key] = val
      return a
    }, {})
  } else {
    // const mappedRecords = state.find(
    //   param =>
    //     param.vname === 'records' &&
    //     param.type === 'Map ByStr20 (Map String ByStr)',
    // )
    return mappedRecords.value
      .find(({key}) => key === owner)
      .val.value.reduce((a, {key, val}) => {
        a[key] = val
        return a
      }, {})
  }
}

function stringToPath(path) {
  return Array.prototype.concat(
    ...path.split('.').map(segment => {
      const match = segment.match(/^([a-zA-Z_][\w]*)(?:\[(\d+(?:\]\[\d+)*)\])?/)

      if (match) {
        if (match[2]) return [match[1], ...match[2].split('][')]
        else return match[1]
      } else throw new RangeError('path is invalid')
    }),
  )
}

function mapToJSON(map) {
  const json = {}

  Object.keys(map).forEach(key => {
    const path = stringToPath(key)

    let node = json
    let index = 0
    const length = path.length

    while (index < length - 1) {
      if (path[index] in node) node = node[path[index++]]
      else if (/^[\d]+$/.test(path[index + 1])) node = node[path[index++]] = []
      else node = node[path[index++]] = {}
    }

    if (typeof node === 'string' || node[path[length - 1]]) {
      throw new RangeError('key contains a conflicting path')
    } else node[path[length - 1]] = map[key]
  })

  return json
}

function jsonToMap(json) {
  const map = {}

  function recurse(node, path) {
    if (Array.isArray(node)) {
      node.forEach((value, i) => recurse(value, path + '[' + i + ']'))
    } else if (typeof node === 'object') {
      Object.keys(node).forEach(value =>
        recurse(node[value], path + (path ? '.' : '') + value),
      )
    } else map[path] = node
  }

  recurse(typeof json === 'string' ? JSON.parse(json) : json, '')

  return map
}

function replaceValueInJSON(path, json, fn) {
  path = stringToPath(path)

  let node = json
  let index = 0
  const length = path.length

  while (index < length - 1) {
    if (typeof node === 'object' && path[index] in node) {
      node = node[path[index++]]
    } else return
  }
  if (typeof node === 'object' && path[index] in node) {
    node[path[length - 1]] = fn(node[path[length - 1]])
  }
}

function createTransformer(fnObject) {
  return json => {
    const clone = Object.assign({}, json)

    Object.keys(fnObject).forEach(key => {
      if (typeof fnObject[key]) {
        replaceValueInJSON(key, clone, fnObject[key])
      }
    })

    return clone
  }
}

function compose(...fns) {
  if (fns.length === 0) return arg => arg
  else if (fns.length === 1) return fns[0]
  else return fns.reduce((a, b) => (...args) => a(b(...args)))
}

exports.parseResolverState = compose(
  createTransformer({
    ['bla'](input) {
      return input + ' changed'
    },
  }),
  mapToJSON,
  resolverStateToMap,
)

if (require.main === module) {
  console.log(
    exports.parseResolverState([
      {
        vname: 'records',
        type: 'Map (String) (ByStr)',
        value: [
          {key: 'test', val: '0x7357'},
          {key: 'bla', val: '0x7357'},
          {key: 'crypto.BTC', val: '0x7357'},
          {key: 'crypto.ETH', val: '0x7357'},
          {key: 'crypto.ETH', val: '0x7357'},
          {key: 'dns.A[0]', val: '0x1234123'},
          {key: 'dns.A[1]', val: '0x1234123'},
          {key: 'dns.A[2]', val: '0x1234123'},
        ],
      },
    ]),
  )
}
