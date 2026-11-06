const jwt = require('jsonwebtoken');
const secret = () => process.env.JWT_SECRET || 'development-secret-change-me';

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ message: 'Yêu cầu đăng nhập.' });
  try { req.user = jwt.verify(token, secret()); next(); }
  catch (_error) { return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' }); }
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user.role) ? next() : res.status(403).json({ message: 'Bạn không có quyền thực hiện thao tác này.' });
}
module.exports = { requireAuth, requireRole, secret };
