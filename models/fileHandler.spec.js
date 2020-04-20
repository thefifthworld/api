/* global describe, it, expect */

const fetch = require('node-fetch')
const sizeOf = require('buffer-image-size')
const testUtils = require('../test-utils')
const FileHandler = require('./fileHandler')

/**
 * Request a URL and return the response.
 * @param url {!string} - A URL to request.
 * @returns {Promise<{}>} - A Promise that resolves with the response obtained
 *   from requesting the given URL.
 */

const check = async url => {
  try {
    const res = await fetch(url)
    return res
  } catch (err) {
    console.error(err)
  }
}

describe('FileHandler', () => {
  describe('constructor', () => {
    it('creates a new FileHandler', () => {
      const actual = new FileHandler()
      expect(actual).toBeInstanceOf(FileHandler)
    })
  })

  describe('upload', () => {
    it('uploads a file', async () => {
      const file = testUtils.mockGIF()
      const res = await FileHandler.upload(file)
      const url = res.Location
      const a = await check(url)
      await FileHandler.remove(res.key)
      const b = await check(url)
      expect(res.key).toBeDefined()
      expect(a.status).toEqual(200)
      expect(b.status).toEqual(403)
    })
  })

  describe('thumbnail', () => {
    it('returns a thumbnail', async () => {
      const file = testUtils.mockJPEG()
      const thumbnail = await FileHandler.thumbnail(file)
      const dimensions = sizeOf(thumbnail.data)
      expect(dimensions.height).toEqual(256)
      expect(dimensions.width).toEqual(256)
      expect(thumbnail.size).toBeLessThan(file.size)
    })
  })
})
