const Expense = require('../models/Expense');

const parseDayStart = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseDayEnd = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
};

const buildDateFilter = (query) => {
  const start = parseDayStart(query.startDate);
  const end = parseDayEnd(query.endDate);
  if (!start && !end) return {};
  const date = {};
  if (start) date.$gte = start;
  if (end) date.$lte = end;
  return { date };
};

exports.getExpenses = async (req, res) => {
  try {
    const filter = buildDateFilter(req.query);
    const expenses = await Expense.find(filter).sort({ date: -1, createdAt: -1 });
    const totalExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    res.json({ totalExpenses, expenses });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createExpense = async (req, res) => {
  try {
    const { category, details, amount, date } = req.body;
    const cat = String(category || '').trim();
    if (!cat) {
      return res.status(400).json({ message: 'Expense category is required' });
    }

    const amt = Number(amount);
    if (!amt || amt <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0' });
    }

    const expense = await Expense.create({
      category: cat,
      details: String(details || '').trim(),
      amount: amt,
      date: date ? new Date(date) : new Date(),
      createdBy: req.user?._id,
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }
    res.json({ message: 'Expense deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
