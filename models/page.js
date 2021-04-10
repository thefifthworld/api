const { escape } = require('sqlstring')
const slugify = require('slugify')
const History = require('./history')
const FileHandler = require('./fileHandler')
const LikesHandler = require('./likesHandler')
const LinkHandler = require('./linkhandler')
const LocationHandler = require('./locationHandler')
const TagHandler = require('./taghandler')
const TemplateHandler = require('./templateHandler')
const parsePlainText = require('../parser/plain')

class Page {
  constructor (page = {}, changes = []) {
    const toCopy = [ 'id', 'title', 'description', 'slug', 'path', 'parent', 'depth', 'permissions',
      'type', 'tags', 'templates', 'location', 'likes', 'files' ]
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
   * Prepares the Page object for export through the API.
   * @returns {object} - An object representation of this Page instance ready
   *   to be delivered through the API.
   */

  export () { return Page.export(this) }

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
    const templateHandler = TemplateHandler.parse(data.body, { page: Page, fileHandler: FileHandler })
    const tagHandler = TagHandler.parse(data.body).tagHandler
    const locationHandler = tagHandler && Object.keys(tagHandler.tags).includes('location')
      ? new LocationHandler(tagHandler.get('location', true).split(',').map(el => el.trim()))
      : undefined

    const title = data.title || ''
    const slug = data.slug || slugify(title, { lower: true, strict: true })
    const parent = data.parent ? await Page.get(data.parent, db) : null
    const givenPath = data.path ? data.path : parent ? `${parent.path}/${slug}` : `/${slug}`
    const path = givenPath.substr(0, 1) === '/' ? givenPath : `/${givenPath}`

    /**
     * Determine type.
     * Default to what's given by a form field, or what we can parse from the
     * body. If it has a location, it's definitely a place. If we don't have a
     * type yet, but we have a file upload, then it's Art if the file is an
     * image, or a File if it's anything else.
     */

    let type = data.type || tagHandler.get('type', true) || this.type
    if (locationHandler) type = 'Place'
    if (!type && data.files && data.files.file) {
      type = data.files.file.mimetype.startsWith('image/') ? 'Art' : 'File'
    }

    if (Page.isReservedPath(path)) {
      throw new Error(`We reserve ${path} for internal use.`)
    } else if (Page.isReservedTemplate(type, title)) {
      throw new Error(`We use {{${title}}} internally. You cannot create a template with that name.`)
    } else if (Page.hasNumericalLastElement(path)) {
      throw new Error('Please don’t end a path with a number. That makes it difficult for the system to tell the difference between pages and versions of pages.')
    } else {
      const assign = { title, slug, path, type }
      Object.keys(assign).forEach(key => { this[key] = assign[key] })
      this.parent = parent && parent.id ? parent.id : 0
      this.depth = parent ? parent.depth + 1 : 0
      this.description = data.description || Page.getDescription(data.body)
      this.image = data.image
      this.header = data.header
      this.permissions = data.permissions || 774
      this.lineage = await this.getLineage(db)

      this.tags = tagHandler
      this.templates = templateHandler
      this.location = locationHandler
      const links = await LinkHandler.parse(data.body, db)
      this.links = links.linkHandler

      try {
        if (!this.saved) {
          await this.insert(data, editor, msg, db)
        } else {
          await this.update(data, editor, msg, db)
        }

        try {
          await db.run(`UPDATE links SET dest=${this.id}, title=${escape(this.title)} WHERE (LOWER(title)=${escape(this.title.toLowerCase())} OR LOWER(title)=${escape(this.path.toLowerCase())}) AND dest IS NULL;`)
        } catch {
          console.error('Failed to update links table')
        }

        if (data.files) {
          const fileHandler = await FileHandler.handle(data.files, this, editor)
          await fileHandler.save(db)
          this.files = await FileHandler.load(this, db)
        }

        if (this.location) await this.location.save(this.id, db)
        if (this.tags) await this.tags.save(this.id, db)
        if (this.templates) await this.templates.save(this.id, db)
        if (this.links) await this.links.save(this.id, db)
      } catch (err) {
        throw new Error(`Sorry, that won&rsquo;t work. A page with the path <code>${path}</code> already exists.`)
      }
    }
  }

