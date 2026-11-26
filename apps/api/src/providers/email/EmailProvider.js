const nodemailer = require('nodemailer');

/**
 * SMTP email sender (any provider: Gmail app password, Zoho, Amazon SES SMTP, Brevo, …).
 * Configure SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.
 */
class EmailProvider {
  constructor() {
    this.transport = null;
  }

  isConfigured() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  }

  getTransport() {
    if (!this.transport) {
      const port = Number(process.env.SMTP_PORT) || 587;
      this.transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
    }
    return this.transport;
  }

  async send({ to, subject, text, html }) {
    if (!this.isConfigured()) {
      const err = new Error('Email (SMTP) is not configured.');
      err.notConnected = true;
      throw err;
    }
    await this.getTransport().sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      text,
      html
    });
  }
}

module.exports = new EmailProvider();
