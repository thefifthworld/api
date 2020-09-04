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
    const actual = await parseTemplates('{{Template:Hello}}', null, null, db)
    expect(actual).toEqual('Hello world!')
  })

  it('parses multiple templates', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({ title: 'Template:Hello',  body: '{{Template}}Hello!{{/Template}} [[Type:Template]]' }, member, 'Initial text', db)
    await Page.create({ title: 'Template:Goodbye',  body: '{{Template}}Goodbye!{{/Template}} [[Type:Template]]' }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello}} {{Template:Goodbye}}', null, null, db)
    expect(actual).toEqual('Hello! Goodbye!')
  })

  it('can take a parameter', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello, {{{Name}}}!{{/Template}} [[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello Name="Bob"}}', null, null, db)
    expect(actual).toEqual('Hello, Bob!')
  })

  it('works with curly quotes', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello, {{{Name}}}!{{/Template}} [[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello Name=”Bob”}}', null, null, db)
    expect(actual).toEqual('Hello, Bob!')
  })

  it('works with line breaks between parameters', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello, {{{Name}}}!{{/Template}} [[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello\n  Name=”Bob”}}', null, null, db)
    expect(actual).toEqual('Hello, Bob!')
  })

  it('can provide documentation', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello, {{{Name}}}!{{/Template}} This template greets you.\n\n## Example\n\n{{Temmplate:Hello Name="Bob"}}\n\n##Markdown\n\n```\n{{Temmplate:Hello Name="Bob"}}\n```\n\n[[Type:Template]]'
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello Name=”Bob”}}', null, null, db)
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
    const actual = await parseTemplates('{{Template:Outer}}', null, null, db)
    expect(actual).toEqual('Hello world!')
  })

  it('won\'t reander a template that you don\'t have permission to see', async () => {
    expect.assertions(1)
    const member = await Member.load(2, db)
    await Page.create({
      title: 'Template:Hello',
      body: '{{Template}}Hello world!{{/Template}} [[Type:Template]]',
      permissions: 700
    }, member, 'Initial text', db)
    const actual = await parseTemplates('{{Template:Hello}}', null, null, db)
    expect(actual).toEqual('')
  })

  describe('{{Artists}}', () => {
    it('lists the artists', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const a1 = await Page.create({ title: 'Giulianna Maria Lamanna', body: '[[Type:Artist]]' }, editor, 'Initial text', db)
      const a2 = await Page.create({ title: 'Jason Godesky', body: '[[Type:Artist]]' }, editor, 'Initial text', db)
      const a3 = await Page.create({ title: 'Banksy', body: '[[Type:Artist]]', permissions: 700 }, editor, 'Initial text', db)
      const a1p1 = await Page.create({ title: 'Giulianna #1', body: '[[Type:Art]]', parent: a1.id }, editor, 'Initial text', db)
      const a1p2 = await Page.create({ title: 'Giulianna #2', body: '[[Type:Art]]', parent: a1.id, permissions: 700 }, editor, 'Initial text', db)
      const a1p3 = await Page.create({ title: 'Giulianna #3', body: '[[Type:Art]]', parent: a1.id }, editor, 'Initial text', db)
      const a1p4 = await Page.create({ title: 'Giulianna #4', body: '[[Type:Art]]', parent: a1.id }, editor, 'Initial text', db)
      const a1p5 = await Page.create({ title: 'Giulianna #5', body: '[[Type:Art]]', parent: a1.id }, editor, 'Initial text', db)
      const a1p6 = await Page.create({ title: 'Giulianna #6', body: '[[Type:Art]]', parent: a1.id }, editor, 'Initial text', db)
      const a2p1 = await Page.create({ title: 'Jason #1', body: '[[Type:Art]]', parent: a2.id }, editor, 'Initial text', db)
      const a2p2 = await Page.create({ title: 'Jason #2', body: '[[Type:Art]]', parent: a2.id, permissions: 700 }, editor, 'Initial text', db)
      const a2p3 = await Page.create({ title: 'Jason #3', body: '[[Type:Art]]', parent: a2.id }, editor, 'Initial text', db)
      const a3p1 = await Page.create({ title: 'Banksy #1', body: '[[Type:Art]]', parent: a3.id }, editor, 'Initial text', db)
      const a3p2 = await Page.create({ title: 'Banksy #2', body: '[[Type:Art]]', parent: a3.id, permissions: 700 }, editor, 'Initial text', db)
      const a1p1h = new FileHandler({ name: 'a1p1.jpg', thumbnail: 'a1p1.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a1p1.id, uploader: editor.id }); await a1p1h.save(db)
      const a1p2h = new FileHandler({ name: 'a1p2.jpg', thumbnail: 'a1p2.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a1p2.id, uploader: editor.id }); await a1p2h.save(db)
      const a1p3h = new FileHandler({ name: 'a1p3.jpg', thumbnail: 'a1p3.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a1p3.id, uploader: editor.id }); await a1p3h.save(db)
      const a1p4h = new FileHandler({ name: 'a1p4.jpg', thumbnail: 'a1p4.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a1p4.id, uploader: editor.id }); await a1p4h.save(db)
      const a1p5h = new FileHandler({ name: 'a1p5.jpg', thumbnail: 'a1p5.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a1p5.id, uploader: editor.id }); await a1p5h.save(db)
      const a1p6h = new FileHandler({ name: 'a1p6.jpg', thumbnail: 'a1p6.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a1p6.id, uploader: editor.id }); await a1p6h.save(db)
      const a2p1h = new FileHandler({ name: 'a2p1.jpg', thumbnail: 'a2p1.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a2p1.id, uploader: editor.id }); await a2p1h.save(db)
      const a2p2h = new FileHandler({ name: 'a2p2.jpg', thumbnail: 'a2p2.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a2p2.id, uploader: editor.id }); await a2p2h.save(db)
      const a2p3h = new FileHandler({ name: 'a2p3.jpg', thumbnail: 'a2p3.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a2p3.id, uploader: editor.id }); await a2p3h.save(db)
      const a3p1h = new FileHandler({ name: 'a3p1.jpg', thumbnail: 'a3p1.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a3p1.id, uploader: editor.id }); await a3p1h.save(db)
      const a3p2h = new FileHandler({ name: 'a3p2.jpg', thumbnail: 'a3p2.thumb.jpg', mime: 'image/jpeg', size: 20000, page: a3p2.id, uploader: editor.id }); await a3p2h.save(db)
      const actual = await parseTemplates('{{Artists}}', null, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<section class="artist"><h2><a href="/giulianna-maria-lamanna">Giulianna Maria Lamanna</a></h2><ul class="thumbnails"><li><a href="/giulianna-maria-lamanna/giulianna-6"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/a1p6.thumb.jpg" alt="Giulianna #6" /></a></li><li><a href="/giulianna-maria-lamanna/giulianna-5"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/a1p5.thumb.jpg" alt="Giulianna #5" /></a></li><li><a href="/giulianna-maria-lamanna/giulianna-4"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/a1p4.thumb.jpg" alt="Giulianna #4" /></a></li><li><a href="/giulianna-maria-lamanna/giulianna-3"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/a1p3.thumb.jpg" alt="Giulianna #3" /></a></li></ul></section><section class="artist"><h2><a href="/jason-godesky">Jason Godesky</a></h2><ul class="thumbnails"><li><a href="/jason-godesky/jason-3"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/a2p3.thumb.jpg" alt="Jason #3" /></a></li><li><a href="/jason-godesky/jason-1"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/a2p1.thumb.jpg" alt="Jason #1" /></a></li></ul></section>`)
    })
  })

  describe('{{Novels}}', () => {
    it('lists all novels', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const novel = await Page.create({ title: 'Children of Wormwood', body: '[[Type:Novel]]' }, editor, 'Initial text', db)
      const cover = await Page.create({ title: 'Cover', body: '[[Type:Art]] [[Cover:Children of Wormwood]]', parent: novel.id }, editor, 'Initial text', db)
      const art = new FileHandler({ name: 'cover.jpg', thumbnail: 'cover.thumb.jpg', mime: 'image/jpeg', size: 20000, page: cover.id, uploader: editor.id }); await art.save(db)
      const actual = await parseTemplates('{{Novels}}', null, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<ul class="novel-listing"><li><a href="/children-of-wormwood"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/cover.jpg" alt="Children of Wormwood" /></a></li></ul>`)
    })
  })

  describe('{{Tagged}}', () => {
    it('lists all pages with a given tag', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'Page #1', body: 'Nope' }, editor, 'Initial text', db)
      await Page.create({ title: 'Page #2', body: '[[Test:Yes]]' }, editor, 'Initial text', db)
      await Page.create({ title: 'Page #3', body: '[[Test:Yes]]' }, editor, 'Initial text', db)
      await Page.create({ title: 'Page #4', body: '[[Test:Yes]]', permissions: 700 }, editor, 'Initial text', db)
      const actual = await parseTemplates('{{Tagged tag="Test" value="Yes"}}', null, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual('<ul><li><a href="/page-2">Page #2</a></li><li><a href="/page-3">Page #3</a></li></ul>')
    })
  })

  describe('{{Children}}', () => {
    it('can parse a list of child pages', async () => {
      expect.assertions(1)
      const editor = await Member.load(2, db)
      const pdata = { title: 'Parent', body: 'This is a parent page.' }
      await Page.create(pdata, editor, 'Initial text', db)
      const c1data = { title: 'Child 1', body: 'This is a child page. [[Type: Test]]', parent: '/parent' }
      const c2data = { title: 'Child 2', body: 'This is a different child page.', parent: '/parent' }
      const c3data = { title: 'Child 3', body: 'This is a hidden child page.', parent: '/parent', permissions: 700 }
      await Page.create(c1data, editor, 'Initial text', db)
      await Page.create(c2data, editor, 'Initial text', db)
      await Page.create(c3data, editor, 'Initial text', db)
      const actual = await parseTemplates('{{Children}}', '/parent', null, db)
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
      const actual = await parseTemplates('{{Children type="Test"}}', '/parent', null, db)
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
      const actual = await parseTemplates('{{Children of="/parent"}}', '/parent/child-1', null, db)
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
      const c5 = await Page.create({ title: 'Child 5', body: 'Art [[Type:Art]]', parent: parent.id, permissions: 700 }, editor, 'Initial text', db)
      const h1 = new FileHandler({ name: 'c1.jpg', thumbnail: 'c1.thumb.jpg', mime: 'image/jpeg', size: 20000, page: c1.id, uploader: editor.id }); await h1.save(db)
      const h2 = new FileHandler({ name: 'c2.jpg', thumbnail: 'c2.thumb.jpg', mime: 'image/jpeg', size: 20000, page: c2.id, uploader: editor.id }); await h2.save(db)
      const h5 = new FileHandler({ name: 'c5.jpg', thumbnail: 'c5.thumb.jpg', mime: 'image/jpeg', size: 50000, page: c5.id, uploader: editor.id }); await h5.save(db)
      const actual = await parseTemplates('{{Gallery}}', parent.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<ul class="thumbnails"><li><a href="/test-page/child-2"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/c2.thumb.jpg" alt="Child 2" /></a></li>,<li><a href="/test-page/child-1"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/c1.thumb.jpg" alt="Child 1" /></a></li></ul>`)
    })

    it('creates a gallery of a specified parent', async () => {
      expect.assertions(1)
      const parent = await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const c1 = await Page.create({ title: 'Child 1', body: 'Art [[Type:Art]]', parent: parent.id }, editor, 'Initial text', db)
      const c2 = await Page.create({ title: 'Child 2', body: 'Art [[Type:Art]]', parent: parent.id }, editor, 'Initial text', db)
      const h1 = new FileHandler({ name: 'c1.jpg', thumbnail: 'c1.thumb.jpg', mime: 'image/jpeg', size: 20000, page: c1.id, uploader: editor.id }); await h1.save(db)
      const h2 = new FileHandler({ name: 'c2.jpg', thumbnail: 'c2.thumb.jpg', mime: 'image/jpeg', size: 20000, page: c2.id, uploader: editor.id }); await h2.save(db)
      const actual = await parseTemplates('{{Gallery of="/test-page"}}', null, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<ul class="thumbnails"><li><a href="/test-page/child-2"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/c2.thumb.jpg" alt="Child 2" /></a></li>,<li><a href="/test-page/child-1"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/c1.thumb.jpg" alt="Child 1" /></a></li></ul>`)
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
      const actual = await parseTemplates(page.history.getBody(), page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<a href="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/test.txt" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
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
      const actual = await parseTemplates('{{Download file="Test Page"}}', page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<a href="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/test.txt" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
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
      const actual = await parseTemplates('{{Download file="/test-page"}}', page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<a href="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/test.txt" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
    })

    it('doesn\'t show a file you don\'t have permission to see', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{Download}}', permissions: 700 }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates(page.history.getBody(), page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual('')
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
      const actual = await parseTemplates(page.history.getBody(), page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/test.jpg" alt="Art" /></a></figure>`)
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
      const actual = await parseTemplates(page.history.getBody(), page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/test.jpg" alt="This is not an upload." /></a><figcaption>This is not an upload.</figcaption></figure>`)
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
      const actual = await parseTemplates(page.history.getBody(), page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/test.thumb.jpg" alt="Art" /></a></figure>`)
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
      const actual = await parseTemplates('{{Art src="Art"}}', page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/test.jpg" alt="Art" /></a></figure>`)
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
      const actual = await parseTemplates('{{Art src="/art"}}', page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<figure><a href="/art"><img src="https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/test.jpg" alt="Art" /></a></figure>`)
    })

    it('doesn\'t show art you don\'t have permission to', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art}}', permissions: 700 }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const handler = new FileHandler(file);
      await handler.save(db)
      const actual = await parseTemplates(page.history.getBody(), page.path, null, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual('')
    })
  })

  describe('{{Form}}', () => {
    it('creates a form', async () => {
      expect.assertions(1)
      const actual = await parseTemplates('{{Form name="Test" fields="{Email||email}{Reason|Why do you want to join the Fifth World?|textarea}"}}', null, null, db)
      expect(actual).toEqual('<form action="/save-form" method="post"><input type="hidden" name="form" value="Test" /><label for="form-test-email">Email</label><input type="email" id="form-test-email" name="email" /><label for="form-test-reason">Reason<p class="note">Why do you want to join the Fifth World?</p></label><textarea id="form-test-reason" name="reason"></textarea><button>Send</button></form>')
    })
  })
})
