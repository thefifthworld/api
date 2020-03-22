/* global describe, it, expect, afterAll */

const db = require('./db')
const testUtils = require('./test-utils')

describe('Database', () => {
  describe('run', () => {
    it('can execute a query', async () => {
      expect.assertions(1)
      const rows = await db.run('SELECT 1 + 1 AS solution')
      expect(rows[0].solution).toBe(2)
    })
  })

  describe('update', () => {
    it('updates the database', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const fields = [{ name: 'bio', type: 'string' }]
      const updates = { bio: 'This is my updated bio.' }
      await db.update(fields, updates, 'members', 1)
      const check = await db.run('SELECT bio FROM members WHERE id=1;')
      await testUtils.resetTables(db, 'members')
      expect(check[0].bio).toEqual(updates.bio)
    })

    it('escapes input', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const fields = [{ name: 'bio', type: 'string' }]
      const updates = { bio: 'This is my updated bio and it\'s "tricky content."' }
      await db.update(fields, updates, 'members', 1)
      const check = await db.run('SELECT bio FROM members WHERE id=1;')
      await testUtils.resetTables(db, 'members')
      expect(check[0].bio).toEqual(updates.bio)
    })

    it('sets empty strings to null', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const fields = [{ name: 'bio', type: 'string' }]
      const updates = { bio: '' }
      await db.update(fields, updates, 'members', 1)
      const check = await db.run('SELECT bio FROM members WHERE id=1;')
      await testUtils.resetTables(db, 'members')
      expect(check[0].bio).toEqual(null)
    })

    it('handles null values', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const fields = [{ name: 'bio', type: 'string' }]
      const updates = { bio: null }
      await db.update(fields, updates, 'members', 1)
      const check = await db.run('SELECT bio FROM members WHERE id=1;')
      await testUtils.resetTables(db, 'members')
      expect(check[0].bio).toEqual(null)
    })
  })
})

afterAll(() => {
  db.end()
})
