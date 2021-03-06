const express = require('express')
const LinkHandler = require('../models/linkhandler')
const LocationHandler = require('../models/locationHandler')
const TemplateHandler = require('../models/templateHandler')
const Page = require('../models/page')
const { loadPage, requireLogIn, optionalLogIn } = require('../security')
const parser = require('../parser')
const db = require('../db')
const { escape } = require('sqlstring')
const pages = express.Router()

// GET /pages
pages.get('/pages', optionalLogIn, async (req, res) => {
  if (req.query) {
    const query = req.query

    // Massage tags into a more readable format
    const tags = query.tag ? Array.isArray(query.tag) ? query.tag : [ query.tag ] : null
    if (tags) {
      const tagsObj = {}
      const hasTags = []
      tags.forEach(str => {
        const pair = str.split(':')
        if (pair && Array.isArray(pair) && pair.length > 1) {
          tagsObj[pair[0].trim()] = pair[1].trim()
        } else {
          hasTags.push(str)
        }
      })
      if (Object.keys(tags).length > 0) query.tags = tagsObj
      if (hasTags.length > 0) query.hasTags = hasTags
    }

    const pages = await Page.find(query, req.user, db)
    res.status(200).json(pages.map(page => page.export()))
  } else {
    res.sendStatus(500)
  }
})

// POST /pages
pages.post('/pages', requireLogIn, async (req, res) => {
  try {
    const page = await Page.create(req.body, req.user, req.body.msg, db)
    if (page) {
      res.status(200).json(page.export())
    } else {
      res.sendStatus(500)
    }
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

// POST /pages/*/like
pages.post('/pages/*/like', requireLogIn, loadPage, async (req, res) => {
  await req.page.likes.add(req.user, db)
  res.status(200).json(req.page.export())
})

// DELETE /pages/*/like
pages.delete('/pages/*/like', requireLogIn, loadPage, async (req, res) => {
  await req.page.likes.remove(req.user, db)
  res.status(200).json(req.page.export())
})

// POST /pages/*/rollback
pages.post('/pages/*/rollback/:id', requireLogIn, loadPage, async (req, res) => {
  if (req.page && req.page.checkPermissions(req.user, 6)) {
    await req.page.rollback(parseInt(req.params.id), req.user, db)
    res.status(200).json(req.page.export())
  } else if (req.page) {
    res.sendStatus(401)
  } else {
    res.sendStatus(404)
  }
})

// POST /pages/*
pages.post('/pages/*', requireLogIn, loadPage, async (req, res) => {
  if (req.page && req.page.checkPermissions(req.user, 6)) {
    try {
      await req.page.save(req.body, req.user, req.body.msg, db)
      res.status(200).json(req.page.export())
    } catch (err) {
      res.status(400).json({ error: err.message })
    }
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
  res.status(status).json(req.page.export())
})

// PATCH /pages/*/unlock
pages.patch('/pages/*/unlock', requireLogIn, loadPage, async (req, res) => {
  let status = 401
  if (req.user.admin) {
    const update = Object.assign({}, req.page.history.getContent(), { permissions: 774 })
    await req.page.save(update, req.user, 'Unlocking page', db)
    status = 200
  }
  res.status(status).json(req.page.export())
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
  res.status(status).json(req.page.export())
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
  res.status(status).json(req.page.export())
})

// GET /pages/*
pages.get('/pages/*', optionalLogIn, loadPage, async (req, res) => {
  let body = req.page.history.getBody()
  if (req.query && req.query.version) {
    const matching = req.page.history.changes.filter(change => change.id === parseInt(req.query.version))
    const version = matching && Array.isArray(matching) && matching.length > 0 ? matching[0] : null
    if (version && version.content && version.content.body) body = version.content.body
  }
  const parsed = await parser(body, req.page.path, req.user, db)

  const read = req.page.checkPermissions(req.user, 4)
  const write = req.page.checkPermissions(req.user, 6)
  const code = req.page.permissions
  req.page.permissions = { read, write, code }

  let data = {}
  try {
    const curr = req.page.history.getContent()
    data = curr && curr.data ? JSON.parse(curr.data) : {}
  } catch (err) {}

  res.status(200).json({ page: req.page.export(), markup: parsed.html, data })
})

// GET /templates
pages.get('/templates', optionalLogIn, async (req, res) => {
  const instances = await TemplateHandler.query(req.query, req.user, db)
  res.status(200).json(instances)
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
    const pages = await Page.placesNear([ lat, lon ], parseFloat(dist), req.user, db)
    res.status(200).json(pages.map(page => page.export()))
  } else {
    res.sendStatus(500)
  }
})

// GET /updates
pages.get('/updates', async (req, res) => {
  const updates = await Page.getUpdates(10, req.user, db)
  res.status(200).json(updates)
})

// GET /updates/:num
pages.get('/updates/:num', async (req, res) => {
  const updates = await Page.getUpdates(req.params.num, req.user, db)
  res.status(200).json(updates)
})

// GET /requested
pages.get('/requested', async (req, res) => {
  const links = await LinkHandler.loadRequested(db)
  res.status(200).json(links)
})

// GET /requested/:num
pages.get('/requested/:num', async (req, res) => {
  const links = await LinkHandler.loadRequested(db, parseInt(req.params.num))
  res.status(200).json(links)
})

// GET /checkpath
pages.get('/checkpath/*', optionalLogIn, async (req, res) => {
  const path = req.originalUrl.substr(10)
  if (Page.isReservedPath(path)) {
    res.status(200).json({ ok: false, error: `We reserve <code>${path}</code> for internal use.` })
  } else if (Page.hasNumericalLastElement(path)) {
    res.status(200).json({ ok: false, error: `Please don’t end a path with a number. That makes it difficult for the system to tell the difference between pages and versions of pages.` })
  } else {
    const page = path ? await Page.get(path, db) : null
    if (page) {
      res.status(200).json({ ok: false, error: `A page with the path <code>${path}</code> already exists.` })
    } else {
      res.status(200).json({ ok: true })
    }
  }
})

// POST /parse
pages.post('/parse', async (req, res) => {
  const p = await parser(req.body.str, req.body.path, req.user, db)
  res.status(200).json({
    orig: req.body.str,
    html: p.html,
    tags: p.tagHandler.tags,
    links: p.linkHandler.links
  })
})

// POST /response
pages.post('/response', async (req, res) => {
  await db.run(`INSERT INTO responses (form, data) VALUES (${escape(req.body.form)}, ${escape(req.body.data)});`)
  res.status(200).json(Object.assign({}, { name: req.body.form }, JSON.parse(req.body.data)))
})

// GET /geo/:lat/:lon
pages.get('/geo/:lat/:lon', async (req, res) => {
  const { lat, lon } = req.params
  const pt = new LocationHandler(lat, lon)
  if (pt.lat === false || pt.lon === false) {
    res.sendStatus(500)
  } else {
    const oceans = await LocationHandler.loadSeaLevels()
    const zone = pt.getAtmosphere()
    const data = {
      coords: [pt.lat, pt.lon],
      isOcean: pt.isOcean(oceans),
      isCoastal: pt.isCoastal(oceans),
      nearbyCommunities: await pt.getNeighbors(req.user, Page, db),
      hemisphere: zone.hemisphere,
      cell: zone.cell,
      pressure: zone.pressure,
      winds: zone.winds
    }
    res.status(200).json(data)
  }
})

module.exports = pages
