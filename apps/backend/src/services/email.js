import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM;
const SENDGRID_FROM_NAME = process.env.SENDGRID_FROM_NAME || 'TOW-seasons-Hotel';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function formatDate(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export async function sendBookingConfirmedEmail({ to, booking }) {
  if (!to) return;
  if (!SENDGRID_API_KEY || !SENDGRID_FROM) {
    console.warn('SendGrid not configured, skipping booking email.');
    return;
  }

  const name = booking?.guestName || '';
  const checkIn = formatDate(booking?.checkIn);
  const checkOut = formatDate(booking?.checkOut);
  const unitTypeAr = booking?.unitType?.nameAr || '';
  const unitTypeEn = booking?.unitType?.nameEn || '';
  const bookingId = booking?.bookingCode || booking?.id || '';

  const subject = 'تأكيد الحجز / Booking Confirmation';
  const text = [
    `مرحبًا ${name}،`,
    'تم تأكيد حجزك.',
    `رقم الحجز: ${bookingId}`,
    `تاريخ الدخول: ${checkIn}`,
    `تاريخ الخروج: ${checkOut}`,
    `نوع الوحدة: ${unitTypeAr} / ${unitTypeEn}`,
    '',
    `Hello ${name},`,
    'Your booking has been confirmed.',
    `Booking ID: ${bookingId}`,
    `Check-in: ${checkIn}`,
    `Check-out: ${checkOut}`,
    `Unit type: ${unitTypeEn} / ${unitTypeAr}`
  ].join('\n');

  const html = `
    <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>مرحبًا ${name}،</p>
      <p>تم تأكيد حجزك.</p>
      <ul>
        <li>رقم الحجز: ${bookingId}</li>
        <li>تاريخ الدخول: ${checkIn}</li>
        <li>تاريخ الخروج: ${checkOut}</li>
        <li>نوع الوحدة: ${unitTypeAr} / ${unitTypeEn}</li>
      </ul>
      <hr/>
    </div>
    <div style="font-family: Arial, sans-serif; line-height: 1.6;">
      <p>Hello ${name},</p>
      <p>Your booking has been confirmed.</p>
      <ul>
        <li>Booking ID: ${bookingId}</li>
        <li>Check-in: ${checkIn}</li>
        <li>Check-out: ${checkOut}</li>
        <li>Unit type: ${unitTypeEn} / ${unitTypeAr}</li>
      </ul>
    </div>
  `;

  await sgMail.send({
    to,
    from: { email: SENDGRID_FROM, name: SENDGRID_FROM_NAME },
    subject,
    text,
    html
  });
}
