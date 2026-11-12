const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { listUsers, createUser, updateUser } = require('../controllers/userController');

router.use(protect);
router.use(authorize('admin'));

router.get('/', listUsers);
router.post('/', createUser);
router.put('/:id', updateUser);

module.exports = router;
