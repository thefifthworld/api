const express = require('express')
const Member = require('../models/member')
const db = require('../db')
const members = express.Router()

// GET /members/:id
members.get('/members/:id', async (req, res) => {
  const { id } = req.params
  const member = id && !isNaN(id) ? await Member.load(id, db) : undefined
  if (member) {
    delete member.password
    delete member.apikey
    res.status(200).json(member)
  } else {
    res.status(404).json({ err: 'Member not found' })
  }
})

module.exports = members
