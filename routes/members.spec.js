/* global describe, it, expect, beforeAll, beforeEach, afterEach, afterAll */

const supertest = require('supertest')
const Member = require('../models/member')
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

  describe('PATCH /members/:id', () => {
    it('returns 200', async () => {
      expect.assertions(1)
      const res = await request.patch('/members/2').auth('normal@thefifthworld.com', 'password')
      expect(res.status).toEqual(200)
    })

    it('updates the member\'s data', async () => {
      expect.assertions(1)
      const updates = { bio: 'New bio' }
      await request.patch('/members/2').auth('normal@thefifthworld.com', 'password').send(updates)
      const acct = await Member.load(2, db)
      expect(acct.bio).toEqual(updates.bio)
    })

    it('returns the member\'s data', async () => {
      expect.assertions(5)
      const updates = { bio: 'New bio' }
      const res = await request.patch('/members/2').auth('normal@thefifthworld.com', 'password').send(updates)
      expect(res.body.id).toEqual(2)
      expect(res.body.email).toEqual('normal@thefifthworld.com')
      expect(res.body.active).toEqual(true)
      expect(res.body.admin).toEqual(false)
      expect(res.body.bio).toEqual(updates.bio)
    })

    it('won\'t let you update someone else\'s account', async () => {
      expect.assertions(1)
      const res = await request.patch('/members/2').auth('other@thefifthworld.com', 'password')
      expect(res.status).toEqual(401)
    })

    it('lets an admin update someone else\'s account', async () => {
      expect.assertions(1)
      const res = await request.patch('/members/2').auth('admin@thefifthworld.com', 'password')
      expect(res.status).toEqual(200)
    })
  })

  describe('PATCH /members/:id/deactivate', () => {
    it('returns 200', async () => {
      expect.assertions(1)
      const res = await request.patch('/members/2/deactivate').auth('admin@thefifthworld.com', 'password')
      expect(res.status).toEqual(200)
    })

    it('sets the user\'s active flag to false', async () => {
      expect.assertions(1)
      await request.patch('/members/2/deactivate').auth('admin@thefifthworld.com', 'password')
      const acct = await Member.load(2, db)
      expect(acct.active).toEqual(false)
    })

    it('returns 401 if you\'re not an admin', async () => {
      expect.assertions(1)
      const res = await request.patch('/members/2/deactivate').auth('other@thefifthworld.com', 'password')
      expect(res.status).toEqual(401)
    })

    it('returns 401 even if you try to deactivate yourself', async () => {
      expect.assertions(1)
      const res = await request.patch('/members/2/deactivate').auth('normal@thefifthworld.com', 'password')
      expect(res.status).toEqual(401)
    })
  })
})
