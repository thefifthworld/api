/* global describe, it, expect, afterAll */

const db = require('../db')
const testUtils = require('../test-utils')

const History = require('./history')
const Member = require('./member')
const Page = require('./page')

describe('History', () => {
  afterAll(() => { db.end() })

  describe('constructor', () => {
    it('saves changes', () => {
      const changes = [
        { id: 1, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{}', editorName: 'Tester', editorID: 1 },
      ]
      const actual = new History(changes)
      expect(actual.changes[0].id).toEqual(changes[0].id)
      expect(actual.changes[0].timestamp).toEqual(new Date(changes[0].timestamp * 1000))
      expect(actual.changes[0].msg).toEqual(changes[0].msg)
      expect(actual.changes[0].content).toEqual(JSON.parse(changes[0].json))
      expect(actual.changes[0].editor.name).toEqual(changes[0].editorName)
      expect(actual.changes[0].editor.id).toEqual(changes[0].editorID)
    })
  })

  describe('getContent', () => {
    it('returns the most recent content', () => {
      const changes = [
        { id: 1, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{ "test": false }', editorName: 'Tester', editorID: 1 },
        { id: 2, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{ "test": true }', editorName: 'Tester', editorID: 1 }
      ]
      const history = new History(changes)
      const actual = history.getContent()
      expect(actual.test).toEqual(true)
    })
  })

  describe('getBody', () => {
    it('returns the most recent body of the page', () => {
      const changes = [
        { id: 1, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{ "body": "First it was this." }', editorName: 'Tester', editorID: 1 },
        { id: 2, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{ "body": "And then it was this." }', editorName: 'Tester', editorID: 1 }
      ]
      const history = new History(changes)
      const actual = history.getBody()
      expect(actual).toEqual('And then it was this.')
    })
  })

  describe('getChange', () => {
    it('returns the requested change', () => {
      const changes = [
        { id: 1, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{ "body": "First it was this." }', editorName: 'Tester', editorID: 1 },
        { id: 2, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{ "body": "And then it was this." }', editorName: 'Tester', editorID: 1 }
      ]
      const history = new History(changes)
      const actual = history.getChange(1)
      expect(actual.id).toEqual(1)
      expect(actual.content.body).toEqual('First it was this.')
    })

    it('returns null if you ask for something that isn\'t there', () => {
      const changes = [
        { id: 1, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{ "body": "First it was this." }', editorName: 'Tester', editorID: 1 },
        { id: 2, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{ "body": "And then it was this." }', editorName: 'Tester', editorID: 1 }
      ]
      const history = new History(changes)
      const actual = history.getChange(3)
      expect(actual).toEqual(null)
    })
  })

  describe('addChange', () => {
    it('adds a change', async () => {
      expect.assertions(2)
      const page = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const history = new History([])
      const update = { title: 'Updated page', body: 'This has been updated!' }
      await history.addChange(page.id, editor, 'Test change', update, db)
      const check = await db.run(`SELECT id FROM changes WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(history.changes).toHaveLength(1)
      expect(check).toHaveLength(2)
    })

    it('drops file data', async () => {
      expect.assertions(2)
      const page = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const history = new History([])
      const update = { title: 'Updated page', body: 'This has been updated!', files: { file: { name: 'test.txt', data: 'Hello world!' } } }
      await history.addChange(page.id, editor, 'Test change', update, db)
      const changes = await db.run(`SELECT * FROM changes WHERE page=${page.id};`)
      const after = new History(changes)
      const actual = after.getContent()
      await testUtils.resetTables(db)
      expect(actual.files.file).toBeDefined()
      expect(actual.files.file.data).not.toBeDefined()
    })
  })
})
