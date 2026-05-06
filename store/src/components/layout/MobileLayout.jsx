import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ShoppingCart, User, Beef, Truck, Bell, Package } from 'lucide-react';
import { useApp } from '../../context/app/useApp';
import useAuth from '../../context/auth/useAuth';
import { useTranslation } from 'react-i18next';
// Logo
import logo from "../../assets/logo.png";

const MobileLayout = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { cartCount, notificationCount } = useApp();
  const { user } = useAuth();

  //     MobileBottomNav
  const navigationItems =[
    { label: t('common.home'), icon: <Home size={24} />, path: '/' },
    { label: t('nav.livestock'), icon: <Beef size={24} />, path: '/livestock' },
    // Cart is center usually
    { label: t('nav.cart'), icon: <ShoppingCart size={24} />, path: '/cart', badge: cartCount },
    { label: t('nav.my_orders'), icon: <Package size={24} />, path: user ? '/my-orders' : '/account/login-check' },
    { label: user ? t('common.my_account') : t('common.login'), icon: <User size={24} />, path: user ? '/account-dashboard' : '/account/login-check' },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="mobile-layout min-h-screen pb-20">
      {/* Mobile Header */}
      <header className="fixed top-0 left-0 right-0 bg-white shadow-sm z-50 h-[60px] flex items-center justify-between px-4">
          <Link to="/" onClick={() => window.scrollTo(0, 0)}>
             <img src={logo} alt="Logo" className="h-8 w-auto" />
          </Link>

          <div className="flex items-center gap-3">
            {user && (
              <Link to="/notifications" className="relative text-dark p-1">
                <Bell size={22} />
                {notificationCount > 0 && (
                  <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-red-500 rounded-full border border-white"></span>
                )}
              </Link>
            )}
          </div>
      </header>

      {/* Main Content (with padding for header) */}
      <main className="pt-[60px]">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] h-[65px] z-50 flex justify-around items-center px-1 pb-safe lg:hidden">
        {navigationItems.map((item, idx) => (
          <Link
            key={idx}
            to={item.path}
            className={`flex flex-col items-center justify-center w-full h-full pt-1 pb-1 transition-colors duration-200 ${isActive(item.path) ? 'text-primary' : 'text-gray-400 hover:text-gray-600'}`}
            onClick={() => window.scrollTo(0, 0)}
          >
            <div className="relative">
              {item.icon}
              {item.badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full border border-white">
                    {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold mt-1">{item.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
};

export default MobileLayout;
