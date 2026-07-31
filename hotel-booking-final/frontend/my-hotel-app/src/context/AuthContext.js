/**
 * AuthContext.js
 * Mục đích: Context quản lý trạng thái xác thực người dùng (user, token) toàn app,
 * cung cấp hàm login/logout và lưu trữ thông tin đăng nhập vào localStorage.
 */

import { createContext, useContext, useState } from 'react';

// Khởi tạo Context để chia sẻ dữ liệu (User, Token) ra toàn bộ app
const AuthContext = createContext();

/**
 * AuthProvider (Người cung cấp dữ liệu Auth)
 * Bọc bên ngoài <App /> (xem file index.js / App.js) để các component con có thể gọi lấy `user`, `login`, `logout`.
 */
export function AuthProvider({ children }) {
  // Lấy dữ liệu user từ LocalStorage ngay khi ứng dụng khởi động
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);