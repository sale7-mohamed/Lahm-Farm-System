import { useState, useEffect, useCallback } from 'react';
import { getDeviceType, isMobile, isTouchDevice } from '../utils/responsive';

export const useResponsive = () => {
    const [deviceType, setDeviceType] = useState(getDeviceType());
    const [isMobileDevice, setIsMobileDevice] = useState(isMobile());
    const [isTouch] = useState(isTouchDevice());
    const [windowSize, setWindowSize] = useState({
        width: typeof window !== 'undefined' ? window.innerWidth : 1200,
        height: typeof window !== 'undefined' ? window.innerHeight : 800
    });

    const handleResize = useCallback(() => {
        setDeviceType(getDeviceType());
        setIsMobileDevice(isMobile());
        setWindowSize({
            width: window.innerWidth,
            height: window.innerHeight
        });
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        handleResize();
        window.addEventListener('resize', handleResize);

        if (isTouchDevice()) {
            document.documentElement.classList.add('touch-device');
        }

        return () => {
            window.removeEventListener('resize', handleResize);
            document.documentElement.classList.remove('touch-device');
        };
    }, [handleResize]);

    return {
        deviceType,
        isMobile: isMobileDevice,
        isTouch,
        isTablet: deviceType === 'tablet',
        isDesktop: deviceType === 'desktop' || deviceType === 'large-desktop',
        windowSize,
        orientation: windowSize.width > windowSize.height ? 'landscape' : 'portrait'
    };
};

export const useIsMobile = () => {
    const responsive = useResponsive();
    return responsive.isMobile;
};