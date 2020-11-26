const { escape } = require('sqlstring')

class LinkHandler {
  constructor () {
    this.links = []
  }

  /**
   * Add a link to the handler.
   * @param str {!string} - The string used to create a link. This is a
   *   wikitext link, like `[[Title]]` or `[[/path]]`, which would like to a
   *   page with a matching title or path, respectively. Links can also include
   *   a pipe, as in `[[Title | Text]]` or `[[/path | Text]]`. The string
   *   before the pipe is used to match the link (by either title or path),
   *   while what follows is used as the text of the link.
   * @param db {!Pool} - The database connection.
   * @returns {{path: string, text: string, isNew: boolean}} - An object
   *   representing the information parsed out of the link string and used to
   *   create the link. The `path` property is the path that we're to link to,
   *   the `text` property is the text of the link, and `isNew` is a boolean
   *   indicating if the destination for this link does not yet exist.
   */

  async add (str, db) {
    const pair = str.substr(2, str.length - 4).split('|').map(el => el.trim())
    const check = await db.run(`SELECT title, path, id FROM pages WHERE title=${escape(pair[0])} OR path=${escape(pair[0])};`)
    const found = check && check.length > 0
    const link = {
      text: pair[pair.length - 1],
      title: found ? check[0].title : pair[0],
      id: found ? check[0].id : null,
      path: found ? check[0].path : `/new?title=${encodeURIComponent(pair[0])}`,
      isNew: !found
    }
    this.links.push(link)
    return link
  }

  /**
   * Saves links to the database.
   * @param id {!number} - The primary key of the page that contains these
   *   links.
   * @param db {!Pool} - The database connection.
   * @returns {Promise} - A Promise that resolves once the links have
   *   been saved to the database.
   */

  async save (id, db) {
    if (id && !isNaN(id)) {
      await db.run(`DELETE FROM links WHERE src=${id};`)
      const promises = this.links.map(link => {
        const { isNew, title } = link
        return isNew
          ? db.run(`INSERT INTO links (src, dest, title) VALUES (${id}, NULL, ${escape(title)});`)
          : db.run(`INSERT INTO links (src, dest, title) VALUES (${id}, ${link.id}, ${escape(title)});`)
      })
      return Promise.all(promises)
    }
  }

  /**
   * Load a list of requested links and which pages are requesting them.
   * @param db {!Pool} - The database connection.
   * @param num {number=} - Optional. The maximum number of links to return.
   *   (Default: 25)
   * @param sortFn {function=} - Optional. A function to use to sort the array
   *   of links. By default, it is sorted by the number of links descending.
   * @returns {Promise<{path: string, text: string, isNew: boolean}[]>} -
   *   A Promise that resolves with an array of objects representing all of the
   *   requested links saved to the database.
   */

  static async loadRequested (db, num = 25, sortFn = (a, b) => b.links.length - a.links.length) {
    const links = []
    const requests = await db.run(`SELECT title FROM links WHERE dest IS NULL GROUP BY title ORDER BY COUNT(id) DESC LIMIT ${num};`)
    if (requests) {
      for (const request of requests) {
        const { title } = request
        const rows = await db.run(`SELECT p.id, p.title, p.path FROM pages p, links l WHERE l.title = ${escape(title)} AND l.dest IS NULL AND p.id=l.src;`)
        const link = {
          title,
          links: rows
        }
        links.push(link)
      }
    }
    return links.sort(sortFn)
  }
}

module.exports = LinkHandler
