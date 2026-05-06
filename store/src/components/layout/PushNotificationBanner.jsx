import React, { useState, useEffect } from 'react';
import axios from '../../services/axiosConfig'; //   axios  
import { Bell, X } from 'lucide-react';
import useAuth from '../../context/auth/useAuth';
import { useTranslation } from 'react-i18next';

// ️    PUBLIC KEY  
const PUBLIC_VAPID_KEY = 'BGKKmw1d77IRMGDvIkfXw09ngBxfuNNxjJQeEtcz5N5oqKhSonKez2x-HbXZDbUTGudFoEh3fcTZ33aV1ZVYfmg';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

const PushNotificationBanner = () => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const isOptedOut = localStorage.getItem('hide_push_banner') === 'true';
        if (Notification.permission === 'default' && !isOptedOut) {
            //   3  
            const timer = setTimeout(() => setShowBanner(true), 3000);
            return () => clearTimeout(timer);
        }
    },[user]);

    const handleAllow = async () => {
        setShowBanner(false);
        const permission = await Notification.requestPermission();

        if (permission === 'granted') {
            try {
                const registration = await navigator.serviceWorker.ready;
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
                });

                await axios.post('/webpush/save_information/', {
                    status_type: 'subscribe',
                    subscription: subscription.toJSON(),
                    browser: navigator.userAgent,
                });
            } catch (error) {
                console.error("Web Push Error:", error);
            }
        } else {
            localStorage.setItem('hide_push_banner', 'true');
        }
    };

    const handleDismiss = () => {
        setShowBanner(false);
        localStorage.setItem('hide_push_banner', 'true');
    };

    if (!showBanner) return null;

    return (
        <div className="fixed bottom-20 lg:bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white p-4 rounded-2xl shadow-2xl border border-primary/20 z-[9999] animate-fade-in-up">
            <button onClick={handleDismiss} className="absolute top-2 left-2 text-gray-400 hover:text-red-500">
                <X size={18} />
            </button>
            <div className="flex items-start gap-3">
                <div className="bg-primary/10 p-2 rounded-full text-primary">
                    <Bell size={24} className="animate-pulse" />
                </div>
                <div>
                    <h6 className="font-bold text-dark mb-1">{t('notifications.enable_push_title')}</h6>
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                        {t('notifications.enable_push_desc')}
                    </p>
                    <div className="flex gap-2">
                        <button onClick={handleAllow} className="bg-primary text-white px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-primary-dark transition-all">
                            {t('common.agree')}
                        </button>
                        <button onClick={handleDismiss} className="bg-gray-100 text-gray-600 px-4 py-1.5 rounded-lg text-xs font-bold hover:bg-gray-200 transition-all">
                            {t('common.not_now')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PushNotificationBanner;
