const aws = require('aws-sdk')
const md5 = require('md5')
const thumbnailer = require('image-thumbnail')
const { escape } = require('sqlstring')
const config = require('../config')

class FileHandler {
  constructor (obj) {
    if (obj) {
      const keys = ['name', 'thumbnail', 'mime', 'size', 'page', 'timestamp', 'uploader']
      keys.forEach(key => { if (obj[key] !== undefined) this[key] = obj[key] })
      if (obj.mimetype) this.mime = obj.mimetype
    }
    this.packageURLs()
    if (this.size) this.readableSize = FileHandler.getFileSizeStr(this.size)
    this.saved = false
  }

  /**
   * If the fileHandler instance includes `name` and/or `thumbnail` properties,
   * render the URL for these using `getURL` and save them in a new `url`
   * property.
   */

  packageURLs () {
    if (this.name || this.thumbnail) {
      this.urls = {}
      if (this.name) this.urls.full = FileHandler.getURL(this.name)
      if (this.thumbnail) this.urls.thumbnail = FileHandler.getURL(this.thumbnail)
    }
  }

  /**
   * Save a file record.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves when the file record
   *   has been saved to the database.
   */

  async save (db) {
    if (!this.timestamp) { const now = new Date(); this.timestamp = Math.ceil(now.getTime() / 1000) }
    return db.run(`INSERT INTO files (name, thumbnail, mime, size, page, timestamp, uploader) VALUES (${escape(this.name)}, ${escape(this.thumbnail)}, ${escape(this.mime)}, ${this.size}, ${this.page}, ${this.timestamp}, ${this.uploader});`)
  }

  /**
   * Load files associated with a page.
   * @param page {!Page} - A page that may have a file.
   * @param db {!Pool} - The database connection.
   * @returns {Promise<FileHandler[]>} - An array of FileHandler objects,
   *   representing various versions of the file associated with the page.
   */

  static async load (page, db) {
    if (page && page.id && !isNaN(page.id)) {
      const rows = await db.run(`SELECT * FROM files WHERE page=${page.id} ORDER BY timestamp DESC, id DESC;`)
      if (rows && rows.length > 0) {
        return rows.map(row => new FileHandler(row))
      }
    }
    return []
  }

  /**
   * Handles file uploads.
   * @param files {{}} - An object containing uploaded files.
   * @param page {?Page} - The page object that the files are associated with.
   * @param uploader {?Member} - The member uploading the files.
   * @returns {Promise<FileHandler>} - A Promise that resolves with a new
   *   FileHandler instance for the uploaded files.
   */

  static async handle (files, page, uploader) {
    if (files.file && files.file.mimetype && files.file.size) {
      if (files.file.data && !Buffer.isBuffer(files.file.data)) files.file.data = Buffer.from(files.file.data)
      if (files.thumbnail && files.thumbnail.data && !Buffer.isBuffer(files.thumbnail.data)) files.thumbnail.data = Buffer.from(files.thumbnail.data)
      const { size } = files.file
      const mime = files.file.mimetype
      const now = new Date()
      const timestamp = Math.ceil(now.getTime() / 1000)
      let name, thumbnail

      if (mime.startsWith('image/')) {
        const keys = await FileHandler.handleArt(files.file, files.thumbnail)
        name = keys.file
        thumbnail = keys.thumbnail
      } else {
        const res = await FileHandler.upload(files.file)
        name = res.Key
      }

      const obj = { name, thumbnail, mime, size, timestamp }
      if (page && page.id && !isNaN(page.id)) obj.page = page.id
      if (uploader && uploader.id && !isNaN(uploader.id)) obj.uploader = uploader.id
      if (name) return new FileHandler(obj)
    }
  }

  /**
   * Handles uploading art.
   * @param art {!{ name: string, data: Buffer, mimetype: string }} - The image
   *   to upload.
   * @param thumbnail {?{ name: string, data: Buffer, mimetype: string }} - A
   *   thumbnail for the image to upload. If left undefined, a thumbnail is
   *   created from the image.
   * @returns {Promise<{thumbnail: string, file: string}>} - A Promise that
   *   resolves with an object providing the location of the uploaded image
   *   (`file`) and its thumbnail (`thumbnail`).
   */

  static async handleArt (art, thumbnail) {
    try {
      const thumb = thumbnail || await FileHandler.createThumbnail(art)
      const a = await FileHandler.upload(art)
      const b = await FileHandler.upload(thumb, art.name)
      return { file: a.key, thumbnail: b.key }
    } catch (err) {
      console.error(err)
    }
  }

  /**
   * Upload a file to an Amazon Web Services S3 Bucket specified in the
   * configuration file.
   * @param file {!{ name: string, data: Buffer, mimetype: string }} - The file
   *   to upload.
   * @param isThumbnailOf {?string} - Optional. The name of the file that this
   *   is a thumbnail for.
   * @returns {Promise<{}>} - A Promise that resolves with the response from
   *   Amazon Web Services.
   */

