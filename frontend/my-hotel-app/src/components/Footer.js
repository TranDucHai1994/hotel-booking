import { FaHotel, FaFacebook, FaInstagram, FaTwitter, FaPhone, FaEnvelope, FaMapMarkerAlt } from 'react-icons/fa';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Logo & Mô tả */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-2 text-white font-bold text-xl mb-4">
              <FaHotel className="text-blue-400 text-2xl" />
              <span>HotelBooking</span>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">
              Nền tảng đặt phòng khách sạn hàng đầu Việt Nam. Hàng nghìn khách sạn, giá tốt nhất, đặt phòng dễ dàng.
            </p>
            <div className="flex gap-3">
              {[
                { icon: <FaFacebook />, href: '#' },
                { icon: <FaInstagram />, href: '#' },
                { icon: <FaTwitter />, href: '#' },
              ].map((s, i) => (
                <a key={i} href={s.href}
                  className="bg-gray-800 hover:bg-blue-600 text-gray-400 hover:text-white p-2 rounded-lg transition">
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Khám phá</h3>
            <ul className="space-y-2 text-sm">
              {[
                { label: 'Trang chủ', to: '/' },
                { label: 'Khách sạn', to: '/hotels' },
                { label: 'Đặt phòng của tôi', to: '/my-bookings' },
                { label: 'Đăng nhập', to: '/login' },
                { label: 'Đăng ký', to: '/register' },
              ].map((l, i) => (
                <li key={i}>
                  <Link to={l.to} className="text-gray-400 hover:text-white transition">{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Địa điểm */}
          <div>
            <h3 className="text-white font-semibold mb-4">Địa điểm nổi bật</h3>
            <ul className="space-y-2 text-sm">
              {['Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Nha Trang', 'Đà Lạt', 'Phú Quốc', 'Hội An'].map((city, i) => (
                <li key={i}>
                  <span className="text-gray-400 hover:text-white transition cursor-pointer">📍 {city}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Liên hệ */}
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

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-sm">
            © 2025 HotelBooking. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="text-gray-500 hover:text-white transition">Chính sách bảo mật</a>
            <a href="#" className="text-gray-500 hover:text-white transition">Điều khoản sử dụng</a>
            <a href="#" className="text-gray-500 hover:text-white transition">Hỗ trợ</a>
          </div>
        </div>
      </div>
    </footer>
  );
}