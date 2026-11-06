const bcrypt = require('crypto');
const jwt = require('jsonwebtoken');
const { secret } = require('../middleware/auth');

function hashPassword(value) { return bcrypt.createHash('sha256').update(value).digest('hex'); }
function login(req, res) {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ message: 'Vui lòng nhập tên đăng nhập và mật khẩu.' });
  const user = req.app.locals.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || hashPassword(password) !== user.password_hash) return res.status(401).json({ message: 'Tên đăng nhập hoặc mật khẩu không đúng.' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, fullName: user.full_name }, secret(), { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role } });
}
function register(req, res) {
  const { username, password, fullName } = req.body;
  if (!username || !password || !fullName) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ tên đăng nhập, mật khẩu và họ tên.' });
  if (!/^[a-zA-Z0-9._-]{3,30}$/.test(username)) return res.status(400).json({ message: 'Tên đăng nhập dài 3-30 ký tự, chỉ gồm chữ, số, ., _, -.' });
  if (String(password).length < 6) return res.status(400).json({ message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
  try {
    const result = req.app.locals.db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run(username, hashPassword(password), fullName.trim(), 'technician');
    res.status(201).json({ message: 'Đăng ký thành công.', user: { id: result.lastInsertRowid, username, fullName: fullName.trim(), role: 'technician' } });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'Tên đăng nhập đã tồn tại.' });
    throw error;
  }
}
module.exports = { hashPassword, login, register };
