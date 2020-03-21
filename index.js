const express = require('express')
const db = require('./db')
const config = require('./config')

const app = express()
const router = express.Router()

router.get('/', async (req, res) => {
  const query = await db.run('SELECT COUNT(id) AS count FROM pages;')
  res.json({ pages: query[0].count })
})

const { port } = config
app.use('/', router)
app.listen(port, () => {
  console.log(`The Fifth World API is listening on port ${port}`)
})
