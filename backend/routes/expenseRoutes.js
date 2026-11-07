const express = require('express');
const router = express.Router();
const {
  protect,
  denyRegistration,
  denyClinicianRestricted,
} = require('../middleware/auth');
const {
  getExpenses,
  createExpense,
  deleteExpense,
} = require('../controllers/expenseController');

router.use(protect);
router.use(denyRegistration);
router.use(denyClinicianRestricted);

router.get('/', getExpenses);
router.post('/', createExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
