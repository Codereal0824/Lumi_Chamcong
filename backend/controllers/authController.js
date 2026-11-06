const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { secret } = require('../middleware/auth');
const { notifyAdminPasswordReset, sendPasswordResetOtp, notifyPasswordChanged } = require('../services/email');

const POSITIONS = ['Kỹ thuật viên', 'Kế toán', 'Sale', 'Marketing'];
function legacyHash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function hashPassword(value) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `scrypt$${salt}$${crypto.scryptSync(value, salt, 64).toString('hex')}`;
}
function verifyPassword(value, stored) {
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
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
  const user = req.app.locals.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || user.account_status === 'inactive' || !verifyPassword(password, user.password_hash)) return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
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
async function requestPasswordReset(req, res) {
  const identifier = String(req.body.identifier || '').trim();
  const db = req.app.locals.db;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) {
    return res.status(400).json({ message: 'Gửi OTP qua số điện thoại chưa được hỗ trợ. Vui lòng sử dụng email đã đăng ký.' });
  }
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) OR phone = ?').get(identifier, identifier);
  const generic = { message: 'Nếu thông tin tồn tại, yêu cầu sẽ được gửi đến quản trị viên để xử lý.' };
  if (!user || user.account_status === 'inactive') return res.json(generic);
  if (!user.email) return res.json(generic);
  db.prepare("UPDATE password_reset_requests SET status = 'expired' WHERE status = 'pending' AND expires_at <= datetime('now')").run();
  const recentRequests = db.prepare("SELECT COUNT(*) AS count FROM password_reset_requests WHERE user_id = ? AND requested_at >= datetime('now', '-15 minutes')").get(user.id).count;
  if (recentRequests >= 3) return res.json(generic);
  const request = db.prepare("INSERT INTO password_reset_requests (user_id, expires_at) VALUES (?, datetime('now', '+15 minutes'))").run(user.id);
  const requestRow = db.prepare('SELECT * FROM password_reset_requests WHERE id = ?').get(request.lastInsertRowid);
  try {
    await notifyAdminPasswordReset({ request: requestRow, user });
  } catch (error) {
    console.error('Password reset admin notification failed:', error.message);
    return res.status(503).json({ message: 'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.' });
  }
  res.status(202).json({ ...generic, status: 'pending' });
}
function passwordResetStatus(req, res) {
  const identifier = String(req.body.identifier || '').trim();
  const db = req.app.locals.db;
  db.prepare("UPDATE password_reset_requests SET status = 'expired' WHERE status = 'pending' AND expires_at <= datetime('now')").run();
  db.prepare("UPDATE password_reset_requests SET status = 'expired' WHERE status = 'approved' AND otp_expires_at <= datetime('now')").run();
  const user = db.prepare('SELECT id FROM users WHERE lower(email) = lower(?) OR phone = ?').get(identifier, identifier);
  if (!user) return res.json({ status: 'pending', message: 'Yêu cầu đang được xử lý.' });
  const request = db.prepare('SELECT id, status, rejection_reason FROM password_reset_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(user.id);
  res.json({ status: request ? request.status : 'pending', rejectionReason: request?.rejection_reason || '' });
}
async function verifyPasswordReset(req, res) {
  const { identifier, otp, newPassword } = req.body;
  if (!identifier || !/^\d{6}$/.test(String(otp || '')) || String(newPassword || '').length < 6) return res.status(400).json({ message: 'Thông tin xác thực không hợp lệ.' });
  const db = req.app.locals.db;
  const user = db.prepare('SELECT * FROM users WHERE lower(email) = lower(?) OR phone = ?').get(identifier, identifier);
  if (!user) return res.status(400).json({ message: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' });
  const record = db.prepare("SELECT * FROM password_reset_requests WHERE user_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 1").get(user.id);
  if (!record || record.otp_used_at || record.otp_attempts >= 5 || !record.otp_expires_at || new Date(record.otp_expires_at.replace(' ', 'T') + 'Z') < new Date()) {
    if (record && record.otp_expires_at) db.prepare("UPDATE password_reset_requests SET status = 'expired' WHERE id = ? AND status = 'approved'").run(record.id);
    return res.status(400).json({ message: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' });
  }
  const expected = crypto.createHash('sha256').update(String(otp)).digest('hex');
  if (expected !== record.otp_hash) {
    db.prepare('UPDATE password_reset_requests SET otp_attempts = otp_attempts + 1 WHERE id = ?').run(record.id);
    return res.status(400).json({ message: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' });
  }
  db.transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(newPassword), user.id);
    db.prepare("UPDATE password_reset_requests SET status = 'completed', otp_used_at = datetime('now'), completed_at = datetime('now') WHERE id = ? AND status = 'approved'").run(record.id);
  })();
  notifyPasswordChanged({ user }).catch(error => console.error('Password reset completion notification failed:', error.message));
  res.json({ message: 'Đặt lại mật khẩu thành công.' });
}
module.exports = { hashPassword, login, register, requestPasswordReset, passwordResetStatus, verifyPasswordReset, POSITIONS, publicUser };
