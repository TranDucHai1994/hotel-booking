/**
 * services/api.js
 * Mục đích: Tạo và cấu hình một instance Axios dùng chung cho toàn bộ
 * frontend, tự động gắn token xác thực vào request và tự động đăng xuất
 * / chuyển hướng về trang đăng nhập khi phát hiện token không hợp lệ.
 */
import axios from 'axios';

/**
 * Cấu hình Axios chung (api.js)
 * Mục đích: Tạo một instance (bản sao) của Axios với cấu hình sẵn:
 * 1. Base URL mặc định (http://localhost:4000/api)
 * 2. Tự động đính kèm Token vào Header mỗi khi gửi request (Interceptor Request).
 * 3. Tự động kiểm tra Token hết hạn/lỗi và điều hướng về trang đăng nhập (Interceptor Response).
 */
const api = axios.create({
  baseURL: 'http://localhost:4000/api',
});

// === Interceptor Request: Chạy trước khi request được gửi đi ===
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// === Interceptor Response: Chạy khi nhận được kết quả từ Backend ===
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;
    const authMessages = [
      'Token khong hop le',
      'Khong co token',
      'Token không hợp lệ',
      'Không có token',
    ];

    const isAuthError = status === 401 || (status === 403 && authMessages.includes(message));

    if (isAuthError) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      try {
        if (window.location.pathname !== '/login') window.location.assign('/login');
      } catch {
        // ignore
      }
      error.__authRedirect = true;
    }

    return Promise.reject(error);
  }
);

export default api;
