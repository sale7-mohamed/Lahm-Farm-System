// src/components/layout/Footer.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Phone, Mail, ArrowUp, Globe, MapPin } from "lucide-react";
import { useTranslation } from "react-i18next";
import logo from "../../assets/logo.png";

function Footer() {
  const { t, i18n } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [showTopBtn, setShowTopBtn] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    const handleScroll = () => {
      if (window.scrollY > 300) setShowTopBtn(true);
      else setShowTopBtn(false);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll);
    };
  },[]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLanguageChange = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    sessionStorage.setItem('scrollPos', window.scrollY);
    i18n.changeLanguage(newLang).then(() => window.location.reload());
  };

  const ScrollTopButton = () => (
    <button
      onClick={scrollToTop}
      className={`fixed z-40 bg-primary/90 hover:bg-primary text-white p-2 rounded-full shadow-lg transition-all duration-300 transform backdrop-blur-sm
        ${showTopBtn ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"}
        ${isMobile ? "bottom-20 left-4" : "bottom-8 right-8"}
      `}
      aria-label="Back to top"
    >
      <ArrowUp size={20} />
    </button>
  );

  // --- Mobile Footer View ---
  if (isMobile) {
    return (
      <>
        <ScrollTopButton />
        <footer className="bg-[#111] text-gray-400 pb-24 pt-10 border-t border-gray-800 text-[10px]">
            <div className="px-4 text-center">

                {}
                <div className="mb-6">
                    <p className="text-[10px] text-gray-600 font-bold mb-3 tracking-widest uppercase opacity-70">
                        {t('nav.policies')}
                    </p>
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 font-medium text-gray-300">
                        <Link to="/refund-policy" onClick={scrollToTop} className="hover:text-white transition-colors">{t('policies.refund_nav')}</Link>
                        <Link to="/shipping-policy" onClick={scrollToTop} className="hover:text-white transition-colors">{t('policies.shipping_nav')}</Link>
                        <Link to="/privacy-policy" onClick={scrollToTop} className="hover:text-white transition-colors">{t('policies.privacy_nav')}</Link>
                        <Link to="/terms" onClick={scrollToTop} className="hover:text-white transition-colors">{t('policies.terms_nav')}</Link>
                        <Link to="/cookies-policy" onClick={scrollToTop} className="hover:text-white transition-colors">{t('policies.cookies_nav')}</Link>
                    </div>
                </div>

                {}
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-3 mb-8 font-medium text-gray-500 border-t border-gray-800 pt-4 w-3/4 mx-auto">
                    <Link to="/faq" onClick={scrollToTop} className="hover:text-white transition-colors">{t('nav.faq')}</Link>
                    <Link to="/about" onClick={scrollToTop} className="hover:text-white transition-colors">{t('nav.about_us')}</Link>
                    <Link to="/careers" onClick={scrollToTop} className="hover:text-white transition-colors">{t('nav.careers')}</Link>
                </div>

                <div className="mb-8">
                    <Link
                        to="/contact"
                        onClick={scrollToTop}
                        className="inline-flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-2.5 rounded-full border border-gray-700 transition-all text-[11px] font-bold"
                    >
                        <Phone size={14} className="text-primary" />
                        {t('footer.contact')}
                    </Link>
                </div>

                <div className="flex justify-center gap-5 mb-8">
                    <SocialLink href="https://www.facebook.com/lahmfarm/" iconClass="bi bi-facebook" colorClass="hover:text-[#1877F2]" isMobile={true} />
                    <SocialLink href="https://www.instagram.com/lahmfarm/" iconClass="bi bi-instagram" colorClass="hover:text-[#bc1888]" isMobile={true} />
                    <SocialLink href="https://www.tiktok.com/@lahmfarm" iconClass="bi bi-tiktok" colorClass="hover:text-white" isMobile={true} />
                    <SocialLink href="https://wa.me/201037029909" iconClass="bi bi-whatsapp" colorClass="hover:text-[#25D366]" isMobile={true} />
                </div>

                <div className="border-t border-gray-800 pt-5 flex flex-col gap-3 items-center">
                    <button onClick={handleLanguageChange} className="flex items-center gap-1.5 hover:text-white text-[10px] bg-gray-900 px-3 py-1 rounded-md border border-gray-800">
                        <Globe size={12} /> {i18n.language === 'ar' ? 'English' : 'العربية'}
                    </button>

                    <div className="text-[9px] text-gray-600">
                        &copy; {currentYear} {t('common.logo_text')} - {t('footer.rights')}
                    </div>
                </div>
            </div>
        </footer>
      </>
    );
  }

  // --- Desktop Footer View ---
  return (
    <>
      <ScrollTopButton />

      <footer className="bg-[#111] text-white pt-16 pb-8 border-t border-gray-900 relative hidden lg:block">
        <div className="container mx-auto px-4">
            <div className="grid grid-cols-4 gap-8">

            {/* Column 1: Brand & Contact */}
            <div className="text-start">
                <Link to="/" onClick={scrollToTop} className="inline-block mb-5">
                  <img src={logo} alt="Lahim Logo" className="h-16 w-auto object-contain brightness-0 invert" style={{opacity: 0.9}} />
                </Link>
                <p className="text-gray-500 text-sm leading-relaxed mb-6 pe-4">
                    {t('footer.desc')}
                </p>

                <div className="flex flex-col gap-3 mb-6">
                    {}
                    <a href="tel:+201037029909" className="flex items-center gap-3 text-sm text-gray-400 hover:text-white group">
                        <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-primary transition-colors">
                           <Phone size={14} className="text-gray-300 group-hover:text-white"/>
                        </div>
                        {/* dir="ltr"        */}
                        <span dir="ltr" className="font-mono text-gray-300 group-hover:text-white transition-colors">
                            +20 103 702 9909
                        </span>
                    </a>

                    <a href="mailto:info@lahmfarm.com" className="flex items-center gap-3 text-sm text-gray-400 hover:text-white group">
                         <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center group-hover:bg-primary transition-colors">
                            <Mail size={14} className="text-gray-300 group-hover:text-white"/>
                        </div>
                        <span>info@lahmfarm.com</span>
                    </a>
                </div>
            </div>

            {/* Column 2: Shop */}
            <div className="text-start pt-2">
                <h3 className="text-base font-bold text-white mb-6 uppercase tracking-wider border-b border-gray-800 pb-2 inline-block">
                    {t('footer.shop_with_us')}
                </h3>
                <ul className="space-y-3">
                    <FooterLink to="/livestock" text={t('nav.livestock')} onClick={scrollToTop} />
                    <FooterLink to="/adahi" text={t('nav.adahi')} onClick={scrollToTop} />
                    <FooterLink to="/shares" text={t('nav.shares')} onClick={scrollToTop} />
                    <FooterLink to="/request-livestock" text={t('orders_page.special_request')} onClick={scrollToTop} />
                    <FooterLink to="/my-orders" text={t('nav.my_orders')} onClick={scrollToTop} />
                </ul>
            </div>

            {/* Column 3: Company */}
            <div className="text-start pt-2">
                <h3 className="text-base font-bold text-white mb-6 uppercase tracking-wider border-b border-gray-800 pb-2 inline-block">
                    {t('nav.about_us')}
                </h3>
                <ul className="space-y-3">
                    <FooterLink to="/about" text={t('nav.about_us')} onClick={scrollToTop} />
                    <FooterLink to="/partnerships?tab=farm" text={t('footer.farm_partner')} onClick={scrollToTop} />
                    <FooterLink to="/partnerships?tab=business" text={t('footer.business_partner')} onClick={scrollToTop} />
                    <FooterLink to="/careers" text={t('nav.careers')} onClick={scrollToTop} />
                    <FooterLink to="/contact" text={t('footer.contact')} onClick={scrollToTop} />
                </ul>
            </div>

            {/* Column 4: Help & Policies (Combined & Short) */}
            <div className="text-start pt-2">
                <h3 className="text-base font-bold text-white mb-6 uppercase tracking-wider border-b border-gray-800 pb-2 inline-block">
                    {t('nav.policies')} {t('footer.and_help')}
                </h3>
                <ul className="space-y-3">
                    <FooterLink to="/faq" text={t('nav.faq')} onClick={scrollToTop} />
                    {}
                    <FooterLink to="/refund-policy" text={t('policies.refund_nav')} onClick={scrollToTop} />
                    <FooterLink to="/shipping-policy" text={t('policies.shipping_nav')} onClick={scrollToTop} />
                    <FooterLink to="/privacy-policy" text={t('policies.privacy_nav')} onClick={scrollToTop} />
                    <FooterLink to="/terms" text={t('policies.terms_nav')} onClick={scrollToTop} />
                    <FooterLink to="/cookies-policy" text={t('policies.cookies_nav')} onClick={scrollToTop} />
                </ul>
            </div>
            </div>

            {/* Bottom Bar */}
            <div className="border-t border-gray-800 mt-16 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <p className="text-gray-600 text-xs">
                    &copy; {currentYear} {t('common.logo_text')}. {t('footer.rights')}
                </p>

                <div className="flex gap-4">
                    <SocialLink href="https://www.facebook.com/lahmfarm/" iconClass="bi bi-facebook" colorClass="hover:bg-[#1877F2]" />
                    <SocialLink href="https://www.instagram.com/lahmfarm/" iconClass="bi bi-instagram" colorClass="hover:bg-gradient-to-tr hover:from-[#f09433] hover:to-[#bc1888]" />
                    <SocialLink href="https://www.tiktok.com/@lahmfarm" iconClass="bi bi-tiktok" colorClass="hover:bg-[#000000] border border-gray-800" />
                    <SocialLink href="https://wa.me/201037029909" iconClass="bi bi-whatsapp" colorClass="hover:bg-[#25D366]" />
                </div>
            </div>
        </div>
      </footer>
    </>
  );
}

const SocialLink = ({ href, iconClass, colorClass, isMobile }) => {
    if (isMobile) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer" className={`text-gray-500 transition-colors ${colorClass}`}>
                <i className={`${iconClass} text-xl`}></i>
            </a>
        );
    }
    return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={`w-9 h-9 rounded-lg bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-all duration-300 hover:-translate-y-1 ${colorClass}`}>
            <i className={`${iconClass} text-sm`}></i>
        </a>
    );
};

const FooterLink = ({ to, text, onClick }) => {
  const navigate = useNavigate();
  const handleClick = (e) => {
    e.preventDefault();
    navigate(to);
    if (onClick) onClick();
  };
  return (
    <li>
      <a href={to} onClick={handleClick} className="text-gray-500 hover:text-primary hover:ps-1 transition-all text-sm block duration-200">
        {text}
      </a>
    </li>
  );
};

export default Footer;