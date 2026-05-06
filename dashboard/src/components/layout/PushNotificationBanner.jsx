import React, { useState, useEffect } from 'react';
import axios from '../../api/axiosConfig'; //    axios  
import { Bell, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth'; //    Auth  

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
    const { user } = useAuth();
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        if (!user || !('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const isOptedOut = localStorage.getItem('hide_push_banner') === 'true';
        if (Notification.permission === 'default' && !isOptedOut) {
            const timer = setTimeout(() => setShowBanner(true), 2000);
            return () => clearTimeout(timer);
        }
    }, [user]);

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
        <div className="position-fixed bottom-0 start-0 m-4 bg-white p-3 rounded-4 shadow-lg border border-primary z-3" style={{ width: '350px' }}>
            <button onClick={handleDismiss} className="position-absolute top-0 end-0 m-2 btn btn-link text-secondary p-0">
                <X size={18} />
            </button>
            <div className="d-flex align-items-start gap-3">
                <div className="bg-primary bg-opacity-10 p-2 rounded-circle text-primary">
                    <Bell size={24} className="animate-pulse" />
                </div>
                <div>
                    <h6 className="fw-bold text-dark mb-1">إشعارات النظام</h6>
                    <p className="text-muted small mb-2">
                        يرجى تفعيل الإشعارات لتلقي تنبيهات الطلبات الجديدة ورسائل الإدارة فوراً.
                    </p>
                    <div className="d-flex gap-2">
                        <button onClick={handleAllow} className="btn btn-primary btn-sm fw-bold">
                            تفعيل
                        </button>
                        <button onClick={handleDismiss} className="btn btn-light border btn-sm fw-bold">
                            تخطي
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PushNotificationBanner;
