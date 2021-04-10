/* global describe, it, expect, afterAll */

const config = require('../config')
const db = require('../db')
const testUtils = require('../test-utils')

const FileHandler = require('./fileHandler')
const LikesHandler = require('./likesHandler')
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

  describe('export', () => {
    it('exports the page history', async () => {
      expect.assertions(3)
      await testUtils.createTestPage(Page, Member, db)
      const page = await Page.get('/test-page', db)
      const actual = page.export()
      await testUtils.resetTables(db)
      expect(actual.history.changes).not.toBeDefined()
      expect(Array.isArray(actual.history)).toEqual(true)
      expect(actual.history.length).toEqual(1)
    })

    it('exports likes', async () => {
      expect.assertions(3)
      await testUtils.createTestPage(Page, Member, db)
      const normal = await Member.load(2, db)
      const page = await Page.get('/test-page', db)
      await page.likes.add(normal, db)
      const actual = page.export()
      await testUtils.resetTables(db)
      expect(actual.likes.ids).not.toBeDefined()
      expect(Array.isArray(actual.likes)).toEqual(true)
      expect(actual.likes).toEqual([ 2 ])
    })

    it('removes owner email', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const page = await Page.get('/test-page', db)
      const actual = page.export()
      await testUtils.resetTables(db)
      expect(actual.owner.email).not.toBeDefined()
    })

    it('removes saved flag', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const page = await Page.get('/test-page', db)
      const actual = page.export()
      await testUtils.resetTables(db)
      expect(actual.saved).not.toBeDefined()
    })

    it('removes saved flag from any files', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.',
        files: { file: testUtils.mockTXT() }
      }
      await Page.create(data, editor, 'Initial text', db)
      const page = await Page.get('/test-page', db)
      const ex = page.export()
      const actual = ex && ex.files && Array.isArray(ex.files) && ex.files.length > 0
        ? ex.files.map(file => file.saved === undefined).reduce((acc, curr) => acc && curr, true)
        : false
      await FileHandler.remove(ex.files[0].name, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(true)
    })

    it('removes page ID from any files', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.',
        files: { file: testUtils.mockTXT() }
      }
      await Page.create(data, editor, 'Initial text', db)
      const page = await Page.get('/test-page', db)
      const ex = page.export()
      const actual = ex && ex.files && Array.isArray(ex.files) && ex.files.length > 0
        ? ex.files.map(file => file.page === undefined).reduce((acc, curr) => acc && curr, true)
        : false
      await FileHandler.remove(ex.files[0].name, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(true)
    })

    it('applies the same rules to pages in its lineage', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const root = await Page.create({ title: 'Root', body: 'This is the root page.' }, editor, 'Initial text', db)
      await Page.create({ title: 'Child Page', body: 'This is a child page.', parent: root.id }, editor, 'Initial text', db)
      const page = await Page.get('/root/child-page', db)
      const actual = page.export()
      await testUtils.resetTables(db)
      expect(actual.lineage).toHaveLength(1)
      expect(actual.lineage[0].saved).not.toBeDefined()
      expect(actual.lineage[0].owner.email).not.toBeDefined()
    })

    it('removes history, likes, and files from pages in its lineage', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const root = await Page.create({ title: 'Root', body: 'This is the root page.' }, editor, 'Initial text', db)
      await Page.create({ title: 'Child Page', body: 'This is a child page.', parent: root.id }, editor, 'Initial text', db)
      const page = await Page.get('/root/child-page', db)
      const actual = page.export()
      await testUtils.resetTables(db)
      expect(actual.lineage).toHaveLength(1)
      expect(actual.lineage[0].history).not.toBeDefined()
      expect(actual.lineage[0].files).not.toBeDefined()
      expect(actual.lineage[0].likes).not.toBeDefined()
    })

    it('removes lineage from pages in its lineage', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const root = await Page.create({ title: 'Root', body: 'This is the root page.' }, editor, 'Initial text', db)
      await Page.create({ title: 'Child Page', body: 'This is a child page.', parent: root.id }, editor, 'Initial text', db)
      const page = await Page.get('/root/child-page', db)
      const actual = page.export()
      await testUtils.resetTables(db)
      expect(actual.lineage).toHaveLength(1)
      expect(actual.lineage[0].lineage).not.toBeDefined()
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

    it('won\'t save a page with a reserved path', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const page = new Page()
      try {
        await page.save({ title: 'Dashboard', body: 'This is a test.' }, editor, 'Initial text', db)
        expect(false).toEqual(true)
      } catch (err) {
        await testUtils.resetTables(db)
        expect(err.message).toEqual('We reserve /dashboard for internal use.')
      }
    })

    it('won\'t save a template with a reserved name', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const page = new Page()
      try {
        await page.save({ title: 'Gallery', body: 'This is a test.', type: 'Template' }, editor, 'Initial text', db)
        expect(false).toEqual(true)
      } catch (err) {
        await testUtils.resetTables(db)
        expect(err.message).toEqual('We use {{Gallery}} internally. You cannot create a template with that name.')
      }
    })

    it('won\'t save a page with a path that ends in a numerical element', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const page = new Page()
      try {
        await page.save({ title: 'Test Page', body: 'This is a test.', path: '/01' }, editor, 'Initial text', db)
        expect(false).toEqual(true)
      } catch (err) {
        await testUtils.resetTables(db)
        expect(err.message).toEqual('Please don’t end a path with a number. That makes it difficult for the system to tell the difference between pages and versions of pages.')
      }
    })

    it('won\'t save a page with a path identical to another', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const page = new Page()
      try {
        await page.save({ title: 'Test Page', body: 'This is a test.' }, editor, 'Initial text', db)
        expect(false).toEqual(true)
      } catch (err) {
        await testUtils.resetTables(db)
        expect(err.message).toEqual(`Sorry, that won&rsquo;t work. A page with the path <code>/test-page</code> already exists.`)
      }
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

    it('won\'t let you update a page to use a reserved path', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const page = await Page.get('/test-page', db)
      try {
        await page.save({ body: 'This is a test', path: '/dashboard' }, editor, 'Test update', db)
        await testUtils.resetTables(db)
        expect(false).toEqual(true)
      } catch (err) {
        await testUtils.resetTables(db)
        expect(err.message).toEqual('We reserve /dashboard for internal use.')
      }
    })

    it('won\'t let you update a page to be a reserved template', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const page = await Page.get('/test-page', db)
      try {
        await page.save({ title: 'Gallery', body: 'This is a test', type: 'Template' }, editor, 'Test update', db)
        await testUtils.resetTables(db)
        expect(false).toEqual(true)
      } catch (err) {
        await testUtils.resetTables(db)
        expect(err.message).toEqual('We use {{Gallery}} internally. You cannot create a template with that name.')
      }
    })

    it('won\'t let you update a page to use a path with a number as the final element', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const page = await Page.get('/test-page', db)
      try {
        await page.save({ body: 'This is a test', path: '/01' }, editor, 'Test update', db)
        await testUtils.resetTables(db)
        expect(false).toEqual(true)
      } catch (err) {
        await testUtils.resetTables(db)
        expect(err.message).toEqual('Please don’t end a path with a number. That makes it difficult for the system to tell the difference between pages and versions of pages.')
      }
    })

    it('won\'t let you update a page to have a path identical to another', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const page = await Page.create({ title: 'New Page', body: 'This is a test.' }, editor, 'Initial Text', db)
      try {
        await page.save({ title: 'Test Page', body: 'This is a test.' }, editor, 'Update that should not work', db)
        expect(false).toEqual(true)
      } catch (err) {
        await testUtils.resetTables(db)
        expect(err.message).toEqual('Sorry, that won&rsquo;t work. A page with the path <code>/test-page</code> already exists.')
      }
    })

    it('won\'t let you update a page to have a path that ends in a numerical element', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const page = await Page.get('/test-page', db)
      try {
        await page.save({ title: 'Test Page', body: 'This is a test.', path: '/07' }, editor, 'Update that should not work', db)
        expect(false).toEqual(true)
      } catch (err) {
        await testUtils.resetTables(db)
        expect(err.message).toEqual('Please don’t end a path with a number. That makes it difficult for the system to tell the difference between pages and versions of pages.')
      }
    })

    it('keeps an art page\'s implicit type', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.',
        files: { file: testUtils.mockTXT() }
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      await page.save({ body: 'This is an updated body.' }, editor, 'Test update', db)
      const file = page && page.files && page.files.length > 0 ? page.files[0] : null
      await FileHandler.remove(file.name, db)
      await testUtils.resetTables(db)
      expect(page.type).toEqual('File')
    })

    it('saves a page\'s link', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test. [[Link]]'
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      const actual = await db.run('SELECT * FROM links;')
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].src).toEqual(page.id)
      expect(actual[0].dest).toEqual(null)
      expect(actual[0].title).toEqual('Link')
    })

    it('saves a page\'s tags', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test. [[Hello:World]]'
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      const actual = await db.run('SELECT * FROM tags;')
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].page).toEqual(page.id)
      expect(actual[0].tag).toEqual('hello')
      expect(actual[0].value).toEqual('World')
    })

    it('saves a page\'s templates', async () => {
      expect.assertions(11)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test. {{TestTemplate param1="Hello world!" param2="42"}}'
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      const actual = await db.run('SELECT * FROM templates;')
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(2)
      expect(actual[0].page).toEqual(page.id)
      expect(actual[0].template).toEqual('TestTemplate')
      expect(actual[0].instance).toEqual(0)
      expect(actual[0].parameter).toEqual('param1')
      expect(actual[0].value).toEqual('Hello world!')
      expect(actual[1].page).toEqual(page.id)
      expect(actual[1].template).toEqual('TestTemplate')
      expect(actual[1].instance).toEqual(0)
      expect(actual[1].parameter).toEqual('param2')
      expect(actual[1].value).toEqual('42')
    })

    it('adds a slash to the path if you didn\'t', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const page = new Page()
      await page.save({ title: 'Test Page', body: 'This is a test.', path: 'test' }, editor, 'Initial text', db)
      const pagesCheck = await db.run(`SELECT path FROM pages WHERE id=${page.id};`)
      await testUtils.resetTables(db)
      expect(page.path).toEqual('/test')
      expect(pagesCheck[0].path).toEqual(page.path)
    })
  })

  describe('rollback', () => {
    it('rolls back to an old version', async () => {
      expect.assertions(2)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const page = await Page.get('/test-page', db)
      await page.save({ body: 'This is an updated body.' }, editor, 'Test update', db)
      await page.rollback(1, editor, db)
      await testUtils.resetTables(db)
      expect(page.history.getBody()).toEqual('This is a test page.')
      expect(page.history.changes.length).toEqual(3)
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

    it('has a LikesHandler', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: 'This is a test. [[Test Link]]' }
      const page = await Page.create(data, editor, 'Initial text', db)
      await testUtils.resetTables(db)
      expect(page.likes).toBeInstanceOf(LikesHandler)
      expect(page.likes.id).toEqual(page.id)
      expect(page.likes.path).toEqual(page.path)
      expect(page.likes.ids).toEqual([])
    })

    it('uploads a file', async () => {
      expect.assertions(5)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.',
        files: { file: testUtils.mockTXT() }
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = page && page.files && page.files.length > 0 ? page.files[0] : null
      const url = file ? FileHandler.getURL(file.name) : null
      const check = url ? await testUtils.checkURL(url) : { status: null }
      await FileHandler.remove(file.name, db)
      await testUtils.resetTables(db)
      expect(page.files).toHaveLength(1)
      expect(page.files[0].mime).toEqual('text/plain')
      expect(page.files[0].urls.full.startsWith(`https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/uploads/test.`)).toEqual(true)
      expect(page.files[0].readableSize).toEqual('13 B')
      expect([ 200, 500 ]).toContain(check.status)
    })

    it('creates a thumbnail', async () => {
      expect.assertions(5)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.',
        files: { file: testUtils.mockJPEG() }
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = page && page.files && page.files.length > 0 ? page.files[0] : null
      const fileURL = file ? FileHandler.getURL(file.name) : null
      const thumbURL = file ? FileHandler.getURL(file.thumbnail) : null
      const checkFile = fileURL ? await testUtils.checkURL(fileURL) : { status: null }
      const checkThumb = thumbURL ? await testUtils.checkURL(thumbURL) : { status: null }
      await FileHandler.remove(file.name, db)
      await testUtils.resetTables(db)
      expect(page.files).toHaveLength(1)
      expect(file.thumbnail).toContain('test.thumb')
      expect(file.mime).toEqual('image/jpeg')
      expect([ 200, 500 ]).toContain(checkFile.status)
      expect([ 200, 500 ]).toContain(checkThumb.status)
    })

    it('can take a thumbnail', async () => {
      expect.assertions(6)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.',
        files: {
          file: testUtils.mockJPEG(),
          thumbnail: testUtils.mockGIF()
        }
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = page && page.files && page.files.length > 0 ? page.files[0] : null
      const fileURL = file ? FileHandler.getURL(file.name) : null
      const thumbURL = file ? FileHandler.getURL(file.thumbnail) : null
      const checkFile = fileURL ? await testUtils.checkURL(fileURL) : { status: null }
      const checkThumb = thumbURL ? await testUtils.checkURL(thumbURL) : { status: null }
      await FileHandler.remove(file.name, db)
      await testUtils.resetTables(db)

      expect(page.files).toHaveLength(1)
      expect(file.thumbnail).toContain('test.thumb')
      expect(file.thumbnail.substr(file.thumbnail.length - 4)).toEqual('.gif')
      expect(file.mime).toEqual('image/jpeg')
      expect([ 200, 500 ]).toContain(checkFile.status)
      expect([ 200, 500 ]).toContain(checkThumb.status)
    })

    it('assigns type \'Art\' if it has an image and no other type', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.',
        files: { file: testUtils.mockJPEG() }
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = page && page.files && page.files.length > 0 ? page.files[0] : null
      const url = file ? FileHandler.getURL(file.name) : null
      const check = url ? await testUtils.checkURL(url) : { status: null }
      await FileHandler.remove(file.name, db)
      await testUtils.resetTables(db)
      expect(page.type).toEqual('Art')
      expect([ 200, 500 ]).toContain(check.status)
    })

    it('assigns type \'File\' if it doesn\'t have an image and it has no other type', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = {
        title: 'Test page',
        body: 'This is a test.',
        files: { file: testUtils.mockTXT() }
      }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = page && page.files && page.files.length > 0 ? page.files[0] : null
      const url = file ? FileHandler.getURL(file.name) : null
      const check = url ? await testUtils.checkURL(url) : { status: null }
      await FileHandler.remove(file.name, db)
      await testUtils.resetTables(db)
      expect(page.type).toEqual('File')
      expect([ 200, 500 ]).toContain(check.status)
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

    it('loads the page\'s tags', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '[[Tag1: Test]] [[Tag2: Hello world!]] [[Tag3: Something]] [[Tag3: Else]]' }
      await Page.create(data, editor, 'Initial text', db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db)
      expect(page.tags.tag1).toEqual([ 'Test' ])
      expect(page.tags.tag2).toEqual([ 'Hello world!' ])
      expect(page.tags.tag3).toEqual([ 'Something', 'Else' ])
    })

    it('loads the page\'s templates', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{TestTemplate param1="Hello world!"}} {{TestTemplate param1="42"}} {{TestTemplate2}}' }
      await Page.create(data, editor, 'Initial text', db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db)
      expect(page.templates.instances.TestTemplate).toHaveLength(2)
      expect(page.templates.instances.TestTemplate[0].param1).toEqual('Hello world!')
      expect(page.templates.instances.TestTemplate[1].param1).toEqual('42')
      expect(page.templates.instances.TestTemplate2).toEqual([{}])
    })

    it('loads the page\'s likes', async () => {
      expect.assertions(2)
      const before = await testUtils.createTestPage(Page, Member, db)
      const member = await Member.load(2, db)
      await before.likes.add(member.id, db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db)
      expect(page.likes.ids).toHaveLength(1)
      expect(page.likes.ids).toContain(member.id)
    })

    it('loads the page\'s files', async () => {
      expect.assertions(3)
      const before = await testUtils.createTestPage(Page, Member, db)
      const member = await Member.load(2, db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: before.id, uploader: member.id }
      const h1 = new FileHandler(file); await h1.save(db)
      const h2 = new FileHandler(file); await h2.save(db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db)
      expect(page.files).toHaveLength(2)
      expect(page.files[0].name).toEqual(file.name)
      expect(page.files[1].name).toEqual(file.name)
    })

    it('loads the page\'s lineage', async () => {
      expect.assertions(3)
      const grandparent = await testUtils.createTestPage(Page, Member, db)
      const member = await Member.load(2, db)
      const parent = await Page.create({ title: 'Parent', body: 'This is the parent.', parent: grandparent.path }, member, 'Initial text', db)
      const child = await Page.create({ title: 'Child', body: 'This is the child.', parent: parent.path }, member, 'Initial text', db)
      const page = await Page.get(child.path, db)
      await testUtils.resetTables(db)
      expect(page.lineage).toHaveLength(2)
      expect(page.lineage[0].id).toEqual(grandparent.id)
      expect(page.lineage[1].id).toEqual(parent.id)
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
      const other = await Member.load(3, db)
      const parent = await Page.create({ title: 'Parent', body: 'This is the parent.' }, editor, 'Initial text', db)
      await Page.create({ title: 'Child', body: 'This is the child.', parent: parent.id }, editor, 'Initial text', db)
      await Page.create({ title: 'Hidden child', body: 'This one is hidden', parent: parent.id, permissions: 700 }, editor, 'Initial text', db)
      const children = await Page.getChildrenOf(parent, { member: other }, db)
      await testUtils.resetTables(db)
      expect(children).toHaveLength(1)
      expect(children[0].title).toEqual('Child')
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
      const children = await Page.getChildrenOf(parent, { type: 'Test', member: editor }, db)
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
    it('returns an empty array if not given a query', async () => {
      expect.assertions(1)
      const found = await Page.find({}, null, db)
      expect(found).toHaveLength(0)
    })

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

    it('returns pages that have a given tag', async () => {
      expect.assertions(2)
      const t1 = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const t2 = await Page.create({ title: 'Child Page', body: 'Child page. [[Test: true]]', parent: t1.id }, editor, 'Initial text', db)
      const found = await Page.find({ hasTags: [ 'Test' ] }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual).toContain(t2.id)
    })

    it('returns pages in alphabetical order by default', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const t1 = await Page.create({ title: 'Banana', body: 'This is a page about bananas. [[Type:Food]]' }, editor, 'Initial text', db)
      const t2 = await Page.create({ title: 'Cocoa', body: 'This is a page about coca. [[Type:Food]]' }, editor, 'Initial text', db)
      const t3 = await Page.create({ title: 'Apple', body: 'This is a page about apples. [[Type:Food]]' }, editor, 'Initial text', db)
      const found = await Page.find({ type: 'Food' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(found).toHaveLength(3)
      expect(actual).toEqual([ t3.id, t1.id, t2.id ])
    })

    it('can return pages in reverse alphabetical order', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const t1 = await Page.create({ title: 'Banana', body: 'This is a page about bananas. [[Type:Food]]' }, editor, 'Initial text', db)
      const t2 = await Page.create({ title: 'Cocoa', body: 'This is a page about coca. [[Type:Food]]' }, editor, 'Initial text', db)
      const t3 = await Page.create({ title: 'Apple', body: 'This is a page about apples. [[Type:Food]]' }, editor, 'Initial text', db)
      const found = await Page.find({ type: 'Food', order: 'reverse alphabetical' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(found).toHaveLength(3)
      expect(actual).toEqual([ t2.id, t1.id, t3.id ])
    })

    it('can return pages from first created to last', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const t1 = await Page.create({ title: 'Banana', body: 'This is a page about bananas. [[Type:Food]]' }, editor, 'Initial text', db)
      const t2 = await Page.create({ title: 'Cocoa', body: 'This is a page about coca. [[Type:Food]]' }, editor, 'Initial text', db)
      const t3 = await Page.create({ title: 'Apple', body: 'This is a page about apples. [[Type:Food]]' }, editor, 'Initial text', db)
      const found = await Page.find({ type: 'Food', order: 'first created' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(found).toHaveLength(3)
      expect(actual).toEqual([ t1.id, t2.id, t3.id ])
    })

    it('can return pages from last created to first', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const t1 = await Page.create({ title: 'Banana', body: 'This is a page about bananas. [[Type:Food]]' }, editor, 'Initial text', db)
      await new Promise((r) => setTimeout(r, 1000))
      const t2 = await Page.create({ title: 'Cocoa', body: 'This is a page about coca. [[Type:Food]]' }, editor, 'Initial text', db)
      await new Promise((r) => setTimeout(r, 1000))
      const t3 = await Page.create({ title: 'Apple', body: 'This is a page about apples. [[Type:Food]]' }, editor, 'Initial text', db)
      const found = await Page.find({ type: 'Food', order: 'last created' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(found).toHaveLength(3)
      expect(actual).toEqual([ t3.id, t2.id, t1.id ])
    })

    it('can return pages in order of last updated', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const t1 = await Page.create({ title: 'Banana', body: 'This is a page about bananas. [[Type:Food]]' }, editor, 'Initial text', db)
      await new Promise((r) => setTimeout(r, 1000))
      const t2 = await Page.create({ title: 'Cocoa', body: 'This is a page about coca. [[Type:Food]]' }, editor, 'Initial text', db)
      await new Promise((r) => setTimeout(r, 1000))
      const t3 = await Page.create({ title: 'Apple', body: 'This is a page about apples. [[Type:Food]]' }, editor, 'Initial text', db)
      await new Promise((r) => setTimeout(r, 1000))
      await t2.save({ body: 'This is an updated body.' }, editor, 'Test update', db)
      const found = await Page.find({ type: 'Food', order: 'most recent update' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(found).toHaveLength(3)
      expect(actual).toEqual([ t2.id, t3.id, t1.id ])
    })

    it('can return pages in order of longest since last updated', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const t1 = await Page.create({ title: 'Banana', body: 'This is a page about bananas. [[Type:Food]]' }, editor, 'Initial text', db)
      await new Promise((r) => setTimeout(r, 1000))
      const t2 = await Page.create({ title: 'Cocoa', body: 'This is a page about coca. [[Type:Food]]' }, editor, 'Initial text', db)
      await new Promise((r) => setTimeout(r, 1000))
      const t3 = await Page.create({ title: 'Apple', body: 'This is a page about apples. [[Type:Food]]' }, editor, 'Initial text', db)
      await new Promise((r) => setTimeout(r, 1000))
      await t2.save({ body: 'This is an updated body.' }, editor, 'Test update', db)
      const found = await Page.find({ type: 'Food', order: 'oldest update' }, null, db)
      const actual = found.map(p => p.id)
      await testUtils.resetTables(db)
      expect(found).toHaveLength(3)
      expect(actual).toEqual([ t1.id, t3.id, t2.id ])
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

  describe('getUpdates', () => {
    it('returns an array of recent updates', async () => {
      expect.assertions(5)
      await testUtils.createTestPage(Page, Member, db)
      const actual = await Page.getUpdates(10, { id: 3, admin: false }, db)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].title).toEqual('Test Page')
      expect(actual[0].path).toEqual('/test-page')
      expect(actual[0].timestamp).not.toBeNaN()
      expect(actual[0].editor).toEqual({ id: 2, name: 'Normal' })
    })

    it('returns the most recent updates at the front of the array', async () => {
      expect.assertions(3)
      const p1 = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'New Page', body: 'This is a new page.' }, editor, 'Initial text', db)
      await p1.save({ title: 'Updated Page', body: 'This is an updated body.' }, editor, 'Test update', db)
      const actual = await Page.getUpdates(10, { id: 3, admin: false }, db)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(2)
      expect(actual[0].title).toEqual('Updated Page')
      expect(actual[1].title).toEqual('New Page')
    })

    it('can handle a null user', async () => {
      expect.assertions(5)
      await testUtils.createTestPage(Page, Member, db)
      const actual = await Page.getUpdates(10, null, db)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].title).toEqual('Test Page')
      expect(actual[0].path).toEqual('/test-page')
      expect(actual[0].timestamp).not.toBeNaN()
      expect(actual[0].editor).toEqual({ id: 2, name: 'Normal' })
    })

    it('returns a maximum of the number given', async () => {
      expect.assertions(2)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'New Page', body: 'This is a new page.' }, editor, 'Initial text', db)
      const actual = await Page.getUpdates(1, { id: 3, admin: false }, db)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].title).toEqual('New Page')
    })

    it('does not return pages you don\'t have permission to see', async () => {
      expect.assertions(1)
      const p1 = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      await p1.save({ title: 'Updated Page', body: 'This is an updated body.', permissions: 444 }, editor, 'Test update', db)
      const actual = await Page.getUpdates(10, { id: 3, admin: false }, db)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(0)
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

  describe('hasNumericalLastElement', () => {
    it('returns true if given a numerical path', () => {
      expect(Page.hasNumericalLastElement('/1')).toEqual(true)
    })

    it('returns true if given a path that ends with a number', () => {
      expect(Page.hasNumericalLastElement('/path/to/test/parent/01')).toEqual(true)
    })

    it('returns false if given a path that does not end with a number', () => {
      expect(Page.hasNumericalLastElement('/path/to/test/parent')).toEqual(false)
    })

    it('returns false if given a path that ends with an element that only uses numbers', () => {
      expect(Page.hasNumericalLastElement('/path/to/test/x01')).toEqual(false)
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
