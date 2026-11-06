const params = new URLSearchParams(window.location.search);
const nextPath = params.get('next') || '';
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const message = document.getElementById('auth-message');
const resetPanel = document.getElementById('reset-panel');
const resetIdentifier = document.getElementById('reset-identifier');
let resetToken = '';
let verifiedResetToken = '';
let resendTimer;
function authMessage(text, error = true) { message.textContent = text; message.className = `mt-4 text-center text-sm ${error ? 'text-red-600' : 'text-emerald-600'}`; }
function switchAuth(mode) {
  const loginMode = mode === 'login';
  loginForm.classList.toggle('hidden', !loginMode);
  registerForm.classList.toggle('hidden', loginMode);
  resetPanel.classList.add('hidden');
  document.getElementById('login-tab').classList.toggle('active', loginMode);
  document.getElementById('register-tab').classList.toggle('active', !loginMode);
  document.getElementById('auth-title').textContent = loginMode ? 'Đăng nhập hệ thống' : 'Tạo tài khoản nhân viên';
  authMessage('');
}
function setStep(step) {
  document.getElementById('reset-email-step').classList.toggle('hidden', step !== 'email');
  document.getElementById('reset-otp-step').classList.toggle('hidden', step !== 'otp');
  document.getElementById('reset-password-step').classList.toggle('hidden', step !== 'password');
}
function resetForm() {
  resetToken = '';
  verifiedResetToken = '';
  clearInterval(resendTimer);
  resetIdentifier.value = '';
  document.getElementById('reset-otp').value = '';
  document.getElementById('reset-password').value = '';
  document.getElementById('reset-confirm-password').value = '';
  setStep('email');
}
function startResendCountdown(seconds) {
  const button = document.getElementById('resend-otp');
  let remaining = Number(seconds) || 60;
  button.disabled = true;
  button.textContent = `Gửi lại mã (${remaining}s)`;
  clearInterval(resendTimer);
  resendTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearInterval(resendTimer);
      button.disabled = false;
      button.textContent = 'Gửi lại mã';
    } else button.textContent = `Gửi lại mã (${remaining}s)`;
  }, 1000);
}
document.getElementById('login-tab').addEventListener('click', () => switchAuth('login'));
document.getElementById('register-tab').addEventListener('click', () => switchAuth('register'));
document.getElementById('forgot-password').addEventListener('click', () => {
  loginForm.classList.add('hidden');
  registerForm.classList.add('hidden');
  resetPanel.classList.remove('hidden');
  resetForm();
  document.getElementById('auth-title').textContent = 'Quên mật khẩu?';
  authMessage('');
});
document.getElementById('back-to-login').addEventListener('click', () => switchAuth('login'));
document.getElementById('back-to-email').addEventListener('click', () => { resetToken = ''; setStep('email'); });
document.getElementById('send-otp').addEventListener('click', async () => {
  const button = document.getElementById('send-otp');
  const identifier = resetIdentifier.value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier)) return authMessage('Vui lòng nhập email hợp lệ.');
  button.disabled = true;
  button.textContent = 'Đang gửi mã...';
  try {
    const result = await requestPasswordReset(identifier);
    if (!result.resetToken) throw new Error(result.message || 'Không thể gửi mã OTP lúc này.');
    resetToken = result.resetToken;
    document.getElementById('reset-email-label').textContent = identifier;
    setStep('otp');
    startResendCountdown(result.resendAfter);
    authMessage('Mã OTP đã được gửi đến email của bạn.', false);
  } catch (error) {
    authMessage(error.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Gửi mã OTP';
  }
});
document.getElementById('verify-otp').addEventListener('click', () => {
  const otp = document.getElementById('reset-otp').value.trim();
  if (!/^\d{6}$/.test(otp)) return authMessage('Vui lòng nhập đủ 6 chữ số OTP.');
  const button = document.getElementById('verify-otp');
  button.disabled = true;
  verifyPasswordResetOtp(resetToken, otp).then(result => {
    verifiedResetToken = result.verifiedToken;
    setStep('password');
    authMessage('Mã OTP hợp lệ. Hãy đặt mật khẩu mới.', false);
  }).catch(error => authMessage(error.message)).finally(() => { button.disabled = false; });
});
document.getElementById('resend-otp').addEventListener('click', async () => {
  const button = document.getElementById('resend-otp');
  button.disabled = true;
  try {
    const result = await resendPasswordResetOtp(resetToken);
    resetToken = result.resetToken || resetToken;
    document.getElementById('reset-otp').value = '';
    startResendCountdown(result.resendAfter);
    authMessage('Mã OTP mới đã được gửi.', false);
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Gửi lại mã';
    authMessage(error.message);
  }
});
document.getElementById('reset-submit').addEventListener('click', async () => {
  const password = document.getElementById('reset-password').value;
  const confirmation = document.getElementById('reset-confirm-password').value;
  if (password.length < 6) return authMessage('Mật khẩu phải có ít nhất 6 ký tự.');
  if (password !== confirmation) return authMessage('Mật khẩu xác nhận không trùng khớp.');
  const button = document.getElementById('reset-submit');
  button.disabled = true;
  try {
    await verifyPasswordReset({ resetToken: verifiedResetToken, newPassword: password });
    clearInterval(resendTimer);
    setStep('done');
    authMessage('Đổi mật khẩu thành công. Bạn có thể đăng nhập.', false);
  } catch (error) {
    authMessage(error.message);
    button.disabled = false;
  }
});
loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(loginForm));
  try {
    const user = await login(values.username, values.password);
    window.location.href = nextPath || (user.role === 'admin' ? 'views/admin/dashboard.html' : 'views/technician/report.html');
  } catch (error) { clearSession(); authMessage(error.message); }
});
registerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const values = Object.fromEntries(new FormData(registerForm));
  if (values.password !== values.confirmPassword) return authMessage('Mật khẩu xác nhận không trùng khớp.');
  try { await registerAccount(values); registerForm.reset(); switchAuth('login'); authMessage('Đăng ký thành công. Bạn có thể đăng nhập ngay.', false); }
  catch (error) { authMessage(error.message); }
});
