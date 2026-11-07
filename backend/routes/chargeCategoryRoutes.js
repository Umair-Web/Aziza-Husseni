const express = require('express');
const router = express.Router();
const {
  protect,
  denyRegistration,
  denyClinicianRestricted,
} = require('../middleware/auth');
const {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require('../controllers/chargeCategoryController');

router.use(protect);

router.get('/', getCategories);
router.post('/', denyRegistration, denyClinicianRestricted, createCategory);
router.put('/:id', denyRegistration, denyClinicianRestricted, updateCategory);
router.delete('/:id', denyRegistration, denyClinicianRestricted, deleteCategory);

module.exports = router;
