/* global describe, it, expect, afterAll */

const LocationHandler = require('./locationHandler')

describe('LocationHandler', () => {
  describe('constructor', () => {
    it('sets lat and lon', () => {
      const actual = new LocationHandler(40.441823, -80.012778)
      expect(actual.lat).toBeCloseTo(40.441823, 3)
      expect(actual.lon).toBeCloseTo(-80.012778, 3)
    })

    it('defaults to null', () => {
      const actual = new LocationHandler()
      expect(actual.lat).toEqual(null)
      expect(actual.lon).toEqual(null)
    })
  })

  describe('convertLat', () => {
    it('will keep a decimal format latitude', () => {
      const lat = 40.441810
      const handler = new LocationHandler()
      handler.setLat(lat)
      expect(handler.lat).toBeCloseTo(lat, 3)
    })

    it('will turn a string into a decimal value', () => {
      const lat = '40.441810'
      const handler = new LocationHandler()
      handler.setLat(lat)
      expect(handler.lat).toBeCloseTo(40.441810, 3)
    })

    it('will turn a latitude in degrees, minutes, and seconds into a decimal value', () => {
      const lat = '40°26\'30.5"N'
      const handler = new LocationHandler()
      handler.setLat(lat)
      expect(handler.lat).toBeCloseTo(40.441794, 3)
    })

    it('works with ticks', () => {
      const lat = '40`26\'30.5"N'
      const handler = new LocationHandler()
      handler.setLat(lat)
      expect(handler.lat).toBeCloseTo(40.441794, 3)
    })

    it('works with just degrees and minutes', () => {
      const lat = '40°26\'N'
      const handler = new LocationHandler()
      handler.setLat(lat)
      expect(handler.lat).toBeCloseTo(40.4333, 3)
    })

    it('works with just degrees', () => {
      const lat = '40°N'
      const handler = new LocationHandler()
      handler.setLat(lat)
      expect(handler.lat).toBeCloseTo(40, 3)
    })
  })

  describe('convertLon', () => {
    it('will keep a decimal format latitude', () => {
      const lon = -80.012770
      const handler = new LocationHandler()
      handler.setLon(lon)
      expect(handler.lon).toBeCloseTo(lon, 3)
    })

    it('will turn a string into a decimal value', () => {
      const lon = '-80.012770'
      const handler = new LocationHandler()
      handler.setLon(lon)
      expect(handler.lon).toBeCloseTo(-80.012770, 3)
    })

    it('will turn a latitude in degrees, minutes, and seconds into a decimal value', () => {
      const lon = '80°00\'46.0"W'
      const handler = new LocationHandler()
      handler.setLon(lon)
      expect(handler.lon).toBeCloseTo(-80.012770, 3)
    })

    it('works with ticks', () => {
      const lon = '80`00\'46.0"W'
      const handler = new LocationHandler()
      handler.setLon(lon)
      expect(handler.lon).toBeCloseTo(-80.012770, 3)
    })

    it('works with just degrees and minutes', () => {
      const lon = '80°00\'W'
      const handler = new LocationHandler()
      handler.setLon(lon)
      expect(handler.lon).toBeCloseTo(-80.000, 3)
    })

    it('works with just degrees', () => {
      const lon = '80°W'
      const handler = new LocationHandler()
      handler.setLon(lon)
      expect(handler.lon).toBeCloseTo(-80.000, 3)
    })
  })
})
