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
