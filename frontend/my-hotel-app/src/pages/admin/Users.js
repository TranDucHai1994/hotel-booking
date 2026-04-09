import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const badge = (status) => {
  if (status === 'active') return 'bg-green-50 text-green-700';
  if (status === 'locked') return 'bg-yellow-50 text-yellow-700';
  if (status === 'disabled') return 'bg-red-50 text-red-700';
  return 'bg-gray-100 text-gray-600';
};

const statusText = (status) => {
  if (status === 'active') return '✅ Active';
  if (status === 'locked') return '🔒 Locked';
  if (status === 'disabled') return '⛔ Disabled';
  return status || 'unknown';
};

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      if (err?.__authRedirect) return;
      toast.error(err.response?.data?.message || 'Không tải được danh sách user');
    }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => {
      const hay = [
        u.full_name,
        u.email,
        u.username,
        u.role,
        u.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [users, query]);

  const lock = async (id) => {
    try {
      await api.patch(`/users/${id}/lock`);
      toast.success('Đã khóa tài khoản');
      fetchUsers();
    } catch (err) {
      if (err?.__authRedirect) return;
      toast.error(err.response?.data?.message || 'Khóa thất bại');
    }
  };

  const unlock = async (id) => {
    try {
      await api.patch(`/users/${id}/unlock`);
      toast.success('Đã mở khóa tài khoản');
      fetchUsers();
    } catch (err) {
      if (err?.__authRedirect) return;
      toast.error(err.response?.data?.message || 'Mở khóa thất bại');
    }
  };

  const changePassword = async (id) => {
    const newPass = window.prompt('Nhập mật khẩu mới cho user:', '');
    if (!newPass) return;
    try {
      await api.put(`/users/${id}`, { password: newPass });
      toast.success('Đã đổi mật khẩu');
      fetchUsers();
    } catch (err) {
      if (err?.__authRedirect) return;
      toast.error(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    }
  };

  const resetToDefault = async (id) => {
    const defaultPass = '123';
    const ok = window.confirm('Reset mật khẩu về mặc định 123 cho user này?');
    if (!ok) return;
    try {
      await api.put(`/users/${id}`, { password: defaultPass });
      toast.success('Đã reset mật khẩu về 123');
      fetchUsers();
    } catch (err) {
      if (err?.__authRedirect) return;
      toast.error(err.response?.data?.message || 'Reset mật khẩu thất bại');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-40">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Không có quyền truy cập</h1>
          <p className="text-gray-500">Chỉ tài khoản admin mới được quản lý người dùng.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Tài khoản</h1>
          <p className="text-gray-500 text-sm">{filtered.length} user</p>
        </div>
        <div className="flex gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên/email/role..."
            className="w-full md:w-80 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map(u => (
          <div key={u.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-800 truncate">{u.full_name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge(u.status)}`}>
                    {statusText(u.status)}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                    {u.role}
                  </span>
                </div>
                <p className="text-gray-500 text-sm mt-1">
                  📧 {u.email}{u.username ? ` · 👤 ${u.username}` : ''}{u.phone ? ` · 📞 ${u.phone}` : ''}
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  Failed attempts: {u.failed_attempts ?? 0}
                  {u.last_login ? ` · Last login: ${new Date(u.last_login).toLocaleString('vi-VN')}` : ''}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap justify-end">
                {u.status !== 'locked' ? (
                  <button
                    onClick={() => lock(u.id)}
                    className="bg-yellow-50 hover:bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-medium transition"
                  >
                    🔒 Khóa
                  </button>
                ) : (
                  <button
                    onClick={() => unlock(u.id)}
                    className="bg-green-50 hover:bg-green-100 text-green-700 px-4 py-2 rounded-xl text-sm font-medium transition"
                  >
                    🔓 Mở khóa
                  </button>
                )}

                <button
                  onClick={() => changePassword(u.id)}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  🔑 Đổi mật khẩu
                </button>

                <button
                  onClick={() => resetToDefault(u.id)}
                  className="bg-gray-50 hover:bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition"
                >
                  ↩️ Reset 123
                </button>
              </div>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400">Không có user nào</div>
        )}
      </div>
    </div>
  );
}

