const express = require('express')
const basicAuth = require('express-basic-auth')

const db = require('./db')
const members = require('./routes/members')

const api = express()
const router = express.Router()

const authorizer = async (email, key, cb) => {
  const check = await db.run(`SELECT id, name, email, admin FROM members WHERE email='${email}' AND apikey='${key}' AND active=1;`)
  if (check.length > 0) {
    return cb(null, true)
  } else {
    return cb(null, false)
  }
}

const unauthorizedResponse = () => {
  return { err: 'Unauthorized' }
}

const secure = basicAuth({
  authorizer,
  unauthorizedResponse,
  authorizeAsync: true,
  challenge: true
})

router.get('/', async (req, res) => {
  const query = await db.run('SELECT COUNT(id) AS count FROM pages;')
  res.status(200).json({ pages: query[0].count })
})

router.get('/secure', secure, (req, res) => {
  res.status(200).json('hello world')
})

api.use('/', router)
api.use('/', members)
module.exports = api
