/* global describe, it, expect, afterAll */

const { union } = require('./utils')

describe('union', () => {
  it('returns a union of several arrays', () => {
    expect(union([ 1, 2 ], [ 3, 4 ], [ 5, 6 ])).toEqual([ 1, 2, 3, 4, 5, 6 ])
  })

  it('doesn\'t duplicate the overlap', () => {
    expect(union([ 1, 2 ], [ 2, 3 ], [ 3, 4 ])).toEqual([ 1, 2, 3, 4 ])
  })
})
