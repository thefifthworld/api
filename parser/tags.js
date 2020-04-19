const TagHandler = require('../models/taghandler')

/**
 * Parse tags from string
 * @param str {!string} - Markdown to parse.
 * @returns {{stripped: string, tags: TagHandler}} - an object containing two
 *   properties:
 *   - `stripped`: A copy of the original string with the tags removed.
 *   - `tags`: An object that represents each tag with a property. The tag
 *       is reduced to lower-case to use as the key. The value is an array of
 *       all the values associated with that tag in the text. So, for example,
 *       given a text like `[[Tag:1]] [[Tag:2]]`, then `tag` will be
 *       `{ tag: [ '1', '2' ] }` (this is a parser, so all values are strings).
 */

const parseTags = str => {
  const tagHandler = new TagHandler()
  let stripped = str
  const matches = str.match(/\[\[(.*?):(.*?)\]\]/gm)
  if (matches) {
    matches.forEach(match => {
      stripped = stripped.replace(match, '')
      const pair = match.substr(2, match.length - 4).split(':').map(el => el.trim())
      if (pair && pair.length > 1) {
        tagHandler.add(...pair)
      }
    })
  }
  stripped = stripped.replace(/ +/gm, ' ')
  return { stripped, tagHandler }
}

module.exports = parseTags
