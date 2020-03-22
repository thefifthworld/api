/* global describe, it, expect, beforeEach, afterEach, afterAll */

const supertest = require('supertest')
const db = require('../db')
const api = require('../api')
const request = supertest(api)
const testUtils = require('../test-utils')

describe('/members', () => {
  beforeEach(async () => {
    await testUtils.populateMembers(db)
  })

  afterEach(async () => {
    await testUtils.resetTables(db, 'members')
  })

  afterAll(() => {
    db.end()
    api.close()
    request.close()
  })

  describe('GET /members/:id', () => {
    it('returns data on a given member', async () => {
      expect.assertions(5)
      const res = await request.get('/members/1')
      expect(res.status).toEqual(200)
      expect(res.body.id).toEqual(1)
      expect(res.body.name).toEqual('Admin')
      expect(res.body.links).toEqual({})
      expect(res.body.admin).toEqual(true)
    })

    it('doesn\'t show private fields', async () => {
      expect.assertions(4)
      const res = await request.get('/members/1')
      expect(res.password).not.toBeDefined()
      expect(res.email).not.toBeDefined()
      expect(res.invitations).not.toBeDefined()
      expect(res.active).not.toBeDefined()
    })

    it('returns 404 if member does not exist', async () => {
      expect.assertions(1)
      const res = await request.get('/members/404')
      expect(res.status).toEqual(404)
    })

    it('returns 404 if member is not active', async () => {
      expect.assertions(1)
      await db.run('UPDATE members SET active=0 WHERE id=2;')
      const res = await request.get('/members/2')
      expect(res.status).toEqual(404)
    })
  })
})
