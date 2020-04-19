class FileHandler {
  constructor (file) {
    if (file) {
      const keys = ['name', 'data', 'size', 'encoding', 'mimetype', 'md5']
      keys.forEach(key => { if (file[key]) this[key] = file[key] })
    }
  }
}

module.exports = FileHandler
