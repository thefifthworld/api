const { escape } = require('sqlstring')
const slugify = require('slugify')
const History = require('./history')
const FileHandler = require('./fileHandler')
const TagHandler = require('./taghandler')
const LikesHandler = require('./likesHandler')
const LocationHandler = require('./locationHandler')
const parseTags = require('../parser/tags')
const parseLinks = require('../parser/links')
const parsePlainText = require('../parser/plain')

class Page {
  constructor (page = {}, changes = []) {
    const toCopy = [ 'id', 'title', 'description', 'slug', 'path', 'parent', 'depth', 'permissions',
      'type', 'tags', 'location', 'likes', 'files' ]
    toCopy.forEach(key => {
      this[key] = page[key]
    })

    this.owner = { id: page.ownerID, email: page.ownerEmail, name: page.ownerName }
    this.history = new History(changes)
    this.saved = false
  }

  /**
   * This method returns whether or not the person provided has a given type of
   * permissions for this page.
   * @param person {Member|null} - This parameter expects a Member object, or
   *   at least an object with the same properties. If given something else, it
   *   will evaluate permissions based on other (world) permissions.
   * @param level {int} - This parameter defines the type of permission
   *   requested: 4 to read or 6 to read and write.
   * @returns {boolean} - Returns `true` if the person given has the type of
   *   permissions requested, or `false` if she does not.
   */

  checkPermissions (person, level) {
    if (this.permissions !== undefined) {
      const p = typeof this.permissions === 'string'
        ? this.permissions.padStart(3, '0')
        : this.permissions.toString().padStart(3, '0')
      const owner = parseInt(p.charAt(0)) || 0
      const group = parseInt(p.charAt(1)) || 0
      const world = parseInt(p.charAt(2)) || 0

      if (person && person.admin) {
        return true
      } else if (person && this.owner && person.id === this.owner.id && owner >= level) {
        return true
      } else if (person && group >= level) {
        return true
      } else if (world >= level) {
        return true
      } else {
        return false
      }
    } else {
      return false
    }
  }

  /**
   * Insert a record for this page into the database.
   * @param data {!Object} - An object with the content of the page.
   * @param editor {!{ id: number, name: string }} - An object with information
   *   about the member who is creating the page.
   * @param msg {string=} - A commit message (Default: `Initial text`).
   * @param db {!Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the page's record
   *   has been created in the database.
   */

  async insert (data, editor, msg = 'Initial text', db) {
    try {
      const res = await db.run(`INSERT INTO pages (slug, path, parent, type, title, description, image, header, permissions, owner, depth) VALUES (${escape(this.slug)}, ${escape(this.path)}, ${this.parent}, ${escape(this.type)}, ${escape(this.title)}, ${escape(this.description)}, ${escape(this.image)}, ${escape(this.header)}, ${this.permissions}, ${editor.id}, ${this.depth});`)
      this.id = res.insertId
      this.saved = true
      await this.history.addChange(this.id, editor, msg, data, db)
    } catch (err) {
      throw err
    }
  }

  /**
   * Save an update to a page.
   * @param data {!Object} - An object with the changes to make to the page.
   * @param editor {!{ id: number, name: string }} - An object with information
   *   about the member who is creating the page.
   * @param msg {?string} - A commit message describing the change to make.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the page's record
   *   has been created in the database.
   */

  async update (data, editor, msg, db) {
    if (this.saved && this.id) {
      try {
        await db.run(`UPDATE pages SET slug=${escape(this.slug)}, path=${escape(this.path)}, parent=${this.parent}, type=${escape(this.type)}, title=${escape(this.title)}, description=${escape(this.description)}, image=${escape(this.image)}, header=${escape(this.header)}, permissions=${this.permissions}, depth=${this.depth} WHERE id=${this.id};`)
        await this.history.addChange(this.id, editor, msg, data, db)
      } catch (err) {
        throw err
      }
    }
  }

  /**
   * Save the current state of the page to the database.
   * @param data {!Object} - An object representing the changes to make.
   * @param editor {!{ id: number, name: string }} - An object representing the
   *   member making the change, including her primary key (`id`) and name
   *   (`string`).
   * @param msg {?string} - A commit message.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the changes have
   *   been made and saved to the database.
   */

