const BOOKING_STATUS_META = {
  pending: {
    colorClass: 'bg-yellow-100 text-yellow-700',
    plainText: 'Chờ xác nhận',
    decoratedText: '⏳ Chờ xác nhận',
  },
  confirmed: {
    colorClass: 'bg-green-100 text-green-700',
    plainText: 'Đã xác nhận',
    decoratedText: '✅ Đã xác nhận',
  },
  cancelled: {
    colorClass: 'bg-red-100 text-red-700',
    plainText: 'Đã hủy',
    decoratedText: '❌ Đã hủy',
  },
};

export function getBookingStatusMeta(status, options = {}) {
  const { decorated = false } = options;
  const meta = BOOKING_STATUS_META[status] || BOOKING_STATUS_META.pending;

  return {
    colorClass: meta.colorClass,
    text: decorated ? meta.decoratedText : meta.plainText,
  };
}
