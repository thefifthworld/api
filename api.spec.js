/* global describe, it, expect, beforeAll, beforeEach, afterAll */

const supertest = require('supertest')
const api = require('./api')

describe('API', () => {
  let server = {}
  let request = {}

  beforeAll(async () => { server = await api.listen(8888) })
  beforeEach(() => { request = supertest(server) })
  afterAll(() => {
    server.close(() => {
      api.closeDB(() => {
        api.close()
      })
    })
  })

  describe('GET /', () => {
    it('returns 200', async () => {
      expect.assertions(1)
      const res = await request.get('/')
      expect(res.status).toEqual(200)
    })

    it('returns the number of pages', async () => {
      expect.assertions(1)
      const res = await request.get('/')
      expect(res.body.pages).not.toBeNaN()
    })
  })
})
