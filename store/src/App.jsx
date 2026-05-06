import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from "./services/axiosConfig";

import { safeSessionStorage } from './utils/storageHelper';
import ScrollToTop from './components/utils/ScrollToTop';
import useAuth from './context/auth/useAuth';

import Navbar from './components/layout/Navbar';
import MobileBottomNav from './components/layout/MobileBottomNav';
import DiscountTicker from './components/layout/DiscountTicker';
import Footer from './components/layout/Footer';
import PendingOrderBanner from './components/layout/PendingOrderBanner';
import PushNotificationBanner from './components/layout/PushNotificationBanner';
import PWAInstallPrompt from './components/layout/PWAInstallPrompt';

import EidCelebration from "./components/home/EidCelebration";
import RamadanCelebration from "./components/home/RamadanCelebration";

import PrivateRoute from './routes/PrivateRoute';
import GuestRoute from './routes/GuestRoute';

import ContactUs from './pages/ContactUs';
import Home from './pages/Home';
import About from './pages/About';
import Login from './pages/Login';
import Register from './pages/Register';
import OtpVerification from "./pages/OTP";
import Cart from './pages/Cart';
import Livestock from './pages/Livestock';
import Checkout from './pages/Checkout';
import AnimalDetails from './pages/AnimalDetails';
import MyOrders from './pages/MyOrders';
import CheckAccount from './pages/CheckAccount';
import Profile from './pages/Profile';
import RequestPasswordReset from './pages/RequestPasswordReset';
import VerifyResetPasswordOTP from './pages/VerifyResetPasswordOTP';
import SetNewPassword from './pages/SetNewPassword';
import Notifications from './pages/Notifications';
import Addresses from './pages/Addresses';
import Recommendations from './pages/Recommendations';
import YourAccount from './pages/YourAccount';
import OrderPayment from './pages/OrderPayment';
import LivestockShares from './pages/LivestockShares';
import Partnerships from './pages/Partnerships';
import RequestLivestock from './pages/RequestLivestock';
import NotFound from './pages/NotFound';
import Adahi from './pages/Adahi';
import Careers from './pages/Careers';
import FAQ from './pages/FAQ';
import BusinessPortal from './pages/BusinessPortal';

import PrivacyPolicy from './pages/policies/PrivacyPolicy';
import Terms from './pages/policies/Terms';
import RefundPolicy from './pages/policies/RefundPolicy';
import ShippingPolicy from './pages/policies/ShippingPolicy';
import CookiesPolicy from './pages/policies/CookiesPolicy';

