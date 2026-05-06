import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import ReactConfetti from 'react-confetti';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

const HangingSheep = ({ position, delay, scale = 1 }) => (
    <div
        style={{
            position: 'absolute',
            top: '-5px',
            zIndex: 60,
            pointerEvents: 'none',
            ...position,
            transformOrigin: 'top center',
            animation: `swing 3s ease-in-out infinite alternate ${delay}s`,
            transform: `scale(${scale})`,
            filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.15))'
        }}
    >
        <svg width="100" height="180" viewBox="0 0 100 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="50" y1="0" x2="50" y2="40" stroke="#9ca3af" strokeWidth="3" />
            <circle cx="50" cy="40" r="4" fill="#9ca3af" />
            <g transform="translate(0, 40)">
                <path d="M30 30 C 10 30, 10 70, 30 70 C 25 85, 45 90, 50 80 C 55 90, 75 85, 70 70 C 90 70, 90 30, 70 30 C 75 15, 55 10, 50 20 C 45 10, 25 15, 30 30 Z" fill="#ffffff" stroke="#e5e7eb" strokeWidth="2"/>
                <circle cx="50" cy="45" r="16" fill="#1f2937" />
                <ellipse cx="34" cy="48" rx="8" ry="4" fill="#1f2937" transform="rotate(-20 34 48)" />
                <ellipse cx="66" cy="48" rx="8" ry="4" fill="#1f2937" transform="rotate(20 66 48)" />
                <circle cx="46" cy="43" r="1.5" fill="white" />
                <circle cx="54" cy="43" r="1.5" fill="white" />
                <path d="M42 75 L42 95" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
                <path d="M58 75 L58 95" stroke="#1f2937" strokeWidth="4" strokeLinecap="round" />
            </g>
        </svg>
    </div>
);

const EidBunting = () => {
    return (
        <div
            style={{
                position: 'absolute',
                top: '-10px',
                left: 0,
                width: '100%',
                height: '80px',
                zIndex: 55,
                pointerEvents: 'none',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'flex-start'
            }}
        >
            {[...Array(40)].map((_, i) => (
                <svg key={i} width="60" height="60" viewBox="0 0 60 60" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M0,0 Q30,15 60,0" fill="none" stroke="#9ca3af" strokeWidth="2" />
                    <path d="M10 5 L30 40 L50 5 Z" fill={i % 2 === 0 ? "#10b981" : "#fbbf24"} />
                </svg>
            ))}
        </div>
    );
}

const CountdownTimer = ({ targetDate, onClose, isVisible }) => {
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
                    s: Math.floor((difference / 1000) % 60),
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
        <div
            className="fixed top-0 left-0 w-full bg-gradient-to-r from-emerald-800 to-green-700 text-white shadow-sm"
            style={{
                height: '50px',
                zIndex: 100, // Z-Index     
                transform: isVisible ? 'translateY(0)' : 'translateY(-100%)',
                opacity: isVisible ? 1 : 0,
                transition: 'transform 0.3s ease, opacity 0.3s ease',
                pointerEvents: isVisible ? 'auto' : 'none'
            }}
        >
            <div className="container mx-auto px-4 h-full flex items-center justify-center relative">
                <div className="flex items-center gap-2 md:gap-3">
                    <span className="text-[10px] md:text-sm font-bold text-white/90 whitespace-nowrap">
                        {t('eid.timer_title')}
                    </span>
                    <div className="bg-black/20 px-2 md:px-4 py-1 rounded-lg border border-white/10 backdrop-blur-sm">
                        <div className="flex items-center gap-2 md:gap-4 flex-row-reverse">
                            <div className="flex flex-col items-center leading-none">
                                <span className="text-xs md:text-base font-bold text-yellow-300">{timeLeft.m}</span>
                                <span className="text-[7px] md:text-[9px] text-white/80">{t('common.minute')}</span>
                            </div>
                            <span className="text-white/40 pb-2 font-bold">:</span>
                            <div className="flex flex-col items-center leading-none">
                                <span className="text-xs md:text-base font-bold text-yellow-300">{timeLeft.h}</span>
                                <span className="text-[7px] md:text-[9px] text-white/80">{t('common.hour')}</span>
                            </div>
                            <span className="text-white/40 pb-2 font-bold">:</span>
                            <div className="flex flex-col items-center leading-none">
                                <span className="text-xs md:text-base font-bold text-yellow-300">{timeLeft.d}</span>
                                <span className="text-[7px] md:text-[9px] text-white/80">{t('common.day')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute left-2 top-1/2 -translate-y-1/2 hover:bg-white/20 p-1 rounded-full transition text-white/70 hover:text-white"
                    aria-label="Close"
                >
                    <X size={16} />
                </button>
            </div>
        </div>
    );
};

