/* global describe, it, expect */

const History = require('./history')

describe('History', () => {
  describe('constructor', () => {
    it('saves changes', () => {
      const changes = [
        { id: 1, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{}', editorName: 'Tester', editorID: 1 },
      ]
      const actual = new History(changes)
      expect(actual.changes[0].id).toEqual(changes[0].id)
      expect(actual.changes[0].timestamp).toEqual(new Date(changes[0].timestamp * 1000))
      expect(actual.changes[0].msg).toEqual(changes[0].msg)
      expect(actual.changes[0].content).toEqual(JSON.parse(changes[0].json))
      expect(actual.changes[0].editor.name).toEqual(changes[0].editorName)
      expect(actual.changes[0].editor.id).toEqual(changes[0].editorID)
    })

    it('reverses the order', () => {
      const changes = [
        { id: 1, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{}', editorName: 'Tester', editorID: 1 },
        { id: 2, timestamp: Math.round(Date.now() / 1000), msg: 'Test', json: '{}', editorName: 'Tester', editorID: 1 }
      ]
      const actual = new History(changes)
      expect(actual.changes[0].id).toEqual(changes[1].id)
      expect(actual.changes[1].id).toEqual(changes[0].id)
    })
  })
})
