import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import ReactConfetti from 'react-confetti';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Fanoos = ({ position, delay, scale = 1, color = "#fbbf24" }) => {
    return (
        <div
            style={{
                position: 'absolute',
                top: '-5px',
                zIndex: 45,
                pointerEvents: 'none',
                ...position,
                transformOrigin: 'top center',
                animation: `swing 4s ease-in-out infinite alternate ${delay}s`,
                transform: `scale(${scale})`,
                filter: 'drop-shadow(0px 0px 10px rgba(251, 191, 36, 0.4))'
            }}
        >
             <svg width="60" height="120" viewBox="0 0 60 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <line x1="30" y1="0" x2="30" y2="20" stroke="#d1d5db" strokeWidth="2" />
                <circle cx="30" cy="20" r="3" stroke={color} strokeWidth="2" />
                <path d="M15 35 L30 23 L45 35 Z" fill={color} />
                <path d="M15 35 L10 65 L20 85 L40 85 L50 65 L45 35 Z" fill={`${color}DD`} stroke="#fff" strokeWidth="1" />
                <path d="M20 45 L18 65 L25 75 L35 75 L42 65 L40 45 Z" fill="#fff" fillOpacity="0.3" />
                <rect x="22" y="85" width="16" height="5" rx="1" fill={color} />
                <line x1="30" y1="90" x2="30" y2="105" stroke={color} strokeWidth="2" strokeDasharray="2 2" />
            </svg>
        </div>
    );
};

const CrescentMoon = ({ position, scale = 1 }) => (
    <div
        style={{
            position: 'absolute',
            zIndex: 45,
            pointerEvents: 'none',
            ...position,
            transform: `scale(${scale})`,
            filter: 'drop-shadow(0px 0px 15px rgba(255, 255, 255, 0.6))',
            animation: 'float 6s ease-in-out infinite'
        }}
    >
        <svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 10 A 40 40 0 1 0 50 90 A 30 30 0 1 1 50 10" fill="#FCD34D" />
            <path d="M70 30 L73 38 L82 38 L75 44 L78 52 L70 47 L62 52 L65 44 L58 38 L67 38 Z" fill="#FFF" />
        </svg>
    </div>
);

