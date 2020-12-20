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

  describe('save', () => {
    it('saves template data to the database', async () => {
      expect.assertions(4)
      const page = await testUtils.createTestPage(Page, Member, db)
      const handler = new TemplateHandler()
      handler.add('test', { a: 1, b: 2, c: 3 })
      await handler.save(page.id, db)
      const actual = await db.run('SELECT * FROM templates;')
      await testUtils.resetTables(db)
      expect(actual).toHaveLength(3)
      expect(actual[0]).toEqual({ id: 1, page: 1, template: 'test', instance: 0, parameter: 'a', value: '1' })
      expect(actual[1]).toEqual({ id: 2, page: 1, template: 'test', instance: 0, parameter: 'b', value: '2' })
      expect(actual[2]).toEqual({ id: 3, page: 1, template: 'test', instance: 0, parameter: 'c', value: '3' })
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
})
