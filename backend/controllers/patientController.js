const Patient = require('../models/Patient');

const BILL_PARTICULARS = [
  'Bed/Room Charges',
  'R.M.O. Consultation',
  'Medicines & Injections',
  'Consultation',
  'Incubator Care',
  'Cot Care',
  'Oxygen Inhalation',
  'Phototherapy unit',
  'Laboratory',
  'Blood Transfusion / Blood Exchange',
  'Ventilation',
  'Resuscitation',
  'Drip Transfusion',
  'NICU Monitoring',
  'Umbilical Catheterization',
  'Others',
];

const computeAmount = (item) => {
  if (item.days > 0 && item.ratePerDay > 0) {
    return Number(item.days) * Number(item.ratePerDay);
  }
  return Number(item.amount) || 0;
};

exports.getParticulars = (req, res) => {
  res.json(BILL_PARTICULARS);
};

exports.getPatients = async (req, res) => {
  try {
    const { status, search } = req.query;
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
    res.json(patient);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPatient = async (req, res) => {
  try {
    const {
      hospitalRegNo,
      bedNo,
      name,
      relativeOf,
      age,
      address,
      telNo,
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
    } = req.body;

    if (!hospitalRegNo || !name || age === undefined || !admissionDate) {
      return res.status(400).json({
        message: 'Hospital Reg No, Name, Age and Admission Date are required',
      });
    }

    const exists = await Patient.findOne({ hospitalRegNo: hospitalRegNo.trim() });
    if (exists) {
      return res.status(400).json({ message: 'Hospital Registration No. already exists' });
    }

    const patient = await Patient.create({
      hospitalRegNo: hospitalRegNo.trim(),
      bedNo,
      name,
      relativeOf,
      age,
      address,
      telNo,
      admissionDate,
      admissionTime,
      dutyRmo,
      consultant,
      diagnosis,
      payerName,
      payerAddress,
      payerTelNo,
      advance: Number(advance) || 0,
      ipd: ipd || hospitalRegNo.trim(),
      createdBy: req.user._id,
    });

    res.status(201).json(patient);
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

    if (patient.status === 'discharged') {
      return res.status(400).json({ message: 'Cannot update a discharged patient' });
    }

    const fields = [
      'bedNo',
      'name',
      'relativeOf',
      'age',
      'address',
      'telNo',
      'admissionDate',
      'admissionTime',
      'dutyRmo',
      'consultant',
      'diagnosis',
      'payerName',
      'payerAddress',
      'payerTelNo',
      'advance',
      'ipd',
    ];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        patient[field] = req.body[field];
      }
    });

    await patient.save();
    res.json(patient);
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

    const { particular, days, ratePerDay, amount, note, date } = req.body;

    if (!particular) {
      return res.status(400).json({ message: 'Particular is required' });
    }

    const charge = {
      particular,
      days: Number(days) || 0,
      ratePerDay: Number(ratePerDay) || 0,
      amount: computeAmount({ days, ratePerDay, amount }),
      note: note || '',
      date: date || new Date(),
    };

    if (charge.amount <= 0) {
      return res.status(400).json({ message: 'Charge amount must be greater than 0' });
    }

    patient.charges.push(charge);
    await patient.save();
    res.status(201).json(patient);
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

    charge.deleteOne();
    await patient.save();
    res.json(patient);
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

    const { dischargeDate, dischargeTime, amountReceived, advance } = req.body;

    patient.status = 'discharged';
    patient.dischargeDate = dischargeDate || new Date();
    patient.dischargeTime = dischargeTime || '';
    if (advance !== undefined) patient.advance = Number(advance) || 0;
    if (amountReceived !== undefined) {
      patient.amountReceived = Number(amountReceived) || 0;
    } else {
      const total = patient.charges.reduce((s, c) => s + c.amount, 0);
      patient.amountReceived = total - (patient.advance || 0);
    }

    if (!patient.billNo) {
      const count = await Patient.countDocuments({ status: 'discharged' });
      patient.billNo = `BILL-${String(count + 1).padStart(5, '0')}`;
    }

    await patient.save();
    res.json(patient);
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
