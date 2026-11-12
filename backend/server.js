require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User');
const Patient = require('./models/Patient');
const Referral = require('./models/Referral');
const ChargeCategory = require('./models/ChargeCategory');
const Terminology = require('./models/Terminology');
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');
const referralRoutes = require('./routes/referralRoutes');
const chargeCategoryRoutes = require('./routes/chargeCategoryRoutes');
const expenseCategoryRoutes = require('./routes/expenseCategoryRoutes');
const expenseRoutes = require('./routes/expenseRoutes');
const terminologyRoutes = require('./routes/terminologyRoutes');
const clinicalStaffRoutes = require('./routes/clinicalStaffRoutes');

const DEFAULT_MEDICINE_TIMINGS = [
  '1+0+0',
  '0+1+0',
  '0+0+1',
  '1+0+1',
  '1+1+0',
  '0+1+1',
  '1+1+1',
  '1+1+1+1',
  '2+0+0',
  '0+0+2',
  '2+0+2',
  '1+1+1+1+1+1',
  'OD',
  'BD',
  'TDS',
  'QID',
  'SOS',
  'STAT',
  'HS',
  'PRN',
];

const DEFAULT_REFERRALS = ['OPD', 'ER', 'Person', 'Hospital'];

const DEFAULT_CHARGE_NAMES = [
  { name: 'Bed/Room Charges', ratePerDay: 2000, autoAttach: false },
  { name: 'R.M.O. Consultation', ratePerDay: 500, autoAttach: false },
  { name: 'Medicines & Injections', ratePerDay: 0, autoAttach: false },
  { name: 'Consultation', ratePerDay: 1500, autoAttach: true },
  { name: 'Incubator Care', ratePerDay: 3000, autoAttach: true },
  { name: 'Cot Care', ratePerDay: 1500, autoAttach: false },
  { name: 'Oxygen Inhalation', ratePerDay: 1000, autoAttach: true },
  { name: 'Phototherapy unit', ratePerDay: 2000, autoAttach: false },
  { name: 'Laboratory', ratePerDay: 0, autoAttach: false },
  { name: 'Blood Transfusion / Blood Exchange', ratePerDay: 5000, autoAttach: false },
  { name: 'Ventilation', ratePerDay: 5000, autoAttach: true },
  { name: 'Resuscitation', ratePerDay: 3000, autoAttach: false },
  { name: 'Drip Transfusion', ratePerDay: 500, autoAttach: false },
  { name: 'NICU Monitoring', ratePerDay: 4000, autoAttach: false },
  { name: 'Umbilical Catheterization', ratePerDay: 2500, autoAttach: false },
  { name: 'Others', ratePerDay: 0, autoAttach: false },
];

const DEFAULT_CHARGE_SCOPES = [
  { unit: 'NICU', subType: 'Admission', acType: '' },
  { unit: 'NICU', subType: 'Observation', acType: '' },
  { unit: 'PICU', subType: 'Admission', acType: '' },
  // Ward Admission: shared charges for both With AC and Without AC
  { unit: 'Ward', subType: 'Admission', acType: '' },
];

const DEFAULT_CHARGE_CATEGORIES = DEFAULT_CHARGE_SCOPES.flatMap((scope) =>
  DEFAULT_CHARGE_NAMES.map((item) => ({ ...item, ...scope }))
);

const ensureAdmin = async () => {
  const count = await User.countDocuments();
  if (count === 0) {
    await User.create({
      name: 'Admin',
      email: 'admin@azizahusseni.com',
      password: 'admin123',
      role: 'admin',
    });
    console.log('Default admin created: admin@azizahusseni.com / admin123');
  }
};

