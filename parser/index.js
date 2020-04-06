const { Remarkable } = require('remarkable')
const parseTags = require('./tags')
const parseLinks = require('./links')
const parseTemplates = require('./templates')

/**
 * Remove code blocks from the string, so that we don't parse tags, links, or
 * templates contained within them.
 * @param str {!string} - The string to parse.
 * @returns {{blocked: string, blocks: string[]}} - An object with two
 *   properties: `blocked`, containing the `str` with all code blocks removed,
 *   and `blocks`, an array of strings of the blocks removed.
 */

const saveBlocks = str => {
  let blocked = str
  const b = str.match(/```(\n|.)*```/gm)
  const blocks = b ? b.map(b => b.substr(3, b.length - 6)) : []
  blocks.forEach((block, index) => {
    const placeholder = `||||BLOCK${index}||||`
    blocked = blocked.replace(`\`\`\`${block}\`\`\``, placeholder)
  })
  return { blocked, blocks }
}

/**
 * Restores blocks removed by `saveBlocks` to the string.
 * @param str {!string} - The string being parsed. This should have been
 *   taken from the `blocked` string returned by `saveBlocks`, perhaps after
 *   further parsing.
 * @param blocks {!string[]} - An array of blocks to restore. This should come
 *   from the `blocks` array returned by `saveBlocks`.
 * @returns {string} - The string with the blocks saved by `saveBlocks`
 *   restored.
 */

const restoreBlocks = (str, blocks) => {
  blocks.forEach((block, index) => {
    const placeholder = `<p>||||BLOCK${index}||||</p>`
    str = str.replace(placeholder, `<pre><code>${block}</code></pre>`)
  })
  return str
}

/**
 * Parse markdown.
 * @param str {!string} - The markdown to parse.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<Object>} - An object detailing the results of the parsing.
 *   It has the following properties:
 *     - `html`: The HTML rendered from the markdown.
 *     - `tags`: An object with the tags found in the string. Each tag becomes
 *         a lower-case property key, with the value of that property being an
 *         array of all the values assigned to that tag throughout the string.
 */

const parser = async (str, db) => {
  const md = new Remarkable()
  const { blocked, blocks } = saveBlocks(str)
  const { stripped, tagHandler } = parseTags(blocked)
  let html = md.render(stripped)
  const { str: linked, linkHandler } = await parseLinks(html, db)
  const templated = await parseTemplates(linked, db)
  html = restoreBlocks(templated, blocks)
  return { html, tagHandler, linkHandler }
}

module.exports = parser
