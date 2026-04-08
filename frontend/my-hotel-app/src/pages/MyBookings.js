import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { FaHotel, FaStar } from 'react-icons/fa';

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

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showFeedback, setShowFeedback] = useState(null);
  const [feedbackForm, setFeedbackForm] = useState({ rating: 5, content: '' });

  const fetchBookings = () => {
    api.get('/bookings/my').then(res => {
      setBookings(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchBookings(); }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Bạn có chắc muốn hủy đặt phòng này không?')) return;
    try {
      await api.put(`/bookings/${id}/cancel`);
      toast.success('Hủy đặt phòng thành công!');
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Hủy thất bại!');
    }
  };

  const handleFeedback = async (e) => {
    e.preventDefault();
    try {
      await api.post('/feedback', {
        hotel_id: showFeedback.hotel_id?._id,
        rating: feedbackForm.rating,
        content: feedbackForm.content,
      });
      toast.success('Gửi đánh giá thành công! Cảm ơn bạn 🎉');
      setShowFeedback(null);
      setFeedbackForm({ rating: 5, content: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Gửi đánh giá thất bại!');
    }
  };

  if (loading) return (
    <div className="flex justify-center py-40">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Đặt phòng của tôi</h1>

      {bookings.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <FaHotel className="text-6xl mx-auto mb-4 opacity-30" />
          <p className="text-lg mb-4">Bạn chưa có đặt phòng nào</p>
          <Link to="/hotels"
            className="bg-blue-600 text-white px-6 py-2 rounded-xl hover:bg-blue-700 transition font-medium">
            Tìm khách sạn ngay
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map(b => (
            <div key={b._id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">

              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-gray-800 text-lg">{b.hotel_id?.name}</h3>
                  <p className="text-gray-500 text-sm">🛏️ {b.room_id?.room_type}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    Mã đặt phòng: #{b._id?.slice(-8).toUpperCase()}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[b.status]}`}>
                  {statusText[b.status]}
                </span>
              </div>

              {/* Chi tiết */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">Check-in</p>
                  <p className="font-medium text-gray-700">
                    {new Date(b.check_in).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">Check-out</p>
                  <p className="font-medium text-gray-700">
                    {new Date(b.check_out).toLocaleDateString('vi-VN')}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">Số khách</p>
                  <p className="font-medium text-gray-700">{b.guests} người</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-gray-400 text-xs mb-1">Tổng tiền</p>
                  <p className="font-bold text-blue-600">
                    {Number(b.total_amount).toLocaleString('vi-VN')}đ
                  </p>
                </div>
              </div>

              {/* Thanh toán */}
              <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
                <span>💳 {b.payment_method === 'pay_at_hotel' ? 'Thanh toán tại KS' : b.payment_method === 'mock_card' ? 'Thẻ tín dụng' : 'Ví MoMo'}</span>
                <span>•</span>
                <span className={b.payment_status === 'paid' ? 'text-green-500 font-medium' : 'text-yellow-500 font-medium'}>
                  {b.payment_status === 'paid' ? '✅ Đã thanh toán' : b.payment_status === 'refunded' ? '↩️ Đã hoàn tiền' : '⏳ Chưa thanh toán'}
                </span>
              </div>

              {/* Ghi chú */}
              {b.customer_note && (
                <div className="bg-blue-50 rounded-xl px-3 py-2 text-sm text-blue-700 mb-4">
                  📝 {b.customer_note}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 flex-wrap">
                {/* Hủy booking nếu đang pending */}
                {b.status === 'pending' && (
                  <button onClick={() => handleCancel(b._id)}
                    className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 px-4 py-2 rounded-xl text-sm font-medium transition">
                    ❌ Hủy đặt phòng
                  </button>
                )}

                {/* Đánh giá nếu đã ở xong */}
                {b.status === 'confirmed' && new Date(b.check_out) < new Date() && (
                  <button onClick={() => setShowFeedback(b)}
                    className="flex items-center gap-1 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl text-sm font-medium transition">
                    ⭐ Viết đánh giá
                  </button>
                )}

                {/* Xem khách sạn */}
                <Link to={`/hotels/${b.hotel_id?._id}`}
                  className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-600 px-4 py-2 rounded-xl text-sm font-medium transition">
                  🏨 Xem khách sạn
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Feedback */}
      {showFeedback && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-gray-800 mb-1">⭐ Đánh giá khách sạn</h2>
            <p className="text-gray-500 text-sm mb-4">{showFeedback.hotel_id?.name}</p>

            <form onSubmit={handleFeedback} className="space-y-4">
              {/* Rating stars */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-2">Điểm đánh giá</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button"
                      onClick={() => setFeedbackForm({ ...feedbackForm, rating: star })}
                      className="text-3xl transition hover:scale-110">
                      {star <= feedbackForm.rating ? '⭐' : '☆'}
                    </button>
                  ))}
                  <span className="ml-2 text-gray-600 font-medium self-center">
                    {feedbackForm.rating}/5
                  </span>
                </div>
              </div>

              {/* Nội dung */}
              <div>
                <label className="block text-gray-700 text-sm font-medium mb-1">Nhận xét</label>
                <textarea rows="4"
                  placeholder="Chia sẻ trải nghiệm của bạn về khách sạn..."
                  value={feedbackForm.content}
                  onChange={e => setFeedbackForm({ ...feedbackForm, content: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500 resize-none"
                  required />
              </div>

              <div className="flex gap-3">
                <button type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl font-medium transition">
                  Gửi đánh giá
                </button>
                <button type="button"
                  onClick={() => { setShowFeedback(null); setFeedbackForm({ rating: 5, content: '' }); }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-xl font-medium transition">
                  Hủy
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}