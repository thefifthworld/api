const { Remarkable } = require('remarkable')
const parseTags = require('./tags')

/**
 * Parses a block of wikitext to plain text.
 * @param str {!string} - The string to parse.
 * @returns {string} - The plain text version of that string of wikitext.
 */

const parsePlainText = str => {
  const md = new Remarkable()
  const { stripped: strippedTags } = parseTags(str)
  const strippedTemplates = strippedTags.replace(/{{(.*)}}/gm, '')
  const html = md.render(strippedTemplates)
  return html.replace(/(<([^>]+)>)/ig, '')
}

module.exports = parsePlainText
