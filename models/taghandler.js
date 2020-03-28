const { escape } = require('sqlstring')

class TagHandler {
  constructor () {
    this.tags = {}
  }

  /**
   * Add a tag.
   * @param tag {string} - The name of the tag to add.
   * @param val {string} - The value of the tag to add.
   */

  add (tag, val) {
    const key = tag.toLowerCase()
    if (this.tags[key]) {
      this.tags[key].push(val)
    } else {
      this.tags[key] = [ val ]
    }
  }

  /**
   * Save tags to the database.
   * @param id {number} - The primary key of the page to associate these tags
   *   with in the database.
   * @param db {Pool} - The database connection.
   * @returns {Promise} - A promise that resolves when the tags have been saved
   *   to the database.
   */

  async save (id, db) {
    const special = [ 'type', 'location' ]
    const keys = Object.keys(this.tags).filter(key => !special.includes(key))
    await db.run(`DELETE FROM tags WHERE page=${escape(id)};`)
    for (const key of keys) {
      for (const val of this.tags[key]) {
        await db.run(`INSERT INTO tags (page, tag, value) VALUES (${escape(id)}, ${escape(key)}, ${escape(val)});`)
      }
    }
  }
}

module.exports = TagHandler
