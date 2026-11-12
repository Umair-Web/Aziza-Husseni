const Referral = require('../models/Referral');

exports.getReferrals = async (req, res) => {
  try {
    const referrals = await Referral.find().sort({ name: 1 });
    res.json(referrals);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createReferral = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Referral type name is required' });
    }

    const exists = await Referral.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (exists) {
      return res.status(400).json({ message: 'Referral type already exists' });
    }

    const referral = await Referral.create({ name });
    res.status(201).json(referral);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Referral type already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.updateReferral = async (req, res) => {
  try {
    const referral = await Referral.findById(req.params.id);
    if (!referral) {
      return res.status(404).json({ message: 'Referral type not found' });
    }

    const name = String(req.body.name || '').trim();
    if (!name) {
      return res.status(400).json({ message: 'Referral type name is required' });
    }

    const exists = await Referral.findOne({
      name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      _id: { $ne: referral._id },
    });
    if (exists) {
      return res.status(400).json({ message: 'Referral type already exists' });
    }

    referral.name = name;
    await referral.save();
    res.json(referral);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Referral type already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.deleteReferral = async (req, res) => {
  try {
    const referral = await Referral.findByIdAndDelete(req.params.id);
    if (!referral) {
      return res.status(404).json({ message: 'Referral type not found' });
    }
    res.json({ message: 'Referral type deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
