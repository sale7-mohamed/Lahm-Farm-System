import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import useAuth from '../../context/auth/useAuth';
import { useTranslation } from 'react-i18next';

const DiscountTicker = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const { user, globalDiscount, loading: authLoading } = useAuth();
    const [displayMessage, setDisplayMessage] = useState("");
    const [isVisible, setIsVisible] = useState(false);
    const [duration, setDuration] = useState(0);
    const tickerRef = useRef(null);

    const SPEED_MOBILE = 50;
    const SPEED_DESKTOP = 89;

    useEffect(() => {
        const now = new Date();
        const isDateRangeValid = (startDateStr, endDateStr) => {
            if (!startDateStr && !endDateStr) return true;
            const start = startDateStr ? new Date(startDateStr) : null;
            const end = endDateStr ? new Date(endDateStr) : null;
            if (start && now < start) return false;
            if (end && now > end) return false;
            return true;
        };

        let msg = "";

        if (user && user.is_discount_active && isDateRangeValid(user.discount_start_date, user.discount_end_date)) {
            const userPercent = parseFloat(user.special_discount_percentage || 0);
            const userFixed = parseFloat(user.special_discount_amount || 0);

            const maxAnimals = parseInt(user.discount_max_animals) || 0;
            const usedAnimals = parseInt(user.discount_used_animals) || 0;
            const limit_valid = maxAnimals === 0 || usedAnimals < maxAnimals;

            if (limit_valid && (userPercent > 0 || userFixed > 0)) {
                if (user.discount_custom_message) {
                    msg = user.discount_custom_message;
                } else {
                    const scope = user.discount_applies_to_services ? t('ticker.all_products_services') : t('ticker.all_livestock');
                    if (user.special_discount_type === 'fixed' || userFixed > 0) {
                        msg = `أهلاً ${user.full_name.split(' ')[0]}، تم تفعيل قسيمة خصم بقيمة ${userFixed} ج.م على إجمالي طلبك!`;
                    } else {
                        msg = t('ticker.user_discount_msg', { percent: userPercent, scope });
                    }
                }
            }
        }
        else if (globalDiscount && globalDiscount.is_active && isDateRangeValid(globalDiscount.start_date, globalDiscount.end_date)) {
            const globalPercent = parseFloat(globalDiscount.percentage || 0);
            const allowed = user ? user.allow_global_discount : true;

            if (allowed && globalPercent > 0) {
                if (globalDiscount.ticker_message?.trim()) {
                    msg = globalDiscount.ticker_message;
                } else {
                    const scopeText = globalDiscount.applies_to_services ? t('ticker.all_orders_services') : t('ticker.all_orders');
                    msg = t('ticker.global_discount_msg', { percent: globalPercent, scope: scopeText });
                }
            }
        }

        if (msg) {
            setDisplayMessage(msg);
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    },[user, globalDiscount, t, authLoading]);

    useLayoutEffect(() => {
        if (tickerRef.current && displayMessage) {
            const width = tickerRef.current.scrollWidth;
            const distanceToTravel = width / 2;
            const isMobile = window.innerWidth < 768;
            const speed = isMobile ? SPEED_MOBILE : SPEED_DESKTOP;
            const calculatedDuration = distanceToTravel / speed;
            setDuration(calculatedDuration);
        }
    }, [displayMessage, isVisible, user]);

    const singleSet = Array(10).fill(displayMessage);
    const items = [...singleSet, ...singleSet];

    if (authLoading || !displayMessage || !isVisible) {
        return null;
    }

    return (
        <div
            className="bg-accent text-dark h-7 flex items-center overflow-hidden relative z-40 border-b border-accent-hover shadow-sm w-full"
            dir="ltr"
        >
            <div
                ref={tickerRef}
                className={`ticker-track ${isRtl ? 'ticker-rtl' : 'ticker-ltr'}`}
                style={{ animationDuration: duration > 0 ? `${duration}s` : '0s' }}
            >
                {items.map((msg, index) => (
                    <div key={index} className="flex items-center px-2 md:px-2 shrink-0">
                        <span className="font-bold text-xs md:text-sm whitespace-nowrap flex items-center">
                            <span className="mx-2"></span>
                            <span>{msg}</span>
                            <span className="mx-2"></span>
                        </span>
                        <span className="text-dark/20 text-[10px] mx-2">•</span>
                    </div>
                ))}
            </div>
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-accent to-transparent z-10 pointer-events-none"></div>
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-accent to-transparent z-10 pointer-events-none"></div>
        </div>
    );
};

export default DiscountTicker;

