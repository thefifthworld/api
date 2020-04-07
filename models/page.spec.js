/* global describe, it, expect, afterAll */

const db = require('../db')
const testUtils = require('../test-utils')

const Member = require('./member')
const Page = require('./page')

describe('Page', () => {
  afterAll(() => { db.end() })

  describe('constructor', () => {
    it('copies specific fields', () => {
      const data = { id: 1, title: 'Test', description: 'test', slug: 'test', path: '/test', parent: null, type: 'Test' }
      const actual = new Page(data)
      expect(actual.id).toEqual(data.id)
      expect(actual.title).toEqual(data.title)
      expect(actual.description).toEqual(data.description)
      expect(actual.slug).toEqual(data.slug)
      expect(actual.path).toEqual(data.path)
      expect(actual.parent).toEqual(data.parent)
      expect(actual.type).toEqual(data.type)
    })

    it('copies owner info', () => {
      const data = { ownerID: 1, ownerEmail: 'admin@thefifthworld.com', ownerName: 'Admin' }
      const actual = new Page(data)
      expect(actual.owner).toEqual({ id: data.ownerID, email: data.ownerEmail, name: data.ownerName })
    })

    it('copies changes', () => {
      const data = { id: 1, title: 'Test', description: 'test', slug: 'test', path: '/test', parent: null, type: 'Test' }
      const changes = [
        { id: 1, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{}', editor: { name: 'Tester', id: 1 } },
        { id: 2, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{}', editor: { name: 'Tester', id: 1 } }
      ]
      const actual = new Page(data, changes)
      expect(actual.changes[0].id).toEqual(2)
      expect(actual.changes[1].id).toEqual(1)
    })
  })

  describe('checkPermissions', () => {
    it('returns false if the page doesn\'t have permissions set', async () => {
      expect.assertions(1)
      const page = await testUtils.createTestPage(Page, Member, db)
      delete page.permissions
      const actual = page.checkPermissions(page.owner, 4)
      await testUtils.resetTables(db)
      expect(actual).toEqual(false)
    })

    it('gives 774 access by default', async () => {
      expect.assertions(6)
      const page = await testUtils.createTestPage(Page, Member, db)
      const owner = await Member.load(2, db)
      const ownerCanRead = page.checkPermissions(owner, 4)
      const ownerCanWrite = page.checkPermissions(owner, 6)
      const other = await Member.load(3, db)
      const otherCanRead = page.checkPermissions(other, 4)
      const otherCanWrite = page.checkPermissions(other, 6)
      const strangerCanRead = page.checkPermissions(null, 4)
      const strangerCanWrite = page.checkPermissions(null, 6)
      await testUtils.resetTables(db)

      expect(ownerCanRead).toEqual(true)
      expect(ownerCanWrite).toEqual(true)
      expect(otherCanRead).toEqual(true)
      expect(otherCanWrite).toEqual(true)
      expect(strangerCanRead).toEqual(true)
      expect(strangerCanWrite).toEqual(false)
    })

    it('is OK with permissions as a string', async () => {
      expect.assertions(6)
      const page = await testUtils.createTestPage(Page, Member, db)
      page.permissions = '774'
      const owner = await Member.load(2, db)
      const ownerCanRead = page.checkPermissions(owner, 4)
      const ownerCanWrite = page.checkPermissions(owner, 6)
      const other = await Member.load(3, db)
      const otherCanRead = page.checkPermissions(other, 4)
      const otherCanWrite = page.checkPermissions(other, 6)
      const strangerCanRead = page.checkPermissions(null, 4)
      const strangerCanWrite = page.checkPermissions(null, 6)
      await testUtils.resetTables(db)

      expect(ownerCanRead).toEqual(true)
      expect(ownerCanWrite).toEqual(true)
      expect(otherCanRead).toEqual(true)
      expect(otherCanWrite).toEqual(true)
      expect(strangerCanRead).toEqual(true)
      expect(strangerCanWrite).toEqual(false)
    })

    it('can completely lock a page', async () => {
      expect.assertions(6)
      const page = await testUtils.createTestPage(Page, Member, db)
      page.permissions = 444
      const owner = await Member.load(2, db)
      const ownerCanRead = page.checkPermissions(owner, 4)
      const ownerCanWrite = page.checkPermissions(owner, 6)
      const other = await Member.load(3, db)
      const otherCanRead = page.checkPermissions(other, 4)
      const otherCanWrite = page.checkPermissions(other, 6)
      const strangerCanRead = page.checkPermissions(null, 4)
      const strangerCanWrite = page.checkPermissions(null, 6)
      await testUtils.resetTables(db)

      expect(ownerCanRead).toEqual(true)
      expect(ownerCanWrite).toEqual(false)
      expect(otherCanRead).toEqual(true)
      expect(otherCanWrite).toEqual(false)
      expect(strangerCanRead).toEqual(true)
      expect(strangerCanWrite).toEqual(false)
    })

    it('can completely hide a page', async () => {
      expect.assertions(6)
      const page = await testUtils.createTestPage(Page, Member, db)
      page.permissions = '000'
      const owner = await Member.load(2, db)
      const ownerCanRead = page.checkPermissions(owner, 4)
      const ownerCanWrite = page.checkPermissions(owner, 6)
      const other = await Member.load(3, db)
      const otherCanRead = page.checkPermissions(other, 4)
      const otherCanWrite = page.checkPermissions(other, 6)
      const strangerCanRead = page.checkPermissions(null, 4)
      const strangerCanWrite = page.checkPermissions(null, 6)
      await testUtils.resetTables(db)

      expect(ownerCanRead).toEqual(false)
      expect(ownerCanWrite).toEqual(false)
      expect(otherCanRead).toEqual(false)
      expect(otherCanWrite).toEqual(false)
      expect(strangerCanRead).toEqual(false)
      expect(strangerCanWrite).toEqual(false)
    })

    it('gives an admin all permissions', async () => {
      expect.assertions(2)
      const page = await testUtils.createTestPage(Page, Member, db)
      page.permissions = '000'
      const admin = await Member.load(1, db)
      const adminCanRead = page.checkPermissions(admin, 4)
      const adminCanWrite = page.checkPermissions(admin, 6)
      await testUtils.resetTables(db)
      expect(adminCanRead).toEqual(true)
      expect(adminCanWrite).toEqual(true)
    })
  })

  describe('create', () => {
    it('adds a page to the database', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.'
      }
      await Page.create(data, editor, 'Initial text', db)
      const pages = await db.run(`SELECT id, title FROM pages;`)
      const changes = await db.run(`SELECT page FROM changes;`)
      await testUtils.resetTables(db)
      expect(pages).toHaveLength(1)
      expect(changes).toHaveLength(1)
      expect(pages[0].title).toEqual(data.title)
      expect(changes[0].page).toEqual(pages[0].id)
    })

    it('returns the created page', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.'
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      await testUtils.resetTables(db)
      expect(page).toBeInstanceOf(Page)
      expect(page.title).toEqual(data.title)
    })

    it('parses type from body', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test. [[Type:Nope]] [[Type:Test]]'
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      await testUtils.resetTables(db)
      expect(page.type).toEqual('Test')
    })

    it('can create a child', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const pdata = { title: 'Parent', body: 'This is the parent.' }
      const cdata = { title: 'Child', body: 'This is the child.' }
      const parent = await Page.create(pdata, editor, 'Initial text', db)
      cdata.parent = parent.path
      const child = await Page.create(cdata, editor, 'Initial text', db)
      await testUtils.resetTables(db)
      expect(child.parent).toEqual(parent.id)
      expect(child.depth).toEqual(1)
      expect(child.path).toEqual('/parent/child')
    })

    it('saves the location', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Pittsburgh', body: '[[Location: 40.441823, -80.012778]]' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const rows = await db.run(`SELECT * FROM places WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(rows).toHaveLength(1)
    })

    it('marks the page as a place if it has a location', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Pittsburgh', body: '[[Location: 40.441823, -80.012778]] [[Type:Test]]' }
      const page = await Page.create(data, editor, 'Initial text', db)
      await testUtils.resetTables(db)
      expect(page.type).toEqual('Place')
    })

    it('saves tags', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: 'This is a test. [[Tag:Test]]' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const rows = await db.run(`SELECT * FROM tags WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(rows).toHaveLength(1)
      expect(rows[0].tag).toEqual('tag')
      expect(rows[0].value).toEqual('Test')
    })

    it('saves links', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: 'This is a test. [[Test Link]]' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const rows = await db.run(`SELECT * FROM links WHERE src=${page.id};`)
      await testUtils.resetTables(db)
      expect(rows).toHaveLength(1)
      expect(rows[0].dest).toEqual(null)
      expect(rows[0].title).toEqual('Test Link')
    })
  })

  describe('get', () => {
    it('fetches a page from the database', async () => {
      expect.assertions(8)
      await testUtils.createTestPage(Page, Member, db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db)

      expect(page).toBeInstanceOf(Page)
      expect(page.title).toEqual('Test Page')
      expect(page.owner).toEqual({ id: 2, email: 'normal@thefifthworld.com', name: 'Normal' })
      expect(page.changes).toHaveLength(1)
      expect(page.changes[0].editor.id).toEqual(2)
      expect(page.changes[0].editor.name).toEqual('Normal')
      expect(page.changes[0].msg).toEqual('Initial text')
      expect(page.changes[0].content.body).toEqual('This is a test page.')
    })

    it('can fetch by path', async () => {
      expect.assertions(2)
      await testUtils.createTestPage(Page, Member, db)
      const page = await Page.get('/test-page', db)
      await testUtils.resetTables(db)
      expect(page).toBeInstanceOf(Page)
      expect(page.title).toEqual('Test Page')
    })

    it('loads the page\'s location', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test page',  body: 'This is a test. [[Test:Hello]] [[Test:World]]' }
      await Page.create(data, editor, 'Initial text', db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db)
      expect(page.tags.test).toEqual([ 'Hello', 'World' ])
    })

    it('loads the page\'s tags', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Pittsburgh', body: '[[Location: 40.441823, -80.012778]]' }
      await Page.create(data, editor, 'Initial text', db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db)
      expect(page.location.lat).toBeCloseTo(40.441823, 3)
      expect(page.location.lon).toBeCloseTo(-80.012778, 3)
    })
  })

  describe('getChildrenOf', () => {
    it('returns an array of the page\'s children', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const pdata = { title: 'Parent', body: 'This is the parent.' }
      const cdata = { title: 'Child', body: 'This is the child.' }
      const parent = await Page.create(pdata, editor, 'Initial text', db)
      cdata.parent = parent.path
      await Page.create(cdata, editor, 'Initial text', db)
      const children = await Page.getChildrenOf(parent, null, db)
      await testUtils.resetTables(db)
      expect(children).toHaveLength(1)
      expect(children[0].title).toEqual(cdata.title)
      expect(children[0].parent).toEqual(parent.id)
    })

    it('returns an array of the page\'s children that match the type', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const pdata = { title: 'Parent', body: 'This is the parent.' }
      const c1data = { title: 'Child 1', body: 'This is one child. [[Type: Test]]' }
      const c2data = { title: 'Child 2', body: 'This is another child.' }
      const parent = await Page.create(pdata, editor, 'Initial text', db)
      c1data.parent = parent.path; c2data.parent = parent.path
      await Page.create(c1data, editor, 'Initial text', db)
      await Page.create(c2data, editor, 'Initial text', db)
      const children = await Page.getChildrenOf(parent, 'Test', db)
      await testUtils.resetTables(db)
      expect(children).toHaveLength(1)
      expect(children[0].title).toEqual(c1data.title)
      expect(children[0].parent).toEqual(parent.id)
    })
  })

  describe('isReservedTemplate', () => {
    it('returns false if the type is not a template', () => {
      expect(Page.isReservedTemplate('NotTemplate', 'Test')).toEqual(false)
    })

    it('returns false if it\'s a template with a valid name', () => {
      expect(Page.isReservedTemplate('Template', 'Test')).toEqual(false)
    })

    it('returns true if it\'s a template with a reserved name', () => {
      expect(Page.isReservedTemplate('Template', 'Template')).toEqual(true)
    })
  })

  describe('isReservedPath', () => {
    it('returns false if given a valid path', () => {
      expect(Page.isReservedPath('/test')).toEqual(false)
    })

    it('returns true if given a reserved path', () => {
      expect(Page.isReservedPath('/dashboard')).toEqual(true)
    })
  })

  describe('slugify', () => {
    it('slugifies a string', async () => {
      const actual = Page.slugify('Csíkszentmihályi’s name includes some diacritics!')
      const expected = 'csikszentmihalyis-name-includes-some-diacritics'
      expect(actual).toEqual(expected)
    })
  })
})
