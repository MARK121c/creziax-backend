const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendEmail = async (to, subject, text, html) => {
  try {
    const info = await transporter.sendMail({
      from: `"${process.env.SMTP_FROM_NAME}" <${process.env.SMTP_FROM_EMAIL}>`,
      to,
      subject,
      text,
      html,
    });
    console.log('Email sent: %s', info.messageId);
    return info;
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
};

const sendLoginAlert = async (toUser, loggedUser) => {
  const subject = 'تنبيه تسجيل دخول جديد - Creziax Portal';
  const text = `تنبيه: تم تسجيل دخول ${loggedUser.firstName} ${loggedUser.lastName} للمنصة.`;
  const html = `
    <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #4f46e5;">Creziax Security</h2>
      <p>مرحباً <strong>${toUser.firstName}</strong>،</p>
      <p>تم رصد تسجيل دخول جديد للمنصة:</p>
      <ul>
        <li>المستخدم: <strong>${loggedUser.firstName} ${loggedUser.lastName}</strong></li>
        <li>البريد: ${loggedUser.email}</li>
        <li>الوقت: ${new Date().toLocaleString()}</li>
      </ul>
      <p style="color: #666; font-size: 12px;">هذا تنبيه أمني تلقائي للمالك.</p>
    </div>
  `;
  return sendEmail(toUser.email, subject, text, html);
};

module.exports = { sendEmail, sendLoginAlert };
