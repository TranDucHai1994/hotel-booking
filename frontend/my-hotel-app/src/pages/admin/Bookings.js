import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { getBookingStatusMeta } from '../../utils/bookingStatus';
import { formatCurrencyVND, formatDateVi } from '../../utils/format';

export default function AdminBookings() {
  const [bookings, setBookings] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchBookings = () => {
    setLoading(true);
    api.get('/bookings/all')
      .then((response) => {
        setBookings(response.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleStatus = async (id, status) => {
    try {
      await api.put(`/bookings/${id}/status`, { status });
      toast.success(status === 'confirmed' ? 'Đã xác nhận booking' : 'Đã hủy booking');
      fetchBookings();
    } catch (error) {
      toast.error('Cập nhật thất bại');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Xoa han booking nay?')) return;

    try {
      await api.delete(`/bookings/${id}`);
      toast.success('Da xoa booking');
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Xoa booking that bai');
    }
  };

  const filtered = filter === 'all' ? bookings : bookings.filter((item) => item.status === filter);

  if (loading) {
    return (
      <div className="flex justify-center py-40">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý đặt phòng</h1>
          <p className="text-sm text-gray-500">{bookings.length} booking</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { key: 'all', label: `Tất cả (${bookings.length})` },
          { key: 'pending', label: `Chờ xác nhận (${bookings.filter((item) => item.status === 'pending').length})` },
          { key: 'confirmed', label: `Đã xác nhận (${bookings.filter((item) => item.status === 'confirmed').length})` },
          { key: 'cancelled', label: `Đã hủy (${bookings.filter((item) => item.status === 'cancelled').length})` },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setFilter(item.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              filter === item.key ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((booking) => {
          const displayName = booking.user_id?.full_name || booking.guest_name || 'Khách vãng lai';
          const displayEmail = booking.user_id?.email || booking.guest_email || 'Chưa có email';
          const sourceText = booking.booking_source === 'guest' ? 'Guest Mode' : 'Tài khoản';
          const statusMeta = getBookingStatusMeta(booking.status);
          const paymentStatusText = booking.payment_status === 'paid'
            ? 'Da thanh toan'
            : booking.payment_status === 'refunded'
              ? 'Da hoan tien'
              : 'Chua thanh toan';
          const paymentMethodText = booking.payment_method === 'mock_card'
            ? 'Mock Card'
            : booking.payment_method === 'mock_momo'
              ? 'Mock MoMo'
              : 'Pay at hotel';

          return (
            <div key={booking._id} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-800">{booking.hotel_id?.name}</h3>
                  <p className="text-sm text-gray-500">{displayName} — {displayEmail}</p>
                  <p className="text-sm text-gray-500">{booking.room_id?.room_type}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                      {sourceText}
                    </span>
                    {booking.guest_phone ? (
                      <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                        {booking.guest_phone}
                      </span>
                    ) : null}
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {paymentStatusText}
                    </span>
                    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                      {paymentMethodText}
                    </span>
                  </div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusMeta.colorClass}`}>
                  {statusMeta.text}
                </span>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                <div>
                  <p className="text-gray-400">Check-in</p>
                  <p className="font-medium">{formatDateVi(booking.check_in)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Check-out</p>
                  <p className="font-medium">{formatDateVi(booking.check_out)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Số khách</p>
                  <p className="font-medium">{booking.guests} người</p>
                </div>
                <div>
                  <p className="text-gray-400">Tổng tiền</p>
                  <p className="font-bold text-blue-600">
                    {formatCurrencyVND(booking.total_amount)}
                  </p>
                </div>
              </div>

              {booking.customer_note && (
                <p className="mb-4 rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-500">
                  Ghi chú: {booking.customer_note}
                </p>
              )}

              {booking.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatus(booking._id, 'confirmed')}
                    className="flex-1 rounded-xl bg-green-600 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                  >
                    Xác nhận booking
                  </button>
                  <button
                    onClick={() => handleStatus(booking._id, 'cancelled')}
                    className="flex-1 rounded-xl bg-red-50 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                  >
                    Hủy booking
                  </button>
                </div>
              )}

              {booking.status === 'confirmed' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleStatus(booking._id, 'cancelled')}
                    className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-100"
                  >
                    Hủy booking
                  </button>
                  <button
                    onClick={() => handleDelete(booking._id)}
                    className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                  >
                    Xoa record
                  </button>
                </div>
              )}

              {booking.status === 'cancelled' && (
                <button
                  onClick={() => handleDelete(booking._id)}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-200"
                >
                  Xoa record
                </button>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="py-20 text-center text-gray-400">Không có booking nào</div>
        )}
      </div>
    </div>
  );
}
