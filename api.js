const express = require('express')
const bodyParser = require('body-parser')
const cors = require('cors')
const fileUpload = require('express-fileupload')

const db = require('./db')
const members = require('./routes/members')
const pages = require('./routes/pages')

const api = express()
const router = express.Router()
api.use('/docs', express.static('docs'))

api.use(bodyParser.urlencoded({ extended: true }))
api.use(bodyParser.json({ limit: '100mb', extended: true }))
api.use(cors())
api.use(fileUpload())

api.use('/', router)
api.use('/', members)
api.use('/', pages)

router.get('/', async (req, res) => {
  const query = await db.run('SELECT COUNT(id) AS count FROM pages;')
  res.status(200).json({ pages: query[0].count })
})

api.closeDB = () => {
  db.end()
}

module.exports = api
