/* global describe, it, expect, afterAll */

const db = require('../db')
const Member = require('../models/member')
const Page = require('../models/page')
const parseLinks = require('./links')
const testUtils = require('../test-utils')

describe('parseLinks', () => {
  afterAll(() => { db.end() })

  it('parses links', async () => {
    expect.assertions(2)
    await testUtils.populateMembers(db)
    const editor = await Member.load(2, db)
    const data = { title: 'Test', body: 'This is a test.' }
    await Page.create(data, editor, 'Initial text', db)
    const actual = await parseLinks('Here\'s a link: [[Test | hello]]', db)
    await testUtils.resetTables(db, 'links', 'requested', 'changes', 'pages', 'members')
    expect(actual.str).toEqual('Here\'s a link: <a href="/test" title="Test">hello</a>')
    expect(actual.links).toEqual([ { text: 'hello', path: '/test', isNew: false } ])
  })

  it('parses new links', async () => {
    expect.assertions(2)
    const actual = await parseLinks('Here\'s a link: [[hello]]', db)
    expect(actual.str).toEqual('Here\'s a link: <a href="/new?title=hello" class="isNew">hello</a>')
    expect(actual.links).toEqual([ { text: 'hello', path: '/new?title=hello', isNew: true } ])
  })
})
