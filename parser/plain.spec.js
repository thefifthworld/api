/* global describe, it, expect, afterAll */

const db = require('../db')
const testUtils = require('../test-utils')
const Member = require('../models/member')
const Page = require('../models/page')
const parsePlainText = require('./plain')

describe('parsePlainText', () => {
  it('returns plain text', () => {
    const actual = parsePlainText('*Hello* **[world](https://thefifthworld.com)**')
    expect(actual).toEqual('Hello world\n')
  })

  it('removes tags', () => {
    const actual = parsePlainText('This [[Hello:World]] is [[Hello : Test]] text [[Tag: 1]] outside of tags.\n\nAnd here is a [[Test:true]] second paragraph.', null, db)
    expect(actual).toEqual('This is text outside of tags.\nAnd here is a second paragraph.\n')
  })

  it('removes templates', async () => {
    expect.assertions(1)
    await testUtils.populateMembers(db)
    const editor = await Member.load(2, db)
    const data = { title: 'Test', body: '{{Template}}Hello world!{{/Template}} [[Type:Template]]' }
    await Page.create(data, editor, 'Initial text', db)
    const actual = parsePlainText('Hello {{Test}} world', null, db)
    await testUtils.resetTables(db)
    expect(actual).toEqual('Hello  world\n')
  })
})
