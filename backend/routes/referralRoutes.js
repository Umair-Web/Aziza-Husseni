const express = require('express');
const router = express.Router();
const {
  protect,
  denyRegistration,
  denyClinicianRestricted,
} = require('../middleware/auth');
const {
  getReferrals,
  createReferral,
  updateReferral,
  deleteReferral,
} = require('../controllers/referralController');

router.use(protect);

// All authenticated roles can read for patient forms
router.get('/', getReferrals);

router.post('/', denyRegistration, denyClinicianRestricted, createReferral);
router.put('/:id', denyRegistration, denyClinicianRestricted, updateReferral);
router.delete('/:id', denyRegistration, denyClinicianRestricted, deleteReferral);

module.exports = router;
