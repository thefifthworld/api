const { escape } = require('sqlstring')

class TagHandler {
  constructor () {
    this.tags = {}
  }

  /**
   * Add a tag.
   * @param tag {!string} - The name of the tag to add.
   * @param val {!string} - The value of the tag to add.
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
   * Return the value(s) associated with this tag.
   * @param tag {!string} - The tag value to fetch.
   * @param justLast {boolean=} - Optional. If set to `true`, just returns the
   *   last value associated with the tag (Default: `false`).
   * @returns {undefined|string|string[]} - The last value associated with the
   *   tag if it can be found, or `undefined` if it could not be found.
   */

  get (tag, justLast = false) {
    const arr = this.tags[tag]
    if (justLast && arr && Array.isArray(arr) && arr.length > 0) {
      return arr[arr.length - 1]
    } else if (!justLast && arr) {
      return arr
    } else {
      return undefined
    }
  }

  /**
   * Save tags to the database.
   * @param id {!number} - The primary key of the page to associate these tags
   *   with in the database.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<OkPacket>} - A promise that resolves when the tags have been saved
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

  /**
   * Parses a wikitext string to create a new `TagHandler` object, as well as
   * a version of the text with the tags stripped out.
   * @param str {string} - A wikitext string to parse.
   * @returns returnObj {object} - An object containing the wikitext string
   *   stripped of tags, as well as an instance of `TagHandler` loaded with
   *   the parsed tag data.
   * @returns returnObj.stripped {string} - The original wikitext string, but
   *   stripped of all tags.
   * @returns returnObj.tagHandler {TagHandler} - A `TagHandler` instance
   *   loaded with the tag data parsed from the string.
   */

  static parse (str) {
    const tagHandler = new TagHandler()
    let stripped = str
    const matches = str.match(/\[\[(.*?)\]\]/gm)
    if (matches) {
      matches.forEach(match => {
        const submatch = match.substr(2, match.length - 4).match(/^(.*?):(.*?)$/)
        if (submatch && submatch.length > 2) {
          stripped = stripped.replace(match, '')
          tagHandler.add(submatch[1].trim(), submatch[2].trim())
        }
      })
    }
    stripped = stripped.replace(/ +/gm, ' ').trim()
    return { stripped, tagHandler }
  }

  /**
   * Load tags for a given page from the database into a new TagHandler.
   * @param id {!number} - The primary key of a page in the database.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<TagHandler>} - A Promise that resolves with a new
   *   TagHandler instance loaded with the page's tags from the database.
   */

  static async load (id, db) {
    const handler = new TagHandler()
    const rows = await db.run(`SELECT tag, value FROM tags WHERE page=${escape(id)};`)
    if (rows) {
      rows.forEach(row => {
        const { tag, value } = row
        handler.add(tag, value)
      })
    }
    return handler
  }
}

module.exports = TagHandler
