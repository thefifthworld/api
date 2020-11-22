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
    const actual = await parseLinks('Here\'s some links: [[Test Page | hello]] [[Test Page]]', db)
    await testUtils.resetTables(db)
    expect(actual.str).toEqual('Here\'s some links: <a href="/test-page" title="Test Page">hello</a> <a href="/test-page">Test Page</a>')
    expect(actual.linkHandler).toBeInstanceOf(LinkHandler)
    expect(actual.linkHandler.links).toHaveLength(2)
  })

  it('parses new links', async () => {
    expect.assertions(3)
    const actual = await parseLinks('Here\'s a link: [[hello]]', db)
    expect(actual.str).toEqual('Here\'s a link: <a href="/new?title=hello" class="isNew">hello</a>')
    expect(actual.linkHandler).toBeInstanceOf(LinkHandler)
    expect(actual.linkHandler.links).toEqual([ { id: null, text: 'hello', title: 'hello', path: '/new?title=hello', isNew: true } ])
  })

  it('doesn\'t parse tags', async () => {
    expect.assertions(3)
    const actual = await parseLinks('Here\'s a tag: [[World:Hello]]', db)
    expect(actual.str).toEqual('Here\'s a tag: [[World:Hello]]')
    expect(actual.linkHandler).toBeInstanceOf(LinkHandler)
    expect(actual.linkHandler.links).toEqual([])
  })
})
