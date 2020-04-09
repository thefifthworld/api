class History {
  constructor (changes = []) {
    this.changes = changes.map(change => ({
      id: change.id,
      timestamp: new Date(change.timestamp * 1000),
      msg: change.msg,
      content: JSON.parse(change.json),
      editor: {
        name: change.editorName ? change.editorName : change.editorEmail ? change.editorEmail : `Member #${change.editorID}`,
        id: change.editorID
      }
    }))
    this.changes.reverse()
  }
}

module.exports = History
