const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  jsonTransport: true,
});

async function sendBookingConfirmationEmail({ booking, hotel, room, recipientName, recipientEmail }) {
  if (!recipientEmail) {
    return null;
  }

  const mail = {
    from: 'no-reply@hotelbooking.local',
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

  const info = await transporter.sendMail(mail);
  console.log('[MOCK EMAIL][BOOKING_CONFIRMATION]', info.message);

  return {
    messageId: info.messageId,
    envelope: info.envelope,
    preview: info.message,
  };
}

module.exports = { sendBookingConfirmationEmail };
