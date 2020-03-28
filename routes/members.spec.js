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

  describe('GET /members/:id/messages', () => {
    it('returns a 401 if you\'re not logged in', async () => {
      expect.assertions(1)
      const res = await request.get('/members/2/messages')
      expect(res.status).toEqual(401)
    })

    it('returns your messages', async () => {
      expect.assertions(2)
      const msg = 'Test message'
      const normal = await Member.load(2, db)
      await normal.logMessage('info', msg, db)
      const res = await request.get('/members/2/messages').auth('normal@thefifthworld.com', 'password')
      expect(res.status).toEqual(200)
      expect(res.body.info).toEqual([ msg ])
    })
  })

  describe('GET /members/:id/invited', () => {
    it('returns 401 if you\'re not logged in', async () => {
      expect.assertions(1)
      const res = await request.get('/members/2/invited')
      expect(res.status).toEqual(401)
    })

    it('returns members you\'ve invited', async () => {
      expect.assertions(10)
      const normal = await Member.load(2, db)
      const emails = [ 'one@thefifthworld.com', 'two@thefifthworld.com' ]
      await normal.sendInvitations(emails, () => {}, db)
      const res = await request.get('/members/2/invited').auth('normal@thefifthworld.com', 'password')

      expect(res.status).toEqual(200)
      expect(res.body).toHaveLength(2)
      expect(res.body[0].id).not.toBeNaN()
      expect(res.body[0].links).toEqual({})
      expect(res.body[0].admin).toEqual(false)
      expect(res.body[0].accepted).toEqual(false)
      expect(res.body[1].id).not.toBeNaN()
      expect(res.body[1].links).toEqual({})
      expect(res.body[1].admin).toEqual(false)
      expect(res.body[1].accepted).toEqual(false)
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

  describe('PATCH /members/:id/reactivate', () => {
    it('returns 200', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const normal = await Member.load(2, db)
      await normal.deactivate(admin, db)

      const res = await request.patch('/members/2/reactivate').auth('admin@thefifthworld.com', 'password')
      expect(res.status).toEqual(200)
    })

    it('sets the user\'s active flag to true', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const normal = await Member.load(2, db)
      await normal.deactivate(admin, db)

      await request.patch('/members/2/reactivate').auth('admin@thefifthworld.com', 'password')
      const acct = await Member.load(2, db)
      expect(acct.active).toEqual(true)
    })

    it('returns 401 if you\'re not an admin', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const normal = await Member.load(2, db)
      await normal.deactivate(admin, db)

      const res = await request.patch('/members/2/reactivate').auth('other@thefifthworld.com', 'password')
      expect(res.status).toEqual(401)
    })

    it('returns 401 even if you try to deactivate yourself', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const normal = await Member.load(2, db)
      await normal.deactivate(admin, db)

      const res = await request.patch('/members/2/reactivate').auth('normal@thefifthworld.com', 'password')
      expect(res.status).toEqual(401)
    })
  })

  describe('POST /invitations/send', () => {
    it('returns 401 if you\'re not logged in', async () => {
      const res = await request.post('/invitations/send')
      expect(res.status).toEqual(401)
    })

    it('returns the emails you tried to invite and your messages', async () => {
      expect.assertions(3)
      const invites = { emails: [ 'invited1@thefifthworld.com', 'invited2@thefifthworld.com' ], test: true }
      const res = await request.post('/invitations/send').auth('normal@thefifthworld.com', 'password').send(invites)
      expect(res.status).toEqual(200)
      expect(res.body.emails).toEqual(invites.emails)
      expect(res.body.messages.confirmation).toHaveLength(2)
    })
  })
})
