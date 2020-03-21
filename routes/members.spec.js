/* global describe, it, expect, beforeEach, afterEach, afterAll */

const request = require('supertest')
const db = require('../db')
const api = require('../api')
const testUtils = require('../test-utils')

describe('/members', () => {
  beforeEach(async (done) => {
    await testUtils.populateMembers(db)
    done()
  })

  describe('GET /members/:id', () => {
    it('returns data on a given member', async () => {
      expect.assertions(8)
      const res = await request(api).get('/members/1')
      expect(res.status).toEqual(200)
      expect(res.body.id).toEqual(1)
      expect(res.body.name).toEqual('Admin')
      expect(res.body.email).toEqual('admin@thefifthworld.com')
      expect(res.body.links).toEqual({})
      expect(res.body.active).toEqual(true)
      expect(res.body.admin).toEqual(true)
      expect(res.body.invitations).toEqual(5)
    })

    it('returns 404 if member does not exist', async () => {
      expect.assertions(1)
      const res = await request(api).get('/members/404')
      expect(res.status).toEqual(404)
    })
  })

  afterEach(async (done) => {
    await testUtils.resetTables(db, 'members')
    done()
  })
})

afterAll(() => {
  db.end()
})
