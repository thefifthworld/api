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

    it('handles anchors', async () => {
      expect.assertions(1)
      const handler = new LinkHandler()
      const actual = await handler.add('[[Link#Section]]', db)
      expect(actual).toEqual({ id: null, path: '/new?title=Link', anchor: 'section', text: 'Link#Section', title: 'Link', isNew: true })
    })

    it('returns link info for an existing link', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      const actual = await handler.add('[[Test Page]]', db)
      await testUtils.resetTables(db)
      expect(actual).toEqual({ id: 1, path: '/test-page', text: 'Test Page', title: 'Test Page', isNew: false })
    })

    it('handles path links', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      const actual = await handler.add('[[/test-page]]', db)
      await testUtils.resetTables(db)
      expect(actual).toEqual({ id: 1, path: '/test-page', text: '/test-page', title: 'Test Page', isNew: false })
    })

    it('handles path links with aliases', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      const actual = await handler.add('[[/test-page|This is a test.]]', db)
      await testUtils.resetTables(db)
      expect(actual).toEqual({ id: 1, path: '/test-page', text: 'This is a test.', title: 'Test Page', isNew: false })
    })

    it('returns link info for an existing link with an anchor', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      const actual = await handler.add('[[Test Page#Section Title]]', db)
      await testUtils.resetTables(db)
      expect(actual).toEqual({ id: 1, path: '/test-page#section-title', anchor: 'section-title', text: 'Test Page#Section Title', title: 'Test Page', isNew: false })
    })
  })

  describe('save', () => {
    it('saves link info to the database', async () => {
      expect.assertions(4)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      await handler.add('[[Test Page]]', db)
      await handler.save(page.id, db)
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
      await handler.save(page.id, db)
      const actual = await db.run(`SELECT * FROM links;`)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].src).toEqual(page.id)
      expect(actual[0].dest).toEqual(null)
      expect(actual[0].title).toEqual('New Page')
    })

    it('does nothing if not given a number', async () => {
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

    it('overwrites previous saves', async () => {
      expect.assertions(2)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new LinkHandler()
      await handler.add('[[Test Page]]', db)
      await handler.add('[[New Page]]', db)
      await handler.save(page.id, db)
      const before = await db.run(`SELECT * FROM links;`)
      handler.links = []
      await handler.add('[[Test Page]]', db)
      await handler.save(page.id, db)
      const after = await db.run(`SELECT * FROM links;`)
      await testUtils.resetTables(db)
      expect(before).toHaveLength(2)
      expect(after).toHaveLength(1)
    })
  })

  describe('parse', () => {
    it('parses links', async () => {
      expect.assertions(3)
      await testUtils.createTestPage(Page, Member, db)
      const actual = await LinkHandler.parse('Here\'s some links: [[Test Page | hello]] [[Test Page]]', db)
      await testUtils.resetTables(db)
      expect(actual.str).toEqual('Here\'s some links: <a href="/test-page" title="Test Page">hello</a> <a href="/test-page">Test Page</a>')
      expect(actual.linkHandler).toBeInstanceOf(LinkHandler)
      expect(actual.linkHandler.links).toHaveLength(2)
    })

    it('parses new links', async () => {
      expect.assertions(3)
      const actual = await LinkHandler.parse('Here\'s a link: [[hello]]', db)
      expect(actual.str).toEqual('Here\'s a link: <a href="/new?title=hello" class="isNew">hello</a>')
      expect(actual.linkHandler).toBeInstanceOf(LinkHandler)
      expect(actual.linkHandler.links).toEqual([ { id: null, text: 'hello', title: 'hello', path: '/new?title=hello', isNew: true } ])
    })

    it('doesn\'t parse tags', async () => {
      expect.assertions(3)
      const actual = await LinkHandler.parse('Here\'s a tag: [[World:Hello]]', db)
      expect(actual.str).toEqual('Here\'s a tag: [[World:Hello]]')
      expect(actual.linkHandler).toBeInstanceOf(LinkHandler)
      expect(actual.linkHandler.links).toEqual([])
    })
  })

  describe('loadRequested', () => {
    it('loads requested links', async () => {
      expect.assertions(8)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const d1 = { title: 'Page One', body: 'This is a page.' }
      const d2 = { title: 'Page Two', body: 'This is another page.' }
      const p1 = await Page.create(d1, editor, 'Initial text', db)
      const p2 = await Page.create(d2, editor, 'Initial text', db)
      const handler = new LinkHandler()
      await handler.add('[[Page Four]]', db)
      await handler.add('[[Page Five]]', db)
      await handler.save(p1.id, db)
      handler.links = []
      await handler.add('[[Page Five]]', db)
      await handler.save(p2.id, db)
      const actual = await LinkHandler.loadRequested(db)
      await testUtils.resetTables(db)

      expect(actual).toHaveLength(2)
      expect(actual[0].links).toHaveLength(2)
      expect(actual[0].title).toEqual('Page Five')
      expect(actual[0].links[0].id).toEqual(p1.id)
      expect(actual[0].links[1].id).toEqual(p2.id)
      expect(actual[1].links).toHaveLength(1)
      expect(actual[1].title).toEqual('Page Four')
      expect(actual[1].links[0].id).toEqual(p1.id)
    })

    it('lists each page that has requested a link only once', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'Test Page', body: 'This is a page. [[Link]] [[Link]] [[Link]]' }, editor, 'Initial text', db)
      const actual = await LinkHandler.loadRequested(db)
      await testUtils.resetTables(db)
      expect(actual[0].links).toHaveLength(1)
    })

    it('doesn\'t report a requested link after it has been created', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'Test Page', body: 'This is a page. [[Link]]' }, editor, 'Initial text', db)
      const before = await LinkHandler.loadRequested(db)
      await Page.create({ title: 'Link', body: 'This is the other page.' }, editor, 'Initial text', db)
      const after = await LinkHandler.loadRequested(db)
      await testUtils.resetTables(db)
      expect(before).toHaveLength(1)
      expect(after).toHaveLength(0)
    })
  })
})
