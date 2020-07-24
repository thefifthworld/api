const express = require('express')
const Member = require('../models/member')
const parser = require('../parser')
const { requireLogIn, requireAdmin, optionalLogIn } = require('../security')
const sendEmail = require('../emailer')
const db = require('../db')
const members = express.Router()

// POST /members/auth
members.post('/members/auth', async (req, res) => {
  if (req.body) {
    const { email, pass, provider, id } = req.body
    const creds = email && pass ? { email, password: pass } : provider && id ? { provider, id } : false
    const mid = creds ? await Member.authenticate(creds, db) : false
    const member = mid ? await Member.load(mid, db) : false
    if (member && member.active) {
      res.status(200).send(member.generateJWT())
    } else {
      res.sendStatus(401)
    }
  }
})

// POST /members/reauth
members.post('/members/reauth', requireLogIn, async (req, res) => {
  res.status(200).send(req.user.generateJWT())
})

// POST /members/providers
members.post('/members/providers', requireLogIn, async (req, res) => {
  const { provider, id, token } = req.body
  if (provider && id && token) {
    await req.user.saveAuth(provider, id, token, db)
    res.sendStatus(200)
  } else {
    res.sendStatus(406)
  }
})

// GET /members/providers
members.get('/members/providers', requireLogIn, async (req, res) => {
  const auths = await req.user.getAuths(db)
  res.status(200).json(auths)
})

// DELETE /members/providers/:provider
members.delete('/members/providers/:provider', requireLogIn, async (req, res) => {
  await req.user.deleteAuth(req.params.provider, db)
  const auths = await req.user.getAuths(db)
  res.status(200).json(auths)
})

// GET /members/messages
members.get('/members/messages', requireLogIn, async (req, res) => {
  const messages = await req.user.getMessages(db)
  res.status(200).json(messages)
})

// GET /members/invited
members.get('/members/invited', requireLogIn, async (req, res) => {
  const invited = await req.user.getInvited(db)
  res.status(200).json(invited.map(member => member.privatize ? member.privatize() : member))
})

// GET /members/:id
members.get('/members/:id', optionalLogIn, async (req, res) => {
  const id = parseInt(req.params.id)
  const member = id && !isNaN(id) ? await Member.load(id, db) : undefined
  if (member && member.active) {
    const { bio } = member
    member.bio = { markdown: bio }
    if (bio && bio.length > 0) {
      const parsed = await parser(bio, `/members/${id}`, req.user, db)
      if (parsed && parsed.html) member.bio.html = parsed.html
    }
    res.status(200).json(member.privatize())
  } else {
    res.status(404).json({ err: 'Member not found' })
  }
})

// PATCH /members/:id
members.patch('/members/:id', requireLogIn, async (req, res) => {
  let subject = false
  let updated = false
  if (req && req.user && req.user instanceof Member) {
    subject = await Member.load(parseInt(req.params.id), db)
    updated = await subject.update(req.body, req.user, db)
    delete subject.password
  }

  if (subject && updated) {
    res.status(200).json(subject)
  } else {
    res.status(401).json({ err: 'Unauthorized' })
  }
})

// GET /members/:id/auths
members.get('/members/:id/auths', requireAdmin, async (req, res) => {
  const member = await Member.load(parseInt(req.params.id), db)
  const auths = member ? await member.getAuths(db) : []
  res.status(200).json(auths)
})

// PATCH /members/:id/deactivate
members.patch('/members/:id/deactivate', requireAdmin, async (req, res) => {
  const subject = await Member.load(parseInt(req.params.id), db)
  await subject.deactivate(req.user, db)
  res.status(200).json(subject.privatize())
})

// PATCH /members/:id/reactivate
members.patch('/members/:id/reactivate', requireAdmin, async (req, res) => {
  const subject = await Member.load(parseInt(req.params.id), db)
  await subject.reactivate(req.user, db)
  res.status(200).json(subject.privatize())
})

// POST /invitations/send
members.post('/invitations/send', requireLogIn, async (req, res) => {
  if (req && req.user) {
    const { emails, test } = req.body
    const addrs = Array.isArray(emails) ? emails : [ emails ]
    const emailer = test ? () => {} : sendEmail
    await req.user.sendInvitations(addrs, emailer, db)
    const messages = await req.user.getMessages(db)
    res.status(200).json({ messages, emails: addrs })
  } else {
    res.status(401).json({ err: 'Unauthorized' })
  }
})

module.exports = members
