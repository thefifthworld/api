/* global describe, it, expect, afterAll */

const fetch = require('node-fetch')
const sizeOf = require('buffer-image-size')
const db = require('../db')
const testUtils = require('../test-utils')
const Member = require('./member')
const Page = require('./page')
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
  afterAll(() => { db.end() })

  describe('constructor', () => {
    it('creates a new FileHandler', () => {
      const actual = new FileHandler()
      expect(actual).toBeInstanceOf(FileHandler)
    })

    it('copies values', () => {
      const now = new Date()
      const obj = {
        name: 'test.png',
        thumbnail: 'test.thumb.png',
        mime: 'image/png',
        size: 9999,
        page: 1,
        timestamp: now.getTime() / 1000,
        uploader: 1
      }

      const actual = new FileHandler(obj)
      expect(actual.name).toEqual(obj.name)
      expect(actual.thumbnail).toEqual(obj.thumbnail)
      expect(actual.mime).toEqual(obj.mime)
      expect(actual.size).toEqual(obj.size)
      expect(actual.page).toEqual(obj.page)
      expect(actual.timestamp).toEqual(obj.timestamp)
      expect(actual.uploader).toEqual(obj.uploader)
    })

    it('captures mimetype', () => {
      const actual = new FileHandler({ mimetype: 'image/png' })
      expect(actual.mime).toEqual('image/png')
    })
  })

  describe('save', () => {
    it('saves file record', async () => {
      const test = await testUtils.createTestPage(Page, Member, db)
      const uploader = await Member.load(2, db)
      const obj = {
        name: 'test.txt',
        mime: 'plain/text',
        size: 0,
        page: test.id,
        uploader: uploader.id
      }
      const handler = new FileHandler(obj)
      await handler.save(db)
      const check = await db.run(`SELECT * FROM files;`)
      await testUtils.resetTables(db)

      expect(check).toHaveLength(1)
      expect(check[0].name).toEqual(obj.name)
      expect(check[0].thumbnail).toEqual(null)
      expect(check[0].mime).toEqual(obj.mime)
      expect(check[0].size).toEqual(obj.size)
      expect(check[0].page).toEqual(test.id)
      expect(check[0].uploader).toEqual(uploader.id)
    })
  })

  describe('load', () => {
    it('loads files', async () => {
      const test = await testUtils.createTestPage(Page, Member, db)
      const uploader = await Member.load(2, db)
      const obj = { name: 'test.txt', mime: 'plain/text', size: 0, page: test.id, uploader: uploader.id }
      const h1 = new FileHandler(obj); await h1.save(db)
      const h2 = new FileHandler(obj); await h2.save(db)
      const actual = await FileHandler.load(test, db)
      await testUtils.resetTables(db)

      expect(actual).toHaveLength(2)
      expect(actual[0].name).toEqual(obj.name)
      expect(actual[1].name).toEqual(obj.name)
    })
  })

  describe('handle', () => {
    it('handles file uploads', async () => {
      const files = { file: testUtils.mockTXT() }
      const handler = await FileHandler.handle(files, { id: 3 }, { id: 4 })
      const fileCheckBefore = await check(FileHandler.getURL(handler.name))
      const thumbnailCheckBefore = await check(FileHandler.getURL(handler.thumbnail))
      await FileHandler.remove(handler.name)
      await FileHandler.remove(handler.thumbnail)
      const fileCheckAfter = await check(FileHandler.getURL(handler.name))
      const thumbnailCheckAfter = await check(FileHandler.getURL(handler.thumbnail))

      expect(handler.size).toEqual(files.file.size)
      expect(handler.mime).toEqual(files.file.mimetype)
      expect(handler.page).toEqual(3)
      expect(handler.uploader).toEqual(4)
      expect(fileCheckBefore.status).toEqual(200)
      expect(thumbnailCheckBefore.status).toEqual(403)
      expect(fileCheckAfter.status).toEqual(403)
      expect(thumbnailCheckAfter.status).toEqual(403)
    })

    it('handles art uploads that need a thumbnail', async () => {
      const files = { file: testUtils.mockJPEG() }
      const handler = await FileHandler.handle(files)
      const fileCheckBefore = await check(FileHandler.getURL(handler.name))
      const thumbnailCheckBefore = await check(FileHandler.getURL(handler.thumbnail))
      await FileHandler.remove(handler.name)
      await FileHandler.remove(handler.thumbnail)
      const fileCheckAfter = await check(FileHandler.getURL(handler.name))
      const thumbnailCheckAfter = await check(FileHandler.getURL(handler.thumbnail))

      expect(handler.size).toEqual(files.file.size)
      expect(handler.mime).toEqual(files.file.mimetype)
      expect(handler.name.endsWith('.jpg')).toEqual(true)
      expect(handler.thumbnail.endsWith('.jpg')).toEqual(true)
      expect(fileCheckBefore.status).toEqual(200)
      expect(thumbnailCheckBefore.status).toEqual(200)
      expect(fileCheckAfter.status).toEqual(403)
      expect(thumbnailCheckAfter.status).toEqual(403)
    })

    it('handles art uploads that come with a thumbnail', async () => {
      const files = {
        file: testUtils.mockJPEG(),
        thumbnail: testUtils.mockGIF()
      }
      const handler = await FileHandler.handle(files)
      const fileCheckBefore = await check(FileHandler.getURL(handler.name))
      const thumbnailCheckBefore = await check(FileHandler.getURL(handler.thumbnail))
      await FileHandler.remove(handler.name)
      await FileHandler.remove(handler.thumbnail)
      const fileCheckAfter = await check(FileHandler.getURL(handler.name))
      const thumbnailCheckAfter = await check(FileHandler.getURL(handler.thumbnail))

      expect(handler.size).toEqual(files.file.size)
      expect(handler.mime).toEqual(files.file.mimetype)
      expect(handler.name.endsWith('.jpg')).toEqual(true)
      expect(handler.thumbnail.endsWith('.gif')).toEqual(true)
      expect(fileCheckBefore.status).toEqual(200)
      expect(thumbnailCheckBefore.status).toEqual(200)
      expect(fileCheckAfter.status).toEqual(403)
      expect(thumbnailCheckAfter.status).toEqual(403)
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
      const thumb = await FileHandler.createThumbnail(file)
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

  describe('createThumbnail', () => {
    it('returns a thumbnail', async () => {
      const file = testUtils.mockJPEG()
      const thumbnail = await FileHandler.createThumbnail(file)
      const dimensions = sizeOf(thumbnail.data)
      expect(dimensions.height).toEqual(256)
      expect(dimensions.width).toEqual(256)
      expect(thumbnail.size).toBeLessThan(file.size)
    })
  })
})
