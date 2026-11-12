const Patient = require('../models/Patient');
const ChargeCategory = require('../models/ChargeCategory');
const {
  combineDateAndTime,
  countBillableDays,
  applyBillableDaysToPatient,
} = require('../utils/billingDays');
const {
  chargesTotal,
  patientDiscountAmount,
  netChargesTotal,
} = require('../utils/billing');
const { chargeScopeFilter } = require('../utils/chargeUnits');

const computeAmount = (item) => {
  if (item.days > 0 && item.ratePerDay > 0) {
    return Number(item.days) * Number(item.ratePerDay);
  }
  return Number(item.amount) || 0;
};

const withBillableDays = (patient, days) => {
  const obj = patient.toObject ? patient.toObject() : patient;
  obj.billableDays = days;
  return obj;
};

const sumPaymentHistory = (patient) => {
  const hist = patient.paymentHistory || [];
  if (hist.length > 0) {
    return hist.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);
  }
  return Number(patient.amountReceived) || 0;
};

const refreshAmountReceivedTotal = (patient) => {
  patient.amountReceived = sumPaymentHistory(patient);
  return patient.amountReceived;
};

const syncBillableDays = async (patient, explicitEnd) => {
  const { days, changed } = applyBillableDaysToPatient(patient, explicitEnd);
  if (changed) await patient.save();
  return days;
};

const chargeBillingStart = (patient, charge) => {
  const admissionStart =
    combineDateAndTime(patient.admissionDate, patient.admissionTime) ||
    (patient.admissionDate ? new Date(patient.admissionDate) : new Date());
  if (charge?.date) {
    const fromDate = new Date(charge.date);
    if (!Number.isNaN(fromDate.getTime()) && fromDate.getTime() > admissionStart.getTime()) {
      return fromDate;
    }
  }
  return admissionStart;
};

/** Freeze a daily auto-charge in place. Returns true if stopped. */
const stopDailyCharge = (patient, charge, stopAt = new Date()) => {
  const rate = Number(charge.ratePerDay) || 0;
  if (rate <= 0 || charge.autoDays === false || charge.stoppedAt) return false;

  const chargeStart = chargeBillingStart(patient, charge);
  const frozenDays = countBillableDays(chargeStart, stopAt);

  charge.days = frozenDays;
  charge.amount = frozenDays * rate;
  charge.autoDays = false;
  charge.stoppedAt = stopAt;

  const stopLabel = stopAt.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const stopNote = `Stopped on ${stopLabel} (${frozenDays} day${frozenDays === 1 ? '' : 's'})`;
  const existing = String(charge.note || '').trim();
  if (!existing.includes('Stopped on')) {
    charge.note = existing ? `${existing} · ${stopNote}` : stopNote;
  }
  return true;
};

const hasActiveParticular = (patient, particular, exceptId) =>
  (patient.charges || []).some(
    (c) =>
      c._id.toString() !== String(exceptId) &&
      c.particular === particular &&
      Number(c.ratePerDay) > 0 &&
      c.autoDays !== false &&
      !c.stoppedAt
  );

/** Start a new active period from a stopped charge. Returns true if resumed. */
const resumeDailyCharge = (patient, charge, now = new Date()) => {
  const rate = Number(charge.ratePerDay) || 0;
  if (rate <= 0) return false;
  if (!charge.stoppedAt && charge.autoDays !== false) return false;
  if (hasActiveParticular(patient, charge.particular, charge._id)) return false;

  const resumeDays = countBillableDays(now, now);
  const resumeLabel = now.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  patient.charges.push({
    particular: charge.particular,
    days: resumeDays,
    ratePerDay: rate,
    amount: resumeDays * rate,
    note: `Activated again from ${resumeLabel}`,
    date: now,
    autoDays: true,
    stoppedAt: null,
  });
  return true;
};

