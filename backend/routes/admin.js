const router = require('express').Router();
const { requireAuth, requireRole } = require('../middleware/auth');
const controller = require('../controllers/adminController');
router.use(requireAuth, requireRole('admin'));
router.get('/attendances', controller.listAttendances);
router.put('/attendances/:id/status', controller.updateStatus);
router.get('/dashboard-stats', controller.dashboardStats);
router.get('/export-excel', controller.exportExcel);
module.exports = router;
