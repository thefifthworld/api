const aws = require('aws-sdk')
const md5 = require('md5')
const thumbnailer = require('image-thumbnail')
const config = require('../config')

class FileHandler {
  constructor (obj) {
    if (obj) {
      const keys = ['name', 'thumbnail', 'mime', 'size', 'page', 'timestamp', 'uploader']
      keys.forEach(key => { if (obj[key]) this[key] = obj[key] })
      if (obj.mimetype) this.mime = obj.mimetype
    }
  }

  /**
   * Handles file uploads.
   * @param files {{}} - An object containing uploaded files.
   * @returns {Promise<FileHandler>} - A Promise that resolves with a new
   *   FileHandler instance for the uploaded files.
   */

  static async handle (files) {
    if (files.file && files.file.mimetype && files.file.size) {
      const { size } = files.file
      const mime = files.file.mimetype
      const now = new Date()
      const timestamp = now.getTime() / 1000
      let name, thumbnail

      if (mime.startsWith('image/')) {
        const keys = await FileHandler.handleArt(files.file, files.thumbnail)
        name = keys.file
        thumbnail = keys.thumbnail
      } else {
        const res = await FileHandler.upload(files.file)
        name = res.key
      }

      if (name) return new FileHandler({ name, thumbnail, mime, size, timestamp })
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
      const b = await FileHandler.upload(thumb, true)
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
   * @param isThumbnail {?boolean} - Optional. If `true`, `thumb` is added to
   *   the key to indicate that this is a thumbnail (Default: `false`).
   * @returns {Promise<{}>} - A Promise that resolves with the response from
   *   Amazon Web Services.
   */

  static async upload (file, isThumbnail = false) {
    const { name, data, mimetype, size } = file
    if (name && data && mimetype && size) {
      const Key = FileHandler.createKey(name, isThumbnail)
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
   * @returns {Promise<void>} - A Promise that resolves once the object has
   *   been deleted.
   */

  static async remove (key) {
    if (key) {
      const s3 = FileHandler.instantiateS3()
      const params = {Bucket: config.aws.bucket, Key: key}
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
    return new aws.S3({ accessKeyId: config.aws.key, secretAccessKey: config.aws.secret })
  }

  /**
   * Return a suitable key for Amazon Web Services S3 storage.
   * @param name {!string} - The original filename.
   * @param isThumbnail {?boolean} - Optional. If `true`, `thumb` is added to
   *   the key to indicate that this is a thumbnail (Default: `false`).
   * @return {string|false} - A string that can be used for the file to
   *   uniquely identify it in Amazon Web Services S3 storage, or `false` if
   *   something went wrong.
   */

  static createKey (name, isThumbnail = false) {
    const split = name.split('.')
    const base = split.slice(0, split.length - 1).join('.')
    const ext = split[split.length - 1]
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
      return isThumbnail
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
    return `https://${config.aws.bucket}.s3.amazonaws.com/${key}`
  }
}

module.exports = FileHandler
