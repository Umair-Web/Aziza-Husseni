const mongoose = require('mongoose');

const chargeItemSchema = new mongoose.Schema(
  {
    particular: { type: String, required: true },
    days: { type: Number, default: 0 },
    ratePerDay: { type: Number, default: 0 },
    amount: { type: Number, required: true, default: 0 },
    note: { type: String, default: '' },
    date: { type: Date, default: Date.now },
    // When true, days/amount follow noon billable-day sync. Manual add-charge sets false.
    autoDays: { type: Boolean, default: true },
  },
  { _id: true }
);

const medicineItemSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: '' },
    dose: { type: String, trim: true, default: '' },
    timing: { type: String, trim: true, default: '' },
    duration: { type: String, trim: true, default: '' },
  },
  { _id: true }
);

const paymentEntrySchema = new mongoose.Schema(
  {
    amount: { type: Number, required: true, min: 0 },
    receivedAt: { type: Date, required: true, default: Date.now },
    note: { type: String, trim: true, default: '' },
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
    careType: {
      type: String,
      enum: ['Admission', 'Observation', ''],
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
    gender: {
      type: String,
      enum: ['Male', 'Female'],
      required: true,
    },
    age: {
      type: Number,
      required: true,
    },
    ageUnit: {
      type: String,
      enum: ['Days', 'Months', 'Years'],
      default: 'Years',
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
    referralType: {
      type: String,
      trim: true,
      default: '',
    },
    referralDescription: {
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
    /** Cached sum of paymentHistory (kept for unpaid / earnings summaries) */
    amountReceived: {
      type: Number,
      default: 0,
    },
    paymentHistory: [paymentEntrySchema],
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
    principleDiagnosis: {
      type: String,
      trim: true,
      default: '',
    },
    associateDiagnosis: {
      type: String,
      trim: true,
      default: '',
    },
    historyExamination: {
      type: String,
      trim: true,
      default: '',
    },
    investigation: {
      type: String,
      trim: true,
      default: '',
    },
    managementHospitalCourse: {
      type: String,
      trim: true,
      default: '',
    },
    medicines: [medicineItemSchema],
    followUpDate: {
      type: String,
      default: '',
    },
    followUpDay: {
      type: String,
      default: '',
    },
    followUpTime: {
      type: String,
      default: '',
    },
    patientType: {
      type: String,
      trim: true,
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