const ensureRegistrationUser = async () => {
  const email = 'user1@azizahusseni.com';
  const existing = await User.findOne({
    $or: [
      { email },
      { username: 'user1' },
      { username: 'AHHUser1' },
      { email: 'user1@gmail.com' },
      { email: 'ahhuser1@azizahusseni.com' },
    ],
  });

  if (existing) {
    // Keep existing credentials; only ensure role/identity defaults if missing
    let changed = false;
    if (existing.role !== 'registration') {
      existing.role = 'registration';
      changed = true;
    }
    if (!existing.username) {
      existing.username = 'user1';
      changed = true;
    }
    if (changed) await existing.save();
    console.log('Registration user ready:', existing.email || email);
    return;
  }

  await User.create({
    name: 'AHH User 1',
    username: 'user1',
    email,
    password: 'user123',
    role: 'registration',
  });
  console.log('Registration user created: user1@azizahusseni.com / user123');
};

const ensureClinicianUser = async () => {
  const email = 'clinicain1@azizahusseni.com';
  const existing = await User.findOne({
    $or: [{ email }, { username: 'clinicain1' }],
  });

  if (existing) {
    // Keep existing credentials; only ensure role/identity defaults if missing
    let changed = false;
    if (existing.role !== 'clinician') {
      existing.role = 'clinician';
      changed = true;
    }
    if (!existing.username) {
      existing.username = 'clinicain1';
      changed = true;
    }
    if (!existing.name) {
      existing.name = 'Clinician 1';
      changed = true;
    }
    if (changed) await existing.save();
    console.log('Clinician user ready:', existing.email || email);
    return;
  }

  await User.create({
    name: 'Clinician 1',
    username: 'clinicain1',
    email,
    password: 'clinicain123',
    role: 'clinician',
  });
  console.log('Clinician user created: clinicain1@azizahusseni.com / clinicain123');
};

const ensureReferrals = async () => {
  for (const name of DEFAULT_REFERRALS) {
    await Referral.updateOne({ name }, { name }, { upsert: true });
  }
};

const ensureDefaultTimings = async () => {
  for (const text of DEFAULT_MEDICINE_TIMINGS) {
    await Terminology.updateOne(
      { type: 'medicineTiming', text },
      { type: 'medicineTiming', text },
      { upsert: true }
    );
  }
};

