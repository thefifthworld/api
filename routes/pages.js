const express = require('express')
const LinkHandler = require('../models/linkhandler')
const Page = require('../models/page')
const { loadPage, requireLogIn, optionalLogIn } = require('../security')
const db = require('../db')
const pages = express.Router()

// GET /pages
pages.get('/pages', optionalLogIn, async (req, res) => {
  if (req.body) {
    const pages = await Page.find(req.body, req.user, db)
    res.status(200).json(pages)
  } else {
    res.sendStatus(500)
  }
})

// POST /pages
pages.post('/pages', requireLogIn, async (req, res) => {
  const page = await Page.create(req.body, req.user, req.body.msg, db)
  if (page) {
    res.status(200).json(page)
  } else {
    res.sendStatus(500)
  }
})

// POST /pages/*
pages.post('/pages/*', requireLogIn, loadPage, async (req, res) => {
  if (req.page && req.page.checkPermissions(req.user, 6)) {
    await req.page.save(req.body, req.user, req.body.msg, db)
    res.status(200).json(req.page)
  } else if (req.page) {
    res.sendStatus(401)
  } else {
    res.sendStatus(404)
  }
})

// GET /pages/*
pages.get('/pages/*', loadPage, async (req, res) => {
  res.status(200).json(req.page)
})

// GET /near/:lat/:lon/:dist*?
pages.get('/near/:lat/:lon/:dist*?', optionalLogIn, async (req, res) => {
  const { lat, lon, dist } = req.params
  if (lat && lon) {
    const pages = await Page.placesNear([ lat, lon ], dist, req.user, db)
    res.status(200).json(pages)
  } else {
    res.sendStatus(500)
  }
})

// GET /requested
pages.get('/requested', async (eq, res) => {
  const links = await LinkHandler.loadRequested(db)
  res.status(200).json(links)
})

module.exports = pages
