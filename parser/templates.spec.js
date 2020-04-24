/* global describe, it, expect, beforeEach, afterEach, afterAll */

const FileHandler = require('../models/fileHandler')
const Page = require('../models/page')
const Member = require('../models/member')
const config = require('../config')
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

  describe('{{Children}}', () => {
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
      expect(actual).toEqual('<ul><li><a href="/parent/child-1">Child 1</a></li><li><a href="/parent/child-2">Child 2</a></li></ul>')
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
      expect(actual).toEqual('<ul><li><a href="/parent/child-1">Child 1</a></li></ul>')
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
      expect(actual).toEqual('<ul><li><a href="/parent/child-1">Child 1</a></li><li><a href="/parent/child-2">Child 2</a></li></ul>')
    })
  })

  describe('{{Gallery}}', () => {
    it('creates a gallery of art child pages', async () => {
      expect.assertions(1)
      const parent = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const c1 = await Page.create({ title: 'Child 1', body: 'Art [[Type:Art]]', parent: parent.id }, editor, 'Initial text', db)
      const c2 = await Page.create({ title: 'Child 2', body: 'Art [[Type:Art]]', parent: parent.id }, editor, 'Initial text', db)
      await Page.create({ title: 'Child 3', body: 'Art [[Type:Art]]', parent: parent.id }, editor, 'Initial text', db)
      await Page.create({ title: 'Child 4', body: 'Not art', parent: parent.id }, editor, 'Initial text', db)
      const h1 = new FileHandler({ name: 'c1.jpg', thumbnail: 'c1.thumb.jpg', mime: 'image/jpeg', size: 20000, page: c1.id, uploader: editor.id }); await h1.save(db)
      const h2 = new FileHandler({ name: 'c2.jpg', thumbnail: 'c2.thumb.jpg', mime: 'image/jpeg', size: 20000, page: c2.id, uploader: editor.id }); await h2.save(db)
      const actual = await parseTemplates('{{Gallery}}', parent.path, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<ul class="gallery"><li><a href="/test-page/child-1"><img src="https://${config.aws.bucket}.s3.amazonaws.com/c1.thumb.jpg" alt="Child 1" /></a></li>,<li><a href="/test-page/child-2"><img src="https://${config.aws.bucket}.s3.amazonaws.com/c2.thumb.jpg" alt="Child 2" /></a></li></ul>`)
    })

    it('creates a gallery of a specified parent', async () => {
      expect.assertions(1)
      const parent = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const c1 = await Page.create({ title: 'Child 1', body: 'Art [[Type:Art]]', parent: parent.id }, editor, 'Initial text', db)
      const c2 = await Page.create({ title: 'Child 2', body: 'Art [[Type:Art]]', parent: parent.id }, editor, 'Initial text', db)
      const h1 = new FileHandler({ name: 'c1.jpg', thumbnail: 'c1.thumb.jpg', mime: 'image/jpeg', size: 20000, page: c1.id, uploader: editor.id }); await h1.save(db)
      const h2 = new FileHandler({ name: 'c2.jpg', thumbnail: 'c2.thumb.jpg', mime: 'image/jpeg', size: 20000, page: c2.id, uploader: editor.id }); await h2.save(db)
      const actual = await parseTemplates('{{Gallery of="/test-page"}}', null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<ul class="gallery"><li><a href="/test-page/child-1"><img src="https://${config.aws.bucket}.s3.amazonaws.com/c1.thumb.jpg" alt="Child 1" /></a></li>,<li><a href="/test-page/child-2"><img src="https://${config.aws.bucket}.s3.amazonaws.com/c2.thumb.jpg" alt="Child 2" /></a></li></ul>`)
    })
  })

  describe('{{Download}}', () => {
    it('can parse a file', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{Download}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates(page.history.getBody(), page.path, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<a href="https://${config.aws.bucket}.s3.amazonaws.com/test.txt" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
    })

    it('can parse a file from a different page identified by title', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{Download}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates('{{Download file="Test Page"}}', page.path, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<a href="https://${config.aws.bucket}.s3.amazonaws.com/test.txt" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
    })

    it('can parse a file from a different page identified by path', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{Download}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates('{{Download file="/test-page"}}', page.path, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<a href="https://${config.aws.bucket}.s3.amazonaws.com/test.txt" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
    })
  })

  describe('{{Art}}', () => {
    it('can parse art', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates(page.history.getBody(), page.path, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.amazonaws.com/test.jpg" alt="Art" /></a></figure>`)
    })

    it('can add a caption', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art caption="This is not an upload."}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates(page.history.getBody(), page.path, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.amazonaws.com/test.jpg" alt="This is not an upload." /></a><figcaption>This is not an upload.</figcaption></figure>`)
    })

    it('can use a thumbnail', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art useThumbnail="true"}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', thumbnail: 'test.thumb.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates(page.history.getBody(), page.path, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.amazonaws.com/test.thumb.jpg" alt="Art" /></a></figure>`)
    })

    it('can parse a different page\'s art, identified by title', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', thumbnail: 'test.thumb.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates('{{Art src="Art"}}', page.path, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.amazonaws.com/test.jpg" alt="Art" /></a></figure>`)
    })

    it('can parse a different page\'s art, identified by path', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', thumbnail: 'test.thumb.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates('{{Art src="/art"}}', page.path, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.amazonaws.com/test.jpg" alt="Art" /></a></figure>`)
    })
  })
})
