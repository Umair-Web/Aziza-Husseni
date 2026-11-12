const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getWhatsappStatus,
  clearWhatsappSession,
} = require('../controllers/whatsappSetupController');

router.use(protect);
router.use(authorize('admin'));

router.get('/status', getWhatsappStatus);
router.post('/clear', clearWhatsappSession);

module.exports = router;
