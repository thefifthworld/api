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
 * Render a page as an item in a gallery.
 * @param page {!Page} - The page to render.
 * @returns {string|null} - A string providing the HTML needed to render the
 *   page as a gallery item, or `null` if this was not possible.
 */

const renderAsGalleryItem = page => {
  if (Array.isArray(page.files) && page.files.length > 0) {
    const { name, thumbnail } = page.files[0]
    const src = thumbnail ? FileHandler.getURL(thumbnail) : name ? FileHandler.getURL(name) : null
    const img = src ? `<img src="${src}" alt="${page.title}" />` : null
    return img ? `<li><a href="${page.path}">${img}</a></li>` : null
  } else {
    return null
  }
}

/**
 * Show a listing of all artists, with a sample of their work.
 * @param template {!string} - The template expression.
 * @param member {?Member} - The member we're loading children for.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: string}>} - A Promise that resolves
 *   with an object with two properties: `str` (the string that should replace
 *   the template expression) and `match` (the template expression to replace).
 */

const loadArtists = async (template, member, db) => {
  const artists = await Page.find({ type: 'Artist' }, member, db)
  if (artists.length > 0) {
    const sections = []
    for (const artist of artists) {
      const work = await Page.getChildrenOf(artist.id, 'Art', member, db)
      const show = work ? work.slice(0, 4) : []
      const gallery = show && show.length > 0
        ? `<ul class="gallery">${show.map(piece => renderAsGalleryItem(piece)).join('')}</ul>`
        : null
      if (gallery) sections.push(`<section class="artist"><h2><a href="${artist.path}">${artist.title}</a></h2>${gallery}</section>`)
    }
    return { match: template, str: sections.join('') }
  }
  return { match: template, str: '' }
}

/**
 * Show a listing of all novels.
 * @param template {!string} - The template expression.
 * @param member {?Member} - The member we're loading children for.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: string}>} - A Promise that resolves
 *   with an object with two properties: `str` (the string that should replace
 *   the template expression) and `match` (the template expression to replace).
 */

const loadNovels = async (template, member, db) => {
  const novels = await Page.find({ type: 'Novel' }, member, db)
  if (novels.length > 0) {
    const list = []
    for (const novel of novels) {
      const art = await Page.getChildrenOf(novel, 'Art', member, db)
      const covers = art ? art.filter(a => Object.keys(a.tags).includes('cover')) : []
      const cover = covers.length > 0 ? covers[0] : null
      if (cover && cover.files && cover.files.length > 0) {
        list.push(`<li><a href="${novel.path}"><img src="${FileHandler.getURL(cover.files[0].name)}" alt="${novel.title}" /></a></li>`)
      }
    }
    if (list.length > 0) return { match: template, str: `<ul class="novel-listing">${list.join('')}</ul>` }
  }
  return { match: template, str: '' }
}

/**
 * Parse a {{Children}} template.
 * @param template {!string} - The template expression.
 * @param params {?Object} - An object defining the parameters for the template
 *   in key/value pairs.
 * @param path {?string} - The path of the page being parsed.
 * @param member {?Member} - The member we're loading children for.
 * @param db {!Pool} - The database connection.
 * @param asGallery {?boolean} - If `true`, the children are returned as a
 *   gallery of images (Default: `false`).
 * @returns {Promise<{str: string, match: string}>} - A Promise that resolves
 *   with an object with two properties: `str` (the string that should replace
 *   the template expression) and `match` (the template expression to replace).
 */

