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
