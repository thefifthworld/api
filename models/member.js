const bcrypt = require('bcrypt')

class Member {
  constructor (obj) {
    const keys = [ 'id', 'name', 'password', 'apikey', 'email', 'bio' ]
    keys.forEach(key => {
      if (obj && obj[key]) this[key] = obj[key]
    })

    const services = [ 'facebook', 'twitter', 'github', 'patreon', 'web' ]
    this.links = {}
    services.forEach(service => {
      if (obj && obj[service]) this.links[service] = obj[service]
    })

    this.active = obj ? Boolean(obj.active) : false
    this.admin = obj ? Boolean(obj.admin) : false
    this.invitations = obj && !isNaN(obj.invitations) ? obj.invitations : 0
  }

  /**
   * Update a member record.
   * @param updates {Object} - An object providing the updates to be made as
   *   key-value pairs.
   * @param editor {Member} - The person making the update.
   * @param db {Pool} - The database connection.
   * @returns {Promise<boolean>} - A Promise that returns with `true` if the
   *   update could be made, or `false` if not.
   */

  async update (updates, editor, db) {
    if (Member.canEdit(this, editor)) {
      const fields = [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'bio', type: 'string' },
        { name: 'facebook', type: 'string' },
        { name: 'twitter', type: 'string' },
        { name: 'github', type: 'string' },
        { name: 'patreon', type: 'string' },
        { name: 'web', type: 'string' }
      ]

      if (updates.password) {
        updates.password = Member.hash(updates.password)
        fields.push({ name: 'password', type: 'string' })
      }

      Object.keys(updates).forEach(update => {
        this[update] = updates[update]
      })

      await db.update(fields, updates, 'members', this.id)
      return true
    }
    return false
  }

  /**
   * Load a Member instance from the database.
   * @param id {number} - The primary key for the member account to load.
   * @param db {Pool} - The database connection.
   * @returns {Promise<Member|undefined>} - a Member instance loaded with the
   *   information from the database matching the primary key provided if the
   *   record could be found, or `undefined` if it could not.
   */

  static async load (id, db) {
    const row = await db.run(`SELECT * FROM members WHERE id=${id};`)
    if (row.length > 0) {
      return new Member(row[0])
    } else {
      return undefined
    }
  }

  /**
   * Checks if the `editor` has permission to edit the member account of
   * `subject`.
   * @param subject {Member} - A member account to be edited.
   * @param editor {Member} - A member who would like to edit the account of
   *   `subject`.
   * @returns {boolean} - `true` if `editor` has permission to edit the member
   *   account of `subject`, or `false` if she does not.
   */

  static canEdit (subject, editor) {
    const subjectIsMember = subject instanceof Member
    const editorIsMember = editor instanceof Member
    const editorIsSubject = subject.id === editor.id
    return subjectIsMember && editorIsMember && (editorIsSubject || Boolean(editor.admin))
  }

  /**
   * Returns an encrypted hash of a string.
   * @param orig {string} - The string to hash.
   * @returns {string} - The encrypted hash of the original string.
   */

  static hash (orig) {
    return bcrypt.hashSync(orig, bcrypt.genSaltSync(8), null)
  }
}

module.exports = Member
