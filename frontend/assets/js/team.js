let teamUsers = [];
const positions = ['Kỹ thuật viên', 'Kế toán', 'Sale', 'Marketing'];
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireSession('admin')) return;
  const positionFilter = document.getElementById('position-filter');
  positionFilter.innerHTML += positions.map(position => `<option>${position}</option>`).join('');
  ['user-search', 'position-filter', 'status-filter'].forEach(id => document.getElementById(id).addEventListener('input', loadUsers));
  document.getElementById('add-user').addEventListener('click', openAddUserModal);
  document.getElementById('close-add-user').addEventListener('click', closeAddUserModal);
  document.getElementById('cancel-add-user').addEventListener('click', closeAddUserModal);
  document.getElementById('add-user-modal').addEventListener('click', event => { if (event.target.id === 'add-user-modal') closeAddUserModal(); });
  document.getElementById('add-user-form').addEventListener('submit', submitAddUser);
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
function openAddUserModal() {
  const modal = document.getElementById('add-user-modal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.querySelector('#add-user-form input[name="fullName"]').focus();
}
function closeAddUserModal() {
  const modal = document.getElementById('add-user-modal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
}
async function submitAddUser(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const submitButton = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form));
  submitButton.disabled = true;
  submitButton.textContent = 'Đang tạo...';
  try {
    await createUser(values);
    form.reset();
    closeAddUserModal();
    await loadUsers();
    showTeamToast('Đã thêm nhân viên.');
  } catch (error) {
    showTeamToast(error.message);
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'Tạo tài khoản';
  }
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
