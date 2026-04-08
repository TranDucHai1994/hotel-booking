import { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

const statusColor = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusText = {
  pending: '⏳ Chờ xác nhận',
  confirmed: '✅ Đã xác nhận',
  cancelled: '❌ Đã hủy',
};

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchBookings = () => {
    api.get('/bookings/all').then(r => {
      setBookings(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/bookings/${id}/status`, { status });
      toast.success(status === 'confirmed' ? 'Đã xác nhận booking!' : 'Đã hủy booking!');
      fetchBookings();
    } catch (err) {
      toast.error('Cập nhật thất bại!');
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter(b => b.status === filter);

  if (loading) return (
    <div className="flex justify-center py-40">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý Đặt phòng</h1>
          <p className="text-gray-500 text-sm">{bookings.length} booking</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {[
          { key: 'all', label: `Tất cả (${bookings.length})` },
          { key: 'pending', label: `⏳ Chờ xác nhận (${bookings.filter(b => b.status === 'pending').length})` },
          { key: 'confirmed', label: `✅ Đã xác nhận (${bookings.filter(b => b.status === 'confirmed').length})` },
          { key: 'cancelled', label: `❌ Đã hủy (${bookings.filter(b => b.status === 'cancelled').length})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${filter === f.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Danh sách */}
      <div className="space-y-4">
        {filtered.map(b => (
          <div key={b._id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-gray-800">{b.hotel_id?.name}</h3>
                <p className="text-gray-500 text-sm">👤 {b.user_id?.full_name} — {b.user_id?.email}</p>
                <p className="text-gray-500 text-sm">🛏️ {b.room_id?.room_type}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[b.status]}`}>
                {statusText[b.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <p className="text-gray-400">Check-in</p>
                <p className="font-medium">{new Date(b.check_in).toLocaleDateString('vi-VN')}</p>
              </div>
              <div>
                <p className="text-gray-400">Check-out</p>
                <p className="font-medium">{new Date(b.check_out).toLocaleDateString('vi-VN')}</p>
              </div>
              <div>
                <p className="text-gray-400">Số khách</p>
                <p className="font-medium">{b.guests} người</p>
              </div>
              <div>
                <p className="text-gray-400">Tổng tiền</p>
                <p className="font-bold text-blue-600">{Number(b.total_amount).toLocaleString('vi-VN')}đ</p>
              </div>
            </div>

            {b.customer_note && (
              <p className="text-gray-500 text-sm bg-gray-50 px-3 py-2 rounded-xl mb-4">
                📝 {b.customer_note}
              </p>
            )}

            {b.status === 'pending' && (
              <div className="flex gap-3">
                <button onClick={() => handleStatus(b._id, 'confirmed')}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl text-sm font-medium transition">
                  ✅ Xác nhận booking
                </button>
                <button onClick={() => handleStatus(b._id, 'cancelled')}
                  className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-xl text-sm font-medium transition">
                  ❌ Hủy booking
                </button>
              </div>
            )}
            {b.status === 'confirmed' && (
              <button onClick={() => handleStatus(b._id, 'cancelled')}
                className="bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-medium transition">
                ❌ Hủy booking
              </button>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-20 text-gray-400">Không có booking nào</div>
        )}
      </div>
    </div>
  );
}