  async save (data, editor, msg, db) {
    const tagHandler = parseTags(data.body).tagHandler
    const locationHandler = tagHandler && Object.keys(tagHandler.tags).includes('location')
      ? new LocationHandler(tagHandler.get('location', true).split(',').map(el => el.trim()))
      : undefined

    const title = data.title || ''
    const slug = data.slug || slugify(title, { lower: true })
    const parent = data.parent ? await Page.get(data.parent, db) : null
    const path = data.path ? data.path : parent ? `${parent.path}/${slug}` : `/${slug}`
    const type = locationHandler ? 'Place' : data.type || tagHandler.get('type', true)

    if (Page.isReservedPath(path)) {
      throw new Error(`We reserve ${path} for internal use.`)
    } else if (Page.isReservedTemplate(type, title)) {
      throw new Error(`We use {{${title}}} internally. You cannot create a template with that name.`)
    } else {
      const assign = { title, slug, path, type }
      Object.keys(assign).forEach(key => { this[key] = assign[key] })
      this.parent = parent && parent.id ? parent.id : 0
      this.depth = parent ? parent.depth + 1 : 0
      this.description = data.description || Page.getDescription(data.body)
      this.image = data.image
      this.header = data.header
      this.permissions = data.permissions || 774

      this.tags = tagHandler
      this.location = locationHandler
      const links = await parseLinks(data.body, db)
      this.links = links.linkHandler

      if (!this.saved) {
        await this.insert(data, editor, msg, db)
      } else {
        await this.update(data, editor, msg, db)
      }

      if (data.files) {
        const fileHandler = await FileHandler.handle(data.files, this, editor)
        await fileHandler.save(db)
        this.files = await FileHandler.load(this, db)
      }

      if (this.location) await this.location.save(this.id, db)
      if (this.tags) await this.tags.save(this.id, db)
      if (this.links) await this.links.save(this.id, db)
    }
  }

  /**
   * Return an array of the page's ancestors.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<Page[]>} - A Promise that resolves with an array of the
   *   page's ancestors, from its most distant ancestor to its direct parent.
   */

  async getLineage (db) {
    if (this.parent === 0) {
      return []
    } else {
      const parent = await Page.get(this.parent, db)
      const ancestors = await parent.getLineage(db)
      return [ ...ancestors, parent ]
    }
  }

  /**
   * Creates a new page.
   * @param data {!Object} - An object defining the data for the page. Expected
   *   properties include `path` (for the page's path), `title` (for the page's
   *   title), and `body` (for the wikitext of the page's main content).
   * @param editor {!Member} - The member creating the page. This object must
   *   at least include an `id` property specifying the editor's member ID.
   * @param msg {!string} - A commit message.
   * @param db {!Pool} - A database connection.
   * @returns {Promise} - A promise that resolves with the newly created Page
   *   instance once it has been added to the database.
   */

  static async create (data, editor, msg, db) {
    const page = new Page()
    await page.save(data, editor, msg, db)
    page.likes = new LikesHandler(page)
    return page
  }

  /**
   * Returns a page from the database.
   * @param id {!int|string|Page} - The ID, path, or title of a page, or a Page
   *   instance (in which case, it simply returns the page). This allows the
   *   method to take a wide range of identifiers and reliably return the
   *   correct object.
   * @param db {!Pool} - A database connection.
   * @returns {Promise} - A promise that resolves with the Page object if it
   *   can be found, or `undefined` if it could not be found.
   */

  static async get (id, db) {
    if (id instanceof Page) return id
    if (id) {
      const cond = typeof id === 'string' ? `(p.path=${escape(id)} OR p.title=${escape(id)})` : `p.id=${id}`
      const rows = await db.run(`SELECT p.*, m.id AS ownerID, m.email AS ownerEmail, m.name AS ownerName FROM pages p, members m WHERE ${cond} AND p.owner=m.id;`)
      const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : undefined
      if (row) {
        const changes = await db.run(`SELECT c.id AS id, c.timestamp AS timestamp, c.msg AS msg, c.json AS json, m.name AS editorName, m.email AS editorEmail, m.id AS editorID FROM changes c, members m WHERE c.editor=m.id AND c.page=${row.id} ORDER BY c.timestamp DESC;`)
        changes.reverse()
        row.location = await LocationHandler.load(row.id, db)
        const tagHandler = await TagHandler.load(row.id, db)
        row.tags = tagHandler.tags
        row.files = await FileHandler.load(row, db)
        row.likes = await LikesHandler.load(row, db)
        const page = new Page(row, changes)
        page.saved = true
        return page
      }
    }
    return undefined
  }

