const express = require('express');
const router = express.Router();
const {
  protect,
  denyRegistration,
  denyClinicianRestricted,
} = require('../middleware/auth');
const {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  addCharge,
  updateCharge,
  removeCharge,
  resumeCharge,
  batchStopCharges,
  batchResumeCharges,
  addPayment,
  dischargePatient,
  getParticulars,
  getStats,
  getEarnings,
  getNextRegNo,
} = require('../controllers/patientController');
const { sendPatientSlip } = require('../controllers/whatsappController');

router.use(protect);

router.get('/stats/summary', denyRegistration, denyClinicianRestricted, getStats);
router.get('/stats/earnings', denyRegistration, denyClinicianRestricted, getEarnings);
router.get('/particulars/list', getParticulars);
router.get('/next-reg-no', getNextRegNo);
router.get('/', getPatients);
router.post('/', denyClinicianRestricted, createPatient);
router.get('/:id', getPatient);
router.put('/:id', updatePatient);
router.delete('/:id', denyRegistration, denyClinicianRestricted, deletePatient);
router.post('/:id/charges', denyRegistration, denyClinicianRestricted, addCharge);
router.post(
  '/:id/charges/batch-stop',
  denyRegistration,
  denyClinicianRestricted,
  batchStopCharges
);
router.post(
  '/:id/charges/batch-resume',
  denyRegistration,
  denyClinicianRestricted,
  batchResumeCharges
);
router.put(
  '/:id/charges/:chargeId',
  denyRegistration,
  denyClinicianRestricted,
  updateCharge
);
router.delete(
  '/:id/charges/:chargeId',
  denyRegistration,
  denyClinicianRestricted,
  removeCharge
);
router.post(
  '/:id/charges/:chargeId/resume',
  denyRegistration,
  denyClinicianRestricted,
  resumeCharge
);
router.post('/:id/payments', denyRegistration, denyClinicianRestricted, addPayment);
router.post(
  '/:id/whatsapp-slip',
  denyRegistration,
  denyClinicianRestricted,
  sendPatientSlip
);
router.post(
  '/:id/discharge',
  denyRegistration,
  denyClinicianRestricted,
  dischargePatient
);

module.exports = router;
