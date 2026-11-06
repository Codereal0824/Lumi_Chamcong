function deliverOtp({ user, otp }) {
  if (process.env.NODE_ENV !== 'production' && process.env.OTP_DELIVERY_MODE === 'console') {
    console.info(`[FieldFlow development OTP] ${user.username}: ${otp}`);
  }
}
module.exports = { deliverOtp };