const EidCelebration = ({ settings, showTimer, setShowTimer, isVisible, tickerHeight = 0, navbarHeight, isMobile }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const [recycleConfetti, setRecycleConfetti] = useState(true);
    const[showEidText, setShowEidText] = useState(true);

    const isHomePage = location.pathname === '/';

    useEffect(() => {
        const updateSize = () => setWindowSize({ width: window.innerWidth, height: window.innerHeight });
        updateSize();
        window.addEventListener('resize', updateSize);

        const stopRecycleTimer = setTimeout(() => setRecycleConfetti(false), 5000);

        const textDuration = isMobile ? 2500 : 5000;
        const eidTextTimer = setTimeout(() => setShowEidText(false), textDuration);

        return () => {
            window.removeEventListener('resize', updateSize);
            clearTimeout(stopRecycleTimer);
            clearTimeout(eidTextTimer);
        };
    }, [isMobile]);

    if (!isHomePage || !settings) return null;

    const textOverlayStyle = `
        .eid-adha-text-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 10000;
            pointer-events: none; display: flex; justify-content: center; align-items: center;
            transition: opacity 1s ease-in-out, visibility 1s;
            opacity: ${showEidText ? 1 : 0}; visibility: ${showEidText ? 'visible' : 'hidden'};
            background: radial-gradient(circle, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 70%);
        }
    `;

    // 1.  
    if (isMobile) {
        return ReactDOM.createPortal(
            <>
                <style>{textOverlayStyle}</style>

                {settings.enable_eid_celebration && (
                    <>
                        <div style={{
                            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9990,
                            pointerEvents: 'none', opacity: isVisible ? 1 : 0, transition: 'opacity 0.3s ease'
                        }}>
                            <ReactConfetti
                                width={windowSize.width}
                                height={windowSize.height}
                                recycle={recycleConfetti}
                                numberOfPieces={50}
                                gravity={0.15}
                                colors={['#10B981', '#F59E0B', '#FCD34D', '#EC4899', '#ffffff']}
                            />
                        </div>

                        <div className="eid-adha-text-overlay">
                            <div className="text-center transform translate-y-[-50px]">
                                <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-amber-500 drop-shadow-2xl"
                                    style={{ fontFamily: 'Cairo, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
                                    {t('eid.happy_eid_adha')}
                                </h1>
                            </div>
                        </div>
                    </>
                )}
            </>,
            document.body
        );
    }

    // 2.    (   z-index )

    const decorationsTop = (settings.show_eid_timer && showTimer ? 50 : 0) + navbarHeight + tickerHeight;

    return ReactDOM.createPortal(
        <>
            <style>{`
                @keyframes swing { 0% { transform: rotate(5deg); } 100% { transform: rotate(-5deg); } }
                ${textOverlayStyle}
            `}</style>

            {/*  (    z-100) */}
            {settings.show_eid_timer && settings.eid_adha_date && showTimer && (
                <CountdownTimer
                    targetDate={settings.eid_adha_date}
                    onClose={() => setShowTimer(false)}
                    isVisible={isVisible}
                />
            )}

            {}
            {settings.enable_eid_celebration && (
                <>
                    <div
                        className="eid-decorations-container"
                        style={{
                            position: 'absolute',
                            top: `${decorationsTop}px`,
                            left: 0,
                            width: '100%',
                            height: '200px',
                            overflow: 'hidden',
                            pointerEvents: 'none',
                            zIndex: 40, //   Navbar dropdowns (z-50)   
                            opacity: isVisible ? 1 : 0,
                            transition: 'opacity 0.3s ease, top 0.3s ease'
                        }}
                    >
                        <EidBunting />
                        <HangingSheep position={{ right: '5%' }} delay={0} scale={0.8} />
                        <HangingSheep position={{ left: '5%' }} delay={1} scale={0.8} />
                        <HangingSheep position={{ right: '20%' }} delay={2} scale={0.7} />
                    </div>

                    <div style={{
                        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9990,
                        pointerEvents: 'none', opacity: isVisible ? 1 : 0, transition: 'opacity 0.3s ease'
                    }}>
                        <ReactConfetti
                            width={windowSize.width}
                            height={windowSize.height}
                            recycle={recycleConfetti}
                            numberOfPieces={120}
                            gravity={0.15}
                            colors={['#10B981', '#F59E0B', '#FCD34D', '#EC4899', '#ffffff']}
                        />
                    </div>

                    <div className="eid-adha-text-overlay">
                        <div className="text-center transform translate-y-[-50px]">
                            <h1 className="text-5xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-amber-500 drop-shadow-2xl"
                                style={{ fontFamily: 'Cairo, sans-serif', textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
                                {t('eid.happy_eid_adha')}
                            </h1>
                        </div>
                    </div>
                </>
            )}
        </>,
        document.body
    );
};

export default EidCelebration;