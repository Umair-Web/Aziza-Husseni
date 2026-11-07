const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' });

exports.login = async (req, res) => {
  try {
    const { email, password, username } = req.body;
    const loginId = (username || email || '').trim();

    if (!loginId || !password) {
      return res.status(400).json({ message: 'Username/email and password are required' });
    }

    const user = await User.findOne({
      $or: [
        { email: loginId.toLowerCase() },
        { username: new RegExp(`^${loginId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
      ],
    });

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      username: user.username || '',
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  res.json(req.user);
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, role, username } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }

    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      username: username || undefined,
      email: email.toLowerCase().trim(),
      password,
      role: role || 'staff',
    });

    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username || '',
      email: user.email,
      role: user.role,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
