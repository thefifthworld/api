/* global describe, it, expect, afterAll */

const bcrypt = require('bcrypt')
const db = require('./db')
const utils = require('./test-utils')

describe('populateMembers', () => {
  it('adds an administrator', async () => {
    expect.assertions(4)
    await utils.populateMembers(db)
    const actual = await db.run('SELECT * FROM members WHERE email=\'admin@thefifthworld.com\';')
    await utils.resetTables(db, 'members')
    expect(actual[0].name).toEqual('Admin')
    expect(actual[0].email).toEqual('admin@thefifthworld.com')
    expect(bcrypt.compareSync('password', actual[0].password)).toEqual(true)
    expect(actual[0].admin).toEqual(1)
  })

  it('adds a normal member', async () => {
    expect.assertions(4)
    await utils.populateMembers(db)
    const actual = await db.run('SELECT * FROM members WHERE email=\'normal@thefifthworld.com\';')
    await utils.resetTables(db, 'members')
    expect(actual[0].name).toEqual('Normal')
    expect(actual[0].email).toEqual('normal@thefifthworld.com')
    expect(bcrypt.compareSync('password', actual[0].password)).toEqual(true)
    expect(actual[0].admin).toEqual(0)
  })

  it('adds another member', async () => {
    expect.assertions(4)
    await utils.populateMembers(db)
    const actual = await db.run('SELECT * FROM members WHERE email=\'other@thefifthworld.com\';')
    await utils.resetTables(db, 'members')
    expect(actual[0].name).toEqual('Other')
    expect(actual[0].email).toEqual('other@thefifthworld.com')
    expect(bcrypt.compareSync('password', actual[0].password)).toEqual(true)
    expect(actual[0].admin).toEqual(0)
  })
})

describe('resetTables', () => {
  it('removes all rows', async () => {
    expect.assertions(1)
    await utils.populateMembers(db)
    await utils.resetTables(db, 'members')
    const actual = await db.run('SELECT * FROM members;')
    expect(actual).toHaveLength(0)
  })

  it('resets the auto-increment', async () => {
    expect.assertions(1)
    await utils.populateMembers(db)
    await utils.resetTables(db, 'members')
    await utils.populateMembers(db)
    const actual = await db.run('SELECT id FROM members WHERE email=\'admin@thefifthworld.com\';')
    await utils.resetTables(db, 'members')
    expect(actual[0].id).toEqual(1)
  })

  it('can clear multiple tables', async () => {
    expect.assertions(1)
    await utils.populateMembers(db)
    await db.run('INSERT INTO authorizations (member, provider, oauth2_id, oauth2_token) VALUES (1, \'test\', \'test\', \'test\');')
    await utils.resetTables(db, 'authorizations', 'members')
    const checkMembers = await db.run('SELECT * FROM members')
    const checkAuth = await db.run('SELECT * FROM authorizations')
    expect(checkMembers.length + checkAuth.length).toEqual(0)
  })
})

afterAll(() => {
  db.end()
})
