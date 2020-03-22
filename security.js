const basicAuth = require('express-basic-auth')
const db = require('./db')

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

module.exports = {
  secure
}
