class TagHandler {
  constructor () {
    this.tags = {}
  }

  /**
   * Add a tag.
   * @param tag {string} - The name of the tag to add.
   * @param val {string} - The value of the tag to add.
   */

  add (tag, val) {
    const key = tag.toLowerCase()
    if (this.tags[key]) {
      this.tags[key].push(val)
    } else {
      this.tags[key] = [ val ]
    }
  }
}

module.exports = TagHandler
