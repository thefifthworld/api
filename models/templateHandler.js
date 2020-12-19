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
   * Save templates to the database.
   * @param id {number} - The ID of the page that these templates belong to.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the templates have
   *   been saved to the database.
   */

  async save (id, db) {
    // We could potentially chew through an awful lot of ID's and land
    // ourselves in a tricky situation if we just rely on auto-incrementing
    // on every save, so let's take the extra effort to figure out what we can
    // update, and what we need to delete or insert.

    const newRows = []
    const templates = Object.keys(this.templates)
    for (let i = 0; i < templates.length; i++) {
      const params = Object.keys(this.templates[templates[i]])
      for (let j = 0; j < params.length; j++) {
        newRows.push({ template: templates[i], parameter: params[j], value: this.templates[templates[i]][params[j]] })
      }
    }

    const q = await db.run(`SELECT * FROM templates WHERE page=${escape(id)};`)
    const oldRows = Array.from(q)

    const del = []
    const ins = []
    const upd = []

    for (let i = 0; i < newRows.length; i++) {
      const nr = newRows[i]
      const hasSameParam = oldRows.filter(or => or.template === nr.template && or.parameter === nr.parameter)
      if (hasSameParam.length > 0) {
        upd.push(Object.assign({}, hasSameParam[0], nr))
      } else {
        ins.push(nr)
      }
    }

    for (let i = 0; i < oldRows.length; i++) {
      const or = oldRows[i]
      const hasSameParam = newRows.filter(nr => nr.template === or.template && nr.parameter === or.parameter)
      if (hasSameParam.length === 0) {
        del.push(or)
      }
    }

    for (let i = 0; i < del.length; i++) {
      await db.run(`DELETE FROM templates WHERE id=${escape(del[i].id)};`)
    }

    for (let i = 0; i < ins.length; i++) {
      await db.run(`INSERT INTO templates (page, template, parameter, value) VALUES (${escape(id)}, ${escape(ins[i].template)}, ${escape(ins[i].parameter)}, ${escape(ins[i].value)});`)
    }

    for (let i = 0; i < upd.length; i++) {
      await db.run(`UPDATE templates SET value=${escape(upd[i].value)} WHERE id=${upd[i].id};`)
    }
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
