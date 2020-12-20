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
        if (name && params) handler.add(name, params)
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
