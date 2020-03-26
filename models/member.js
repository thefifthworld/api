const bcrypt = require('bcrypt')
const sqlstring = require('sqlstring')
const { escape } = sqlstring

class Member {
  constructor (obj) {
    const keys = [ 'id', 'name', 'password', 'email', 'bio' ]
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

      if (updates !== {}) await db.update(fields, updates, 'members', this.id)
      return true
    }
    return false
  }

  /**
   * Deactivates a member.
   * @param editor {Member} - The member requesting the deactivation. Only an
   *   administrator can do this.
   * @param db {Pool} - The database connection.
   * @returns {Promise<any>} - A Promise that resolves when the update has been
   *   saved to the database.
   */

  async deactivate (editor, db) {
    if (editor && editor instanceof Member && editor.admin) {
      this.active = false
      return db.update([ { name: 'active', type: 'number' } ], { active: 0 }, 'members', this.id)
    }
  }

  /**
   * Reactivates a member.
   * @param editor {Member} - The member requesting the reactivation. Only an
   *   administrator can do this.
   * @param db {Pool} - The database connection.
   * @returns {Promise<any>} - A Promise that resolves when the update has been
   *   saved to the database.
   */

  async reactivate (editor, db) {
    if (editor && editor instanceof Member && editor.admin) {
      this.active = true
      return db.update([ { name: 'active', type: 'number' } ], { active: 1 }, 'members', this.id)
    }
  }

  /**
   * Logs a message to the database.
   * @param type {string} - The type of the message. Valid types are defined by
   *   the keys of the object returned by `Member.getMessageTypes`
   * @param msg {string} - The message to log.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves once the message has
   *   been logged to the database.
   */

  async logMessage (type, msg, db) {
    const valid = Member.getMessageTypes()
    const checked = Object.values(valid).includes(type) ? type : valid.info
    await db.run(`INSERT INTO messages (member, type, message) VALUES (${this.id}, ${escape(checked)}, ${escape(msg)});`)
  }

  /**
   * Fetches the member's messages and deletes them.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves with an object
   *   containing the member's messages. The keys are the types of messages,
   *   and each is an array of strings, being the messages of that type.
   */

  async getMessages (db) {
    const res = {}
    const messages = await db.run(`SELECT * FROM messages WHERE member=${this.id}`)
    if (messages.length > 0) {
      for (const msg of messages) {
        if (res[msg.type]) {
          res[msg.type] = [ ...res[msg.type], msg.message ]
        } else {
          res[msg.type] = [ msg.message ]
        }
        await db.run(`DELETE FROM messages WHERE id=${msg.id};`)
      }
    }
    return res
  }

  /**
   * Sends a reminder email to someone who has received an invitation but has
   * not yet accepted it.
   * @param member {Member} - The member who has not yet accepted her
   *   invitation.
   * @param emailer {func} - A function that can send an email.
   * @param db {Pool} - A database connection.
   * @returns {Promise} - A promise that resolves when the reminder email has
   *   been sent.
   */

  async sendReminder (member, emailer, db) {
    const msgTypes = Member.getMessageTypes()
    const name = this.name ? this.name : this.email ? this.email : `Fifth World Member #${this.id}`
    const invitation = await db.run(`SELECT inviteCode FROM invitations WHERE inviteTo=${member.id} AND accepted=0;`)
    if (invitation.length > 0) {
      const { inviteCode } = invitation[0]
      await emailer({
        to: member.email,
        subject: 'Your invitation to the Fifth World is waiting',
        body: `${name} wants to remind you that you’ve been invited to join the Fifth World. Click here to begin:\n\nhttps://thefifthworld.com/join/${inviteCode}`
      })
      await this.logMessage(msgTypes.confirm, `**${member.email}** already had an invitation, so we sent a reminder.`, db)
    }
  }

  /**
   * Load a Member instance from the database.
   * @param id {number|string} - Either the primary key or the email address of
   *   the member to load.
   * @param db {Pool} - The database connection.
   * @returns {Promise<Member|undefined>} - a Member instance loaded with the
   *   information from the database matching the primary key provided if the
   *   record could be found, or `undefined` if it could not.
   */

  static async load (id, db) {
    const query = typeof id === 'string'
      ? `SELECT * FROM members WHERE email=${escape(id)};`
      : `SELECT * FROM members WHERE id=${id};`
    const row = await db.run(query)
    if (row.length > 0) {
      return new Member(row[0])
    } else {
      return undefined
    }
  }

  /**
   * Checks if a member with the given email and password exists. If she does,
   * it returns her ID. If not — either because the email is not associated
   * with any member account, or it is associated with a member account but the
   * password provided does not match that account — it returns `false`.
   * @param email {string} - The member's email.
   * @param password {string} - The member's password (unencrypted).
   * @param db {Pool} - The database connection.
   * @returns {Promise<boolean|number>} - A Promise that resolves, either with
   *   the member's ID if she could be authenticated, or `false` if she could
   *   not be.
   */

  static async authenticate (email, password, db) {
    const row = await db.run(`SELECT id, password FROM members WHERE email=${escape(email)};`)
    if (row.length > 0) {
      if (bcrypt.compareSync(password, row[0].password)) return row[0].id
    }
    return false
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

  /**
   * Return an object defining the types of messages that a member account can
   * log to the database.
   * @returns {{confirm: string, warning: string, error: string, info: string}}
   */

  static getMessageTypes () {
    return {
      confirm: 'confirmation',
      error: 'error',
      warning: 'warning',
      info: 'info'
    }
  }

  /**
   * Generates a random code that isn't already in use.
   * @param db {Pool} - The database connection.
   * @returns {Promise<string>} - A Promise that resolves with a random code.
   */

  static async generateInvitationCode (db) {
    let code = ''
    while (code === '') {
      code = Math.random().toString(36).replace('0.', '')
      const check = await db.run(`SELECT id FROM invitations WHERE inviteCode='${code}';`)
      if (check.length > 0) code = ''
    }
    return code
  }
}

module.exports = Member
