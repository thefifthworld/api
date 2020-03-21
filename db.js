const mysql = require('mysql')
const config = require('./config')

const db = mysql.createPool(config.db)

/**
 * We add a new method to our instance that allows us to query the database
 * with a Promise.
 * @param query {string} - A MySQL query to execute.
 * @returns {Promise} - A promise that resolves with the results of the query.
 */

db.run = (query) => {
  return new Promise((resolve, reject) => {
    db.query(query, (err, rows, fields) => {
      if (err) {
        reject(err)
      } else {
        resolve(rows, fields)
      }
    })
  })
}

module.exports = db
