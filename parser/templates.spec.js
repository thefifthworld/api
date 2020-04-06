/* global describe, it, expect, beforeEach, afterEach, afterAll */

const Page = require('../models/page')
const Member = require('../models/member')
const db = require('../db')
const parseTemplates = require('./templates')
const testUtils = require('../test-utils')

describe('templateParse', () => {
  beforeEach(async done => { await testUtils.populateMembers(db); done() })
  afterEach(async done => { await testUtils.resetTables(db); done() })
  afterAll(() => { db.end() })

  it('adds a template', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello world!{{/Template}} [[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello}}', null, db)
    expect(actual).toEqual('Hello world!')
  })

  it('can take a parameter', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello, {{{Name}}}!{{/Template}} [[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello Name="Bob"}}', null, db)
    expect(actual).toEqual('Hello, Bob!')
  })

  it('works with curly quotes', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello, {{{Name}}}!{{/Template}} [[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello Name=”Bob”}}', null, db)
    expect(actual).toEqual('Hello, Bob!')
  })

  it('works with line breaks between parameters', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello, {{{Name}}}!{{/Template}} [[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello\n  Name=”Bob”}}', null, db)
    expect(actual).toEqual('Hello, Bob!')
  })

  it('can provide documentation', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello, {{{Name}}}!{{/Template}} This template greets you.\n\n## Example\n\n{{Temmplate:Hello Name="Bob"}}\n\n##Markdown\n\n```\n{{Temmplate:Hello Name="Bob"}}\n```\n\n[[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello Name=”Bob”}}', null, db)
    expect(actual).toEqual('Hello, Bob!')
  })
})
