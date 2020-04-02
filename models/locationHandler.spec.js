/* global describe, it, expect, afterAll */

const LocationHandler = require('./locationHandler')

describe('LocationHandler', () => {
  describe('constructor', () => {
    it('sets lat and lon', () => {
      const actual = new LocationHandler(40.441823, -80.012778)
      expect(actual.lat).toBeCloseTo(40.441823)
      expect(actual.lon).toBeCloseTo(-80.012778)
    })

    it('defaults to null', () => {
      const actual = new LocationHandler()
      expect(actual.lat).toEqual(null)
      expect(actual.lon).toEqual(null)
    })
  })
})
