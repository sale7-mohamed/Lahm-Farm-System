import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/app/useApp';
import { AlertTriangle, Clock, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PendingOrderBanner = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const { pendingOrder, triggerRefetch } = useApp();
    const navigate = useNavigate();
    const[timeLeft, setTimeLeft] = useState(null);
    const [isExpired, setIsExpired] = useState(false);

    useEffect(() => {
        if (!pendingOrder || isExpired) return;

        const orderDate = new Date(pendingOrder.created_at).getTime();
        const expiryTime = orderDate + 15 * 60 * 1000;

        const calculateTimeLeft = () => {
            const now = Date.now();
            const difference = expiryTime - now;
            if (difference <= 0) return null;
            return {
                minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
                seconds: Math.floor((difference % (1000 * 60)) / 1000)
            };
        };

        const initial = calculateTimeLeft();
        if (initial) {
            setTimeLeft(initial);
            const timer = setInterval(() => {
                const updated = calculateTimeLeft();
                if (updated) {
                    setTimeLeft(updated);
                } else {
                    clearInterval(timer);
                    if (!isExpired) {
                        setIsExpired(true);
                        triggerRefetch();
                    }
                }
            }, 1000);
            return () => clearInterval(timer);
        } else {
            if (!isExpired) {
                setIsExpired(true);
                triggerRefetch();
            }
        }
    },[pendingOrder, triggerRefetch, isExpired]);

    if (!pendingOrder || !timeLeft || isExpired) return null;

    return (
        <div className="fixed bottom-[75px] lg:bottom-6 left-2 right-2 lg:left-0 lg:right-0 z-[9999] pointer-events-none flex justify-center animate-fade-in-up">
            <div className="pointer-events-auto w-full max-w-3xl bg-white rounded-[1.25rem] shadow-[0_10px_40px_rgba(220,38,38,0.15)] border-2 border-red-100 p-3 lg:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="bg-red-50 p-2.5 rounded-full flex-shrink-0 animate-pulse text-red-500">
                        <AlertTriangle size={20} />
                    </div>
                    <div className="flex-grow">
                        <h4 className="font-bold text-dark text-sm lg:text-base mb-0.5">{t('orders_page.pending_order_title')}</h4>
                        <p className="text-gray-500 text-[10px] lg:text-xs mb-0 leading-tight">
                            {t('orders_page.pending_order_desc')}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0">
                    <div className="flex items-center justify-center gap-1.5 bg-red-50 text-red-600 px-3 py-2 rounded-xl font-mono text-sm lg:text-base font-bold border border-red-100 min-w-[80px]">
                        <Clock size={16} />
                        {String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
                    </div>
                    <button
                        onClick={() => navigate('/my-orders')}
                        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition-all whitespace-nowrap flex-grow sm:flex-grow-0 text-center active:scale-95 flex items-center justify-center gap-2"
                    >
                        {t('orders_page.go_to_pay')}
                        {isRtl ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PendingOrderBanner;
