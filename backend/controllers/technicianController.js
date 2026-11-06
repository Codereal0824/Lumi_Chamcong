const { calculateDurationHours, calculateWorkHours } = require('../services/workHours');

function createAttendance(req, res) {
  const body = req.body;
  const required = ['date', 'checkIn', 'checkOut'];
  if (required.some(field => !body[field])) return res.status(400).json({ message: 'date, checkIn và checkOut là bắt buộc.' });
  if (![0, 0.5, 1].includes(Number(body.leaveDays || 0))) return res.status(400).json({ message: 'leaveDays chỉ nhận 0, 0.5 hoặc 1.' });
  const db = req.app.locals.db;
  const existing = db.prepare('SELECT id FROM attendances WHERE user_id = ? AND date = ? LIMIT 1').get(req.user.id, body.date);
  if (existing) return res.status(409).json({ message: 'Bạn đã gửi báo cáo cho ngày này. Không thể gửi trùng.' });
  const leaveDays = Number(body.leaveDays || 0);
  let calculatedHours;
  try { calculatedHours = leaveDays === 1
    ? { earlyLeaveHours: 0, otHours: 0, lateMinutes: 0 }
    : calculateWorkHours(body.checkIn, body.checkOut); }
  catch (error) { return res.status(400).json({ message: error.message }); }
  const earlyLeaveHours = calculatedHours.earlyLeaveHours;
  const fieldTripDays = leaveDays === 1 ? 0 : Number(body.fieldTripDays || 0);
  if (![0, 1].includes(fieldTripDays)) {
    return res.status(400).json({ message: 'fieldTripDays chỉ nhận 0 (Không) hoặc 1 (Có).' });
  }
  const sundayWork = leaveDays !== 1 && (body.sundayWork === true || body.sundayWork === 1 || body.sundayWork === 'true');
  let sundayCheckIn = null;
  let sundayCheckOut = null;
  if (sundayWork) {
    if (!body.sundayCheckIn || !body.sundayCheckOut) {
      return res.status(400).json({ message: 'Cần nhập giờ bắt đầu và kết thúc khi làm Chủ nhật/ngày lễ.' });
    }
    try {
      calculateDurationHours(body.sundayCheckIn, body.sundayCheckOut);
      sundayCheckIn = body.sundayCheckIn;
      sundayCheckOut = body.sundayCheckOut;
    } catch (error) {
      return res.status(400).json({ message: error.message });
    }
  }
  const result = db.prepare(`INSERT INTO attendances
    (user_id, date, check_in, check_out, leave_days, early_leave_hours, ot_hours, late_minutes,
     sunday_work, sunday_check_in, sunday_check_out, field_trip_days, customer_name, note)
    VALUES (@userId, @date, @checkIn, @checkOut, @leaveDays, @earlyLeaveHours, @otHours, @lateMinutes,
     @sundayWork, @sundayCheckIn, @sundayCheckOut, @fieldTripDays, @customerName, @note)`).run({
      userId: req.user.id, date: body.date, checkIn: body.checkIn, checkOut: body.checkOut,
      leaveDays, earlyLeaveHours, otHours: calculatedHours.otHours,
      lateMinutes: calculatedHours.lateMinutes, sundayWork: sundayWork ? 1 : 0,
      sundayCheckIn, sundayCheckOut, fieldTripDays, customerName: body.customerName || '', note: body.note || ''
    });
  res.status(201).json({ message: 'Báo cáo đã được tạo.', attendance: db.prepare('SELECT * FROM attendances WHERE id = ?').get(result.lastInsertRowid) });
}
function getMyHistory(req, res) {
  const rows = req.app.locals.db.prepare(`SELECT a.*, u.full_name AS employee, u.username FROM attendances a JOIN users u ON u.id = a.user_id WHERE a.user_id = ? ORDER BY a.date DESC, a.id DESC`).all(req.user.id);
  res.json({ data: rows });
}
module.exports = { createAttendance, getMyHistory };
