const LinkHandler = require('../models/linkhandler')

/**
 * Parse links.
 * @param str {!string} - The string to parse.
 * @param db {!Pool} - The database connection
 * @returns {Promise<{str: string, links: {text: string, path: string,
 *   isNew: boolean}[]}>} - A Promise that resolves with an object containing
 *   two properties:
 *     - `str`: The parsed string.
 *     - `links`: An array of objects representing the links parsed. Each
 *         object has three properties: `text` (the text of the link), `path`
 *         (the path being linked to), and `isNew` (a boolean that is `true` if
 *         this is linking to a page that does not yet exist, or `false` if it
 *         does exist).
 */

const parseLinks = async (str, db) => {
  const res = { str, linkHandler: new LinkHandler() }
  const matches = str.match(/\[\[(.*)\]\]/gm)
  if (matches) {
    for (const match of matches) {
      const link = await res.linkHandler.add(match, db)
      let a = `<a href="${link.path}"`
      if (!link.isNew && link.title !== link.text) a += ` title="${link.title}"`
      if (link.isNew) a += ` class="isNew"`
      a += `>${link.text}</a>`
      res.str = res.str.replace(match, a)
    }
  }
  return res
}

module.exports = parseLinks
