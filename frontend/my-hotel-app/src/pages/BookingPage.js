import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import {
  FaCalendarAlt,
  FaCheckCircle,
  FaCreditCard,
  FaEnvelopeOpenText,
  FaPhoneAlt,
  FaUser,
  FaUsers,
} from 'react-icons/fa';
import { formatCurrencyVND } from '../utils/format';

export default function BookingPage() {
  const { hotelId, roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [room, setRoom] = useState(null);
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [confirmation, setConfirmation] = useState(null);
  const [form, setForm] = useState({
    check_in: searchParams.get('check_in') || '',
    check_out: searchParams.get('check_out') || '',
    guests: 1,
    payment_method: 'pay_at_hotel',
    customer_note: '',
    guest_name: '',
    guest_email: '',
    guest_phone: '',
  });

  useEffect(() => {
    setForm((current) => ({
      ...current,
      guest_name: user?.full_name || current.guest_name,
      guest_email: user?.email || current.guest_email,
      guest_phone: user?.phone || current.guest_phone,
    }));
  }, [user]);

  useEffect(() => {
    const fetchHotel = async () => {
      setPageLoading(true);
      try {
        const params = {};
        if (form.check_in && form.check_out) {
          params.check_in = form.check_in;
          params.check_out = form.check_out;
        }
        const res = await api.get(`/hotels/${hotelId}`, { params });
        setHotel(res.data);
        const found = res.data.rooms?.find((item) => String(item._id) === String(roomId));
        setRoom(found || null);
      } catch (error) {
        console.error(error);
        toast.error('Không tải được thông tin đặt phòng');
      }
      setPageLoading(false);
    };

    fetchHotel();
  }, [hotelId, roomId, form.check_in, form.check_out]);

  const nights = useMemo(() => {
    if (!form.check_in || !form.check_out) return 0;
    return Math.ceil((new Date(form.check_out) - new Date(form.check_in)) / (1000 * 60 * 60 * 24));
  }, [form.check_in, form.check_out]);

  const total = useMemo(() => (room ? Number(room.price_per_night || 0) * nights : 0), [room, nights]);
  const isGuestMode = !user;

  const handleBook = async (event) => {
    event.preventDefault();

    if (nights <= 0) {
      toast.error('Ngày trả phòng phải sau ngày nhận phòng');
      return;
    }

    if (!room?.is_bookable) {
      toast.error('Loại phòng này hiện không thể đặt');
      return;
    }

    if (isGuestMode && (!form.guest_name.trim() || !form.guest_email.trim())) {
      toast.error('Khách vãng lai cần nhập họ tên và email');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/bookings', {
        ...form,
        hotel_id: hotelId,
        room_id: roomId,
      });

      setConfirmation(res.data);
      toast.success('Đặt phòng thành công');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Đặt phòng thất bại');
    }
    setLoading(false);
  };

  if (pageLoading) {
    return (
      <div className="flex justify-center py-40">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!hotel || !room) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <h1 className="text-2xl font-bold text-slate-800">Không tìm thấy thông tin phòng</h1>
          <p className="mt-3 text-slate-500">
            Phòng có thể đã được cập nhật hoặc không còn khả dụng trong khoảng ngày bạn chọn.
          </p>
          <button
            onClick={() => navigate(`/hotels/${hotelId}`)}
            className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Quay lại khách sạn
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-gray-800">Xác nhận đặt phòng</h1>
        <p className="text-sm text-gray-500">
          {isGuestMode
            ? 'Guest mode đang bật. Bạn có thể đặt phòng mà không cần đăng nhập.'
            : 'Bạn đang đặt phòng bằng tài khoản thành viên.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="space-y-6">
          {confirmation ? (
            <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-600">
                  <FaCheckCircle className="text-xl" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Đặt phòng thành công</h2>
                  <p className="text-sm text-slate-500">
                    Mã booking #{String(confirmation.booking?._id || '').padStart(6, '0')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex justify-between gap-3">
                  <span>Khách sạn</span>
                  <span className="text-right font-semibold text-slate-800">{hotel.name}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Loại phòng</span>
                  <span className="text-right font-semibold text-slate-800">{room.room_type}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Hình thức</span>
                  <span className="text-right font-semibold text-slate-800">
                    {confirmation.booking?.booking_source === 'guest' ? 'Khách vãng lai' : 'Tài khoản thành viên'}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span>Trạng thái</span>
                  <span className="text-right font-semibold text-amber-600">
                    {confirmation.booking?.status || 'pending'}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-blue-800">
                <div className="mb-1 flex items-center gap-2 font-semibold">
                  <FaEnvelopeOpenText />
                  Email xác nhận mô phỏng
                </div>
                <p>
                  {confirmation.mock_email
                    ? `Hệ thống đã tạo email mô phỏng gửi tới ${confirmation.mock_email.to}.`
                    : 'Đặt phòng đã được ghi nhận. Email mô phỏng hiện chưa tạo được.'}
                </p>
                {confirmation.mock_email?.message_id ? (
                  <p className="mt-1 text-xs text-blue-700">Message ID: {confirmation.mock_email.message_id}</p>
                ) : null}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {user ? (
                  <Link
                    to="/my-bookings"
                    className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
                  >
                    Xem booking của tôi
                  </Link>
                ) : (
                  <Link
                    to="/"
                    className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
                  >
                    Về trang chủ
                  </Link>
                )}
                <Link
                  to={`/hotels/${hotelId}`}
                  className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-200"
                >
                  Xem lại khách sạn
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBook} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
              <div className={`rounded-2xl p-4 text-sm ${isGuestMode ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-700'}`}>
                <div className="mb-1 font-semibold">
                  {isGuestMode ? 'Đặt phòng ở chế độ khách vãng lai' : 'Thông tin người đặt'}
                </div>
                {isGuestMode ? (
                  <p>
                    Bạn không cần đăng nhập. Hệ thống sẽ lưu thông tin liên hệ và tạo email xác nhận mô phỏng sau khi đặt.
                  </p>
                ) : (
                  <>
                    <div>{user?.full_name}</div>
                    <div>{user?.email}</div>
                    {user?.phone ? <div>{user.phone}</div> : null}
                  </>
                )}
              </div>

              {isGuestMode && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      <FaUser className="mr-1 inline text-blue-500" />
                      Họ và tên
                    </label>
                    <input
                      type="text"
                      value={form.guest_name}
                      onChange={(event) => setForm({ ...form, guest_name: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      <FaEnvelopeOpenText className="mr-1 inline text-blue-500" />
                      Email
                    </label>
                    <input
                      type="email"
                      value={form.guest_email}
                      onChange={(event) => setForm({ ...form, guest_email: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      <FaPhoneAlt className="mr-1 inline text-blue-500" />
                      Số điện thoại
                    </label>
                    <input
                      type="text"
                      value={form.guest_phone}
                      onChange={(event) => setForm({ ...form, guest_phone: event.target.value })}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  <FaCalendarAlt className="mr-1 inline text-blue-500" />
                  Ngày nhận phòng
                </label>
                <input
                  type="date"
                  value={form.check_in}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(event) => setForm({ ...form, check_in: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  <FaCalendarAlt className="mr-1 inline text-blue-500" />
                  Ngày trả phòng
                </label>
                <input
                  type="date"
                  value={form.check_out}
                  min={form.check_in || new Date().toISOString().split('T')[0]}
                  onChange={(event) => setForm({ ...form, check_out: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  <FaUsers className="mr-1 inline text-blue-500" />
                  Số khách
                </label>
                <input
                  type="number"
                  min="1"
                  max={room?.max_guests || 10}
                  value={form.guests}
                  onChange={(event) => setForm({ ...form, guests: Number(event.target.value) })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  <FaCreditCard className="mr-1 inline text-blue-500" />
                  Phương thức thanh toán
                </label>
                <select
                  value={form.payment_method}
                  onChange={(event) => setForm({ ...form, payment_method: event.target.value })}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                >
                  <option value="pay_at_hotel">Thanh toán tại khách sạn</option>
                  <option value="mock_card">Thẻ tín dụng (Mock)</option>
                  <option value="mock_momo">Ví MoMo (Mock)</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Ghi chú</label>
                <textarea
                  rows="3"
                  placeholder="Yêu cầu đặc biệt..."
                  value={form.customer_note}
                  onChange={(event) => setForm({ ...form, customer_note: event.target.value })}
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-gray-700 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !room?.is_bookable}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Đang xử lý...' : isGuestMode ? 'Đặt phòng nhanh (Guest Mode)' : 'Xác nhận đặt phòng'}
              </button>
            </form>
          )}
        </div>

        <div>
          <div className="sticky top-24 rounded-2xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-bold text-gray-800">Tóm tắt đặt phòng</h3>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Khách sạn</span>
                <span className="text-right font-medium text-gray-800">{hotel?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Loại phòng</span>
                <span className="font-medium text-gray-800">{room?.room_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Trạng thái</span>
                <span className="font-medium text-gray-800">
                  {room?.available_quantity > 0 ? `Còn ${room.available_quantity} phòng` : 'Không còn phòng'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Giá/đêm</span>
                <span className="font-medium text-blue-600">
                  {room ? formatCurrencyVND(room.price_per_night) : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Số đêm</span>
                <span className="font-medium text-gray-800">{nights > 0 ? `${nights} đêm` : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Hình thức</span>
                <span className="font-medium text-gray-800">{isGuestMode ? 'Guest Mode' : 'Tài khoản'}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-3">
                <span className="font-bold text-gray-800">Tổng tiền</span>
                <span className="text-lg font-bold text-blue-600">
                  {total > 0 ? formatCurrencyVND(total) : '-'}
                </span>
              </div>
            </div>

            {nights > 0 && (
              <div className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-700">
                {nights} đêm × {room ? formatCurrencyVND(room.price_per_night) : formatCurrencyVND(0)} ={' '}
                <strong>{formatCurrencyVND(total)}</strong>
              </div>
            )}

            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Với guest mode, bạn vẫn đặt được phòng nhưng lịch sử booking sẽ không xuất hiện ở mục "Đặt phòng của tôi".
              Xác nhận được mô phỏng qua email liên hệ bạn nhập.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
