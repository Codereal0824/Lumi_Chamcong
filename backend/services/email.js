const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER
    && process.env.SMTP_PASS && process.env.ADMIN_NOTIFICATION_EMAIL);
}
function transporter() {
  if (!isConfigured()) throw new Error('SMTP chưa được cấu hình đầy đủ.');
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
}
function smtpError(error) {
  const code = String(error?.code || '').toUpperCase();
  if (['EAUTH', 'AUTH'].includes(code) || /authentication|invalid login|username or password/i.test(String(error?.message))) {
    return { type: 'authentication', message: 'SMTP xác thực Gmail thất bại. Kiểm tra SMTP_USER và App Password.' };
  }
  if (['ECONNECTION', 'ETIMEDOUT', 'ENOTFOUND', 'ECONNREFUSED'].includes(code)) {
    return { type: 'connection', message: 'Không thể kết nối SMTP Gmail. Kiểm tra host, port hoặc mạng.' };
  }
  return { type: 'delivery', message: 'Gửi email thất bại. Kiểm tra cấu hình SMTP và địa chỉ nhận.' };
}
function maskEmail(email) {
  const [name, domain] = String(email).split('@');
  return `${name.slice(0, 2)}***@${domain || ''}`;
}
function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[character]));
}
async function sendMail(message) {
  if (!isConfigured()) throw new Error('SMTP chưa được cấu hình đầy đủ.');
  try {
    return await transporter().sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, ...message });
  } catch (error) {
    const classified = smtpError(error);
    const wrapped = new Error(classified.message);
    wrapped.code = classified.type;
    wrapped.cause = error;
    throw wrapped;
  }
}
async function verifySmtp() {
  if (!isConfigured()) throw Object.assign(new Error('SMTP chưa được cấu hình đầy đủ.'), { code: 'configuration' });
  try { await transporter().verify(); return { message: 'Kết nối SMTP thành công.' }; }
  catch (error) { const classified = smtpError(error); const wrapped = new Error(classified.message); wrapped.code = classified.type; wrapped.cause = error; throw wrapped; }
}
async function sendTestEmail() {
  return sendMail({ to: process.env.ADMIN_NOTIFICATION_EMAIL, subject: '[FieldFlow] Email kiểm tra SMTP', text: 'Email kiểm tra SMTP FieldFlow đã được gửi thành công.' });
}
async function notifyAdminPasswordReset({ request, user }) {
  return sendMail({
    to: process.env.ADMIN_NOTIFICATION_EMAIL,
    subject: '[FieldFlow] Yêu cầu khôi phục mật khẩu',
    text: [
      'Có yêu cầu khôi phục mật khẩu mới trong FieldFlow.',
      `Mã yêu cầu: PR-${request.id}`,
      `Nhân viên: ${user.full_name}`,
      `Tên đăng nhập: ${user.username}`,
      `Thời gian gửi: ${request.requested_at}`,
      `Email đăng ký: ${maskEmail(user.email)}`
    ].join('\n')
  });
}
async function sendPasswordResetOtp({ user, otp }) {
  return sendMail({
    to: user.email,
    subject: '[LUMITECH] Mã xác nhận đổi mật khẩu',
    text: `Công ty LUMITECH hân hạnh gửi lại mã xác nhận đổi mật khẩu.\n\nMã xác nhận: ${otp}\nMã có hiệu lực trong 5 phút và chỉ sử dụng một lần.`,
    html: `
      <div style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#172033;">
        <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #dbe3ee;border-radius:18px;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,.08);">
          <div style="background:linear-gradient(135deg,#0f766e,#0f4c81);padding:28px 32px;color:#ffffff;">
            <div style="font-size:14px;letter-spacing:2px;font-weight:700;">LUMITECH</div>
            <div style="margin-top:12px;font-size:28px;line-height:1.25;font-weight:800;">Xác nhận đổi mật khẩu</div>
          </div>
          <div style="padding:32px;">
            <p style="margin:0 0 16px;font-size:19px;line-height:1.6;font-weight:700;">Kính gửi ${escapeHtml(user.full_name || user.username)},</p>
            <p style="margin:0 0 24px;font-size:17px;line-height:1.7;color:#475569;">Công ty LUMITECH hân hạnh gửi lại mã xác nhận đổi mật khẩu cho tài khoản của bạn.</p>
            <div style="margin:0 0 24px;border:2px solid #14b8a6;border-radius:14px;background:#f0fdfa;padding:24px;text-align:center;">
              <div style="font-size:14px;line-height:1.4;color:#0f766e;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Mã xác nhận của bạn</div>
              <div style="margin-top:10px;font-size:42px;line-height:1.1;letter-spacing:9px;color:#0f4c81;font-weight:800;">${escapeHtml(otp)}</div>
            </div>
            <p style="margin:0 0 8px;font-size:16px;line-height:1.6;color:#475569;">Mã có hiệu lực trong <strong>5 phút</strong> và chỉ được sử dụng một lần.</p>
            <p style="margin:0;font-size:15px;line-height:1.6;color:#64748b;">Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email và liên hệ quản trị viên.</p>
          </div>
          <div style="border-top:1px solid #e2e8f0;padding:20px 32px;background:#f8fafc;color:#64748b;font-size:13px;line-height:1.5;text-align:center;">
            Email tự động từ hệ thống FieldFlow · Công ty LUMITECH
          </div>
        </div>
      </div>`
  });
}
async function notifyPasswordChanged({ user }) {
  return sendMail({
    to: user.email,
    subject: '[FieldFlow] Mật khẩu đã được thay đổi',
    text: 'Mật khẩu tài khoản FieldFlow của bạn đã được thay đổi thành công. Nếu không phải bạn thực hiện, hãy liên hệ quản trị viên.'
  });
}
module.exports = { isConfigured, verifySmtp, sendTestEmail, notifyAdminPasswordReset, sendPasswordResetOtp, notifyPasswordChanged };
