const mongoose = require('mongoose');

const TERMINOLOGY_TYPES = [
  'principleDiagnosis',
  'associateDiagnosis',
  'historyExamination',
  'investigation',
  'managementHospitalCourse',
  'medicine',
  'medicineTiming',
];

const terminologySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: TERMINOLOGY_TYPES,
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

terminologySchema.index({ type: 1, text: 1 }, { unique: true });

module.exports = mongoose.model('Terminology', terminologySchema);
module.exports.TERMINOLOGY_TYPES = TERMINOLOGY_TYPES;
