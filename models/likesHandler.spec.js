/* global describe, it, expect */

const LikesHandler = require('./likesHandler')
const Page = require('./page')

describe('LikesHandler', () => {
  describe('constructor', () => {
    it('returns a LikesHandler instance', () => {
      const actual = new LikesHandler()
      expect(actual).toBeInstanceOf(LikesHandler)
    })

    it('can take a Page as an argument', () => {
      const p = new Page()
      p.id = 1; p.path = '/test'; p.title = 'Test'
      const actual = new LikesHandler(p)
      expect(actual.id).toEqual(p.id)
      expect(actual.path).toEqual(p.path)
      expect(actual.title).not.toBeDefined()
    })

    it('can take an array of IDs as an argument', () => {
      const p = new Page()
      p.id = 1; p.path = '/test'; p.title = 'Test'
      const ids = [ 1, 2, 3, 4, 5 ]
      const actual = new LikesHandler(p, ids)
      expect(actual.ids).toEqual(ids)
    })
  })
})
