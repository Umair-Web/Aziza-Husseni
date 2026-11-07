const ExpenseCategory = require('../models/ExpenseCategory');

exports.getExpenseCategories = async (req, res) => {
  try {
    const categories = await ExpenseCategory.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createExpenseCategory = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Expense category name is required' });
    }

    const exists = await ExpenseCategory.findOne({ name });
    if (exists) {
      return res.status(400).json({ message: 'Expense category already exists' });
    }

    const category = await ExpenseCategory.create({ name });
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Expense category already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.deleteExpenseCategory = async (req, res) => {
  try {
    const category = await ExpenseCategory.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Expense category not found' });
    }
    res.json({ message: 'Expense category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
