/* global describe, it, expect, afterAll */

const db = require('../db')
const parser = require('./index')

describe('Parser', () => {
  afterAll(done => { db.close(done) })

  it('renders markdown', async () => {
    const actual = await parser('*Hello* **[world](https://thefifthworld.com)**', db)
    expect(actual.html).toEqual('<p><em>Hello</em> <strong><a href="https://thefifthworld.com">world</a></strong></p>\n')
  })
})
