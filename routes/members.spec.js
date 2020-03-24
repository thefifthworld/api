/* global describe, it, expect, beforeAll, beforeEach, afterEach, afterAll */

const supertest = require('supertest')
const db = require('../db')
const api = require('../api')
const testUtils = require('../test-utils')

describe('Members API', () => {
  let server = {}
  let request = {}

  beforeAll(async () => { server = await api.listen(8888) })
  beforeEach(async done => {
    request = supertest(server)
    await testUtils.populateMembers(db)
    done()
  })

  afterEach(async done => {
    await testUtils.resetTables(db, 'members')
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

  describe('GET /members/:id', () => {
    it('returns 200', async () => {
      expect.assertions(1)
      const res = await request.get('/members/2')
      expect(res.status).toEqual(200)
    })

    it('returns member data', async () => {
      expect.assertions(2)
      const res = await request.get('/members/2')
      expect(res.body.id).toEqual(2)
      expect(res.body.name).toEqual('Normal')
    })

    it('doesn\'t provide hidden fields', async () => {
      expect.assertions(4)
      const res = await request.get('/members/2')
      expect(res.body.email).not.toBeDefined()
      expect(res.body.password).not.toBeDefined()
      expect(res.body.invitations).not.toBeDefined()
      expect(res.body.active).not.toBeDefined()
    })

    it('returns 404 for a member that does not exist', async () => {
      expect.assertions(1)
      const res = await request.get('/members/404')
      expect(res.status).toEqual(404)
    })

    it('returns 404 for an inactive member', async () => {
      expect.assertions(1)
      await db.run('UPDATE members SET active=0 WHERE id=2;')
      const res = await request.get('/members/2')
      expect(res.status).toEqual(404)
    })
  })
})
