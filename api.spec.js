/* global describe, it, expect, afterAll */

const request = require('supertest')
const db = require('./db')
const api = require('./api')

describe('API', () => {
  describe('GET /', () => {
    it('should return 200', async () => {
      const res = await request(api).get('/')
      expect(res.status).toEqual(200)
    })

    it('should provide the number of pages', async () => {
      const res = await request(api).get('/')
      expect(res.body.pages).not.toBeNaN()
    })
  })
})

afterAll(() => {
  db.end()
})
