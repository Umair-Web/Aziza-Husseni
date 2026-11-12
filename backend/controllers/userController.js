const User = require('../models/User');

const MANAGEABLE_ROLES = ['admin', 'clinician', 'registration'];

const publicUser = (user) => ({
  _id: user._id,
  name: user.name,
  username: user.username || '',
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

exports.listUsers = async (req, res) => {
  try {
    const role = String(req.query.role || '').trim();
    const filter = {};
    if (role) {
      if (!MANAGEABLE_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Invalid role filter' });
      }
      filter.role = role;
    } else {
      filter.role = { $in: MANAGEABLE_ROLES };
    }

    const users = await User.find(filter)
      .select('-password')
      .sort({ role: 1, name: 1 });

    res.json(users.map(publicUser));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, username, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required',
      });
    }

    if (!MANAGEABLE_ROLES.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const emailNorm = String(email).toLowerCase().trim();
    const usernameNorm = username ? String(username).trim() : '';

    const existingEmail = await User.findOne({ email: emailNorm });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    if (usernameNorm) {
      const existingUsername = await User.findOne({
        username: new RegExp(
          `^${usernameNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i'
        ),
      });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already in use' });
      }
    }

    const user = await User.create({
      name: String(name).trim(),
      username: usernameNorm || undefined,
      email: emailNorm,
      password,
      role,
    });

    res.status(201).json(publicUser(user));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email or username already in use' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!MANAGEABLE_ROLES.includes(user.role)) {
      return res.status(400).json({ message: 'This user cannot be managed here' });
    }

    const { name, username, email, password, role } = req.body;

    if (role !== undefined) {
      if (!MANAGEABLE_ROLES.includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      // Prevent removing the last admin
      if (user.role === 'admin' && role !== 'admin') {
        const adminCount = await User.countDocuments({ role: 'admin' });
        if (adminCount <= 1) {
          return res.status(400).json({
            message: 'Cannot change role of the only admin account',
          });
        }
      }
      user.role = role;
    }

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Name is required' });
      }
      user.name = trimmed;
    }

    if (email !== undefined) {
      const emailNorm = String(email).toLowerCase().trim();
      if (!emailNorm) {
        return res.status(400).json({ message: 'Email is required' });
      }
      const clash = await User.findOne({
        email: emailNorm,
        _id: { $ne: user._id },
      });
      if (clash) {
        return res.status(400).json({ message: 'Email already in use' });
      }
      user.email = emailNorm;
    }

    if (username !== undefined) {
      const usernameNorm = String(username || '').trim();
      if (usernameNorm) {
        const clash = await User.findOne({
          username: new RegExp(
            `^${usernameNorm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
            'i'
          ),
          _id: { $ne: user._id },
        });
        if (clash) {
          return res.status(400).json({ message: 'Username already in use' });
        }
        user.username = usernameNorm;
      } else {
        user.username = undefined;
      }
    }

    if (password !== undefined && String(password).length > 0) {
      if (String(password).length < 6) {
        return res.status(400).json({
          message: 'Password must be at least 6 characters',
        });
      }
      user.password = password;
    }

    await user.save();
    res.json(publicUser(user));
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Email or username already in use' });
    }
    res.status(500).json({ message: error.message });
  }
};
