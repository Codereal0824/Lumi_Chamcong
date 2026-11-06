let attendanceData = [];
const STANDARD_END_MINUTES = 17 * 60 + 30;
document.addEventListener('DOMContentLoaded', async () => {
  const requiredRole = document.getElementById('report-form') ? 'technician' : (document.getElementById('timesheet-body') || document.getElementById('recent-reports') ? 'admin' : null);
  if (requiredRole && !requireSession(requiredRole)) return;
  setupReportForm();
  const reportDateLabel = document.getElementById('report-date-label');
  if (reportDateLabel) reportDateLabel.textContent = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()).toUpperCase();
  setupDateRange();
  setupFilters();
  document.getElementById('export-dashboard')?.addEventListener('click', () => showToast('Đã tạo báo cáo tổng quan tháng 06.'));
  document.getElementById('export-csv')?.addEventListener('click', exportCsv);
  if (document.getElementById('timesheet-body')) await loadTimesheet();
  if (document.getElementById('recent-reports')) await loadDashboard();
  if (document.getElementById('report-form')) return;
});
function showToast(message) { const toast = document.getElementById('toast'); if (!toast) return; toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); }
function setupReportForm() {
  const user = getStoredUser();
  const userName = user?.fullName || user?.username || 'Người dùng';
  const roleLabel = user?.role === 'admin' ? 'Quản trị viên' : (user?.position || 'Kỹ thuật viên');
  const initials = userName.split(/\s+/).filter(Boolean).map(part => part[0]).slice(-2).join('').toUpperCase() || '--';
  const userLabel = document.getElementById('current-user-label');
  const userInitials = document.getElementById('current-user-initials');
  if (userLabel) userLabel.textContent = `${userName} · ${roleLabel}`;
  if (userInitials) userInitials.textContent = initials;
  const form = document.getElementById('report-form');
  const workStatus = form?.elements.workStatus;
  const workSections = form ? [...form.querySelectorAll('[data-work-content]')] : [];
  const updateWorkStatus = () => {
    const working = workStatus?.value !== 'off';
    workSections.forEach(section => {
      section.classList.toggle('form-card-disabled', !working);
      section.querySelectorAll('input, textarea, select, button').forEach(control => {
        control.disabled = !working;
      });
    });
  };
  document.querySelectorAll('[data-radio-group="workStatus"] .quick-option').forEach(button => button.addEventListener('click', () => {
    workStatus.value = button.dataset.value;
    document.querySelectorAll('[data-radio-group="workStatus"] .quick-option').forEach(item => item.classList.toggle('active', item === button));
    updateWorkStatus();
  }));
  updateWorkStatus();
  document.querySelectorAll('[data-radio-group] .quick-option').forEach(button => button.addEventListener('click', () => { const group = button.closest('[data-radio-group]'); group.querySelectorAll('.quick-option').forEach(item => item.classList.remove('active')); button.classList.add('active'); document.querySelector(`input[name="${group.dataset.radioGroup}"]`).value = button.dataset.value; }));
  document.querySelectorAll('[data-step]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    const input = document.getElementById(button.dataset.target);
    if (!input) return;
    const currentValue = Number(input.value) || 0;
    const nextValue = Math.max(Number(input.min || 0), currentValue + Number(button.dataset.step));
    input.value = Number.isInteger(nextValue) ? String(nextValue) : String(Number(nextValue.toFixed(2)));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  const checkIn = document.querySelector('[name="checkIn"]');
  const checkOut = document.querySelector('[name="checkOut"]');
  const sundayWork = document.getElementById('sundayWork');
  const sundayHours = document.getElementById('sunday-hours');
  const sundayCheckIn = document.querySelector('[name="sundayCheckIn"]');
  const sundayCheckOut = document.querySelector('[name="sundayCheckOut"]');
  const updateSundayFields = () => {
    const enabled = Boolean(sundayWork?.checked);
    sundayHours?.classList.toggle('hidden', !enabled);
    if (sundayCheckIn) sundayCheckIn.required = enabled;
    if (sundayCheckOut) sundayCheckOut.required = enabled;
  };
  sundayWork?.addEventListener('change', updateSundayFields);
  updateSundayFields();
  const recalculatePreview = () => {
    const toMinutes = value => { const [hours, minutes] = String(value || '').split(':').map(Number); return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null; };
    const out = toMinutes(checkOut?.value);
    if (out === null) return;
    const early = out < STANDARD_END_MINUTES ? -Math.round((STANDARD_END_MINUTES - out) / 15) / 4 : 0;
    const overtime = out > STANDARD_END_MINUTES ? Math.round((out - STANDARD_END_MINUTES) / 15) / 4 : 0;
    const earlyInput = document.getElementById('earlyLeave');
    const overtimeInput = document.getElementById('overtime');
    if (earlyInput) earlyInput.value = early;
    if (overtimeInput) overtimeInput.value = overtime;
  };
  checkIn?.addEventListener('change', recalculatePreview);
  checkOut?.addEventListener('change', recalculatePreview);
  recalculatePreview();
  document.getElementById('report-form')?.addEventListener('submit', async event => {
    event.preventDefault(); const form = event.target; const submitButton = form.querySelector('button[type="submit"]');
    if (form.dataset.submitting === 'true') return;
    form.dataset.submitting = 'true';
    if (submitButton) { submitButton.disabled = true; submitButton.textContent = 'Đang gửi báo cáo...'; }
    const values = Object.fromEntries(new FormData(form));
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isWorking = values.workStatus !== 'off';
    const payload = {
      date: localDate,
      checkIn: values.checkIn || '08:00',
      checkOut: values.checkOut || '17:30',
      leaveDays: isWorking ? Number(values.leaveDays || 0) : 1,
      sundayWork: isWorking && form.elements.sundayWork.checked,
      sundayCheckIn: isWorking ? values.sundayCheckIn || null : null,
      sundayCheckOut: isWorking ? values.sundayCheckOut || null : null,
      fieldTripDays: isWorking && values.fieldTrip === 'yes' ? 1 : 0,
      customerName: isWorking ? (values.site || '').trim() : '',
      note: isWorking ? (values.notes || '').trim() : 'Không đi làm'
    };
    try {
      await submitAttendance(payload);
      showToast('✓ Báo cáo đã được gửi thành công cho quản lý.');
      if (submitButton) submitButton.textContent = '✓ Đã gửi báo cáo';
    } catch (error) {
      form.dataset.submitting = 'false';
      if (submitButton) { submitButton.disabled = false; submitButton.textContent = 'Gửi báo cáo cuối ngày →'; }
      showToast(`Không thể gửi báo cáo: ${error.message}`);
    }
  });
}
function statusLabel(status) { return { approved: 'Đã duyệt', pending: 'Chờ duyệt', rejected: 'Từ chối' }[status] || status; }
function formatDateInput(date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); return `${year}-${month}-${day}`; }
function setupDateRange() {
  const fromDate = document.getElementById('from-date');
  const toDate = document.getElementById('to-date');
  if (!fromDate || !toDate || fromDate.value || toDate.value) return;
  const today = new Date();
  const fiveYearsLater = new Date(today);
  fiveYearsLater.setFullYear(today.getFullYear() + 5);
  fromDate.value = formatDateInput(today);
  toDate.value = formatDateInput(fiveYearsLater);
}
function setupFilters() { ['employee-filter', 'from-date', 'to-date', 'status-filter'].forEach(id => document.getElementById(id)?.addEventListener('input', loadTimesheet)); document.getElementById('clear-filters')?.addEventListener('click', () => { ['employee-filter', 'from-date', 'to-date'].forEach(id => { document.getElementById(id).value = ''; }); document.getElementById('status-filter').value = 'all'; loadTimesheet(); }); }
function currentFilters(includeEmployee = false) { return { from_date: document.getElementById('from-date')?.value, to_date: document.getElementById('to-date')?.value, status: document.getElementById('status-filter')?.value === 'all' ? '' : document.getElementById('status-filter')?.value, employee_id: includeEmployee ? document.getElementById('export-employee')?.value : '' }; }
async function loadTimesheet() {
  if (!document.getElementById('timesheet-body')) return;
  const filters = currentFilters(); const search = (document.getElementById('employee-filter')?.value || '').toLowerCase();
  try { attendanceData = await getAttendances(filters); if (search) attendanceData = attendanceData.filter(record => record.employee.toLowerCase().includes(search)); populateExportEmployees(attendanceData); renderTimesheet(attendanceData); }
  catch (error) { attendanceData = []; populateExportEmployees(attendanceData); renderTimesheet(attendanceData); showToast(`Không thể tải dữ liệu chấm công: ${error.message}`); }
}
function populateExportEmployees(rows) {
  const select = document.getElementById('export-employee'); if (!select) return;
  const employees = [...new Map(rows.map(row => [String(row.employeeId), row])).values()];
  const selected = select.value;
  select.innerHTML = '<option value="">Tất cả nhân viên</option>' + employees.map(row => `<option value="${row.employeeId}">${escapeHtml(row.employee)}</option>`).join('');
  if ([...select.options].some(option => option.value === selected)) select.value = selected;
}
function renderTimesheet(rows) {
  const body = document.getElementById('timesheet-body'); document.getElementById('record-count').textContent = rows.length; document.getElementById('empty-state').classList.toggle('hidden', rows.length > 0);
  body.innerHTML = rows.map(r => {
    const earlyLeave = Number(r.earlyLeave ?? r.early_leave_hours ?? 0);
    const earlyLeaveLabel = Number.isFinite(earlyLeave) && earlyLeave !== 0 ? `${earlyLeave}h` : '—';
    return `<tr><td><div class="employee-cell"><span class="avatar avatar-sm">${escapeHtml(r.initials)}</span><strong>${escapeHtml(r.employee)}</strong></div></td><td>${escapeHtml(r.position || 'Kỹ thuật viên')}</td><td>${r.date.split('-').reverse().join('/')}</td><td><b>${escapeHtml(r.checkIn)}</b> <span class="muted">/</span> <b>${escapeHtml(r.checkOut)}</b></td><td>${r.leaveDays || '—'}</td><td>${earlyLeaveLabel}</td><td><span class="${r.overtime ? 'highlight-number' : ''}">${r.overtime ? '+' + r.overtime + 'h' : '—'}</span></td><td>${r.lateMinutes ? '<span class="late-number">' + r.lateMinutes + ' phút</span>' : '—'}</td><td>${r.sundayWork ? '<span class="yes">Có</span>' : '—'}</td><td>${r.travelDays ? '<span class="travel-tag">✈ ' + r.travelDays + ' ngày</span>' : '—'}</td><td title="${escapeHtml(r.note || '')}">${r.note ? escapeHtml(r.note).slice(0, 32) + (r.note.length > 32 ? '…' : '') : '—'}</td><td><span class="status ${r.status}">${statusLabel(r.status)}</span></td><td class="action-cell">${r.status === 'pending' ? `<button class="row-action approve" data-id="${r.id}">✓ Duyệt</button><button class="row-action reject" data-id="${r.id}">✕ Từ chối</button>` : `<span class="processed-label">${r.status === 'approved' ? 'Đã xử lý' : 'Đã từ chối'}</span>`}</td></tr>`;
  }).join('');
  body.querySelectorAll('.approve').forEach(button => button.addEventListener('click', () => updateStatus(button.dataset.id, 'approved')));
  body.querySelectorAll('.reject').forEach(button => button.addEventListener('click', () => updateStatus(button.dataset.id, 'rejected')));
}
async function updateStatus(id, status) { const record = attendanceData.find(item => String(item.id) === String(id)); try { await updateAttendanceStatus(id, { status }); record.status = status; renderTimesheet(attendanceData); showToast(`Đã ${status === 'approved' ? 'duyệt' : 'từ chối'} báo cáo của ${record.employee}.`); } catch (error) { showToast(`Không thể cập nhật: ${error.message}`); } }
async function loadDashboard() {
  try {
    const [stats, reports] = await Promise.all([getDashboardStats(), getAttendances({})]);
    attendanceData = reports;
    const cards = document.querySelectorAll('.stats-grid .stat-card strong');
    const totals = stats.totals;
    if (cards[0]) cards[0].innerHTML = `${totals.activeEmployees || 0} <small>/ ${totals.totalEmployees || 0}</small>`;
    if (cards[1]) cards[1].innerHTML = `${Number(totals.totalOtHours || 0)} <small>giờ</small>`;
    if (cards[2]) cards[2].innerHTML = `${Number(totals.fieldTripDays || 0)} <small>ngày</small>`;
    if (cards[3]) cards[3].innerHTML = `${totals.pendingReports || 0} <small>báo cáo</small>`;
    renderCharts(stats); renderRecentReports(reports);
  }
  catch (error) {
    document.querySelectorAll('.stats-grid .stat-card strong').forEach(card => { card.textContent = '—'; });
    renderRecentReports([]);
    showToast(`Không thể tải dashboard: ${error.message}`);
  }
}
function renderRecentReports(rows) { const list = document.getElementById('recent-reports'); if (!list) return; list.innerHTML = rows.slice(0, 4).map(record => `<div class="recent-row"><div class="avatar avatar-sm">${escapeHtml(record.initials)}</div><div class="min-w-0 flex-1"><strong>${escapeHtml(record.employee)}</strong><span>${record.date.split('-').reverse().join('/')} · ${escapeHtml(record.site)}</span></div><span class="status ${record.status}">${statusLabel(record.status)}</span></div>`).join(''); }
async function exportCsv() { const selected = document.getElementById('export-employee')?.selectedOptions[0]?.textContent || 'tất cả nhân viên'; try { await downloadAttendanceCsv(currentFilters(true)); showToast(`Đã xuất Excel cho ${selected}.`); } catch (error) { showToast(`Không thể xuất file: ${error.message}`); } }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
