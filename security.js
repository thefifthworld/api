const basicAuth = require('express-basic-auth')
const Member = require('./models/member')
const db = require('./db')

const authorizer = async (email, password, cb) => {
  const id = await Member.authenticate(email, password, db)
  return cb(null, id !== false)
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

const getLoggedIn = async (req, res, next) => {
  if (req && req.auth && req.auth.user && req.auth.password) {
    const id = await Member.authenticate(req.auth.user, req.auth.password, db)
    if (id) req.user = await Member.load(id, db)
  }
  next()
}

module.exports = {
  secure,
  getLoggedIn
}
