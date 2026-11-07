const Referral = require('../models/Referral');

exports.getReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find().sort({ name: 1 });
    res.json(referrals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
