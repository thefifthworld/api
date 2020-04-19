const Mailgun = require('mailgun-js')
const config = require('./config')

/**
 * This method sends an email through Mailgun.
 * @param msg {!{ to: string, subject: string, body: string }} - An object that
 *   should include three properties:
 *     - `to`: A string that contains the email address to send the email to
 *     - `subject`: A string containing the subject line of the email
 *     - `body`: A string containing the body of the email message
 * @returns {Promise} - A promise that resolves when the email has been sent
 *   to Mailgun for delivery.
 */

const sendEmail = async msg => {
  return new Promise((resolve, reject) => {
    if (msg.to && msg.subject && msg.body) {
      const mailgun = new Mailgun({ apiKey: config.mailgun.key, domain: config.mailgun.domain })
      const data = {
        from: config.mailgun.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.body
      }
      mailgun.messages().send(data, err => {
        if (err) { reject(err) } else { resolve() }
      })
    } else {
      reject(new Error('Message did not include a recipient, subject, and/or body'))
    }
  })
}

module.exports = sendEmail
