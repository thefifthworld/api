class LikesHandler {
  constructor (page, ids) {
    const givenPage = page && page.constructor && page.constructor.name === 'Page'
    this.id = givenPage && !isNaN(page.id) ? page.id : null
    this.path = givenPage && page.path ? page.path : null
    this.ids = Array.isArray(ids) && ids.length > 0 ? ids : []
  }
}

module.exports = LikesHandler
