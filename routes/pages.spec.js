/* global describe, it, expect, beforeAll, beforeEach, afterEach, afterAll */

const supertest = require('supertest')
const FileHandler = require('../models/fileHandler')
const Page = require('../models/page')
const Member = require('../models/member')
const db = require('../db')
const api = require('../api')
const testUtils = require('../test-utils')

describe('Pages API', () => {
  let server = {}
  let request = {}

  beforeAll(async () => { server = await api.listen(8888) })
  beforeEach(async done => {
    request = supertest(server)
    await testUtils.resetTables(db)
    await testUtils.createTestPage(Page, Member, db)
    done()
  })

  afterEach(async done => {
    await testUtils.resetTables(db)
    done()
  })

  afterAll(done => {
    server.close(() => {
      api.closeDB(() => {
        api.close(() => {
          db.close(done)
        })
      })
    })
  })

  describe('POST /pages', () => {
    it('creates a page', async () => {
      expect.assertions(6)
      const data = { title: 'New Page', body: 'This is a new page.', msg: 'Initial text' }
      const res = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send(data)
      const check = await db.run(`SELECT title FROM pages WHERE id=${res.body.id};`)
      expect(res.status).toEqual(200)
      expect(res.body.path).toEqual('/new-page')
      expect(res.body.title).toEqual('New Page')
      expect(res.body.history.changes).toHaveLength(1)
      expect(check).toHaveLength(1)
      expect(check[0].title).toEqual(res.body.title)
    })

    it('returns 401 if you\'re not logged in', async () => {
      expect.assertions(2)
      const data = { title: 'New Page', body: 'This is a new page.', msg: 'Initial text' }
      const res = await request.post('/pages').send(data)
      const check = await db.run(`SELECT title FROM pages WHERE path='/new-page';`)
      expect(res.status).toEqual(401)
      expect(check).toHaveLength(0)
    })

    it('handles files', async () => {
      expect.assertions(5)
      const data = { title: 'Test File', body: 'This is a text file.', msg: 'Initial text', files: { file: testUtils.mockTXT() } }
      const res = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send(data)
      const file = res && res.body && res.body.files && res.body.files.length > 0 ? res.body.files[0] : null
      const url = file && file.name ? FileHandler.getURL(file.name) : null
      const check = url ? await testUtils.checkURL(url) : { status: null }
      if (file) await FileHandler.remove(file.name, db)

      expect(res.status).toEqual(200)
      expect(check.status).toEqual(200)
      expect(file.name.substr(file.name.length - 4)).toEqual('.txt')
      expect(file.name.startsWith('uploads/test.')).toEqual(true)
      expect(file.mime).toEqual('text/plain')
    })

    it('creates a thumbnail', async () => {
      expect.assertions(8)
      const data = { title: 'Test File', body: 'This is a text file.', msg: 'Initial text', files: { file: testUtils.mockJPEG() } }
      const res = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send(data)
      const file = res && res.body && res.body.files && res.body.files.length > 0 ? res.body.files[0] : null
      const imgURL = file && file.name ? FileHandler.getURL(file.name) : null
      const thumbURL = file && file.thumbnail ? FileHandler.getURL(file.thumbnail) : null
      const checkImg = imgURL ? await testUtils.checkURL(imgURL) : { status: null }
      const checkThumb = thumbURL ? await testUtils.checkURL(thumbURL) : { status: null }
      if (file) await FileHandler.remove(file.name, db)

      expect(res.status).toEqual(200)
      expect(checkImg.status).toEqual(200)
      expect(checkThumb.status).toEqual(200)
      expect(file.name.substr(file.name.length - 4)).toEqual('.jpg')
      expect(file.name.startsWith('uploads/test.')).toEqual(true)
      expect(file.thumbnail.substr(file.thumbnail.length - 4)).toEqual('.jpg')
      expect(file.thumbnail.startsWith('uploads/test.thumb.')).toEqual(true)
      expect(file.mime).toEqual('image/jpeg')
    })

    it('can accept a thumbnail', async () => {
      expect.assertions(8)
      const data = { title: 'Test File', body: 'This is a text file.', msg: 'Initial text', files: { file: testUtils.mockJPEG(), thumbnail: testUtils.mockGIF() } }
      const res = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send(data)
      const file = res && res.body && res.body.files && res.body.files.length > 0 ? res.body.files[0] : null
      const imgURL = file && file.name ? FileHandler.getURL(file.name) : null
      const thumbURL = file && file.thumbnail ? FileHandler.getURL(file.thumbnail) : null
      const checkImg = imgURL ? await testUtils.checkURL(imgURL) : { status: null }
      const checkThumb = thumbURL ? await testUtils.checkURL(thumbURL) : { status: null }
      if (file) await FileHandler.remove(file.name, db)

      expect(res.status).toEqual(200)
      expect(checkImg.status).toEqual(200)
      expect(checkThumb.status).toEqual(200)
      expect(file.name.substr(file.name.length - 4)).toEqual('.jpg')
      expect(file.name.startsWith('uploads/test.')).toEqual(true)
      expect(file.thumbnail.substr(file.thumbnail.length - 4)).toEqual('.gif')
      expect(file.thumbnail.startsWith('uploads/test.thumb.')).toEqual(true)
      expect(file.mime).toEqual('image/jpeg')
    })
  })

  describe('GET /pages/*/like', () => {
    it('saves a like', async () => {
      expect.assertions(2)
      const res = await request.get('/pages/test-page/like').auth('normal@thefifthworld.com', 'password')
      expect(res.status).toEqual(200)
      expect(res.body.likes.ids).toHaveLength(1)
    })
  })

  describe('GET /pages/*/unlike', () => {
    it('removes a like', async () => {
      expect.assertions(2)
      await request.get('/pages/test-page/like').auth('normal@thefifthworld.com', 'password')
      const res = await request.get('/pages/test-page/unlike').auth('normal@thefifthworld.com', 'password')
      expect(res.status).toEqual(200)
      expect(res.body.likes.ids).toHaveLength(0)
    })
  })

  describe('PATCH /pages/*/lock', () => {
    it('locks a page', async () => {
      expect.assertions(6)
      const res = await request.patch('/pages/test-page/lock').auth('admin@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(444)
      expect(page.checkPermissions(admin, 6)).toEqual(true)
      expect(page.checkPermissions(normal, 6)).toEqual(false)
      expect(page.checkPermissions(other, 6)).toEqual(false)
      expect(page.checkPermissions(null, 6)).toEqual(false)
    })

    it('requires an admin', async () => {
      expect.assertions(6)
      const res = await request.patch('/pages/test-page/lock').auth('normal@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(401)
      expect(res.body.permissions).toEqual(774)
      expect(page.checkPermissions(admin, 6)).toEqual(true)
      expect(page.checkPermissions(normal, 6)).toEqual(true)
      expect(page.checkPermissions(other, 6)).toEqual(true)
      expect(page.checkPermissions(null, 6)).toEqual(false)
    })
  })

  describe('PATCH /pages/*/unlock', () => {
    it('unlocks a page', async () => {
      expect.assertions(6)
      await request.patch('/pages/test-page/lock').auth('admin@thefifthworld.com', 'password')
      const res = await request.patch('/pages/test-page/unlock').auth('admin@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(774)
      expect(page.checkPermissions(admin, 6)).toEqual(true)
      expect(page.checkPermissions(normal, 6)).toEqual(true)
      expect(page.checkPermissions(other, 6)).toEqual(true)
      expect(page.checkPermissions(null, 6)).toEqual(false)
    })

    it('requires an admin', async () => {
      expect.assertions(6)
      await request.patch('/pages/test-page/lock').auth('admin@thefifthworld.com', 'password')
      const res = await request.patch('/pages/test-page/unlock').auth('normal@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(401)
      expect(res.body.permissions).toEqual(444)
      expect(page.checkPermissions(admin, 6)).toEqual(true)
      expect(page.checkPermissions(normal, 6)).toEqual(false)
      expect(page.checkPermissions(other, 6)).toEqual(false)
      expect(page.checkPermissions(null, 6)).toEqual(false)
    })
  })

  describe('PATCH /pages/*/hide', () => {
    it('allows an admin to hide a page', async () => {
      expect.assertions(6)
      const res = await request.patch('/pages/test-page/hide').auth('admin@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(700)
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(false)
      expect(page.checkPermissions(null, 4)).toEqual(false)
    })

    it('allows a page owner to hide her page', async () => {
      expect.assertions(6)
      const res = await request.patch('/pages/test-page/hide').auth('normal@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(700)
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(false)
      expect(page.checkPermissions(null, 4)).toEqual(false)
    })

    it('requires an admin or the page owner', async () => {
      expect.assertions(6)
      const res = await request.patch('/pages/test-page/hide').auth('other@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(401)
      expect(res.body.permissions).toEqual(774)
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(true)
      expect(page.checkPermissions(null, 4)).toEqual(true)
    })
  })

  describe('PATCH /pages/*/unhide', () => {
    it('allows an admin to unhide a page', async () => {
      expect.assertions(6)
      await request.patch('/pages/test-page/hide').auth('admin@thefifthworld.com', 'password')
      const res = await request.patch('/pages/test-page/unhide').auth('admin@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(774)
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(true)
      expect(page.checkPermissions(null, 4)).toEqual(true)
    })

    it('allows a page owner to unhide her page', async () => {
      expect.assertions(6)
      await request.patch('/pages/test-page/hide').auth('normal@thefifthworld.com', 'password')
      const res = await request.patch('/pages/test-page/unhide').auth('normal@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(774)
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(true)
      expect(page.checkPermissions(null, 4)).toEqual(true)
    })

    it('requires an admin or the page owner', async () => {
      expect.assertions(6)
      await request.patch('/pages/test-page/hide').auth('normal@thefifthworld.com', 'password')
      const res = await request.patch('/pages/test-page/unhide').auth('other@thefifthworld.com', 'password')
      const page = await Page.get('/test-page', db)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      expect(res.status).toEqual(401)
      expect(res.body).toEqual({})
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(false)
      expect(page.checkPermissions(null, 4)).toEqual(false)
    })
  })

  describe('GET /pages', () => {
    it('returns matching pages', async () => {
      expect.assertions(5)
      const r1 = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      const r2 = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Child Page', body: 'This is the child.', parent: r1.body.id, msg: 'Initial text' })
      const r3 = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Second Page', body: 'This is another page.', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages').send({ path: '/parent-page' })
      const ids = actual.body.map(p => p.id)

      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(2)
      expect(ids).toContain(r1.body.id)
      expect(ids).toContain(r2.body.id)
      expect(ids).not.toContain(r3.body.id)
    })
  })

  describe('POST /pages/*', () => {
    it('updates a page', async () => {
      expect.assertions(9)
      const data = { title: 'Test Page', body: 'This is an update.', msg: 'Testing update' }
      const res = await request.post('/pages/test-page').auth('normal@thefifthworld.com', 'password').send(data)
      const check = await Page.get(res.body.id, db)
      const actual = res && res.body && res.body.history && Array.isArray(res.body.history.changes) && res.body.history.changes[0].content && res.body.history.changes[0].content.body
        ? res.body.history.changes[0].content.body
        : false

      expect(res.status).toEqual(200)
      expect(actual).not.toEqual(false)
      expect(res.body.path).toEqual('/test-page')
      expect(res.body.title).toEqual('Test Page')
      expect(res.body.history.changes).toHaveLength(2)
      expect(actual).toEqual(data.body)
      expect(check).toBeInstanceOf(Page)
      expect(check.history.getBody()).toEqual(data.body)
      expect(check.title).toEqual(res.body.title)
    })

    it('returns 401 if you don\'t have permission', async () => {
      expect.assertions(4)
      await request.post('/pages/test-page').auth('normal@thefifthworld.com', 'password').send({ title: 'Test PAge', body: 'This is a test page.', msg: 'Locking out other editors', permissions: 700 })
      const update = { title: 'Test Page', body: 'This is an update.', msg: 'Locking out other editors' }
      const res = await request.post('/pages/test-page').auth('other@thefifthworld.com', 'password').send(update)
      const check = await Page.get('/test-page', db)
      const actual = res && res.body && res.body.history && Array.isArray(res.body.history.changes) && res.body.history.changes[0].content && res.body.history.changes[0].content.body
        ? res.body.history.changes[0].content.body
        : false

      expect(res.status).toEqual(401)
      expect(actual).not.toEqual(update.body)
      expect(check).toBeInstanceOf(Page)
      expect(check.history.getBody()).not.toEqual(update.body)
    })

    it('updates a file', async () => {
      expect.assertions(9)
      const data = { title: 'Image', body: 'This is an image.', msg: 'Initial text', files: { file: testUtils.mockGIF() } }
      await request.post('/pages').auth('normal@thefifthworld.com', 'password').send(data)
      data.files = { file: testUtils.mockJPEG() }
      const after = await request.post('/pages/image').auth('normal@thefifthworld.com', 'password').send(data)

      const file = after && after.body && after.body.files && after.body.files.length > 0 ? after.body.files[0] : null
      const main = file && file.name ? FileHandler.getURL(file.name) : null
      const checkMain = main ? await testUtils.checkURL(main) : { status: null }
      const thumb = file && file.thumbnail ? FileHandler.getURL(file.thumbnail) : null
      const checkThumb = thumb ? await testUtils.checkURL(thumb) : { status: null }
      if (after && after.body && after.body.files) {
        for (const file of after.body.files) {
          await FileHandler.remove(file.name, db)
        }
      }

      expect(after.status).toEqual(200)
      expect(checkMain.status).toEqual(200)
      expect(checkThumb.status).toEqual(200)
      expect(after.body.files).toHaveLength(2)
      expect(file.mime).toEqual('image/jpeg')
      expect(file.name.startsWith('uploads/test.')).toEqual(true)
      expect(file.name.substr(file.name.length - 4)).toEqual('.jpg')
      expect(file.thumbnail.startsWith('uploads/test.thumb.')).toEqual(true)
      expect(file.thumbnail.substr(file.thumbnail.length - 4)).toEqual('.jpg')
    })

    it('can accept a thumbnail', async () => {
      expect.assertions(9)
      const data = { title: 'Image', body: 'This is an image.', msg: 'Initial text', files: { file: testUtils.mockGIF(), thumbnail: testUtils.mockJPEG() } }
      await request.post('/pages').auth('normal@thefifthworld.com', 'password').send(data)
      data.files = { file: testUtils.mockJPEG(), thumbnail: testUtils.mockGIF() }
      const after = await request.post('/pages/image').auth('normal@thefifthworld.com', 'password').send(data)

      const file = after && after.body && after.body.files && after.body.files.length > 0 ? after.body.files[0] : null
      const main = file && file.name ? FileHandler.getURL(file.name) : null
      const checkMain = main ? await testUtils.checkURL(main) : { status: null }
      const thumb = file && file.thumbnail ? FileHandler.getURL(file.thumbnail) : null
      const checkThumb = thumb ? await testUtils.checkURL(thumb) : { status: null }
      if (after && after.body && after.body.files) {
        for (const file of after.body.files) {
          await FileHandler.remove(file.name, db)
        }
      }

      expect(after.status).toEqual(200)
      expect(checkMain.status).toEqual(200)
      expect(checkThumb.status).toEqual(200)
      expect(after.body.files).toHaveLength(2)
      expect(file.mime).toEqual('image/jpeg')
      expect(file.name.startsWith('uploads/test.')).toEqual(true)
      expect(file.name.substr(file.name.length - 4)).toEqual('.jpg')
      expect(file.thumbnail.startsWith('uploads/test.thumb.')).toEqual(true)
      expect(file.thumbnail.substr(file.thumbnail.length - 4)).toEqual('.gif')
    })
  })

  describe('GET /pages/*', () => {
    it('returns 200', async () => {
      expect.assertions(5)
      const res = await request.get('/pages/test-page')
      const { page, markup } = res.body
      expect(res.status).toEqual(200)
      expect(page.path).toEqual('/test-page')
      expect(page.title).toEqual('Test Page')
      expect(page.history.changes).toHaveLength(1)
      expect(markup).toEqual('<p>This is a test page.</p>\n')
    })

    it('returns 401 if you don\'t have permission', async () => {
      expect.assertions(1)
      const editor = await Member.load(2, db)
      const data = { title: 'New Page', body: 'This is a new page.', permissions: 700 }
      const page = await Page.create(data, editor, 'Initial text', db)
      const res = await request.get(`/pages${page.path}`)
      expect(res.status).toEqual(401)
    })
  })

  describe('GET /near/:lat/:lon/:dist*?', () => {
    it('returns places near a point', async () => {
      expect.assertions(10)
      const point = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'The Point', body: '[[Location:40.441800, -80.012772]]', msg: 'Initial text' })
      const myland = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Three Myland', body: '[[Location:40.154507, -76.724877]]', msg: 'Initial text' })
      const tower = await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'The Steel Tower', body: '[[Location:40.441399, -79.994673]]', permissions: 700, msg: 'Initial text' })
      const r1 = await request.get('/near/40.440667/-80.002583')
      const r2 = await request.get('/near/40.440667/-80.002583/400000')
      const distDefault = r1.body.map(p => p.id)
      const dist400km = r2.body.map(p => p.id)

      expect(r1.status).toEqual(200)
      expect(r2.status).toEqual(200)
      expect(distDefault).toHaveLength(1)
      expect(distDefault).toContain(point.body.id)
      expect(distDefault).not.toContain(myland.body.id)
      expect(distDefault).not.toContain(tower.body.id)
      expect(dist400km).toHaveLength(2)
      expect(dist400km).toContain(point.body.id)
      expect(dist400km).toContain(myland.body.id)
      expect(dist400km).not.toContain(tower.body.id)
    })
  })

  describe('GET /requested', () => {
    it('returns requested links', async () => {
      expect.assertions(5)
      await request.post('/pages').auth('normal@thefifthworld.com', 'password').send({ title: 'Test', body: '[[Link One]] [[Link Two]] [[Link Three]]', msg: 'Initial text' })
      const res = await request.get('/requested')

      expect(res.status).toEqual(200)
      expect(res.body).toHaveLength(3)
      expect(res.body[0]).toEqual({ title: 'Link One', links: [ { id: 2, title: 'Test', path: '/test' } ] })
      expect(res.body[1]).toEqual({ title: 'Link Two', links: [ { id: 2, title: 'Test', path: '/test' } ] })
      expect(res.body[2]).toEqual({ title: 'Link Three', links: [ { id: 2, title: 'Test', path: '/test' } ] })
    })
  })

  describe('POST /checkpath', () => {
    it('tells you that you can\'t use a reserved name', async () => {
      expect.assertions(2)
      const { body } = await request.post('/checkpath').send({ title: 'Welcome' })
      expect(body.ok).toEqual(false)
      expect(body.error).toEqual('We reserve <code>/welcome</code> for internal use.')
    })

    it('tells you that you can\'t use a reserved template', async () => {
      expect.assertions(2)
      const { body } = await request.post('/checkpath').send({ title: 'Children', type: 'Template' })
      expect(body.ok).toEqual(false)
      expect(body.error).toEqual('We use <code>{{Children}}</code> internally. You cannot create a template with that name.')
    })

    it('tells you that you can\'t use a URL that\'s already in use', async () => {
      expect.assertions(2)
      const { body } = await request.post('/checkpath').send({ title: 'Test Page' })
      expect(body.ok).toEqual(false)
      expect(body.error).toEqual('A page with the path <code>/test-page</code> already exists.')
    })

    it('tells you that you can create a new page', async () => {
      expect.assertions(2)
      const { body } = await request.post('/checkpath').send({ title: 'New Page' })
      expect(body.ok).toEqual(true)
      expect(body.error).not.toBeDefined()
    })

    it('tells you that you can create a new page with an existing name if it\'s in a new scope', async () => {
      expect.assertions(2)
      const { body } = await request.post('/checkpath').send({ title: 'Test Page', parent: '/test-page' })
      expect(body.ok).toEqual(true)
      expect(body.error).not.toBeDefined()
    })

    it('tells you that you can\'t create a new page with an existing name in a new scope if that scope doesn\'t exist', async () => {
      expect.assertions(2)
      const { body } = await request.post('/checkpath').send({ title: 'Test Page', parent: '/new-page' })
      expect(body.ok).toEqual(false)
      expect(body.error).toEqual('A page with the path <code>/test-page</code> already exists.')
    })
  })
})
