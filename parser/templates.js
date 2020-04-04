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

const loadTemplate = async (template, db) => {
  const tpl = template.replace(/\n/g, '')
  const name = tpl.substr(2, tpl.length - 4).replace(/\s(.*?)=["“”](.*?)["“”]/g, '')
  const params = getParams(tpl)

  const res = await db.run(`SELECT c.json AS json FROM changes c, pages p WHERE p.id=c.page AND p.type='Template' AND p.title='${name}' ORDER BY p.depth ASC, c.timestamp DESC;`)
  if (res.length > 0) {
    const full = JSON.parse(res[0].json).body.replace(/\[\[Type:(.*?)\]\]/g, '').trim()
    const tagged = full.match(/{{Template}}(.+?){{\/Template}}/g)
    if (tagged) {
      let str = tagged[0].substr(12, tagged[0].length - 25)
      Object.keys(params).forEach(param => {
        const re = new RegExp(`{{{${param}}}}`, 'g')
        str = str.replace(re, params[param])
      })
      return { match: template, str }
    }
  }

  return false
}

const loadTemplates = async (templates, db) => {
  const loaded = []
  for (const template of templates) {
    const tpl = await loadTemplate(template, db)
    loaded.push(tpl)
  }
  return loaded.filter(tpl => tpl !== false)
}

/**
 * Parses templates.
 * @param str {string} - The string to parse.
 * @param db {Pool} - The database connection.
 * @returns {Promise<*>} - A Promise that resolves with the string parsed, such
 *   that any template calls are replaced with the appropriate values for those
 *   templates.
 */

const parseTemplates = async (str, db) => {
  let templates = str.match(/{{((.*?)\n?)*?}}/gm)
  if (templates) {
    templates = await loadTemplates(templates, db)
    templates.forEach(template => {
      str = str.replace(template.match, template.str)
    })
  }
  return str
}

module.exports = parseTemplates
