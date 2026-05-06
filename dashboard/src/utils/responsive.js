// D:/dashboard/src/utils/responsive.js

export const getDeviceType = () => {
    if (typeof window === 'undefined') return 'desktop';

    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    //             ( )
    if (!hasTouch) return 'desktop';

    const width = window.innerWidth;
    if (width < 576) return 'mobile';
    if (width < 768) return 'tablet';
    if (width < 992) return 'small-desktop';
    if (width < 1200) return 'desktop';
    return 'large-desktop';
};

//       ( )
export const isMobile = () => {
    if (typeof window === 'undefined') return false;

    // 1.   (  992px)
    // 2.   (Touch)

    const isSmallScreen = window.innerWidth < 992;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    //       (    )  false

    return isSmallScreen && hasTouch;
};

export const isTouchDevice = () => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window ||
           navigator.maxTouchPoints > 0 ||
           navigator.msMaxTouchPoints > 0;
};

export const adjustFontSizeForScreen = () => {
    if (typeof window === 'undefined') return 16;
    // ... (   )
    const width = window.innerWidth;
    const baseSize = 16;

    if (width < 480) return baseSize * 0.8;
    if (width < 768) return baseSize * 0.875;
    if (width < 1024) return baseSize * 0.9375;
    return baseSize;
};

//       iOS
export const preventZoomOnFocus = () => {
    // ... (   )
    if (typeof window === 'undefined') return;

    if (isMobile()) {
        document.addEventListener('touchstart', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                e.target.style.fontSize = '16px';
            }
        }, { passive: true });
    }
};

export const enableSmoothScroll = () => {
    // ... (   )
    if (typeof window === 'undefined') return;

    const style = document.createElement('style');
    style.textContent = `
        * {
            scroll-behavior: smooth;
        }

        @media (prefers-reduced-motion: reduce) {
            * {
                scroll-behavior: auto;
            }
        }
    `;
    document.head.appendChild(style);
};
