import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import HotelDetail from './pages/HotelDetail';
import BookingPage from './pages/BookingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import MyBookings from './pages/MyBookings';
import Profile from './pages/Profile';
import Dashboard from './pages/admin/Dashboard';
import AdminHotels from './pages/admin/Hotels';
import AdminRooms from './pages/admin/Rooms';
import AdminBookings from './pages/admin/Bookings';
import AdminUsers from './pages/admin/Users';
import AdminFeedbacks from './pages/admin/Feedbacks';
import AdminRoute from './components/AdminRoute';
import { ThemeProvider } from './context/ThemeContext';

/**
 * App Component - "Xương sống" của giao diện Frontend.
 * Tại đây chúng ta bọc ứng dụng bởi các Provider (Cung cấp state toàn cục) 
 * và định nghĩa các đường dẫn (Routes) chuyển trang.
 */
function App() {
  return (
    // AuthProvider: Cung cấp thông tin User đăng nhập cho toàn bộ app
    <AuthProvider>
      {/* ThemeProvider: Cung cấp trạng thái Sáng/Tối cho giao diện */}
      <ThemeProvider>
        {/* BrowserRouter: Cho phép React xử lý chuyển trang mà không cần tải lại web (Single Page Application) */}
        <BrowserRouter>
          <div className="flex min-h-screen flex-col transition-colors duration-300">
            {/* Navbar luôn hiển thị ở trên cùng mọi trang */}
            <Navbar />
            
            <main className="flex-1">
              <Routes>
                {/* === CÁC TRANG DÀNH CHO KHÁCH (GUEST/USER) === */}
                <Route path="/" element={<Home />} />
                <Route path="/hotels" element={<Home />} />
                <Route path="/hotels/:id" element={<HotelDetail />} />
                <Route path="/book/:hotelId/:roomId" element={<BookingPage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/my-bookings" element={<MyBookings />} />
                <Route path="/profile" element={<Profile />} />
                
                {/* === CÁC TRANG DÀNH CHO QUẢN TRỊ VIÊN (ADMIN) === */}
                {/* AdminRoute là một Guard component, tự động chặn nếu không phải admin */}
                <Route element={<AdminRoute />}>
                  <Route path="/admin" element={<Dashboard />} />
                  <Route path="/admin/hotels" element={<AdminHotels />} />
                  <Route path="/admin/rooms" element={<AdminRooms />} />
                  <Route path="/admin/bookings" element={<AdminBookings />} />
                  <Route path="/admin/feedbacks" element={<AdminFeedbacks />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                </Route>
              </Routes>
            </main>

            {/* Footer luôn hiển thị ở dưới cùng mọi trang */}
            <Footer />
          </div>
        </BrowserRouter>
      </ThemeProvider>
    </AuthProvider>
  );
}

export default App;
