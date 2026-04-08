import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import { Toaster } from 'react-hot-toast';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
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