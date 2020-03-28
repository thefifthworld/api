/* global describe, it, expect, afterAll */

const db = require('../db')
const LinkHandler = require('../models/linkhandler')
const Member = require('../models/member')
const Page = require('../models/page')
const parseLinks = require('./links')
const testUtils = require('../test-utils')

describe('parseLinks', () => {
  afterAll(() => { db.end() })

  it('parses links', async () => {
    expect.assertions(3)
    await testUtils.createTestPage(Page, Member, db)
    const actual = await parseLinks('Here\'s a link: [[Test Page | hello]]', db)
    await testUtils.resetTables(db)
    expect(actual.str).toEqual('Here\'s a link: <a href="/test-page" title="Test Page">hello</a>')
    expect(actual.linkHandler).toBeInstanceOf(LinkHandler)
    expect(actual.linkHandler.links).toEqual([ { text: 'hello', title: 'Test Page', path: '/test-page', isNew: false } ])
  })

  it('parses new links', async () => {
    expect.assertions(3)
    const actual = await parseLinks('Here\'s a link: [[hello]]', db)
    expect(actual.str).toEqual('Here\'s a link: <a href="/new?title=hello" class="isNew">hello</a>')
    expect(actual.linkHandler).toBeInstanceOf(LinkHandler)
    expect(actual.linkHandler.links).toEqual([ { text: 'hello', title: 'hello', path: '/new?title=hello', isNew: true } ])
  })
})
