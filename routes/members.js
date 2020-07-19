const express = require('express')
const Member = require('../models/member')
const parser = require('../parser')
const { requireLogIn, optionalLogIn } = require('../security')
const sendEmail = require('../emailer')
const db = require('../db')
const members = express.Router()

// POST /members/auth
members.post('/members/auth', async (req, res) => {
  if (req.body) {
    const { email, pass } = req.body
    const id = email && pass
      ? await Member.authenticate(email, pass, db)
      : false
    const member = id ? await Member.load(id, db) : false
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

// GET /members/:id
members.get('/members/:id', optionalLogIn, async (req, res) => {
  const id = parseInt(req.params.id)
  const member = id && !isNaN(id) ? await Member.load(id, db) : undefined
  if (member && member.active) {
    const parsed = await parser(member.bio, `/members/${id}`, req.user, db)
    if (parsed && parsed.html) member.bio = parsed.html
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

// GET /members/:id/messages
members.get('/members/:id/messages', requireLogIn, async (req, res) => {
  const messages = await req.user.getMessages(db)
  res.status(200).json(messages)
})

// GET /members/:id/invited
members.get('/members/:id/invited', requireLogIn, async (req, res) => {
  const invited = await req.user.getInvited(db)
  res.status(200).json(invited.map(member => member.privatize ? member.privatize() : member))
})

// PATCH /members/:id/deactivate
members.patch('/members/:id/deactivate', requireLogIn, async (req, res) => {
  let done = false
  let subject = false
  if (req && req.user && req.user.admin) {
    subject = await Member.load(parseInt(req.params.id), db)
    if (subject) done = await subject.deactivate(req.user, db)
  }

  if (done && subject) {
    res.status(200).json(subject)
  } else {
    res.status(401).json({ err: 'Unauthorized' })
  }
})

// PATCH /members/:id/reactivate
members.patch('/members/:id/reactivate', requireLogIn, async (req, res) => {
  let done = false
  let subject = false
  if (req && req.user && req.user.admin) {
    subject = await Member.load(parseInt(req.params.id), db)
    if (subject) done = await subject.reactivate(req.user, db)
  }

  if (done && subject) {
    res.status(200).json(subject)
  } else {
    res.status(401).json({ err: 'Unauthorized' })
  }
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
