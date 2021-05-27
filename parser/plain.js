const { Remarkable } = require('remarkable')
const TagHandler = require('../models/tagHandler')

/**
 * Parses a block of wikitext to plain text.
 * @param str {!string} - The string to parse.
 * @returns {string} - The plain text version of that string of wikitext.
 */

const parsePlainText = str => {
  const md = new Remarkable()
  const { stripped: strippedTags } = TagHandler.parse(str)
  const strippedLinks = strippedTags.replace(/\[\[(.*?)]]/g, '$1')
  const strippedTemplates = strippedLinks.replace(/{{(.*)}}/gm, '')
  const html = md.render(strippedTemplates)
  return html.replace(/(<([^>]+)>)/ig, '')
}

module.exports = parsePlainText
