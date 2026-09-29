require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const User = require('./models/User');
const authRoutes = require('./routes/authRoutes');
const patientRoutes = require('./routes/patientRoutes');

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

const start = async () => {
  await connectDB();
  await ensureAdmin();

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ message: 'Aziza Husseni Hospital Portal API' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/patients', patientRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Server error' });
  });

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
};

start();
