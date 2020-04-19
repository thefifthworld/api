/* global describe, it, expect, beforeEach, afterEach, afterAll */

const Page = require('../models/page')
const Member = require('../models/member')
const db = require('../db')
const parseTemplates = require('./templates')
const testUtils = require('../test-utils')

describe('parseTemplates', () => {
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

  it('parses recursively', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Inner',
      body: '{{Template}}Hello world!{{/Template}} [[Type:Template]]'
    }, member, 'Initial text', db)
    await Page.create({
      title: 'Template:Outer',
      body: '{{Template}}{{Template:Inner}}{{/Template}} [[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Outer}}', null, db)
    expect(actual).toEqual('Hello world!')
  })

  it('can parse a list of child pages', async () => {
    expect.assertions(1)
    const editor = await Member.load(2, db)
    const pdata = { title: 'Parent', body: 'This is a parent page.' }
    await Page.create(pdata, editor, 'Initial text', db)
    const c1data = { title: 'Child 1', body: 'This is a child page. [[Type: Test]]', parent: '/parent' }
    const c2data = { title: 'Child 2', body: 'This is a different child page.', parent: '/parent' }
    await Page.create(c1data, editor, 'Initial text', db)
    await Page.create(c2data, editor, 'Initial text', db)
    const actual = await parseTemplates('{{Children}}', '/parent', db)
    expect(actual).toEqual('<ul>\n  <li><a href="/parent/child-1">Child 1</a></li>\n  <li><a href="/parent/child-2">Child 2</a></li>\n</ul>')
  })

  it('can parse a list of child pages restricted by type', async () => {
    expect.assertions(1)
    const editor = await Member.load(2, db)
    const pdata = { title: 'Parent', body: 'This is a parent page.' }
    await Page.create(pdata, editor, 'Initial text', db)
    const c1data = { title: 'Child 1', body: 'This is a child page. [[Type: Test]]', parent: '/parent' }
    const c2data = { title: 'Child 2', body: 'This is a different child page.', parent: '/parent' }
    await Page.create(c1data, editor, 'Initial text', db)
    await Page.create(c2data, editor, 'Initial text', db)
    const actual = await parseTemplates('{{Children type="Test"}}', '/parent', db)
    expect(actual).toEqual('<ul>\n  <li><a href="/parent/child-1">Child 1</a></li>\n</ul>')
  })

  it('can parse a list of a different page\'s children', async () => {
    expect.assertions(1)
    const editor = await Member.load(2, db)
    const pdata = { title: 'Parent', body: 'This is a parent page.' }
    await Page.create(pdata, editor, 'Initial text', db)
    const c1data = { title: 'Child 1', body: 'This is a child page. [[Type: Test]]', parent: '/parent' }
    const c2data = { title: 'Child 2', body: 'This is a different child page.', parent: '/parent' }
    await Page.create(c1data, editor, 'Initial text', db)
    await Page.create(c2data, editor, 'Initial text', db)
    const actual = await parseTemplates('{{Children of="/parent"}}', '/parent/child-1', db)
    expect(actual).toEqual('<ul>\n  <li><a href="/parent/child-1">Child 1</a></li>\n  <li><a href="/parent/child-2">Child 2</a></li>\n</ul>')
  })
})
