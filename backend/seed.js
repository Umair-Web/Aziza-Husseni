require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const email = 'admin@azizahusseni.com';
    const existing = await User.findOne({ email });

    if (existing) {
      console.log('Admin user already exists:', email);
    } else {
      await User.create({
        name: 'Admin',
        email,
        password: 'admin123',
        role: 'admin',
      });
      console.log('Admin user created');
    }

    console.log('Email: admin@azizahusseni.com');
    console.log('Password: admin123');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error(error.message);
    console.error('Make sure MongoDB is running at MONGODB_URI');
    process.exit(1);
  }
};

seed();
