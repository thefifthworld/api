const express = require('express')
const app = express()
const router = express.Router()

router.get('/', (req, res) => {
  res.json({ v: '1.0.0' })
})

const port = 8081
app.use('/', router)
app.listen(port, () => {
  console.log(`The Fifth World API is listening on port ${port}`)
})
