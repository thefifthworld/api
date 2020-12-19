class TemplateHandler {
  constructor () {
    this.templates = {}
  }

  add (name, obj) {
    this.templates[name] = Object.assign({}, obj)
  }
}

module.exports = TemplateHandler