const RamadanCelebration = ({ settings, topOffset, isMobile }) => {
    const { t } = useTranslation();
    const location = useLocation();
    const[windowSize, setWindowSize] = useState({ width: 0, height: 0 });
    const [showEidText, setShowEidText] = useState(true);
    const [showRamadanText, setShowRamadanText] = useState(true);

    const isHomePage = useMemo(() => location.pathname === '/', [location.pathname]);
    const textDuration = useMemo(() => (isMobile ? 2500 : 5000), [isMobile]);

    useEffect(() => {
        const updateSize = () => setWindowSize({
            width: window.innerWidth,
            height: window.innerHeight
        });

        updateSize();
        window.addEventListener('resize', updateSize);
        return () => window.removeEventListener('resize', updateSize);
    },[]);

    useEffect(() => {
        if (settings?.enable_eid_fitr_celebration) {
            const timer = setTimeout(() => setShowEidText(false), textDuration);
            return () => clearTimeout(timer);
        }
    }, [settings, textDuration]);

    useEffect(() => {
        if (settings?.enable_ramadan_celebration) {
            const timer = setTimeout(() => setShowRamadanText(false), textDuration);
            return () => clearTimeout(timer);
        }
    }, [settings, textDuration]);

    if (!isHomePage || !settings) return null;

    const commonStyles = `
        @keyframes swing { 0% { transform: rotate(5deg); } 100% { transform: rotate(-5deg); } }
        @keyframes float { 0% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes glow { 0%, 100% { text-shadow: 0 0 10px rgba(245, 158, 11, 0.5); } 50% { text-shadow: 0 0 40px rgba(245, 158, 11, 0.8); } }
        @keyframes popIn { 0% { transform: scale(0.8) translateY(-30px); opacity: 0; } 100% { transform: scale(1) translateY(0); opacity: 1; } }

        .overlay-text-container {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 9999;
            pointer-events: none; display: flex; justify-content: center; align-items: center;
            transition: opacity 1s ease-in-out, visibility 1s;
            background: radial-gradient(circle, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 70%);
        }
    `;

    return ReactDOM.createPortal(
        <>
            <style>{commonStyles}</style>

            {/*  :   () -       */}
            {settings.enable_ramadan_celebration && !isMobile && (
                <div
                    style={{
                        position: 'absolute',
                        top: `${topOffset}px`,
                        left: 0,
                        width: '100%',
                        height: '200px',
                        overflow: 'hidden',
                        pointerEvents: 'none',
                        zIndex: 40
                    }}
                >
                    <Fanoos position={{ left: '5%' }} delay={0} scale={0.8} color="#F59E0B" />
                    <Fanoos position={{ left: '20%' }} delay={1} scale={0.6} color="#EF4444" />
                    <Fanoos position={{ right: '5%' }} delay={0.5} scale={0.8} color="#10B981" />
                    <Fanoos position={{ right: '20%' }} delay={1.5} scale={0.6} color="#3B82F6" />
                    <CrescentMoon position={{ left: '50%', top: '20px', marginLeft: '-50px' }} scale={1.2} />
                </div>
            )}

            {}

            {/*  :    (   ) */}
            {settings.enable_eid_fitr_celebration ? (
                <>
                     <div
                        className="overlay-text-container"
                        style={{
                            opacity: showEidText ? 1 : 0,
                            visibility: showEidText ? 'visible' : 'hidden'
                        }}
                    >
                        <div style={{ textAlign: 'center', animation: 'popIn 1s forwards' }}>
                            <h1 className="text-5xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-green-500 to-emerald-700 drop-shadow-2xl"
                                style={{ fontFamily: 'Cairo, sans-serif', textShadow: '4px 4px 0px white, 0 0 20px rgba(16, 185, 129, 0.5)' }}>
                                {t('eid.happy_eid_fitr')}
                            </h1>
                            <p className="text-2xl md:text-4xl text-white font-bold mt-4 drop-shadow-md bg-black/20 px-6 py-2 rounded-full inline-block backdrop-blur-sm">
                                {t('eid.eid_greeting')}
                            </p>
                        </div>
                    </div>

                    {showEidText && (
                        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9990, pointerEvents: 'none' }}>
                            <ReactConfetti
                                width={windowSize.width}
                                height={windowSize.height}
                                numberOfPieces={isMobile ? 50 : 150}
                                colors={['#10B981', '#3B82F6', '#F59E0B', '#EC4899']}
                                recycle={true}
                                gravity={0.08}
                            />
                        </div>
                    )}
                </>
            ) : settings.enable_ramadan_celebration ? (
                /*  :    ( ) */
                <div
                    className="overlay-text-container"
                    style={{
                        opacity: showRamadanText ? 1 : 0,
                        visibility: showRamadanText ? 'visible' : 'hidden'
                    }}
                >
                    <div className="text-center transform translate-y-[-50px] px-4">
                        <h1
                            className="text-6xl md:text-9xl font-black text-amber-400 drop-shadow-lg"
                            style={{
                                fontFamily: 'Cairo, sans-serif',
                                textShadow: '0 0 30px rgba(245, 158, 11, 0.6)',
                                animation: 'glow 2s ease-in-out infinite',
                                lineHeight: '1.1'
                            }}
                        >
                            {t('ramadan.ramadan_kareem')}
                        </h1>
                        <p className="text-white text-xl md:text-3xl font-bold mt-2 tracking-wider">
                            {t('ramadan.ramadan_greeting')}
                        </p>
                    </div>
                </div>
            ) : null}
        </>,
        document.body
    );
};

export default RamadanCelebration;