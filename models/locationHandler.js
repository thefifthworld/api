const fs = require('fs')
const {
  circle,
  multiPolygon,
  polygon,
  booleanIntersects,
  booleanPointInPolygon
} = require('@turf/turf')

class LocationHandler {
  constructor (...args) {
    this.lat = null
    this.lon = null

    if (typeof args[0] === 'object') {
      this.setCoords(args[0])
    } else if (args.length > 1) {
      this.setLat(args[0])
      this.setLon(args[1])
    }
  }

  /**
   * Can take either a decimal, or a string representation of a decimal, or a
   * string representation of a latitude inn degrees, minutes, and seconds
   * format, and returns the decimal value for that latitude.
   * @param lat {!number|string} - A representation of a latitude.
   * @returns {number|boolean} - The decimal value for the latitude given, or
   *   `false` if it isn't a latitude.
   */

  setLat (lat) {
    this.lat = LocationHandler.convertLatLon(lat, 'lat')
  }

  /**
   * Can take either a decimal, or a string representation of a decimal, or a
   * string representation of a longitude inn degrees, minutes, and seconds
   * format, and returns the decimal value for that longitude.
   * @param lon {!number|string} - A representation of a longitude.
   * @returns {number|boolean} - The decimal value for the longitude given, or
   *   `false` if it isn't a longitude.
   */

  setLon (lon) {
    this.lon = LocationHandler.convertLatLon(lon, 'lon')
  }

  /**
   * Save latitude and longitude from coordinates to instance.
   * @param coords {{ lat: number|string, lon: number|string }|(number|string)[]} -
   *   `coords` can be an object with `lat` and `lon` properties, or it can be
   *   an array of two values, with the latitude first and the longitude
   *   second. Both latitude and longitude can be decimal values, strings
   *   representing decimal values, or string that transcribe latitude and
   *   longitude in degrees, minutes, and seconds.
   */

  setCoords (coords) {
    const isObj = Boolean(coords.lat) && Boolean(coords.lon)
    const isArray = Array.isArray(coords) && coords.length > 1
    const lat = isObj ? coords.lat : isArray ? coords[0] : null
    const lon = isObj ? coords.lon : isArray ? coords[1] : null
    if (lat !== false && lon !== false) {
      this.setLat(lat)
      this.setLon(lon)
    }
  }

  /**
   * This method returns `true` if the location will be in the ocean in the
   * Fifth World, after the ice caps have melted and the seas have risen by
   * 65m (216 ft).
   * @param {[Polygon|MultiPolygon]} oceans - An array of Polygon and
   *   MultiPolygon objects covering the areas that will be covered by ocean
   *   in the Fifth World. If left undefined, these will be loaded using the
   *   LocationHandler.loadSeaLevels method.
   * @returns {boolean} - A Promise that returns `true` if the point
   *   will be in the ocean in the Fifth World (following the melting of the
   *   ice caps and the resulting rise in sea levels of 65m/216 ft.), or
   *   `false` if it will still be on dry land even after that.
   */

  isOcean (oceans) {
    for (const ocean of oceans) {
      if (booleanPointInPolygon([this.lon, this.lat], ocean)) return true
    }
    return false
  }

  /**
   * This method returns `true` if the location will be within 30 miles of the
   * ocean in the Fifth World, after the ice caps have melted and the seas have
   * risen by 65m (216 ft).
   * @param {[Polygon|MultiPolygon]} oceans - An array of Polygon and
   *   MultiPolygon objects covering the areas that will be covered by ocean
   *   in the Fifth World.
   * @returns {boolean} - `true` if the point will be within 30 miles of the
   *   ocean in the Fifth World (following the melting of the ice caps and the
   *   resulting rise in sea levels of 65m/216 ft.), or `false` if it will
   *   still be more than 30 miles from the nearest
   */

  isCoastal (oceans) {
    if (this.isOcean(oceans)) return false
    const area = circle([this.lon, this.lat], 30, { steps: 10, units: 'miles' })
    for (const ocean of oceans) {
      if (booleanIntersects(area, ocean)) return true
    }
    return false
  }

  /**
   * Save the location to the database.
   * @param id {!number} - The primary key of the page to associate this
   *   location with.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves once all places
   *   previously associated with this page have been deleted from the database
   *   and the new location saved.
   */

