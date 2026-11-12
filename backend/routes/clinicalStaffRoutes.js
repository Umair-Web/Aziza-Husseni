const express = require('express');
const router = express.Router();
const {
  protect,
  denyRegistration,
  denyClinicianRestricted,
} = require('../middleware/auth');
const {
  getClinicalStaff,
  createClinicalStaff,
  updateClinicalStaff,
  deleteClinicalStaff,
} = require('../controllers/clinicalStaffController');

router.use(protect);

// Registration needs list for patient create dropdowns
router.get('/', getClinicalStaff);

router.post('/', denyRegistration, denyClinicianRestricted, createClinicalStaff);
router.put('/:id', denyRegistration, denyClinicianRestricted, updateClinicalStaff);
router.delete('/:id', denyRegistration, denyClinicianRestricted, deleteClinicalStaff);

module.exports = router;
