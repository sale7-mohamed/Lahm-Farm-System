import React, { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

const PWAInstallPrompt = () => {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const[showPrompt, setShowPrompt] = useState(false);
    const [isIOS, setIsIOS] = useState(false);

    useEffect(() => {
        // 1.     (   )
        const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        if (!isMobileDevice) return;

        const checkIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        setIsIOS(checkIOS);

        const handleBeforeInstallPrompt = (e) => {
            e.preventDefault();
            setDeferredPrompt(e);
            checkAndShowPrompt();
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        //  (    )
        if (checkIOS && !window.navigator.standalone) {
            checkAndShowPrompt();
        }

        return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    },[]);

    const checkAndShowPrompt = () => {
        const dismissDate = localStorage.getItem('pwa_dismissed_until');
        const now = Date.now();
        //        14  
        if (!dismissDate || now > parseInt(dismissDate, 10)) {
            setTimeout(() => setShowPrompt(true), 3000); //    3 
        }
    };

    const handleInstallClick = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setShowPrompt(false);
            }
            setDeferredPrompt(null);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        //    + 14 
        const fourteenDaysLater = Date.now() + (14 * 24 * 60 * 60 * 1000);
        localStorage.setItem('pwa_dismissed_until', fourteenDaysLater.toString());
    };

    if (!showPrompt) return null;

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-white p-4 rounded-[1.5rem] shadow-[0_10px_40px_rgba(25,135,84,0.15)] border-2 border-primary/20 z-[9999] animate-fade-in-up">
            <button onClick={handleDismiss} className="absolute top-3 left-3 bg-gray-50 p-1 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                <X size={18} />
            </button>
            <div className="flex items-start gap-3 mt-1">
                <div className="bg-gradient-to-br from-primary to-green-600 p-0.5 rounded-2xl shadow-md shrink-0">
                    <img src="/icon-192x192.png" alt="App Icon" className="w-12 h-12 rounded-[14px] bg-white object-cover" />
                </div>
                <div className="flex-grow">
                    <h6 className="font-black text-dark mb-1 text-base">تطبيق متجر لَحِم 🥩</h6>
                    <p className="text-xs text-gray-500 mb-3 leading-relaxed font-medium">
                        ثبت التطبيق الآن لطلب الأضاحي واللحوم بضغطة زر وتتبع طلباتك بسهولة!
                    </p>
                    {isIOS ? (
                        <div className="text-[11px] font-bold text-blue-700 bg-blue-50 p-2.5 rounded-xl border border-blue-100 flex items-start gap-2">
                            <Smartphone size={16} className="shrink-0 mt-0.5" />
                            <span>لتثبيت التطبيق: اضغط على زر المشاركة <b>(Share)</b> بالأسفل، ثم اختر <b>(Add to Home Screen)</b></span>
                        </div>
                    ) : (
                        <button
                            onClick={handleInstallClick}
                            className="w-full bg-primary text-white h-10 rounded-xl text-sm font-bold shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Download size={16} />
                            تثبيت التطبيق
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PWAInstallPrompt;
