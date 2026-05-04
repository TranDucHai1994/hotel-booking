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

  // Hàm xử lý Guest Mode để đảm bảo nút "chạy" được
  const handleGuestMode = () => {
    localStorage.setItem('isGuest', 'true');
    navigate('/hotels');
  };

  return (
    <>
      {/* ══════════════════════════════════════════
          CODE Ý TƯỞNG MỚI (ĐANG CHẠY THỬ)
          ══════════════════════════════════════════ */}
      <nav className="sticky top-0 z-50 border-b border-slate-100 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-6 py-3">
          
          {/* LOGO */}
          <Link to="/" className="flex items-center gap-3 transition-transform hover:scale-105">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-lg shadow-blue-100">
              <FaHotel className="text-base" />
            </div>
            <span className="text-xl font-black tracking-tight text-slate-800">HotelBooking</span>
          </Link>

          {/* CỤM CHỨC NĂNG BÊN PHẢI */}
          <div className="flex items-center gap-5">
            
            <Link to="/hotels" className="hidden text-sm font-medium text-slate-600 transition hover:text-blue-600 md:block">
              Khách sạn
            </Link>

            {/* Guest Mode: Đã chuyển thành button để có thể handle click */}
            {!user && (
              <button 
                onClick={handleGuestMode}
                className="hidden items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700 border border-amber-100 lg:flex transition hover:bg-amber-100"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Guest
              </button>
            )}

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-blue-600"
            >
              {isDark ? <FaSun className="text-amber-500" /> : <FaMoon />}
            </button>

            {/* KHỐI TÀI KHOẢN / ĐĂNG NHẬP */}
            <div className="flex items-center gap-3 border-l border-slate-100 pl-5">
              {user ? (
                <div className="group relative">
                  <button className="flex items-center gap-2 rounded-full bg-slate-50 p-1 pr-3 transition hover:bg-slate-100">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-md">
                      {user.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <span className="max-w-[100px] truncate text-sm font-semibold text-slate-700">{user.full_name}</span>
                  </button>

                  <div className="invisible absolute right-0 top-full mt-2 w-48 origin-top-right rounded-2xl border border-slate-100 bg-white p-2 opacity-0 shadow-2xl transition-all duration-200 group-hover:visible group-hover:opacity-100">
                    {['admin', 'manager'].includes(user.role) && (
                      <Link to="/admin" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50">
                        <MdDashboard size={14} /> Quản trị
                      </Link>
                    )}
                    <Link to="/profile" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600">
                      <FaUser size={14} /> Tài khoản
                    </Link>
                    <Link to="/my-bookings" className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 hover:text-blue-600">
                      <FaHotel size={14} /> Đặt phòng
                    </Link>
                    <div className="my-1 border-t border-slate-50" />
                    <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-500 hover:bg-red-50">
                      <FaSignOutAlt size={14} /> Đăng xuất
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-semibold text-slate-600 hover:text-blue-600">
                    Đăng nhập
                  </Link>
                  <Link to="/register" className="rounded-full bg-blue-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 hover:-translate-y-0.5 active:translate-y-0">
                    Đăng ký
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════
          CODE CŨ (ĐÃ KHÓA BẰNG COMMENT JSX)
          ══════════════════════════════════════════ */}
      {/* <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-4 px-4 py-4">
           ... toàn bộ code cũ của bạn ...
        </div>
      </nav>
      */}
    </>
  );
}