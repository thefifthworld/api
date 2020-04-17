/* global describe, it, expect, afterAll */

const { union, intersection } = require('./utils')

describe('union', () => {
  it('returns a union of several arrays', () => {
    expect(union([ 1, 2 ], [ 3, 4 ], [ 5, 6 ])).toEqual([ 1, 2, 3, 4, 5, 6 ])
  })

  it('returns the original array if only given one', () => {
    expect(union([ 1, 2 ])).toEqual([ 1, 2 ])
  })

  it('doesn\'t duplicate the overlap', () => {
    expect(union([ 1, 2 ], [ 2, 3 ], [ 3, 4 ])).toEqual([ 1, 2, 3, 4 ])
  })
})

describe('intersection', () => {
  it('returns the intersection of several arrays', () => {
    expect(intersection([ 1, 2, 3 ], [ 2, 3, 4 ], [ 3, 4, 5 ])).toEqual([ 3 ])
  })

  it('returns the original array if only given one', () => {
    expect(intersection([ 1, 2 ])).toEqual([ 1, 2 ])
  })
})
