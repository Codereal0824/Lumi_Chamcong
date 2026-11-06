let resetRequests = [];
const resetLabels = { pending: 'Chờ duyệt', approved: 'Đã chấp nhận', rejected: 'Đã từ chối', expired: 'Đã hết hạn', completed: 'Đã hoàn tất' };
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireSession('admin')) return;
  document.getElementById('reset-status-filter').addEventListener('change', loadResetRequests);
  document.getElementById('verify-smtp').addEventListener('click', async () => { try { const result = await verifyAdminSmtp(); showResetToast(result.message); } catch (error) { showResetToast(error.message); } });
  document.getElementById('send-test-email').addEventListener('click', async () => { if (!confirm('Gửi email thử đến địa chỉ Admin đã cấu hình?')) return; try { const result = await sendAdminTestEmail(); showResetToast(result.message); } catch (error) { showResetToast(error.message); } });
  await loadResetRequests();
});
async function loadResetRequests() {
  try { resetRequests = await getPasswordResetRequests(document.getElementById('reset-status-filter').value); renderResetRequests(); }
  catch (error) { resetRequests = []; renderResetRequests(); showResetToast(error.message); }
}
function renderResetRequests() {
  document.getElementById('reset-count').textContent = resetRequests.length;
  document.getElementById('reset-empty').classList.toggle('hidden', resetRequests.length > 0);
  document.getElementById('reset-body').innerHTML = resetRequests.map((item, index) => `<tr><td>${index + 1}</td><td>${item.requestCode}</td><td><strong>${escapeReset(item.fullName)}</strong></td><td>${escapeReset(item.username)}</td><td>${escapeReset(item.requestedAt)}</td><td><span class="status ${item.status === 'pending' ? 'pending' : item.status === 'approved' || item.status === 'completed' ? 'approved' : 'rejected'}">${resetLabels[item.status] || item.status}</span>${item.status === 'approved' && item.otpDeliveryStatus === 'failed' ? '<small class="block text-red-600">Email OTP lỗi</small>' : ''}</td><td>${item.status === 'pending' ? `<button class="row-action approve" onclick="approveReset(${item.id})">✓ Duyệt</button><button class="row-action reject" onclick="rejectReset(${item.id})">✕ Từ chối</button>` : item.status === 'approved' ? `<button class="row-action approve" onclick="resendResetOtp(${item.id})">Gửi lại OTP</button>` : `<button class="row-action" onclick="showResetDetail(${item.id})">Chi tiết</button>`}</td></tr>`).join('');
}
async function approveReset(id) {
  if (!confirm('Xác nhận phê duyệt? OTP sẽ được gửi đến email đã đăng ký.')) return;
  try { await approvePasswordResetRequest(id); await loadResetRequests(); showResetToast('Đã duyệt và gửi OTP cho nhân viên.'); } catch (error) { showResetToast(error.message); }
}
async function rejectReset(id) {
  const reason = prompt('Lý do từ chối (không bắt buộc):', '');
  if (reason === null) return;
  try { await rejectPasswordResetRequest(id, reason); await loadResetRequests(); showResetToast('Đã từ chối yêu cầu.'); } catch (error) { showResetToast(error.message); }
}
async function resendResetOtp(id) {
  if (!confirm('Xác nhận gửi lại OTP? OTP cũ sẽ mất hiệu lực.')) return;
  try { await resendPasswordResetOtp(id); await loadResetRequests(); showResetToast('Đã gửi lại OTP.'); } catch (error) { showResetToast(error.message); }
}
function showResetDetail(id) { const item = resetRequests.find(request => request.id === id); if (item) alert(`${item.requestCode}\nNhân viên: ${item.fullName}\nTrạng thái: ${resetLabels[item.status]}\n${item.rejectionReason ? `Lý do: ${item.rejectionReason}` : ''}`); }
function escapeReset(value) { return String(value || '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[character])); }
function showResetToast(text) { const toast = document.getElementById('toast'); toast.textContent = text; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2800); }
