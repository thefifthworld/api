const { escape } = require('sqlstring')
const express = require('express')
const LinkHandler = require('../models/linkhandler')
const Page = require('../models/page')
const { loadPage, requireLogIn, optionalLogIn } = require('../security')
const parser = require('../parser')
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

// GET /pages/*/like
pages.get('/pages/*/like', requireLogIn, loadPage, async (req, res) => {
  await req.page.likes.add(req.user, db)
  res.status(200).json(req.page)
})

// GET /pages/*/unlike
pages.get('/pages/*/unlike', requireLogIn, loadPage, async (req, res) => {
  await req.page.likes.remove(req.user, db)
  res.status(200).json(req.page)
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

// PATCH /pages/*/lock
pages.patch('/pages/*/lock', requireLogIn, loadPage, async (req, res) => {
  let status = 401
  if (req.user.admin) {
    const update = Object.assign({}, req.page.history.getContent(), { permissions: 444 })
    await req.page.save(update, req.user, 'Locking page', db)
    status = 200
  }
  res.status(status).json(req.page)
})

// PATCH /pages/*/unlock
pages.patch('/pages/*/unlock', requireLogIn, loadPage, async (req, res) => {
  let status = 401
  if (req.user.admin) {
    const update = Object.assign({}, req.page.history.getContent(), { permissions: 774 })
    await req.page.save(update, req.user, 'Unlocking page', db)
    status = 200
  }
  res.status(status).json(req.page)
})

// PATCH /pages/*/hide
pages.patch('/pages/*/hide', requireLogIn, loadPage, async (req, res) => {
  let status = 401
  const isOwner = req.user.id === req.page.owner.id
  const canWrite = req.page.checkPermissions(req.user, 6)
  if (req.user.admin || (isOwner && canWrite)) {
    const update = Object.assign({}, req.page.history.getContent(), { permissions: 700 })
    await req.page.save(update, req.user, 'Hiding page', db)
    status = 200
  }
  res.status(status).json(req.page)
})

// PATCH /pages/*/unhide
pages.patch('/pages/*/unhide', requireLogIn, loadPage, async (req, res) => {
  let status = 401
  const isOwner = req.user.id === req.page.owner.id
  const canWrite = req.page.checkPermissions(req.user, 6)
  if (req.user.admin || (isOwner && canWrite)) {
    const update = Object.assign({}, req.page.history.getContent(), { permissions: 774 })
    await req.page.save(update, req.user, 'Hiding page', db)
    status = 200
  }
  res.status(status).json(req.page)
})

// GET /pages/*
pages.get('/pages/*', optionalLogIn, loadPage, async (req, res) => {
  const parsed = await parser(req.page.history.getBody(), req.page.path, req.user, db)
  res.status(200).json({ page: req.page, markup: parsed.html })
})

// POST /autocomplete
pages.post('/autocomplete', optionalLogIn, async (req, res) => {
  const query = { limit: 5 }
  if (req.body.fragment) query.title = req.body.fragment
  if (req.body.path) query.path = req.body.path
  if (req.body.type) query.type = req.body.type
  const pages = await Page.find(query, req.user, db)
  res.status(200).json({
    pages: pages.map(p => ({ id: p.id, path: p.path, title: p.title })),
    found: pages.length
  })
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

// POST /checkpath
pages.post('/checkpath', optionalLogIn, async (req, res) => {
  const { title, type } = req.body
  const slug = req.body.slug || Page.slugify(title)
  const parent = req.body.parent ? await Page.get(req.body.parent, db) : null
  const path = req.body.path ? req.body.path : parent ? `${parent.path}/${slug}` : `/${slug}`
  const check = await db.run(`SELECT id FROM pages WHERE path=${escape(path)};`)
  const existing = check && check.length > 0

  if (Page.isReservedPath(path)) {
    res.status(200).json({ ok: false, error: `We reserve <code>${path}</code> for internal use.` })
  } else if (Page.isReservedTemplate(type, title)) {
    res.status(200).json({ ok: false, error: `We use <code>{{${title}}}</code> internally. You cannot create a template with that name.` })
  } else if (existing) {
    res.status(200).json({ ok: false, error: `A page with the path <code>${path}</code> already exists.` })
  } else {
    res.status(200).json({ ok: true })
  }
})

module.exports = pages
