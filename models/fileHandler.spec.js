/* global describe, it, expect */

const fetch = require('node-fetch')
const sizeOf = require('buffer-image-size')
const config = require('../config')
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

  describe('handleArt', () => {
    it('uploads the art and its thumbnail', async () => {
      const art = testUtils.mockJPEG()
      const thumb = testUtils.mockGIF()
      const res = await FileHandler.handleArt(art, thumb)
      const a = await check(FileHandler.getURL(res.file))
      const b = await check(FileHandler.getURL(res.thumbnail))
      await FileHandler.remove(res.file)
      await FileHandler.remove(res.thumbnail)
      const c = await check(FileHandler.getURL(res.file))
      const d = await check(FileHandler.getURL(res.thumbnail))

      expect(res.file).toBeDefined()
      expect(res.thumbnail).toBeDefined()
      expect(res.file.startsWith('uploads/test.')).toEqual(true)
      expect(res.thumbnail.startsWith('uploads/test.thumb.')).toEqual(true)
      expect(a.status).toEqual(200)
      expect(b.status).toEqual(200)
      expect(c.status).toEqual(403)
      expect(d.status).toEqual(403)
    })

    it('generates a thumbnail', async () => {
      const art = testUtils.mockJPEG()
      const res = await FileHandler.handleArt(art)
      const a = await check(FileHandler.getURL(res.file))
      const b = await check(FileHandler.getURL(res.thumbnail))
      await FileHandler.remove(res.file)
      await FileHandler.remove(res.thumbnail)
      const c = await check(FileHandler.getURL(res.file))
      const d = await check(FileHandler.getURL(res.thumbnail))

      expect(res.file).toBeDefined()
      expect(res.thumbnail).toBeDefined()
      expect(res.file.startsWith('uploads/test.')).toEqual(true)
      expect(res.thumbnail.startsWith('uploads/test.thumb.')).toEqual(true)
      expect(a.status).toEqual(200)
      expect(b.status).toEqual(200)
      expect(c.status).toEqual(403)
      expect(d.status).toEqual(403)
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

    it('uploads a thumbnail', async () => {
      const file = testUtils.mockJPEG()
      const thumb = await FileHandler.thumbnail(file)
      const res = await FileHandler.upload(thumb, true)
      const url = res.Location
      const a = await check(url)
      await FileHandler.remove(res.key)
      const b = await check(url)
      expect(res.key).toBeDefined()
      expect(res.key.startsWith('uploads/test.thumb.')).toEqual(true)
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
