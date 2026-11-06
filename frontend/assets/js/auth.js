const params = new URLSearchParams(window.location.search);
const nextPath = params.get('next') || '';
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const message = document.getElementById('auth-message');
let resetPollTimer;
const resetPanel = document.getElementById('reset-panel');
function authMessage(text, error = true) { message.textContent = text; message.className = `mt-4 text-center text-sm ${error ? 'text-red-600' : 'text-emerald-600'}`; }
function switchAuth(mode) { const loginMode = mode === 'login'; loginForm.classList.toggle('hidden', !loginMode); registerForm.classList.toggle('hidden', loginMode); resetPanel.classList.add('hidden'); clearInterval(resetPollTimer); document.getElementById('login-tab').classList.toggle('active', loginMode); document.getElementById('register-tab').classList.toggle('active', !loginMode); document.getElementById('auth-title').textContent = loginMode ? 'Đăng nhập hệ thống' : 'Tạo tài khoản nhân viên'; authMessage(''); }
document.getElementById('login-tab').addEventListener('click', () => switchAuth('login'));
document.getElementById('register-tab').addEventListener('click', () => switchAuth('register'));
function setResetFieldsEnabled(enabled) { ['reset-otp', 'reset-password', 'reset-confirm-password', 'reset-submit'].forEach(id => { document.getElementById(id).disabled = !enabled; }); }
function setResetStatus(text, error = false) { const status = document.getElementById('reset-status'); status.textContent = text; status.className = `text-sm ${error ? 'text-red-600' : 'text-slate-500'}`; }
async function pollResetStatus() {
  const identifier = document.getElementById('reset-identifier').value.trim();
  if (!identifier) return;
  const result = await getPasswordResetStatus(identifier);
  if (result.status === 'approved') { setResetFieldsEnabled(true); setResetStatus('Yêu cầu đã được Admin chấp nhận. Vui lòng nhập OTP.'); clearInterval(resetPollTimer); }
  else if (result.status === 'rejected') { setResetFieldsEnabled(false); setResetStatus(`Yêu cầu bị từ chối${result.rejectionReason ? `: ${result.rejectionReason}` : '.'}`, true); clearInterval(resetPollTimer); }
  else if (result.status === 'expired') { setResetFieldsEnabled(false); setResetStatus('Yêu cầu đã hết hạn. Vui lòng gửi yêu cầu mới.', true); clearInterval(resetPollTimer); }
}
document.getElementById('forgot-password').addEventListener('click', () => { loginForm.classList.add('hidden'); registerForm.classList.add('hidden'); resetPanel.classList.remove('hidden'); setResetFieldsEnabled(false); setResetStatus('Bạn cần được Admin phê duyệt trước khi nhập OTP.'); authMessage(''); });
loginForm.addEventListener('submit', async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(loginForm)); try { const user = await login(values.username, values.password); const destination = user.role === 'admin' ? 'views/admin/dashboard.html' : 'views/technician/report.html'; window.location.href = nextPath || destination; } catch (error) { clearSession(); authMessage(error.message); } });
registerForm.addEventListener('submit', async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(registerForm)); if (values.password !== values.confirmPassword) return authMessage('Mật khẩu xác nhận không trùng khớp.'); try { await registerAccount(values); registerForm.reset(); switchAuth('login'); authMessage('Đăng ký thành công. Bạn có thể đăng nhập ngay.', false); } catch (error) { authMessage(error.message); } });
document.getElementById('request-otp').addEventListener('click', async () => { try { await requestPasswordReset(document.getElementById('reset-identifier').value.trim()); setResetStatus('Yêu cầu đã được ghi nhận và đang chờ Admin phê duyệt.'); authMessage('Nếu thông tin tồn tại, yêu cầu sẽ được gửi đến quản trị viên để xử lý.', false); clearInterval(resetPollTimer); resetPollTimer = setInterval(() => pollResetStatus().catch(() => {}), 4000); } catch (error) { authMessage(error.message); } });
document.getElementById('reset-submit').addEventListener('click', async () => { const password = document.getElementById('reset-password').value; if (password !== document.getElementById('reset-confirm-password').value) return authMessage('Mật khẩu xác nhận không trùng khớp.'); try { await verifyPasswordReset({ identifier: document.getElementById('reset-identifier').value.trim(), otp: document.getElementById('reset-otp').value.trim(), newPassword: password }); clearInterval(resetPollTimer); document.getElementById('reset-panel').classList.add('hidden'); switchAuth('login'); authMessage('Đặt lại mật khẩu thành công. Bạn có thể đăng nhập.', false); } catch (error) { authMessage(error.message); } });
