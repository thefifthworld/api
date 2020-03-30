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
      expect.assertions(1)
      const actual = new LinkHandler()
      expect(actual.links).toEqual([])
    })
  })

  describe('add', () => {
    it('returns link info', async () => {
      expect.assertions(1)
      const handler = new LinkHandler()
      const actual = await handler.add('[[Link]]', db)
      expect(actual).toEqual({ id: null, path: '/new?title=Link', text: 'Link', title: 'Link', isNew: true })
    })

    it('returns link info for an existing link', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      const actual = await handler.add('[[Test Page]]', db)
      await testUtils.resetTables(db)
      expect(actual).toEqual({ id: 1, path: '/test-page', text: 'Test Page', title: 'Test Page', isNew: false })
    })
  })

  describe('save', () => {
    it('saves link info to the database', async () => {
      expect.assertions(4)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      await handler.add('[[Test Page]]', db)
      await handler.save(page, db)
      const actual = await db.run(`SELECT * FROM links;`)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].src).toEqual(page.id)
      expect(actual[0].dest).toEqual(page.id)
      expect(actual[0].title).toEqual('Test Page')
    })

    it('saves link requests to the database', async () => {
      expect.assertions(4)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      await handler.add('[[New Page]]', db)
      await handler.save(page, db)
      const actual = await db.run(`SELECT * FROM links;`)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].src).toEqual(page.id)
      expect(actual[0].dest).toEqual(null)
      expect(actual[0].title).toEqual('New Page')
    })

    it('does nothing if not given a page', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      await handler.add('[[Test Page]]', db)
      await handler.save(1, db)
      const actual = await db.run(`SELECT * FROM links;`)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(0)
    })

    it('does nothing if given a page that has no ID', async () => {
      expect.assertions(1)
      const page = await testUtils.createTestPage(Page, Member, db)
      page.id = null
      const handler = new LinkHandler()
      await handler.add('[[Test Page]]', db)
      await handler.save(page, db)
      const actual = await db.run(`SELECT * FROM links;`)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(0)
    })

    it('does nothing if given a page that has an invalid ID', async () => {
      expect.assertions(1)
      const page = await testUtils.createTestPage(Page, Member, db)
      page.id = 'nope'
      const handler = new LinkHandler()
      await handler.add('[[Test Page]]', db)
      await handler.save(page, db)
      const actual = await db.run(`SELECT * FROM links;`)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(0)
    })
  })
})
