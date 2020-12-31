const { Remarkable } = require('remarkable')
const Page = require('../models/Page')
const FileHandler = require('../models/fileHandler')
const LinkHandler = require('../models/linkhandler')
const TagHandler = require('../models/taghandler')
const TemplateHandler = require('../models/templateHandler')

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
  const b = str.match(/```(\r|\n|.)*?```/gm)
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
 * @param path {?string} - The path of the page being parsed.
 * @param member {?member} - The member that we're parsing for.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<Object>} - An object detailing the results of the parsing.
 *   It has the following properties:
 *     - `html`: The HTML rendered from the markdown.
 *     - `tags`: An object with the tags found in the string. Each tag becomes
 *         a lower-case property key, with the value of that property being an
 *         array of all the values assigned to that tag throughout the string.
 */

const parser = async (str, path, member, db) => {
  str = typeof str === 'string' ? str : ''
  const md = new Remarkable({ html: true, xhtmlOut: true })
  const { blocked, blocks } = saveBlocks(str)
  const { stripped, tagHandler } = TagHandler.parse(blocked)

  // Render templates
  let templated = stripped.replace(/{{Template}}(\r|\n|.)*?{{\/Template}}/gm, '')
  const templates = await TemplateHandler.parse(stripped, { page: Page, fileHandler: FileHandler, linkHandler: LinkHandler })
  await templates.render({ path, member }, db)
  for (const key of Object.keys(templates.instances)) {
    for (const instance of templates.instances[key]) {
      templated = templated.replace(instance.originalWikitext, instance.markup)
    }
  }

  let html = md.render(templated)
  const { str: linked, linkHandler } = await LinkHandler.parse(html, db)
  html = restoreBlocks(linked, blocks)
  return { html, tagHandler, linkHandler }
}

module.exports = parser
