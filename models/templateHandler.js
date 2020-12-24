const slugify = require('slugify')
const { escape } = require('sqlstring')

class TemplateHandler {
  constructor (models) {
    this.instances = {}
    this.models = models
  }

  /**
   * Add a template object.
   * @param name {string} - The name of the template being used.
   * @param obj {object} - Key/value pairs for any parameters used by the
   *   template instance.
   */

  add (name, obj) {
    if (!this.instances[name]) this.instances[name] = []
    this.instances[name].push(Object.assign({}, obj))
  }

  /**
   * Render a page as a gallery item.
   * @param page {Page} - A page to render as a gallery item. Only a pages with
   *   image files attached should be rendered as gallery items.
   * @returns {string|null} - A Promise that resolves, either with the HTML
   *   with which to render the page as a gallery item, or `null` if the page
   *   is not appropriate to list in a gallery for some reason (for example,
   *   if it does not have any files attached to it).
   */

  renderGalleryItem (page) {
    const { files } = page
    if (Array.isArray(files) && files.length > 0) {
      const { fileHandler } = this.models
      const { name, thumbnail } = files[0]
      const getURL = fileHandler && fileHandler.getURL && typeof fileHandler.getURL === 'function'
        ? fileHandler.getURL
        : str => str
      const src = thumbnail ? getURL(thumbnail) : name ? getURL(name) : null
      const img = src ? `<img src="${src}" alt="${page.title}" />` : null
      return img ? `<li><a href="${page.path}">${img}</a></li>` : null
    } else {
      return null
    }
  }

  /**
   * Save templates to the database.
   * @param id {number} - The ID of the page that these templates belong to.
   * @param db {Pool} - The database connection.
   * @returns {Promise<unknown[]>} - A Promise that resolves when the templates have
   *   been saved to the database.
   */

  async save (id, db) {
    await db.run(`DELETE FROM templates WHERE page=${escape(id)};`)
    const inserts = []
    Object.keys(this.instances).forEach(template => {
      this.instances[template].forEach((instance, index) => {
        const cpy = Object.assign({}, instance)
        delete cpy.originalWikitext
        const num = cpy.instance || index
        Object.keys(cpy).forEach(parameter => {
          inserts.push(db.run(`INSERT INTO templates (page, template, instance, parameter, value) VALUES (${escape(id)}, ${escape(template)}, ${escape(num)}, ${escape(parameter)}, ${escape(instance[parameter])});`))
        })
      })
    })
    return Promise.all(inserts)
  }

  /**
   * Render a {{Children}} or {{Gallery}} template.
   * @param instance {object} - The parameters supplied for this instance of
   *   the template's use.
   * @param options {object} - Options necessary for rendering templates.
   * @param options.asGallery {boolean} - Whether or not to render the child
   *   pages found as a gallery (Default: `false`).
   * @param options.member {Member} - The member requesting this rendering.
   * @param options.path {string} - The path of the page being rendered.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the instance has
   *   been rendered, and the HTML markup saved to a new property named
   *   `markup`.
   */

  async renderChildren (instance, options, db) {
    const { asGallery, member, path, ordered } = options
    const parent = instance.of || path
    const type = asGallery ? 'Art' : instance.type || null
    const order = asGallery ? 'newest' : instance.order || 'alphabetical'
    const getChildrenOf = this.models.page && typeof this.models.page.getChildrenOf === 'function'
      ? this.models.page.getChildrenOf
      : async () => []
    const children = await getChildrenOf(parent, { type, member, order }, db)
    if (children && asGallery) {
      const items = children.map(child => this.renderGalleryItem(child)).filter(c => c !== null)
      instance.markup = items.length > 0
        ? `<ul class="thumbnails">${items.join('')}</ul>`
        : ''
    } else if (children) {
      const items = children.map(child => `<li><a href="${child.path}">${child.title}</a></li>`)
      const tag = ordered ? 'ol' : 'ul'
      instance.markup = `<${tag}>${items.join('')}</${tag}>`
    }
  }

