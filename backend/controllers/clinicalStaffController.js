const ClinicalStaff = require('../models/ClinicalStaff');

const ROLES = ['rmo', 'consultant'];

exports.getClinicalStaff = async (req, res) => {
  try {
    const filter = {};
    if (req.query.role && ROLES.includes(req.query.role)) {
      filter.role = req.query.role;
    }
    const staff = await ClinicalStaff.find(filter).sort({ role: 1, name: 1 });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createClinicalStaff = async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const role = req.body.role;

    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
    if (!ROLES.includes(role)) {
      return res.status(400).json({ message: 'Role must be rmo or consultant' });
    }

    const exists = await ClinicalStaff.findOne({ name, role });
    if (exists) {
      return res.status(400).json({
        message:
          role === 'rmo'
            ? 'This R.M.O. already exists'
            : 'This consultant already exists',
      });
    }

    const staff = await ClinicalStaff.create({ name, role });
    res.status(201).json(staff);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This name already exists for that role' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.updateClinicalStaff = async (req, res) => {
  try {
    const staff = await ClinicalStaff.findById(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: 'Not found' });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name || '').trim();
      if (!name) {
        return res.status(400).json({ message: 'Name is required' });
      }
      staff.name = name;
    }

    if (req.body.role !== undefined) {
      if (!ROLES.includes(req.body.role)) {
        return res.status(400).json({ message: 'Role must be rmo or consultant' });
      }
      staff.role = req.body.role;
    }

    const duplicate = await ClinicalStaff.findOne({
      name: staff.name,
      role: staff.role,
      _id: { $ne: staff._id },
    });
    if (duplicate) {
      return res.status(400).json({ message: 'This name already exists for that role' });
    }

    await staff.save();
    res.json(staff);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This name already exists for that role' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.deleteClinicalStaff = async (req, res) => {
  try {
    const staff = await ClinicalStaff.findByIdAndDelete(req.params.id);
    if (!staff) {
      return res.status(404).json({ message: 'Not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
