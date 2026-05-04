import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { FaBed, FaCalendarCheck, FaCommentDots, FaHotel, FaMoneyBillWave, FaUsers } from 'react-icons/fa';
import { formatCurrencyVND, formatDateTimeVi } from '../../utils/format';

function RevenueBars({ data }) {
  const max = Math.max(...data.map((item) => Number(item.value || 0)), 0);

  return (
    <div className="flex items-end gap-2 h-48">
      {data.map((item) => {
        const height = max > 0 ? Math.max(8, (Number(item.value || 0) / max) * 160) : 8;
        return (
          <div key={item.date} className="flex-1 min-w-0">
            <div
              className="bg-blue-500 rounded-t-xl w-full"
              style={{ height }}
              title={`${item.label}: ${formatCurrencyVND(item.value)}`}
            />
            <p className="text-[11px] text-center text-gray-500 mt-2 truncate">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 13);
    const format = (value) => value.toISOString().split('T')[0];
    return { from: format(from), to: format(now) };
  });
  const [data, setData] = useState({
    summary: {},
    payment_breakdown: {},
    trend_revenue: [],
    top_hotels: [],
    recent_bookings: [],
  });
  const [systemEmailSender, setSystemEmailSender] = useState('');
  const [systemSaving, setSystemSaving] = useState(false);

  const loadDashboard = async (nextRange = range) => {
    setLoading(true);
    try {
      const res = await api.get('/admin/dashboard', { params: nextRange });
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadDashboard(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (user?.role !== 'admin') return;

    let mounted = true;
    const loadSystemSettings = async () => {
      try {
        const res = await api.get('/admin/system-settings');
        if (mounted) {
          setSystemEmailSender(res.data?.email_sender || '');
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadSystemSettings();
    return () => {
      mounted = false;
    };
  }, [user?.role]);

  const saveSystemSettings = async () => {
    try {
      setSystemSaving(true);
      const payload = {
        email_sender: String(systemEmailSender || '').trim().toLowerCase(),
      };
      const res = await api.put('/admin/system-settings', payload);
      setSystemEmailSender(res.data?.email_sender || payload.email_sender);
      toast.success('Da luu email gui he thong');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Khong luu duoc cau hinh he thong');
    } finally {
      setSystemSaving(false);
    }
  };

  const menuItems = useMemo(() => {
    const items = [
      { to: '/admin/hotels', icon: <FaHotel className="text-2xl text-blue-600" />, label: 'Khách sạn', desc: 'CRUD khách sạn' },
      { to: '/admin/rooms', icon: <FaBed className="text-2xl text-emerald-600" />, label: 'Phòng', desc: 'Giá và tình trạng' },
      { to: '/admin/bookings', icon: <FaCalendarCheck className="text-2xl text-violet-600" />, label: 'Đặt phòng', desc: 'Xác nhận và hủy' },
      { to: '/admin/feedbacks', icon: <FaCommentDots className="text-2xl text-amber-600" />, label: 'Phản hồi', desc: 'Quản lý đánh giá' },
    ];

    if (user?.role === 'admin') {
      items.push({ to: '/admin/users', icon: <FaUsers className="text-2xl text-fuchsia-600" />, label: 'Tài khoản', desc: 'Khóa và đặt lại' });
    }

    return items;
  }, [user]);

  const summary = data.summary || {};
  const paymentBreakdown = data.payment_breakdown || {};

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm p-4 lg:sticky lg:top-24">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-gray-800">Chức năng</h2>
              <p className="text-xs text-gray-500">Quản trị hệ thống khách sạn</p>
            </div>

            <div className="space-y-2">
              {menuItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition border border-gray-100"
                >
                  <div className="p-2 bg-gray-50 rounded-xl">{item.icon}</div>
                  <div>
                    <div className="font-semibold text-gray-800 text-sm">{item.label}</div>
                    <div className="text-xs text-gray-500">{item.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        <section className="lg:col-span-9 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={range.from}
                    onChange={(e) => setRange((prev) => ({ ...prev, from: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={range.to}
                    onChange={(e) => setRange((prev) => ({ ...prev, to: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={() => loadDashboard(range)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                >
                  Áp dụng
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {[7, 14, 30].map((days) => (
                  <button
                    key={days}
                    onClick={() => {
                      const to = new Date();
                      const from = new Date();
                      from.setDate(from.getDate() - (days - 1));
                      const nextRange = {
                        from: from.toISOString().split('T')[0],
                        to: to.toISOString().split('T')[0],
                      };
                      setRange(nextRange);
                      loadDashboard(nextRange);
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-semibold transition"
                  >
                    {days} ngày
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[
              { label: 'Khách sạn', value: summary.hotels, icon: <FaHotel /> },
              { label: 'Tổng booking', value: summary.bookings, icon: <FaCalendarCheck /> },
              { label: 'Doanh thu đã thu', value: formatCurrencyVND(summary.revenue_paid), icon: <FaMoneyBillWave /> },
              { label: 'Tỷ lệ lấp đầy', value: `${Number(summary.occupancy_rate || 0).toFixed(1)}%`, icon: <FaBed /> },
              { label: 'Sức chứa phòng', value: summary.room_inventory, icon: <FaBed /> },
              { label: 'Phản hồi', value: summary.feedback_count, icon: <FaCommentDots /> },
            ].map((item) => (
              <div key={item.label} className="bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4">
                <div className="bg-blue-600 text-white p-3 rounded-xl text-xl">{item.icon}</div>
                <div>
                  <p className="text-gray-500 text-sm">{item.label}</p>
                  <p className="text-2xl font-bold text-gray-800">{item.value ?? 0}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-gray-800">Doanh thu theo ngày</h3>
                  <p className="text-gray-500 text-sm">Theo booking đã xác nhận và đã thu tiền</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Tổng</p>
                  <p className="font-bold text-gray-800">{formatCurrencyVND(summary.revenue_paid)}</p>
                </div>
              </div>
              {loading ? <div className="text-gray-500 text-sm">Đang tải...</div> : <RevenueBars data={data.trend_revenue || []} />}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-gray-800">Thanh toán và công suất</h3>
                  <p className="text-gray-500 text-sm">Theo khoảng ngày đang chọn</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Lợi nhuận ước tính</p>
                  <p className="font-bold text-gray-800">{formatCurrencyVND(summary.profit)}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">Đã thu</span>
                    <span className="text-sm font-semibold text-green-700">{paymentBreakdown.paid || 0}</span>
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">Chưa thu</span>
                    <span className="text-sm font-semibold text-blue-700">{paymentBreakdown.unpaid || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Hoàn tiền</span>
                    <span className="text-sm font-semibold text-red-700">{paymentBreakdown.refunded || 0}</span>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-4">
                  <p className="text-sm text-blue-700 mb-1">Công suất sử dụng phòng</p>
                  <p className="text-2xl font-bold text-blue-800">{Number(summary.occupancy_rate || 0).toFixed(1)}%</p>
                  <p className="text-xs text-blue-700 mt-1">
                    {summary.occupied_room_nights || 0} / {summary.available_room_nights || 0} room-nights
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-gray-800">Top khách sạn theo doanh thu</h3>
                  <p className="text-gray-500 text-sm">Top 5 khách sạn có doanh thu cao nhất</p>
                </div>
              </div>

              {data.top_hotels?.length ? (
                <div className="space-y-3">
                  {data.top_hotels.map((item, index) => (
                    <div key={item.hotel_id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-800">#{index + 1} {item.hotel_name}</p>
                          <p className="text-xs text-gray-500">{item.bookings_count} booking xác nhận</p>
                        </div>
                        <p className="font-bold text-blue-700">{formatCurrencyVND(item.revenue_paid)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Chưa có dữ liệu doanh thu</div>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-gray-800">Booking gần đây</h3>
                  <p className="text-gray-500 text-sm">Danh sách giao dịch mới nhất</p>
                </div>
              </div>

              {data.recent_bookings?.length ? (
                <div className="space-y-3">
                  {data.recent_bookings.map((item) => (
                    <div key={item.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-800">{item.hotel_name}</p>
                          <p className="text-sm text-gray-500">{item.user_name} · {item.room_type}</p>
                          <p className="text-xs text-gray-400 mt-1">{formatDateTimeVi(item.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-blue-700">{formatCurrencyVND(item.amount)}</p>
                          <p className="text-xs text-gray-500">{item.status}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Chưa có booking trong khoảng này</div>
              )}
            </div>
          </div>

          {user?.role === 'admin' && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800">He thong - Cau hinh email gui</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Email nay se duoc dung lam nguoi gui cho email xac nhan dang ky, dat phong, thanh toan...
              </p>
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="email"
                  value={systemEmailSender}
                  onChange={(e) => setSystemEmailSender(e.target.value)}
                  placeholder="no-reply@yourdomain.com"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={saveSystemSettings}
                  disabled={systemSaving}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
                >
                  {systemSaving ? 'Dang luu...' : 'Luu cau hinh'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
