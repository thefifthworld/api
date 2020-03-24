const express = require('express')
const bodyParser = require('body-parser')

const db = require('./db')
const members = require('./routes/members')

const api = express()
const router = express.Router()

api.use(bodyParser.urlencoded({ extended: true }))
api.use(bodyParser.json())

api.use('/', router)
api.use('/', members)

router.get('/', async (req, res) => {
  const query = await db.run('SELECT COUNT(id) AS count FROM pages;')
  res.status(200).json({ pages: query[0].count })
})

api.closeDB = () => {
  db.end()
}

module.exports = api
