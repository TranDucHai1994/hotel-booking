import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHotel, FaUser, FaSignOutAlt, FaSignInAlt } from 'react-icons/fa';
import { MdDashboard } from 'react-icons/md';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 text-blue-600 font-bold text-xl">
          <FaHotel className="text-2xl" />
          <span>HotelBooking</span>
        </Link>

        {/* Nav Links */}
        <div className="flex items-center gap-3">
          <Link to="/hotels" className="text-gray-600 hover:text-blue-600 font-medium transition text-sm">
            Khách sạn
          </Link>

          {user ? (
            <>
              <Link to="/my-bookings"
                className="text-gray-600 hover:text-blue-600 font-medium transition text-sm">
                Đặt phòng của tôi
              </Link>

              {user.role === 'admin' && (
                <Link to="/admin"
                  className="flex items-center gap-1 bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition text-sm font-medium">
                  <MdDashboard /> Admin
                </Link>
              )}

              {/* Dropdown Profile */}
              <div className="relative group">
                <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-lg transition">
                  <div className="bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                    {user.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-gray-700 text-sm font-medium">{user.full_name}</span>
                </button>

                {/* Dropdown menu */}
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                  <Link to="/profile"
                    className="flex items-center gap-2 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-t-xl text-sm">
                    <FaUser className="text-blue-500" /> Tài khoản của tôi
                  </Link>
                  <Link to="/my-bookings"
                    className="flex items-center gap-2 px-4 py-3 text-gray-700 hover:bg-gray-50 text-sm">
                    🏨 Đặt phòng của tôi
                  </Link>
                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-3 text-red-500 hover:bg-red-50 rounded-b-xl text-sm">
                    <FaSignOutAlt /> Đăng xuất
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link to="/login"
                className="flex items-center gap-1 text-gray-600 hover:text-blue-600 font-medium transition text-sm">
                <FaSignInAlt /> Đăng nhập
              </Link>
              <Link to="/register"
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition font-medium text-sm">
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}