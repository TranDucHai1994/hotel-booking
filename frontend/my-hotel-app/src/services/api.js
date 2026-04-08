import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:4000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message;
    const isAuthError =
      status === 401 ||
      (status === 403 && (message === 'Token không hợp lệ' || message === 'Không có token'));

    if (isAuthError) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      try {
        // Avoid redirect loops if backend is down
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