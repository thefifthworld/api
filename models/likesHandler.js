const { escape } = require('sqlstring')
const Member = require('./member')

class LikesHandler {
  constructor (page, ids) {
    const givenPage = page && page.constructor && page.constructor.name === 'Page'
    this.id = givenPage && !isNaN(page.id) ? page.id : null
    this.path = givenPage && page.path ? page.path : null
    this.ids = Array.isArray(ids) && ids.length > 0 ? ids : []
  }

  /**
   * Add a like.
   * @param member {Member|number} - A Member instance or a member's ID number.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves once the like has been
   *   saved to the database.
   */

  async add (member, db) {
    const mid = member instanceof Member ? member.id : !isNaN(member) ? member : null
    if (mid !== null && this.id && this.path) {
      await db.run(`INSERT INTO likes (path, page, member) VALUES (${escape(this.path)}, ${this.id}, ${mid});`)
      this.ids.push(mid)
    }
  }
}

module.exports = LikesHandler
