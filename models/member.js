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
}

module.exports = Member
