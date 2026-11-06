const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/technicianController');
router.use(requireAuth, requireRole('technician'));
router.post('/attendance', controller.createAttendance);
router.get('/attendance/my-history', controller.getMyHistory);
module.exports = router;
