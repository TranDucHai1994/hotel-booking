import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { FaUser, FaEnvelope, FaPhone, FaLock, FaSave } from 'react-icons/fa';

export default function Profile() {
  const { user, login } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleUpdateInfo = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.put('/auth/profile', form);
      login(res.data.user, localStorage.getItem('token'));
      toast.success('Cập nhật thông tin thành công!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cập nhật thất bại!');
    }
    setLoading(false);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('Mật khẩu xác nhận không khớp!');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      toast.error('Mật khẩu mới phải ít nhất 6 ký tự!');
      return;
    }
    setLoading(true);
    try {
      await api.put('/auth/change-password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
      });
      toast.success('Đổi mật khẩu thành công!');
      setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đổi mật khẩu thất bại!');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tài khoản của tôi</h1>

      {/* Avatar & Info */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-6 flex items-center gap-5">
        <div className="bg-blue-600 text-white w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold flex-shrink-0">
          {user?.full_name?.charAt(0).toUpperCase()}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800">{user?.full_name}</h2>
          <p className="text-gray-500">{user?.email}</p>
          <span className={`inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium ${user?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
            {user?.role === 'admin' ? '👑 Admin' : '👤 Khách hàng'}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'info', label: '📋 Thông tin cá nhân' },
          { key: 'password', label: '🔒 Đổi mật khẩu' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === tab.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Thông tin */}
      {activeTab === 'info' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">Thông tin cá nhân</h3>
          <form onSubmit={handleUpdateInfo} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                <FaUser className="inline mr-1 text-blue-500" /> Họ và tên
              </label>
              <input
                type="text"
                value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                <FaEnvelope className="inline mr-1 text-blue-500" /> Email
              </label>
              <input
                type="email"
                value={user?.email}
                disabled
                className="w-full border border-gray-100 rounded-xl px-3 py-2 text-gray-400 bg-gray-50 cursor-not-allowed"
              />
              <p className="text-xs text-gray-400 mt-1">Email không thể thay đổi</p>
            </div>
            <div>
              <label className="block text-gray-700 text-sm font-medium mb-1">
                <FaPhone className="inline mr-1 text-blue-500" /> Số điện thoại
              </label>
              <input
                type="text"
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="0901234567"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500"
              />
            </div>
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium transition disabled:opacity-50">
              <FaSave /> {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </form>
        </div>
      )}

      {/* Tab: Đổi mật khẩu */}
      {activeTab === 'password' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-800 mb-4">Đổi mật khẩu</h3>
          <form onSubmit={handleChangePassword} className="space-y-4">
            {[
              { label: 'Mật khẩu hiện tại', key: 'current_password', placeholder: '••••••••' },
              { label: 'Mật khẩu mới', key: 'new_password', placeholder: '••••••••' },
              { label: 'Xác nhận mật khẩu mới', key: 'confirm_password', placeholder: '••••••••' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-gray-700 text-sm font-medium mb-1">
                  <FaLock className="inline mr-1 text-blue-500" /> {f.label}
                </label>
                <input
                  type="password"
                  placeholder={f.placeholder}
                  value={passwordForm[f.key]}
                  onChange={e => setPasswordForm({ ...passwordForm, [f.key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500"
                  required
                />
              </div>
            ))}
            <button type="submit" disabled={loading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-medium transition disabled:opacity-50">
              <FaLock /> {loading ? 'Đang xử lý...' : 'Đổi mật khẩu'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}