  async save (id, db) {
    const { lat, lon } = this
    if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
      await db.run(`DELETE FROM places WHERE page=${escape(id)};`)
      const geom = `ST_GeomFromText('POINT(${lat} ${lon})', 4326)`
      await db.run(`INSERT INTO places (page, location) VALUES (${id}, ${geom});`)
    }
  }

  /**
   * Load a location from the database.
   * @param id {!number} - The primary key of the page that we're loading a
   *   location for.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<boolean|LocationHandler>} - A Promise that resolves
   *   either with a LocationHandler object loaded with the latitude and
   *   longitude coordinates from the database, or `false` if something went
   *   wrong.
   */

  static async load (id, db) {
    const rows = await db.run(`SELECT ST_X(location) AS lat, ST_Y(location) AS lon FROM places WHERE page=${id};`)
    if (rows && Array.isArray(rows) && rows.length > 0) {
      return new LocationHandler(rows[0])
    } else {
      return false
    }
  }

  /**
   * Converting latitude and longitude have a lot in common, so here's a common
   * function to reduce repeated code.
   * @param str {!number|string} - A latitude or longitude, represented either as
   *   a number, a string of a number, or a string with degrees, minutes, and
   *   seconds.
   * @param dir {string=} - A string telling the function whether to read the
   *   string as latitude (`lat`) or longitude (`lon`). Defaults to `lon`.
   * @returns {boolean|number} - If the string can be parsed into a valid value,
   *   that value is returned. If not, returns `false`.
   */

  static convertLatLon (str, dir = 'lon') {
    let val = str
    const min = dir === 'lat' ? -90 : -180
    const max = dir === 'lat' ? 90 : 180
    const regex = dir === 'lat'
      ? /(\d+)[°|`](\s?(\d+)\'(\s?(\d+)\")?(\s?(\d+)\.(\d+)")?)?[N|S]/
      : /(\d+)[°|`](\s?(\d+)\'(\s?(\d+)\")?(\s?(\d+)\.(\d+)")?)?[E|W]/
    const check = dir === 'lat' ? 'S' : 'W'

    if ((typeof val === 'number') && ((val > max) || (val < min))) {
      val = false
    } else if (typeof val === 'string') {
      let parse = val.match(regex)
      if (parse) {
        let degrees = parse.length > 1 ? parseInt(parse[1]) : 0
        let minutes = parse.length > 3 ? parseInt(parse[3]) : 0
        let seconds = parse.length > 7 ? parse[7] : 0
        if (seconds && parse.length > 8) seconds += '.' + parse[8]
        seconds = parseFloat(seconds)

        if (seconds) minutes += seconds / 60
        if (minutes) degrees += minutes / 60
        if (parse[0].indexOf(check) > -1) degrees = degrees * -1
        val = degrees
      } else {
        parse = parseFloat(val)
        return isNaN(parse) ? false : parse
      }
    }
    return val
  }

  /**
   * Load our sea level data from GeoJSON files into an array of Turf.js
   * Polygon and MultiPolygon objects.
   * @returns {Promise<[Polygon, MultiPolygon]>} - A Promise that resolves with
   *   an array of Turf.js Polygon and MultiPolygon objects covering the oceans
   *   after a sea level rise of 65m (216'), as we would expect if the ice caps
   *   were to completely melt.
   */

  static async loadSeaLevels () {
    // Load all GeoJSON files and parse them
    const bases = ['antarctica', 'greenland']
    for (let i = 1; i < 55; i++) bases.push(i.toString().padStart(2, '0'))
    const files = bases.map(base => `./data/sealevel/${base}.geojson`)
    const contents = []
    for (const file of files) {
      const content = await fs.promises.readFile(file, 'utf8')
      contents.push(content)
    }
    const geojsons = contents.map(content => JSON.parse(content))

    // Create polygons from GeoJSON data
    let polygons = []
    for (const geojson of geojsons) {
      const types = ['Polygon', 'MultiPolygon']
      const objects = geojson.features.filter(feat => feat.geometry && types.includes(feat.geometry.type))
      const poly = objects.map(obj => {
        const fn = obj.geometry.type === 'MultiPolygon' ? multiPolygon : polygon
        return fn(obj.geometry.coordinates, obj.properties)
      })
      polygons = [...polygons, ...poly]
    }
    return polygons
  }
}

module.exports = LocationHandler
