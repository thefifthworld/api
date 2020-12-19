class TemplateHandler {
  constructor () {
    this.templates = {}
  }

  /**
   * Add a template object.
   * @param name {string} - The name of the template being used.
   * @param obj {object} - Key/value pairs for any parameters used by the
   *   template instance.
   */

  add (name, obj) {
    this.templates[name] = Object.assign({}, obj)
  }
}

module.exports = TemplateHandler
