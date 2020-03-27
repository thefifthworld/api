/* global describe, it, expect */

const TagHandler = require('./taghandler')

describe('TagHandler', () => {
  describe('constructor', () => {
    it('prepares an object for storing tags', () => {
      const actual = new TagHandler()
      expect(actual.tags).toEqual({})
    })
  })
})
