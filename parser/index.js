const { Remarkable } = require('remarkable')
const parseTags = require('./tags')

/**
 * Parse markdown.
 * @param str {string} - The markdown to parse.
 * @returns {Promise<Object>} - An object detailing the results of the parsing.
 *   It has the following properties:
 *     - `html`: The HTML rendered from the markdown.
 *     - `tags`: An object with the tags found in the string. Each tag becomes
 *         a lower-case property key, with the value of that property being an
 *         array of all the values assigned to that tag throughout the string.
 */

const parser = async (str) => {
  const md = new Remarkable()
  const { stripped, tags } = parseTags(str)
  let html = md.render(stripped)
  return { html, tags }
}

module.exports = parser
