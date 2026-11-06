const ExcelJS = require('exceljs');
const { POSITIONS, hashPassword, publicUser } = require('./authController');
const { verifySmtp, sendTestEmail } = require('../services/email');

function filters(req) {
  const { from_date: fromDate, to_date: toDate, employee_id: employeeId, status, position } = req.query;
  const where = []; const params = {};
  if (fromDate) { where.push('a.date >= @fromDate'); params.fromDate = fromDate; }
  if (toDate) { where.push('a.date <= @toDate'); params.toDate = toDate; }
  if (employeeId) {
    if (!/^\d+$/.test(String(employeeId))) return { clause: 'WHERE 1 = 0', params: {} };
    where.push('a.user_id = @employeeId');
    params.employeeId = Number(employeeId);
  }
  if (status && ['pending', 'approved', 'rejected'].includes(status)) { where.push('a.status = @status'); params.status = status; }
  if (position) { where.push('u.position = @position'); params.position = position; }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}
function mapAttendance(row) {
  return { ...row, employeeId: row.user_id, employee: row.full_name, position: row.position || 'Kỹ thuật viên', initials: row.full_name.split(' ').map(part => part[0]).slice(-2).join(''), checkIn: row.check_in, checkOut: row.check_out, leaveDays: row.leave_days, earlyLeave: Number(row.early_leave_hours || 0), early_leave_hours: Number(row.early_leave_hours || 0), overtime: row.ot_hours, lateMinutes: row.late_minutes, sundayWork: Boolean(row.sunday_work), sundayCheckIn: row.sunday_check_in, sundayCheckOut: row.sunday_check_out, travelDays: row.field_trip_days, site: row.customer_name, note: row.note };
}
function listAttendances(req, res) {
  const { clause, params } = filters(req);
  const rows = req.app.locals.db.prepare(`SELECT a.*, u.full_name, u.position FROM attendances a JOIN users u ON u.id = a.user_id ${clause} ORDER BY a.date DESC, a.id DESC`).all(params).map(mapAttendance);
  res.json({ data: rows, total: rows.length });
}
function updateStatus(req, res) {
  const allowed = ['pending', 'approved', 'rejected'];
  const { status } = req.body;
  if (status && !allowed.includes(status)) return res.status(400).json({ message: 'Trạng thái không hợp lệ.' });
  const result = req.app.locals.db.prepare(`UPDATE attendances SET status = COALESCE(@status, status), updated_at = datetime('now') WHERE id = @id`).run({ id: req.params.id, status: status || null });
  if (!result.changes) return res.status(404).json({ message: 'Không tìm thấy báo cáo.' });
  res.json({ message: 'Đã cập nhật báo cáo.', attendance: req.app.locals.db.prepare('SELECT * FROM attendances WHERE id = ?').get(req.params.id) });
}
function dashboardStats(req, res) {
  const { clause, params } = filters(req);
  const db = req.app.locals.db;
  const totals = db.prepare(`SELECT COALESCE(SUM(a.ot_hours),0) AS totalOtHours, COALESCE(SUM(a.field_trip_days),0) AS fieldTripDays, COALESCE(SUM(a.leave_days),0) AS leaveDays, COUNT(*) AS attendanceDays FROM attendances a JOIN users u ON u.id = a.user_id ${clause}`).get(params);
  const employeeTotals = db.prepare("SELECT COUNT(*) AS totalEmployees, SUM(CASE WHEN account_status = 'active' THEN 1 ELSE 0 END) AS activeEmployees FROM users WHERE role = 'technician'").get();
  const pendingReports = db.prepare('SELECT COUNT(*) AS count FROM attendances WHERE status = ?').get('pending').count;
  const byEmployee = db.prepare(`SELECT u.full_name AS name, COALESCE(SUM(a.ot_hours),0) AS otHours FROM attendances a JOIN users u ON u.id = a.user_id ${clause} GROUP BY a.user_id ORDER BY otHours DESC`).all(params);
  res.json({ totals: { ...totals, ...employeeTotals, pendingReports }, byEmployee, workLocation: [{ label: 'Văn phòng', value: Math.max(0, totals.attendanceDays - totals.fieldTripDays) }, { label: 'Đi công tác', value: totals.fieldTripDays }] });
}
async function exportExcel(req, res) {
  const { clause, params } = filters(req);
  const rows = req.app.locals.db.prepare(`SELECT u.full_name, u.position, a.date, a.check_in, a.check_out, a.leave_days, a.early_leave_hours, a.ot_hours, a.late_minutes, a.sunday_work, a.sunday_check_in, a.sunday_check_out, a.field_trip_days, a.customer_name, a.note, a.status FROM attendances a JOIN users u ON u.id = a.user_id ${clause} ORDER BY a.date DESC`).all(params);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Timesheet');
  sheet.columns = [
    { header: 'Nhân viên', key: 'employee', width: 25 }, { header: 'Chức vụ', key: 'position', width: 18 }, { header: 'Ngày', key: 'date', width: 14 },
    { header: 'Check-in', key: 'checkIn', width: 12 }, { header: 'Check-out', key: 'checkOut', width: 12 },
    { header: 'Nghỉ phép', key: 'leaveDays', width: 12 }, { header: 'Về sớm (giờ)', key: 'earlyLeave', width: 14 },
    { header: 'OT (giờ)', key: 'overtime', width: 12 },
    { header: 'Làm CN', key: 'sundayWork', width: 12 }, { header: 'Giờ làm CN', key: 'sundayHours', width: 18 },
    { header: 'Đi xa (ngày)', key: 'travelDays', width: 14 },
    { header: 'Địa điểm / Khách hàng', key: 'site', width: 30 }, { header: 'Nội dung công việc (Ghi chú)', key: 'note', width: 42 }, { header: 'Trạng thái', key: 'status', width: 14 }
  ];
  rows.forEach(row => sheet.addRow({
    employee: row.full_name, position: row.position, date: row.date, checkIn: row.check_in, checkOut: row.check_out,
    leaveDays: row.leave_days, earlyLeave: row.early_leave_hours, overtime: row.ot_hours,
    sundayWork: row.sunday_work ? 'Có' : 'Không',
    sundayHours: row.sunday_work ? `${row.sunday_check_in} - ${row.sunday_check_out}` : '',
    travelDays: row.field_trip_days, site: row.customer_name, note: row.note, status: row.status
  }));
  const totalRow = sheet.addRow({
    employee: 'TỔNG CỘNG',
    leaveDays: rows.reduce((total, row) => total + Number(row.leave_days || 0), 0),
    earlyLeave: rows.reduce((total, row) => total + Number(row.early_leave_hours || 0), 0),
    overtime: rows.reduce((total, row) => total + Number(row.ot_hours || 0), 0),
    sundayWork: rows.reduce((total, row) => total + (row.sunday_work ? 1 : 0), 0),
    travelDays: rows.reduce((total, row) => total + Number(row.field_trip_days || 0), 0)
  });
  totalRow.font = { bold: true, color: { argb: 'FF0F172A' } };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  [6, 7, 8, 9, 11].forEach(column => { totalRow.getCell(column).numFmt = 'General'; });
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  sheet.autoFilter = { from: 'A1', to: 'N1' };
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="fieldflow-timesheet.xlsx"' });
  await workbook.xlsx.write(res);
  res.end();
}
function listUsers(req, res) {
  const { search = '', position = '', account_status: accountStatus = '' } = req.query;
  const where = []; const params = {};
  if (search) { where.push('(u.full_name LIKE @search OR u.username LIKE @search OR CAST(u.id AS TEXT) LIKE @search)'); params.search = `%${search}%`; }
  if (POSITIONS.includes(position)) { where.push('u.position = @position'); params.position = position; }
  if (['active', 'inactive'].includes(accountStatus)) { where.push('u.account_status = @accountStatus'); params.accountStatus = accountStatus; }
  const rows = req.app.locals.db.prepare(`SELECT u.* FROM users u ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY u.created_at DESC, u.id DESC`).all(params);
  res.json({ data: rows.map(publicUser), positions: POSITIONS });
}
function createUser(req, res) {
  const { username, password, fullName, email = '', phone = '', role = 'technician', position = 'Kỹ thuật viên' } = req.body;
  if (!username || !password || !fullName || !email || !phone) return res.status(400).json({ message: 'Vui lòng nhập đầy đủ thông tin nhân viên.' });
  if (role !== 'technician' || !POSITIONS.includes(position)) return res.status(400).json({ message: 'Role hoặc chức vụ không hợp lệ.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^(?:\+84|0)\d{9,10}$/.test(phone.replace(/[\s-]/g, ''))) return res.status(400).json({ message: 'Email hoặc số điện thoại không đúng định dạng.' });
  try {
    const result = req.app.locals.db.prepare('INSERT INTO users (username, password_hash, full_name, email, phone, role, position) VALUES (?, ?, ?, ?, ?, ?, ?)').run(username, hashPassword(password), fullName.trim(), email.trim().toLowerCase(), phone.replace(/[\s-]/g, ''), role, position);
    res.status(201).json({ message: 'Đã thêm nhân viên.', user: publicUser(req.app.locals.db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid)) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'Tên đăng nhập, email hoặc số điện thoại đã tồn tại.' });
    throw error;
  }
}
function updateUser(req, res) {
  const id = Number(req.params.id); const db = req.app.locals.db;
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!current) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });
  const { fullName, email, phone, position, accountStatus, password } = req.body;
  if (position && !POSITIONS.includes(position)) return res.status(400).json({ message: 'Chức vụ không hợp lệ.' });
  if (accountStatus && !['active', 'inactive'].includes(accountStatus)) return res.status(400).json({ message: 'Trạng thái tài khoản không hợp lệ.' });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) return res.status(400).json({ message: 'Email không đúng định dạng.' });
  if (phone && !/^(?:\+84|0)\d{9,10}$/.test(String(phone).replace(/[\s-]/g, ''))) return res.status(400).json({ message: 'Số điện thoại không đúng định dạng.' });
  if (current.role === 'admin' && accountStatus === 'inactive' && db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND account_status = 'active'").get().count <= 1) return res.status(400).json({ message: 'Không thể khóa tài khoản Admin cuối cùng.' });
  try {
    db.prepare(`UPDATE users SET full_name = COALESCE(@fullName, full_name), email = COALESCE(@email, email),
      phone = COALESCE(@phone, phone), position = COALESCE(@position, position), account_status = COALESCE(@accountStatus, account_status),
      password_hash = COALESCE(@passwordHash, password_hash) WHERE id = @id`).run({
      id, fullName: fullName ? String(fullName).trim() : null, email: email ? String(email).trim().toLowerCase() : null,
      phone: phone ? String(phone).replace(/[\s-]/g, '') : null, position: position || null, accountStatus: accountStatus || null,
      passwordHash: password ? hashPassword(password) : null
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'Email hoặc số điện thoại đã tồn tại.' });
    throw error;
  }
  res.json({ message: 'Đã cập nhật nhân viên.', user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)) });
}
function getUser(req, res) {
  const user = req.app.locals.db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!user) return res.status(404).json({ message: 'Không tìm thấy nhân viên.' });
  res.json({ user: publicUser(user) });
}
async function verifyEmailConfiguration(req, res) {
  try { res.json(await verifySmtp()); }
  catch (error) { res.status(error.code === 'authentication' ? 502 : 503).json({ message: error.message, type: error.code }); }
}
async function sendEmailTest(req, res) {
  try { await sendTestEmail(); res.json({ message: 'Đã gửi email kiểm tra đến Admin.' }); }
  catch (error) { res.status(error.code === 'authentication' ? 502 : 503).json({ message: error.message, type: error.code }); }
}
module.exports = { listAttendances, updateStatus, dashboardStats, exportExcel, listUsers, createUser, updateUser, getUser, verifyEmailConfiguration, sendEmailTest };
