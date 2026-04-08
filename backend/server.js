const express = require('express');
const cors = require('cors');
require('dotenv').config();
const connectDB = require('./config/db');

const app = express();

// Kết nối MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/hotels', require('./routes/hotelRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));

// Test route
app.get('/', (req, res) => res.json({ message: '✅ Hotel Booking API đang chạy!' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server chạy tại http://localhost:${PORT}`));