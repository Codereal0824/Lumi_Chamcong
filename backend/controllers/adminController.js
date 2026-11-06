const ExcelJS = require('exceljs');

function filters(req) {
  const { from_date: fromDate, to_date: toDate, employee_id: employeeId, status } = req.query;
  const where = []; const params = {};
  if (fromDate) { where.push('a.date >= @fromDate'); params.fromDate = fromDate; }
  if (toDate) { where.push('a.date <= @toDate'); params.toDate = toDate; }
  if (employeeId) {
    if (!/^\d+$/.test(String(employeeId))) return { clause: 'WHERE 1 = 0', params: {} };
    where.push('a.user_id = @employeeId');
    params.employeeId = Number(employeeId);
  }
  if (status && ['pending', 'approved', 'rejected'].includes(status)) { where.push('a.status = @status'); params.status = status; }
  return { clause: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}
function mapAttendance(row) {
  return { ...row, employeeId: row.user_id, employee: row.full_name, initials: row.full_name.split(' ').map(part => part[0]).slice(-2).join(''), checkIn: row.check_in, checkOut: row.check_out, leaveDays: row.leave_days, earlyLeave: Number(row.early_leave_hours || 0), early_leave_hours: Number(row.early_leave_hours || 0), overtime: row.ot_hours, lateMinutes: row.late_minutes, sundayWork: Boolean(row.sunday_work), sundayCheckIn: row.sunday_check_in, sundayCheckOut: row.sunday_check_out, travelDays: row.field_trip_days, site: row.customer_name, note: row.note };
}
function listAttendances(req, res) {
  const { clause, params } = filters(req);
  const rows = req.app.locals.db.prepare(`SELECT a.*, u.full_name FROM attendances a JOIN users u ON u.id = a.user_id ${clause} ORDER BY a.date DESC, a.id DESC`).all(params).map(mapAttendance);
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
  const totals = db.prepare(`SELECT COALESCE(SUM(a.ot_hours),0) AS totalOtHours, COALESCE(SUM(a.field_trip_days),0) AS fieldTripDays, COALESCE(SUM(a.leave_days),0) AS leaveDays, COUNT(*) AS attendanceDays FROM attendances a ${clause}`).get(params);
  const byEmployee = db.prepare(`SELECT u.full_name AS name, COALESCE(SUM(a.ot_hours),0) AS otHours FROM attendances a JOIN users u ON u.id = a.user_id ${clause} GROUP BY a.user_id ORDER BY otHours DESC`).all(params);
  res.json({ totals, byEmployee, workLocation: [{ label: 'Văn phòng', value: Math.max(0, totals.attendanceDays - totals.fieldTripDays) }, { label: 'Đi công tác', value: totals.fieldTripDays }] });
}
async function exportExcel(req, res) {
  const { clause, params } = filters(req);
  const rows = req.app.locals.db.prepare(`SELECT u.full_name, a.date, a.check_in, a.check_out, a.leave_days, a.early_leave_hours, a.ot_hours, a.late_minutes, a.sunday_work, a.sunday_check_in, a.sunday_check_out, a.field_trip_days, a.customer_name, a.note, a.status FROM attendances a JOIN users u ON u.id = a.user_id ${clause} ORDER BY a.date DESC`).all(params);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Timesheet');
  sheet.columns = [
    { header: 'Nhân viên', key: 'employee', width: 25 }, { header: 'Ngày', key: 'date', width: 14 },
    { header: 'Check-in', key: 'checkIn', width: 12 }, { header: 'Check-out', key: 'checkOut', width: 12 },
    { header: 'Nghỉ phép', key: 'leaveDays', width: 12 }, { header: 'Về sớm (giờ)', key: 'earlyLeave', width: 14 },
    { header: 'OT (giờ)', key: 'overtime', width: 12 },
    { header: 'Làm CN', key: 'sundayWork', width: 12 }, { header: 'Giờ làm CN', key: 'sundayHours', width: 18 },
    { header: 'Đi xa (ngày)', key: 'travelDays', width: 14 },
    { header: 'Địa điểm / Khách hàng', key: 'site', width: 30 }, { header: 'Nội dung công việc (Ghi chú)', key: 'note', width: 42 }, { header: 'Trạng thái', key: 'status', width: 14 }
  ];
  rows.forEach(row => sheet.addRow({
    employee: row.full_name, date: row.date, checkIn: row.check_in, checkOut: row.check_out,
    leaveDays: row.leave_days, earlyLeave: row.early_leave_hours, overtime: row.ot_hours,
    sundayWork: row.sunday_work ? 'Có' : 'Không',
    sundayHours: row.sunday_work ? `${row.sunday_check_in} - ${row.sunday_check_out}` : '',
    travelDays: row.field_trip_days, site: row.customer_name, note: row.note, status: row.status
  }));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
  sheet.autoFilter = { from: 'A1', to: 'M1' };
  res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="fieldflow-timesheet.xlsx"' });
  await workbook.xlsx.write(res);
  res.end();
}
module.exports = { listAttendances, updateStatus, dashboardStats, exportExcel };