  /**
   * Render the {{Arists}} template, which lists all of the artists listed on
   * the site, each with a gallery of their four most recent works.
   * @param instance {object} - The parameters supplied for this instance of
   *   the template's use.
   * @param options {object} - Options necessary for rendering templates.
   * @param options.member {Member} - The member requesting this rendering.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the instance has
   *   been rendered by adding a new `markup` property to it with the rendered
   *   markup for that instance.
   */

  async renderArtists (instance, options, db) {
    instance.markup = ''
    const finder = this.models.page && typeof this.models.page.find === 'function'
      ? this.models.page.find
      : async () => []
    const getChildrenOf = this.models.page && typeof this.models.page.getChildrenOf === 'function'
      ? this.models.page.getChildrenOf
      : async () => []
    const artists = await finder({ type: 'Artist' }, options.member, db)
    if (artists && artists.length > 0) {
      const sections = []
      for (const artist of artists) {
        const work = await getChildrenOf(artist.id, { type: 'Art', member: options.member, order: 'newest' }, db)
        const show = work ? work.slice(0, 4) : []
        const gallery = show && show.length > 0
          ? `<ul class="thumbnails">${show.map(piece => this.renderGalleryItem(piece)).join('')}</ul>`
          : null
        if (gallery) sections.push(`<section class="artist"><h2><a href="${artist.path}">${artist.title}</a></h2>${gallery}</section>`)
      }
      instance.markup = sections.join('')
    }
  }

  /**
   * Render the {{Art}} or {{Download}} templates.
   * @param instance {object} - The parameters supplied for this instance of
   *   the template's use.
   * @param options {object} - Options necessary for rendering templates.
   * @param options.member {Member} - The member requesting this rendering.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the instance has
   *   been rendered by adding a new `markup` property to it with the rendered
   *   markup for that instance.
   */

  async renderFile (instance, options, db) {
    instance.markup = ''
    const p = instance.file || instance.src || options.path || null
    const getIfAllowed = this.models.page && typeof this.models.page.getIfAllowed === 'function'
      ? this.models.page.getIfAllowed
      : async () => []
    const page = p ? await getIfAllowed(p, options.member, db) : null
    if (page && page.files && Array.isArray(page.files) && page.files.length > 0) {
      const file = page.files[0]
      const getURL = this.models.fileHandler && typeof this.models.fileHandler.getURL === 'function'
        ? this.models.fileHandler.getURL
        : str => str
      if (options.art) {
        const open = instance.numbered ? '<figcaption class="numbered">' : '<figcaption>'
        const caption = instance.caption ? `${open}${instance.caption}</figcaption>` : null
        const alt = instance.caption || page.title
        const img = instance.useThumbnail && file.thumbnail
          ? `<img src="${getURL(file.thumbnail)}" alt="${alt}" />`
          : `<img src="${getURL(file.name)}" alt="${alt}" />`
        const link = `<a href="${page.path}">${img}</a>`
        instance.markup = caption ? `<figure>${link}${caption}</figure>` : `<figure>${link}</figure>`
      } else {
        const getFileSizeStr = this.models.fileHandler && typeof this.models.fileHandler.getFileSizeStr === 'function'
          ? this.models.fileHandler.getFileSizeStr
          : str => str
        const name = `<span class="label">${file.name}</span>`
        const size = `<span class="details">${file.mime}; ${getFileSizeStr(file.size)}</span>`
        instance.markup = `<a href="${getURL(file.name)}" class="download">${name}${size}</a>`
      }
    }
  }

  /**
   * Render the {{Form}} template.
   * @param instance {object} - The parameters supplied for this instance of
   *   the template's use.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the instance has
   *   been rendered by adding a new `markup` property to it with the rendered
   *   markup for that instance.
   */

