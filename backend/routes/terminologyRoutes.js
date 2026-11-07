const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getTerminologies,
  createTerminology,
  updateTerminology,
  deleteTerminology,
  getTerminologyTypes,
} = require('../controllers/terminologyController');

router.use(protect);

router.get('/types', authorize('clinician'), getTerminologyTypes);
router.get('/', authorize('clinician'), getTerminologies);
router.post('/', authorize('clinician'), createTerminology);
router.put('/:id', authorize('clinician'), updateTerminology);
router.delete('/:id', authorize('clinician'), deleteTerminology);

module.exports = router;
