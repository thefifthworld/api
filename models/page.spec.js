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
      await testUtils.resetTables(db, 'changes', 'pages', 'members')
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
      await testUtils.resetTables(db, 'changes', 'pages', 'members')
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
      await testUtils.resetTables(db, 'changes', 'pages', 'members')
      expect(page.type).toEqual('Test')
    })

    it('can create a child', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const pdata = { title: 'Parent', body: 'This is the parent.' }
      const cdata = { title: 'Child', body: 'This is the child.' }
      const parent = await Page.create(pdata, editor, 'Initial text', db)
      cdata.parent = parent.path
      const child = await Page.create(cdata, editor, 'Initial text', db)
      await testUtils.resetTables(db, 'changes', 'pages', 'members')
      expect(child.parent).toEqual(parent.id)
      expect(child.depth).toEqual(1)
    })

    it('saves tags', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: 'This is a test. [[Tag:Test]]' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const rows = await db.run(`SELECT * FROM tags WHERE page=${page.id};`)
      await testUtils.resetTables(db, 'tags', 'changes', 'pages', 'members')
      expect(rows).toHaveLength(1)
      expect(rows[0].tag).toEqual('tag')
      expect(rows[0].value).toEqual('Test')
    })
  })

  describe('get', () => {
    it('fetches a page from the database', async () => {
      expect.assertions(7)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test page',  body: 'This is a test.' }
      await Page.create(data, editor, 'Initial text', db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db, 'tags', 'changes', 'pages', 'members')

      expect(page).toBeInstanceOf(Page)
      expect(page.title).toEqual(data.title)
      expect(page.changes).toHaveLength(1)
      expect(page.changes[0].editor.id).toEqual(2)
      expect(page.changes[0].editor.name).toEqual('Normal')
      expect(page.changes[0].msg).toEqual('Initial text')
      expect(page.changes[0].content.body).toEqual(data.body)
    })

    it('can fetch by path', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test page',  body: 'This is a test.' }
      await Page.create(data, editor, 'Initial text', db)
      const page = await Page.get('/test-page', db)
      await testUtils.resetTables(db, 'tags', 'changes', 'pages', 'members')
      expect(page).toBeInstanceOf(Page)
      expect(page.title).toEqual(data.title)
    })

    it('loads the page\'s tags', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test page',  body: 'This is a test. [[Test:Hello]] [[Test:World]]' }
      await Page.create(data, editor, 'Initial text', db)
      const page = await Page.get(1, db)
      await testUtils.resetTables(db, 'tags', 'changes', 'pages', 'members')
      expect(page.tags.test).toEqual([ 'Hello', 'World' ])
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
