import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ShoppingCart, User, Beef, Package } from 'lucide-react'; // Package for Orders
import { useApp } from '../../context/app/useApp';
import useAuth from '../../context/auth/useAuth';
import { useTranslation } from 'react-i18next';

const MobileBottomNav = () => {
    const { t } = useTranslation();
    const { cartCount } = useApp();
    const { user } = useAuth();

    const linkClass = ({ isActive }) =>
        `flex flex-col items-center justify-center w-full h-full pt-1 pb-1 transition-colors duration-200 ${
            isActive ? 'text-primary' : 'text-gray-400 hover:text-gray-600'
        }`;

    const iconSize = 24;

    return (
        <nav className="mobile-nav-bar fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] h-[65px] z-50 flex justify-around items-center px-1 pb-safe lg:hidden">

            {/* 1. Home */}
            <NavLink to="/" className={linkClass}>
                <Home size={iconSize} strokeWidth={2} className="mb-0.5" />
                <span className="text-[10px] font-bold">{t('common.home')}</span>
            </NavLink>

            {/* 2. Livestock (Shop) */}
            <NavLink to="/livestock" className={linkClass}>
                <Beef size={iconSize} strokeWidth={2} className="mb-0.5" />
                <span className="text-[10px] font-bold">{t('nav.livestock')}</span>
            </NavLink>

            {/* 3. Cart (Center - Highlighted) */}
            <NavLink to="/cart" className={({ isActive }) => `flex flex-col items-center justify-center w-full h-full -mt-5 ${isActive ? 'text-primary' : 'text-gray-400'}`}>
                <div className={`relative p-3 rounded-full shadow-lg border-4 border-white ${location.pathname === '/cart' ? 'bg-primary text-white' : 'bg-dark text-white'}`}>
                    <ShoppingCart size={24} strokeWidth={2} />
                    {cartCount > 0 && (
                        <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold h-4 w-4 flex items-center justify-center rounded-full border border-white">
                            {cartCount > 9 ? '9+' : cartCount}
                        </span>
                    )}
                </div>
                <span className="text-[10px] font-bold mt-1">{t('nav.cart')}</span>
            </NavLink>

            {/* 4. My Orders (Important for recurring users) */}
            <NavLink to={user ? "/my-orders" : "/account/login-check"} className={linkClass}>
                <Package size={iconSize} strokeWidth={2} className="mb-0.5" />
                <span className="text-[10px] font-bold">{t('nav.my_orders')}</span>
            </NavLink>

            {/* 5. Profile */}
            <NavLink to={user ? "/account-dashboard" : "/account/login-check"} className={linkClass}>
                <User size={iconSize} strokeWidth={2} className="mb-0.5" />
                <span className="text-[10px] font-bold">{user ? t('common.my_account') : t('common.login')}</span>
            </NavLink>

        </nav>
    );
};

export default MobileBottomNav;
