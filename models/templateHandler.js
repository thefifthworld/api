const { escape } = require('sqlstring')

class TemplateHandler {
  constructor () {
    this.instances = {}
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
    const versions = await db.run(`SELECT c.json, c.id FROM changes c, pages p WHERE p.title=${escape(template)} AND p.type="Template" AND c.page=p.id ORDER BY c.id DESC LIMIT 1;`)
    const version = versions && versions.length > 0 ? JSON.parse(versions[0].json) : null
    if (version && version.body) {
      const tagged = version.body.match(/{{Template}}(.+?){{\/Template}}/g)
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
          default: renderings.push(this.renderDefault(template, instance, options, db))
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
