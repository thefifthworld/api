const { escape } = require('sqlstring')

/**
 * Parse links.
 * @param str {string} - The string to parse.
 * @param db {Pool} - The database connection
 * @returns {Promise<{str: string, links: []}>} - An object with two
 *   properties:
 *     - `str`: The parsed string.
 *     - `links`: An array of objects representing the links parsed. Each
 *         object has three properties: `text` (the text of the link), `path`
 *         (the path being linked to), and `isNew` (a boolean that is `true` if
 *         this is linking to a page that does not yet exist, or `false` if it
 *         does exist).
 */

const parseLinks = async (str, db) => {
  const res = { str, links: [] }
  const matches = str.match(/\[\[(.*)\]\]/gm)
  if (matches) {
    for (const match of matches) {
      const pair = match.substr(2, match.length - 4).split('|').map(el => el.trim())
      const check = await db.run(`SELECT title, path FROM pages WHERE title=${escape(pair[0])} OR path=${escape(pair[0])};`)
      const found = check && check.length > 0
      const link = {
        text: pair[pair.length - 1],
        path: found ? check[0].path : `/new?title=${encodeURIComponent(pair[0])}`,
        isNew: !found
      }
      let a = `<a href="${link.path}"`
      if (found && check[0].title !== link.text) a += ` title="${check[0].title}"`
      if (!found) a += ` class="isNew"`
      a += `>${link.text}</a>`
      res.str = res.str.replace(match, a)
      res.links.push(link)
    }
  }
  return res
}

module.exports = parseLinks
