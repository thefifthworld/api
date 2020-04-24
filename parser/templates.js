const { escape } = require('sqlstring')
const FileHandler = require('../models/fileHandler')
const Page = require('../models/page')

/**
 * Gets params from a template expression.
 * @param tpl {!string} - A template string.
 * @returns {{key: string, value: string}[]} - An object with key/value pairs
 *   providing the parameters provided in the given template expression.
 */

const getParams = tpl => {
  const paramStrings = tpl.match(/\s(.*?)=["“”](.*?)["“”]/g)
  const params = {}
  if (paramStrings) {
    paramStrings.forEach(str => {
      const pair = str.trim().split('=')
      if (Array.isArray(pair) && pair.length > 0) {
        params[pair[0].trim()] = pair[1].substr(1, pair[1].length - 2).trim()
      }
    })
  }
  return params
}

/**
 * Parse a {{Children}} template.
 * @param template {!string} - The template expression.
 * @param params {?Object} - An object defining the parameters for the template
 *   in key/value pairs.
 * @param path {?string} - The path of the page being parsed.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: string}>} - A Promise that resolves
 *   with an object with two properties: `str` (the string that should replace
 *   the template expression) and `match` (the template expression to replace).
 */

const loadChildren = async (template, params, path, db) => {
  const parentPath = params.of ? params.of : path
  const type = params.type ? params.type : null
  const children = parentPath ? await Page.getChildrenOf(parentPath, type, db) : false
  if (children) {
    const items = children.map(child => `<li><a href="${child.path}">${child.title}</a></li>`)
    const tag = params.ordered ? 'ol' : 'ul'
    return { match: template, str: `<${tag}>\n  ${items.join('\n  ')}\n</${tag}>` }
  } else {
    return { match: template, str: '' }
  }
}

/**
 * Parse a {{Download}} template.
 * @param template {!string} - The template expression.
 * @param params {?Object} - An object defining the parameters for the template
 *   in key/value pairs.
 * @param path {?string} - The path of the page being parsed.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: string}>} - A Promise that resolves
 *   with an object with two properties: `str` (the string that should replace
 *   the template expression) and `match` (the template expression to replace).
 */

const loadFile = async (template, params, path, db) => {
  const p = params.file ? params.file : path ? path : null
  if (p) {
    const rows = await db.run(`SELECT f.name, f.size, f.mime FROM files f, pages p WHERE p.id=f.page AND (p.title=${escape(p)} OR p.path=${escape(p)});`)
    if (rows && rows.length > 0) {
      const row = rows[0]
      const url = FileHandler.getURL(row.name)
      const filesize = FileHandler.getFileSizeStr(row.size)
      const name = `<span class="label">${row.name}</span>`
      const size = `<span class="details">${row.mime}; ${filesize}</span>`
      return { match: template, str: `<a href="${url}" class="download">${name}${size}</a>` }
    } else {
      return { match: template, str: '' }
    }
  }
}

/**
 * Load template from database and parse in parameter values.
 * @param template {!string} - A template expression.
 * @param name {!string} - The name of the template to load.
 * @param params {!Object} - An object that defines the parameters to use for
 *   the template as key/value pairs.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: *}|boolean>} - A Promise that
 *   resolves with an object with two properties: `str` (the string that should
 *   replace the template expression) and `match` (the template expression to
 *   replace). If no template could be loaded, it resolves with `false`.
 */

const loadTemplate = async (template, name, params, db) => {
  const res = await db.run(`SELECT c.json AS json FROM changes c, pages p WHERE p.id=c.page AND p.type='Template' AND p.title='${name}' ORDER BY p.depth ASC, c.timestamp DESC;`)
  if (res.length > 0) {
    const full = JSON.parse(res[0].json).body.replace(/\[\[Type:(.*?)\]\]/g, '').trim()
    const tagged = full.match(/{{Template}}(.+?){{\/Template}}/g)
    if (tagged) {
      let str = tagged[0].substr(12, tagged[0].length - 25)
      Object.keys(params).forEach(param => {
        const re = new RegExp(`{{{${param}}}}`, 'g')
        str = str.replace(re, params[param])
      })
      return { match: template, str }
    }
  }
  return false
}

/**
 * Parse a single template expression.
 * @param template {!string} - The template expression to parse.
 * @param path {?string} - The path of the page we're parsing.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: *}|boolean>} - A Promise that
 *   resolves with an object with two properties: `str` (the string that should
 *   replace the template expression) and `match` (the template expression to
 *   replace). If no template could be loaded, it resolves with `false`.
 */

const parseTemplate = async (template, path, db) => {
  const tpl = template.replace(/\n/g, '')
  const name = tpl.substr(2, tpl.length - 4).replace(/\s(.*?)=["“”](.*?)["“”]/g, '')
  const params = getParams(tpl)

  let res
  switch (name.toLowerCase()) {
    case 'children':
      res = await loadChildren(template, params, path, db); break
    case 'download':
      res = await loadFile(template, params, path, db); break
    default:
      res = await loadTemplate(template, name, params, db); break
  }

  res.str = await parseTemplates(res.str, path, db)
  return res
}

/**
 * Parses templates.
 * @param str {!string} - The string to parse.
 * @param path {?string} - The path of the page that we're parsing.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<string>} - A Promise that resolves with the string parsed,
 *   such that any template calls are replaced with the appropriate values for
 *   those templates.
 */

const parseTemplates = async (str, path, db) => {
  let templates = str.match(/{{((.*?)\n?)*?}}/gm)
  if (templates) {
    for (const template of templates) {
      const tpl = await parseTemplate(template, path, db)
      str = str.replace(tpl.match, tpl.str)
    }
  }
  return str
}

module.exports = parseTemplates
