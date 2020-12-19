/* global describe, it, expect, afterAll */

const db = require('../db')
const testUtils = require('../test-utils')

const Page = require('./page')
const Member = require('./member')
const TemplateHandler = require('./templateHandler')

describe('TemplateHandler', () => {
  afterAll(() => { db.end() })

  describe('constructor', () => {
    it('prepares an object for storing templates', () => {
      const actual = new TemplateHandler()
      expect(actual.templates).toEqual({})
    })
  })

  describe('add', () => {
    it('adds an object to a property name', () => {
      const actual = new TemplateHandler()
      actual.add('test', { a: 1, b: 2, c: 3 })
      expect(actual.templates.test).toBeDefined()
      expect(actual.templates.test.a).toEqual(1)
      expect(actual.templates.test.b).toEqual(2)
      expect(actual.templates.test.c).toEqual(3)
    })
  })

  describe('parse', () => {
    it('parses templates from string', () => {
      const actual = TemplateHandler.parse('Hello world! {{NoParams}} {{WithParams\n  p1="Hello world!"\n  p2="42"}}')
      expect(actual.templates.NoParams).toEqual({})
      expect(actual.templates.WithParams).toBeDefined()
      expect(actual.templates.WithParams.p1).toEqual('Hello world!')
      expect(actual.templates.WithParams.p2).toEqual('42')
    })
  })

  describe('load', () => {
    it('loads an empty TemplateHandler if there\'s nothing to get', async () => {
      expect.assertions(2)
      const actual = await TemplateHandler.load(1, db)
      expect(actual).toBeInstanceOf(TemplateHandler)
      expect(actual.templates).toEqual({})
    })

    it('loads data for the page\'s template from the database', async () => {
      expect.assertions(7)
      const pre = 'INSERT INTO templates (page, template, parameter, value) VALUES'
      await testUtils.createTestPage(Page, Member, db)
      await db.run(`${pre} (1, "Test1", NULL, NULL);`)
      await db.run(`${pre} (1, "Test2", "", "");`)
      await db.run(`${pre} (1, "Test3", "p1", "Hello world!");`)
      await db.run(`${pre} (1, "Test4", "p1", "Hello world!");`)
      await db.run(`${pre} (1, "Test4", "p2", "42");`)
      const actual = await TemplateHandler.load(1, db)
      await testUtils.resetTables(db)
      expect(actual).toBeInstanceOf(TemplateHandler)
      expect(Object.keys(actual.templates)).toHaveLength(4)
      expect(actual.templates.Test1).toEqual({})
      expect(actual.templates.Test2).toEqual({})
      expect(actual.templates.Test3.p1).toEqual('Hello world!')
      expect(actual.templates.Test4.p1).toEqual('Hello world!')
      expect(actual.templates.Test4.p2).toEqual('42')
    })
  })
})
