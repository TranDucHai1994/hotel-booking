import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { FaHotel, FaUser, FaEnvelope, FaLock, FaPhone } from 'react-icons/fa';

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/auth/register', form);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng ký thất bại');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-blue-600 p-3 rounded-2xl">
              <FaHotel className="text-white text-3xl" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Tạo tài khoản</h2>
          <p className="text-gray-500 text-sm mt-1">Đăng ký để bắt đầu đặt phòng</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { icon: <FaUser />, label: 'Họ và tên', key: 'full_name', type: 'text', placeholder: 'Nguyễn Văn A' },
            { icon: <FaEnvelope />, label: 'Email', key: 'email', type: 'email', placeholder: 'email@example.com' },
            { icon: <FaPhone />, label: 'Số điện thoại', key: 'phone', type: 'text', placeholder: '0901234567' },
            { icon: <FaLock />, label: 'Mật khẩu', key: 'password', type: 'password', placeholder: '••••••••' },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-gray-700 text-sm font-medium mb-1">{field.label}</label>
              <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 focus-within:border-blue-500 transition">
                <span className="text-gray-400 mr-2 text-sm">{field.icon}</span>
                <input
                  type={field.type}
                  placeholder={field.placeholder}
                  value={form[field.key]}
                  onChange={e => setForm({ ...form, [field.key]: e.target.value })}
                  className="outline-none w-full text-gray-700 text-sm"
                  required
                />
              </div>
            </div>
          ))}

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50">
            {loading ? 'Đang đăng ký...' : 'Đăng ký'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}