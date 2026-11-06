const STANDARD_START = 8 * 60;
const STANDARD_END = 17 * 60 + 30;

function toMinutes(value) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || ''));
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function roundQuarterHour(hours) {
  return Math.round(hours * 4) / 4;
}

function calculateDurationHours(start, end) {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  if (startMinutes === null || endMinutes === null || endMinutes < startMinutes) {
    throw new Error('Giờ bắt đầu/kết thúc không hợp lệ.');
  }
  return roundQuarterHour((endMinutes - startMinutes) / 60);
}

function calculateWorkHours(checkIn, checkOut) {
  const checkInMinutes = toMinutes(checkIn);
  const checkOutMinutes = toMinutes(checkOut);
  if (checkInMinutes === null || checkOutMinutes === null || checkOutMinutes < checkInMinutes) {
    throw new Error('Giờ check-in/check-out không hợp lệ.');
  }
  return {
    earlyLeaveHours: checkOutMinutes < STANDARD_END
      ? -roundQuarterHour((STANDARD_END - checkOutMinutes) / 60)
      : 0,
    otHours: checkOutMinutes > STANDARD_END
      ? roundQuarterHour((checkOutMinutes - STANDARD_END) / 60)
      : 0,
    lateMinutes: Math.max(0, checkInMinutes - STANDARD_START)
  };
}

module.exports = { calculateWorkHours, calculateDurationHours, toMinutes };
