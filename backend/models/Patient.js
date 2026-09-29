const mongoose = require('mongoose');

const chargeItemSchema = new mongoose.Schema(
  {
    particular: { type: String, required: true },
    days: { type: Number, default: 0 },
    ratePerDay: { type: Number, default: 0 },
    amount: { type: Number, required: true, default: 0 },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
  },
  { _id: true }
);

const patientSchema = new mongoose.Schema(
  {
    hospitalRegNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    bedNo: {
      type: String,
      trim: true,
      default: '',
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    relativeOf: {
      type: String,
      trim: true,
      default: '',
    },
    age: {
      type: Number,
      required: true,
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    telNo: {
      type: String,
      trim: true,
      default: '',
    },
    admissionDate: {
      type: Date,
      required: true,
    },
    admissionTime: {
      type: String,
      default: '',
    },
    dutyRmo: {
      type: String,
      trim: true,
      default: '',
    },
    consultant: {
      type: String,
      trim: true,
      default: '',
    },
    diagnosis: {
      type: String,
      trim: true,
      default: '',
    },
    payerName: {
      type: String,
      trim: true,
      default: '',
    },
    payerAddress: {
      type: String,
      trim: true,
      default: '',
    },
    payerTelNo: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['admitted', 'discharged'],
      default: 'admitted',
    },
    charges: [chargeItemSchema],
    advance: {
      type: Number,
      default: 0,
    },
    amountReceived: {
      type: Number,
      default: 0,
    },
    billNo: {
      type: String,
      default: '',
    },
    ipd: {
      type: String,
      default: '',
    },
    dischargeDate: {
      type: Date,
      default: null,
    },
    dischargeTime: {
      type: String,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

patientSchema.virtual('total').get(function () {
  return (this.charges || []).reduce((sum, c) => sum + (c.amount || 0), 0);
});

patientSchema.virtual('balance').get(function () {
  return this.total - (this.advance || 0);
});

patientSchema.set('toJSON', { virtuals: true });
patientSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Patient', patientSchema);
