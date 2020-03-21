/* global describe, it, expect, afterAll */

const request = require('supertest')
const db = require('./db')
const api = require('./api')
const testUtils = require('./test-utils')

describe('API', () => {
  describe('GET /', () => {
    it('should return 200', async () => {
      const res = await request(api).get('/')
      expect(res.status).toEqual(200)
    })

    it('should provide the number of pages', async () => {
      const res = await request(api).get('/')
      expect(res.body.pages).not.toBeNaN()
    })
  })

  describe('GET /secure', () => {
    it('returns 401 when you don\'t provide basic auth', async () => {
      const res = await request(api).get('/secure')
      expect(res.status).toEqual(401)
    })

    it('returns 200 when you provide basic auth', async () => {
      await testUtils.populateMembers(db)
      const res = await request(api).get('/secure').auth('admin@thefifthworld.com', 'adminapikey000')
      expect(res.status).toEqual(200)
      await testUtils.resetTables(db, 'members')
    })

    it('returns 401 when you provide basic auth with wrong key', async () => {
      await testUtils.populateMembers(db)
      const res = await request(api).get('/secure').auth('admin@thefifthworld.com', 'nope')
      expect(res.status).toEqual(401)
      await testUtils.resetTables(db, 'members')
    })
  })
})

afterAll(() => {
  db.end()
})
