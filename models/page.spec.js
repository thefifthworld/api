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
        { id: 2, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{}', editorName: 'Tester', editorID: 1 },
        { id: 1, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{}', editorName: 'Tester', editorID: 1 }
      ]
      const actual = new Page(data, changes)
      expect(actual.history.changes[0].id).toEqual(2)
      expect(actual.history.changes[1].id).toEqual(1)
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

  describe('save', () => {
    it('inserts a record to the database', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const page = new Page()
      await page.save({ title: 'Test Page', body: 'This is a test.' }, editor, 'Initial text', db)
      const pagesCheck = await db.run(`SELECT id FROM pages WHERE id=${page.id};`)
      const changesCheck = await db.run(`SELECT id FROM changes WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(page.saved).toEqual(true)
      expect(pagesCheck).toHaveLength(1)
      expect(changesCheck).toHaveLength(1)
    })

    it('updates a record in the database', async () => {
      expect.assertions(4)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const page = await Page.get('/test-page', db)
      await page.save({ body: 'This is an updated body.' }, editor, 'Test update', db)
      const pagesCheck = await db.run(`SELECT id FROM pages WHERE id=${page.id};`)
      const changesCheck = await db.run(`SELECT id FROM changes WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(page.saved).toEqual(true)
      expect(page.history.getContent().body).toEqual('This is an updated body.')
      expect(pagesCheck).toHaveLength(1)
      expect(changesCheck).toHaveLength(2)
    })
  })

  describe('getLineage', () => {
    it('returns the page\'s ancestors', async () => {
      expect.assertions(1)
      const grandparent = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const parent = await Page.create({ title: 'Child Page', body: 'This is a child.', parent: grandparent.id }, editor, 'Initial text', db)
      const child = await Page.create({ title: 'Grandchild Page', body: 'This is a grandchild.', parent: parent.id }, editor, 'Initial text', db)
      const lineage = await child.getLineage(db)
      const transform = p => ({ id: p.id, title: p.title })
      const actual = lineage.map(transform)
      const expected = [ grandparent, parent ].map(transform)
      await testUtils.resetTables(db)
      expect(actual).toEqual(expected)
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
      expect.assertions(9)
      await testUtils.createTestPage(Page, Member, db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db)

      expect(page).toBeInstanceOf(Page)
      expect(page.saved).toEqual(true)
      expect(page.title).toEqual('Test Page')
      expect(page.owner).toEqual({ id: 2, email: 'normal@thefifthworld.com', name: 'Normal' })
      expect(page.history.changes).toHaveLength(1)
      expect(page.history.changes[0].editor.id).toEqual(2)
      expect(page.history.changes[0].editor.name).toEqual('Normal')
      expect(page.history.changes[0].msg).toEqual('Initial text')
      expect(page.history.changes[0].content.body).toEqual('This is a test page.')
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

  describe('getIfAllowed', () => {
    it('fetches a page from the database', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const admin = await Member.load(1, db)
      const owner = await Member.load(2, db)
      const other = await Member.load(3, db)
      const data = { title: 'Test Page', body: 'This is a test', permissions: '774' }
      const page = await Page.create(data, owner, 'Initial text', db)
      const adminRequest = await Page.getIfAllowed(page.id, admin, db)
      const ownerRequest = await Page.getIfAllowed(page.id, owner, db)
      const otherRequest = await Page.getIfAllowed(page.id, other, db)
      const strangerRequest = await Page.getIfAllowed(page.id, null, db)
      await testUtils.resetTables(db)

      expect(adminRequest).toBeInstanceOf(Page)
      expect(ownerRequest).toBeInstanceOf(Page)
      expect(otherRequest).toBeInstanceOf(Page)
      expect(strangerRequest).toBeInstanceOf(Page)
    })

    it('can restrict strangers', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const admin = await Member.load(1, db)
      const owner = await Member.load(2, db)
      const other = await Member.load(3, db)
      const data = { title: 'Test Page', body: 'This is a test', permissions: '770' }
      const page = await Page.create(data, owner, 'Initial text', db)
      const adminRequest = await Page.getIfAllowed(page.id, admin, db)
      const ownerRequest = await Page.getIfAllowed(page.id, owner, db)
      const otherRequest = await Page.getIfAllowed(page.id, other, db)
      const strangerRequest = await Page.getIfAllowed(page.id, null, db)
      await testUtils.resetTables(db)

      expect(adminRequest).toBeInstanceOf(Page)
      expect(ownerRequest).toBeInstanceOf(Page)
      expect(otherRequest).toBeInstanceOf(Page)
      expect(strangerRequest).not.toBeInstanceOf(Page)
    })

    it('can restrict other members', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const admin = await Member.load(1, db)
      const owner = await Member.load(2, db)
      const other = await Member.load(3, db)
      const data = { title: 'Test Page', body: 'This is a test', permissions: '700' }
      const page = await Page.create(data, owner, 'Initial text', db)
      const adminRequest = await Page.getIfAllowed(page.id, admin, db)
      const ownerRequest = await Page.getIfAllowed(page.id, owner, db)
      const otherRequest = await Page.getIfAllowed(page.id, other, db)
      const strangerRequest = await Page.getIfAllowed(page.id, null, db)
      await testUtils.resetTables(db)

      expect(adminRequest).toBeInstanceOf(Page)
      expect(ownerRequest).toBeInstanceOf(Page)
      expect(otherRequest).not.toBeInstanceOf(Page)
      expect(strangerRequest).not.toBeInstanceOf(Page)
    })

    it('can restrict the owner, but not an admin', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const admin = await Member.load(1, db)
      const owner = await Member.load(2, db)
      const other = await Member.load(3, db)
      const data = { title: 'Test Page', body: 'This is a test', permissions: '000' }
      const page = await Page.create(data, owner, 'Initial text', db)
      const adminRequest = await Page.getIfAllowed(page.id, admin, db)
      const ownerRequest = await Page.getIfAllowed(page.id, owner, db)
      const otherRequest = await Page.getIfAllowed(page.id, other, db)
      const strangerRequest = await Page.getIfAllowed(page.id, null, db)
      await testUtils.resetTables(db)

      expect(adminRequest).toBeInstanceOf(Page)
      expect(ownerRequest).not.toBeInstanceOf(Page)
      expect(otherRequest).not.toBeInstanceOf(Page)
      expect(strangerRequest).not.toBeInstanceOf(Page)
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

  describe('placesNear', () => {
    it('returns those places within the search area', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)

      // A page that should be returned.
      const d1 = { title: 'The Point', body: '[[Location:40.441800, -80.012772]]' }
      const point = await Page.create(d1, editor, 'Initial text', db)

      // A page outside of the search area.
      const d2 = { title: 'Three Myland', body: '[[Location:40.154507, -76.724877]]' }
      const myland = await Page.create(d2, editor, 'Initial text', db)

      // A page that the searcher doesn't have read permission for.
      const d3 = { title: 'The Steel Tower', body: '[[Location:40.441399, -79.994673]]', permissions: 700 }
      const tower = await Page.create(d3, editor, 'Initial text', db)

      const actual = await Page.placesNear([ 40.440667, -80.002583 ], null, null, db)
      const ids = actual.map(p => p.id)
      await testUtils.resetTables(db)

      expect(actual).toHaveLength(1)
      expect(ids).toContain(point.id)
      expect(ids).not.toContain(myland.id)
      expect(ids).not.toContain(tower.id)
    })
  })

  describe('find', () => {
    it('returns pages that start with the given path', async () => {
      expect.assertions(5)
      const t1 = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const t2 = await Page.create({ title: 'Child Page', body: 'Child page.', parent: t1.id }, editor, 'Initial text', db)
      const found = await Page.find({ path: '/test-page' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(found).toHaveLength(2)
      expect(found[0]).toBeInstanceOf(Page)
      expect(found[1]).toBeInstanceOf(Page)
      expect(actual).toContain(t1.id)
      expect(actual).toContain(t2.id)
    })

    it('returns pages that match part of the title query', async () => {
      expect.assertions(3)
      const t1 = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const t2 = await Page.create({ title: 'Child Page', body: 'Child page.', parent: t1.id }, editor, 'Initial text', db)
      const found = await Page.find({ title: 'Page' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(2)
      expect(actual).toContain(t1.id)
      expect(actual).toContain(t2.id)
    })

    it('returns pages of the given type', async () => {
      expect.assertions(2)
      const t1 = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const t2 = await Page.create({ title: 'Child Page', body: 'Child page. [[Type: Test]]', parent: t1.id }, editor, 'Initial text', db)
      const found = await Page.find({ type: 'Test' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual).toContain(t2.id)
    })

    it('returns pages that match a given tag', async () => {
      expect.assertions(2)
      const t1 = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const t2 = await Page.create({ title: 'Child Page', body: 'Child page. [[Test: true]]', parent: t1.id }, editor, 'Initial text', db)
      const found = await Page.find({ tags: { Test: 'true' } }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual).toContain(t2.id)
    })

    it('can perform an OR search', async () => {
      expect.assertions(3)
      const t1 = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const t2 = await Page.create({ title: 'Child Page', body: 'Child page.', parent: t1.id }, editor, 'Initial text', db)
      const found = await Page.find({ path: '/test-page/child-page', title: 'Test Page', logic: 'or' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(2)
      expect(actual).toContain(t1.id)
      expect(actual).toContain(t2.id)
    })

    it('doesn\'t return pages that you don\'t have permission for', async () => {
      expect.assertions(3)
      const t1 = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const other = await Member.load(3, db)
      const t2 = await Page.create({ title: 'Child Page', body: 'Child page.', parent: t1.id, permissions: 700 }, editor, 'Initial text', db)
      const found = await Page.find({ path: '/test-page' }, other, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(found).toHaveLength(1)
      expect(actual).toContain(t1.id)
      expect(actual).not.toContain(t2.id)
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

  describe('getDescription', () => {
    it('returns the default if not given a string', () => {
      const actual = Page.getDescription()
      expect(actual).toEqual('Four hundred years from now, humanity thrives beyond civilization.')
    })

    it('returns the string if it\'s less than the cutoff.', () => {
      const actual = Page.getDescription('This is less than 150 characters.')
      expect(actual).toEqual('This is less than 150 characters.')
    })

    it('returns as many sentences as will fit in the cutoff', () => {
      const actual = Page.getDescription('We might have a short sentence. We might have two short sentences, even. But a third one that goes past the runoff won\'t make the cut, so that we can make a description entirely out of complete sentences.')
      expect(actual).toEqual('We might have a short sentence. We might have two short sentences, even.')
    })

    it('returns as many words as will fit in the cutoff', () => {
      const actual = Page.getDescription('If the very first sentence is rather long, such that it contains more characters than will fit within the designated cutoff, then we\'ll instead find as many full words as we can fit inside of that cutoff and return those.')
      expect(actual).toEqual('If the very first sentence is rather long, such that it contains more characters than will fit within the designated cutoff, then we\'ll instead find…')
    })
  })
})
