/**
 * Hàm định dạng số tiền thành chuỗi tiền tệ Việt Nam Đồng (VND).
 * Ví dụ: 1000000 -> "1.000.000đ"
 */
export function formatCurrencyVND(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export function formatDateVi(value) {
  return new Date(value).toLocaleDateString('vi-VN');
}

export function formatDateTimeVi(value) {
  return new Date(value).toLocaleString('vi-VN');
}
