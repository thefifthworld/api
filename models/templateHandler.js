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
        const num = instance.instance || index
        Object.keys(instance).forEach(parameter => {
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
   * Render the {{Tagged}} template, which provides a list of pages that have
   * a particular tag set to a particular value.
   * @param instance {object} - The parameters supplied for this instance of
   *   the template's use.
   * @param options {object} - Options necessary for rendering templates.
   * @param options.member {Member} - The member requesting this rendering.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>}
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
          case 'Children': renderings.push(this.renderChildren(instance, options, db)); break
          case 'Gallery': renderings.push(this.renderChildren(instance, Object.assign({}, options, { asGallery: true }), db)); break
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
   * @returns {TemplateHandler} - A TemplateHandler loaded with the templates
   *   expressed in the string.
   */

  static parse (str) {
    const handler = new TemplateHandler()
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
