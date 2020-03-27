class Page {
  constructor (page = {}, changes = []) {
    const toCopy = [ 'id', 'title', 'description', 'slug', 'path', 'parent', 'type' ]
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
