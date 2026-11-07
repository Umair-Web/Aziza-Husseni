const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      if (!req.user) {
        return res.status(401).json({ message: 'User not found' });
      }
      return next();
    } catch (error) {
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  return res.status(401).json({ message: 'Not authorized, no token' });
};

const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not allowed for this user role' });
    }
    return next();
  };

const denyRegistration = (req, res, next) => {
  if (req.user?.role === 'registration') {
    return res.status(403).json({
      message: 'This account can only register new patients',
    });
  }
  return next();
};

/** Blocks clinician from billing, discharge, delete, and admin tools. */
const denyClinicianRestricted = (req, res, next) => {
  if (req.user?.role === 'clinician') {
    return res.status(403).json({
      message:
        'Clinicians can only view patients and update details / clinical summary',
    });
  }
  return next();
};

module.exports = {
  protect,
  authorize,
  denyRegistration,
  denyClinicianRestricted,
};
