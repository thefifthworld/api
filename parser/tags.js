/**
 * Parse tags from string
 * @param str {string} - Markdown to parse.
 * @returns {Object} - an object with two properties:
 *   - `stripped`: A copy of the original string with the tags removed.
 *   - `tags`: An object that represents each tag with a property. The tag
 *       is reduced to lower-case to use as the key. The value is an array of
 *       all the values associated with that tag in the text. So, for example,
 *       given a text like `[[Tag:1]] [[Tag:2]]`, then `tag` will be
 *       `{ tag: [ '1', '2' ] }` (this is a parser, so all values are strings).
 */

const parseTags = str => {
  const tags = {}
  let stripped = str
  const matches = str.match(/\[\[(.*?):(.*?)\]\]/gm)
  if (matches) {
    matches.forEach(match => {
      stripped = stripped.replace(match, '')
      const pair = match.substr(2, match.length - 4).split(':').map(el => el.trim())
      if (pair && pair.length > 1) {
        const key = pair[0].toLowerCase()
        if (tags[key]) {
          tags[key].push(pair[1])
        } else {
          tags[key] = [ pair[1] ]
        }
      }
    })
  }
  stripped = stripped.replace(/ +/gm, ' ')
  return { stripped, tags }
}

module.exports = parseTags
