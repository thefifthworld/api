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
})