  async renderForm (instance, db) {
    instance.markup = ''
    if (instance.name) {
      const id = `<input type="hidden" name="form" value="${instance.name}" />`
      const fields = instance.fields.match(/{(.*?)}/g).map(str => {
        const components = str.slice(1, str.length - 1).split('|').map(s => s.trim())
        if (components.length === 3) {
          const id = slugify(`form ${instance.name} ${components[0]}`, { lower: true, strict: true })
          const name = slugify(components[0], { lower: true, strict: true })
          const note = components[1] && components[1] !== ''
            ? `<p class="note">${components[1]}</p>`
            : ''
          const label = `<label for="${id}">${components[0]}${note}</label>`
          const field = components[2] === 'textarea'
            ? `<textarea id="${id}" name="${name}"></textarea>`
            : `<input type="${components[2]}" id="${id}" name="${name}" />`
          return `${label}${field}`
        } else {
          return null
        }
      }).filter(f => f !== null)
      instance.markup = `<form action="/save-form" method="post">${id}${fields.join('')}<button>Send</button></form>`
    }
  }

  /**
   * Render the {{Novels}} template, which provides a gallery of novels with
   * their covers.
   * @param instance {object} - The parameters supplied for this instance of
   *   the template's use.
   * @param options {object} - Options necessary for rendering templates.
   * @param options.member {Member} - The member requesting this rendering.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the instance has
   *   been rendered by adding a new `markup` property to it with the rendered
   *   markup for that instance.
   */

  async renderNovels (instance, options, db) {
    instance.markup = ''
    const { member } = options
    const finder = this.models.page && typeof this.models.page.find === 'function'
      ? this.models.page.find
      : async () => []
    const getChildrenOf = this.models.page && typeof this.models.page.getChildrenOf === 'function'
      ? this.models.page.getChildrenOf
      : async () => []
    const getURL = this.models.fileHandler && typeof this.models.fileHandler.getURL === 'function'
      ? this.models.fileHandler.getURL
      : str => str
    const novels = await finder({ type: 'Novel' }, options.member, db)
    if (novels && novels.length > 0) {
      const list = []
      for (const novel of novels) {
        const art = await getChildrenOf(novel, { type: 'Art', member, order: 'newest' }, db)
        const covers = art ? art.filter(a => Object.keys(a.tags).includes('cover')) : []
        const cover = covers.length > 0 ? covers[0] : null
        if (cover && cover.files && cover.files.length > 0) {
          list.push(`<li><a href="${novel.path}"><img src="${getURL(cover.files[0].name)}" alt="${novel.title}" /></a></li>`)
        }
      }
      if (list.length > 0) instance.markup = `<ul class="novel-listing">${list.join('')}</ul>`
    }
  }

  /**
   * Render the {{Tagged}} template, which provides a list of pages that have
   * a particular tag set to a particular value.
   * @param instance {object} - The parameters supplied for this instance of
   *   the template's use.
   * @param options {object} - Options necessary for rendering templates.
   * @param options.member {Member} - The member requesting this rendering.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the instance has
   *   been rendered by adding a new `markup` property to it with the rendered
   *   markup for that instance.
   */

  async renderTagged (instance, options, db) {
    instance.markup = ''
    if (instance.tag && instance.value) {
      const tags = {}
      tags[instance.tag] = instance.value
      const finder = this.models.page && typeof this.models.page.find === 'function'
        ? this.models.page.find
        : async () => []
      const pages = await finder({ tags }, options.member, db)
      if (pages && pages.length > 0) {
        const items = pages.map(p => `<li><a href="${p.path}">${p.title}</a></li>`)
        instance.markup = `<ul>${items.join('')}</ul>`
      }
    }
  }

  /**
   * Render a default template.
   * @param template {string} - The name of the template.
   * @param instance {object} - The parameters supplied for this instance of
   *   the template's use.
   * @param options {object} - Options necessary for rendering templates.
   * @param options.member {Member} - The member requesting this rendering.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the instance has
   *   been rendered by adding a new `markup` property to it with the rendered
   *   markup for that instance.
   */

