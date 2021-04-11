/* global describe, it, expect, beforeAll, beforeEach, afterEach, afterAll */

const supertest = require('supertest')
const FileHandler = require('../models/fileHandler')
const Page = require('../models/page')
const Member = require('../models/member')
const config = require('../config')
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
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'New Page', body: 'This is a new page.', msg: 'Initial text' }
      const res = await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
      const check = await db.run(`SELECT title FROM pages WHERE id=${res.body.id};`)
      expect(res.status).toEqual(200)
      expect(res.body.path).toEqual('/new-page')
      expect(res.body.title).toEqual('New Page')
      expect(res.body.history).toHaveLength(1)
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
      expect.assertions(6)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'Test File', body: 'This is a text file.', msg: 'Initial text', files: { file: testUtils.mockTXT() } }
      const res = await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
      const file = res && res.body && res.body.files && res.body.files.length > 0 ? res.body.files[0] : null
      const url = file && file.name ? FileHandler.getURL(file.name) : null
      const check = url ? await testUtils.checkURL(url) : { status: null }
      if (file) await FileHandler.remove(file.name, db)

      expect(res.status).toEqual(200)
      expect(check.status).toEqual(200)
      expect(file.name.substr(file.name.length - 4)).toEqual('.txt')
      expect(file.name.startsWith('uploads/test.')).toEqual(true)
      expect(file.mime).toEqual('text/plain')
      expect(file.readableSize).toEqual('13 B')
    })

    it('creates a thumbnail', async () => {
      expect.assertions(8)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'Test File', body: 'This is a text file.', msg: 'Initial text', files: { file: testUtils.mockJPEG() } }
      const res = await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
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
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'Test File', body: 'This is a text file.', msg: 'Initial text', files: { file: testUtils.mockJPEG(), thumbnail: testUtils.mockGIF() } }
      const res = await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
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

    it('returns 400 if you try to create a page with a path that\'s already in use', async () => {
      expect.assertions(4)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'New Page', body: 'This is a new page.', msg: 'Initial text' }
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
      const res = await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
      const check = await db.run(`SELECT title FROM pages WHERE path = "/new-page";`)
      expect(res.body.error).toEqual(`Sorry, that won&rsquo;t work. A page with the path <code>/new-page</code> already exists.`)
      expect(res.status).toEqual(400)
      expect(check).toHaveLength(1)
      expect(check[0].title).toEqual("New Page")
    })

    it('returns 400 if you try to create a page with a path that ends in a numeric element', async () => {
      expect.assertions(3)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'New Page', body: 'This is a new page.', path: '/07', msg: 'Initial text' }
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
      const res = await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
      const check = await db.run(`SELECT title FROM pages WHERE path = "/new-page";`)
      expect(res.body.error).toEqual('Please don’t end a path with a number. That makes it difficult for the system to tell the difference between pages and versions of pages.')
      expect(res.status).toEqual(400)
      expect(check).toHaveLength(0)
    })
  })

  describe('POST /pages/*/like', () => {
    it('saves a like', async () => {
      expect.assertions(2)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const res = await request.post('/pages/test-page/like').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
      expect(res.body.likes).toHaveLength(1)
    })

    it('returns a 401 if you\'re not logged in', async () => {
      expect.assertions(1)
      const res = await request.post('/pages/test-page/like')
      expect(res.status).toEqual(401)
    })
  })

  describe('DELETE /pages/*/like', () => {
    it('removes a like', async () => {
      expect.assertions(2)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      await request.post('/pages/test-page/like').set('Authorization', `Bearer ${token}`)
      const res = await request.delete('/pages/test-page/like').set('Authorization', `Bearer ${token}`)
      expect(res.status).toEqual(200)
      expect(res.body.likes).toHaveLength(0)
    })
  })

  describe('PATCH /pages/*/lock', () => {
    it('locks a page', async () => {
      expect.assertions(6)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      const token = admin.generateJWT()
      const res = await request.patch('/pages/test-page/lock').set('Authorization', `Bearer ${token}`)
      const page = await Page.get('/test-page', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(444)
      expect(page.checkPermissions(admin, 6)).toEqual(true)
      expect(page.checkPermissions(normal, 6)).toEqual(false)
      expect(page.checkPermissions(other, 6)).toEqual(false)
      expect(page.checkPermissions(null, 6)).toEqual(false)
    })

    it('requires an admin', async () => {
      expect.assertions(6)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      const token = normal.generateJWT()
      const res = await request.patch('/pages/test-page/lock').set('Authorization', `Bearer ${token}`)
      const page = await Page.get('/test-page', db)
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
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      const token = admin.generateJWT()
      await request.patch('/pages/test-page/lock').set('Authorization', `Bearer ${token}`)
      const res = await request.patch('/pages/test-page/unlock').set('Authorization', `Bearer ${token}`)
      const page = await Page.get('/test-page', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(774)
      expect(page.checkPermissions(admin, 6)).toEqual(true)
      expect(page.checkPermissions(normal, 6)).toEqual(true)
      expect(page.checkPermissions(other, 6)).toEqual(true)
      expect(page.checkPermissions(null, 6)).toEqual(false)
    })

    it('requires an admin', async () => {
      expect.assertions(6)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      await request.patch('/pages/test-page/lock').set('Authorization', `Bearer ${admin.generateJWT()}`)
      const res = await request.patch('/pages/test-page/unlock').set('Authorization', `Bearer ${normal.generateJWT()}`)
      const page = await Page.get('/test-page', db)
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
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      const res = await request.patch('/pages/test-page/hide').set('Authorization', `Bearer ${admin.generateJWT()}`)
      const page = await Page.get('/test-page', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(700)
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(false)
      expect(page.checkPermissions(null, 4)).toEqual(false)
    })

    it('allows a page owner to hide her page', async () => {
      expect.assertions(6)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      const res = await request.patch('/pages/test-page/hide').set('Authorization', `Bearer ${normal.generateJWT()}`)
      const page = await Page.get('/test-page', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(700)
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(false)
      expect(page.checkPermissions(null, 4)).toEqual(false)
    })

    it('requires an admin or the page owner', async () => {
      expect.assertions(6)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      const res = await request.patch('/pages/test-page/hide').set('Authorization', `Bearer ${other.generateJWT()}`)
      const page = await Page.get('/test-page', db)
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
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      await request.patch('/pages/test-page/hide').set('Authorization', `Bearer ${admin.generateJWT()}`)
      const res = await request.patch('/pages/test-page/unhide').set('Authorization', `Bearer ${admin.generateJWT()}`)
      const page = await Page.get('/test-page', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(774)
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(true)
      expect(page.checkPermissions(null, 4)).toEqual(true)
    })

    it('allows a page owner to unhide her page', async () => {
      expect.assertions(6)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      await request.patch('/pages/test-page/hide').set('Authorization', `Bearer ${normal.generateJWT()}`)
      const res = await request.patch('/pages/test-page/unhide').set('Authorization', `Bearer ${normal.generateJWT()}`)
      const page = await Page.get('/test-page', db)
      expect(res.status).toEqual(200)
      expect(res.body.permissions).toEqual(774)
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(true)
      expect(page.checkPermissions(null, 4)).toEqual(true)
    })

    it('requires an admin or the page owner', async () => {
      expect.assertions(6)
      const admin = await Member.load('admin@thefifthworld.com', db)
      const normal = await Member.load('normal@thefifthworld.com', db)
      const other = await Member.load('other@thefifthworld.com', db)
      await request.patch('/pages/test-page/hide').set('Authorization', `Bearer ${normal.generateJWT()}`)
      const res = await request.patch('/pages/test-page/unhide').set('Authorization', `Bearer ${other.generateJWT()}`)
      const page = await Page.get('/test-page', db)
      expect(res.status).toEqual(401)
      expect(res.body).toEqual({})
      expect(page.checkPermissions(admin, 4)).toEqual(true)
      expect(page.checkPermissions(normal, 4)).toEqual(true)
      expect(page.checkPermissions(other, 4)).toEqual(false)
      expect(page.checkPermissions(null, 4)).toEqual(false)
    })
  })

  describe('GET /pages', () => {
    it('queries by path', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?path=%2Fparent-page')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(2)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id, r1.body.id ])
    })

    it('queries by title', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?title=Child')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(1)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id ])
    })

    it('respects read permissions', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?title=Page')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(3)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id, r1.body.id, 1 ])
    })

    it('queries by type', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      const r3 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?type=Test').set('Authorization', `Bearer ${token}`)
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(1)
      expect(actual.body.map(p => p.id)).toEqual([ r3.body.id ])
    })

    it('queries by tag', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?tag=Tag1:Hello&tag=Tag2:World')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(1)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id ])
    })

    it('filters by ancestor', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child.', parent: r1.body.id, msg: 'Initial text' })
      const r3 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page.', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Another Root Page', body: 'This is another page.', msg: 'Initial text' })
      const actual = await request.get('/pages?ancestor=/parent-page')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(2)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id, r3.body.id ])
    })

    it('returns any page with one of the tags with OR logic', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent. [[Tag1:Hello]]', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?tag=Tag1:Hello&tag=Tag2:World&logic=or')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(2)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id, r1.body.id ])
    })

    it('returns only pages that have both tags with default AND logic', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent. [[Tag1:Hello]]', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?tag=Tag1:Hello&tag=Tag2:World')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(1)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id ])
    })

    it('returns pages that have a given tag', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent. [[Tag1:Hello]]', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:World]] [[Tag2:Hello]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page.', parent: r1.body.id, msg: 'Initial text' })
      const actual = await request.get('/pages?tag=Tag1')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(2)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id, r1.body.id ])
    })

    it('returns pages that have all of the given tags', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent. [[Tag1:Hello]]', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:World]] [[Tag2:Hello]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page.', parent: r1.body.id, msg: 'Initial text' })
      const actual = await request.get('/pages?tag=Tag1&tag=Tag2')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(1)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id ])
    })

    it('returns pages that have any of the given tags', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent. [[Tag1:Hello]]', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:World]] [[Tag2:Hello]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page.', parent: r1.body.id, msg: 'Initial text' })
      const actual = await request.get('/pages?tag=Tag1&tag=Tag2&logic=or')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(2)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id, r1.body.id ])
    })

    it('can combine tag and type queries', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent. [[Tag1:Hello]]', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Type:Test]] [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?type=Test&tag=Tag1:Hello&tag=Tag2:World')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(1)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id ])
    })

    it('can combine tag and type queries with OR logic', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent. [[Tag1:Hello]]', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Type:Test]] [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      const r3 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, msg: 'Initial text' })
      const actual = await request.get('/pages?type=Test&tag=Tag1:Hello&tag=Tag2:World&logic=or')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(3)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id, r1.body.id, r3.body.id ])
    })

    it('sorts pages alphabetically by default', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Banana', body: 'This is definitely a page.', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Apple', body: 'This is definitely a page.', msg: 'Initial text' })
      const r3 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Cocoa', body: 'This is definitely a page.', msg: 'Initial text' })
      const actual = await request.get('/pages')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(4)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id, r1.body.id, r3.body.id, 1 ])
    })

    it('can sort pages in reverse alphabetical order', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Banana', body: 'This is definitely a page.', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Apple', body: 'This is definitely a page.', msg: 'Initial text' })
      const r3 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Cocoa', body: 'This is definitely a page.', msg: 'Initial text' })
      const actual = await request.get('/pages?order=reverse%20alphabetical')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(4)
      expect(actual.body.map(p => p.id)).toEqual([ 1, r3.body.id, r1.body.id, r2.body.id ])
    })

    it('limits the number of responses', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?path=%2Fparent-page&limit=1')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(1)
      expect(actual.body.map(p => p.id)).toEqual([ r2.body.id ])
    })

    it('can pick up from a given offset', async () => {
      expect.assertions(3)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      const r1 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Parent Page', body: 'This is the parent.', msg: 'Initial text' })
      const r2 = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Child Page', body: 'This is the child. [[Tag1:Hello]] [[Tag2:World]]', parent: r1.body.id, msg: 'Initial text' })
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Second Page', body: 'This is another page. [[Type:Test]]', parent: r1.body.id, permissions: 700, msg: 'Initial text' })
      const actual = await request.get('/pages?path=%2Fparent-page&offset=1')
      expect(actual.status).toEqual(200)
      expect(actual.body).toHaveLength(1)
      expect(actual.body.map(p => p.id)).toEqual([ r1.body.id ])
    })
  })

  describe('POST /pages/*/rollback/:id', () => {
    it('rolls back a page', async () => {
      expect.assertions(4)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'Test Page', body: 'This is an update.', msg: 'Testing update' }
      await request.post('/pages/test-page').set('Authorization', `Bearer ${token}`).send(data)
      const res = await request.post('/pages/test-page/rollback/1').set('Authorization', `Bearer ${token}`)
      const actual = res && res.body && Array.isArray(res.body.history) && res.body.history[0].content && res.body.history[0].content.body
        ? res.body.history[res.body.history.length - 1].content.body
        : false

      expect(res.status).toEqual(200)
      expect(actual).not.toEqual(false)
      expect(res.body.history).toHaveLength(3)
      expect(actual).toEqual('This is a test page.')
    })
  })

  describe('POST /pages/*', () => {
    it('updates a page', async () => {
      expect.assertions(9)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'Test Page', body: 'This is an update.', msg: 'Testing update' }
      const res = await request.post('/pages/test-page').set('Authorization', `Bearer ${token}`).send(data)
      const check = await Page.get(res.body.id, db)
      const actual = res && res.body && Array.isArray(res.body.history) && res.body.history[0].content && res.body.history[0].content.body
        ? res.body.history[res.body.history.length - 1].content.body
        : false

      expect(res.status).toEqual(200)
      expect(actual).not.toEqual(false)
      expect(res.body.path).toEqual('/test-page')
      expect(res.body.title).toEqual('Test Page')
      expect(res.body.history).toHaveLength(2)
      expect(actual).toEqual(data.body)
      expect(check).toBeInstanceOf(Page)
      expect(check.history.getBody()).toEqual(data.body)
      expect(check.title).toEqual(res.body.title)
    })

    it('returns 401 if you don\'t have permission', async () => {
      expect.assertions(4)
      const normal = await Member.load(2, db)
      const other = await Member.load(3, db)
      await request.post('/pages/test-page').set('Authorization', `Bearer ${normal.generateJWT()}`).send({ title: 'Test PAge', body: 'This is a test page.', msg: 'Locking out other editors', permissions: 700 })
      const update = { title: 'Test Page', body: 'This is an update.', msg: 'Locking out other editors' }
      const res = await request.post('/pages/test-page').set('Authorization', `Bearer ${other.generateJWT()}`).send(update)
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
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'Image', body: 'This is an image.', msg: 'Initial text', files: { file: testUtils.mockGIF() } }
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
      data.files = { file: testUtils.mockJPEG() }
      const after = await request.post('/pages/image').set('Authorization', `Bearer ${token}`).send(data)

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
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'Image', body: 'This is an image.', msg: 'Initial text', files: { file: testUtils.mockGIF(), thumbnail: testUtils.mockJPEG() } }
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send(data)
      data.files = { file: testUtils.mockJPEG(), thumbnail: testUtils.mockGIF() }
      const after = await request.post('/pages/image').set('Authorization', `Bearer ${token}`).send(data)

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

    it('returns 400 if you try to update the page\'s path to one some other page is already using', async () => {
      expect.assertions(3)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'New Page', body: 'This is a new page.' })
      const res = await request.post('/pages/test-page').set('Authorization', `Bearer ${token}`).send({ title: 'Test Page', body: 'This is an update.', path: '/new-page' })
      const check = await db.run('SELECT id FROM pages;')

      expect(res.status).toEqual(400)
      expect(res.body.error).toEqual('Sorry, that won&rsquo;t work. A page with the path <code>/new-page</code> already exists.')
      expect(check).toHaveLength(2)
    })

    it('returns 400 if you try to update the page\'s path to end with a numerical element', async () => {
      expect.assertions(2)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'New Page', body: 'This is a new page.' })
      const res = await request.post('/pages/test-page').set('Authorization', `Bearer ${token}`).send({ title: 'Test Page', body: 'This is an update.', path: '/07' })

      expect(res.status).toEqual(400)
      expect(res.body.error).toEqual('Please don’t end a path with a number. That makes it difficult for the system to tell the difference between pages and versions of pages.')
    })
  })

  describe('GET /pages/*', () => {
    it('returns 200', async () => {
      expect.assertions(8)
      const res = await request.get('/pages/test-page')
      const { page, markup } = res.body
      expect(res.status).toEqual(200)
      expect(page.path).toEqual('/test-page')
      expect(page.title).toEqual('Test Page')
      expect(page.history).toHaveLength(1)
      expect(page.permissions.read).toEqual(true)
      expect(page.permissions.write).toEqual(false)
      expect(page.permissions.code).toEqual(774)
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

    it('can return markup for a specific version', async () => {
      expect.assertions(2)
      const editor = await Member.load(2, db)
      const page = await Page.get('/test-page', db)
      await page.update({ body: 'This is an update.' }, editor, 'Test update #1', db)
      await page.update({ body: 'This is a second update.' }, editor, 'Test update #2', db)
      const vids = page.history.changes.map(change => change.id)
      const res = await request.get(`/pages/test-page?version=${vids[1]}`)
      expect(vids).toHaveLength(3)
      expect(res.body.markup).toEqual('<p>This is an update.</p>\n')
    })

    it('returns URLs and readable sizes for files', async () => {
      expect.assertions(4)
      const member = await Member.load('normal@thefifthworld.com', db)
      const token = member.generateJWT()
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Test File', body: 'This is a file.', files: { file: testUtils.mockTXT() }, msg: 'Initial text' })
      const res = await request.get('/pages/test-file')
      const page = await Page.get('/test-file', db)
      await FileHandler.remove(page.files[0].name, db)
      expect(res.status).toEqual(200)
      expect(res.body.page.files).toHaveLength(1)
      expect(res.body.page.files[0].urls.full.startsWith(`https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/uploads/test.`)).toEqual(true)
      expect(res.body.page.files[0].readableSize).toEqual('13 B')
    })
  })

  describe('GET /templates', () => {
    it('queries for template use', async () => {
      expect.assertions(8)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const data = { title: 'Test Page', body: 'This is an update. {{Test a="1" b="2"}} {{Test c="3"}}', msg: 'Testing template query' }
      await request.post('/pages/test-page').set('Authorization', `Bearer ${token}`).send(data)
      const res = await request.get('/templates?name=Test&parameter=a')
      await testUtils.resetTables(db)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].path).toEqual('/test-page')
      expect(res.body[0].title).toEqual('Test Page')
      expect(res.body[0].templates).toHaveLength(2)
      expect(res.body[0].templates[0].template).toEqual('Test')
      expect(res.body[0].templates[0].a).toEqual('1')
      expect(res.body[0].templates[0].b).toEqual('2')
      expect(res.body[0].templates[0].c).not.toBeDefined()
    })

    it('doesn\'t return pages that don\'t use the template', async () => {
      expect.assertions(2)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const d1 = { title: 'Test Page', body: 'This is a page.', msg: 'Testing template query' }
      const d2 = { title: 'Test Page with Template', body: 'This is a page. {{Test}}', msg: 'Testing template query' }
      await request.post('/pages/test-page').set('Authorization', `Bearer ${token}`).send(d1)
      await request.post('/pages/test-page').set('Authorization', `Bearer ${token}`).send(d2)
      const res = await request.get('/templates?name=Test')
      await testUtils.resetTables(db)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].title).toEqual(d2.title)
    })
  })

  describe('POST /autocomplete', () => {
    it('returns pages that match fragment', async () => {
      expect.assertions(6)
      const res = await request.post('/autocomplete').send({ fragment: 'Test' })
      expect(res.body.found).toEqual(1)
      expect(res.body.pages).toHaveLength(1)
      expect(res.body.pages[0].id).toBeDefined()
      expect(typeof res.body.pages[0].id).toEqual('number')
      expect(res.body.pages[0].path).toEqual('/test-page')
      expect(res.body.pages[0].title).toEqual('Test Page')
    })

    it('can match a path query', async () => {
      expect.assertions(6)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'Child Page', parent: '/test-page', body: 'This is a child page.' }, editor, 'Initial text', db)
      const res = await request.post('/autocomplete').send({ path: '/test' })
      expect(res.body.found).toEqual(2)
      expect(res.body.pages).toHaveLength(2)
      expect(res.body.pages[0].id).toBeDefined()
      expect(typeof res.body.pages[0].id).toEqual('number')
      expect(res.body.pages[0].path).toEqual('/test-page/child-page')
      expect(res.body.pages[0].title).toEqual('Child Page')
    })

    it('can limit query by type', async () => {
      expect.assertions(6)
      const editor = await Member.load(2, db)
      await Page.create({ title: 'Child Page', parent: '/test-page', body: 'This is a child page.', type: 'Test' }, editor, 'Initial text', db)
      const res = await request.post('/autocomplete').send({ path: '/test', type: 'Test' })
      expect(res.body.found).toEqual(1)
      expect(res.body.pages).toHaveLength(1)
      expect(res.body.pages[0].id).toBeDefined()
      expect(typeof res.body.pages[0].id).toEqual('number')
      expect(res.body.pages[0].path).toEqual('/test-page/child-page')
      expect(res.body.pages[0].title).toEqual('Child Page')
    })

    it('doesn\'t return more than five', async () => {
      expect.assertions(2)
      const editor = await Member.load(2, db)
      for (let i = 2; i < 8; i++) await Page.create({ title: `Test ${i}`, body: 'This is a test' }, editor, 'Initial text', db)
      const res = await request.post('/autocomplete').send({ fragment: 'Test' })
      expect(res.body.found).toEqual(5)
      expect(res.body.pages).toHaveLength(5)
    })
  })

  describe('GET /near/:lat/:lon/:dist*?', () => {
    it('returns places near a point', async () => {
      expect.assertions(10)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      const point = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'The Point', body: '[[Location:40.441800, -80.012772]]', msg: 'Initial text' })
      const myland = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Three Myland', body: '[[Location:40.154507, -76.724877]]', msg: 'Initial text' })
      const tower = await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'The Steel Tower', body: '[[Location:40.441399, -79.994673]]', permissions: 700, msg: 'Initial text' })
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

  describe('GET /updates', () => {
    it('returns an array of updates', async () => {
      expect.assertions(6)
      const res = await request.get('/updates')
      expect(res.status).toEqual(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].title).toEqual('Test Page')
      expect(res.body[0].path).toEqual('/test-page')
      expect(res.body[0].timestamp).not.toBeNaN()
      expect(res.body[0].editor).toEqual({ id: 2, name: 'Normal' })
    })
  })

  describe('GET /updates/:num', () => {
    it('returns an array of updates maximum the number provided', async () => {
      expect.assertions(6)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Test', body: 'This is a test.', msg: 'Initial text' })
      const res = await request.get('/updates/1')
      expect(res.status).toEqual(200)
      expect(res.body).toHaveLength(1)
      expect(res.body[0].title).toEqual('Test')
      expect(res.body[0].path).toEqual('/test')
      expect(res.body[0].timestamp).not.toBeNaN()
      expect(res.body[0].editor).toEqual({ id: 2, name: 'Normal' })
    })

    it('returns no more than 50 updates', async () => {
      expect.assertions(6)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      for (let i = 1; i <= 60; i++) await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: `Test Page #${i}`, body: 'This is a test.', msg: 'Initial text' })
      const res = await request.get('/updates/100')

      expect(res.status).toEqual(200)
      expect(res.body).toHaveLength(50)
      expect(res.body[0].title).toEqual('Test Page #60')
      expect(res.body[0].path).toEqual('/test-page-60')
      expect(res.body[0].timestamp).not.toBeNaN()
      expect(res.body[0].editor).toEqual({ id: 2, name: 'Normal' })
    })

    it('returns 10 updates if not given a valid number', async () => {
      expect.assertions(6)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      for (let i = 1; i <= 20; i++) await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: `Test Page #${i}`, body: 'This is a test.', msg: 'Initial text' })
      const res = await request.get('/updates/lulz')

      expect(res.status).toEqual(200)
      expect(res.body).toHaveLength(10)
      expect(res.body[0].title).toEqual('Test Page #20')
      expect(res.body[0].path).toEqual('/test-page-20')
      expect(res.body[0].timestamp).not.toBeNaN()
      expect(res.body[0].editor).toEqual({ id: 2, name: 'Normal' })
    })
  })

  describe('GET /requested', () => {
    it('returns requested links', async () => {
      expect.assertions(5)
      const member = await Member.load(2, db)
      const token = member.generateJWT()
      await request.post('/pages').set('Authorization', `Bearer ${token}`).send({ title: 'Test', body: '[[Link One]] [[Link Two]] [[Link Three]]', msg: 'Initial text' })
      const res = await request.get('/requested')
      const titles = res.body.map(l => l.title)

      expect(res.status).toEqual(200)
      expect(res.body).toHaveLength(3)
      expect(titles).toContain('Link One')
      expect(titles).toContain('Link Two')
      expect(titles).toContain('Link Three')
    })
  })

  describe('GET /checkpath/*', () => {
    it('tells you that you can\'t use a reserved path', async () => {
      expect.assertions(2)
      const { body } = await request.get('/checkpath/welcome')
      expect(body.ok).toEqual(false)
      expect(body.error).toEqual('We reserve <code>/welcome</code> for internal use.')
    })

    it('tells you that you can\'t use a path that ends in a number', async () => {
      expect.assertions(2)
      const { body } = await request.get('/checkpath/path/to/test/01')
      expect(body.ok).toEqual(false)
      expect(body.error).toEqual('Please don’t end a path with a number. That makes it difficult for the system to tell the difference between pages and versions of pages.')
    })

    it('tells you that you can\'t use a URL that\'s already in use', async () => {
      expect.assertions(2)
      const { body } = await request.get('/checkpath/test-page')
      expect(body.ok).toEqual(false)
      expect(body.error).toEqual('A page with the path <code>/test-page</code> already exists.')
    })

    it('tells you that you can create a new page', async () => {
      expect.assertions(2)
      const { body } = await request.get('/checkpath/new-page')
      expect(body.ok).toEqual(true)
      expect(body.error).not.toBeDefined()
    })

    it('tells you that you can create a new page with an existing name if it\'s in a new scope', async () => {
      expect.assertions(2)
      const { body } = await request.get('/checkpath/test-page/test-page')
      expect(body.ok).toEqual(true)
      expect(body.error).not.toBeDefined()
    })
  })

  describe('POST /response', () => {
    it('returns the response given', async () => {
      expect.assertions(3)
      const res = await request.post('/response').send({ form: 'Test', data: '{"test":true}' })
      await testUtils.resetTables(db)
      expect(res.status).toEqual(200)
      expect(res.body.name).toEqual('Test')
      expect(res.body.test).toEqual(true)
    })

    it('inserts a new record into the database', async () => {
      expect.assertions(1)
      await request.post('/response').send({ form: 'Test', data: '{"test":true}' })
      const check = await db.run('SELECT id FROM responses;')
      await testUtils.resetTables(db)
      expect(check).toHaveLength(1)
    })
  })
})
