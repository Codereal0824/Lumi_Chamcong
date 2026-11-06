document.addEventListener('DOMContentLoaded', () => {
  if (!requireSession('admin')) return;
  document.getElementById('change-password-form').addEventListener('submit', submitPasswordChange);
});

async function submitPasswordChange(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const message = document.getElementById('change-password-message');
  const button = form.querySelector('button[type="submit"]');
  const values = Object.fromEntries(new FormData(form));
  if (values.newPassword !== values.confirmPassword) {
    showPasswordMessage('Mật khẩu mới nhập lại không khớp.', true);
    return;
  }
  button.disabled = true;
  button.textContent = 'Đang cập nhật...';
  try {
    const result = await changeAdminPassword(values);
    form.reset();
    showPasswordMessage(result.message, false);
  } catch (error) {
    showPasswordMessage(error.message, true);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Đổi mật khẩu <span>→</span>';
  }
}

function showPasswordMessage(text, isError) {
  const message = document.getElementById('change-password-message');
  message.textContent = text;
  message.className = `text-sm ${isError ? 'text-red-600' : 'text-emerald-600'}`;
}
