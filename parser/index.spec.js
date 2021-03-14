/* global describe, it, expect, afterAll */

const db = require('../db')
const Member = require('../models/member')
const Page = require('../models/page')
const testUtils = require('../test-utils')
const parser = require('./index')

describe('Parser', () => {
  afterAll(() => { db.end() })

  it('renders false as an empty string', async () => {
    expect.assertions(1)
    const actual = await parser(false, null, null, db)
    expect(actual.html).toEqual('')
  })

  it('renders markdown', async () => {
    expect.assertions(1)
    const actual = await parser('*Hello* **[world](https://thefifthworld.com)**', null, null, db)
    expect(actual.html).toEqual('<p><em>Hello</em> <strong><a href="https://thefifthworld.com">world</a></strong></p>\n')
  })

  it('renders an external link with a title', async () => {
    expect.assertions(1)
    const actual = await parser('[You can also provide a title along with your external links.](https://thefifthworld.com "The Fifth World Homepage")', null, null, db)
    expect(actual.html).toEqual('<p><a href="https://thefifthworld.com" title="The Fifth World Homepage">You can also provide a title along with your external links.</a></p>\n')
  })

  it('renders a table with pretty markdown', async () => {
    expect.assertions(1)
    const actual = await parser('| Tables        | Are           | Cool  |\n' +
      '| ------------- |:-------------:| -----:|\n' +
      '| col 3 is      | right-aligned | $1600 |\n' +
      '| col 2 is      | centered      |   $12 |\n' +
      '| zebra stripes | are neat      |    $1 |')
    expect(actual.html).toEqual('<table>\n' +
      '<thead>\n' +
      '<tr><th>Tables</th><th style="text-align:center">Are</th><th style="text-align:right">Cool</th></tr>\n' +
      '</thead>\n' +
      '<tbody>\n' +
      '<tr><td>col 3 is</td><td style="text-align:center">right-aligned</td><td style="text-align:right">$1600</td></tr>\n' +
      '<tr><td>col 2 is</td><td style="text-align:center">centered</td><td style="text-align:right">$12</td></tr>\n' +
      '<tr><td>zebra stripes</td><td style="text-align:center">are neat</td><td style="text-align:right">$1</td></tr>\n' +
      '</tbody>\n' +
      '</table>\n')
  })

  it('renders a table with simple markdown', async () => {
    expect.assertions(1)
    const actual = await parser('Markdown | Less | Pretty\n' +
      '--- | --- | ---\n' +
      '*Still* | `renders` | **nicely**\n' +
      '1 | 2 | 3')
    expect(actual.html).toEqual('<table>\n' +
      '<thead>\n' +
      '<tr><th>Markdown</th><th>Less</th><th>Pretty</th></tr>\n' +
      '</thead>\n' +
      '<tbody>\n' +
      '<tr><td><em>Still</em></td><td><code>renders</code></td><td><strong>nicely</strong></td></tr>\n' +
      '<tr><td>1</td><td>2</td><td>3</td></tr>\n' +
      '</tbody>\n' +
      '</table>\n')
  })

  it('creates headings with anchors', async () => {
    expect.assertions(1)
    const actual = await parser('## Test heading', null, null, db)
    expect(actual.html).toEqual('<h2 id="test-heading"><a class="header-anchor" id="test-heading" href="#test-heading">#</a>Test heading</h2>\n')
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

  it('doesn\'t add line breaks inside code blocks', async () => {
    expect.assertions(1)
    const actual = await parser('```\nLine 1\nLine 2\nLine 3\n```\n\nThis is outside of the code block.', null, null, db)
    expect(actual.html).toEqual('<pre><code>Line 1\nLine 2\nLine 3</code></pre>\n<p>This is outside of the code block.</p>\n')
  })

  it('doesn\'t parse tags that are inside code blocks', async () => {
    expect.assertions(1)
    const actual = await parser('```\n[[Test:Hello]]\n```\n\nThis is outside of the code block.', null, null, db)
    expect(actual.html).toEqual('<pre><code>[[Test:Hello]]</code></pre>\n<p>This is outside of the code block.</p>\n')
  })

  it('parses links', async () => {
    expect.assertions(2)
    await testUtils.createTestPage(Page, Member, db)
    const actual = await parser('[[Test Page#Section Title | Hello]]', null, null, db)
    await testUtils.resetTables(db)
    expect(actual.html).toEqual('<p><a href="/test-page#section-title" title="Test Page">Hello</a></p>\n')
    expect(actual.linkHandler.links).toEqual([ { id: 1, text: 'Hello', title: 'Test Page', path: '/test-page#section-title', anchor: 'section-title', isNew: false } ])
  })

  it('parses new links', async () => {
    expect.assertions(2)
    const actual = await parser('[[Test Page#Section Title | Hello]]', null, null, db)
    expect(actual.html).toEqual('<p><a href="/new?title=Test%20Page" class="isNew">Hello</a></p>\n')
    expect(actual.linkHandler.links).toEqual([ { id: null, text: 'Hello', title: 'Test Page', path: '/new?title=Test%20Page', anchor: 'section-title', isNew: true } ])
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

  it('doesn\'t parse templates that are inside code blocks', async () => {
    expect.assertions(1)
    const actual = await parser('```\r\n{{Artists}}\r\n```\n\nThis is outside of the code block.', null, null, db)
    expect(actual.html).toEqual('<pre><code>{{Artists}}</code></pre>\n<p>This is outside of the code block.</p>\n')
  })

  it('doesn\'t render anything inside of {{Template}}', async () => {
    expect.assertions(1)
    const actual = await parser('{{Template}}\r\nThis is inside of a template block.\r\n{{/Template}}\r\n\r\nThis is outside of the template block.', null, null, db)
    expect(actual.html).toEqual('<p>This is outside of the template block.</p>\n')
  })
})
