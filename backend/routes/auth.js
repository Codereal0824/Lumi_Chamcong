const router = require('express').Router();
const { login, register, requestPasswordReset, passwordResetStatus, verifyPasswordReset } = require('../controllers/authController');
router.post('/login', login);
router.post('/register', register);
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/status', passwordResetStatus);
router.post('/password-reset/verify', verifyPasswordReset);
module.exports = router;
