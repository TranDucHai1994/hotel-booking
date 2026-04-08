import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { FaCalendarAlt, FaUsers, FaCreditCard } from 'react-icons/fa';

export default function BookingPage() {
  const { hotelId, roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    check_in: '',
    check_out: '',
    guests: 1,
    payment_method: 'pay_at_hotel',
    customer_note: ''
  });

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    api.get(`/hotels/${hotelId}`).then(res => {
      setHotel(res.data);
      const found = res.data.rooms?.find(r => r._id === roomId);
      setRoom(found);
    });
  }, [hotelId, roomId]);

  const nights = form.check_in && form.check_out
    ? Math.ceil((new Date(form.check_out) - new Date(form.check_in)) / (1000 * 60 * 60 * 24))
    : 0;

  const total = room ? room.price_per_night * nights : 0;

  const handleBook = async (e) => {
    e.preventDefault();
    if (nights <= 0) {
      toast.error('Ngày trả phòng phải sau ngày nhận phòng!');
      return;
    }
    setLoading(true);
    try {
      await api.post('/bookings', {
        ...form,
        hotel_id: hotelId,
        room_id: roomId
      });
      toast.success('Đặt phòng thành công! Chờ xác nhận từ khách sạn.');
      setTimeout(() => navigate('/my-bookings'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đặt phòng thất bại!');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Xác nhận đặt phòng</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Form đặt phòng */}
        <form onSubmit={handleBook} className="bg-white rounded-2xl p-6 shadow-sm space-y-4">

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              <FaCalendarAlt className="inline mr-1 text-blue-500" />
              Ngày nhận phòng
            </label>
            <input
              type="date"
              value={form.check_in}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setForm({ ...form, check_in: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              <FaCalendarAlt className="inline mr-1 text-blue-500" />
              Ngày trả phòng
            </label>
            <input
              type="date"
              value={form.check_out}
              min={form.check_in || new Date().toISOString().split('T')[0]}
              onChange={e => setForm({ ...form, check_out: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              <FaUsers className="inline mr-1 text-blue-500" />
              Số khách
            </label>
            <input
              type="number"
              min="1"
              max={room?.max_guests || 10}
              value={form.guests}
              onChange={e => setForm({ ...form, guests: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">
              <FaCreditCard className="inline mr-1 text-blue-500" />
              Phương thức thanh toán
            </label>
            <select
              value={form.payment_method}
              onChange={e => setForm({ ...form, payment_method: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500"
            >
              <option value="pay_at_hotel">Thanh toán tại khách sạn</option>
              <option value="mock_card">Thẻ tín dụng (Mock)</option>
              <option value="mock_momo">Ví MoMo (Mock)</option>
            </select>
          </div>

          <div>
            <label className="block text-gray-700 text-sm font-medium mb-1">Ghi chú</label>
            <textarea
              rows="3"
              placeholder="Yêu cầu đặc biệt..."
              value={form.customer_note}
              onChange={e => setForm({ ...form, customer_note: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-gray-700 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Đang xử lý...' : '🏨 Xác nhận đặt phòng'}
          </button>

        </form>

        {/* Tóm tắt đặt phòng */}
        <div>
          <div className="bg-white rounded-2xl p-6 shadow-sm sticky top-24">
            <h3 className="font-bold text-gray-800 text-lg mb-4">Tóm tắt đặt phòng</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Khách sạn</span>
                <span className="font-medium text-gray-800 text-right">{hotel?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Loại phòng</span>
                <span className="font-medium text-gray-800">{room?.room_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Giá/đêm</span>
                <span className="font-medium text-blue-600">
                  {room ? Number(room.price_per_night).toLocaleString('vi-VN') + 'đ' : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Số đêm</span>
                <span className="font-medium text-gray-800">
                  {nights > 0 ? nights + ' đêm' : '-'}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between">
                <span className="font-bold text-gray-800">Tổng tiền</span>
                <span className="font-bold text-blue-600 text-lg">
                  {total > 0 ? Number(total).toLocaleString('vi-VN') + 'đ' : '-'}
                </span>
              </div>
            </div>

            {nights > 0 && (
              <div className="mt-4 bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
                ✅ {nights} đêm × {room ? Number(room.price_per_night).toLocaleString('vi-VN') : 0}đ
                = <strong>{Number(total).toLocaleString('vi-VN')}đ</strong>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}