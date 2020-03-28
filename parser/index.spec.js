/* global describe, it, expect, afterAll */

const db = require('../db')
const parser = require('./index')

describe('Parser', () => {
  afterAll(done => { db.close(done) })

  it('renders markdown', async () => {
    const actual = await parser('*Hello* **[world](https://thefifthworld.com)**', db)
    expect(actual.html).toEqual('<p><em>Hello</em> <strong><a href="https://thefifthworld.com">world</a></strong></p>\n')
  })

  it('finds tags', async () => {
    const actual = await parser('This [[Hello:World]] is [[Hello : Test]] text [[Tag: 1]] outside of tags.\n\nAnd here is a [[Test:true]] second paragraph.')
    expect(actual.html).toEqual('<p>This is text outside of tags.</p>\n<p>And here is a second paragraph.</p>\n')
    expect(actual.tags.tags).toEqual({ hello: [ 'World', 'Test' ], tag: [ '1' ], test: [ 'true' ] })
  })

  it('doesn\'t parse tags that are inside code blocks', async () => {
    const actual = await parser('```\n[[Test:Hello]]\n```\n\nThis is outside of the code block.')
    expect(actual.html).toEqual('<pre><code>\n[[Test:Hello]]\n</code></pre>\n<p>This is outside of the code block.</p>\n')
  })
})
