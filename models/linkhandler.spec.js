/* global describe, it, expect, afterAll */

const db = require('../db')
const testUtils = require('../test-utils')
const Member = require('../models/member')
const Page = require('../models/page')

const LinkHandler = require('./linkhandler')

describe('LinkHandler', () => {
  afterAll(() => { db.end() })

  describe('constructor', () => {
    it('prepares an object for storing tags', () => {
      const actual = new LinkHandler()
      expect(actual.links).toEqual([])
    })
  })

  describe('add', () => {
    it('returns link info', async () => {
      const handler = new LinkHandler()
      const actual = await handler.add('[[Link]]', db)
      expect(actual).toEqual({ path: '/new?title=Link', text: 'Link', title: 'Link', isNew: true })
    })

    it('returns link info for an existing link', async () => {
      await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      const actual = await handler.add('[[Test Page]]', db)
      await testUtils.resetTables(db)
      expect(actual).toEqual({ path: '/test-page', text: 'Test Page', title: 'Test Page', isNew: false })
    })
  })
})
