/* global describe, it, expect, beforeAll, beforeEach, afterEach, afterAll */

const supertest = require('supertest')
const jwt = require('jsonwebtoken')
const { escape } = require('sqlstring')
const Member = require('../models/member')
const db = require('../db')
const config = require('../config')
const api = require('../api')
const testUtils = require('../test-utils')

describe('Members API', () => {
  let server = {}
  let request = {}

  beforeAll(async () => { server = await api.listen(8888) })
  beforeEach(async () => {
    request = supertest(server)
    await testUtils.populateMembers(db)
  })

  afterEach(async () => {
    await testUtils.resetTables(db)
  })

  afterAll(() => {
    server.close(() => {
      api.closeDB(() => {
        api.close(() => {
          db.close()
        })
      })
    })
  })

  describe('POST /members/auth', () => {
    it('returns 401 if credentials aren\'t found', async () => {
      expect.assertions(2)
      const res = await request.post('/members/auth').send({ email: 'nope@thefifthworld.com', pass: 'nope' })
      expect(res.status).toEqual(401)
      expect(res.body).toEqual({})
    })

    it('returns 401 if credentials don\'t match', async () => {
      expect.assertions(2)
      const res = await request.post('/members/auth').send({ email: 'normal@thefifthworld.com', pass: 'nope' })
      expect(res.status).toEqual(401)
      expect(res.body).toEqual({})
    })

    it('returns 401 if member is not active', async () => {
      expect.assertions(2)
      const admin = await Member.load(1, db)
      const member = await Member.load(2, db)
      await member.deactivate(admin, db)
      const res = await request.post('/members/auth').send({ email: 'normal@thefifthworld.com', pass: 'nope' })
      expect(res.status).toEqual(401)
      expect(res.body).toEqual({})
    })

    it('returns a JSON Web Token if credentials match', async () => {
      expect.assertions(7)
      const res = await request.post('/members/auth').send({ email: 'normal@thefifthworld.com', pass: 'password' })
      const token = await jwt.verify(res.text, config.jwt.secret)
      expect(res.status).toEqual(200)
      expect(token.id).toEqual(2)
      expect(token.name).toEqual('Normal')
      expect(token.nopass).toEqual(false)
      expect(token.admin).toEqual(false)
      expect(token.iss).toEqual(config.jwt.domain)
      expect(token.sub).toEqual(`${config.jwt.domain}/members/2`)
    })

    it('returns 401 if no such OAuth 2.0 token exists', async () => {
      expect.assertions(2)
      const res = await request.post('/members/auth').send({ provider: 'provider', id: 'id' })
      expect(res.status).toEqual(401)
      expect(res.body).toEqual({})
    })

    it('returns a JSON Web Token if OAuth 2.0 token is found', async () => {
      expect.assertions(7)
      const member = await Member.load(2, db)
      await member.saveAuth('provider', 'id', 'token', db)
      const res = await request.post('/members/auth').send({ provider: 'provider', id: 'id' })
      const token = await jwt.verify(res.text, config.jwt.secret)
      expect(res.status).toEqual(200)
      expect(token.id).toEqual(2)
      expect(token.name).toEqual('Normal')
      expect(token.nopass).toEqual(false)
      expect(token.admin).toEqual(false)
      expect(token.iss).toEqual(config.jwt.domain)
      expect(token.sub).toEqual(`${config.jwt.domain}/members/2`)
    })
  })

  describe('POST /members/reauth', () => {
    it('returns a new JSON Web Token if you have an old one', async () => {
      expect.assertions(7)
      const init = await request.post('/members/auth').send({ email: 'normal@thefifthworld.com', pass: 'password' })
      const res = await request.post('/members/reauth').set('Authorization', `Bearer ${init.text}`)
      const token = await jwt.verify(res.text, config.jwt.secret)
      expect(res.status).toEqual(200)
      expect(token.id).toEqual(2)
      expect(token.name).toEqual('Normal')
      expect(token.nopass).toEqual(false)
      expect(token.admin).toEqual(false)
      expect(token.iss).toEqual(config.jwt.domain)
      expect(token.sub).toEqual(`${config.jwt.domain}/members/2`)
    })

    it('returns a 401 error when you don\'t have a valid JWT', async () => {
      expect.assertions(1)
      const token = jwt.sign({ id: 2, email: 'normal@thefifthworld.com', name: 'Normal' }, 'BADKEY')
      const res = await request.post('/members/reauth').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(401)
    })
  })

  describe('POST /members/providers', () => {
    it('adds an OAuth 2.0 token', async () => {
      expect.assertions(3)
      const login = await request.post('/members/auth').send({ email: 'normal@thefifthworld.com', pass: 'password' })
      const res = await request.post('/members/providers').set('Authorization', `Bearer ${login.text}`).send({ provider: 'provider', id: 'id', token: 'token' })
      const actual = await Member.loadFromAuth('provider', 'id', db)
      expect(res.status).toEqual(200)
      expect(actual).toBeInstanceOf(Member)
      expect(actual.id).toEqual(2)
    })
  })

  describe('GET /members/providers', () => {
    it('returns an empty array if you have no authorizations', async () => {
      expect.assertions(2)
      const normal = await Member.load(2, db)
      const token = normal.generateJWT()
      const res = await request.get('/members/providers').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
      expect(res.body).toEqual([])
    })

    it('returns an array of your authorizations', async () => {
      expect.assertions(2)
      const normal = await Member.load(2, db)
      await normal.saveAuth('provider1', 'id', 'token', db)
      await normal.saveAuth('provider2', 'id', 'token', db)
      await normal.saveAuth('provider3', 'id', 'token', db)
      const token = normal.generateJWT()
      const res = await request.get('/members/providers').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
      expect(res.body).toEqual([ 'provider1', 'provider2', 'provider3' ])
    })

    it('returns 401 if you\'re not logged in', async () => {
      expect.assertions(1)
      const res = await request.get('/members/providers')
      expect(res.status).toEqual(401)
    })
  })

  describe('DELETE /members/providers/:provider', () => {
    it('removes the specified provider', async () => {
      expect.assertions(2)
      const normal = await Member.load(2, db)
      await normal.saveAuth('provider1', 'id', 'token', db)
      await normal.saveAuth('provider2', 'id', 'token', db)
      await normal.saveAuth('provider3', 'id', 'token', db)
      const token = normal.generateJWT()
      const res = await request.delete('/members/providers/provider1').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
      expect(res.body).toEqual([ 'provider2', 'provider3' ])
    })
  })

  describe('GET /members/messages', () => {
    it('returns a 401 if you\'re not logged in', async () => {
      expect.assertions(1)
      const res = await request.get('/members/messages')
      expect(res.status).toEqual(401)
    })

    it('returns your messages', async () => {
      expect.assertions(2)
      const msg = 'Test message'
      const normal = await Member.load(2, db)
      await normal.logMessage('info', msg, db)
      const token = normal.generateJWT()
      const res = await request.get('/members/messages').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
      expect(res.body.info).toEqual([ '<p>Test message</p>\n' ])
    })
  })

  describe('GET /members/invited', () => {
    it('returns 401 if you\'re not logged in', async () => {
      expect.assertions(1)
      const res = await request.get('/members/invited')
      expect(res.status).toEqual(401)
    })

    it('returns members you\'ve invited', async () => {
      expect.assertions(14)
      const normal = await Member.load(2, db)
      const emails = [ 'one@thefifthworld.com', 'two@thefifthworld.com' ]
      await normal.sendInvitations(emails, () => {}, db)
      const token = normal.generateJWT()
      const res = await request.get('/members/invited').set('Authorization', `Bearer ${token}`)

      expect(res.status).toEqual(200)
      expect(res.body).toHaveLength(2)
      expect(res.body[0].id).not.toBeNaN()
      expect(res.body[0].email).toEqual('one@thefifthworld.com')
      expect(res.body[0].links).toEqual({})
      expect(res.body[0].admin).toEqual(false)
      expect(res.body[0].nopass).toEqual(true)
      expect(res.body[0].accepted).toEqual(false)
      expect(res.body[1].id).not.toBeNaN()
      expect(res.body[1].email).toEqual('two@thefifthworld.com')
      expect(res.body[1].links).toEqual({})
      expect(res.body[1].admin).toEqual(false)
      expect(res.body[0].nopass).toEqual(true)
      expect(res.body[1].accepted).toEqual(false)
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

    it('parses a member\'s bio', async () => {
      expect.assertions(2)
      await db.run('UPDATE members SET bio="This is **bold**." WHERE id=2;')
      const res = await request.get('/members/2')
      expect(res.body.bio.markdown).toEqual('This is **bold**.')
      expect(res.body.bio.html).toEqual('<p>This is <strong>bold</strong>.</p>\n')
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
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const res = await request.patch('/members/2').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
    })

    it('updates the member\'s data', async () => {
      expect.assertions(1)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const updates = { bio: 'New bio' }
      await request.patch('/members/2').set('Authorization', `Bearer ${token}`).send(updates)
      const acct = await Member.load(2, db)
      expect(acct.bio).toEqual(updates.bio)
    })

    it('returns the member\'s data', async () => {
      expect.assertions(5)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const updates = { bio: 'New bio' }
      const res = await request.patch('/members/2').set('Authorization', `Bearer ${token}`).send(updates)
      expect(res.body.id).toEqual(2)
      expect(res.body.email).toEqual('normal@thefifthworld.com')
      expect(res.body.active).toEqual(true)
      expect(res.body.admin).toEqual(false)
      expect(res.body.bio).toEqual(updates.bio)
    })

    it('won\'t let you update someone else\'s account', async () => {
      expect.assertions(1)
      const member = await Member.load(3, db)
      const token = member.generateJWT()
      const res = await request.patch('/members/2').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(401)
    })

    it('lets an admin update someone else\'s account', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const token = admin.generateJWT()
      const res = await request.patch('/members/2').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
    })
  })

  describe('GET /members/:id/auths', () => {
    it('returns an empty array if the member has no authorizations', async () => {
      expect.assertions(2)
      const admin = await Member.load(1, db)
      const token = admin.generateJWT()
      const res = await request.get('/members/2/auths').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
      expect(res.body).toEqual([])
    })

    it('returns an array of the member\'s authorizations', async () => {
      expect.assertions(2)
      const admin = await Member.load(1, db)
      const normal = await Member.load(2, db)
      await normal.saveAuth('provider1', 'id', 'token', db)
      await normal.saveAuth('provider2', 'id', 'token', db)
      await normal.saveAuth('provider3', 'id', 'token', db)
      const token = admin.generateJWT()
      const res = await request.get('/members/2/auths').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
      expect(res.body).toEqual([ 'provider1', 'provider2', 'provider3' ])
    })

    it('returns 401 if you\'re not an admin', async () => {
      expect.assertions(1)
      const normal = await Member.load(2, db)
      const token = normal.generateJWT()
      const res = await request.get('/members/2/auths').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(401)
    })

    it('returns 401 if you\'re not logged in', async () => {
      expect.assertions(1)
      const res = await request.get('/members/2/auths')
      expect(res.status).toEqual(401)
    })
  })

  describe('PATCH /members/:id/deactivate', () => {
    it('returns 200', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const token = admin.generateJWT()
      const res = await request.patch('/members/2/deactivate').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
    })

    it('sets the user\'s active flag to false', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const token = admin.generateJWT()
      await request.patch('/members/2/deactivate').set('Authorization', `Bearer ${token}`)
      const acct = await Member.load(2, db)
      expect(acct.active).toEqual(false)
    })

    it('returns 401 if you\'re not an admin', async () => {
      expect.assertions(1)
      const other = await Member.load(3, db)
      const token = other.generateJWT()
      const res = await request.patch('/members/2/deactivate').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(401)
    })

    it('returns 401 even if you try to deactivate yourself', async () => {
      expect.assertions(1)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const res = await request.patch('/members/2/deactivate').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(401)
    })
  })

  describe('PATCH /members/:id/reactivate', () => {
    it('returns 200', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const normal = await Member.load(2, db)
      const token = admin.generateJWT()
      await normal.deactivate(admin, db)

      const res = await request.patch('/members/2/reactivate').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
    })

    it('sets the user\'s active flag to true', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const normal = await Member.load(2, db)
      const token = admin.generateJWT()
      await normal.deactivate(admin, db)

      await request.patch('/members/2/reactivate').set('Authorization', `Bearer ${token}`)
      const acct = await Member.load(2, db)
      expect(acct.active).toEqual(true)
    })

    it('returns 401 if you\'re not an admin', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const normal = await Member.load(2, db)
      const other = await Member.load(3, db)
      const token = other.generateJWT()
      await normal.deactivate(admin, db)

      const res = await request.patch('/members/2/reactivate').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(401)
    })

    it('returns 401 even if you try to deactivate yourself', async () => {
      expect.assertions(1)
      const admin = await Member.load(1, db)
      const normal = await Member.load(2, db)
      const token = normal.generateJWT()
      await normal.deactivate(admin, db)

      const res = await request.patch('/members/2/reactivate').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(401)
    })
  })

  describe('POST /invitations/send', () => {
    it('returns 401 if you\'re not logged in', async () => {
      const res = await request.post('/invitations/send')
      expect(res.status).toEqual(401)
    })

    it('returns the emails you tried to invite', async () => {
      expect.assertions(2)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const invites = { emails: [ 'invited1@thefifthworld.com', 'invited2@thefifthworld.com' ], test: true }
      const res = await request.post('/invitations/send').set('Authorization', `Bearer ${token}`).send(invites)
      expect(res.status).toEqual(200)
      expect(res.body.emails).toEqual(invites.emails)
    })
  })

  describe('POST /invitations/:code', () => {
    it('returns a JWT if the invitation is accepted', async () => {
      expect.assertions(8)
      const inviter = await Member.load(2, db)
      await inviter.sendInvitation('invited@thefifthworld.com', () => {}, db)
      const row = await db.run(`SELECT inviteCode FROM invitations;`)
      const { inviteCode } = row[0]
      const res = await request.post(`/invitations/${inviteCode}`)
      const token = await jwt.verify(res.text, config.jwt.secret)
      const check = await db.run(`SELECT accepted FROM invitations WHERE inviteCode=${escape(inviteCode)};`)
      expect(res.status).toEqual(200)
      expect(token.id).toEqual(4)
      expect(token.nopass).toEqual(true)
      expect(token.admin).toEqual(false)
      expect(token.iss).toEqual(config.jwt.domain)
      expect(token.sub).toEqual(`${config.jwt.domain}/members/4`)
      expect(check).toHaveLength(1)
      expect(check[0].accepted).toEqual(1)
    })

    it('returns 401 if invitation is not accepted', async () => {
      expect.assertions(1)
      const res = await request.post(`/invitations/nope`)
      expect(res.status).toEqual(401)
    })

    it('returns 401 if the invitation was already accepted', async () => {
      expect.assertions(3)
      const inviter = await Member.load(2, db)
      await inviter.sendInvitation('invited@thefifthworld.com', () => {}, db)
      const row = await db.run(`SELECT inviteCode FROM invitations;`)
      const { inviteCode } = row[0]
      const url = `/invitations/${inviteCode}`
      await request.post(url)
      const res = await request.post(url)
      const check = await db.run(`SELECT accepted FROM invitations WHERE inviteCode=${escape(inviteCode)};`)
      expect(res.status).toEqual(401)
      expect(check).toHaveLength(1)
      expect(check[0].accepted).toEqual(1)
    })
  })
})
