const MAILJET_SEND_URL = 'https://api.mailjet.com/v3.1/send';
const TEN_SECONDS = 10000;

function runningTests() {
  return process.env.NODE_TEST_CONTEXT !== undefined;
}

function emailSettingsMissing() {
  return !process.env.EMAIL_FROM || !process.env.MAILJET_API_KEY || !process.env.MAILJET_SECRET_KEY;
}

function mailjetLogin() {
  const keys = process.env.MAILJET_API_KEY + ':' + process.env.MAILJET_SECRET_KEY;
  return 'Basic ' + Buffer.from(keys).toString('base64');
}

function mailjetMessage(to, subject, text) {
  return {
    Messages: [
      {
        From: { Email: process.env.EMAIL_FROM, Name: 'Campus Events' },
        To: [{ Email: to }],
        Subject: subject,
        TextPart: text,
      },
    ],
  };
}

export async function sendEmail(to, subject, text) {
  if (runningTests()) {
    return false;
  }
  if (emailSettingsMissing()) {
    console.log('Email not sent because EMAIL_FROM or the Mailjet keys are empty: ' + subject);
    return false;
  }
  try {
    const response = await fetch(MAILJET_SEND_URL, {
      method: 'POST',
      headers: { Authorization: mailjetLogin(), 'Content-Type': 'application/json' },
      body: JSON.stringify(mailjetMessage(to, subject, text)),
      signal: AbortSignal.timeout(TEN_SECONDS),
    });
    if (!response.ok) {
      console.error('Could not send email "' + subject + '": Mailjet answered ' + response.status + ' ' + (await response.text()));
      return false;
    }
    return true;
  } catch (error) {
    console.error('Could not send email "' + subject + '": ' + error.message);
    return false;
  }
}
