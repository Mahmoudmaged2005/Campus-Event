import nodemailer from 'nodemailer';

const TEN_SECONDS = 10000;

let mailer = null;

function gmail() {
  if (mailer === null) {
    mailer = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_APP_PASSWORD },
      connectionTimeout: TEN_SECONDS,
      greetingTimeout: TEN_SECONDS,
      socketTimeout: TEN_SECONDS,
    });
  }
  return mailer;
}

function runningTests() {
  return process.env.NODE_TEST_CONTEXT !== undefined;
}

export async function sendEmail(to, subject, text) {
  if (runningTests()) {
    return false;
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
    console.log('Email not sent because EMAIL_USER or EMAIL_APP_PASSWORD is empty: ' + subject);
    return false;
  }
  try {
    await gmail().sendMail({
      from: 'Campus Events <' + process.env.EMAIL_USER + '>',
      to: to,
      subject: subject,
      text: text,
    });
    return true;
  } catch (error) {
    console.error('Could not send email "' + subject + '": ' + error.message);
    return false;
  }
}
