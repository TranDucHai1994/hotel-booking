/**
 * AdminRoute.js
 * Mục đích: Guard component bảo vệ các route chỉ dành cho admin/manager,
 * chuyển hướng người dùng chưa đăng nhập hoặc không đủ quyền sang trang khác.
 */

import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * AdminRoute Component
 * Component đóng vai trò như một màng lọc (Guard) bảo vệ các route dành riêng cho Admin/Manager.
 * Nếu chưa đăng nhập -> Đẩy về trang /login.
 * Nếu không đủ quyền -> Đẩy về trang chủ (/).
 */
export default function AdminRoute() {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (!['admin', 'manager'].includes(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
