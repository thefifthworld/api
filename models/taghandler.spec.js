/* global describe, it, expect, afterAll */

const db = require('../db')
const testUtils = require('../test-utils')

const Member = require('./member')
const Page = require('./page')
const TagHandler = require('./taghandler')

describe('TagHandler', () => {
  afterAll(() => { db.end() })

  describe('constructor', () => {
    it('prepares an object for storing tags', () => {
      const actual = new TagHandler()
      expect(actual.tags).toEqual({})
    })
  })

  describe('add', () => {
    it('adds a tag', () => {
      const actual = new TagHandler()
      actual.add('test', 'hello world')
      expect(actual.tags.test).toEqual([ 'hello world' ])
    })

    it('makes tag all lower-case', () => {
      const actual = new TagHandler()
      actual.add('TeSt', 'hello world')
      expect(actual.tags.test).toEqual([ 'hello world' ])
    })

    it('handles tags with spaces', () => {
      const actual = new TagHandler()
      actual.add('another Test', 'hello world')
      expect(actual.tags['another test']).toEqual([ 'hello world' ])
    })

    it('adds to existing tags', () => {
      const actual = new TagHandler()
      actual.add('test', 'hello')
      actual.add('test', 'world')
      expect(actual.tags.test).toEqual([ 'hello', 'world' ])
    })
  })

  describe('get', () => {
    it('returns the values associated with a tag', () => {
      const actual = new TagHandler()
      actual.add('test', 'hello')
      actual.add('test', 'world')
      expect(actual.get('test')).toEqual([ 'hello', 'world' ])
    })

    it('can return just the last value', () => {
      const actual = new TagHandler()
      actual.add('test', 'hello')
      actual.add('test', 'world')
      expect(actual.get('test', true)).toEqual('world')
    })

    it('returns undefined if the tag doesn\'t exist', () => {
      const actual = new TagHandler()
      actual.add('test', 'hello')
      actual.add('test', 'world')
      expect(actual.get('nope')).toEqual(undefined)
    })
  })

  describe('save', () => {
    it('saves tags to the database', async () => {
      expect.assertions(7)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test', body: 'This is a test.' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const tags = new TagHandler()
      tags.add('test', 'hello')
      tags.add('test', 'world')
      tags.add('num', '3')
      await tags.save(page.id, db)
      const rows = await db.run(`SELECT * FROM tags WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(rows).toHaveLength(3)
      expect(rows[0].tag).toEqual('test')
      expect(rows[0].value).toEqual('hello')
      expect(rows[1].tag).toEqual('test')
      expect(rows[1].value).toEqual('world')
      expect(rows[2].tag).toEqual('num')
      expect(rows[2].value).toEqual('3')
    })

    it('doesn\'t save specially-handled tags', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test', body: 'This is a test.' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const tags = new TagHandler()
      tags.add('type', 'test')
      tags.add('location', 'here')
      await tags.save(page.id, db)
      const rows = await db.run(`SELECT * FROM tags WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(rows).toHaveLength(0)
    })

    it('updates all tags', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test', body: 'This is a test.' }
      const page = await Page.create(data, editor, 'Initial text', db)

      const before = new TagHandler()
      before.add('test', 'hello')
      before.add('test', 'world')
      before.add('num', '3')
      await before.save(page.id, db)

      const after = new TagHandler()
      after.add('test', 'hello')
      await after.save(page.id, db)

      const rows = await db.run(`SELECT * FROM tags WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(rows).toHaveLength(1)
      expect(rows[0].tag).toEqual('test')
      expect(rows[0].value).toEqual('hello')
    })
  })

  describe('load', () => {
    it('loads tags from the database', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test', body: 'This is a test. [[Test:Hello]] [[Test:World]]' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const actual = await TagHandler.load(page.id, db)
      await testUtils.resetTables(db)
      expect(actual).toBeInstanceOf(TagHandler)
      expect(actual.get('test')).toEqual([ 'Hello', 'World' ])
    })
  })
})
