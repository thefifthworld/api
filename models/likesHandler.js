const { escape } = require('sqlstring')
const Member = require('./member')

class LikesHandler {
  constructor (page, ids) {
    this.id = page && page.id && !isNaN(page.id) ? page.id : null
    this.path = page && page.path && typeof page.path === 'string' ? page.path : null
    this.ids = Array.isArray(ids) && ids.length > 0 ? ids : []
  }

  /**
   * Add a like.
   * @param member {!Member|!number} - A Member instance or a member's ID number.
   * @param db {!Pool} - The database connection.
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

  /**
   * Remove a like.
   * @param member {!Member|!number} - A Member instance or a member's ID number.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the like has been
   *   removed from the database.
   */

  async remove (member, db) {
    const mid = member instanceof Member ? member.id : !isNaN(member) ? member : null
    if (mid !== null && this.id) {
      await db.run(`DELETE FROM likes WHERE page=${this.id} AND member=${mid};`)
      this.ids = this.ids.filter(id => id !== mid)
    }
  }

  /**
   * Load the likes for a particular page from the database.
   * @param page {!Page} - The Page we're loading likes for.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<LikesHandler|boolean>} - a LikesHandler for the given
   *   Page instance, or `false` if not given a Page with an ID.
   */

  static async load (page, db) {
    const id = page && page.id && !isNaN(page.id) ? page.id : false
    if (id) {
      const rows = await db.run(`SELECT member FROM likes WHERE page=${id};`)
      const likes = rows.map(row => row.member)
      return new LikesHandler(page, likes)
    } else {
      return false
    }
  }
}

module.exports = LikesHandler
