/* global describe, it, expect, afterAll */

const db = require('../db')
const testUtils = require('../test-utils')

const Page = require('./page')
const Member = require('./member')
const FileHandler = require('./fileHandler')
const TemplateHandler = require('./templateHandler')

describe('TemplateHandler', () => {
  afterAll(() => { db.end() })

  describe('constructor', () => {
    it('prepares an object for storing templates', () => {
      const actual = new TemplateHandler()
      expect(actual.instances).toEqual({})
    })

    it('stores model dependencies', () => {
      const actual = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      expect(actual.models.page).toEqual(Page)
      expect(actual.models.fileHandler).toEqual(FileHandler)
    })
  })

  describe('add', () => {
    it('adds an object to a property name', () => {
      const actual = new TemplateHandler()
      actual.add('test', { a: 1, b: 2, c: 3 })
      expect(actual.instances.test).toBeDefined()
      expect(actual.instances.test).toHaveLength(1)
      expect(actual.instances.test[0].a).toEqual(1)
      expect(actual.instances.test[0].b).toEqual(2)
      expect(actual.instances.test[0].c).toEqual(3)
    })
  })

  describe('renderGalleryItem', () => {
    it('renders a page as a gallery item', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test page', body: 'This is a test.', files: { file: testUtils.mockJPEG() } }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = page && page.files && page.files.length > 0 ? page.files[0] : null
      const handler = new TemplateHandler({ fileHandler: FileHandler })
      const actual = await handler.renderGalleryItem(page)
      await FileHandler.remove(file.name, db)
      await testUtils.resetTables(db)
      expect(actual).toEqual(`<li><a href="/test-page"><img src="${FileHandler.getURL(page.files[0].thumbnail)}" alt="Test page" /></a></li>`)
    })
  })

  describe('save', () => {
    it('saves template data to the database', async () => {
      expect.assertions(4)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new TemplateHandler()
      handler.add('test', { a: 1, b: 2, c: 3, originalWikitext: '{{test a="1" b="2" c="3"}}' })
      await handler.save(page.id, db)
      const actual = await db.run('SELECT * FROM templates;')
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(3)
      expect(actual[0]).toEqual({ id: 1, page: 1, template: 'test', instance: 0, parameter: 'a', value: '1' })
      expect(actual[1]).toEqual({ id: 2, page: 1, template: 'test', instance: 0, parameter: 'b', value: '2' })
      expect(actual[2]).toEqual({ id: 3, page: 1, template: 'test', instance: 0, parameter: 'c', value: '3' })
    })

    it('saves template data with no parameters', async () => {
      expect.assertions(2)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new TemplateHandler()
      handler.add('test', { originalWikitext: '{{test}}' })
      await handler.save(page.id, db)
      const actual = await db.run('SELECT * FROM templates;')
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0]).toEqual({ id: 1, page: 1, template: 'test', instance: 0, parameter: null, value: null })
    })
  })

  describe('renderChildren', () => {
    it('renders a list of the current page\'s children', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'B2', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'C3', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'A1', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      const handler = new TemplateHandler({ page: Page })
      handler.add('Children')
      await handler.renderChildren(handler.instances.Children[0], { path: '/test-page', member: editor }, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Children[0].markup).toEqual('<ul><li><a href="/test-page/a1">A1</a></li><li><a href="/test-page/b2">B2</a></li><li><a href="/test-page/c3">C3</a></li></ul>')
    })

    it('lets you render a list of a different page\'s children', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'B2', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'C3', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'A1', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      const handler = new TemplateHandler({ page: Page })
      handler.add('Children', { of: '/test-page' })
      await handler.renderChildren(handler.instances.Children[0], { path: '/test-page/a1', member: editor }, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Children[0].markup).toEqual('<ul><li><a href="/test-page/a1">A1</a></li><li><a href="/test-page/b2">B2</a></li><li><a href="/test-page/c3">C3</a></li></ul>')
    })

    it('can render the oldest pages first', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'B2', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'C3', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'A1', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      const handler = new TemplateHandler({ page: Page })
      handler.add('Children', { order: 'oldest' })
      await handler.renderChildren(handler.instances.Children[0], { path: '/test-page', member: editor }, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Children[0].markup).toEqual('<ul><li><a href="/test-page/b2">B2</a></li><li><a href="/test-page/c3">C3</a></li><li><a href="/test-page/a1">A1</a></li></ul>')
    })

    it('can render the newest pages first', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'B2', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'C3', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'A1', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      const handler = new TemplateHandler({ page: Page })
      handler.add('Children', { order: 'newest' })
      await handler.renderChildren(handler.instances.Children[0], { path: '/test-page', member: editor }, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Children[0].markup).toEqual('<ul><li><a href="/test-page/a1">A1</a></li><li><a href="/test-page/c3">C3</a></li><li><a href="/test-page/b2">B2</a></li></ul>')
    })

    it('can render a gallery', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const b = await Page.create({ title: 'B2', body: 'This is a test.', parent: '/test-page', files: { file: testUtils.mockJPEG() } }, editor, 'This is a test', db)
      const c = await Page.create({ title: 'C3', body: 'This is a test.', parent: '/test-page', files: { file: testUtils.mockJPEG() } }, editor, 'This is a test', db)
      const a = await Page.create({ title: 'A1', body: 'This is a test.', parent: '/test-page', files: { file: testUtils.mockJPEG() } }, editor, 'This is a test', db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Children')
      await handler.renderChildren(handler.instances.Children[0], { path: '/test-page', member: editor, asGallery: true }, db)
      await FileHandler.remove(a.files[0].name, db)
      await FileHandler.remove(b.files[0].name, db)
      await FileHandler.remove(c.files[0].name, db)
      await testUtils.resetTables(db)
      const urls = {
        a: FileHandler.getURL(a.files[0].thumbnail),
        b: FileHandler.getURL(b.files[0].thumbnail),
        c: FileHandler.getURL(c.files[0].thumbnail)
      }
      const expected = `<ul class="thumbnails"><li><a href="/test-page/a1"><img src="${urls.a}" alt="A1" /></a></li><li><a href="/test-page/c3"><img src="${urls.c}" alt="C3" /></a></li><li><a href="/test-page/b2"><img src="${urls.b}" alt="B2" /></a></li></ul>`
      expect(handler.instances.Children[0].markup).toEqual(expected)
    })
  })

  describe('renderArtists', () => {
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

      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Artists')
      await handler.renderArtists(handler.instances.Artists[0], {}, db)
      await testUtils.resetTables(db)

      const a1a = [[a1p6, a1p6h], [a1p5, a1p5h], [a1p4, a1p4h], [a1p3, a1p3h]]
      const a2a = [[a2p3, a2p3h], [a2p1, a2p1h]]
      const a1p = a1a.map(pair => `<li><a href="${pair[0].path}"><img src="${FileHandler.getURL(pair[1].thumbnail)}" alt="${pair[0].title}" /></a></li>`)
      const a2p = a2a.map(pair => `<li><a href="${pair[0].path}"><img src="${FileHandler.getURL(pair[1].thumbnail)}" alt="${pair[0].title}" /></a></li>`)
      const a1str = `<section class="artist"><h2><a href="${a1.path}">${a1.title}</a></h2><ul class="thumbnails">${a1p.join('')}</ul></section>`
      const a2str = `<section class="artist"><h2><a href="${a2.path}">${a2.title}</a></h2><ul class="thumbnails">${a2p.join('')}</ul></section>`
      expect(handler.instances.Artists[0].markup).toEqual(`${a1str}${a2str}`)
    })
  })

  describe('renderFile', () => {
    it('renders a file download component', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{Download}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); filehandler.save(db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      const actual = {}
      const url = FileHandler.getURL(file.name)
      await handler.renderFile(actual, { path: '/test-page' }, db)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual(`<a href="${url}" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
    })

    it('renders a file download component for a file from a different page identified by title', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{Download}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const actual = { file: 'Test Page' }
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      await handler.renderFile(actual, {}, db)
      const url = FileHandler.getURL(file.name)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual(`<a href="${url}" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
    })

    it('renders a file download component for a file from a different page identified by path', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{Download}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const actual = { file: '/test-page' }
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      await handler.renderFile(actual, {}, db)
      const url = FileHandler.getURL(file.name)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual(`<a href="${url}" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
    })

    it('won\'t show a file you don\'t have permission to see', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{Download}}', permissions: 700 }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const actual = {}
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      await handler.renderFile(actual, { path: '/test-page' }, db)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual('')
    })

    it('renders art', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const url = FileHandler.getURL(file.name)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      const actual = {}
      await handler.renderFile(actual, { path: '/art', art: 'true' }, db)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual(`<figure><a href="/art"><img src="${url}" alt="Art" /></a></figure>`)
    })

    it('can add a caption', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art caption="This is not an upload."}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const url = FileHandler.getURL(file.name)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      const actual = { caption: 'This is not an upload.' }
      await handler.renderFile(actual, { path: '/art', art: 'true' }, db)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual(`<figure><a href="/art"><img src="${url}" alt="This is not an upload." /></a><figcaption>This is not an upload.</figcaption></figure>`)
    })

    it('can add a numbered caption', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art caption="This is not an upload."}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const url = FileHandler.getURL(file.name)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      const actual = { caption: 'This is not an upload.', numbered: 'true' }
      await handler.renderFile(actual, { path: '/art', art: 'true' }, db)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual(`<figure><a href="/art"><img src="${url}" alt="This is not an upload." /></a><figcaption class="numbered">This is not an upload.</figcaption></figure>`)
    })

    it('can use a thumbnail', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art useThumbnail="true"}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', thumbnail: 'test.thumb.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const url = FileHandler.getURL(file.thumbnail)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      const actual = { useThumbnail: 'true' }
      await handler.renderFile(actual, { path: '/art', art: 'true' }, db)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual(`<figure><a href="/art"><img src="${url}" alt="Art" /></a></figure>`)
    })

    it('can parse a different page\'s art, identified by title', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', thumbnail: 'test.thumb.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const url = FileHandler.getURL(file.name)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      const actual = { src: 'Art' }
      await handler.renderFile(actual, { art: 'true' }, db)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual(`<figure><a href="/art"><img src="${url}" alt="Art" /></a></figure>`)
    })

    it('can parse a different page\'s art, identified by path', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', thumbnail: 'test.thumb.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const url = FileHandler.getURL(file.name)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      const actual = { src: '/art' }
      await handler.renderFile(actual, { art: 'true' }, db)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual(`<figure><a href="/art"><img src="${url}" alt="Art" /></a></figure>`)
    })

    it('doesn\'t show art you don\'t have permission to', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art}}', permissions: 700 }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      const actual = {}
      await handler.renderFile(actual, { path: '/art', art: 'true' }, db)
      await testUtils.resetTables(db)
      expect(actual.markup).toEqual('')
    })
  })

  describe('renderForm', () => {
    it('renders a form', async () => {
      expect.assertions(1)
      const actual = { name: 'Test', fields: '{Email||email}{Reason|Why do you want to join the Fifth World?|textarea}' }
      const handler = new TemplateHandler()
      await handler.renderForm(actual, db)
      expect(actual.markup).toEqual('<form action="/save-form" method="post"><input type="hidden" name="form" value="Test" /><label for="form-test-email">Email</label><input type="email" id="form-test-email" name="email" /><label for="form-test-reason">Reason<p class="note">Why do you want to join the Fifth World?</p></label><textarea id="form-test-reason" name="reason"></textarea><button>Send</button></form>')
    })
  })

  describe('renderNovels', () => {
    it('lists all novels', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const novel = await Page.create({ title: 'Children of Wormwood', body: '[[Type:Novel]]' }, editor, 'Initial text', db)
      const cover = await Page.create({ title: 'Cover', body: '[[Type:Art]] [[Cover:Children of Wormwood]]', parent: novel.id }, editor, 'Initial text', db)
      const art = new FileHandler({ name: 'cover.jpg', thumbnail: 'cover.thumb.jpg', mime: 'image/jpeg', size: 20000, page: cover.id, uploader: editor.id }); await art.save(db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Novels')
      await handler.renderNovels(handler.instances.Novels[0], {}, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Novels[0].markup).toEqual(`<ul class="novel-listing"><li><a href="/children-of-wormwood"><img src="${FileHandler.getURL(art.name)}" alt="Children of Wormwood" /></a></li></ul>`)
    })
  })

  describe('renderTagged', () => {
    it('renders a list of pages with a given tag', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'Page #1', body: 'Nope' }, editor, 'Initial text', db)
      await Page.create({ title: 'Page #2', body: '[[Test:Yes]]' }, editor, 'Initial text', db)
      await Page.create({ title: 'Page #3', body: '[[Test:Yes]]' }, editor, 'Initial text', db)
      await Page.create({ title: 'Page #4', body: '[[Test:Yes]]', permissions: 700 }, editor, 'Initial text', db)
      const handler = new TemplateHandler({ page: Page })
      handler.add('Tagged', { tag: 'Test', value: 'Yes' })
      await handler.renderTagged(handler.instances.Tagged[0], {}, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Tagged[0].markup).toEqual('<ul><li><a href="/page-2">Page #2</a></li><li><a href="/page-3">Page #3</a></li></ul>')
    })
  })

  describe('renderDefault', () => {
    it('renders a template from the database', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'TestTemplate', type: 'Template', body: '{{Template}}Hello world!{{/Template}}' }, editor, 'Making a test template', db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('TestTemplate')
      await handler.renderDefault('TestTemplate', handler.instances.TestTemplate[0], editor, db)
      await testUtils.resetTables(db)
      expect(handler).toBeInstanceOf(TemplateHandler)
      expect(handler.instances.TestTemplate).toBeDefined()
      expect(handler.instances.TestTemplate).toHaveLength(1)
      expect(handler.instances.TestTemplate[0].markup).toEqual('Hello world!')
    })

    it('renders a blank string if no template exists', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('TestTemplate')
      await handler.renderDefault('TestTemplate', handler.instances.TestTemplate[0], { member: editor }, db)
      await testUtils.resetTables(db)
      expect(handler).toBeInstanceOf(TemplateHandler)
      expect(handler.instances.TestTemplate).toBeDefined()
      expect(handler.instances.TestTemplate).toHaveLength(1)
      expect(handler.instances.TestTemplate[0].markup).toEqual('')
    })
  })

  describe('render', () => {
    it('properly renders an instance that uses a template from the database', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'TestTemplate', type: 'Template', body: '{{Template}}Hello world!{{/Template}}' }, editor, 'Making a test template', db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('TestTemplate')
      await handler.render({ member: editor }, db)
      await testUtils.resetTables(db)
      expect(handler).toBeInstanceOf(TemplateHandler)
      expect(handler.instances.TestTemplate).toBeDefined()
      expect(handler.instances.TestTemplate).toHaveLength(1)
      expect(handler.instances.TestTemplate[0].markup).toEqual('Hello world!')
    })

    it('renders a blank string if no template exists', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('TestTemplate')
      await handler.render({ member: editor }, db)
      await testUtils.resetTables(db)
      expect(handler).toBeInstanceOf(TemplateHandler)
      expect(handler.instances.TestTemplate).toBeDefined()
      expect(handler.instances.TestTemplate).toHaveLength(1)
      expect(handler.instances.TestTemplate[0].markup).toEqual('')
    })

    it('renders {{Art}}', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Art', body: '{{Art}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.jpg', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); await filehandler.save(db)
      const url = FileHandler.getURL(file.name)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Art')
      await handler.render({ path: '/art' }, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Art[0].markup).toEqual(`<figure><a href="/art"><img src="${url}" alt="Art" /></a></figure>`)
    })

    it('renders {{Artists}}', async () => {
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

      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Artists')
      await handler.render({}, db)
      await testUtils.resetTables(db)

      const a1a = [[a1p6, a1p6h], [a1p5, a1p5h], [a1p4, a1p4h], [a1p3, a1p3h]]
      const a2a = [[a2p3, a2p3h], [a2p1, a2p1h]]
      const a1p = a1a.map(pair => `<li><a href="${pair[0].path}"><img src="${FileHandler.getURL(pair[1].thumbnail)}" alt="${pair[0].title}" /></a></li>`)
      const a2p = a2a.map(pair => `<li><a href="${pair[0].path}"><img src="${FileHandler.getURL(pair[1].thumbnail)}" alt="${pair[0].title}" /></a></li>`)
      const a1str = `<section class="artist"><h2><a href="${a1.path}">${a1.title}</a></h2><ul class="thumbnails">${a1p.join('')}</ul></section>`
      const a2str = `<section class="artist"><h2><a href="${a2.path}">${a2.title}</a></h2><ul class="thumbnails">${a2p.join('')}</ul></section>`
      expect(handler.instances.Artists[0].markup).toEqual(`${a1str}${a2str}`)
    })

    it('renders {{Children}}', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'B2', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'C3', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      await Page.create({ title: 'A1', body: 'This is a test.', parent: '/test-page' }, editor, 'This is a test', db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Children')
      await handler.render({ path: '/test-page', member: editor }, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Children[0].markup).toEqual('<ul><li><a href="/test-page/a1">A1</a></li><li><a href="/test-page/b2">B2</a></li><li><a href="/test-page/c3">C3</a></li></ul>')
    })

    it('renders {{Download}}', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const data = { title: 'Test Page', body: '{{Download}}' }
      const page = await Page.create(data, editor, 'Initial text', db)
      const file = { name: 'test.txt', mime: 'plain/text', size: 0, page: page.id, uploader: editor.id }
      const filehandler = new FileHandler(file); filehandler.save(db)
      const url = FileHandler.getURL(file.name)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Download')
      await handler.render({ path: '/test-page', member: editor }, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Download[0].markup).toEqual(`<a href="${url}" class="download"><span class="label">test.txt</span><span class="details">plain/text; 0 B</span></a>`)
    })

    it('renders {{Form}}', async () => {
      expect.assertions(1)
      const handler = new TemplateHandler()
      handler.add('Form', { name: 'Test', fields: '{Email||email}{Reason|Why do you want to join the Fifth World?|textarea}' })
      await handler.render({}, db)
      expect(handler.instances.Form[0].markup).toEqual('<form action="/save-form" method="post"><input type="hidden" name="form" value="Test" /><label for="form-test-email">Email</label><input type="email" id="form-test-email" name="email" /><label for="form-test-reason">Reason<p class="note">Why do you want to join the Fifth World?</p></label><textarea id="form-test-reason" name="reason"></textarea><button>Send</button></form>')
    })

    it('renders {{Gallery}}', async () => {
      expect.assertions(1)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      const b = await Page.create({ title: 'B2', body: 'This is a test.', parent: '/test-page', files: { file: testUtils.mockJPEG() } }, editor, 'This is a test', db)
      const c = await Page.create({ title: 'C3', body: 'This is a test.', parent: '/test-page', files: { file: testUtils.mockJPEG() } }, editor, 'This is a test', db)
      const a = await Page.create({ title: 'A1', body: 'This is a test.', parent: '/test-page', files: { file: testUtils.mockJPEG() } }, editor, 'This is a test', db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Gallery')
      await handler.render({ path: '/test-page', member: editor }, db)
      await FileHandler.remove(a.files[0].name, db)
      await FileHandler.remove(b.files[0].name, db)
      await FileHandler.remove(c.files[0].name, db)
      await testUtils.resetTables(db)
      const urls = {
        a: FileHandler.getURL(a.files[0].thumbnail),
        b: FileHandler.getURL(b.files[0].thumbnail),
        c: FileHandler.getURL(c.files[0].thumbnail)
      }
      const expected = `<ul class="thumbnails"><li><a href="/test-page/a1"><img src="${urls.a}" alt="A1" /></a></li><li><a href="/test-page/c3"><img src="${urls.c}" alt="C3" /></a></li><li><a href="/test-page/b2"><img src="${urls.b}" alt="B2" /></a></li></ul>`
      expect(handler.instances.Gallery[0].markup).toEqual(expected)
    })

    it('renders {{Novels}}', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const novel = await Page.create({ title: 'Children of Wormwood', body: '[[Type:Novel]]' }, editor, 'Initial text', db)
      const cover = await Page.create({ title: 'Cover', body: '[[Type:Art]] [[Cover:Children of Wormwood]]', parent: novel.id }, editor, 'Initial text', db)
      const art = new FileHandler({ name: 'cover.jpg', thumbnail: 'cover.thumb.jpg', mime: 'image/jpeg', size: 20000, page: cover.id, uploader: editor.id }); await art.save(db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Novels')
      await handler.render({}, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Novels[0].markup).toEqual(`<ul class="novel-listing"><li><a href="/children-of-wormwood"><img src="${FileHandler.getURL(art.name)}" alt="Children of Wormwood" /></a></li></ul>`)
    })

    it('renders {{Tagged}}', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'Page #1', body: 'Nope' }, editor, 'Initial text', db)
      await Page.create({ title: 'Page #2', body: '[[Test:Yes]]' }, editor, 'Initial text', db)
      await Page.create({ title: 'Page #3', body: '[[Test:Yes]]' }, editor, 'Initial text', db)
      await Page.create({ title: 'Page #4', body: '[[Test:Yes]]', permissions: 700 }, editor, 'Initial text', db)
      const handler = new TemplateHandler({ page: Page })
      handler.add('Tagged', { tag: 'Test', value: 'Yes' })
      await handler.render({}, db)
      await testUtils.resetTables(db)
      expect(handler.instances.Tagged[0].markup).toEqual('<ul><li><a href="/page-2">Page #2</a></li><li><a href="/page-3">Page #3</a></li></ul>')
    })
  })

  describe('parse', () => {
    it('parses templates from string', () => {
      const actual = TemplateHandler.parse('Hello world! {{NoParams}} {{WithParams\n  p1="Hello world!"\n  p2="42"}}')
      expect(actual.instances.NoParams).toEqual([{ originalWikitext: '{{NoParams}}' }])
      expect(actual.instances.WithParams).toBeDefined()
      expect(actual.instances.WithParams).toHaveLength(1)
      expect(actual.instances.WithParams[0].p1).toEqual('Hello world!')
      expect(actual.instances.WithParams[0].p2).toEqual('42')
    })

    it('passes models to constructor', () => {
      const actual = TemplateHandler.parse('Hello world!', { page: Page, fileHandler: FileHandler })
      expect(actual.models.page).toEqual(Page)
      expect(actual.models.fileHandler).toEqual(FileHandler)
    })
  })

  describe('load', () => {
    it('loads an empty TemplateHandler if there\'s nothing to get', async () => {
      expect.assertions(2)
      const actual = await TemplateHandler.load(1, db)
      expect(actual).toBeInstanceOf(TemplateHandler)
      expect(actual.instances).toEqual({})
    })

    it('loads data for the page\'s template from the database', async () => {
      expect.assertions(9)
      const pre = 'INSERT INTO templates (page, template, instance, parameter, value) VALUES'
      await testUtils.createTestPage(Page, Member, db)
      await db.run(`${pre} (1, "Test1", 0, NULL, NULL);`)
      await db.run(`${pre} (1, "Test2", 0, "", "");`)
      await db.run(`${pre} (1, "Test3", 0, "p1", "Hello world!");`)
      await db.run(`${pre} (1, "Test4", 0, "p1", "Hello world!");`)
      await db.run(`${pre} (1, "Test4", 0, "p2", "42");`)
      const actual = await TemplateHandler.load(1, db)
      await testUtils.resetTables(db)
      expect(actual).toBeInstanceOf(TemplateHandler)
      expect(Object.keys(actual.instances)).toHaveLength(4)
      expect(actual.instances.Test1).toEqual([{}])
      expect(actual.instances.Test2).toEqual([{}])
      expect(actual.instances.Test3).toHaveLength(1)
      expect(actual.instances.Test3[0].p1).toEqual('Hello world!')
      expect(actual.instances.Test4).toHaveLength(1)
      expect(actual.instances.Test4[0].p1).toEqual('Hello world!')
      expect(actual.instances.Test4[0].p2).toEqual('42')
    })

    it('loads what was saved', async () => {
      expect.assertions(7)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new TemplateHandler()
      handler.add('Tpl1', { a: 1, b: 2, c: 3 })
      await handler.save(page.id, db)
      const actual = await TemplateHandler.load(page.id, db)
      await testUtils.resetTables(db)
      expect(actual).toBeInstanceOf(TemplateHandler)
      expect(Object.keys(actual.instances)).toHaveLength(1)
      expect(actual.instances.Tpl1).toBeDefined()
      expect(actual.instances.Tpl1).toHaveLength(1)
      expect(actual.instances.Tpl1[0].a).toEqual('1')
      expect(actual.instances.Tpl1[0].b).toEqual('2')
      expect(actual.instances.Tpl1[0].c).toEqual('3')
    })

    it('keeps instances together', async () => {
      expect.assertions(9)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new TemplateHandler()
      handler.add('Test', { a: 1, b: 2 })
      handler.add('Test', { a: 2, b: 3, c: 4 })
      await handler.save(page.id, db)
      const actual = await TemplateHandler.load(page.id, db)
      await testUtils.resetTables(db)
      expect(actual).toBeInstanceOf(TemplateHandler)
      expect(Object.keys(actual.instances)).toHaveLength(1)
      expect(actual.instances.Test).toHaveLength(2)
      expect(actual.instances.Test[0].a).toEqual('1')
      expect(actual.instances.Test[0].b).toEqual('2')
      expect(actual.instances.Test[0].c).not.toBeDefined()
      expect(actual.instances.Test[1].a).toEqual('2')
      expect(actual.instances.Test[1].b).toEqual('3')
      expect(actual.instances.Test[1].c).toEqual('4')
    })
  })

  describe('query', () => {
    it('queries for template use', async () => {
      expect.assertions(6)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Test', { a: 1, b: 2 })
      handler.add('Test', { c: 3 })
      handler.add('Test')
      await handler.save(page.id, db)
      const actual = await TemplateHandler.query({ name: 'Test', parameter: 'a' }, null, db)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].path).toEqual('/test-page')
      expect(actual[0].title).toEqual('Test Page')
      expect(actual[0].templates[0].a).toEqual('1')
      expect(actual[0].templates[0].b).toEqual('2')
      expect(actual[0].templates[0].template).toEqual('Test')
    })

    it('doesn\'t return results on pages you don\'t have permission to read', async () => {
      expect.assertions(1)
      const page = await testUtils.createTestPage(Page, Member, db)
      const member = await Member.load(2, db)
      await page.save({ title: 'Test Page', body: 'This is a test.', permissions: 770 }, member, 'Hide from outside visitors', db)
      const handler = new TemplateHandler({ page: Page, fileHandler: FileHandler })
      handler.add('Test', { a: 1, b: 2 })
      handler.add('Test', { c: 3 })
      handler.add('Test')
      await handler.save(page.id, db)
      const actual = await TemplateHandler.query({ name: 'Test', parameter: 'a' }, null, db)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(0)
    })

    it('doesn\'t return pages that don\'t use the template', async () => {
      expect.assertions(2)
      await testUtils.createTestPage(Page, Member, db)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'Page with Template', body: '{{Test}}' }, editor, 'Initial text', db)
      const actual = await TemplateHandler.query({ name: 'Test' }, null, db)
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(1)
      expect(actual[0].title).toEqual('Page with Template')
    })
  })
})
