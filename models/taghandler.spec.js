/* global describe, it, expect */

const TagHandler = require('./taghandler')

describe('TagHandler', () => {
  describe('constructor', () => {
    it('prepares an object for storing tags', () => {
      const actual = new TagHandler()
      expect(actual.tags).toEqual({})
    })
  })

  describe('add', () => {
    it('adds a tag', () => {
      const actual = new TagHandler()
      actual.add('test', 'hello world')
      expect(actual.tags.test).toEqual([ 'hello world' ])
    })

    it('makes tag all lower-case', () => {
      const actual = new TagHandler()
      actual.add('TeSt', 'hello world')
      expect(actual.tags.test).toEqual([ 'hello world' ])
    })

    it('handles tags with spaces', () => {
      const actual = new TagHandler()
      actual.add('another Test', 'hello world')
      expect(actual.tags['another test']).toEqual([ 'hello world' ])
    })

    it('adds to existing tags', () => {
      const actual = new TagHandler()
      actual.add('test', 'hello')
      actual.add('test', 'world')
      expect(actual.tags.test).toEqual([ 'hello', 'world' ])
    })
  })
})
