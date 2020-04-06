const basicAuth = require('basic-auth')
const Member = require('./models/member')
const db = require('./db')

/**
 * Express Middleware for requiring authentication.
 * @param req {!Object} - The Express request object.
 * @param res {!Object} - The Express response object.
 * @param next {function} - The Express next middleware function.
 * @returns {Promise<void>} - A Promise that resolves once the username and
 *   password provided by Basic Auth have been authenticated. If the
 *   credentials provided can be authenticated, the matching Member account is
 *   loaded into `req.user`. If not, a 401 status is returned.
 */

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
