const express = require('express')
const Page = require('../models/page')
const { loadPage, requireLogIn } = require('../security')
const db = require('../db')
const pages = express.Router()

// POST /pages
pages.post('/pages', requireLogIn, async (req, res) => {
  const page = await Page.create(req.body, req.user, req.body.msg, db)
  if (page) {
    res.status(200).json(page)
  } else {
    res.sendStatus(500)
  }
})

// GET /pages/*
pages.get('/pages/*', loadPage, async (req, res) => {
  res.status(200).json(req.page)
})

module.exports = pages
