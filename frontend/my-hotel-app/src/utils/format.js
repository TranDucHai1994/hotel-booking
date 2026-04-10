export function formatCurrencyVND(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export function formatDateVi(value) {
  return new Date(value).toLocaleDateString('vi-VN');
}

export function formatDateTimeVi(value) {
  return new Date(value).toLocaleString('vi-VN');
}
