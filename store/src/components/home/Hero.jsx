import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from "react-router-dom";
import heroFront from "../../assets/hero-front.png";
import heroBack from "../../assets/hero-back.png";
import { useTranslation } from "react-i18next";
import { Utensils, ShoppingBag, CheckCircle, ArrowDown, Clock } from "lucide-react";
import DiscountTicker from "../layout/DiscountTicker";
import useAuth from '../../context/auth/useAuth';

const HeroSheepSVG = () => (
    <svg width="80" height="80" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-bounce-slow">
        <path d="M30 40 C 20 40, 10 50, 15 70 C 20 85, 40 90, 50 85 C 60 90, 80 85, 85 70 C 90 50, 80 40, 70 40 C 65 30, 45 30, 30 40 Z" fill="#ffffff" stroke="#e5e7eb" strokeWidth="2"/>
        <circle cx="25" cy="45" r="18" fill="#1f2937" />
        <ellipse cx="10" cy="48" rx="8" ry="4" fill="#1f2937" transform="rotate(-20 10 48)" />
        <ellipse cx="40" cy="48" rx="8" ry="4" fill="#1f2937" transform="rotate(20 40 48)" />
        <circle cx="20" cy="42" r="2" fill="white" />
        <circle cx="30" cy="42" r="2" fill="white" />
        <path d="M35 80 L35 95" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
        <path d="M45 80 L45 95" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
        <path d="M60 80 L60 95" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
        <path d="M70 80 L70 95" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
        <circle cx="50" cy="40" r="5" fill="white" opacity="0.5" />
        <circle cx="65" cy="50" r="5" fill="white" opacity="0.5" />
        <circle cx="40" cy="60" r="5" fill="white" opacity="0.5" />
    </svg>
);

const HeroRamadanSVG = () => (
    <svg width="70" height="90" viewBox="0 0 60 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-bounce-slow filter drop-shadow-lg">
        <line x1="30" y1="0" x2="30" y2="15" stroke="#fbbf24" strokeWidth="2" />
        <circle cx="30" cy="18" r="4" stroke="#fbbf24" strokeWidth="2" fill="none" />
        <path d="M15 35 L30 23 L45 35 Z" fill="#fbbf24" />
        <path d="M15 35 L10 65 L20 85 L40 85 L50 65 L45 35 Z" fill="#F59E0B" stroke="#fff" strokeWidth="1" />
        <path d="M20 45 L18 65 L25 75 L35 75 L42 65 L40 45 Z" fill="#FEF3C7" fillOpacity="0.8" />
        <rect x="22" y="85" width="16" height="5" rx="1" fill="#fbbf24" />
    </svg>
);

const InlineCountdownTimer = ({ targetDate, titleKey }) => {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState({});

    useEffect(() => {
        const calculateTimeLeft = () => {
            const difference = +new Date(targetDate) - +new Date();
            let tl = {};
            if (difference > 0) {
                tl = {
                    d: Math.floor(difference / (1000 * 60 * 60 * 24)),
                    h: Math.floor((difference / (1000 * 60 * 60)) % 24),
                    m: Math.floor((difference / 1000 / 60) % 60),
                };
            }
            return tl;
        };
        setTimeLeft(calculateTimeLeft());
        const timer = setInterval(() => setTimeLeft(calculateTimeLeft()), 1000);
        return () => clearTimeout(timer);
    }, [targetDate]);

    if (Object.keys(timeLeft).length === 0) return null;

    return (
        <div className="bg-gradient-to-r from-emerald-800 to-green-700 rounded-xl p-2 mb-2 text-white shadow-md mx-2 border border-white/20 relative overflow-hidden">
            <div className="flex items-center justify-between px-2 relative z-10">
                <div className="flex items-center gap-1">
                    <Clock size={14} className="text-yellow-300 animate-pulse" />
                    <span className="text-[10px] font-bold">{t(titleKey)}</span>
                </div>
                <div className="flex gap-1 text-[10px] font-mono font-bold">
                    <span className="bg-black/20 px-1.5 py-0.5 rounded text-yellow-300">{timeLeft.d} {t('common.day')}</span>
                    <span className="bg-black/20 px-1.5 py-0.5 rounded">{timeLeft.h} {t('common.hour')}</span>
                    <span className="bg-black/20 px-1.5 py-0.5 rounded">{timeLeft.m} {t('common.minute')}</span>
                </div>
            </div>
        </div>
    );
};