  /**
   * Roll the page back to a previous version.
   * @param id {number} - The ID of the change to roll back to. If no change
   *   with this ID number can be found in the page's history, the method
   *   will not do anything.
   * @param editor {Member} - The person who is rolling the page back.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the page has been
   *   rolled back to the version specified.
   */

  async rollback (id, editor, db) {
    const change = this.history.getChange(id)
    if (change) {
      const copy = JSON.parse(JSON.stringify(change.content))
      delete copy.msg

      // Put together a commit message for the rollback
      const roller = editor.name || `Member #${editor.id}`
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
      const d = new Date(change.timestamp)
      const elems = []
      const h = d.getHours()
      const hrs = h === 0 ? 12 : h > 12 ? h - 12 : h
      const min = `${d.getMinutes()}`.padStart(2, '0')
      const ampm = h > 11 ? 'PM' : 'AM'
      elems.push(d.getDate())
      elems.push(months[d.getMonth()])
      elems.push(d.getFullYear())
      elems.push(`${hrs}:${min}`)
      elems.push(ampm)
      const orig = change.msg && change.msg.length > 0 ? ` Original message was: "${change.msg}"` : ''
      const msg = `${roller} rolled the page back to version #${change.id}, created by ${change.editor.name} on ${elems.join(' ')}.${orig}`

      // Actually do the rollback
      await this.save(copy, editor, msg, db)
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
        const changes = await db.run(`SELECT c.id AS id, c.timestamp AS timestamp, c.msg AS msg, c.json AS json, m.name AS editorName, m.email AS editorEmail, m.id AS editorID FROM changes c, members m WHERE c.editor=m.id AND c.page=${row.id} ORDER BY c.id ASC;`)
        row.location = await LocationHandler.load(row.id, db)
        const tagHandler = await TagHandler.load(row.id, db)
        row.tags = tagHandler.tags
        row.templates = await TemplateHandler.load(row.id, db)
        row.files = await FileHandler.load(row, db)
        row.likes = await LikesHandler.load(row, db)
        const page = new Page(row, changes)
        if (!page.lineage) page.lineage = await page.getLineage(db)
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
   * @param options {Object} - An object that passes options to the method.
   * @param options.type {?string} - Optional. If provided, then only child
   *   pages that match this type will be returned.
   * @param options.member {?Member} - Optional. The member requesting the list
   *   of children.
   * @param options.order {?string} - Optional. Indicates the order in which
   *   children should be ordered. Accepted values are `newest` (list the child
   *   pages from newest to oldest), `oldest` (list the child pages in the
   *   order that they were created, from oldest to newest), and `alphabetical`
   *   (list the child pages in alphabetical order by title).
   *   (Default: `oldest`)
   * @param db {!Pool} - The database connection.
   * @returns {Promise<Page[]>} - An array of Page objects that are child pages
   *   of the page identified by the `id` parameter (and optionally restricted
   *   to those that match the `type` parameter).
   */

  static async getChildrenOf (id, options, db) {
    const { type, member, order } = options
    const parent = await Page.get(id, db)
    if (parent) {
      const sort = order === 'alphabetical'
        ? 'ORDER BY title ASC'
        : order === 'newest'
          ? 'ORDER BY id DESC'
          : 'ORDER BY id ASC'
      const query = type
        ? `SELECT id FROM pages WHERE parent=${parent.id} AND type=${escape(type)} ${sort};`
        : `SELECT id FROM pages WHERE parent=${parent.id} ${sort};`
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
   * Performs a second database query as part of the `find` method, and then
   * combines its results with the existing results according to the provided
   * logic. By default, that means the intersection of the results provided and
   * the new results found, but if you pass `' OR '` for the `logic` parameter,
   * you can get the union of these two sets instead.
   * @param query {string} - The SQL query to execute.
   * @param existing {number[]} - The array of unique numerical IDs that
   *   constitute the existing matches.
   * @param logic {string=} - The logic to use when combining the `existing`
   *   set that you provide with the new results found. If set to `' AND '`,
   *   then you'll receive the intersection of the two sets (only those that
   *   match both criteria). If set to `' OR '`, you'll receive the union of
   *   the two sets (those that match any criteria). (Default: `' AND '`)
   * @param db {Pool} - The database connection.
   * @returns {Promise<number[]>} - A Promise that resolves with an array of
   *   unique ID numbers for the matching items.
   */

  static async subfind (query, existing, logic = ' AND ', db) {
    const rows = await db.run(query)
    const ids = rows.map(p => p.id)
    if (existing && Array.isArray(existing) > 0 && logic === ' OR ') {
      // "OR" means we return the union of the two sets
      return [...new Set([...existing, ...ids])]
    } else if (existing && Array.isArray(existing) > 0) {
      // "AND" means we return the intersection of the two sets
      return existing.filter(x => ids.includes(x))
    } else {
      // If we don't have any existing array, just return what we found here
      return ids
    }
  }

  /**
   * Find pages that match a query.
   * @param query {object} - An object representing the query being made.
   * @param query.path {?string} - Finds any pages with paths that begin with
   *   the given string.
   * @param query.title {?string} - Finds any pages that partially match the
   *   given string.
   * @param query.type {?string} - Finds any pages that match the given type.
   * @param query.tags {?Object} - Interprets the object as a series of
   *   key-value pairs, returning any pages that have tags where the tag name
   *   matches the key and the tag value matches the value.
   * @param query.hasTags (?string[]} - An array of strings to search for. It
   *   returns pages that have these tags, regardless of the value of those
   *   tags.
   * @param query.ancestor {?string|?number|?Page} - Finds pages that are
   *   descendants of the given page. This property can take a page's path, ID,
   *   or the Page object itself.
   * @param query.logic {?string} - Can be either `and` or `or`. Setting this
   *   to `or` will return any page that matches any given criteria. Setting it
   *   to `and` will only match pages that match all of the given criteria.
   *   (Default: `and`)
   * @param query.limit {?number} - The maximum number of results to return.
   *   (Default: 10)
   * @param query.offset {?number} - The number of results to skip (e.g., if
   *   paging through results). (Default: 0)
   * @param query.order {?string=} - How the pages should be ordered. Valid
   *   options are `alphabetical`, `reverse alphabetical`, `first created`,
   *   `last created`, `oldest update`, and `most recent update`
   *   (Default: `alphabetical`).
   * @param searcher {?Member} - The person who is searching.
   * @param db {Pool} - The database connection.
   * @returns {Promise<Page[]>} - A Promise that resolves with an array of
   *   pages that match your query.
   */

  static async find (query, searcher, db) {
    const pages = []
    const conditions = []
    if (query.path) { conditions.push(`path LIKE ${escape(`${query.path}%`)}`) }
    if (query.title) { conditions.push(`title LIKE ${escape(`%${query.title}%`)}`) }
    if (query.type) { conditions.push(`type=${escape(query.type)}`) }
    const limit = query.limit || 10
    const offset = query.offset || 0
    const logic = query.logic && query.logic.toLowerCase() === 'or' ? ' OR ' : ' AND '
    const clause = conditions.length > 0 ? `WHERE ${conditions.join(logic)}` : ''
    let order = 'title ASC'
    if (query.order && query.order.toLowerCase() === 'reverse alphabetical') {
      order = 'title DESC'
    } else if (query.order && query.order.toLowerCase() === 'first created') {
      order = 'created ASC'
    } else if (query.order && query.order.toLowerCase() === 'last created') {
      order = 'created DESC'
    } else if (query.order && query.order.toLowerCase() === 'oldest update') {
      order = 'updated ASC'
    } else if (query.order && query.order.toLowerCase() === 'most recent update') {
      order = 'updated DESC'
    }

    const q = `SELECT id, title, path, type, created, updated FROM (SELECT p.id, p.title, p.path, p.type, MIN(c.timestamp) AS created, MAX(c.timestamp) AS updated FROM changes c, pages p WHERE c.page=p.id GROUP BY c.page) AS changes ${clause} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset};`
    const rows = await db.run(q)
    let ids = rows ? rows.map(p => p.id) : null

    // Tags require a little extra work
    const tags = query.tags ? Object.keys(query.tags) : []
    if (Array.isArray(tags) && tags.length > 0) {
      for (const tag of tags) {
        const sql = `SELECT DISTINCT p.id FROM pages p LEFT JOIN tags t ON p.id=t.page WHERE t.tag=${escape(tag)} AND t.value=${escape(query.tags[tag])};`
        ids = await Page.subfind(sql, ids, logic, db)
      }
    }

    // Check for pages that have a tag, regardless of its value
    if (query.hasTags && Array.isArray(query.hasTags)) {
      for (const tag of query.hasTags) {
        const sql = `SELECT DISTINCT p.id FROM pages p LEFT JOIN tags t ON p.id=t.page WHERE t.tag=${escape(tag)};`
        ids = await Page.subfind(sql, ids, logic, db)
      }
    }

    // We have our ID, so load them as pages and return the array
    if (ids === null) ids = []
    for (let id of ids) {
      const page = await Page.getIfAllowed(id, searcher, db)
      const allTags = tags.map(t => t.toLowerCase())
      const pageTags = page && page.tags ? Object.keys(page.tags) : []
      const tagCheck = tags.length === 0 || allTags.filter(val => pageTags.includes(val)).length > 0
      const ancestor = query.ancestor && query.ancestor.path
        ? query.ancestor.path
        : !isNaN(query.ancestor)
          ? await Page.get(query.ancestor).path
          : query.ancestor
      const ancestorCheck = ancestor
        ? page && page.lineage.map(page => page.path).includes(ancestor)
        : true
      if (page && tagCheck && ancestorCheck) pages.push(page)
    }
    return pages
  }

  /**
   * Return the most recent changes that the user has permission to see.
   * @param num {number} - The number of updates to return. (Default: `10`)
   * @param searcher {?Member} - The Member instance for the person who is
   *   making this request. A full Member instance is not strictly necessary,
   *   though. An object with `id` (number) and `admin` (boolean) properties
   *   can suffice.
   * @param db {Pool} - The database connection.
   * @returns {Promise<[{ title: string, path: string, timestamp: number,
   *   editor: { id: number, name: string } }]>} - A Promise that resolves with
   *   an array of the most recent updates found in the database that the given
   *   user has permission to view.
   */

  static async getUpdates (num, searcher, db) {
    const changes = []
    const n = !isNaN(num) && num > 0 ? Math.min(num, 50) : 10
    const permissions = searcher
      ? searcher.admin
        ? ''
        : ` AND (p.owner=${escape(searcher.id)} OR LEFT(p.permissions, 1)='7' OR LEFT(p.permissions, 1)='6')`
      : ` AND LEFT(p.permissions, 1)='7'`
    const query = `SELECT DISTINCT p.id AS pid, MAX(c.id) AS cid FROM pages p, changes c WHERE p.id=c.page${permissions} GROUP BY p.id ORDER BY MAX(c.id) DESC LIMIT ${n}`;
    const updates = await db.run(query)
    if (updates && updates.length > 0) {
      for (let i = 0; i < updates.length; i++) {
        const q = `SELECT p.title, p.path, c.timestamp, m.id AS mid, m.name FROM pages p, changes c, members m WHERE p.id=c.page AND c.editor=m.id AND c.id=${updates[i].cid};`
        const records = await db.run(q)
        if (records && records.length > 0) {
          changes.push({
            title: records[0].title,
            path: records[0].path,
            timestamp: records[0].timestamp,
            editor: {
              id: records[0].mid,
              name: records[0].name
            }
          })
        }
      }
    }
    return changes
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
   * Tests if a path ends in a numerical element.
   * @param path {string} - The path to test.
   * @returns {boolean} - `true` if the given path ends in a numerical element,
   *   or `false` if it does not.
   */

  static hasNumericalLastElement (path) {
    const elements = path.split('/')
    const last = elements && Array.isArray(elements) && elements.length > 0
      ? elements[elements.length - 1]
      : null
    const parsed = parseInt(last)
    return last && !isNaN(parsed)
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

  /**
   * Prepares a Page object for export through the API.
   * @returns {object} - An object from the page suitable for export through
   *   the API.
   */

  static export (obj) {
    const copy = JSON.parse(JSON.stringify(obj))
    if (copy && copy.history && copy.history.changes) copy.history = copy.history.changes
    if (copy && copy.likes && copy.likes.ids) copy.likes = copy.likes.ids
    if (copy && copy.owner) delete copy.owner.email
    delete copy.saved

    // Clean up files
    if (copy && copy.files && Array.isArray(copy.files)) {
      copy.files.forEach(file => {
        delete file.saved
        delete file.page
      })
    }

    // Clean up lineage
    if (copy && copy.lineage && Array.isArray(copy.lineage)) {
      copy.lineage = copy.lineage.map(ancestor => {
        delete ancestor.history
        delete ancestor.likes
        delete ancestor.files
        delete ancestor.lineage
        return Page.export(ancestor)
      })
    }

    return copy
  }
}

module.exports = Page