const ensureChargeCategories = async () => {
  // Drop legacy unique-on-name index if present (name is unique per unit+subType+acType now)
  try {
    await ChargeCategory.collection.dropIndex('name_1');
    console.log('Dropped legacy ChargeCategory name_1 index');
  } catch (err) {
    if (err.code !== 27 && err.codeName !== 'IndexNotFound') {
      // ignore missing index; log other issues lightly
    }
  }
  try {
    await ChargeCategory.collection.dropIndex('name_1_unit_1_subType_1');
    console.log('Dropped legacy ChargeCategory name_1_unit_1_subType_1 index');
  } catch (err) {
    if (err.code !== 27 && err.codeName !== 'IndexNotFound') {
      // ignore missing index
    }
  }

  // Backfill unit/subType on any legacy categories missing them
  await ChargeCategory.updateMany(
    { $or: [{ unit: { $exists: false } }, { unit: null }, { unit: '' }] },
    { $set: { unit: 'NICU', subType: 'Admission' } }
  );
  await ChargeCategory.updateMany(
    { $or: [{ subType: { $exists: false } }, { subType: null }, { subType: '' }] },
    { $set: { subType: 'Admission' } }
  );
  await ChargeCategory.updateMany(
    {
      unit: { $ne: 'Ward' },
      $or: [{ acType: { $exists: false } }, { acType: null }],
    },
    { $set: { acType: '' } }
  );

  // Ward: shared charges for both AC options; only "AC Charges" stays as With-AC add-on
  await ChargeCategory.updateMany(
    {
      unit: 'Ward',
      name: { $ne: 'AC Charges' },
      acType: { $in: ['With AC', 'Without AC'] },
    },
    { $set: { acType: '' } }
  );
  await ChargeCategory.updateMany(
    {
      unit: 'Ward',
      name: 'AC Charges',
    },
    { $set: { acType: 'With AC' } }
  );
  await ChargeCategory.updateMany(
    {
      unit: 'Ward',
      $or: [{ acType: { $exists: false } }, { acType: null }],
    },
    { $set: { acType: '' } }
  );
  // Drop any old Without-AC-only duplicates (no longer used)
  await ChargeCategory.deleteMany({ unit: 'Ward', acType: 'Without AC' });

  try {
    await ChargeCategory.syncIndexes();
  } catch (err) {
    console.warn('ChargeCategory syncIndexes:', err.message);
  }

  // Seed defaults only once (empty collection). Do not re-create categories after delete.
  const existingCount = await ChargeCategory.countDocuments();
  if (existingCount === 0) {
    await ChargeCategory.insertMany(DEFAULT_CHARGE_CATEGORIES);
    await ChargeCategory.create({
      name: 'AC Charges',
      unit: 'Ward',
      subType: 'Admission',
      acType: 'With AC',
      ratePerDay: 2000,
      autoAttach: true,
    });
    console.log(
      `Seeded ${DEFAULT_CHARGE_CATEGORIES.length + 1} default charge categories`
    );
    return;
  }

  // If other scopes are empty, clone from NICU Admission once (rates can be edited later)
  const source = await ChargeCategory.find({
    unit: 'NICU',
    subType: 'Admission',
    acType: '',
  }).lean();
  if (!source.length) return;

  for (const scope of DEFAULT_CHARGE_SCOPES) {
    if (scope.unit === 'NICU' && scope.subType === 'Admission' && !scope.acType) {
      continue;
    }
    const count = await ChargeCategory.countDocuments({
      unit: scope.unit,
      subType: scope.subType,
      acType: scope.acType || '',
    });
    if (count > 0) continue;
    await ChargeCategory.insertMany(
      source.map((item) => ({
        name: item.name,
        ratePerDay: item.ratePerDay,
        autoAttach: Boolean(item.autoAttach),
        unit: scope.unit,
        subType: scope.subType,
        acType: scope.acType || '',
      }))
    );
    console.log(`Cloned charge categories to ${scope.unit} ${scope.subType}`);
  }

  // Ensure Ward has AC Charges as a With-AC add-on
  const wardAcCount = await ChargeCategory.countDocuments({
    unit: 'Ward',
    subType: 'Admission',
    name: 'AC Charges',
    acType: 'With AC',
  });
  if (wardAcCount === 0) {
    const anyWard = await ChargeCategory.countDocuments({
      unit: 'Ward',
      subType: 'Admission',
    });
    if (anyWard > 0) {
      await ChargeCategory.create({
        name: 'AC Charges',
        unit: 'Ward',
        subType: 'Admission',
        acType: 'With AC',
        ratePerDay: 2000,
        autoAttach: true,
      });
      console.log('Added Ward Admission AC Charges add-on');
    }
  }
};

const ensurePatientAcTypes = async () => {
  const result = await Patient.updateMany(
    {
      bedNo: 'Ward',
      $or: [{ acType: { $exists: false } }, { acType: null }, { acType: '' }],
    },
    { $set: { acType: 'With AC' } }
  );
  if (result.modifiedCount > 0) {
    console.log(`Backfilled acType=With AC on ${result.modifiedCount} Ward patient(s)`);
  }
  await Patient.updateMany(
    { bedNo: { $ne: 'Ward' }, acType: { $nin: ['', null] } },
    { $set: { acType: '' } }
  );
};

const start = async () => {
  await connectDB();
  await ensureAdmin();
  await ensureRegistrationUser();
  await ensureClinicianUser();
  await ensureReferrals();
  await ensureDefaultTimings();
  await ensureChargeCategories();
  await ensurePatientAcTypes();

  const app = express();
  app.use(cors());
  // Slip images (base64 PNG) for WhatsApp exceed the default 100kb limit
  app.use(express.json({ limit: '15mb' }));

  app.get('/', (req, res) => {
    res.json({ message: 'Aziza Husseni Hospital Portal API' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', require('./routes/userRoutes'));
  app.use('/api/patients', patientRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/charge-categories', chargeCategoryRoutes);
  app.use('/api/expense-categories', expenseCategoryRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/terminologies', terminologyRoutes);
  app.use('/api/clinical-staff', clinicalStaffRoutes);
  app.use('/api/whatsapp', require('./routes/whatsappRoutes'));

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Server error' });
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start();
