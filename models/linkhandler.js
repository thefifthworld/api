const { escape } = require('sqlstring')

class LinkHandler {
  constructor () {
    this.links = []
  }

  /**
   * Add a link to the handler.
   * @param str {string} - The string used to create a link. This is a wikitext
   *   link, like `[[Title]]` or `[[/path]]`, which would like to a page with
   *   a matching title or path, respectively. Links can also include a pipe,
   *   as in `[[Title | Text]]` or `[[/path | Text]]`. The string before the
   *   pipe is used to match the link (by either title or path), while what
   *   follows is used as the text of the link.
   * @param db {Pool} - The database connection.
   * @returns {{path: (string), text: string, isNew: boolean}} - An object
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
   * @param page {Page} - The page that contains these links.
   * @param db {Pool} - The database connection.
   * @returns {Promise} - A Promise that resolves once the links have
   *   been saved to the database.
   */

  async save (page, db) {
    if (page && page.constructor && page.constructor.name === 'Page' && page.id && !isNaN(page.id)) {
      await db.run(`DELETE FROM links WHERE src=${page.id};`)
      const promises = this.links.map(link => {
        const { isNew, title, id } = link
        return isNew
          ? db.run(`INSERT INTO links (src, dest, title) VALUES (${page.id}, NULL, ${escape(title)});`)
          : db.run(`INSERT INTO links (src, dest, title) VALUES (${page.id}, ${id}, ${escape(title)});`)
      })
      return Promise.all(promises)
    }
  }

  /**
   * Return information about the links saved in the database for a page.
   * @param page {Page} - The page to find links from.
   * @param db {Pool} - The database connection.
   * @returns {Promise} - A Promise that resolves with an array of objects.
   *   Each object contains information about one of the links from the given
   *   page saved to the database, namely the `title`, `id`, and `path` of the
   *   page it links to, and `isNew`, a boolean that equals `true` if the page
   *   does not yet exist.
   */

  static async load (page, db) {
    if (page && page.constructor && page.constructor.name === 'Page' && page.id && !isNaN(page.id)) {
      const rows = await db.run(`SELECT l.dest, l.title, p.path FROM links l LEFT JOIN pages p ON p.id = l.dest WHERE l.src=${page.id};`)
      return rows.map(row => {
        const { title, dest, path } = row
        const isNew = dest === null
        return {
          title,
          id: isNew ? null : dest,
          path: isNew ? null : path,
          isNew
        }
      })
    }
  }
}

module.exports = LinkHandler
