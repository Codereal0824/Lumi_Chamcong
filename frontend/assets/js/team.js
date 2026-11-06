let teamUsers = [];
const positions = ['Kỹ thuật viên', 'Kế toán', 'Sale', 'Marketing'];
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireSession('admin')) return;
  const positionFilter = document.getElementById('position-filter');
  positionFilter.innerHTML += positions.map(position => `<option>${position}</option>`).join('');
  ['user-search', 'position-filter', 'status-filter'].forEach(id => document.getElementById(id).addEventListener('input', loadUsers));
  document.getElementById('add-user').addEventListener('click', addUser);
  await loadUsers();
});
async function loadUsers() {
  try {
    const data = await getUsers({ search: document.getElementById('user-search').value, position: document.getElementById('position-filter').value, account_status: document.getElementById('status-filter').value });
    teamUsers = data.data; renderUsers();
  } catch (error) { teamUsers = []; renderUsers(); showTeamToast(error.message); }
}
function renderUsers() {
  document.getElementById('user-count').textContent = teamUsers.length;
  document.getElementById('team-empty').classList.toggle('hidden', teamUsers.length > 0);
  document.getElementById('users-body').innerHTML = teamUsers.map((user, index) => `<tr><td>${index + 1}</td><td>NV-${String(user.id).padStart(4, '0')}</td><td><strong>${escapeTeam(user.fullName)}</strong></td><td>${escapeTeam(user.username)}</td><td>${escapeTeam(user.email || '—')}</td><td>${escapeTeam(user.phone || '—')}</td><td>${escapeTeam(user.position)}</td><td><span class="status ${user.accountStatus === 'active' ? 'approved' : 'rejected'}">${user.accountStatus === 'active' ? 'Hoạt động' : 'Đã khóa'}</span></td><td>${user.createdAt || '—'}</td><td><button class="row-action" onclick="editUser(${user.id})">Sửa</button><button class="row-action reject" onclick="toggleUser(${user.id})">${user.accountStatus === 'active' ? 'Khóa' : 'Mở khóa'}</button></td></tr>`).join('');
}
async function addUser() {
  const values = prompt('Nhập: họ tên | tài khoản | email | số điện thoại | mật khẩu | chức vụ');
  if (!values) return;
  const [fullName, username, email, phone, password, position = positions[0]] = values.split('|').map(value => value.trim());
  try { await createUser({ fullName, username, email, phone, password, position }); await loadUsers(); showTeamToast('Đã thêm nhân viên.'); } catch (error) { showTeamToast(error.message); }
}
async function editUser(id) {
  const user = teamUsers.find(item => item.id === id); const position = prompt(`Chức vụ mới (Kỹ thuật viên/Kế toán/Sale/Marketing):`, user.position);
  if (!position || position === user.position) return;
  try { await updateUser(id, { position }); await loadUsers(); showTeamToast('Đã cập nhật chức vụ.'); } catch (error) { showTeamToast(error.message); }
}
async function toggleUser(id) {
  const user = teamUsers.find(item => item.id === id); if (!confirm(`Xác nhận ${user.accountStatus === 'active' ? 'khóa' : 'mở khóa'} tài khoản này?`)) return;
  try { await updateUser(id, { accountStatus: user.accountStatus === 'active' ? 'inactive' : 'active' }); await loadUsers(); showTeamToast('Đã cập nhật trạng thái.'); } catch (error) { showTeamToast(error.message); }
}
function escapeTeam(value) { return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
function showTeamToast(text) { const toast = document.getElementById('toast'); toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); }