function Hero({ eidSettings }) {
    const { t } = useTranslation();
    const { user, globalDiscount } = useAuth();

    const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
    const [isFlipped, setIsFlipped] = useState(false);
    const flipTimeoutRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 992);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    },[]);

    useEffect(() => {
        return () => {
            if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        };
    },[]);

    const handleImageTap = () => {
        setIsFlipped(true);
        if (flipTimeoutRef.current) clearTimeout(flipTimeoutRef.current);
        flipTimeoutRef.current = setTimeout(() => {
            setIsFlipped(false);
        }, 3000);
    };

    const hasActiveDiscount = useMemo(() => {
        const now = new Date();

        const isDateRangeValid = (startStr, endStr) => {
            if (!startStr && !endStr) return true;
            const start = startStr ? new Date(startStr) : null;
            const end = endStr ? new Date(endStr) : null;
            if (start && now < start) return false;
            if (end && now > end) return false;
            return true;
        };

        if (user && user.is_discount_active) {
            const val = parseFloat(user.special_discount_percentage || 0);
            if (val > 0 && isDateRangeValid(user.discount_start_date, user.discount_end_date)) return true;
        }

        if (globalDiscount && globalDiscount.is_active) {
            const val = parseFloat(globalDiscount.percentage || 0);
            const allowed = user ? user.allow_global_discount : true;
            if (allowed && val > 0 && isDateRangeValid(globalDiscount.start_date, globalDiscount.end_date)) return true;
        }
        return false;
    }, [user, globalDiscount]);

    const scrollToEidSection = () => {
        const element = document.getElementById('eid-season-section');
        if (element) {
            const headerOffset = 180;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.scrollY - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: "smooth" });
        }
    };

    const isEidAdha = eidSettings?.enable_eid_celebration;
    const isRamadan = eidSettings?.enable_ramadan_celebration;
    const showAdahiButton = eidSettings?.enable_eid_celebration || eidSettings?.show_eid_timer;

    return (
        <section className="relative bg-white pt-2 pb-8 lg:py-20 overflow-hidden">
            <div className="lg:hidden absolute top-0 left-0 w-full z-0"></div>

            <div className="lg:hidden mb-4 space-y-2 relative z-10 mt-2">
                {hasActiveDiscount && (
                    <div className="rounded-lg overflow-hidden shadow-sm mx-2 border border-accent bg-white">
                        <DiscountTicker />
                    </div>
                )}

                {eidSettings?.show_eid_timer && eidSettings?.eid_adha_date && (
                    <InlineCountdownTimer
                        targetDate={eidSettings.eid_adha_date}
                        titleKey="eid.timer_title"
                    />
                )}

                {eidSettings?.ramadan_start_date && (
                    <InlineCountdownTimer
                        targetDate={eidSettings.ramadan_start_date}
                        titleKey="ramadan.timer_title"
                    />
                )}
            </div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="lg:hidden text-center mb-6 px-2 relative">
                    {isEidAdha && (
                        <div className="absolute top-0 right-0 -mt-2 -mr-2 transform rotate-12 opacity-90 z-0">
                            <HeroSheepSVG />
                        </div>
                    )}

                    {isRamadan && !isEidAdha && (
                        <div className="absolute top-0 right-0 -mt-1 -mr-1 transform rotate-6 opacity-90 z-0">
                            <HeroRamadanSVG />
                        </div>
                    )}

                    <h1 className="text-3xl font-black text-dark leading-tight relative z-10">
                        {t('home.hero_title')} <br />
                        <span className="text-primary">{t('home.hero_subtitle')}</span>
                    </h1>
                </div>

                <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-16">
                    <div className="w-full lg:w-1/2 relative px-4 lg:px-0 lg:order-2">
                        <div className="absolute inset-0 bg-primary/5 rounded-[2rem] lg:rounded-[3rem] transform rotate-3 scale-95 z-0"></div>
                        <div
                            className="group relative w-full max-w-[280px] sm:max-w-sm lg:max-w-full mx-auto z-10 aspect-[4/3] cursor-pointer [perspective:1000px]"
                            onClick={handleImageTap}
                        >
                            <div className={`relative w-full h-full transition-transform duration-1000 ease-in-out [transform-style:preserve-3d] group-hover:[transform:rotateX(180deg)] ${isFlipped ? '[transform:rotateX(180deg)]' : ''}`}>
                                <div className="absolute inset-0 [backface-visibility:hidden]">
                                    <img src={heroFront} className="w-full h-full object-cover rounded-[1.5rem] lg:rounded-[2.5rem] shadow-xl lg:shadow-2xl" alt="Fresh Livestock Front" loading="eager" />
                                </div>
                                <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateX(180deg)]">
                                    <img src={heroBack} className="w-full h-full object-cover rounded-[1.5rem] lg:rounded-[2.5rem] shadow-xl lg:shadow-2xl" alt="Fresh Livestock Back" loading="eager" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="w-full lg:w-1/2 text-center lg:text-start flex flex-col items-center lg:items-start space-y-4 lg:space-y-6 lg:order-1 mt-2 lg:mt-0">
                        <h1 className="hidden lg:block text-5xl lg:text-6xl font-black text-dark leading-[1.2] tracking-tight">
                            {t('home.hero_title')}
                            <span className="text-primary block mt-2">{t('home.hero_subtitle')}</span>
                        </h1>
                        <p className="text-sm md:text-lg text-gray-600 max-w-lg leading-relaxed px-2 lg:px-0">
                            {t('home.hero_desc')}
                        </p>

                        <div className="flex flex-col sm:flex-row flex-wrap justify-center lg:justify-start gap-3 w-full sm:w-auto pt-2">
                            <Link to="/livestock" className="btn btn-primary h-12 md:h-14 px-8 text-base md:text-lg rounded-2xl shadow-md w-full sm:w-auto flex items-center justify-center gap-2">
                                <ShoppingBag size={20} />
                                {t('home.shop_now')}
                            </Link>

                            <Link to="/partnerships?tab=business" className="hidden lg:inline-flex btn bg-white text-dark border-2 border-gray-100 hover:border-gray-300 h-12 md:h-14 px-8 text-base md:text-lg rounded-2xl w-full sm:w-auto items-center justify-center gap-2">
                                <Utensils size={20} />
                                {t('nav.business_portal')}
                            </Link>

                            {showAdahiButton && (
                                <button
                                    onClick={scrollToEidSection}
                                    className="btn bg-accent/10 text-accent-hover border-2 border-accent/20 hover:bg-accent hover:text-white h-12 md:h-14 px-6 text-sm md:text-lg rounded-2xl w-full sm:w-auto flex items-center justify-center gap-2 transition-all duration-300 animate-pulse-glow"
                                >
                                    <span className="text-lg">🐑</span>
                                    <span className="font-bold">{t('eid.season_badge')}</span>
                                    <ArrowDown size={isMobile ? 18 : 20} />
                                </button>
                            )}
                        </div>

                        <div className="pt-2 flex flex-wrap justify-center lg:justify-start gap-3 text-xs md:text-sm font-bold text-gray-500">
                            <div className="flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-full text-green-700 border border-green-100">
                                <CheckCircle size={14} className="text-green-500" />
                                {t('home.halal_100')}
                            </div>
                            <div className="flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-full text-blue-700 border border-blue-100">
                                <CheckCircle size={14} className="text-blue-500" />
                                {t('home.chilled_delivery')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-5px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 3s infinite ease-in-out;
                }
            `}</style>
        </section>
    );
}

export default Hero;

