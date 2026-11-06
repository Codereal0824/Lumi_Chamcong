const params = new URLSearchParams(window.location.search);
const requestedRole = params.get('role') || '';
const nextPath = params.get('next') || '';
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const message = document.getElementById('auth-message');
if (requestedRole) loginForm.elements.role.value = requestedRole;
function authMessage(text, error = true) { message.textContent = text; message.className = `mt-4 text-center text-sm ${error ? 'text-red-600' : 'text-emerald-600'}`; }
function switchAuth(mode) { const loginMode = mode === 'login'; loginForm.classList.toggle('hidden', !loginMode); registerForm.classList.toggle('hidden', loginMode); document.getElementById('login-tab').classList.toggle('active', loginMode); document.getElementById('register-tab').classList.toggle('active', !loginMode); document.getElementById('auth-title').textContent = loginMode ? 'Đăng nhập hệ thống' : 'Tạo tài khoản kỹ thuật viên'; authMessage(''); }
document.getElementById('login-tab').addEventListener('click', () => switchAuth('login'));
document.getElementById('register-tab').addEventListener('click', () => switchAuth('register'));
loginForm.addEventListener('submit', async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(loginForm)); try { const user = await login(values.username, values.password); const role = values.role; if (user.role !== role) throw new Error(`Tài khoản này không có quyền truy cập khu vực ${role === 'admin' ? 'Quản trị viên' : 'Kỹ thuật viên'}.`); window.location.href = nextPath || (role === 'admin' ? 'views/admin/dashboard.html' : 'views/technician/report.html'); } catch (error) { clearSession(); authMessage(error.message); } });
registerForm.addEventListener('submit', async event => { event.preventDefault(); const values = Object.fromEntries(new FormData(registerForm)); if (values.password !== values.confirmPassword) return authMessage('Mật khẩu xác nhận không trùng khớp.'); try { await registerAccount(values); registerForm.reset(); switchAuth('login'); authMessage('Đăng ký thành công. Bạn có thể đăng nhập ngay.', false); } catch (error) { authMessage(error.message); } });
