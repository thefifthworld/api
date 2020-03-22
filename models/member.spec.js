/* global describe, it, expect, afterAll */

const bcrypt = require('bcrypt')
const db = require('../db')
const testUtils = require('../test-utils')

const Member = require('./member')

describe('Member', () => {
  describe('constructor', () => {
    it('doesn\'t set an ID if none is given', () => {
      const actual = new Member()
      expect(actual.id).toEqual(undefined)
    })

    it('sets an ID if one is given', () => {
      const id = 1
      const actual = new Member({ id })
      expect(actual.id).toEqual(id)
    })

    it('doesn\'t set a name if none is given', () => {
      const actual = new Member()
      expect(actual.name).toEqual(undefined)
    })

    it('sets a name if one is given', () => {
      const name = 'Tester'
      const actual = new Member({ name })
      expect(actual.name).toEqual(name)
    })

    it('doesn\'t set a password if none is given', () => {
      const actual = new Member()
      expect(actual.password).toEqual(undefined)
    })

    it('sets a password if one is given', () => {
      const password = 'password'
      const actual = new Member({ password })
      expect(actual.password).toEqual(password)
    })

    it('doesn\'t set an API key if none is given', () => {
      const actual = new Member()
      expect(actual.apikey).toEqual(undefined)
    })

    it('sets an API key if one is given', () => {
      const apikey = 'apikey123'
      const actual = new Member({ apikey })
      expect(actual.apikey).toEqual(apikey)
    })

    it('doesn\'t set an email if none is given', () => {
      const actual = new Member()
      expect(actual.email).toEqual(undefined)
    })

    it('sets an email if one is given', () => {
      const email = 'testing@thefifthworld.com'
      const actual = new Member({ email })
      expect(actual.email).toEqual(email)
    })

    it('doesn\'t set a bio if none is given', () => {
      const actual = new Member()
      expect(actual.bio).toEqual(undefined)
    })

    it('sets a bio if one is given', () => {
      const bio = 'I am the very model of a modern major general.'
      const actual = new Member({ bio })
      expect(actual.bio).toEqual(bio)
    })

    it('doesn\'t set a Facebook link if none is given', () => {
      const actual = new Member()
      expect(actual.links.facebook).toEqual(undefined)
    })

    it('sets a Facebook link if one is given', () => {
      const facebook = 'https://facebook.com/somebody'
      const actual = new Member({ facebook })
      expect(actual.links.facebook).toEqual(facebook)
    })

    it('doesn\'t set a Twitter link if none is given', () => {
      const actual = new Member()
      expect(actual.links.twitter).toEqual(undefined)
    })

    it('sets a Twitter link if one is given', () => {
      const twitter = 'https://twitter.com/somebody'
      const actual = new Member({ twitter })
      expect(actual.links.twitter).toEqual(twitter)
    })

    it('doesn\'t set a Github link if none is given', () => {
      const actual = new Member()
      expect(actual.links.github).toEqual(undefined)
    })

    it('sets a Github link if one is given', () => {
      const github = 'https://github.com/somebody'
      const actual = new Member({ github })
      expect(actual.links.github).toEqual(github)
    })

    it('doesn\'t set a Patreon link if none is given', () => {
      const actual = new Member()
      expect(actual.links.patreon).toEqual(undefined)
    })

    it('sets a Patreon link if one is given', () => {
      const patreon = 'https://patreon.com/somebody'
      const actual = new Member({ patreon })
      expect(actual.links.patreon).toEqual(patreon)
    })

    it('doesn\'t set a web link if none is given', () => {
      const actual = new Member()
      expect(actual.links.web).toEqual(undefined)
    })

    it('sets a web link if one is given', () => {
      const web = 'https://somebody.com'
      const actual = new Member({ web })
      expect(actual.links.web).toEqual(web)
    })

    it('defaults active to false', () => {
      const actual = new Member()
      expect(actual.active).toEqual(false)
    })

    it('sets active to the value given', () => {
      const actual = new Member({ active: true })
      expect(actual.active).toEqual(true)
    })

    it('casts the value given for active to a boolean', () => {
      const actual = new Member({ active: 'Hello world' })
      expect(actual.active).toEqual(true)
    })

    it('defaults admin to false', () => {
      const actual = new Member()
      expect(actual.admin).toEqual(false)
    })

    it('sets admin to the value given', () => {
      const actual = new Member({ admin: true })
      expect(actual.admin).toEqual(true)
    })

    it('casts the value given for admin to a boolean', () => {
      const actual = new Member({ admin: 'Hello world' })
      expect(actual.admin).toEqual(true)
    })

    it('defaults invitations to zero', () => {
      const actual = new Member()
      expect(actual.invitations).toEqual(0)
    })

    it('sets invitations to the value given', () => {
      const invitations = 5
      const actual = new Member({ invitations })
      expect(actual.invitations).toEqual(invitations)
    })

    it('sets invitations to 0 if not given a number', () => {
      const actual = new Member({ invitations: 'Not a number' })
      expect(actual.invitations).toEqual(0)
    })
  })

  describe('load', () => {
    it('loads an instance from the database', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const actual = await Member.load(1, db)
      await testUtils.resetTables(db, 'members')
      expect(actual.id).toEqual(1)
      expect(actual.name).toEqual('Admin')
      expect(actual.email).toEqual('admin@thefifthworld.com')
      expect(actual.admin).toEqual(true)
    })
  })

  describe('canEdit', () => {
    it('returns false if not given a Member object for the subject', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const subject = 'Not a member'
      const editor = await Member.load(3, db)
      const actual = Member.canEdit(subject, editor)
      await testUtils.resetTables(db, 'members')
      expect(actual).toEqual(false)
    })

    it('returns false if not given a Member object for the editor', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const subject = await Member.load(2, db)
      const editor = 'Not a member'
      const actual = Member.canEdit(subject, editor)
      await testUtils.resetTables(db, 'members')
      expect(actual).toEqual(false)
    })

    it('returns false if you try to edit someone else\'s account', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const subject = await Member.load(2, db)
      const editor = await Member.load(3, db)
      const actual = Member.canEdit(subject, editor)
      await testUtils.resetTables(db, 'members')
      expect(actual).toEqual(false)
    })

    it('returns true if you try to edit your own account', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const subject = await Member.load(2, db)
      const editor = await Member.load(2, db)
      const actual = Member.canEdit(subject, editor)
      await testUtils.resetTables(db, 'members')
      expect(actual).toEqual(true)
    })

    it('returns true if an admin tries to edit an account', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const subject = await Member.load(2, db)
      const editor = await Member.load(1, db)
      const actual = Member.canEdit(subject, editor)
      await testUtils.resetTables(db, 'members')
      expect(actual).toEqual(true)
    })
  })

  describe('hash', () => {
    it('returns an encrypted hash', () => {
      const orig = 'password'
      const hash = Member.hash(orig)
      expect(bcrypt.compareSync(orig, hash)).toEqual(true)
    })
  })
})

afterAll(() => {
  db.end()
})
