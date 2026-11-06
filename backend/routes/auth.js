const router = require('express').Router();
const { login, register, requestPasswordReset, resendPasswordResetOtp, verifyPasswordResetOtp, verifyPasswordReset } = require('../controllers/authController');
router.post('/login', login);
router.post('/register', register);
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/resend', resendPasswordResetOtp);
router.post('/password-reset/verify-otp', verifyPasswordResetOtp);
router.post('/password-reset/verify', verifyPasswordReset);
module.exports = router;