  /**
   * Returns a page from the database if the requester has read permission
   * for it.
   * @param id {!int|string|Page} - The ID or the path of a page, or a Page
   *   instance (in which case, it simply returns the page). This allows the
   *   method to take a wide range of identifiers and reliably return the
   *   correct object.
   * @param requester {!Member} - The person asking for the page.
   * @param db {!Pool} - A database connection.
   * @returns {Promise} - A promise that resolves with the Page object if it
   *   can be found, or `undefined` if it could not be found, or if the
   *   requester doesn't have permission for it.
   */

  static async getIfAllowed (id, requester, db) {
    const page = await Page.get(id, db)
    return page && page.checkPermissions(requester, 4) ? page : undefined
  }

  /**
   * Returns an array of the child pages of a given page.
   * @param id {!int|string|Page} - The ID or the path of a page, or a Page
   *   instance (in which case, it simply returns the page). This allows the
   *   method to take a wide range of identifiers and reliably return the
   *   correct object.
   * @param type {?string} - Optional. If provided, then only child pages that
   *   match this type will be returned.
   * @param member {?Member} - Optional. The member requesting the list of
   *   children.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<Page[]>} - An array of Page objects that are child pages
   *   of the page identified by the `id` parameter (and optionally restricted
   *   to those that match the `type` parameter).
   */

  static async getChildrenOf (id, type, member, db) {
    const parent = await Page.get(id, db)
    if (parent) {
      const query = type
        ? `SELECT id FROM pages WHERE parent=${parent.id} AND type=${escape(type)};`
        : `SELECT id FROM pages WHERE parent=${parent.id};`
      const rows = await db.run(query)
      const children = []
      for (const row of rows) {
        const child = await Page.getIfAllowed(row.id, member, db)
        if (child) children.push(child)
      }
      return children
    }
    return []
  }

  /**
   * Search for places near a center point.
   * @param center {(number|string)[]} - An array of two numbers or strings
   *   representing latitude in the first value and longitude in the second.
   * @param max {?number} - The maximum distance to search in meters
   *   (Default: `10000`).
   * @param searcher {?Member} - The person who is searching.
   * @param db {Pool} - The database connection.
   * @returns {Promise<Page[]>} - A Promise that resolves with an array of the
   *   pages that are within `max` meters of the coordinates provided.
   */

  static async placesNear (center, max, searcher, db) {
    if (!Array.isArray(center) || center.length < 2) return []
    const lat = LocationHandler.convertLatLon(center[0], 'lat')
    const lon = LocationHandler.convertLatLon(center[1], 'lon')
    const dist = max && !isNaN(max) ? max : 10000
    if (!lat || !lon) return []
    const radius = `ST_Distance_Sphere(places.location, ST_GeomFromText('POINT(${lat} ${lon})', 4326)) <= ${dist}`
    const rows = await db.run(`SELECT pages.id FROM pages, places WHERE ${radius} AND pages.id=places.page;`)
    if (rows && rows.length > 0) {
      const pages = []
      for (let row of rows) {
        const page = await Page.getIfAllowed(row.id, searcher, db)
        if (page) pages.push(page)
      }
      return pages
    } else {
      return []
    }
  }

  /**
   * Find pages that match a query.
   * @param query {{ ?path: string, ?title: string, ?type: string, ?tags: {},
   *   ?logic: string, ?limit: number, ?offset: number }} - An object
   *   representing the query being made.
   *   - `path` finds any pages that begin with that string.
   *   - `title` finds any pages that match that regex.
   *   - `type` finds any pages that match the given type.
   *   - `tags` finds any pages that have the tags (using key-value pairs).
   *   - `logic` can be either `and` or `or`, setting the query to either
   *       return any page that matches any of these criteria (`or`) or
   *       all of them (`and`). (Default: `and`)
   *   - `limit` is the maximum number of results to return.
   *   - `offset` is the number of results to skip.
   * @param searcher {?Member} - The person who is searching.
   * @param db {Pool} - The database connection.
   * @returns {Promise<Page[]>} - A Promise that resolves with an array of
   *   pages that match your query.
   */