const loadChildren = async (template, params, path, member, db, asGallery = false) => {
  const parentPath = params.of ? params.of : path
  const type = asGallery? 'Art' : params.type ? params.type : null
  const children = parentPath ? await Page.getChildrenOf(parentPath, type, member, db) : false
  if (children && asGallery) {
    const items = children.map(child => renderAsGalleryItem(child)).filter(c => c !== null)
    const str = items.length > 0
      ? `<ul class="gallery">${items.join()}</ul>`
      : ''
    return { match: template, str }
  } else if (children) {
    const items = children.map(child => `<li><a href="${child.path}">${child.title}</a></li>`)
    const tag = params.ordered ? 'ol' : 'ul'
    return { match: template, str: `<${tag}>${items.join('')}</${tag}>` }
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
 * @param member {?Member} - The member we're parsing the tempalte for.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: string}>} - A Promise that resolves
 *   with an object with two properties: `str` (the string that should replace
 *   the template expression) and `match` (the template expression to replace).
 */

const loadFile = async (template, params, path, member, db) => {
  const p = params.file ? params.file : path ? path : null
  const page = p ? await Page.getIfAllowed(p, member, db) : null
  if (page && page.files && Array.isArray(page.files) && page.files.length > 0) {
    const file = page.files[0]
    const url = FileHandler.getURL(file.name)
    const filesize = FileHandler.getFileSizeStr(file.size)
    const name = `<span class="label">${file.name}</span>`
    const size = `<span class="details">${file.mime}; ${filesize}</span>`
    return { match: template, str: `<a href="${url}" class="download">${name}${size}</a>` }
  } else {
    return { match: template, str: '' }
  }
}

/**
 * Parse an {{Art}} template.
 * @param template {!string} - The template expression.
 * @param params {?Object} - An object defining the parameters for the template
 *   in key/value pairs.
 * @param path {?string} - The path of the page being parsed.
 * @param member {?Member} - The member we're parsing this tempalte for.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: string}>} - A Promise that resolves
 *   with an object with two properties: `str` (the string that should replace
 *   the template expression) and `match` (the template expression to replace).
 */

const loadArt = async (template, params, path, member, db) => {
  const p = params.file ? params.file : path ? path : null
  const page = p ? await Page.getIfAllowed(p, member, db) : null
  if (page && page.files && Array.isArray(page.files) && page.files.length > 0) {
    const file = page.files[0]
    const caption = params.caption ? `<figcaption>${params.caption}</figcaption>` : null
    const alt = params.caption ? params.caption : page.title
    const img = params.useThumbnail && file.thumbnail
      ? `<img src="${FileHandler.getURL(file.thumbnail)}" alt="${alt}" />`
      : `<img src="${FileHandler.getURL(file.name)}" alt="${alt}" />`
    const link = `<a href="${page.path}">${img}</a>`
    const str = caption ? `<figure>${link}${caption}</figure>` : `<figure>${link}</figure>`
    return { match: template, str }
  } else {
    return { match: template, str: '' }
  }
}

/**
 * Parse a {{Form}} template.
 * @param template {!string} - The template expression.
 * @param params {?Object} - An object defining the parameters for the template
 *   in key/value pairs.
 * @returns {Promise<{str: string, match: string}>} - A Promise that resolves
 *   with an object with two properties: `str` (the string that should replace
 *   the template expression) and `match` (the template expression to replace).
 */

const loadForm = async (template, params) => {
  if (params.name) {
    const id = `<input type="hidden" name="form" value="${params.name}" />`
    const str = `<form action="/save-form" method="post">${id}</form>`
    return { match: template, str }
  }
  return { match: template, str: '' }
}

/**
 * Load template from database and parse in parameter values.
 * @param template {!string} - A template expression.
 * @param name {!string} - The name of the template to load.
 * @param params {!Object} - An object that defines the parameters to use for
 *   the template as key/value pairs.
 * @param member {?Member} - The member that we're parsing this template for.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: *}|boolean>} - A Promise that
 *   resolves with an object with two properties: `str` (the string that should
 *   replace the template expression) and `match` (the template expression to
 *   replace). If no template could be loaded, it resolves with `false`.
 */

const loadTemplate = async (template, name, params, member, db) => {
  const matches = await Page.find({ title: name, type: 'Template' }, member, db)
  const match = matches && matches.length > 0 ? matches[0] : null
  if (match) {
    const body = match.history.getBody()
    const tagged = body.match(/{{Template}}(.+?){{\/Template}}/g)
    if (tagged) {
      let str = tagged[0].substr(12, tagged[0].length - 25)
      Object.keys(params).forEach(param => {
        const re = new RegExp(`{{{${param}}}}`, 'g')
        str = str.replace(re, params[param])
      })
      return { match: template, str }
    }
  }
  return { match: template, str: '' }
}

/**
 * Parse a single template expression.
 * @param template {!string} - The template expression to parse.
 * @param path {?string} - The path of the page we're parsing.
 * @param member {?Member} - The member we're parsing this tempalte for.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<{str: string, match: *}|boolean>} - A Promise that
 *   resolves with an object with two properties: `str` (the string that should
 *   replace the template expression) and `match` (the template expression to
 *   replace). If no template could be loaded, it resolves with `false`.
 */

const parseTemplate = async (template, path, member, db) => {
  const tpl = template.replace(/\n/g, '')
  const name = tpl.substr(2, tpl.length - 4).replace(/\s(.*?)=["“”](.*?)["“”]/g, '')
  const params = getParams(tpl)

  let res
  switch (name.toLowerCase()) {
    case 'artists':
      res = await loadArtists(template, member, db); break
    case 'novels':
      res = await loadNovels(template, member, db); break
    case 'children':
      res = await loadChildren(template, params, path, member, db); break
    case 'gallery':
      res = await loadChildren(template, params, path, member, db, true); break
    case 'download':
      res = await loadFile(template, params, path, member, db); break
    case 'art':
      res = await loadArt(template, params, path, member, db); break
    case 'form':
      res = await loadForm(template, params); break
    default:
      res = await loadTemplate(template, name, params, member, db); break
  }

  res.str = await parseTemplates(res.str, path, member, db)
  return res
}

/**
 * Parses templates.
 * @param str {!string} - The string to parse.
 * @param path {?string} - The path of the page that we're parsing.
 * @param member {?Member} - The person we're rendering these templates for.
 * @param db {!Pool} - The database connection.
 * @returns {Promise<string>} - A Promise that resolves with the string parsed,
 *   such that any template calls are replaced with the appropriate values for
 *   those templates.
 */

const parseTemplates = async (str, path, member, db) => {
  let templates = str.match(/{{((.*?)\n?)*?}}/gm)
  if (templates) {
    for (const template of templates) {
      const tpl = await parseTemplate(template, path, member, db)
      str = str.replace(tpl.match, tpl.str)
    }
  }
  return str
}

module.exports = parseTemplates
