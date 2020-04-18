/* global describe, it, expect, beforeAll, beforeEach, afterEach, afterAll */

const supertest = require('supertest')
const Page = require('../models/page')
const Member = require('../models/member')
const db = require('../db')
const api = require('../api')
const testUtils = require('../test-utils')

describe('Pages API', () => {
  let server = {}
  let request = {}

  beforeAll(async () => { server = await api.listen(8888) })
  beforeEach(async done => {
    request = supertest(server)
    await testUtils.createTestPage(Page, Member, db)
    done()
  })

  afterEach(async done => {
    await testUtils.resetTables(db)
    done()
  })

  afterAll(done => {
    server.close(() => {
      api.closeDB(() => {
        api.close(() => {
          db.close(done)
        })
      })
    })
  })

  describe('POST /pages', () => {
    it('creates a page', async () => {
      expect.assertions(6)
      const data = { title: 'New Page', body: 'This is a new page.', msg: 'Initial text' }
      const res = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send(data)
      const check = await db.run(`SELECT title FROM pages WHERE id=${res.body.id};`)
      expect(res.status).toEqual(200)
      expect(res.body.path).toEqual('/new-page')
      expect(res.body.title).toEqual('New Page')
      expect(res.body.history.changes).toHaveLength(1)
      expect(check).toHaveLength(1)
      expect(check[0].title).toEqual(res.body.title)
    })

    it('returns 401 if you\'re not logged in', async () => {
      expect.assertions(2)
      const data = { title: 'New Page', body: 'This is a new page.', msg: 'Initial text' }
      const res = await request.post('/pages').send(data)
      const check = await db.run(`SELECT title FROM pages WHERE path='/new-page';`)
      expect(res.status).toEqual(401)
      expect(check).toHaveLength(0)
    })
  })

  describe('GET /pages', () => {
    it('returns matching pages', async () => {
      expect.assertions(5)
      const r1 = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      const r2 = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Child Page', body: 'This is the child.', parent: r1.body.id, msg: 'Initial text' })
      const r3 = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Second Page', body: 'This is another page.', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages').send({ path: '/parent-page' })
      const ids = actual.body.map(p => p.id)

      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(2)
      expect(ids).toContain(r1.body.id)
      expect(ids).toContain(r2.body.id)
      expect(ids).not.toContain(r3.body.id)
    })
  })

  describe('POST /pages/*', () => {
    it('updates a page', async () => {
      expect.assertions(9)
      const data = { title: 'Test Page', body: 'This is an update.', msg: 'Testing update' }
      const res = await request.post('/pages/test-page').auth('normal@thefifthworld.com', 'password').send(data)
      const check = await Page.get(res.body.id, db)
      const actual = res && res.body && res.body.history && Array.isArray(res.body.history.changes) && res.body.history.changes[0].content && res.body.history.changes[0].content.body
        ? res.body.history.changes[0].content.body
        : false

      expect(res.status).toEqual(200)
      expect(actual).not.toEqual(false)
      expect(res.body.path).toEqual('/test-page')
      expect(res.body.title).toEqual('Test Page')
      expect(res.body.history.changes).toHaveLength(2)
      expect(actual).toEqual(data.body)
      expect(check).toBeInstanceOf(Page)
      expect(check.history.getBody()).toEqual(data.body)
      expect(check.title).toEqual(res.body.title)
    })

    it('returns 401 if you don\'t have permission', async () => {
      expect.assertions(4)
      await request.post('/pages/test-page').auth('normal@thefifthworld.com', 'password').send({ title: 'Test PAge', body: 'This is a test page.', msg: 'Locking out other editors', permissions: 700 })
      const update = { title: 'Test Page', body: 'This is an update.', msg: 'Locking out other editors' }
      const res = await request.post('/pages/test-page').auth('other@thefifthworld.com', 'password').send(update)
      const check = await Page.get('/test-page', db)
      const actual = res && res.body && res.body.history && Array.isArray(res.body.history.changes) && res.body.history.changes[0].content && res.body.history.changes[0].content.body
        ? res.body.history.changes[0].content.body
        : false

      expect(res.status).toEqual(401)
      expect(actual).not.toEqual(update.body)
      expect(check).toBeInstanceOf(Page)
      expect(check.history.getBody()).not.toEqual(update.body)
    })
  })

  describe('GET /pages/*', () => {
    it('returns 200', async () => {
      expect.assertions(4)
      const res = await request.get('/pages/test-page')
      expect(res.status).toEqual(200)
      expect(res.body.path).toEqual('/test-page')
      expect(res.body.title).toEqual('Test Page')
      expect(res.body.history.changes).toHaveLength(1)
    })

    it('returns 401 if you don\'t have permission', async () => {
      expect.assertions(1)
      const editor = await Member.load(2, db)
      const data = { title: 'New Page', body: 'This is a new page.', permissions: 700 }
      const page = await Page.create(data, editor, 'Initial text', db)
      const res = await request.get(`/pages${page.path}`)
      expect(res.status).toEqual(401)
    })
  })

  describe('GET /near/:lat/:lon/:dist*?', () => {
    it('returns places near a point', async () => {
      expect.assertions(10)
      const point = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'The Point', body: '[[Location:40.441800, -80.012772]]', msg: 'Initial text' })
      const myland = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Three Myland', body: '[[Location:40.154507, -76.724877]]', msg: 'Initial text' })
      const tower = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'The Steel Tower', body: '[[Location:40.441399, -79.994673]]', permissions: 700, msg: 'Initial text' })
      const r1 = await request.get('/near/40.440667/-80.002583')
      const r2 = await request.get('/near/40.440667/-80.002583/400000')
      const distDefault = r1.body.map(p => p.id)
      const dist400km = r2.body.map(p => p.id)

      expect(r1.status).toEqual(200)
      expect(r2.status).toEqual(200)
      expect(distDefault).toHaveLength(1)
      expect(distDefault).toContain(point.body.id)
      expect(distDefault).not.toContain(myland.body.id)
      expect(distDefault).not.toContain(tower.body.id)
      expect(dist400km).toHaveLength(2)
      expect(dist400km).toContain(point.body.id)
      expect(dist400km).toContain(myland.body.id)
      expect(dist400km).not.toContain(tower.body.id)
    })
  })

  describe('GET /requested', () => {
    it('returns requested links', async () => {
      expect.assertions(5)
      await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Test', body: '[[Link One]] [[Link Two]] [[Link Three]]', msg: 'Initial text' })
      const res = await request.get('/requested')

      expect(res.status).toEqual(200)
      expect(res.body).toHaveLength(3)
      expect(res.body[0]).toEqual({ title: 'Link One', links: [ { id: 2, title: 'Test', path: '/test' } ] })
      expect(res.body[1]).toEqual({ title: 'Link Two', links: [ { id: 2, title: 'Test', path: '/test' } ] })
      expect(res.body[2]).toEqual({ title: 'Link Three', links: [ { id: 2, title: 'Test', path: '/test' } ] })
    })
  })
})
