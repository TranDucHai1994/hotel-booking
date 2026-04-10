import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FaHotel, FaMoon, FaSignInAlt, FaSignOutAlt, FaSun, FaUser } from 'react-icons/fa';
import { MdDashboard } from 'react-icons/md';
import { useTheme } from '../context/ThemeContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-4">
        <Link to="/" className="flex items-center gap-3 text-blue-700">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <FaHotel className="text-lg" />
          </div>
          <div>
            <div className="text-lg font-black tracking-tight">HotelBooking</div>
            <div className="text-xs text-slate-400">Smart search, guest mode and booking insights</div>
          </div>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-blue-700"
          >
            {isDark ? <FaSun className="text-amber-500" /> : <FaMoon className="text-slate-500" />}
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>

          <Link to="/hotels" className="text-sm font-semibold text-slate-600 transition hover:text-blue-700">
            Khách sạn
          </Link>

          {!user && (
            <Link
              to="/hotels"
              className="rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
            >
              Guest Mode: Đặt nhanh không cần tài khoản
            </Link>
          )}

          {user ? (
            <>
              <Link to="/my-bookings" className="text-sm font-semibold text-slate-600 transition hover:text-blue-700">
                Đặt phòng của tôi
              </Link>

              {['admin', 'manager'].includes(user.role) && (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  <MdDashboard /> Quản trị
                </Link>
              )}

              <div className="group relative">
                <button className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:bg-slate-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                    {user.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="max-w-36 truncate text-sm font-semibold text-slate-700">{user.full_name}</div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{user.role}</div>
                  </div>
                </button>

                <div className="invisible absolute right-0 top-full mt-2 w-56 rounded-2xl border border-slate-100 bg-white p-2 opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:opacity-100">
                  <Link
                    to="/profile"
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    <FaUser className="text-blue-500" /> Tài khoản của tôi
                  </Link>
                  <Link
                    to="/my-bookings"
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                  >
                    Đặt phòng của tôi
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-sm text-red-500 transition hover:bg-red-50"
                  >
                    <FaSignOutAlt /> Đăng xuất
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-blue-700"
              >
                <FaSignInAlt /> Đăng nhập
              </Link>
              <Link
                to="/register"
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Đăng ký
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
