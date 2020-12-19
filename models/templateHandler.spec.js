/* global describe, it, expect, afterAll */

const TemplateHandler = require('./templateHandler')

describe('TemplateHandler', () => {
  describe('constructor', () => {
    it('prepares an object for storing templates', () => {
      const actual = new TemplateHandler()
      expect(actual.templates).toEqual({})
    })
  })
})