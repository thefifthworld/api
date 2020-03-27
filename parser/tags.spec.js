/* global describe, it, expect, afterAll */

const parseTags = require('./tags')

describe('parseTags', () => {
  it('finds tags', async () => {
    const actual = parseTags('This [[Hello:World]] is [[Hello : Test]] text [[Tag: 1]] outside of tags.\n\nAnd here is a [[Test:true]] second paragraph.')
    expect(actual.tags).toEqual({ hello: [ 'World', 'Test' ], tag: [ '1' ], test: [ 'true' ] })
  })

  it('strips tags from the text', async () => {
    const actual = parseTags('This [[Hello:World]] is [[Hello : Test]] text [[Tag: 1]] outside of tags.\n\nAnd here is a [[Test:true]] second paragraph.')
    expect(actual.stripped).toEqual('This is text outside of tags.\n\nAnd here is a second paragraph.')
  })
})
