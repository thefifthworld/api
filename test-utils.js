const Member = require('./models/member')
const sqlstring = require('sqlstring')
const { escape } = sqlstring

/**
 * Populates the database with member accounts for use in tests.
 * @param db {Pool} - The database connection.
 * @returns {Promise<void>} - A Promise that returns when the member accounts
 *   have been added to the database.
 */

const populateMembers = async (db) => {
  const password = Member.hash('password')
  await db.run(`INSERT INTO members (name, email, password, admin) VALUES ('Admin', 'admin@thefifthworld.com', ${escape(password)}, 1);`)
  await db.run(`INSERT INTO members (name, email, password) VALUES ('Normal', 'normal@thefifthworld.com', ${escape(password)});`)
  await db.run(`INSERT INTO members (name, email, password) VALUES ('Other', 'other@thefifthworld.com', ${escape(password)});`)
}

/**
 * Resets all of the tables specified.
 * @param db {Pool} - The database connection.
 * @param tables {string[]} - The names of the tables to reset.
 * @returns {Promise<void>} - A Promise that returns once all of the rows in
 *   each of the tables provided has been deleted, and the table's auto-
 *   increment index has been reset to zero.
 */

const resetTables = async (db, ...tables) => {
  for (const table of tables) {
    await db.run(`DELETE FROM ${table};`)
    await db.run(`ALTER TABLE ${table} AUTO_INCREMENT=1;`)
  }
}

module.exports = {
  populateMembers,
  resetTables
}
