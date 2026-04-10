const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/hotels', require('./routes/hotelRoutes'));
app.use('/api/rooms', require('./routes/roomRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/feedback', require('./routes/feedbackRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));

app.get('/', (req, res) => {
  res.json({ message: 'Hotel Booking API dang chay voi SQL Server!' });
});

const PORT = process.env.PORT || 4000;

async function startServer() {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server chay tai http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Khoi dong server that bai:', error.message);
    process.exit(1);
  }
}

startServer();
