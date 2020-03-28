/* global describe, it, expect, afterAll */

const db = require('../db')

const LinkHandler = require('./linkhandler')

describe('LinkHandler', () => {
  afterAll(() => { db.end() })

  describe('constructor', () => {
    it('prepares an object for storing tags', () => {
      const actual = new LinkHandler()
      expect(actual.links).toEqual([])
    })
  })
})
