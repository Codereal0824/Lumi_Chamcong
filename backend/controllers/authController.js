const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { secret } = require('../middleware/auth');
const { sendPasswordResetOtp, notifyPasswordChanged } = require('../services/email');

const POSITIONS = ['Kỹ thuật viên', 'Kế toán', 'Sale', 'Marketing'];
const loginAttempts = new Map();
const otpSendAttempts = new Map();
const OTP_MAX_ATTEMPTS = 5;
function legacyHash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function hashPassword(value) {
  return `bcrypt$${bcrypt.hashSync(value, 12)}`;
}
function verifyPassword(value, stored) {
  if (stored.startsWith('bcrypt$')) return bcrypt.compareSync(value, stored.slice('bcrypt$'.length));
  if (stored.startsWith('scrypt$')) {
    const [, salt, digest] = stored.split('$');
    return crypto.timingSafeEqual(Buffer.from(digest, 'hex'), crypto.scryptSync(value, salt, 64));
  }
  return legacyHash(value) === stored;
}
function publicUser(user) {
  return { id: user.id, username: user.username, fullName: user.full_name, role: user.role, email: user.email || '', phone: user.phone || '', position: user.position || 'Kỹ thuật viên', accountStatus: user.account_status || 'active', createdAt: user.created_at || '' };
}
async function login(req, res) {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  if (!username || !password) return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
  const attemptKey = `${req.ip}:${String(username).toLowerCase()}`;
  const attempt = loginAttempts.get(attemptKey);
  if (attempt && attempt.expiresAt > Date.now() && attempt.count >= 5) {
    return res.status(429).json({ message: 'Quá nhiều lần đăng nhập thất bại. Vui lòng thử lại sau 15 phút.' });
  }
  const user = req.app.locals.db.prepare('SELECT * FROM users WHERE lower(username) = lower(?)').get(username);
  if (!user || user.account_status === 'inactive' || !verifyPassword(password, user.password_hash)) {
    const current = attempt && attempt.expiresAt > Date.now() ? attempt : { count: 0, expiresAt: Date.now() + 15 * 60 * 1000 };
    current.count += 1;
    loginAttempts.set(attemptKey, current);
    return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
  }
  loginAttempts.delete(attemptKey);
  if (!user.password_hash.startsWith('bcrypt$')) {
    req.app.locals.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
  }
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, fullName: user.full_name }, secret(), { expiresIn: '8h' });
  res.json({ token, user: publicUser(user) });
}
async function register(req, res) {
  const { username, password, fullName, email, phone, position = 'Kỹ thuật viên' } = req.body;
  if (!username || !password || !fullName || !email || !phone) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ họ tên, tên đăng nhập, email, số điện thoại và mật khẩu.' });
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) return res.status(400).json({ message: 'Tên đăng nhập dài 3-30 ký tự, chỉ gồm chữ, số, ., _, -.' });
  if (String(password).length < 6) return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ message: 'Email không đúng định dạng.' });
  if (!/^(?:\+84|0)\d{9,10}$/.test(String(phone).replace(/[\s-]/g, ''))) return res.status(400).json({ message: 'Số điện thoại không đúng định dạng.' });
  if (!POSITIONS.includes(position)) return res.status(400).json({ message: 'Chức vụ không hợp lệ.' });
  try {
    const result = req.app.locals.db.prepare('INSERT INTO users (username, password_hash, full_name, email, phone, role, position) VALUES (?, ?, ?, ?, ?, ?, ?)').run(username, hashPassword(password), fullName.trim(), email.trim().toLowerCase(), phone.replace(/[\s-]/g, ''), 'technician', position);
    const user = req.app.locals.db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ message: 'Đăng ký thành công.', user: publicUser(user) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'Tên đăng nhập, email hoặc số điện thoại đã tồn tại.' });
    throw error;
  }
}
function genericResetResponse() {
  return { message: 'Nếu email hợp lệ, mã xác thực sẽ được gửi đến địa chỉ đã đăng ký.' };
}
function otpExpired(record) {
  return !record || record.used_at || record.attempts >= OTP_MAX_ATTEMPTS || new Date(record.expires_at.replace(' ', 'T') + 'Z') <= new Date();
}
function sendKey(req, user) {
  return `${req.ip}:${user ? user.id : String(req.body.identifier || '').trim().toLowerCase()}`;
}
function canSendOtp(req, user) {
  const entry = otpSendAttempts.get(sendKey(req, user));
  return !entry || entry.resetAt <= Date.now() || entry.count < 3;
}
function recordOtpAttempt(req, user) {
  const key = sendKey(req, user);
  const entry = otpSendAttempts.get(key);
  if (!entry || entry.resetAt <= Date.now()) otpSendAttempts.set(key, { count: 1, resetAt: Date.now() + 15 * 60 * 1000 });
  else { entry.count += 1; otpSendAttempts.set(key, entry); }
}
async function createAndSendOtp(req, user, previousId = null) {
  const db = req.app.locals.db;
  const otp = String(crypto.randomInt(100000, 1000000));
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
  let otpId;
  db.transaction(() => {
    db.prepare("UPDATE password_reset_otps SET used_at = datetime('now') WHERE user_id = ? AND used_at IS NULL").run(user.id);
    if (previousId) db.prepare('DELETE FROM password_reset_otps WHERE id = ? AND user_id = ?').run(previousId, user.id);
    otpId = db.prepare("INSERT INTO password_reset_otps (user_id, otp_hash, expires_at) VALUES (?, ?, datetime('now', '+5 minutes'))").run(user.id, otpHash).lastInsertRowid;
  })();
  try {
    await sendPasswordResetOtp({ user, otp });
  } catch (error) {
    db.prepare("UPDATE password_reset_otps SET used_at = datetime('now') WHERE id = ?").run(otpId);
    throw error;
  }
  return jwt.sign({ purpose: 'password-reset-otp', otpId, userId: user.id }, secret(), { expiresIn: '10m' });
}
async function requestPasswordReset(req, res) {
  const identifier = String(req.body.identifier || '').trim().toLowerCase();
  const db = req.app.locals.db;
  const generic = genericResetResponse();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return res.json(generic);
  const user = db.prepare("SELECT * FROM users WHERE lower(email) = ? AND account_status = 'active'").get(identifier);
  if (!user || !user.email || !canSendOtp(req, user)) return res.json(generic);
  const active = db.prepare("SELECT * FROM password_reset_otps WHERE user_id = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1").get(user.id);
  if (active && !otpExpired(active)) {
    const seconds = Math.ceil((new Date(active.expires_at.replace(' ', 'T') + 'Z') - new Date()) / 1000);
    if (seconds > 240) return res.status(429).json({ message: 'Mã OTP đã được gửi. Vui lòng chờ trước khi gửi lại.' });
  }
  recordOtpAttempt(req, user);
  try {
    const resetToken = await createAndSendOtp(req, user);
    res.json({ ...generic, resetToken, resendAfter: 60 });
  } catch (error) {
    console.error('Password reset OTP delivery failed:', error.code || 'delivery');
    res.status(503).json({ message: 'Không thể gửi mã OTP lúc này. Vui lòng thử lại sau.' });
  }
}
async function resendPasswordResetOtp(req, res) {
  let payload;
  try { payload = jwt.verify(String(req.body.resetToken || ''), secret()); } catch (_error) { return res.status(400).json({ message: 'Phiên khôi phục không hợp lệ hoặc đã hết hạn.' }); }
  if (payload.purpose !== 'password-reset-otp') return res.status(400).json({ message: 'Phiên khôi phục không hợp lệ.' });
  const db = req.app.locals.db;
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND account_status = 'active'").get(payload.userId);
  const current = db.prepare('SELECT * FROM password_reset_otps WHERE id = ? AND user_id = ?').get(payload.otpId, payload.userId);
  if (!user || otpExpired(current)) return res.status(400).json({ message: 'Mã OTP đã hết hạn. Vui lòng gửi yêu cầu mới.' });
  const seconds = Math.ceil((new Date(current.expires_at.replace(' ', 'T') + 'Z') - new Date()) / 1000);
  if (seconds > 240) return res.status(429).json({ message: 'Vui lòng chờ trước khi gửi lại mã OTP.' });
  if (!canSendOtp(req, user)) return res.status(429).json({ message: 'Bạn đã yêu cầu quá nhiều mã. Vui lòng thử lại sau 15 phút.' });
  recordOtpAttempt(req, user);
  try {
    const resetToken = await createAndSendOtp(req, user, current.id);
    res.json({ message: 'Mã OTP mới đã được gửi.', resetToken, resendAfter: 60 });
  } catch (error) {
    console.error('Password reset OTP resend failed:', error.code || 'delivery');
    res.status(503).json({ message: 'Không thể gửi lại mã OTP lúc này. Vui lòng thử lại sau.' });
  }
}
async function verifyPasswordReset(req, res) {
  const { resetToken, newPassword } = req.body;
  if (!resetToken || String(newPassword || '').length < 6) return res.status(400).json({ message: 'Thông tin xác thực không hợp lệ.' });
  let payload;
  try { payload = jwt.verify(String(resetToken), secret()); } catch (_error) { return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' }); }
  if (payload.purpose !== 'password-reset-verified') return res.status(400).json({ message: 'Bạn chưa xác nhận mã OTP.' });
  const db = req.app.locals.db;
  const user = db.prepare("SELECT * FROM users WHERE id = ? AND account_status = 'active'").get(payload.userId);
  const record = db.prepare('SELECT * FROM password_reset_otps WHERE id = ? AND user_id = ?').get(payload.otpId, payload.userId);
  if (!user || otpExpired(record)) return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
    db.prepare("UPDATE password_reset_otps SET used_at = datetime('now') WHERE id = ?").run(record.id);
    db.prepare("UPDATE password_reset_otps SET used_at = datetime('now') WHERE user_id = ? AND id <> ? AND used_at IS NULL").run(user.id, record.id);
  })();
  notifyPasswordChanged({ user }).catch(error => console.error('Password reset completion notification failed:', error.message));
  res.json({ message: 'Đặt lại mật khẩu thành công.' });
}
async function verifyPasswordResetOtp(req, res) {
  const { resetToken, otp } = req.body;
  if (!resetToken || !/^\d{6}$/.test(String(otp || ''))) return res.status(400).json({ message: 'Vui lòng nhập đủ 6 chữ số OTP.' });
  let payload;
  try { payload = jwt.verify(String(resetToken), secret()); } catch (_error) { return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' }); }
  if (payload.purpose !== 'password-reset-otp') return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
  const db = req.app.locals.db;
  const record = db.prepare('SELECT * FROM password_reset_otps WHERE id = ? AND user_id = ?').get(payload.otpId, payload.userId);
  if (otpExpired(record)) return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
  const expected = crypto.createHash('sha256').update(String(otp)).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(record.otp_hash))) {
    db.prepare('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = ?').run(record.id);
    return res.status(400).json({ message: 'Mã OTP không hợp lệ hoặc đã hết hạn.' });
  }
  const verifiedToken = jwt.sign({ purpose: 'password-reset-verified', otpId: record.id, userId: payload.userId }, secret(), { expiresIn: '10m' });
  res.json({ verifiedToken });
}
module.exports = { hashPassword, login, register, requestPasswordReset, resendPasswordResetOtp, verifyPasswordResetOtp, verifyPasswordReset, POSITIONS, publicUser };
