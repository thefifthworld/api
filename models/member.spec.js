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

  describe('update', () => {
    it('won\'t let you update someone else\'s account', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const editor = await Member.load(2, db)
      const before = await Member.load(3, db)
      const val = await before.update({ bio: 'New bio' }, editor, db)
      const after = await Member.load(3, db)
      await testUtils.resetTables(db, 'members')
      expect(val).toEqual(false)
      expect(before.bio).toEqual(after.bio)
    })

    it('will let you update your own account', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const before = await Member.load(2, db)
      const val = await before.update({ bio: 'New bio' }, before, db)
      const after = await Member.load(2, db)
      await testUtils.resetTables(db, 'members')
      expect(val).toEqual(true)
      expect(after.bio).toEqual('New bio')
    })

    it('will let an admin update your own account', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const admin = await Member.load(1, db)
      const before = await Member.load(2, db)
      const val = await before.update({ bio: 'New bio' }, admin, db)
      const after = await Member.load(2, db)
      await testUtils.resetTables(db, 'members')
      expect(val).toEqual(true)
      expect(after.bio).toEqual('New bio')
    })

    it('updates the Member instance', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const subject = await Member.load(2, db)
      await subject.update({ bio: 'New bio' }, subject, db)
      await testUtils.resetTables(db, 'members')
      expect(subject.bio).toEqual('New bio')
    })

    it('hashes passwords', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const password = 'password'
      const subject = await Member.load(2, db)
      await subject.update({ password }, subject, db)
      await testUtils.resetTables(db, 'members')
      expect(bcrypt.compareSync(password, subject.password)).toEqual(true)
    })

    it('doesn\'t reset password if there\'s no updated password', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const password = 'password'
      const before = await Member.load(2, db)
      await before.update({ password }, before, db)
      await before.update({ bio: 'New bio' }, before, db)
      const after = await Member.load(2, db)
      await testUtils.resetTables(db, 'members')
      expect(bcrypt.compareSync(password, after.password)).toEqual(true)
    })
  })

  describe('deactivate', () => {
    it('lets an admin deactivate a member', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const admin = await Member.load(1, db)
      const before = await Member.load(2, db)
      await before.deactivate(admin, db)
      const after = await Member.load(2, db)
      await testUtils.resetTables(db, 'members')
      expect(after.active).toEqual(false)
    })

    it('won\'t let you deactivate someone else', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const other = await Member.load(3, db)
      const before = await Member.load(2, db)
      await before.deactivate(other, db)
      const after = await Member.load(2, db)
      await testUtils.resetTables(db, 'members')
      expect(after.active).toEqual(true)
    })

    it('won\'t let you deactivate yourself', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const before = await Member.load(2, db)
      await before.deactivate(before, db)
      const after = await Member.load(2, db)
      await testUtils.resetTables(db, 'members')
      expect(after.active).toEqual(true)
    })
  })

  describe('reactivate', () => {
    it('lets an admin reactivate a member', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const admin = await Member.load(1, db)
      const before = await Member.load(2, db)
      await before.deactivate(admin, db)
      await before.reactivate(admin, db)
      const after = await Member.load(2, db)
      await testUtils.resetTables(db, 'members')
      expect(after.active).toEqual(true)
    })

    it('won\'t let you deactivate someone else', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const admin = await Member.load(1, db)
      const other = await Member.load(3, db)
      const before = await Member.load(2, db)
      await before.deactivate(admin, db)
      await before.reactivate(other, db)
      const after = await Member.load(2, db)
      await testUtils.resetTables(db, 'members')
      expect(after.active).toEqual(false)
    })

    it('won\'t let you deactivate yourself', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const admin = await Member.load(1, db)
      const before = await Member.load(2, db)
      await before.deactivate(admin, db)
      await before.reactivate(before, db)
      const after = await Member.load(2, db)
      await testUtils.resetTables(db, 'members')
      expect(after.active).toEqual(false)
    })
  })

  describe('logMessage', () => {
    it('saves a message to the database', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const member = await Member.load(2, db)
      await member.logMessage('confirmation', 'Confirmation message', db)
      const check = await db.run(`SELECT id FROM messages WHERE member = ${member.id};`)
      await testUtils.resetTables(db, 'messages', 'members')
      expect(check).toHaveLength(1)
    })
  })

  describe('getMessages', () => {
    it('fetches the member\'s messages', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const member = await Member.load(2, db)
      await member.logMessage('confirmation', 'Confirmation message', db)
      await member.logMessage('error', 'Error message', db)
      await member.logMessage('warning', 'Warning!', db)
      await member.logMessage('info', 'Did you know?', db)
      const res = await member.getMessages(db)
      await testUtils.resetTables(db, 'messages', 'members')
      expect(res.confirmation).toHaveLength(1)
      expect(res.error).toHaveLength(1)
      expect(res.warning).toHaveLength(1)
      expect(res.info).toHaveLength(1)
    })

    it('removes the member\'s messages from the database', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const member = await Member.load(2, db)
      await member.logMessage('confirmation', 'Confirmation message', db)
      await member.logMessage('error', 'Error message', db)
      await member.logMessage('warning', 'Warning!', db)
      await member.logMessage('info', 'Did you know?', db)
      await member.getMessages(db)
      const res = await member.getMessages(db)
      await testUtils.resetTables(db, 'messages', 'members')
      expect(res).toEqual({})
    })
  })

  describe('createInvitation', () => {
    it('adds a member to the database', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      await inviter.createInvitation('invited@thefifthworld.com', () => {}, db)
      const actual = await Member.load('invited@thefifthworld.com', db)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(actual).toBeInstanceOf(Member)
    })

    it('adds an invitation', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      await inviter.createInvitation('invited@thefifthworld.com', () => {}, db)
      const invited = await Member.load('invited@thefifthworld.com', db)
      const actual = await db.run(`SELECT id, inviteCode FROM invitations WHERE inviteTo=${invited.id} AND accepted=0;`)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(actual).toHaveLength(1)
      expect(typeof actual[0].inviteCode).toEqual('string')
      expect(actual[0].inviteCode.length).toBeGreaterThanOrEqual(10)
    })

    it('sends an email', async () => {
      expect.assertions(5)
      let actual = {}
      const emailer = async props => {
        Object.keys(props).forEach(key => {
          actual[key] = props[key]
        })
      }

      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      await inviter.createInvitation('invited@thefifthworld.com', emailer, db)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')

      expect(actual.to).toEqual('invited@thefifthworld.com')
      expect(actual.subject).toBeDefined()
      expect(typeof actual.subject).toEqual('string')
      expect(actual.body).toBeDefined()
      expect(typeof actual.body).toEqual('string')
    })

    it('logs a message', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      await inviter.createInvitation('invited@thefifthworld.com', () => {}, db)
      const actual = await inviter.getMessages(db)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(actual.confirmation).toHaveLength(1)
    })
  })

  describe('sendReminder', () => {
    it('sends an email', async () => {
      expect.assertions(5)
      let actual = {}
      const emailer = async props => {
        Object.keys(props).forEach(key => {
          actual[key] = props[key]
        })
      }

      await testUtils.populateMembers(db)
      const member = await Member.load(2, db)
      const other = await Member.load(3, db)
      await db.run(`INSERT INTO invitations (inviteFrom, inviteTo, inviteCode) VALUES (2, 3, 'helloworld');`)
      await member.sendReminder(other, emailer, db)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(actual.to).toEqual('other@thefifthworld.com')
      expect(actual.subject).toBeDefined()
      expect(typeof actual.subject).toEqual('string')
      expect(actual.body).toBeDefined()
      expect(typeof actual.body).toEqual('string')
    })

    it('logs a message', async () => {
      expect.assertions(1)
      let actual = {}
      const emailer = async props => {
        Object.keys(props).forEach(key => {
          actual[key] = props[key]
        })
      }

      await testUtils.populateMembers(db)
      const member = await Member.load(2, db)
      const other = await Member.load(3, db)
      await db.run(`INSERT INTO invitations (inviteFrom, inviteTo, inviteCode) VALUES (2, 3, 'helloworld');`)
      await member.sendReminder(other, emailer, db)
      const messages = await member.getMessages(db)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(messages.confirmation).toHaveLength(1)
    })
  })

  describe('sendInvitation', () => {
    it('creates a new account', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      await inviter.sendInvitation('invited@thefifthworld.com', () => {}, db)
      const invited = await Member.load('invited@thefifthworld.com', db)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(invited).toBeInstanceOf(Member)
      expect(invited.email).toEqual('invited@thefifthworld.com')
    })

    it('creates an invitation', async () => {
      expect.assertions(3)
      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      await inviter.sendInvitation('invited@thefifthworld.com', () => {}, db)
      const invited = await Member.load('invited@thefifthworld.com', db)
      const actual = await db.run(`SELECT inviteCode FROM invitations WHERE inviteTo=${invited.id} AND inviteFrom=${inviter.id} AND accepted=0;`)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(actual).toHaveLength(1)
      expect(typeof actual[0].inviteCode).toEqual('string')
      expect(actual[0].inviteCode.length).toBeGreaterThanOrEqual(10)
    })

    it('doesn\'t create an invitation if you\'re out of invitations', async () => {
      expect.assertions(2)
      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      inviter.invitations = 0
      await inviter.sendInvitation('invited@thefifthworld.com', () => {}, db)
      const invited = await Member.load('invited@thefifthworld.com', db)
      const check = await db.run(`SELECT inviteCode FROM invitations WHERE inviteFrom=${inviter.id};`)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(invited).not.toBeDefined()
      expect(check).toHaveLength(0)
    })

    it('logs a message when you\'re out of invitations', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      inviter.invitations = 0
      await inviter.sendInvitation('invited@thefifthworld.com', () => {}, db)
      const messages = await inviter.getMessages(db)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(messages.warning).toHaveLength(1)
    })

    it('sends a reminder if that address already has a pending invitation', async () => {
      expect.assertions(3)
      let actual = {}
      const emailer = async props => {
        Object.keys(props).forEach(key => {
          actual[key] = props[key]
        })
      }

      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      await inviter.sendInvitation('invited@thefifthworld.com', () => {}, db)
      await inviter.sendInvitation('invited@thefifthworld.com', emailer, db)
      const messages = await inviter.getMessages(db)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')

      expect(messages.confirmation).toHaveLength(2)
      expect(actual.to).toEqual('invited@thefifthworld.com')
      expect(actual.subject).toEqual('Your invitation to the Fifth World is waiting')
    })

    it('tells you if she\'s already a member', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const inviter = await Member.load(2, db)
      await inviter.sendInvitation('other@thefifthworld.com', () => {}, db)
      const messages = await inviter.getMessages(db)
      await testUtils.resetTables(db, 'messages', 'invitations', 'members')
      expect(messages.info).toHaveLength(1)
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

    it('loads by email address', async () => {
      expect.assertions(4)
      await testUtils.populateMembers(db)
      const actual = await Member.load('admin@thefifthworld.com', db)
      await testUtils.resetTables(db, 'members')
      expect(actual.id).toEqual(1)
      expect(actual.name).toEqual('Admin')
      expect(actual.email).toEqual('admin@thefifthworld.com')
      expect(actual.admin).toEqual(true)
    })
  })

  describe('authenticate', () => {
    it('resolves with false if the email is not associated with a record', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const actual = await Member.authenticate('heckin@nope.com', 'password', db)
      await testUtils.resetTables(db, 'members')
      expect(actual).toEqual(false)
    })

    it('resolves with false if the password is incorrect', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const actual = await Member.authenticate('normal@thefifthworld.com', 'nope', db)
      await testUtils.resetTables(db, 'members')
      expect(actual).toEqual(false)
    })

    it('resolves with the ID if the password is correct', async () => {
      expect.assertions(1)
      await testUtils.populateMembers(db)
      const actual = await Member.authenticate('normal@thefifthworld.com', 'password', db)
      await testUtils.resetTables(db, 'members')
      expect(actual).toEqual(2)
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

  describe('generateInvitationCode', () => {
    it('returns a string that is at least 10 characters long', async () => {
      expect.assertions(2)
      const code = await Member.generateInvitationCode(db)
      expect(typeof code).toEqual('string')
      expect(code.length).toBeGreaterThanOrEqual(10)
    })

    it('returns a string that is not in use', async () => {
      expect.assertions(1)
      const code = await Member.generateInvitationCode(db)
      const check = await db.run(`SELECT id FROM invitations WHERE inviteCode = '${code}';`)
      expect(check).toHaveLength(0)
    })
  })
})

afterAll(() => {
  db.end()
})
