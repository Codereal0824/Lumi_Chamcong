const API_BASE_URL = window.FIELD_FLOW_API_URL || `${window.location.protocol}//${window.location.hostname}:5000/api`;
let apiToken = localStorage.getItem('fieldflow_token') || '';

async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (apiToken) headers.Authorization = `Bearer ${apiToken}`;
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: `API error ${response.status}` }));
    throw new Error(error.message || 'Không thể kết nối máy chủ.');
  }
  return response;
}
function getStoredUser() { try { return JSON.parse(localStorage.getItem('fieldflow_user') || 'null'); } catch (_error) { return null; } }
function clearSession() { apiToken = ''; localStorage.removeItem('fieldflow_token'); localStorage.removeItem('fieldflow_user'); }
function logout() { clearSession(); window.location.href = '../../auth.html'; }
async function login(username, password) {
  const data = await (await apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })).json();
  apiToken = data.token; localStorage.setItem('fieldflow_token', data.token); localStorage.setItem('fieldflow_user', JSON.stringify(data.user)); return data.user;
}
async function registerAccount(payload) { return (await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(payload) })).json(); }
function requireSession(role) {
  const user = getStoredUser();
  if (!apiToken || !user || (role && user.role !== role)) {
    window.location.href = `../../auth.html?role=${role || ''}&next=${encodeURIComponent(window.location.href)}`;
    return false;
  }
  return true;
}
async function ensureApiSession() { if (!apiToken || !getStoredUser()) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'); }
async function getAttendances(filters = {}) { await ensureApiSession(); const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)); return (await (await apiRequest(`/admin/attendances${query.toString() ? `?${query}` : ''}`)).json()).data; }
async function getDashboardStats() { await ensureApiSession(); return (await (await apiRequest('/admin/dashboard-stats')).json()); }
async function updateAttendanceStatus(id, payload) { await ensureApiSession(); return (await (await apiRequest(`/admin/attendances/${id}/status`, { method: 'PUT', body: JSON.stringify(payload) })).json()); }
async function submitAttendance(payload) { await ensureApiSession(); return (await (await apiRequest('/technician/attendance', { method: 'POST', body: JSON.stringify(payload) })).json()); }
async function downloadAttendanceCsv(filters = {}) {
  await ensureApiSession(); const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
  const response = await apiRequest(`/admin/export-excel${query.toString() ? `?${query}` : ''}`); const blob = await response.blob();
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'fieldflow-timesheet.xlsx'; link.click(); URL.revokeObjectURL(link.href);
}
