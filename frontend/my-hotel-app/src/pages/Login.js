import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FaHotel, FaEnvelope, FaLock } from 'react-icons/fa';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/login', form);
      login(res.data.user, res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Đăng nhập thất bại');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <div className="bg-blue-600 p-3 rounded-2xl">
              <FaHotel className="text-white text-3xl" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Đăng nhập</h2>
          <p className="text-gray-500 text-sm mt-1">Chào mừng bạn trở lại!</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Email</label>
            <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 focus-within:border-blue-500 transition">
              <FaEnvelope className="text-gray-400 mr-2" />
              <input
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="outline-none w-full text-gray-700 text-sm"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Mật khẩu</label>
            <div className="flex items-center border border-gray-200 rounded-xl px-3 py-2 focus-within:border-blue-500 transition">
              <FaLock className="text-gray-400 mr-2" />
              <input
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
                className="outline-none w-full text-gray-700 text-sm"
                required
              />
            </div>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50">
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-blue-600 font-medium hover:underline">Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}