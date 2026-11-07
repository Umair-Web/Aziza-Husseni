require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User');
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
  { unit: 'NICU', subType: 'Admission' },
  { unit: 'NICU', subType: 'Observation' },
  { unit: 'PICU', subType: 'Admission' },
  { unit: 'Ward', subType: 'Admission' },
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
    existing.role = 'registration';
    existing.email = email;
    existing.username = 'user1';
    existing.password = 'user123';
    await existing.save();
    console.log('Registration user ready: user1@azizahusseni.com / user123');
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
    existing.role = 'clinician';
    existing.email = email;
    existing.username = 'clinicain1';
    existing.name = existing.name || 'Clinician 1';
    existing.password = 'clinicain123';
    await existing.save();
    console.log('Clinician user ready: clinicain1@azizahusseni.com / clinicain123');
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
  // Drop legacy unique-on-name index if present (name is unique per unit+subType now)
  try {
    await ChargeCategory.collection.dropIndex('name_1');
    console.log('Dropped legacy ChargeCategory name_1 index');
  } catch (err) {
    if (err.code !== 27 && err.codeName !== 'IndexNotFound') {
      // ignore missing index; log other issues lightly
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

  try {
    await ChargeCategory.syncIndexes();
  } catch (err) {
    console.warn('ChargeCategory syncIndexes:', err.message);
  }

  // Seed defaults only once (empty collection). Do not re-create categories after delete.
  const existingCount = await ChargeCategory.countDocuments();
  if (existingCount === 0) {
    await ChargeCategory.insertMany(DEFAULT_CHARGE_CATEGORIES);
    console.log(
      `Seeded ${DEFAULT_CHARGE_CATEGORIES.length} default charge categories`
    );
    return;
  }

  // If other scopes are empty, clone from NICU Admission once (rates can be edited later)
  const source = await ChargeCategory.find({
    unit: 'NICU',
    subType: 'Admission',
  }).lean();
  if (!source.length) return;

  for (const scope of DEFAULT_CHARGE_SCOPES) {
    if (scope.unit === 'NICU' && scope.subType === 'Admission') continue;
    const count = await ChargeCategory.countDocuments(scope);
    if (count > 0) continue;
    await ChargeCategory.insertMany(
      source.map((item) => ({
        name: item.name,
        ratePerDay: item.ratePerDay,
        autoAttach: Boolean(item.autoAttach),
        unit: scope.unit,
        subType: scope.subType,
      }))
    );
    console.log(`Cloned charge categories to ${scope.unit} ${scope.subType}`);
  }
};

const start = async () => {
  await connectDB();
  await ensureAdmin();
  await ensureRegistrationUser();
  await ensureClinicianUser();
  await ensureReferrals();
  await ensureDefaultTimings();
  await ensureChargeCategories();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ message: 'Aziza Husseni Hospital Portal API' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/referrals', referralRoutes);
  app.use('/api/charge-categories', chargeCategoryRoutes);
  app.use('/api/expense-categories', expenseCategoryRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/terminologies', terminologyRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Server error' });
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start();
