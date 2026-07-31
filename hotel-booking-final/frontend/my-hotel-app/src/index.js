/**
 * index.js
 * Mục đích: Điểm khởi chạy (entry point) của ứng dụng React, render component
 * App vào thẻ #root trong public/index.html và cấu hình Toaster hiển thị
 * thông báo popup dùng chung cho toàn app.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Toaster } from 'react-hot-toast';

// Tìm thẻ <div id="root"> trong file public/index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render (Vẽ) toàn bộ ứng dụng React vào thẻ div đó
root.render(
  // StrictMode giúp React cảnh báo các lỗi tiềm ẩn trong quá trình phát triển (Chỉ chạy ở môi trường Dev)
  <React.StrictMode>
    {/* Toaster: Thư viện hiển thị thông báo popup (toast) ở góc màn hình */}
    <Toaster
      position="top-right"
      toastOptions={{
        success: {
          style: { background: '#22c55e', color: '#fff', fontWeight: '500' },
          iconTheme: { primary: '#fff', secondary: '#22c55e' },
        },
        error: {
          style: { background: '#ef4444', color: '#fff', fontWeight: '500' },
          iconTheme: { primary: '#fff', secondary: '#ef4444' },
        },
        duration: 3000,
      }}
    />
    <App />
  </React.StrictMode>
);