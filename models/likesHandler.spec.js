/* global describe, it, expect, afterAll */

const db = require('../db')
const testUtils = require('../test-utils')

const LikesHandler = require('./likesHandler')
const Member = require('./member')
const Page = require('./page')

describe('LikesHandler', () => {
  afterAll(() => { db.end() })

  describe('constructor', () => {
    it('returns a LikesHandler instance', () => {
      const actual = new LikesHandler()
      expect(actual).toBeInstanceOf(LikesHandler)
    })

    it('can take a Page as an argument', () => {
      const p = new Page()
      p.id = 1; p.path = '/test'; p.title = 'Test'
      const actual = new LikesHandler(p)
      expect(actual.id).toEqual(p.id)
      expect(actual.path).toEqual(p.path)
      expect(actual.title).not.toBeDefined()
    })

    it('can take an array of IDs as an argument', () => {
      const p = new Page()
      p.id = 1; p.path = '/test'; p.title = 'Test'
      const ids = [ 1, 2, 3, 4, 5 ]
      const actual = new LikesHandler(p, ids)
      expect(actual.ids).toEqual(ids)
    })
  })

  describe('add', () => {
    it('adds a like', async () => {
      expect.assertions(5)
      const page = await testUtils.createTestPage(Page, Member, db)
      const likes = new LikesHandler(page)
      await likes.add(1, db)
      const rows = await db.run(`SELECT * FROM likes WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(likes.ids).toEqual([ 1 ])
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toEqual(page.id)
      expect(rows[0].path).toEqual(page.path)
      expect(rows[0].member).toEqual(1)
    })

    it('can take a Member as an argument', async () => {
      expect.assertions(2)
      const page = await testUtils.createTestPage(Page, Member, db)
      const member = await Member.load(3, db)
      const likes = new LikesHandler(page)
      await likes.add(member, db)
      const rows = await db.run(`SELECT * FROM likes WHERE page=${page.id};`)
      await testUtils.resetTables(db)
      expect(likes.ids).toEqual([ member.id ])
      expect(rows[0].member).toEqual(member.id)
    })
  })
})
