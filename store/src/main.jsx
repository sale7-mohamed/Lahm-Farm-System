import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './i18n';

import AuthProvider from './context/auth/AuthProvider';
import { AppProvider } from './context/app/AppProvider';

if (typeof window !== 'undefined') {
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (!isTouchDevice) {
    document.body.classList.add('force-desktop');
    document.documentElement.classList.add('force-desktop');
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <AppProvider>
        <App />
      </AppProvider>
    </AuthProvider>
  </React.StrictMode>
);
