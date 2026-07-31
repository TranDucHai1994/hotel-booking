/**
 * utils/cn.js
 * Mục đích: Hàm tiện ích nối các tên class CSS lại với nhau một cách có
 * điều kiện, dựa trên thư viện clsx, dùng chung cho các component.
 */
import clsx from 'clsx';

/**
 * Utility for conditionally joining classNames together.
 * Thin wrapper around clsx for consistency across components.
 */
export function cn(...inputs) {
  return clsx(inputs);
}

export default cn;
