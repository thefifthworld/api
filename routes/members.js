const express = require('express')
const Member = require('../models/member')
const { requireLogIn } = require('../security')
const sendEmail = require('../emailer')
const db = require('../db')
const members = express.Router()

// GET /members/:id
members.get('/members/:id', async (req, res) => {
  const id = parseInt(req.params.id)
  const member = id && !isNaN(id) ? await Member.load(id, db) : undefined
  if (member && member.active) {
    const priv = [ 'password', 'email', 'invitations', 'active' ]
    priv.forEach(key => { delete member[key] })
    res.status(200).json(member)
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
