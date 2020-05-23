/* global describe, it, expect, afterAll */

const md5 = require('md5')
const bcrypt = require('bcrypt')
const Member = require('./models/member')
const Page = require('./models/page')
const db = require('./db')
const utils = require('./test-utils')

describe('mockTXT', () => {
  it('returns a mock plain ASCII text file', () => {
    const file = utils.mockTXT()
    expect(file.data.byteLength).toEqual(file.size)
    expect(file.md5).toEqual(md5(file.data))
    expect(file.mimetype).toEqual('text/plain')
  })
})

describe('mockGIF', () => {
  it('returns a mock GIF file', () => {
    const file = utils.mockGIF()
    expect(file.data.byteLength).toEqual(file.size)
    expect(file.md5).toEqual(md5(file.data))
    expect(file.mimetype).toEqual('image/gif')
  })
})

describe('mockJPEG', () => {
  it('returns a mock JPEG file', () => {
    const file = utils.mockJPEG()
    expect(file.data.byteLength).toEqual(file.size)
    expect(file.md5).toEqual(md5(file.data))
    expect(file.mimetype).toEqual('image/jpeg')
  })
})

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

describe('createTestPage', () => {
  it('returns a test page', async () => {
    expect.assertions(2)
    const page = await utils.createTestPage(Page, Member, db)
    await utils.resetTables(db)
    expect(page).toBeInstanceOf(Page)
    expect(page.title).toEqual('Test Page')
  })
})

describe('resetTables', () => {
  it('removes all rows', async () => {
    expect.assertions(1)
    await utils.populateMembers(db)
    await utils.resetTables(db)
    const actual = await db.run('SELECT * FROM members;')
    expect(actual).toHaveLength(0)
  })

  it('resets the auto-increment', async () => {
    expect.assertions(1)
    await utils.populateMembers(db)
    await utils.resetTables(db)
    await utils.populateMembers(db)
    const actual = await db.run('SELECT id FROM members WHERE email=\'admin@thefifthworld.com\';')
    await utils.resetTables(db)
    expect(actual[0].id).toEqual(1)
  })
})

describe('checkURL', () => {
  it('fetches a URL', async () => {
    const res = await utils.checkURL('https://google.com')
    expect(res.status).toEqual(200)
  })
})

afterAll(() => { db.end() })
