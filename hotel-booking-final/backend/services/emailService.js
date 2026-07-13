const nodemailer = require('nodemailer');
const { SYSTEM_SETTING_KEYS, getSettingValue } = require('./systemSettingsService');

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function createTransporter() {
  const explicitMode = String(process.env.EMAIL_TRANSPORT || '').trim().toLowerCase();
  const smtpHost = String(process.env.SMTP_HOST || '').trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = String(process.env.SMTP_USER || process.env.EMAIL_USER || '').trim();
  const smtpPass = String(process.env.SMTP_PASS || process.env.EMAIL_PASS || '').trim();
  const smtpSecure = toBoolean(process.env.SMTP_SECURE, smtpPort === 465);

  const hasSmtpConfig = Boolean(smtpHost && smtpUser && smtpPass);
  const useMock = explicitMode === 'mock' || (!hasSmtpConfig && explicitMode !== 'smtp');

  if (useMock) {
    return {
      mode: 'mock',
      transporter: nodemailer.createTransport({ jsonTransport: true }),
    };
  }

  return {
    mode: 'smtp',
    hasSmtpConfig,
    transporter: nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    }),
  };
}

const emailClient = createTransporter();

function getEmailTransportInfo() {
  return {
    mode: emailClient.mode,
    smtp_configured: Boolean(emailClient.hasSmtpConfig),
  };
}

async function resolveSenderEmail() {
  const configuredSender = await getSettingValue(SYSTEM_SETTING_KEYS.EMAIL_SENDER, 'no-reply@hotelbooking.local');
  return String(configuredSender || 'no-reply@hotelbooking.local').trim() || 'no-reply@hotelbooking.local';
}

async function sendBookingConfirmationEmail({ booking, hotel, room, recipientName, recipientEmail }) {
  if (!recipientEmail) {
    return null;
  }

  const senderEmail = await resolveSenderEmail();

  const mail = {
    from: senderEmail,
    to: recipientEmail,
    subject: `Xac nhan dat phong - ${hotel.name}`,
    text: [
      `Xin chao ${recipientName || 'ban'},`,
      '',
      `Dat phong cua ban tai ${hotel.name} da duoc tao thanh cong.`,
      `Loai phong: ${room.room_type}`,
      `Ngay nhan phong: ${new Date(booking.check_in).toLocaleDateString('vi-VN')}`,
      `Ngay tra phong: ${new Date(booking.check_out).toLocaleDateString('vi-VN')}`,
      `Tong tien: ${Number(booking.total_amount || 0).toLocaleString('vi-VN')}d`,
      '',
      'Day la email mo phong tu he thong HotelBooking.',
    ].join('\n'),
  };

  const info = await emailClient.transporter.sendMail(mail);

  if (emailClient.mode === 'mock') {
    console.log('[MOCK EMAIL][BOOKING_CONFIRMATION]', info.message);
  } else {
    console.log('[SMTP EMAIL][BOOKING_CONFIRMATION] sent', {
      to: recipientEmail,
      from: senderEmail,
      messageId: info.messageId,
    });
  }

  return {
    mode: emailClient.mode,
    messageId: info.messageId,
    envelope: info.envelope,
    preview: info.message,
  };
}

async function sendRegisterSuccessEmail({ recipientName, recipientEmail }) {
  if (!recipientEmail) {
    return null;
  }

  const senderEmail = await resolveSenderEmail();
  const mail = {
    from: senderEmail,
    to: recipientEmail,
    subject: 'Xac nhan dang ky tai khoan thanh cong',
    text: [
      `Xin chao ${recipientName || 'ban'},`,
      '',
      'Tai khoan cua ban tren he thong HotelBooking da dang ky thanh cong.',
      'Ban co the dang nhap va bat dau dat phong ngay bay gio.',
      '',
      'Cam on ban da su dung dich vu.',
    ].join('\n'),
  };

  const info = await emailClient.transporter.sendMail(mail);

  if (emailClient.mode === 'mock') {
    console.log('[MOCK EMAIL][REGISTER_SUCCESS]', info.message);
  } else {
    console.log('[SMTP EMAIL][REGISTER_SUCCESS] sent', {
      to: recipientEmail,
      from: senderEmail,
      messageId: info.messageId,
    });
  }

  return {
    mode: emailClient.mode,
    messageId: info.messageId,
    envelope: info.envelope,
    preview: info.message,
  };
}

module.exports = { sendBookingConfirmationEmail, sendRegisterSuccessEmail, getEmailTransportInfo };