const generateHospitalRegNo = async () => {
  const year = new Date().getFullYear();
  const prefix = `AHH-${year}-`;

  const latest = await Patient.findOne({
    hospitalRegNo: { $regex: `^${prefix}` },
  })
    .sort({ hospitalRegNo: -1 })
    .select('hospitalRegNo')
    .lean();

  let next = 1;
  if (latest?.hospitalRegNo) {
    const parts = latest.hospitalRegNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!Number.isNaN(lastNum)) next = lastNum + 1;
  }

  return `${prefix}${String(next).padStart(5, '0')}`;
};

exports.getParticulars = async (req, res) => {
  try {
    const unit = req.query.unit;
    const subType = req.query.subType;
    const patientAcType = req.query.acType || '';

    let filter = {};
    if (unit && subType) {
      filter = chargeScopeFilter(unit, subType, patientAcType);
    } else {
      if (unit) filter.unit = unit;
      if (subType) filter.subType = subType;
    }

    const categories = await ChargeCategory.find(filter).sort({ name: 1 });
    res.json(
      categories.map((c) => ({
        _id: c._id,
        name: c.name,
        ratePerDay: c.ratePerDay,
        unit: c.unit,
        subType: c.subType,
        acType: c.acType || '',
        autoAttach: c.autoAttach,
      }))
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getNextRegNo = async (req, res) => {
  try {
    const hospitalRegNo = await generateHospitalRegNo();
    res.json({ hospitalRegNo });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPatients = async (req, res) => {
  try {
    const { status, search, fromDate, toDate } = req.query;
    const filter = {};

    if (status && ['admitted', 'discharged'].includes(status)) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { hospitalRegNo: { $regex: search, $options: 'i' } },
        { bedNo: { $regex: search, $options: 'i' } },
        { telNo: { $regex: search, $options: 'i' } },
      ];
    }

    if (fromDate || toDate) {
      filter.admissionDate = {};
      if (fromDate) {
        const start = new Date(fromDate);
        if (Number.isNaN(start.getTime())) {
          return res.status(400).json({ message: 'Invalid from date' });
        }
        start.setHours(0, 0, 0, 0);
        filter.admissionDate.$gte = start;
      }
      if (toDate) {
        const end = new Date(toDate);
        if (Number.isNaN(end.getTime())) {
          return res.status(400).json({ message: 'Invalid to date' });
        }
        end.setHours(23, 59, 59, 999);
        filter.admissionDate.$lte = end;
      }
    }

    const patients = await Patient.find(filter).sort({ createdAt: -1 });
    res.json(patients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    const days = await syncBillableDays(patient);
    res.json(withBillableDays(patient, days));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deletePatient = async (req, res) => {
  try {
    const patient = await Patient.findByIdAndDelete(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json({ message: 'Patient deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPatient = async (req, res) => {
  try {
    const {
      bedNo,
      careType,
      acType,
      name,
      relativeOf,
      gender,
      age,
      ageUnit,
      weight,
      address,
      telNo,
      referralType,
      referralDescription,
      admissionDate,
      admissionTime,
      dutyRmo,
      consultant,
      diagnosis,
      payerName,
      payerAddress,
      payerTelNo,
      advance,
      ipd,
      chargeCategories,
    } = req.body;

    if (!name || age === undefined || age === '' || !admissionDate) {
      return res.status(400).json({
        message: 'Name, Age and Admission Date are required',
      });
    }

    if (!gender || !['Male', 'Female'].includes(gender)) {
      return res.status(400).json({ message: 'Gender is required (Male or Female)' });
    }

    if (!['NICU', 'PICU', 'Ward'].includes(bedNo)) {
      return res.status(400).json({ message: 'Unit must be NICU, PICU, or Ward' });
    }

    const resolvedCareType =
      bedNo === 'NICU'
        ? careType === 'Observation'
          ? 'Observation'
          : 'Admission'
        : 'Admission';

    let resolvedAcType = '';
    if (bedNo === 'Ward') {
      if (!['With AC', 'Without AC'].includes(acType)) {
        return res.status(400).json({
          message: 'Ward Admission requires selecting With AC or Without AC',
        });
      }
      resolvedAcType = acType;
    }

    const resolvedAgeUnit = ['Days', 'Months', 'Years'].includes(ageUnit)
      ? ageUnit
      : 'Years';

    const scopeFilter = chargeScopeFilter(bedNo, resolvedCareType, resolvedAcType);

    let selectedNames;
    if (Array.isArray(chargeCategories)) {
      selectedNames = [...new Set(chargeCategories.map((n) => String(n).trim()).filter(Boolean))];
    } else {
      const autoCats = await ChargeCategory.find({
        ...scopeFilter,
        autoAttach: true,
      }).select('name');
      selectedNames = autoCats.map((c) => c.name);
    }

    const categoryDocs = await ChargeCategory.find({
      ...scopeFilter,
      name: { $in: selectedNames },
    });
    const categoryMap = Object.fromEntries(categoryDocs.map((c) => [c.name, c]));

    const admissionStart =
      combineDateAndTime(admissionDate, admissionTime) || new Date(admissionDate);
    const billableDays = countBillableDays(admissionStart, new Date());

    // Only attach categories that still exist for this unit + care type
    const initialCharges = selectedNames
      .filter((particular) => categoryMap[particular])
      .map((particular) => {
        const rate = Number(categoryMap[particular].ratePerDay) || 0;
        const days = rate > 0 ? billableDays : 1;
        return {
          particular,
          days,
          ratePerDay: rate,
          amount: rate > 0 ? days * rate : 0,
          note: 'Attached at admission',
          date: new Date(),
          autoDays: true,
        };
      });

    let hospitalRegNo = await generateHospitalRegNo();

    // Retry once if a rare duplicate occurs under concurrent creates
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const patient = await Patient.create({
          hospitalRegNo,
          bedNo,
          careType: resolvedCareType,
          acType: resolvedAcType,
          name,
          relativeOf,
          gender,
          age,
          ageUnit: resolvedAgeUnit,
          weight:
            weight === undefined || weight === '' || weight === null
              ? null
              : Number(weight),
          address,
          telNo,
          referralType: referralType || '',
          referralDescription: referralDescription || '',
          admissionDate,
          admissionTime,
          dutyRmo,
          consultant,
          diagnosis,
          payerName,
          payerAddress,
          payerTelNo,
          advance: Number(advance) || 0,
          ipd: ipd || '',
          charges: initialCharges,
          createdBy: req.user._id,
        });
        return res.status(201).json(patient);
      } catch (err) {
        if (err.code === 11000) {
          hospitalRegNo = await generateHospitalRegNo();
          continue;
        }
        throw err;
      }
    }

    res.status(500).json({ message: 'Could not generate unique registration number' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updatePatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const { name, age, gender, ageUnit } = req.body;

    if (name !== undefined && !String(name).trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }

    if (age !== undefined && (age === '' || Number.isNaN(Number(age)))) {
      return res.status(400).json({ message: 'Valid age is required' });
    }

    if (gender !== undefined && !['Male', 'Female'].includes(gender)) {
      return res.status(400).json({ message: 'Gender must be Male or Female' });
    }

    if (ageUnit !== undefined && !['Days', 'Months', 'Years'].includes(ageUnit)) {
      return res.status(400).json({ message: 'Age unit must be Days, Months or Years' });
    }

    const role = req.user?.role;
    const isClinician = role === 'clinician';
    const isRegistration = role === 'registration';

    const profileFields = [
      'bedNo',
      'careType',
      'acType',
      'name',
      'relativeOf',
      'gender',
      'age',
      'ageUnit',
      'weight',
      'address',
      'telNo',
      'referralType',
      'referralDescription',
      'admissionDate',
      'admissionTime',
      'dutyRmo',
      'consultant',
      'diagnosis',
      'payerName',
      'payerAddress',
      'payerTelNo',
      'ipd',
      'patientType',
    ];

    const billingFields = ['advance', 'discountType', 'discountValue'];

    const clinicalFields = [
      'principleDiagnosis',
      'associateDiagnosis',
      'historyExamination',
      'investigation',
      'managementHospitalCourse',
      'followUpDate',
      'followUpDay',
      'followUpTime',
    ];

    // Registration / clinician: profile details.
    // Clinician also writes clinical summary.
    // Admin/staff: profile + advance / discount (clinical applied at discharge).
    let fields = [...profileFields];
    if (isClinician) {
      fields = [...fields, ...clinicalFields];
    } else if (!isRegistration) {
      fields = [...fields, ...billingFields];
    }

    // Discharged patients: allow profile edits, but not admission date/time changes
    const blockedWhenDischarged = ['admissionDate', 'admissionTime'];

    fields.forEach((field) => {
      if (req.body[field] === undefined) return;
      if (patient.status === 'discharged' && blockedWhenDischarged.includes(field)) return;

      if (field === 'age' || field === 'advance' || field === 'discountValue') {
        patient[field] = Number(req.body[field]) || 0;
      } else if (field === 'discountType') {
        const raw = String(req.body[field] || '').trim();
        patient.discountType =
          raw === 'percentage' || raw === 'fixed' ? raw : '';
        if (!patient.discountType) patient.discountValue = 0;
      } else if (field === 'weight') {
        const raw = req.body[field];
        patient.weight =
          raw === '' || raw === null || raw === undefined ? null : Number(raw);
      } else {
        patient[field] = req.body[field];
      }
    });

    if (patient.discountType === 'percentage' && Number(patient.discountValue) > 100) {
      patient.discountValue = 100;
    }

    if (patient.bedNo === 'Ward') {
      // Legacy Ward rows without acType default to With AC
      if (!['With AC', 'Without AC'].includes(patient.acType)) {
        if (req.body.acType !== undefined) {
          return res.status(400).json({
            message: 'Ward Admission requires selecting With AC or Without AC',
          });
        }
        patient.acType = 'With AC';
      }
      patient.careType = 'Admission';
    } else {
      patient.acType = '';
    }

    if (
      isClinician &&
      req.body.medicines !== undefined &&
      Array.isArray(req.body.medicines)
    ) {
      patient.medicines = req.body.medicines
        .filter((m) => m && (m.name || m.dose || m.timing || m.duration))
        .map((m) => ({
          name: m.name || '',
          dose: m.dose || '',
          timing: m.timing || '',
          duration: m.duration || '',
        }));
    }

    const { days } = applyBillableDaysToPatient(patient);
    await patient.save();
    res.json(withBillableDays(patient, days));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addPayment = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Payment amount must be greater than 0' });
    }

    const receivedAt = req.body.receivedAt
      ? new Date(req.body.receivedAt)
      : new Date();
    if (Number.isNaN(receivedAt.getTime())) {
      return res.status(400).json({ message: 'Invalid payment date/time' });
    }

    if (!Array.isArray(patient.paymentHistory)) {
      patient.paymentHistory = [];
    }

    // Migrate legacy single total into history once, before adding new payment
    if (
      patient.paymentHistory.length === 0 &&
      Number(patient.amountReceived) > 0
    ) {
      patient.paymentHistory.push({
        amount: Number(patient.amountReceived),
        receivedAt: patient.updatedAt || new Date(),
        note: 'Previous total (before payment history)',
      });
    }

    patient.paymentHistory.push({
      amount,
      receivedAt,
      note: String(req.body.note || '').trim(),
    });
    refreshAmountReceivedTotal(patient);

    const { days } = applyBillableDaysToPatient(patient);
    await patient.save();
    res.status(201).json(withBillableDays(patient, days));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addCharge = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.status === 'discharged') {
      return res.status(400).json({ message: 'Cannot add charges to a discharged patient' });
    }

    const { particular, days, note, date } = req.body;

    if (!particular) {
      return res.status(400).json({ message: 'Particular is required' });
    }

    const chargeDays = Number(days) || 0;
    if (chargeDays <= 0) {
      return res.status(400).json({ message: 'Days must be greater than 0' });
    }

    // Rate from Charge Category: shared Ward charges + AC add-on when With AC
    const scope = chargeScopeFilter(
      patient.bedNo,
      patient.careType || 'Admission',
      patient.acType || ''
    );
    const category = await ChargeCategory.findOne({
      name: String(particular).trim(),
      ...scope,
    });

    const rate = category
      ? Number(category.ratePerDay) || 0
      : Number(req.body.ratePerDay) || 0;

    const charge = {
      particular: String(particular).trim(),
      days: chargeDays,
      ratePerDay: rate,
      amount: computeAmount({ days: chargeDays, ratePerDay: rate }),
      note: note || '',
      date: date || new Date(),
      autoDays: false,
    };

    if (charge.amount <= 0) {
      return res.status(400).json({
        message:
          rate <= 0
            ? 'This category has no daily rate — set a rate in Charge Category first'
            : 'Charge amount must be greater than 0',
      });
    }

    patient.charges.push(charge);
    await patient.save();
    const { days: billableDays } = applyBillableDaysToPatient(patient);
    res.status(201).json(withBillableDays(patient, billableDays));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCharge = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.status === 'discharged') {
      return res.status(400).json({ message: 'Cannot modify charges of a discharged patient' });
    }

    const charge = patient.charges.id(req.params.chargeId);
    if (!charge) {
      return res.status(404).json({ message: 'Charge not found' });
    }

    const { days, ratePerDay, amount, note } = req.body;

    if (ratePerDay !== undefined) charge.ratePerDay = Number(ratePerDay) || 0;
    if (note !== undefined) charge.note = note;

    const rate = Number(charge.ratePerDay) || 0;
    if (rate > 0) {
      // Daily-rate lines follow the noon cutoff — days are not manually overridden
      const { days: billable } = applyBillableDaysToPatient(patient);
      charge.days = billable;
      charge.amount = billable * rate;
    } else {
      if (days !== undefined) charge.days = Number(days) || 0;
      if (amount !== undefined) {
        charge.amount = Number(amount) || 0;
      } else {
        charge.amount = computeAmount({
          days: charge.days,
          ratePerDay: charge.ratePerDay,
          amount: charge.amount,
        });
      }
    }

    if (charge.amount < 0) {
      return res.status(400).json({ message: 'Charge amount cannot be negative' });
    }

    const billableDays = await syncBillableDays(patient);
    res.json(withBillableDays(patient, billableDays));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.removeCharge = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.status === 'discharged') {
      return res.status(400).json({ message: 'Cannot modify charges of a discharged patient' });
    }

    const charge = patient.charges.id(req.params.chargeId);
    if (!charge) {
      return res.status(404).json({ message: 'Charge not found' });
    }

    const rate = Number(charge.ratePerDay) || 0;
    const permanent = String(req.query.permanent || '') === 'true';

    // Daily auto-charges: stop & freeze days used so far (keep on bill for discharge)
    if (rate > 0 && charge.autoDays !== false && !charge.stoppedAt && !permanent) {
      stopDailyCharge(patient, charge);
      const billableDays = await syncBillableDays(patient);
      return res.json(withBillableDays(patient, billableDays));
    }

    // Flat charges, already-stopped lines, or explicit permanent delete
    charge.deleteOne();
    const billableDays = await syncBillableDays(patient);
    res.json(withBillableDays(patient, billableDays));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Stop several active daily charges at once */
exports.batchStopCharges = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    if (patient.status === 'discharged') {
      return res.status(400).json({ message: 'Cannot modify charges of a discharged patient' });
    }

    const ids = Array.isArray(req.body.chargeIds)
      ? [...new Set(req.body.chargeIds.map((id) => String(id)))]
      : [];
    if (!ids.length) {
      return res.status(400).json({ message: 'Select at least one charge to stop' });
    }

    const stopAt = new Date();
    let stopped = 0;
    for (const id of ids) {
      const charge = patient.charges.id(id);
      if (!charge) continue;
      if (stopDailyCharge(patient, charge, stopAt)) stopped += 1;
    }

    if (stopped === 0) {
      return res.status(400).json({
        message: 'No active daily charges were stopped (select active charges)',
      });
    }

    const { days } = applyBillableDaysToPatient(patient);
    await patient.save();
    res.json(withBillableDays(patient, days));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Resume a stopped daily charge: keep frozen line, start a new auto period from now */
exports.resumeCharge = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.status === 'discharged') {
      return res.status(400).json({ message: 'Cannot modify charges of a discharged patient' });
    }

    const charge = patient.charges.id(req.params.chargeId);
    if (!charge) {
      return res.status(404).json({ message: 'Charge not found' });
    }

    const rate = Number(charge.ratePerDay) || 0;
    if (rate <= 0) {
      return res.status(400).json({
        message: 'Only daily-rate charges can be activated again',
      });
    }

    if (!charge.stoppedAt && charge.autoDays !== false) {
      return res.status(400).json({
        message: 'This charge is already active',
      });
    }

    if (hasActiveParticular(patient, charge.particular, charge._id)) {
      return res.status(400).json({
        message: `"${charge.particular}" is already active on this bill`,
      });
    }

    if (!resumeDailyCharge(patient, charge)) {
      return res.status(400).json({ message: 'Could not activate this charge' });
    }

    const { days } = applyBillableDaysToPatient(patient);
    await patient.save();
    res.status(201).json(withBillableDays(patient, days));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/** Activate several stopped daily charges at once */
exports.batchResumeCharges = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    if (patient.status === 'discharged') {
      return res.status(400).json({ message: 'Cannot modify charges of a discharged patient' });
    }

    const ids = Array.isArray(req.body.chargeIds)
      ? [...new Set(req.body.chargeIds.map((id) => String(id)))]
      : [];
    if (!ids.length) {
      return res.status(400).json({ message: 'Select at least one charge to activate' });
    }

    const now = new Date();
    let resumed = 0;
    const skipped = [];
    for (const id of ids) {
      const charge = patient.charges.id(id);
      if (!charge) continue;
      if (!charge.stoppedAt || !(Number(charge.ratePerDay) > 0)) {
        skipped.push(charge.particular || id);
        continue;
      }
      if (hasActiveParticular(patient, charge.particular, charge._id)) {
        skipped.push(charge.particular);
        continue;
      }
      if (resumeDailyCharge(patient, charge, now)) resumed += 1;
    }

    if (resumed === 0) {
      return res.status(400).json({
        message: skipped.length
          ? `None activated. Already active or not stopped: ${[...new Set(skipped)].join(', ')}`
          : 'No stopped daily charges were activated',
      });
    }

    const { days } = applyBillableDaysToPatient(patient);
    await patient.save();
    res.status(201).json(withBillableDays(patient, days));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.dischargePatient = async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    if (patient.status === 'discharged') {
      return res.status(400).json({ message: 'Patient already discharged' });
    }

    const {
      dischargeDate,
      dischargeTime,
      dischargeType,
      amountReceived,
      advance,
      principleDiagnosis,
      associateDiagnosis,
      historyExamination,
      investigation,
      managementHospitalCourse,
      medicines,
      followUpDate,
      followUpDay,
      followUpTime,
      patientType,
    } = req.body;

    const allowedDischargeTypes = ['DOR', 'LAMA', 'Referral'];
    if (!allowedDischargeTypes.includes(dischargeType)) {
      return res.status(400).json({
        message: 'Discharge type is required (DOR, LAMA, or Referral)',
      });
    }

    const nextDischargeDate = dischargeDate || new Date();
    const nextDischargeTime = dischargeTime || '';
    const dischargeEnd =
      combineDateAndTime(nextDischargeDate, nextDischargeTime) ||
      new Date(nextDischargeDate);
    const { days: billableDays } = applyBillableDaysToPatient(patient, dischargeEnd);

    if (advance !== undefined) patient.advance = Number(advance) || 0;

    if (!Array.isArray(patient.paymentHistory)) {
      patient.paymentHistory = [];
    }
    if (
      patient.paymentHistory.length === 0 &&
      Number(patient.amountReceived) > 0
    ) {
      patient.paymentHistory.push({
        amount: Number(patient.amountReceived),
        receivedAt: patient.updatedAt || new Date(),
        note: 'Previous total (before payment history)',
      });
    }

    if (amountReceived !== undefined && Number(amountReceived) > 0) {
      patient.paymentHistory.push({
        amount: Number(amountReceived),
        receivedAt: dischargeEnd || new Date(),
        note: 'Received at discharge',
      });
    }
    refreshAmountReceivedTotal(patient);

    const remainingDue =
      netChargesTotal(patient) -
      (Number(patient.advance) || 0) -
      (Number(patient.amountReceived) || 0);
    if (remainingDue > 0.009) {
      return res.status(400).json({
        message: `Cannot discharge until all dues are cleared. Remaining balance: Rs. ${remainingDue.toFixed(2)}`,
      });
    }

    patient.status = 'discharged';
    patient.dischargeDate = nextDischargeDate;
    patient.dischargeTime = nextDischargeTime;
    patient.dischargeType = dischargeType;
    patient.principleDiagnosis = principleDiagnosis || '';
    patient.associateDiagnosis = associateDiagnosis || '';
    patient.historyExamination = historyExamination || '';
    patient.investigation = investigation || '';
    patient.managementHospitalCourse = managementHospitalCourse || '';
    patient.followUpDate = followUpDate || '';
    patient.followUpDay = followUpDay || '';
    patient.followUpTime = followUpTime || '';
    if (patientType !== undefined) patient.patientType = patientType || '';

    if (Array.isArray(medicines)) {
      patient.medicines = medicines
        .filter((m) => m && (m.name || m.dose || m.timing || m.duration))
        .map((m) => ({
          name: m.name || '',
          dose: m.dose || '',
          timing: m.timing || '',
          duration: m.duration || '',
        }));
    }

    if (!patient.billNo) {
      const count = await Patient.countDocuments({ status: 'discharged' });
      patient.billNo = `BILL-${String(count + 1).padStart(5, '0')}`;
    }

    await patient.save();
    res.json(withBillableDays(patient, billableDays));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [admitted, discharged, total] = await Promise.all([
      Patient.countDocuments({ status: 'admitted' }),
      Patient.countDocuments({ status: 'discharged' }),
      Patient.countDocuments(),
    ]);
    res.json({ admitted, discharged, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getEarnings = async (req, res) => {
  try {
    const filter = {};
    const { startDate, endDate } = req.query;
    if (startDate || endDate) {
      filter.admissionDate = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.admissionDate.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.admissionDate.$lte = end;
      }
    }

    const patients = await Patient.find(filter)
      .select(
        'name hospitalRegNo bedNo status charges advance discountType discountValue amountReceived admissionDate admissionTime dischargeDate dischargeTime'
      )
      .sort({ createdAt: -1 });

    let totalEarnings = 0;
    let totalAdvance = 0;
    let totalReceived = 0;
    let totalDiscount = 0;

    const list = patients.map((patient) => {
      applyBillableDaysToPatient(patient);
      const gross = chargesTotal(patient);
      const discount = patientDiscountAmount(patient);
      const net = Math.max(0, gross - discount);
      const advance = Number(patient.advance) || 0;
      const amountReceived = Number(patient.amountReceived) || 0;

      totalEarnings += net;
      totalAdvance += advance;
      totalReceived += amountReceived;
      totalDiscount += discount;

      return {
        _id: patient._id,
        name: patient.name,
        hospitalRegNo: patient.hospitalRegNo,
        bedNo: patient.bedNo || '',
        status: patient.status,
        chargesTotal: gross,
        discount,
        discountType: patient.discountType || '',
        discountValue: Number(patient.discountValue) || 0,
        advance,
        amountReceived,
        balance: net - advance,
        charges: (patient.charges || []).map((c) => ({
          _id: c._id,
          particular: c.particular,
          days: c.days,
          ratePerDay: c.ratePerDay,
          amount: c.amount,
        })),
      };
    });

    res.json({
      totalEarnings,
      totalAdvance,
      totalReceived,
      totalDiscount,
      patientCount: list.length,
      patients: list,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
