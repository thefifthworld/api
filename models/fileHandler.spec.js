/* global describe, it, expect */

const testUtils = require('../test-utils')
const FileHandler = require('./fileHandler')

describe('FileHandler', () => {
  describe('constructor', () => {
    it('creates a new FileHandler', () => {
      const actual = new FileHandler()
      expect(actual).toBeInstanceOf(FileHandler)
    })

    it('copies fields', () => {
      const file = testUtils.mockGIF()
      const actual = new FileHandler(file)
      expect(actual).toBeInstanceOf(FileHandler)
      expect(actual.name).toEqual(file.name)
      expect(actual.data).toEqual(file.data)
      expect(actual.size).toEqual(file.size)
      expect(actual.encoding).toEqual(file.encoding)
      expect(actual.mimetype).toEqual(file.mimetype)
      expect(actual.md5).toEqual(file.md5)
    })
  })

  describe('upload', () => {
    it('uploads a file', async () => {
      const file = testUtils.mockGIF()
      const res = await FileHandler.upload(file)
      expect(res.key).toBeDefined()
    })
  })
})
