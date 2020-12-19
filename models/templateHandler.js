const { escape } = require('sqlstring')

class TemplateHandler {
  constructor () {
    this.templates = {}
  }

  /**
   * Add a template object.
   * @param name {string} - The name of the template being used.
   * @param obj {object} - Key/value pairs for any parameters used by the
   *   template instance.
   */

  add (name, obj) {
    this.templates[name] = Object.assign({}, obj)
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
    const rows = await db.run(`SELECT * FROM templates WHERE page=${escape(id)};`)
    if (rows) {
      rows.forEach(row => {
        if (!handler.templates[row.template]) handler.templates[row.template] = {}
        if (row.parameter && row.value) handler.templates[row.template][row.parameter] = row.value
      })
    }
    return handler
  }
}

module.exports = TemplateHandler