  static async upload (file, isThumbnailOf) {
    const { name, data, mimetype, size } = file
    if (name && data && mimetype && size) {
      const Key = FileHandler.createKey(name, mimetype, isThumbnailOf)
      if (Key !== false) {
        const s3 = FileHandler.instantiateS3()
        const params = { ACL: 'public-read', Bucket: config.aws.bucket, Key, Body: data, ContentType: mimetype }
        const res = await s3.upload(params).promise()
        return res
      }
    }
  }

  /**
   * Delete an object from Amazon Web Services S3 storage.
   * @param key {string} - The key to the object to delete.
   * @param db {Pool} - The database connection.
   * @returns {Promise<void>} - A Promise that resolves once the object has
   *   been deleted.
   */

  static async remove (key, db) {
    if (key) {
      const row = await db.run(`SELECT thumbnail FROM files WHERE name=${escape(key)};`)
      const thumbnail = row && row.length > 0 ? row[0].thumbnail : null
      if (thumbnail) await FileHandler.remove(thumbnail, db)

      await db.run(`DELETE FROM files WHERE name=${escape(key)};`)
      const s3 = FileHandler.instantiateS3()
      const params = { Bucket: config.aws.bucket, Key: key }
      await s3.deleteObject(params).promise()
    }
  }

  /**
   * Create a thumbnail.
   * @param file {!{ name: string, data: Buffer, mimetype: string }} - The
   *   image that we're creating a thumbnail for.
   * @returns {Promise<{ name: string, data: Buffer, mimetype: string }>} - A
   *   Promise that resolves with the file object for the thumbnail.
   */

  static async createThumbnail (file) {
    try {
      const data = await thumbnailer(file.data, { height: 256, width: 256 })
      return Object.assign({}, file, {
        data,
        size: data.byteLength,
        md5: md5(data)
      })
    } catch (err) {
      console.error(err)
    }
  }

  /**
   * Instantiate an S3 object.
   * @returns {S3} - An S3 object.
   */

  static instantiateS3 () {
    return new aws.S3({
      endpoint: `https://s3.${config.aws.region}.stackpathstorage.com`,
      accessKeyId: config.aws.key,
      secretAccessKey: config.aws.secret
    })
  }

  /**
   * Return a suitable key for Amazon Web Services S3 storage.
   * @param name {!string} - The original filename.
   * @param mime {!string} - The file's MIME type string.
   * @param isThumbnailOf {?string} - Optional. The name of the file that this
   *   is a thumbnail of.
   * @return {string|false} - A string that can be used for the file to
   *   uniquely identify it in Amazon Web Services S3 storage, or `false` if
   *   something went wrong.
   */

  static createKey (name, mime, isThumbnailOf) {
    const orig = isThumbnailOf || name
    const split = orig.split('.')
    const base = split.slice(0, split.length - 1).join('.')
    let ext

    switch (mime) {
      case 'image/png': ext = 'png'; break
      case 'image/jpeg': ext = 'jpg'; break
      case 'image/gif': ext = 'gif'; break
      default: ext = split[split.length - 1]; break
    }

    if (base && base.length > 0 && ext && ext.length > 0) {
      const now = new Date()
      const day = [
        now.getFullYear(),
        (now.getMonth() + 1).toString().padStart(2, '0'),
        (now.getDate()).toString().padStart(2, '0')
      ].join('')
      const time = [
        (now.getHours()).toString().padStart(2, '0'),
        (now.getMinutes()).toString().padStart(2, '0'),
        (now.getSeconds()).toString().padStart(2, '0')
      ].join('')
      return isThumbnailOf && isThumbnailOf.length > 0
        ? `uploads/${base}.thumb.${day}.${time}.${ext}`
        : `uploads/${base}.${day}.${time}.${ext}`
    } else {
      return false
    }
  }

  /**
   * Return the URL for a particular key in Amazon Web Services S3 storage.
   * @param key {string} - A key to find the URL for.
   * @returns {string} - The URL for a given key.
   */

  static getURL (key) {
    return `https://${config.aws.bucket}.s3.${config.aws.region}.stackpathstorage.com/${key}`
  }

  /**
   * Returns a string expressing the size of a file.
   * @param bytes {int} - The size of the file in bytes.
   * @returns {string} - The size of the file expressed as a string (e.g.,
   *   3 MB or 72 kB).
   */

  static getFileSizeStr (bytes) {
    if (bytes < 1000) {
      return `${bytes} B`
    } else if (bytes < 1000000) {
      const kb = bytes / 1000
      return `${Math.round(kb * 10) / 10} kB`
    } else if (bytes < 1000000000) {
      const mb = bytes / 1000000
      return `${Math.round(mb * 10) / 10} MB`
    } else if (bytes) {
      const gb = bytes / 1000000000
      return `${Math.round(gb * 10) / 10} GB`
    } else {
      return '0 B'
    }
  }
}

module.exports = FileHandler
