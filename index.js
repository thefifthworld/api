const express = require('express')
const basicAuth = require('express-basic-auth')

const db = require('./db')
const config = require('./config')

const app = express()
const router = express.Router()

const authorizer = async (email, key, cb) => {
  const check = await db.run(`SELECT id, name, email, admin FROM members WHERE email='${email}' AND apikey='${key}' AND active=1;`)
  if (check.length > 0) {
    return cb(null, true)
  } else {
    return cb(null, false)
  }
}

const secure = basicAuth({
  authorizer,
  authorizeAsync: true,
  challenge: true
})

router.get('/', async (req, res) => {
  const query = await db.run('SELECT COUNT(id) AS count FROM pages;')
  res.json({ pages: query[0].count })
})

router.get('/secure', secure, (req, res) => {
  res.json('hello world')
})

const { port } = config
app.use('/', router)
app.listen(port, () => {
  console.log(`The Fifth World API is listening on port ${port}`)
})
