const bcrypt = require('bcrypt')
const { escape } = require('sqlstring')
const jwt = require('jsonwebtoken')
const config = require('../config')

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

    this.nopass = obj ? !Boolean(obj.password) : true
    this.active = obj ? Boolean(obj.active) : false
    this.admin = obj ? Boolean(obj.admin) : false
    this.invitations = obj && !isNaN(obj.invitations) ? obj.invitations : 0
  }

  /**
   * Update a member record.
   * @param updates {!Object} - An object providing the updates to be made as
   *   key-value pairs.
   * @param editor {!Member} - The person making the update.
   * @param db {!Pool} - The database connection.
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
   * @param editor {!Member} - The member requesting the deactivation. Only an
   *   administrator can do this.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<OkPacket>} - A Promise that resolves when the update has
   *   been saved to the database.
   */

  async deactivate (editor, db) {
    if (editor && editor instanceof Member && editor.admin) {
      this.active = false
      return db.update([ { name: 'active', type: 'number' } ], { active: 0 }, 'members', this.id)
    }
  }

  /**
   * Reactivates a member.
   * @param editor {!Member} - The member requesting the reactivation. Only an
   *   administrator can do this.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<OkPacket>} - A Promise that resolves when the update has been
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
   * @param type {!string} - The type of the message. Valid types are defined
   *   by the keys of the object returned by `Member.getMessageTypes`
   * @param msg {!string} - The message to log.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<OkPacket>} - A Promise that resolves once the message
   *   has been logged to the database.
   */

  async logMessage (type, msg, db) {
    const valid = Member.getMessageTypes()
    const checked = Object.values(valid).includes(type) ? type : valid.info
    await db.run(`INSERT INTO messages (member, type, message) VALUES (${this.id}, ${escape(checked)}, ${escape(msg)});`)
  }

  /**
   * Fetches the member's messages and deletes them.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<{}>} - A Promise that resolves with an object containing
   *   the member's messages. The keys are the types of messages, and each is
   *   an array of strings, being the messages of that type.
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
   * Creates a new invitation.
   * @param addr {!string} - The email address to invite.
   * @param emailer {!function} - A function that can send an email.
   * @param db {!Pool} - A database connectionn.
   * @returns {Promise} - A promise that resolves when the invitation is sent.
   */

  async createInvitation (addr, emailer, db) {
    const msgTypes = Member.getMessageTypes()
    const name = this.name ? this.name : this.email ? this.email : `Member #${this.id}`
    const code = await Member.generateInvitationCode(db)
    const account = await db.run(`INSERT INTO members (email) VALUES ('${addr}');`)
    await db.run(`INSERT INTO invitations (inviteFrom, inviteTo, inviteCode) VALUES (${this.id}, ${account.insertId}, '${code}');`)
    if (!this.admin) {
      this.invitations = Math.max(this.invitations - 1, 0)
      await db.run(`UPDATE members SET invitations=${this.invitations} WHERE id=${this.id}`)
    }
    await emailer({
      to: addr,
      subject: 'Welcome to the Fifth World',
      body: `${name} has invited you to join the Fifth World. Click here to begin:\n\nhttps://thefifthworld.com/join/${code}`
    })
    await this.logMessage(msgTypes.confirm, `Invitation sent to **${addr}**.`, db)
  }

  /**
   * Sends a reminder email to someone who has received an invitation but has
   * not yet accepted it.
   * @param member {!Member} - The member who has not yet accepted her
   *   invitation.
   * @param emailer {!function} - A function that can send an email.
   * @param db {!Pool} - A database connection.
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
   * Send an invitation.
   * @param email {!string} - The email address to send an invitation to.
   * @param emailer {!function} - A function that can send an email.
   * @param db {!Pool} - A database connection.
   * @returns {Promise} - A promise that resolves once the request has been
   *   evaluated and handled.
   */

  async sendInvitation (addr, emailer, db) {
    const msgTypes = Member.getMessageTypes()
    if (this.invitations > 0) {
      const existing = await Member.load(addr, db)
      if (existing) {
        const hasPendingInvitation = await db.run(`SELECT id FROM invitations WHERE inviteTo=${existing.id} AND accepted=0;`)
        if (hasPendingInvitation.length > 0) {
          await this.sendReminder(existing, emailer, db)
        } else {
          const name = existing.name ? existing.name : existing.email ? existing.email : `Member #${existing.id}`
          await this.logMessage(msgTypes.info, `[${name}](/member/${existing.id}) is already a member.`, db)
        }
      } else {
        await this.createInvitation(addr, emailer, db)
      }
    } else {
      await this.logMessage(msgTypes.warning, `Sorry, you’ve run out of invitations. No invitation sent to **${addr}**.`, db)
    }
  }

  /**
   * Send several invitations at once.
   * @param addrs {!string[]} - An array of email addresses to send invitations
   *   to.
   * @param emailer {!function} - A function that can send an email.
   * @param db {!Pool} - A database connection.
   * @returns {Promise} - A Promise that resolves once invitations have been
   *   processed for each email address in the given array.
   */

  async sendInvitations (addrs, emailer, db) {
    for (const addr of addrs) {
      await this.sendInvitation(addr, emailer, db)
    }
  }

  /**
   * Returns an array of the members that this member invited.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<Member[]>} - A Promise that resolves with an array of
   *   the people that the member has invited.
   */

  async getInvited (db) {
    const accounts = []
    const rows = await db.run(`SELECT inviteTo, accepted FROM invitations WHERE inviteFrom=${this.id};`)
    if (rows) {
      for (const row of rows) {
        const member = await Member.load(row.inviteTo, db)
        accounts.push(Object.assign({}, member, { accepted: Boolean(row.accepted) }))
      }
    }
    return accounts
  }

  /**
   * Saves the OAuth 2.0 token that a user ha received.
   * @param provider {string} - A string identifying the service that has
   *   provided the token (e.g., `patreon`, `github`, `facebook`, or
   *   `twitter`).
   * @param id {string} - The ID from the OAuth 2.0 token.
   * @param token {string} - The token provided.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the OAuth 2.0
   *   token has been saved to the database.
   */

  async saveAuth (provider, id, token, db) {
    const existing = await db.run(`SELECT id FROM authorizations WHERE provider=${escape(provider)} AND member=${escape(this.id)};`)
    if (existing && existing.length > 0) {
      await db.run(`UPDATE authorizations SET oauth2_id=${escape(id)}, oauth2_token=${escape(token)} WHERE id=${existing[0].id};`)
    } else {
      await db.run(`INSERT INTO authorizations (member, provider, oauth2_id, oauth2_token) VALUES (${escape(this.id)}, ${escape(provider)}, ${escape(id)}, ${escape(token)});`)
    }
  }

  /**
   * Return an object representing the member's data, sans private attributes
   * like password, email, number of invitations, and active status.
   * @params fields {string[]?} - Optional. An array of fields to remove from
   *   the returned object. (Default: `[ 'password', 'email', 'invitations',
   *   'active' ]`)
   * @returns {Object} - An object representing the member's data, sans private
   *   attributes like password and email.
   */

  privatize (fields = [ 'password', 'email', 'invitations', 'active' ]) {
    const cpy = JSON.parse(JSON.stringify(this))
    fields.forEach(key => { delete cpy[key] })
    return cpy
  }

  /**
   * Generate a new JSON Web Token for the user.
   * @returns {undefined|*}
   */

  generateJWT () {
    const options = {
      expiresIn: '900s',
      issuer: config.jwt.domain,
      subject: `${config.jwt.domain}/members/${this.id}`
    }
    return jwt.sign(this.privatize([ 'password' ]), config.jwt.secret, options)
  }

  /**
   * Load a Member instance from the database.
   * @param id {!number|string} - Either the primary key or the email address of
   *   the member to load.
   * @param db {!Pool} - The database connection.
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
   * Convenience function that gets the Member ID from the JSON Web Token and
   * passes it to Member.load, allowing you to get a Member instance directly
   * from a JSON Web Token.
   * @param token {string} - A JSON Web Token.
   * @param db {Pool} - The database connection.
   * @returns {Promise<Member|undefined>} - A Promise that resolves either with
   *   the Member instance of the logged in member if the JSON Web Token can be
   *   verified and matched, or `undefined` if it could not be.
   */

  static async loadFromJWT (token, db) {
    const payload = await jwt.verify(token, config.jwt.secret)
    return payload && payload.id ? Member.load(payload.id, db) : null
  }

  /**
   * Load a Member instance from an authorization.
   * @param provider {string} - A string identifying the service that has
   *   provided the token (e.g., `patreon`, `github`, `facebook`, or
   *   `twitter`).
   * @param id {string} - The OAuth 2.0 token ID being submitted.
   * @param db {Pool} - The database connection.
   * @returns {Promise<Member|null>} - The Member instance associated with
   *   the authorization provided if it could be found, or `null` if it could
   *   not be.
   */

  static async loadFromAuth (provider, id, db) {
    const mid = await Member.getIDFromAuth(provider, id, db)
    if (mid) {
      return Member.load(mid, db)
    } else {
      return null
    }
  }

  /**
   * Load a Member's ID from an authorization.
   * @param provider {string} - A string identifying the service that has
   *   provided the token (e.g., `patreon`, `github`, `facebook`, or
   *   `twitter`).
   * @param id {string} - The OAuth 2.0 token ID being submitted.
   * @param db {Pool} - The database connection.
   * @returns {Promise<number|null>} - The Member ID associated with the
   *   authorization provided if it could be found, or `null` if it could
   *   not be.
   */

  static async getIDFromAuth (provider, id, db) {
    const rows = await db.run(`SELECT member FROM authorizations WHERE provider=${escape(provider)} AND oauth2_id=${escape(id)};`)
    if (rows && rows.length > 0) {
      return rows[0].member
    } else {
      return null
    }
  }

  /**
   * Checks if a member with the given email and password exists. If she does,
   * it returns her ID. If not — either because the email is not associated
   * with any member account, or it is associated with a member account but the
   * password provided does not match that account — it returns `false`.
   * @param creds {!Object} - An object with the user's credentials. This can
   *   provide two string properties, `email` and `password`, to provide the
   *   email address and passphrase, or this can provide three string
   *   properties, `service`, `id`, and `token`, indicating an OAuth 2.0
   *   service, ID, and token that should be used to authenticate the user.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<boolean|number>} - A Promise that resolves, either with
   *   the member's ID if she could be authenticated, or `false` if she could
   *   not be.
   */

  static async authenticate (creds, db) {
    if (creds) {
      if (creds.email && creds.password) {
        const row = await db.run(`SELECT id, password FROM members WHERE email=${escape(creds.email)};`)
        if (row.length > 0) {
          if (bcrypt.compareSync(creds.password, row[0].password)) return row[0].id
        }
      } else if (creds.provider && creds.id) {
        const mid = await Member.getIDFromAuth(creds.provider, creds.id, db)
        return mid || false
      }
    }
    return false
  }

  /**
   * Accepts an invitation.
   * @param code {!string} - The invitation code for the invitation being
   *   accepted.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<Member>} - A Promise that resolves with the Member
   *   instance of the account associated with the invitation that has been
   *   accepted.
   */

  static async acceptInvitation (code, db) {
    const check = await db.run(`SELECT inviteTo FROM invitations WHERE inviteCode=${escape(code)};`)
    if (check.length > 0) {
      await db.run(`UPDATE invitations SET accepted=1 WHERE inviteCode=${escape(code)};`)
      const member = await Member.load(check[0].inviteTo, db)
      return member
    } else {
      return undefined
    }
  }

  /**
   * Checks if the `editor` has permission to edit the member account of
   * `subject`.
   * @param subject {!Member} - A member account to be edited.
   * @param editor {!Member} - A member who would like to edit the account of
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
   * @param orig {!string} - The string to hash.
   * @returns {string} - The encrypted hash of the original string.
   */

  static hash (orig) {
    return bcrypt.hashSync(orig, bcrypt.genSaltSync(8), null)
  }

  /**
   * Generates a random code that isn't already in use.
   * @param db {!Pool} - The database connection.
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
}

module.exports = Member
