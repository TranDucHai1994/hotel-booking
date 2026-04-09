import { FaHotel, FaFacebook, FaInstagram, FaTwitter, FaPhone, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 text-white font-bold text-xl mb-4">
              <FaHotel className="text-blue-400 text-2xl" />
              <span>HotelBooking</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Nền tảng đặt phòng khách sạn tiện lợi với tìm kiếm nhanh, quản lý đặt chỗ và dashboard quản trị.
            </p>
            <div className="flex gap-3">
              {[
                { icon: <FaFacebook />, href: 'https://facebook.com' },
                { icon: <FaInstagram />, href: 'https://instagram.com' },
                { icon: <FaTwitter />, href: 'https://twitter.com' },
              ].map((item, index) => (
                <a
                  key={index}
                  href={item.href}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-gray-800 hover:bg-blue-600 text-gray-400 hover:text-white p-2 rounded-lg transition"
                >
                  {item.icon}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Khám phá</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Trang chủ', to: '/' },
                { label: 'Khách sạn', to: '/hotels' },
                { label: 'Đặt phòng của tôi', to: '/my-bookings' },
                { label: 'Đăng nhập', to: '/login' },
                { label: 'Đăng ký', to: '/register' },
              ].map((item, index) => (
                <li key={index}>
                  <Link to={item.to} className="text-gray-400 hover:text-white transition">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Điểm đến nổi bật</h3>
            <ul className="space-y-2 text-sm">
              {['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Nha Trang', 'Đà Lạt', 'Phú Quốc', 'Hội An'].map((city, index) => (
                <li key={index}>
                  <span className="text-gray-400">📍 {city}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4">Liên hệ</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2">
                <FaMapMarkerAlt className="text-blue-400 mt-0.5 flex-shrink-0" />
                <span className="text-gray-400">123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh</span>
              </li>
              <li className="flex items-center gap-2">
                <FaPhone className="text-blue-400 flex-shrink-0" />
                <span className="text-gray-400">1900 1234</span>
              </li>
              <li className="flex items-center gap-2">
                <FaEnvelope className="text-blue-400 flex-shrink-0" />
                <span className="text-gray-400">support@hotelbooking.vn</span>
              </li>
            </ul>

            <div className="mt-4 p-3 bg-gray-800 rounded-xl">
              <p className="text-xs text-gray-400 mb-1">Hỗ trợ 24/7</p>
              <p className="text-white font-bold text-lg">1900 1234</p>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">© 2025 HotelBooking. All rights reserved.</p>
          <div className="flex gap-6 text-sm">
            <Link to="/profile" className="text-gray-500 hover:text-white transition">Chính sách bảo mật</Link>
            <Link to="/hotels" className="text-gray-500 hover:text-white transition">Điều khoản sử dụng</Link>
            <Link to="/login" className="text-gray-500 hover:text-white transition">Hỗ trợ</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