  static async find (query, searcher, db) {
    const pages = []
    const conditions = []
    if (query.path) { conditions.push(`p.path LIKE ${escape(`${query.path}%`)}`) }
    if (query.title) { conditions.push(`p.title LIKE ${escape(`%${query.title}%`)}`) }
    if (query.type) { conditions.push(`p.type=${escape(query.type)}`) }
    if (query.tags) { conditions.push(...Object.keys(query.tags).map(tag => `t.tag=${escape(tag)} AND t.value=${escape(query.tags[tag])}`)) }
    const limit = query.limit || 10
    const offset = query.offset || 0
    const logic = query.logic === 'or' ? ' OR ' : ' AND '
    const clause = conditions.join(logic)
    if (clause.length > 0) {
      const rows = await db.run(`SELECT p.id FROM pages p LEFT JOIN tags t ON p.id=t.page WHERE ${clause} LIMIT ${limit} OFFSET ${offset};`)
      for (let row of rows) {
        const page = await Page.getIfAllowed(row.id, searcher, db)
        if (page) pages.push(page)
      }
    }
    return pages
  }

  /**
   * If passed the type and title to be used when saving a page, this method
   * returns `false` if the page is not a template or if it is a template with
   * a valid name (one that is not the name of an internal template). It will
   * return `true` if the type argument is equal to the string `'Template'` and
   * the title argument is one of the reserved, internal template names
   * (meaning that the page is not valid).
   * @param type {!string} - The type of the page.
   * @param title {!string} - The title of the page.
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
   * @param path {!string} - The path to check.
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
      /^\/checkpath(\/(.*))?$/g,
      /^\/like(\/(.*))?$/g,
      /^\/unlike(\/(.*))?$/g,
      /^\/explore(\/(.*))?$/g
    ]
    return reservedPaths.reduce((acc, curr) => acc || (path.match(curr) !== null), false)
  }

  /**
   * Return a description from a given string.
   * @param str {string} - The string to use to derive a description.
   * @returns {string} - A description derived from this string, by returning
   *   the first `cutoff` characters, trying to return full sentences or at
   *   least full words.
   */

  static getDescription (str) {
    // Google truncates descriptions to ~155-160 characters, so we want to make
    // a description that uses all the complete sentences that will fit into
    // that space.
    const cutoff = 150
    const safe = str || ''
    const txt = parsePlainText(safe)
    if (!txt || txt.length === 0) {
      // Things have gone wrong in a completely unexpected way. Return our
      // default description.
      return 'Four hundred years from now, humanity thrives beyond civilization.'
    } else if (txt.length < cutoff) {
      return txt.trim()
    } else {
      const sentences = txt.match(/[^\.!\?]+[\.!\?]+/g)
      let desc = sentences[0]
      let i = 1
      let ready = false
      if (desc.length < cutoff) {
        // The first sentence is not as long as the cutoff. How many sentences
        // can we add before we reach that limit?
        while (!ready) {
          const candidate = sentences.length > i ? `${desc.trim()} ${sentences[i].trim()}` : null
          if (!candidate || (candidate.length > cutoff) || (i === sentences.length - 1)) {
            ready = true
          } else {
            desc = candidate
            i++
          }
        }
      } else {
        // The first sentence is already beyond the cutoff, so let's truncate
        // it at the cutoff.
        const words = desc.split(' ')
        desc = words[0]
        while (!ready) {
          const candidate = words.length > i ? `${desc.trim()} ${words[i].trim()}` : null
          if (!candidate || (candidate.length > cutoff - 1) || (i === words.length - 1)) {
            ready = true
          } else {
            desc = candidate
            i++
          }
        }
        desc = `${desc}…`
      }
      return desc.trim()
    }
  }
}

module.exports = Page
