const { Remarkable } = require('remarkable')

/**
 * Parse markdown.
 * @param str {string} - The markdown to parse.
 * @returns {Promise<{html: (string)}>} - An object detailing the results of
 *   the parsing. It has the following properties:
 *     - `html`: The HTML rendered from the markdown.
 */

const parser = async (str) => {
  const md = new Remarkable()
  let html = md.render(str)
  return { html }
}

module.exports = parser
