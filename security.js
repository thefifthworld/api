const basicAuth = require('basic-auth')
const Member = require('./models/member')
const db = require('./db')

const requireLogIn = async (req, res, next) => {
  const auth = basicAuth(req)
  if (auth && auth.name && auth.pass) {
    const id = await Member.authenticate(auth.name, auth.pass, db)
    if (id) req.user = await Member.load(id, db)
    next()
  } else {
    res.sendStatus(401)
  }
}

module.exports = {
  requireLogIn
}
