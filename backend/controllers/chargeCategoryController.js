const ChargeCategory = require('../models/ChargeCategory');
const { normalizeUnitSubType } = require('../utils/chargeUnits');

exports.getCategories = async (req, res) => {
  try {
    const filter = {};
    if (req.query.unit) filter.unit = req.query.unit;
    if (req.query.subType) filter.subType = req.query.subType;
    if (req.query.acType !== undefined) filter.acType = req.query.acType;

    const categories = await ChargeCategory.find(filter).sort({
      unit: 1,
      subType: 1,
      acType: 1,
      name: 1,
    });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, ratePerDay, autoAttach, unit, subType, acType, acAddon } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Charge name is required' });
    }

    const flag = acAddon !== undefined ? acAddon : acType;
    const normalized = normalizeUnitSubType(unit, subType, flag);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    const exists = await ChargeCategory.findOne({
      name: name.trim(),
      unit: normalized.unit,
      subType: normalized.subType,
      acType: normalized.acType,
    });
    if (exists) {
      return res.status(400).json({
        message: normalized.acType
          ? 'This AC add-on charge already exists for Ward Admission'
          : 'Charge category already exists for this unit and sub-type',
      });
    }

    const category = await ChargeCategory.create({
      name: name.trim(),
      unit: normalized.unit,
      subType: normalized.subType,
      acType: normalized.acType,
      ratePerDay: Number(ratePerDay) || 0,
      autoAttach: Boolean(autoAttach),
    });

    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Charge category already exists for this scope',
      });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { name, ratePerDay, autoAttach, unit, subType, acType, acAddon } = req.body;
    const category = await ChargeCategory.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ message: 'Charge category not found' });
    }

    const nextUnit = unit !== undefined ? unit : category.unit;
    const nextSubType = subType !== undefined ? subType : category.subType;
    const nextAcFlag =
      acAddon !== undefined
        ? acAddon
        : acType !== undefined
          ? acType
          : category.acType;
    const normalized = normalizeUnitSubType(nextUnit, nextSubType, nextAcFlag);
    if (normalized.error) {
      return res.status(400).json({ message: normalized.error });
    }

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return res.status(400).json({ message: 'Charge name is required' });
      }
      category.name = trimmed;
    }

    category.unit = normalized.unit;
    category.subType = normalized.subType;
    category.acType = normalized.acType;

    if (ratePerDay !== undefined) {
      category.ratePerDay = Number(ratePerDay) || 0;
    }

    if (autoAttach !== undefined) {
      category.autoAttach = Boolean(autoAttach);
    }

    const exists = await ChargeCategory.findOne({
      name: category.name,
      unit: category.unit,
      subType: category.subType,
      acType: category.acType,
      _id: { $ne: category._id },
    });
    if (exists) {
      return res.status(400).json({
        message: 'Charge category already exists for this scope',
      });
    }

    await category.save();
    res.json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Charge category already exists for this scope',
      });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const category = await ChargeCategory.findByIdAndDelete(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Charge category not found' });
    }
    res.json({ message: 'Charge category deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
