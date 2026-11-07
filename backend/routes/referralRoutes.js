const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getReferrals } = require('../controllers/referralController');

router.use(protect);
router.get('/', getReferrals);

module.exports = router;
