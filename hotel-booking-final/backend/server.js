const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectDB } = require('./config/db');

// Khởi tạo ứng dụng Express (đóng vai trò là Web Server)
const app = express();

// Sử dụng middleware CORS để cho phép Frontend (ví dụ React chạy ở cổng 3000) gọi API tới Backend
app.use(cors());

// Middleware giúp server hiểu được dữ liệu gửi lên dưới dạng JSON
app.use(express.json());

// === ĐỊNH TUYẾN CÁC API (ROUTES) ===
// Gắn các route tương ứng với từng chức năng vào server
app.use('/api/auth', require('./routes/authRoutes'));       // Xử lý đăng nhập, đăng ký
app.use('/api/users', require('./routes/userRoutes'));      // Quản lý thông tin người dùng
app.use('/api/hotels', require('./routes/hotelRoutes'));    // Lấy danh sách, thêm/sửa/xóa khách sạn
app.use('/api/rooms', require('./routes/roomRoutes'));      // Quản lý phòng trong khách sạn
app.use('/api/bookings', require('./routes/bookingRoutes')); // Quản lý luồng đặt phòng
app.use('/api/feedback', require('./routes/feedbackRoutes')); // Đánh giá khách sạn
app.use('/api/admin', require('./routes/adminRoutes'));      // Các API dành riêng cho quản trị viên

// Route mặc định để kiểm tra xem server có đang hoạt động hay không
app.get('/', (req, res) => {
  res.json({ message: 'Hotel Booking API dang chay voi SQL Server!' });
});

// Lấy port từ biến môi trường, mặc định là 4000 nếu không có
const PORT = process.env.PORT || 4000;

/**
 * Hàm khởi động Server
 * Bao gồm việc kết nối đến Cơ sở dữ liệu trước khi cho phép Server lắng nghe các request.
 */
async function startServer() {
  try {
    // 1. Kết nối đến SQL Server
    await connectDB();
    
    // 2. Nếu kết nối thành công, bắt đầu mở port để nhận request
    app.listen(PORT, () => {
      console.log(`Server chay tai http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Khoi dong server that bai:', error.message);
    process.exit(1); // Dừng chương trình nếu lỗi
  }
}

// Bắt đầu chạy ứng dụng
startServer();
