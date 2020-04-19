const aws = require('aws-sdk')
const config = require('../config')

class FileHandler {
  constructor (file) {
    if (file) {
      const keys = ['name', 'data', 'size', 'encoding', 'mimetype', 'md5']
      keys.forEach(key => { if (file[key]) this[key] = file[key] })
    }
  }

  /**
   * Upload a file to an Amazon Web Services S3 Bucket specified in the
   * configuration file.
   * @param file {!{ name: string, data: Buffer, mimetype: string }} - The file
   *   to upload.
   * @returns {Promise<{}>} - A Promise that resolves with the response from
   *   Amazon Web Services.
   */

  static async upload (file) {
    const { name, data, mimetype, size } = file
    if (name && data && mimetype && size) {
      const Key = FileHandler.createKey(name)
      if (Key !== false) {
        const s3 = new aws.S3({accessKeyId: config.aws.key, secretAccessKey: config.aws.secret})
        const params = {ACL: 'public-read', Bucket: config.aws.bucket, Key, Body: data, ContentType: mimetype}
        const res = await s3.upload(params).promise()
        return res
      }
    }
  }

  /**
   * Return a suitable key for Amazon Web Services S3 storage.
   * @param name {string} - The original filename.
   * @return {string|false} - A string that can be used for the file to
   *   uniquely identify it in Amazon Web Services S3 storage, or `false` if
   *   something went wrong.
   */

  static createKey (name) {
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
      return `uploads/${base}.${day}.${time}.${ext}`
    } else {
      return false
    }
  }
}

module.exports = FileHandler
