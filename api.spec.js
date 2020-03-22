/* global describe, it, expect, afterAll */

const supertest = require('supertest')
const api = require('./api')
const request = supertest(api)

describe('API', () => {
  afterAll(() => {
    api.close()
    request.close()
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