  async renderDefault (template, instance, options, db) {
    instance.markup = ''
    const matches = await this.models.page.find({ title: template, type: 'Template' }, options.member, db)
    const match = matches && matches.length > 0 ? matches[0] : null
    if (match) {
      const body = match.history.getBody()
      const tagged = body.match(/{{Template}}(.+?){{\/Template}}/g)
      if (tagged) {
        let str = tagged[0].substr(12, tagged[0].length - 25)
        Object.keys(instance).forEach(param => {
          const re = new RegExp(`{{{${param}}}}`, 'g')
          str = str.replace(re, instance[param])
        })
        instance.markup = str
      }
    }
  }

  /**
   * Render the templates. Each template listed in the `instances` property
   * renders a new `markup` property, providing the render version of that
   * template instance.
   * @param options {object} - Options necessary for rendering templates.
   * @param options.path {string} - The path of the page that the template is
   *   being rendered on.
   * @param options.member {Member} - The member requesting this rendering.
   * @param db {Pool} - The database connection.
   * @return Promise<unknown[]> - A Promise that resolves when each template
   *   instance has been rendered.
   */

  async render (options, db) {
    const renderings = []
    Object.keys(this.instances).forEach(template => {
      this.instances[template].forEach(instance => {
        switch (template) {
          case 'Art': renderings.push(this.renderFile(instance, Object.assign({}, options, { art: true }), db)); break
          case 'Artists': renderings.push(this.renderArtists(instance, options, db)); break
          case 'Children': renderings.push(this.renderChildren(instance, options, db)); break
          case 'Download': renderings.push(this.renderFile(instance, options, db)); break
          case 'Form': renderings.push(this.renderForm(instance, db)); break
          case 'Gallery': renderings.push(this.renderChildren(instance, Object.assign({}, options, { asGallery: true }), db)); break
          case 'Novels': renderings.push(this.renderNovels(instance, options, db)); break
          case 'Tagged': renderings.push(this.renderTagged(instance, options, db)); break
          default: renderings.push(this.renderDefault(template, instance, options, db)); break
        }
      })
    })
    return Promise.all(renderings)
  }

  /**
   * Parse a string for template expressions.
   * @param str {string} - A string to parse for template expressions.
   * @param models {object} - Models to pass to the constructor.
   * @param models.Page {function} - The Page model to use.
   * @param models.fileHandler {function} - The FileHandler model to use.
   * @returns {TemplateHandler} - A TemplateHandler loaded with the templates
   *   expressed in the string.
   */

  static parse (str, models) {
    const handler = new TemplateHandler(models)
    const templates = str.match(/{{((.*?)\n?)*?}}/gm)
    if (templates) {
      for (const template of templates) {
        const tpl = template.replace(/\n/g, '')
        const name = tpl.substr(2, tpl.length - 4).replace(/\s(.*?)=["“”](.*?)["“”]/g, '')
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
        if (name && params) handler.add(name, Object.assign({}, params, { originalWikitext: template }))
      }
    }
    return handler
  }

  /**
   * Loaod a page's templates from the database.
   * @param id {number} - The page's ID number.
   * @param db {Pool} - The database connection.
   * @returns {Promise<TemplateHandler>} - A Promise that resolves with a
   *   TemplateHandler loaded with the templates and parameters saved for this
   *   given page in the database.
   */

  static async load (id, db) {
    const handler = new TemplateHandler()
    const { instances } = handler
    const rows = await db.run(`SELECT * FROM templates WHERE page=${escape(id)} ORDER BY instance ASC;`)
    if (rows) {
      rows.forEach(row => {
        if (!instances[row.template]) instances[row.template] = []
        while (row.instance >= instances[row.template].length) instances[row.template].push({})
        if (row.parameter && row.value) instances[row.template][row.instance][row.parameter] = row.value
      })
    }
    return handler
  }
}

module.exports = TemplateHandler
