/**
 * admin/Dashboard.js
 * Mục đích: Trang tổng quan (dashboard) dành cho admin/nhân viên, hiển thị
 * số liệu thống kê doanh thu, số đặt phòng, tỷ lệ lấp đầy, biểu đồ xu
 * hướng doanh thu, top khách sạn và cấu hình email gửi hệ thống.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import {
  FaArrowDown,
  FaArrowUp,
  FaBed,
  FaCalendarCheck,
  FaCommentDots,
  FaHotel,
  FaMoneyBillWave,
  FaUsers,
} from 'react-icons/fa';
import { formatCurrencyVND, formatDateTimeVi } from '../../utils/format';

const QUICK_RANGES = [
  { days: 7, label: '7 ngày' },
  { days: 14, label: '14 ngày' },
  { days: 30, label: '30 ngày' },
  { days: 90, label: '3 tháng' },
  { days: 365, label: '12 tháng' },
  { days: 365 * 3, label: '3 năm' },
];

const STATUS_STYLES = {
  confirmed: { label: 'Đã xác nhận', className: 'bg-emerald-50 text-emerald-700' },
  pending: { label: 'Chờ xử lý', className: 'bg-amber-50 text-amber-700' },
  cancelled: { label: 'Đã hủy', className: 'bg-red-50 text-red-700' },
};

const PAYMENT_COLORS = { paid: '#10b981', unpaid: '#3b82f6', refunded: '#ef4444' };

function formatRangeDate(value) {
  return value.toISOString().split('T')[0];
}

function computePreviousRange(from, to) {
  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  const spanDays = Math.max(1, Math.round((toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1);
  const prevTo = new Date(fromDate);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (spanDays - 1));
  return { from: formatRangeDate(prevFrom), to: formatRangeDate(prevTo) };
}

function computeDelta(current, previous) {
  const curr = Number(current || 0);
  const prev = Number(previous || 0);
  if (prev === 0) {
    if (curr === 0) return null;
    return { percent: 100, up: true };
  }
  const percent = ((curr - prev) / prev) * 100;
  return { percent: Math.abs(percent), up: percent >= 0 };
}

function DeltaBadge({ delta }) {
  if (!delta) return null;
  const isFlat = delta.percent < 0.5;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
        isFlat
          ? 'bg-gray-100 text-gray-500'
          : delta.up
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-red-50 text-red-700'
      )}
    >
      {!isFlat && (delta.up ? <FaArrowUp size={9} /> : <FaArrowDown size={9} />)}
      {isFlat ? '0%' : `${delta.percent.toFixed(1)}%`}
    </span>
  );
}

function StatCard({ label, value, icon, gradient, delta }) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 shadow-sm">
      <div
        className={cn('absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-10', gradient)}
        aria-hidden="true"
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
          <p className="mt-1.5 truncate text-2xl font-bold text-gray-800">{value ?? 0}</p>
          <div className="mt-2 h-5">
            <DeltaBadge delta={delta} />
          </div>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg text-white shadow-md', gradient)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

function RevenueTrendChart({ data, loading, unitLabel }) {
  if (loading) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-500">Đang tải...</div>;
  }

  if (!data.length) {
    return <div className="flex h-64 items-center justify-center text-sm text-gray-500">Chưa có dữ liệu doanh thu</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563eb" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          interval={data.length > 20 ? Math.ceil(data.length / 10) : 0}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          width={64}
          tickFormatter={(value) => (value >= 1000000 ? `${(value / 1000000).toFixed(0)}tr` : value)}
        />
        <Tooltip
          formatter={(value) => [formatCurrencyVND(value), 'Doanh thu']}
          labelFormatter={(label) => `${unitLabel === 'ngày' ? 'Ngày' : unitLabel === 'tháng' ? 'Tháng' : 'Năm'} ${label}`}
          contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="#2563eb"
          strokeWidth={2.5}
          fill="url(#revenueGradient)"
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function PaymentDonut({ breakdown }) {
  const chartData = [
    { key: 'paid', name: 'Đã thu', value: Number(breakdown.paid || 0) },
    { key: 'unpaid', name: 'Chưa thu', value: Number(breakdown.unpaid || 0) },
    { key: 'refunded', name: 'Hoàn tiền', value: Number(breakdown.refunded || 0) },
  ];
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return <div className="flex h-40 items-center justify-center text-sm text-gray-500">Chưa có giao dịch</div>;
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-36 w-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={42}
              outerRadius={64}
              paddingAngle={2}
              strokeWidth={0}
            >
              {chartData.map((entry) => (
                <Cell key={entry.key} fill={PAYMENT_COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value} booking`, name]}
              contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2.5">
        {chartData.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2 text-gray-700">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[item.key] }} />
              {item.name}
            </span>
            <span className="font-semibold text-gray-800">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const RANK_STYLES = [
  'bg-gradient-to-br from-amber-400 to-amber-600',
  'bg-gradient-to-br from-slate-300 to-slate-500',
  'bg-gradient-to-br from-orange-400 to-orange-600',
];

function TopHotelsList({ hotels }) {
  if (!hotels.length) {
    return <div className="text-sm text-gray-500">Chưa có dữ liệu doanh thu</div>;
  }

  const maxRevenue = Math.max(...hotels.map((h) => Number(h.revenue_paid || 0)), 1);

  return (
    <div className="space-y-3">
      {hotels.map((item, index) => {
        const share = (Number(item.revenue_paid || 0) / maxRevenue) * 100;
        return (
          <div key={item.hotel_id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white shadow-sm',
                    RANK_STYLES[index] || 'bg-gray-300'
                  )}
                >
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-800">{item.hotel_name}</p>
                  <p className="text-xs text-gray-500">{item.bookings_count} booking xác nhận</p>
                </div>
              </div>
              <p className="shrink-0 font-bold text-blue-700">{formatCurrencyVND(item.revenue_paid)}</p>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-600"
                style={{ width: `${Math.max(4, share)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Dashboard Component (Trang Tổng quan Admin)
 * Hiển thị các chỉ số thống kê (Doanh thu, số lượng phòng, tỷ lệ lấp đầy) cho Admin/Manager.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState(() => {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 13);
    return { from: formatRangeDate(from), to: formatRangeDate(now) };
  });
  const [activeQuickRange, setActiveQuickRange] = useState(14);
  const [data, setData] = useState({
    summary: {},
    payment_breakdown: {},
    trend_revenue: [],
    top_hotels: [],
    recent_bookings: [],
  });
  const [previousSummary, setPreviousSummary] = useState(null);
  const [systemEmailSender, setSystemEmailSender] = useState('');
  const [systemSaving, setSystemSaving] = useState(false);

  const loadDashboard = async (nextRange = range) => {
    setLoading(true);
    try {
      const prevRange = computePreviousRange(nextRange.from, nextRange.to);
      const [currentRes, previousRes] = await Promise.all([
        api.get('/admin/dashboard', { params: nextRange }),
        api.get('/admin/dashboard', { params: prevRange }),
      ]);
      setData(currentRes.data);
      setPreviousSummary(previousRes.data?.summary || null);
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
  const trendUnitLabel = { day: 'ngày', month: 'tháng', year: 'năm' }[data.trend_unit] || 'ngày';

  const deltas = useMemo(() => {
    if (!previousSummary) return {};
    return {
      revenue: computeDelta(data.summary?.revenue_paid, previousSummary.revenue_paid),
      bookings: computeDelta(data.summary?.bookings, previousSummary.bookings),
      occupancy: computeDelta(data.summary?.occupancy_rate, previousSummary.occupancy_rate),
      feedback: computeDelta(data.summary?.feedback_count, previousSummary.feedback_count),
    };
  }, [data.summary, previousSummary]);

  const applyQuickRange = (days) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    const nextRange = { from: formatRangeDate(from), to: formatRangeDate(to) };
    setRange(nextRange);
    setActiveQuickRange(days);
    loadDashboard(nextRange);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Tổng quan hoạt động kinh doanh · so với kỳ trước liền kề cùng độ dài
          </p>
        </div>
      </div>

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
                    onChange={(e) => { setActiveQuickRange(null); setRange((prev) => ({ ...prev, from: e.target.value })); }}
                    className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Đến ngày</label>
                  <input
                    type="date"
                    value={range.to}
                    onChange={(e) => { setActiveQuickRange(null); setRange((prev) => ({ ...prev, to: e.target.value })); }}
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
                {QUICK_RANGES.map(({ days, label }) => (
                  <button
                    key={days}
                    onClick={() => applyQuickRange(days)}
                    className={cn(
                      'px-3 py-2 rounded-xl text-xs font-semibold transition',
                      activeQuickRange === days
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard
              label="Doanh thu đã thu"
              value={formatCurrencyVND(summary.revenue_paid)}
              icon={<FaMoneyBillWave />}
              gradient="bg-gradient-to-br from-blue-500 to-blue-700"
              delta={deltas.revenue}
            />
            <StatCard
              label="Tổng booking"
              value={summary.bookings}
              icon={<FaCalendarCheck />}
              gradient="bg-gradient-to-br from-violet-500 to-violet-700"
              delta={deltas.bookings}
            />
            <StatCard
              label="Tỷ lệ lấp đầy"
              value={`${Number(summary.occupancy_rate || 0).toFixed(1)}%`}
              icon={<FaBed />}
              gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
              delta={deltas.occupancy}
            />
            <StatCard
              label="Phản hồi"
              value={summary.feedback_count}
              icon={<FaCommentDots />}
              gradient="bg-gradient-to-br from-amber-500 to-amber-600"
              delta={deltas.feedback}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            <StatCard label="Khách sạn" value={summary.hotels} icon={<FaHotel />} gradient="bg-gradient-to-br from-sky-500 to-sky-700" />
            <StatCard label="Sức chứa phòng" value={summary.room_inventory} icon={<FaBed />} gradient="bg-gradient-to-br from-teal-500 to-teal-700" />
            <StatCard
              label="Lợi nhuận ước tính"
              value={formatCurrencyVND(summary.profit)}
              icon={<FaMoneyBillWave />}
              gradient="bg-gradient-to-br from-rose-500 to-rose-700"
            />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <h3 className="font-bold text-gray-800">Doanh thu theo {trendUnitLabel}</h3>
                  <p className="text-gray-500 text-sm">Theo booking đã xác nhận và đã thu tiền</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Tổng</p>
                  <p className="font-bold text-gray-800">{formatCurrencyVND(summary.revenue_paid)}</p>
                </div>
              </div>
              <RevenueTrendChart data={data.trend_revenue || []} loading={loading} unitLabel={trendUnitLabel} />
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <h3 className="font-bold text-gray-800">Thanh toán và công suất</h3>
                  <p className="text-gray-500 text-sm">Theo khoảng ngày đang chọn</p>
                </div>
              </div>

              <div className="space-y-4">
                <PaymentDonut breakdown={paymentBreakdown} />

                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-sm text-blue-700 mb-1">Công suất sử dụng phòng</p>
                  <p className="text-2xl font-bold text-blue-800">{Number(summary.occupancy_rate || 0).toFixed(1)}%</p>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-blue-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-700"
                      style={{ width: `${Math.min(100, Number(summary.occupancy_rate || 0))}%` }}
                    />
                  </div>
                  <p className="text-xs text-blue-700 mt-2">
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

              <TopHotelsList hotels={data.top_hotels || []} />
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
                  {data.recent_bookings.map((item) => {
                    const statusStyle = STATUS_STYLES[item.status] || { label: item.status, className: 'bg-gray-100 text-gray-600' };
                    return (
                      <div key={item.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-gray-800">{item.hotel_name}</p>
                            <p className="truncate text-sm text-gray-500">{item.user_name} · {item.room_type}</p>
                            <p className="text-xs text-gray-400 mt-1">{formatDateTimeVi(item.createdAt)}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-bold text-blue-700">{formatCurrencyVND(item.amount)}</p>
                            <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', statusStyle.className)}>
                              {statusStyle.label}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-gray-500 text-sm">Chưa có booking trong khoảng này</div>
              )}
            </div>
          </div>

          {user?.role === 'admin' && (
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h3 className="font-bold text-gray-800">Hệ thống - Cấu hình email gửi</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Email này sẽ được dùng làm người gửi cho email xác nhận đăng ký, đặt phòng, thanh toán...
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
                  {systemSaving ? 'Đang lưu...' : 'Lưu cấu hình'}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
