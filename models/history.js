const { escape } = require('sqlstring')

class History {
  constructor (changes = []) {
    this.changes = changes.map(change => ({
      id: change.id,
      timestamp: new Date(change.timestamp * 1000),
      msg: change.msg,
      content: JSON.parse(change.json),
      editor: {
        name: change.editorName ? change.editorName : change.editorEmail ? change.editorEmail : `Member #${change.editorID}`,
        id: change.editorID
      }
    }))
    this.changes.reverse()
  }

  /**
   * Return the content as of the most recent change.
   * @returns {Object} - The content object.
   */

  getContent () {
    return this.changes[0].content
  }

  /**
   * Add a change to the history. This is saved to the database and added to
   * the current instance.
   * @param page {!int} - The primary key of the page that's being changed.
   * @param editor {!{ id: number, name: string }} - An object containing the
   *   primary key (`id`) and name (`name`) of the member making this change.
   * @param msg {!string} - A commit message for the change.
   * @param data {!Object} - An object containing the data being changed.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves once the database and
   *   the instance have both been updated with the new change.
   */

  async addChange (page, editor, msg, data, db) {
    try {
      const p = isNaN(page) ? await Page.load(page) : { id: page }
      const { id } = p
      const timestamp = Math.floor(Date.now() / 1000)
      const res = await db.run(`INSERT INTO changes (page, editor, timestamp, msg, json) VALUES (${id}, ${editor.id}, ${timestamp}, ${escape(msg)}, ${escape(JSON.stringify(data))});`)
      this.changes.unshift({ id: res.insertId, timestamp, msg, content: data, editor })
    } catch (err) {
      console.error(err)
    }
  }
}

module.exports = History
