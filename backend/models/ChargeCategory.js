const mongoose = require('mongoose');

const chargeCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unit: {
      type: String,
      enum: ['NICU', 'PICU', 'Ward'],
      required: true,
    },
    subType: {
      type: String,
      enum: ['Admission', 'Observation'],
      required: true,
    },
    /**
     * Ward Admission only:
     * '' = shared charge (With AC and Without AC)
     * 'With AC' = AC add-on (only when patient selects With AC)
     */
    acType: {
      type: String,
      enum: ['With AC', ''],
      default: '',
    },
    ratePerDay: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    autoAttach: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

chargeCategorySchema.index(
  { name: 1, unit: 1, subType: 1, acType: 1 },
  { unique: true }
);

module.exports = mongoose.model('ChargeCategory', chargeCategorySchema);
