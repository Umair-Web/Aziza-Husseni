const Terminology = require('../models/Terminology');
const { TERMINOLOGY_TYPES } = Terminology;

exports.getTerminologies = async (req, res) => {
  try {
    const filter = {};
    if (req.query.type) {
      if (!TERMINOLOGY_TYPES.includes(req.query.type)) {
        return res.status(400).json({ message: 'Invalid terminology type' });
      }
      filter.type = req.query.type;
    }
    const items = await Terminology.find(filter).sort({ type: 1, text: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createTerminology = async (req, res) => {
  try {
    const type = req.body.type;
    const text = String(req.body.text || '').trim();

    if (!TERMINOLOGY_TYPES.includes(type)) {
      return res.status(400).json({ message: 'Invalid terminology type' });
    }
    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const existing = await Terminology.findOne({
      type,
      text: new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
    });
    if (existing) {
      return res.status(400).json({ message: 'This entry already exists' });
    }

    const item = await Terminology.create({ type, text });
    res.status(201).json(item);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This entry already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.updateTerminology = async (req, res) => {
  try {
    const item = await Terminology.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Terminology not found' });
    }

    if (req.body.type !== undefined) {
      if (!TERMINOLOGY_TYPES.includes(req.body.type)) {
        return res.status(400).json({ message: 'Invalid terminology type' });
      }
      item.type = req.body.type;
    }

    if (req.body.text !== undefined) {
      const text = String(req.body.text || '').trim();
      if (!text) {
        return res.status(400).json({ message: 'Text is required' });
      }
      item.text = text;
    }

    await item.save();
    res.json(item);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'This entry already exists' });
    }
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTerminology = async (req, res) => {
  try {
    const item = await Terminology.findByIdAndDelete(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Terminology not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTerminologyTypes = (req, res) => {
  res.json(TERMINOLOGY_TYPES);
};