const AppContent = () => {
  const { user, globalDiscount } = useAuth();
  const [showNavbar, setShowNavbar] = useState(true);
  const [isAtTop, setIsAtTop] = useState(true);
  const [operationSettings, setOperationSettings] = useState(null);
  const [showTimer, setShowTimer] = useState(true);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
  const lastScrollY = useRef(0);
  const location = useLocation();
  const isHomePage = useMemo(() => location.pathname === '/', [location.pathname]);

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

    if (user?.is_discount_active) {
      const userPercent = parseFloat(user.special_discount_percentage || 0);
      if (userPercent > 0 && isDateRangeValid(user.discount_start_date, user.discount_end_date)) {
        return true;
      }
    }

    if (globalDiscount?.is_active) {
      const globalPercent = parseFloat(globalDiscount.percentage || 0);
      const allowed = user ? user.allow_global_discount : true;

      if (allowed && globalPercent > 0 && isDateRangeValid(globalDiscount.start_date, globalDiscount.end_date)) {
        return true;
      }
    }

    return false;
  }, [user, globalDiscount]);

  const shouldShowTimer = useMemo(() =>
    !isMobile && isHomePage && operationSettings?.show_eid_timer && showTimer && isAtTop,
    [isMobile, isHomePage, operationSettings, showTimer, isAtTop]
  );

  const shouldShowTicker = useMemo(() =>
    !isMobile && isHomePage && isAtTop && hasActiveDiscount,
    [isMobile, isHomePage, isAtTop, hasActiveDiscount]
  );

  const navbarHeight = useMemo(() => {
    if (isMobile) return isAtTop ? 100 : 60;
    return 80;
  }, [isMobile, isAtTop]);

  const timerHeight = useMemo(() => shouldShowTimer ? 50 : 0, [shouldShowTimer]);
  const tickerHeight = useMemo(() => shouldShowTicker ? 30 : 0, [shouldShowTicker]);
  const navbarTopPosition = timerHeight;

  const contentSpacerHeight = useMemo(() =>
    navbarHeight + tickerHeight + timerHeight,
    [navbarHeight, tickerHeight, timerHeight]
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 992);
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });

    resizeObserver.observe(document.body);
    window.addEventListener('resize', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const fetchSettings = async () => {
      try {
        const res = await axios.get("/core/public-operation-settings/", {
          signal: controller.signal
        });
        setOperationSettings(res.data);
      } catch (error) {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError' && error.response?.status !== 401) {
          console.error("Failed to load settings", error);
        }
      }
    };

    fetchSettings();

    return () => {
      controller.abort();
    };
  }, []);

  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY;
    const atTop = currentScrollY < 10;

    setIsAtTop(atTop);

    if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
      setShowNavbar(false);
    } else if (currentScrollY < lastScrollY.current) {
      setShowNavbar(true);
    }

    lastScrollY.current = currentScrollY;
  }, []);

  useEffect(() => {
    let scrollTimeout;
    let animationFrameId;

    const throttledScroll = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(handleScroll);
    };

    const savedScrollPos = safeSessionStorage.getItem('scrollPos');
    if (savedScrollPos) {
      scrollTimeout = setTimeout(() => {
        window.scrollTo({
          top: Math.min(parseInt(savedScrollPos, 10) || 0, document.body.scrollHeight),
          behavior: 'instant',
        });
        safeSessionStorage.removeItem('scrollPos');
      }, 150);
    }

    window.addEventListener('scroll', throttledScroll, { passive: true });

    return () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', throttledScroll);
    };
  }, [handleScroll]);

  const shouldShowCelebrations = useMemo(() =>
    isHomePage && operationSettings &&
    (
      operationSettings.enable_eid_fitr_celebration ||
      operationSettings.enable_ramadan_celebration ||
      operationSettings.enable_eid_celebration ||
      operationSettings.show_eid_timer
    ),
    [isHomePage, operationSettings]
  );

  return (
    <div className="app-wrapper flex flex-col min-h-screen bg-secondary">
      {shouldShowCelebrations && (
        <div
          style={{
            opacity: isAtTop ? 1 : 0,
            transition: 'opacity 0.3s ease',
            pointerEvents: isAtTop ? 'auto' : 'none'
          }}
          className="celebration-container"
        >
          <RamadanCelebration
            settings={operationSettings}
            topOffset={navbarTopPosition + navbarHeight + tickerHeight}
            isVisible={isAtTop}
            isMobile={isMobile}
          />

          <EidCelebration
            settings={operationSettings}
            showTimer={showTimer}
            setShowTimer={setShowTimer}
            isVisible={isAtTop}
            tickerHeight={tickerHeight}
            navbarHeight={navbarHeight}
            isMobile={isMobile}
            disableFixedTimer={isMobile}
          />
        </div>
      )}

      <header
        className="fixed left-0 right-0 z-50 flex flex-col shadow-sm bg-white will-change-transform"
        style={{
          top: `${navbarTopPosition}px`,
          transform: showNavbar ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        <Navbar isAtTop={isAtTop} />

        {shouldShowTicker && (
          <div className="animate-fade-in">
            <DiscountTicker />
          </div>
        )}
      </header>

      <div
        style={{ height: `${contentSpacerHeight}px` }}
        className="content-spacer transition-all duration-300 ease-in-out"
      />

      <main className="main-content flex-grow relative">
        <Routes>
          <Route
            path="/"
            element={
              <Home
                operationSettings={operationSettings}
                showTimer={showTimer}
                setShowTimer={setShowTimer}
                isMobile={isMobile}
              />
            }
          />

          <Route path="/about" element={<About />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/livestock" element={<Livestock />} />
          <Route path="/shares" element={<LivestockShares />} />
          <Route path="/partnerships" element={<Partnerships />} />
          <Route path="/animal/:id" element={<AnimalDetails />} />
          <Route path="/contact" element={<ContactUs />} />
          <Route path="/request-livestock" element={<RequestLivestock />} />
          <Route path="/adahi" element={<Adahi />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/faq" element={<FAQ />} />

          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
          <Route path="/account/login-check" element={<GuestRoute><CheckAccount /></GuestRoute>} />
          <Route path="/reset-password/request" element={<GuestRoute><RequestPasswordReset /></GuestRoute>} />
          <Route path="/reset-password/verify" element={<GuestRoute><VerifyResetPasswordOTP /></GuestRoute>} />
          <Route path="/reset-password/set" element={<GuestRoute><SetNewPassword /></GuestRoute>} />

          <Route path="/otp-verification" element={<OtpVerification />} />

          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/refund-policy" element={<RefundPolicy />} />
          <Route path="/shipping-policy" element={<ShippingPolicy />} />
          <Route path="/cookies-policy" element={<CookiesPolicy />} />

          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/my-orders" element={<PrivateRoute><MyOrders /></PrivateRoute>} />
          <Route path="/checkout" element={<PrivateRoute><Checkout /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="/addresses" element={<PrivateRoute><Addresses /></PrivateRoute>} />
          <Route path="/recommendations" element={<PrivateRoute><Recommendations /></PrivateRoute>} />
          <Route path="/account-dashboard" element={<PrivateRoute><YourAccount /></PrivateRoute>} />
          <Route path="/order/:id/payment" element={<PrivateRoute><OrderPayment /></PrivateRoute>} />
          <Route path="/b2b-payment/:id" element={<PrivateRoute><OrderPayment isB2BRoute={true} /></PrivateRoute>} />
          <Route path="/business" element={<PrivateRoute><BusinessPortal /></PrivateRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <PendingOrderBanner />
      <PushNotificationBanner />
      <PWAInstallPrompt />

      <Footer />
      <MobileBottomNav />

      <ToastContainer
        position="top-center"
        limit={3}
        autoClose={3500}
        theme="light"
        hideProgressBar={true}
        closeButton={false}
        pauseOnHover={false}
        draggable={true}
        newestOnTop={true}
        toastClassName="custom-toast"
      />
    </div>
  );
};

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ScrollToTop />
      <AppContent />
    </Router>
  );
}

export default App;
