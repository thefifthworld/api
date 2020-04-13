const express = require('express')
const { loadPage } = require('../security')
const pages = express.Router()

// GET /pages/*
pages.get('/pages/*', loadPage, async (req, res) => {
  res.status(200).json(req.page)
})

module.exports = pages
