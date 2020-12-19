/* global describe, it, expect, afterAll */

const TemplateHandler = require('./templateHandler')

describe('TemplateHandler', () => {
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
})
