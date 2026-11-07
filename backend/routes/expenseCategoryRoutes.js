const express = require('express');
const router = express.Router();
const {
  protect,
  denyRegistration,
  denyClinicianRestricted,
} = require('../middleware/auth');
const {
  getExpenseCategories,
  createExpenseCategory,
  deleteExpenseCategory,
} = require('../controllers/expenseCategoryController');

router.use(protect);
router.use(denyRegistration);
router.use(denyClinicianRestricted);

router.get('/', getExpenseCategories);
router.post('/', createExpenseCategory);
router.delete('/:id', deleteExpenseCategory);

module.exports = router;
