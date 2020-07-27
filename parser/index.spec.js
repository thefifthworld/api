/* global describe, it, expect, afterAll */

const db = require('../db')
const Member = require('../models/member')
const Page = require('../models/page')
const testUtils = require('../test-utils')
const parser = require('./index')

describe('Parser', () => {
  afterAll(() => { db.end() })

  it('renders markdown', async () => {
    expect.assertions(1)
    const actual = await parser('*Hello* **[world](https://thefifthworld.com)**', null, null, db)
    expect(actual.html).toEqual('<p><em>Hello</em> <strong><a href="https://thefifthworld.com">world</a></strong></p>\n')
  })

  it('renders HTML', async () => {
    expect.assertions(1)
    const actual = await parser('<em>Hello</em> <strong><a href="https://thefifthworld.com">world</a></strong>', null, null, db)
    expect(actual.html).toEqual('<p><em>Hello</em> <strong><a href="https://thefifthworld.com">world</a></strong></p>\n')
  })

  it('doesn\'t wrap block HTML', async () => {
    expect.assertions(1)
    const actual = await parser('<aside><em>Hello</em> <strong><a href="https://thefifthworld.com">world</a></strong></aside>', null, null, db)
    expect(actual.html).toEqual('<aside><em>Hello</em> <strong><a href="https://thefifthworld.com">world</a></strong></aside>')
  })

  it('finds tags', async () => {
    expect.assertions(2)
    const actual = await parser('This [[Hello:World]] is [[Hello : Test]] text [[Tag: 1]] outside of tags.\n\nAnd here is a [[Test:true]] second paragraph.', null, null, db)
    expect(actual.html).toEqual('<p>This is text outside of tags.</p>\n<p>And here is a second paragraph.</p>\n')
    expect(actual.tagHandler.tags).toEqual({ hello: [ 'World', 'Test' ], tag: [ '1' ], test: [ 'true' ] })
  })

  it('doesn\'t parse tags that are inside code blocks', async () => {
    expect.assertions(1)
    const actual = await parser('```\n[[Test:Hello]]\n```\n\nThis is outside of the code block.', null, null, db)
    expect(actual.html).toEqual('<pre><code>\n[[Test:Hello]]\n</code></pre>\n<p>This is outside of the code block.</p>\n')
  })

  it('parses links', async () => {
    expect.assertions(2)
    await testUtils.createTestPage(Page, Member, db)
    const actual = await parser('[[Test Page | Hello]]', null, null, db)
    await testUtils.resetTables(db)
    expect(actual.html).toEqual('<p><a href="/test-page" title="Test Page">Hello</a></p>\n')
    expect(actual.linkHandler.links).toEqual([ { id: 1, text: 'Hello', title: 'Test Page', path: '/test-page', isNew: false } ])
  })

  it('parses new links', async () => {
    expect.assertions(2)
    const actual = await parser('[[Test Page | Hello]]', null, null, db)
    expect(actual.html).toEqual('<p><a href="/new?title=Test%20Page" class="isNew">Hello</a></p>\n')
    expect(actual.linkHandler.links).toEqual([ { id: null, text: 'Hello', title: 'Test Page', path: '/new?title=Test%20Page', isNew: true } ])
  })

  it('parses templates', async () => {
    expect.assertions(1)
    await testUtils.populateMembers(db)
    const editor = await Member.load(2, db)
    const data = { title: 'Test', body: '{{Template}}Hello world!{{/Template}} [[Type:Template]]' }
    await Page.create(data, editor, 'Initial text', db)
    const actual = await parser('{{Test}}', null, null, db)
    await testUtils.resetTables(db)
    expect(actual.html).toEqual('<p>Hello world!</p>\n')
  })
})
