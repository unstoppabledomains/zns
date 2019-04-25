const fs = require('fs')
const path = require('path')

const checker = require('./checker')
const paths = require('../paths')

it('should pass a valid scilla file', () => {
  expect(
    checker({
      input: path.join(__dirname, '../example_contracts/hello.scilla'),

      cashflow: true,
    }),
  ).toMatchSnapshot()
})

it('should throw on error scilla file', () => {
  expect(() => {
    checker({
      input: path.join(__dirname, '../example_contracts/invalid.scilla'),
    })
  }).toThrowErrorMatchingSnapshot()
})

it("should throw on warning if in 'strict mode' scilla file", () => {
  expect(() => {
    checker({
      input: path.join(__dirname, '../example_contracts/hello.scilla'),

      strict: true,
    })
  }).toThrowErrorMatchingSnapshot()
})
