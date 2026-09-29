const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  addCharge,
  removeCharge,
  dischargePatient,
  getParticulars,
  getStats,
} = require('../controllers/patientController');

router.use(protect);

router.get('/stats/summary', getStats);
router.get('/particulars/list', getParticulars);
router.route('/').get(getPatients).post(createPatient);
router.route('/:id').get(getPatient).put(updatePatient);
router.post('/:id/charges', addCharge);
router.delete('/:id/charges/:chargeId', removeCharge);
router.post('/:id/discharge', dischargePatient);

module.exports = router;
