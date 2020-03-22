const express = require('express')
const Member = require('../models/member')
const security = require('../security')
const { secure } = security
const db = require('../db')
const members = express.Router()

// GET /members/:id
members.get('/members/:id', async (req, res) => {
  const { id } = req.params
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
members.patch('/members/:id', secure, async (req, res) => {
  const editor = await Member.load(req.user, db)
  console.log({
    editor,
    body: req.body
  })
})

module.exports = members
