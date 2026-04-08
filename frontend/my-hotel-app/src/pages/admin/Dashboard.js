import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { FaHotel, FaBed, FaCalendarCheck, FaUsers } from 'react-icons/fa';

function formatVND(n) {
  const num = Number(n || 0);
  return `${num.toLocaleString('vi-VN')}đ`;
}

function formatCompact(n) {
  const num = Number(n || 0);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return `${num}`;
}

function lastNDays(n) {
  const days = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  return days;
}

function startOfDayLocal(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDayLocal(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function toDateInputValue(d) {
  const x = new Date(d);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateInputValue(s) {
  // "YYYY-MM-DD" -> local date
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  const x = new Date(y, m - 1, d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetweenInclusive(from, to) {
  const start = startOfDayLocal(from);
  const end = startOfDayLocal(to);
  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

function dateKeyLocal(d) {
  // stable key by local time (avoid timezone UTC shifts)
  const dd = new Date(d);
  return `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
}

function formatVNDateInput(value) {
  // value: YYYY-MM-DD
  const d = fromDateInputValue(value);
  if (!d) return value;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function DailyRevenueChart({ values = [], labels = [] }) {
  const barAreaHeight = 140;
  const minBarHeight = 4; // ensure 0 values still visible (gray baseline)
  const max = Math.max(...values.map(v => Number(v || 0)), 0);
  const denom = max > 0 ? max : 1;

  const len = values.length;
  const getTickIndices = () => {
    if (len <= 14) return Array.from({ length: len }, (_, i) => i);
    // For longer ranges, show fewer ticks to keep labels readable
    return [0, Math.floor(len / 2), len - 1];
  };
  const ticks = getTickIndices().filter(i => i >= 0 && i < len);

  return (
    <div className="relative w-full" style={{ height: `${barAreaHeight + 26}px` }}>
      <div className="absolute inset-x-0 bottom-6" style={{ height: `${barAreaHeight}px` }}>
        <div className="h-full w-full flex items-end gap-[6px] px-2">
          {values.map((v, i) => {
            const nv = Number(v || 0);
            const isZero = nv <= 0;
            const h = Math.round(Math.max(minBarHeight, (nv / denom) * barAreaHeight));
            return (
              <div
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                title={`${labels[i] || `Ngày ${i + 1}`}: ${formatVND(nv)}`}
                className="w-full"
                style={{
                  flex: 1,
                  height: `${h}px`,
                  background: isZero ? '#e5e7eb' : '#3b82f6',
                  borderRadius: '10px',
                }}
              />
            );
          })}
        </div>
      </div>

      {ticks.map((i) => {
        const leftPct = len <= 1 ? 0 : (i / (len - 1)) * 100;
        return (
          <div
            key={i}
            className="absolute text-xs text-gray-500"
            style={{
              left: `${leftPct}%`,
              transform: 'translateX(-50%)',
              bottom: 0,
              width: 60,
              textAlign: 'center',
            }}
          >
            {labels[i] || ''}
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => {
    const days = lastNDays(14);
    const from = days[0];
    const to = days[days.length - 1];
    return { from: toDateInputValue(from), to: toDateInputValue(to) };
  });
  const [metrics, setMetrics] = useState({
    hotels: 0,
    bookings: 0,
    confirmed: 0,
    pending: 0,
    cancelled: 0,
    revenuePaid: 0,
    refunds: 0,
    profit: 0,
    revenuePending: 0,
    paidCount: 0,
    avgOrderValue: 0,
  });

  const [trendRevenue, setTrendRevenue] = useState([]); // last 14 days
  const [trendLabels, setTrendLabels] = useState([]);
  const [topHotels, setTopHotels] = useState([]); // { hotelName, revenuePaid }
  const [paymentBreakdown, setPaymentBreakdown] = useState({
    paid: 0,
    unpaid: 0,
    refunded: 0,
    paidRevenue: 0,
    refundedRevenue: 0,
    methodsPaidRevenue: {},
  });
  const [recentBookings, setRecentBookings] = useState([]);

  const loadDashboard = async ({ from, to }) => {
    setLoading(true);
    try {
      const [hotels, bookings] = await Promise.all([
        api.get('/hotels'),
        api.get('/bookings/all'),
      ]);
      const allBookings = Array.isArray(bookings.data) ? bookings.data : [];

      const fromDate = fromDateInputValue(from) || startOfDayLocal(new Date());
      const toDate = fromDateInputValue(to) || startOfDayLocal(new Date());
      const start = startOfDayLocal(fromDate);
      const end = endOfDayLocal(toDate);

      const bookingsData = allBookings.filter(b => {
        const dt = b.createdAt ? new Date(b.createdAt) : null;
        if (!dt || Number.isNaN(dt.getTime())) return false;
        return dt >= start && dt <= end;
      });

      const confirmed = bookingsData.filter(b => b.status === 'confirmed');
      const pending = bookingsData.filter(b => b.status === 'pending');
      const cancelled = bookingsData.filter(b => b.status === 'cancelled');

      // In current app, payment_status may stay "unpaid" after booking creation.
      // For a useful dashboard, treat mock_card/mock_momo as already collected.
      const isCollected = (b) => (
        b.payment_status === 'paid' ||
        b.payment_method === 'mock_card' ||
        b.payment_method === 'mock_momo'
      );

      const revenuePaid = confirmed
        .filter(isCollected)
        .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

      const paidCount = confirmed.filter(isCollected).length;

      const revenuePending = confirmed
        .filter(b => b.payment_status === 'unpaid' && !isCollected(b))
        .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

      const refunds = bookingsData
        .filter(b => b.payment_status === 'refunded')
        .reduce((sum, b) => sum + Number(b.total_amount || 0), 0);

      const profit = revenuePaid - refunds;

      const methodsPaidRevenue = bookingsData
        .filter(b => b.status === 'confirmed' && isCollected(b))
        .reduce((acc, b) => {
          const method = b.payment_method || 'unknown';
          acc[method] = (acc[method] || 0) + Number(b.total_amount || 0);
          return acc;
        }, {});

      // Revenue trend in selected date range (daily buckets)
      const days = daysBetweenInclusive(start, end);
      const dayKeys = days.map(dateKeyLocal);
      const label = days.map(d => `${d.getDate()}/${d.getMonth() + 1}`);
      const revenueByDay = dayKeys.reduce((acc, k) => { acc[k] = 0; return acc; }, {});

      for (const b of bookingsData) {
        if (b.status !== 'confirmed') continue;
        if (!isCollected(b)) continue;
        const dt = b.createdAt ? new Date(b.createdAt) : null;
        if (!dt || Number.isNaN(dt.getTime())) continue;
        const k = dateKeyLocal(dt);
        if (k in revenueByDay) revenueByDay[k] += Number(b.total_amount || 0);
      }

      const trend = dayKeys.map(k => revenueByDay[k] || 0);

      // Top hotels by paid revenue
      const hotelAgg = new Map();
      for (const b of bookingsData) {
        if (b.status !== 'confirmed') continue;
        if (!isCollected(b)) continue;
        const hid = b.hotel_id?._id ? String(b.hotel_id._id) : String(b.hotel_id || '');
        if (!hid) continue;
        const hotelName = b.hotel_id?.name || `Hotel ${hid}`;
        const prev = hotelAgg.get(hid) || { hotelName, revenuePaid: 0 };
        prev.revenuePaid += Number(b.total_amount || 0);
        hotelAgg.set(hid, prev);
      }

      const top = Array.from(hotelAgg.values())
        .sort((a, b) => b.revenuePaid - a.revenuePaid)
        .slice(0, 5);

      const recent = bookingsData
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6)
        .map(b => ({
          id: b._id,
          createdAt: b.createdAt,
          hotelName: b.hotel_id?.name || '',
          roomType: b.room_id?.room_type || '',
          amount: Number(b.total_amount || 0),
          status: b.status,
          paymentStatus: b.payment_status,
          paymentMethod: b.payment_method,
          userName: b.user_id?.full_name || '',
        }));

      setMetrics({
        hotels: hotels.data.length,
        bookings: bookingsData.length,
        confirmed: confirmed.length,
        pending: pending.length,
        cancelled: cancelled.length,
        revenuePaid,
        refunds,
        profit,
        revenuePending,
        paidCount,
        avgOrderValue: paidCount ? revenuePaid / paidCount : 0,
      });

      setTrendRevenue(trend);
      setTrendLabels(label);
      setTopHotels(top);
      setPaymentBreakdown({
        paid: paidCount,
        unpaid: confirmed.filter(b => !isCollected(b) && b.payment_status !== 'refunded').length,
        refunded: confirmed.filter(b => b.payment_status === 'refunded').length,
        paidRevenue: revenuePaid,
        refundedRevenue: refunds,
        methodsPaidRevenue,
      });
      setRecentBookings(recent);
      setLoading(false);
    } catch {
      setMetrics({
        hotels: 0,
        bookings: 0,
        confirmed: 0,
        pending: 0,
        cancelled: 0,
        revenuePaid: 0,
        refunds: 0,
        profit: 0,
        revenuePending: 0,
        paidCount: 0,
        avgOrderValue: 0,
      });
      setTrendRevenue([]);
      setTrendLabels([]);
      setTopHotels([]);
      setPaymentBreakdown({
        paid: 0,
        unpaid: 0,
        refunded: 0,
        paidRevenue: 0,
        refundedRevenue: 0,
        methodsPaidRevenue: {},
      });
      setRecentBookings([]);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const maxTrend = Math.max(...trendRevenue, 0);

  const menuItems = [
    { to: '/admin/hotels', icon: <FaHotel className="text-2xl text-blue-600" />, label: 'Khách sạn', desc: 'Thêm / sửa / xóa' },
    { to: '/admin/rooms', icon: <FaBed className="text-2xl text-purple-600" />, label: 'Phòng', desc: 'Thêm / sửa / xóa' },
    { to: '/admin/bookings', icon: <FaCalendarCheck className="text-2xl text-green-600" />, label: 'Đặt phòng', desc: 'Xác nhận / hủy' },
    { to: '/admin/users', icon: <FaUsers className="text-2xl text-fuchsia-600" />, label: 'Tài khoản', desc: 'Khóa / reset MK' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-800 mb-8">Admin Dashboard</h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sidebar menu */}
        <aside className="lg:col-span-3">
          <div className="bg-white rounded-2xl shadow-sm p-4 lg:sticky lg:top-24">
            <div className="mb-3">
              <h2 className="text-sm font-bold text-gray-800">Chức năng</h2>
              <p className="text-xs text-gray-500">Quản trị hệ thống</p>
            </div>

            <div className="space-y-2">
              {menuItems.map((m) => (
                <Link
                  key={m.to}
                  to={m.to}
                  className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 transition border border-gray-100"
                >
                  <div className="p-2 bg-gray-50 rounded-xl">{m.icon}</div>
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-800 text-sm truncate">{m.label}</div>
                    <div className="text-xs text-gray-500 truncate">{m.desc}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </aside>

        {/* Main dashboard */}
        <section className="lg:col-span-9">
          {/* Filters */}
          <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div className="flex flex-col md:flex-row gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Từ ngày</label>
                  <input
                    type="date"
                    value={range.from}
                    onChange={(e) => setRange(r => ({ ...r, from: e.target.value }))}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={range.to}
                    onChange={(e) => setRange(r => ({ ...r, to: e.target.value }))}
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

              <div className="flex gap-2 flex-wrap">
                {[
                  { n: 7, label: '7 ngày' },
                  { n: 14, label: '14 ngày' },
                  { n: 30, label: '30 ngày' },
                ].map(p => (
                  <button
                    key={p.n}
                    onClick={() => {
                      const days = lastNDays(p.n);
                      const next = { from: toDateInputValue(days[0]), to: toDateInputValue(days[days.length - 1]) };
                      setRange(next);
                      loadDashboard(next);
                    }}
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-semibold transition"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4">
              <div className="bg-blue-500 text-white p-3 rounded-xl text-xl"><FaHotel /></div>
              <div>
                <p className="text-gray-500 text-sm">Khách sạn</p>
                <p className="text-2xl font-bold text-gray-800">{metrics.hotels}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4">
              <div className="bg-green-500 text-white p-3 rounded-xl text-xl"><FaCalendarCheck /></div>
              <div>
                <p className="text-gray-500 text-sm">Tổng bookings</p>
                <p className="text-2xl font-bold text-gray-800">{metrics.bookings}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4">
              <div className="bg-purple-500 text-white p-3 rounded-xl text-xl"><FaUsers /></div>
              <div>
                <p className="text-gray-500 text-sm">Doanh thu (đã thu)</p>
                <p className="text-2xl font-bold text-gray-800">{formatVND(metrics.revenuePaid)}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4">
              <div className="bg-red-500 text-white p-3 rounded-xl text-xl">+</div>
              <div>
                <p className="text-gray-500 text-sm">Lợi nhuận ước tính</p>
                <p className="text-2xl font-bold text-gray-800">{formatVND(metrics.profit)}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Hoàn tiền: {formatCompact(metrics.refunds)} · Chưa trả: {formatCompact(metrics.revenuePending)}
                </p>
              </div>
            </div>
          </div>

          {/* Charts & insights */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-gray-800">
                Doanh thu theo khoảng ({formatVNDateInput(range.from)} - {formatVNDateInput(range.to)})
              </h3>
              <p className="text-gray-500 text-sm">`confirmed` & đã thu (`paid` hoặc mock_card/mock_momo)</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Max</p>
              <p className="font-bold text-gray-800">{formatVND(maxTrend)}</p>
            </div>
          </div>

          <div className="mt-2">
            <DailyRevenueChart values={trendRevenue} labels={trendLabels} />
          </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-bold text-gray-800">Trạng thái & thanh toán</h3>
              <p className="text-gray-500 text-sm">Tỷ lệ theo booking + breakdown đã thu</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Tổng</p>
              <p className="font-bold text-gray-800">{metrics.bookings}</p>
            </div>
          </div>

          {loading ? (
            <div className="text-gray-500 text-sm">Đang tải...</div>
          ) : (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">Đã thu</span>
                  <span className="text-sm font-semibold text-green-700">{paymentBreakdown.paid}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">Chưa thu</span>
                  <span className="text-sm font-semibold text-blue-700">{paymentBreakdown.unpaid}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-700">Hoàn tiền</span>
                  <span className="text-sm font-semibold text-red-700">{paymentBreakdown.refunded}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Doanh thu đã thu: <span className="font-semibold">{formatVND(paymentBreakdown.paidRevenue)}</span>
                  {' '}· Giá trị TB: <span className="font-semibold">{formatVND(metrics.avgOrderValue)}</span>
                </div>
              </div>

              {[
                { k: 'pending', label: 'Chờ xác nhận', count: metrics.pending, color: 'bg-yellow-500' },
                { k: 'confirmed', label: 'Đã xác nhận', count: metrics.confirmed, color: 'bg-green-500' },
                { k: 'cancelled', label: 'Đã hủy', count: metrics.cancelled, color: 'bg-red-500' },
              ].map(item => {
                const pct = metrics.bookings ? (item.count / metrics.bookings) * 100 : 0;
                return (
                  <div key={item.k} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-700">{item.label}</span>
                      <span className="text-sm font-semibold text-gray-800">{item.count}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`${item.color} h-2 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-xs text-gray-400 mt-2">{pct.toFixed(1)}%</div>
                  </div>
                );
              })}
            </div>
          )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 mt-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-bold text-gray-800">Top khách sạn theo doanh thu</h3>
            <p className="text-gray-500 text-sm">Top 5 theo `confirmed` & đã thu (`paid` hoặc mock_card/mock_momo)</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Tổng revenue</p>
            <p className="font-bold text-gray-800">{formatVND(metrics.revenuePaid)}</p>
          </div>
        </div>

        {topHotels.length === 0 ? (
          <div className="text-gray-500 text-sm">Chưa có dữ liệu doanh thu.</div>
        ) : (
          <div className="space-y-3">
            {topHotels.map((h, idx) => {
              const pct = metrics.revenuePaid ? (h.revenuePaid / metrics.revenuePaid) * 100 : 0;
              return (
                <div key={idx} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-gray-800 truncate">
                        #{idx + 1} {h.hotelName}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-blue-700 whitespace-nowrap">
                      {formatVND(h.revenuePaid)}
                    </div>
                  </div>
                  <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="text-xs text-gray-400 mt-2">{pct.toFixed(1)}%</div>
                </div>
              );
            })}
          </div>
        )}
          </div>

          {/* Recent bookings */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mt-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="font-bold text-gray-800">Hoạt động gần đây</h3>
            <p className="text-gray-500 text-sm">Danh sách booking mới nhất trong khoảng đang lọc</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Tổng</p>
            <p className="font-bold text-gray-800">{recentBookings.length}</p>
          </div>
        </div>

        {recentBookings.length === 0 ? (
          <div className="text-gray-500 text-sm">Chưa có booking trong khoảng này.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-gray-500">
                <tr>
                  <th className="py-2 pr-3 whitespace-nowrap">Ngày</th>
                  <th className="py-2 pr-3">Khách sạn</th>
                  <th className="py-2 pr-3">Phòng</th>
                  <th className="py-2 pr-3 whitespace-nowrap">Số tiền</th>
                  <th className="py-2 pr-3 whitespace-nowrap">Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {recentBookings.map((b) => {
                  const d = b.createdAt ? new Date(b.createdAt) : null;
                  const dateStr = d && !Number.isNaN(d.getTime())
                    ? d.toLocaleString('vi-VN')
                    : '';
                  const statusColor =
                    b.status === 'confirmed' ? 'bg-green-50 text-green-700 border-green-100' :
                    b.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-100' :
                    'bg-red-50 text-red-700 border-red-100';

                  return (
                    <tr key={b.id} className="border-t border-gray-100">
                      <td className="py-3 pr-3 whitespace-nowrap text-gray-700">{dateStr}</td>
                      <td className="py-3 pr-3 text-gray-700">{b.hotelName}</td>
                      <td className="py-3 pr-3 text-gray-600">{b.roomType}</td>
                      <td className="py-3 pr-3 whitespace-nowrap font-semibold text-blue-700">
                        {formatVND(b.amount)}
                      </td>
                      <td className="py-3 pr-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full border ${statusColor}`}>
                          {b.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
          </div>
        </section>
      </div>
    </div>
  );
}