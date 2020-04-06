const mysql = require('mysql')
const { escape } = require('sqlstring')
const config = require('./config')

const db = mysql.createPool(config.db)

/**
 * We add a new method to our instance that allows us to query the database
 * with a Promise.
 * @param query {!string} - A MySQL query to execute.
 * @returns {Promise} - A promise that resolves with the results of the query.
 */

db.run = query => {
  return new Promise((resolve, reject) => {
    db.query(query, (err, rows, fields) => {
      if (err) {
        console.error(query)
        reject(err)
      } else {
        resolve(rows, fields)
      }
    })
  })
}

/**
 * Run an update.
 * @param fields {!Object[]} - An array of objects that define the fields that
 *   can be updated. Each object should have a `name` property, providing the
 *   name of the column in the database, and a `type` property that identifies
 *   the type of data that column holds (just `string` or `number`).
 * @param updates {!Object} - An object providing the updates to be made as
 *   key-value pairs (the names of the fields, as provided to the `fields`
 *   argument, should be the keys for this object).
 * @param table {!string} - The name of the table to update.
 * @param id {!number} - The primary key of the object to update.
 * @returns {Promise<OkPacket>} - A Promise that resolves when the query has
 *   been built and executed.
 */

db.update = (fields, updates, table, id) => {
  const validKeys = fields.map(field => field.name)
  const types = {}
  fields.forEach(field => {
    types[field.name] = field.type
  })

  const statements = []
  Object.keys(updates).forEach(update => {
    if (validKeys.includes(update)) {
      let val = updates[update]
      if (val === null || val === '') {
        val = 'NULL'
      } else {
        val = escape(val)
      }
      statements.push(`${update}=${val}`)
    }
  })

  if (statements.length > 0) {
    const query = `UPDATE ${table} SET ${statements.join(', ')} WHERE id=${id};`
    return db.run(query)
  }
}

module.exports = db
