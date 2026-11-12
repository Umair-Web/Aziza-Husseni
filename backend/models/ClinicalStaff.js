const mongoose = require('mongoose');

const clinicalStaffSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    role: {
      type: String,
      enum: ['rmo', 'consultant'],
      required: true,
    },
  },
  { timestamps: true }
);

clinicalStaffSchema.index({ name: 1, role: 1 }, { unique: true });

module.exports = mongoose.model('ClinicalStaff', clinicalStaffSchema);
