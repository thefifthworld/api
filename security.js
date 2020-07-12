const jwt = require('jsonwebtoken')
const Member = require('./models/member')
const Page = require('./models/page')
const db = require('./db')

/**
 * Verrifies JSON Web Token.
 * @param req {!Object} - The Express.js request object.
 * @returns {Promise<Member|boolean>} - A Promise that resolves with the
 *   Member instance of the user if she has presented a valid JSON Web Token,
 *   or `false` if she has not.
 */

const verifyJWT = async req => {
  const {authorization} = req.headers
  const token = authorization ? authorization.split(' ')[1] : null
  return token
    ? await Member.loadFromJWT(token, db)
    : null
}

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
  const member = await verifyJWT(req)
  if (member) {
    req.user = member
    next()
  } else {
    res.sendStatus(401)
  }
}

/**
 * Express Middleware to allow for authentication.
 * @param req {!Object} - The Express request object.
 * @param res {!Object} - The Express response object.
 * @param next {function} - The Express next middleware function.
 * @returns {Promise<void>} - A Promise that resolves once the username and
 *   password provided by Basic Auth have been authenticated or rejected. If
 *   the credentials provided can be authenticated, the matching Member account
 *   is loaded into `req.user`.
 */

const optionalLogIn = async (req, res, next) => {
  const member = await verifyJWT(req)
  if (id) req.user = member
  next()
}

/**
 * Middleware that adds the requested page to `req.page`. If that page's
 * permissions only give read access to a logged-in user, it prompts for basic
 * authentication and only loads the page if the logged-in member has read
 * permission for the page.
 * @param req {!Object} - The Express.js request object.
 * @param res {!Object} - The Express.js response object.
 * @param {function} - The Express next middleware function.
 * @returns {Promise<void>} - A Promise that resolves when the page has been
 *   loaded and permissions have been sorted out.
 */

const loadPage = async (req, res, next) => {
  const verbs = ['/like', '/unlike', '/lock', '/unlock', '/hide', '/unhide']
  const query = req.originalUrl.split('?')
  const raw = query[0].substr(6)
  const path = verbs.includes(raw.substr(raw.lastIndexOf('/'))) ? raw.substr(0, raw.lastIndexOf('/')) : raw
  const page = await Page.get(path, db)
  if (page && page.checkPermissions(req.user, 4)) {
    req.page = page
    next()
  } else if (page) {
    const member = await verifyJWT(req)
    if (member) {
      req.user = member
      if (page.checkPermissions(req.user, 4)) {
        req.page = page
        next()
      } else {
        res.sendStatus(401)
      }
    } else {
      res.sendStatus(401)
    }
  } else {
    res.sendStatus(404)
  }
}

module.exports = {
  requireLogIn,
  optionalLogIn,
  loadPage
}
