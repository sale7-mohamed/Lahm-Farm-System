import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { AuthProvider } from './context/AuthProvider';
import { ChatProvider } from './context/ChatProvider';
import { OnFarmSaleProvider } from './context/OnFarmSaleProvider.jsx';
import { CallProvider } from './context/CallProvider.jsx';
import { preventZoomOnFocus, enableSmoothScroll } from './utils/responsive';

if (typeof window !== 'undefined') {
    preventZoomOnFocus();
    enableSmoothScroll();

    if ('ontouchstart' in window) {
        document.documentElement.classList.add('touch-device');
    }

    if ('loading' in HTMLImageElement.prototype) {
        document.querySelectorAll('img[loading="lazy"]').forEach(img => {
            img.loading = 'lazy';
        });
    }
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AuthProvider>
            <ChatProvider>
                <OnFarmSaleProvider>
                    <CallProvider>
                        <App />
                    </CallProvider>
                </OnFarmSaleProvider>
            </ChatProvider>
        </AuthProvider>
    </React.StrictMode>
);
