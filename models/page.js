const { escape } = require('sqlstring')
const TagHandler = require('./taghandler')
const parseTags = require('../parser/tags')

class Page {
  constructor (page = {}, changes = []) {
    const toCopy = [ 'id', 'title', 'description', 'slug', 'path', 'parent', 'type', 'depth', 'tags' ]
    toCopy.forEach(key => {
      this[key] = page[key]
    })

    this.changes = []

    changes.forEach(change => {
      this.changes.unshift({
        id: change.id,
        timestamp: new Date(change.timestamp * 1000),
        msg: change.msg,
        content: JSON.parse(change.json),
        editor: {
          name: change.editorName ? change.editorName : change.editorEmail ? change.editorEmail : `Member #${change.editorID}`,
          id: change.editorID
        }
      })
    })
  }

  /**
   * Creates a new page.
   * @param data {Object} - An object defining the data for the page. Expected
   *   properties include `path` (for the page's path), `title` (for the page's
   *   title), and `body` (for the wikitext of the page's main content).
   * @param editor {Member} - The member creating the page. This object must at
   *   least include an `id` property specifying the editor's member ID.
   * @param msg {string} - A commit message.
   * @param db {Pool} - A database connection.
   * @returns {Promise} - A promise that resolves with the newly created Page
   *   instance once it has been added to the database.
   */

  static async create (data, editor, msg, db) {
    const handler = parseTags(data.body).tags

    const title = data.title || ''
    const slug = data.slug || Page.slugify(title)
    const parent = data.parent ? await Page.get(data.parent, db) : null
    const pid = parent ? parent.id : 0
    const depth = parent ? parent.depth + 1 : 0
    const path = data.path || `/${slug}` // TODO: When you get the parent, use it here
    const description = data.description || '' // TODO: Parse a better description
    const image = data.image
    const header = data.header
    const permissions = data.permissions || 774
    const type = data.type || handler.get('type', true)
    // TODO: Parse location from body

    if (Page.isReservedPath(path)) {
      throw new Error(`We reserve ${path} for internal use.`)
    } else if (Page.isReservedTemplate(type, title)) {
      throw new Error(`We use {{${title}}} internally. You cannot create a template with that name.`)
    } else {
      try {
        const res = await db.run(`INSERT INTO pages (slug, path, parent, type, title, description, image, header, permissions, owner, depth) VALUES (${escape(slug)}, ${escape(path)}, ${pid}, ${escape(type)}, ${escape(title)}, ${escape(description)}, ${escape(image)}, ${escape(header)}, ${permissions}, ${editor.id}, ${depth});`)
        const id = res.insertId
        await db.run(`INSERT INTO changes (page, editor, timestamp, msg, json) VALUES (${id}, ${editor.id}, ${Math.floor(Date.now() / 1000)}, ${escape(msg)}, ${escape(JSON.stringify(data))});`)
        // TODO: setPlace
        if (handler) await handler.save(id, db)
        return Page.get(id, db)
      } catch (err) {
        throw err
      }
    }
  }

  /**
   * Returns a page from the database.
   * @param id {int|string|Page} - The ID or the path of a page, or a Page
   *   instance (in which case, it simply returns the page). This allows the
   *   method to take a wide range of identifiers and reliably return the
   *   correct object.
   * @param db {Pool} - A database connection.
   * @returns {Promise} - A promise that resolves with the Page object if it
   *   can be found, or `undefined` if it could not be found.
   */

  static async get (id, db) {
    if (id instanceof Page) return id
    if (id) {
      const column = typeof id === 'string' ? 'path' : 'id'
      const pages = await db.run(`SELECT * FROM pages WHERE ${column}=${escape(id)};`)
      const page = Array.isArray(pages) && pages.length > 0 ? pages[0] : undefined
      if (page) {
        const changes = await db.run(`SELECT c.id AS id, c.timestamp AS timestamp, c.msg AS msg, c.json AS json, m.name AS editorName, m.email AS editorEmail, m.id AS editorID FROM changes c, members m WHERE c.editor=m.id AND c.page=${page.id} ORDER BY c.timestamp DESC;`)
        changes.reverse()
        // TODO: Fetch location data
        const handler = await TagHandler.load(page.id, db)
        page.tags = handler.tags
        // TODO: Fetch file data
        // TODO: Fetch likes
        return new Page(page, changes)
      }
    }
    return undefined
  }

  /**
   * If passed the type and title to be used when saving a page, this method
   * returns `false` if the page is not a template or if it is a template with
   * a valid name (one that is not the name of an internal template). It will
   * return `true` if the type argument is equal to the string `'Template'` and
   * the title argument is one of the reserved, internal template names
   * (meaning that the page is not valid).
   * @param type {string} - The type of the page.
   * @param title {string} - The title of the page.
   * @returns {boolean} - `true` if the given arguments indicate that the page
   *   will conflict with reserved, internal templates, or `false` if not.
   */

  static isReservedTemplate (type, title) {
    const reservedTemplates = [ 'Template', 'Children', 'Gallery', 'Artists', 'Art', 'Download' ]
    return type === 'Template' && reservedTemplates.includes(title)
  }

  /**
   * Returns `true` if the path given matches the pattern for any of the
   * reserved paths (paths that are used internally, and so cannot be used for
   * any member-created pages). Returns `false` if the path does not match any
   * of those patterns (meaning it's safe to use).
   * @param path {string} - The path to check.
   * @returns {boolean} - A boolean indicating if the path matches a reserved
   *   pattern (`true`), or if it is safe to use (`false`).
   */

  static isReservedPath (path) {
    const reservedPaths = [
      /^\/login(\/(.*))?$/g,
      /^\/login-route(\/(.*))?$/g,
      /^\/logout(\/(.*))?$/g,
      /^\/connect(\/(.*))?$/g,
      /^\/disconnect(\/(.*))?$/g,
      /^\/member(\/(.*))?$/g,
      /^\/welcome(\/(.*))?$/g,
      /^\/invite(\/(.*))?$/g,
      /^\/join(\/(.*))?$/g,
      /^\/forgot-passphrase(\/(.*))?$/g,
      /^\/dashboard(\/(.*))?$/g,
      /^\/new(\/(.*))?$/g,
      /^\/upload(\/(.*))?$/g,
      /^\/autocomplete(\/(.*))?$/g,
      /^\/like(\/(.*))?$/g,
      /^\/unlike(\/(.*))?$/g,
      /^\/explore(\/(.*))?$/g
    ]
    return reservedPaths.reduce((acc, curr) => acc || (path.match(curr) !== null), false)
  }

  /**
   * Returns a "slugified" version of the original string.
   * @param str {string} - A string to "slugify."
   * @returns {string} - The "slugified" version of the original string.
   */

  static slugify (str) {
    const a = 'àáäâèéëêìíïîòóöôùúüûñçßÿœæŕśńṕẃǵǹḿǘẍźḧ·/_,:;'
    const b = 'aaaaeeeeiiiioooouuuuncsyoarsnpwgnmuxzh------'
    const p = new RegExp(a.split('').join('|'), 'g')

    if (!str) { return '' }

    return str.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(p, c => b.charAt(a.indexOf(c)))
      .replace(/&/g, '-and-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '')
  }
}

module.exports = Page
