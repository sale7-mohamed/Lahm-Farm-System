import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import {
  ShoppingCart, User, LogOut, ChevronDown, Bell, Search,
  LayoutDashboard, Package, Menu, X, Gift, Users, FileText,
  Handshake, Home, ShoppingBag, Phone, HelpCircle, Info, ChevronRight, MapPin, Briefcase
} from "lucide-react";
import useAuth from "../../context/auth/useAuth";
import { useApp } from "../../context/app/useApp";
import { useTranslation } from "react-i18next";
import axios from "../../services/axiosConfig";
import logo from "../../assets/logo.png";

const COMMON_SEARCH_KEYWORDS = [
  "بقر", "عجل", "جاموس", "خروف", "ماعز", "جمل",
  "عجل وزن 250", "عجل وزن 300", "عجل وزن 400", "خروف برقي", "عجل بقري"
];

const DrawerLink = ({ to, Icon, text, badge, onClick }) => {
  const { i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  return (
    <Link to={to} onClick={onClick} className="flex items-center justify-between p-3 rounded-xl text-gray-700 hover:bg-gray-50 hover:text-primary transition-all group active:scale-[0.98]">
      <div className="flex items-center gap-3">
        <div className="text-gray-400 group-hover:text-primary transition-colors">{Icon && <Icon size={20} />}</div>
        <span className="font-bold text-sm">{text}</span>
      </div>
      {badge ? (
        <span className="bg-accent text-dark text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>
      ) : (
        <ChevronRight size={16} className={`text-gray-300 ${isRtl ? "rotate-180" : ""}`} />
      )}
    </Link>
  );
};

const NavLink = ({ to, text, className = "" }) => (
  <Link to={to} className={`text-dark font-bold hover:text-primary transition-colors text-[11px] lg:text-[13px] xl:text-[15px] flex-shrink min-w-0 ${className}`}>
    {text}
  </Link>
);

const DropdownItem = ({ to, icon, text, badge }) => (
  <Link to={to} className="flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 hover:text-primary transition-colors group">
    <div className="flex items-center gap-3">
      <span className="text-muted group-hover:text-primary transition-colors">{icon}</span>
      <span className="font-bold">{text}</span>
    </div>
    {badge && <span className="bg-accent text-dark text-[10px] px-2 py-0.5 rounded-full font-bold">{badge}</span>}
  </Link>
);

function Navbar({ isAtTop }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const { user, logout } = useAuth();
  const { cartCount, notificationCount } = useApp();
  const navigate = useNavigate();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileMenuMounted, setIsMobileMenuMounted] = useState(false);
  const [isMobileMenuVisible, setIsMobileMenuVisible] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [opSettings, setOpSettings] = useState(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await axios.get("/core/public-operation-settings/");
        setOpSettings(res.data);
      } catch {
        console.error("Failed to load settings in Navbar");
      }
    };
    fetchSettings();
  }, []);

  const openMobileMenu = () => {
    setIsMobileMenuMounted(true);
    setTimeout(() => setIsMobileMenuVisible(true), 10);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuVisible(false);
    setTimeout(() => setIsMobileMenuMounted(false), 300);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
        setIsSearchFocused(false);
      }
    }

    function handleScroll() {
      if (isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    document.body.style.overflow = isMobileMenuMounted ? "hidden" : "unset";
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuMounted]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = COMMON_SEARCH_KEYWORDS.filter(k => k.includes(searchQuery.trim()));
      setSearchResults(filtered);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const handleLanguageChange = () => {
    const newLang = i18n.language === "ar" ? "en" : "ar";
    sessionStorage.setItem("scrollPos", window.scrollY);
    i18n.changeLanguage(newLang).then(() => window.location.reload());
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      executeSearch(searchQuery.trim());
    }
  };

  const executeSearch = (term) => {
    const params = new URLSearchParams();
    params.set('search', term);

    let cats = [];
    if (term.includes('بقري') || term.includes('بقر')) {
      cats.push('بقر');
    } else if (term.includes('جاموس')) {
      cats.push('جاموس');
    } else if (term.includes('عجل')) {
      cats.push('بقر', 'جاموس');
    } else if (term.includes('خروف') || term.includes('ضأن') || term.includes('برقي')) {
      cats.push('ضأن', 'خروف');
    } else if (term.includes('ماعز') || term.includes('جدي')) {
      cats.push('ماعز');
    } else if (term.includes('جمل') || term.includes('ابل') || term.includes('إبل')) {
      cats.push('إبل', 'جمل');
    }

    if (cats.length > 0) {
      params.set('inferred_cats', cats.join(','));
    }

    const priceMatch = term.match(/(?:سعر|بسعر|بـ|ب)\s*(\d+)/) || term.match(/(\d+)\s*(?:جنيه|جنية|ج|الف|ألف)/);
    let hasPrice = false;
    if (priceMatch) {
      const priceVal = parseFloat(priceMatch[1]);
      params.set('price_min', Math.floor(priceVal * 0.8));
      params.set('price_max', Math.ceil(priceVal * 1.2));
      params.set('target_price', priceVal);
      hasPrice = true;
    }

    const weightMatch = term.match(/(?:وزن|كيلو|كجم|kg)\s*(\d+)/);
    let finalWeightVal = null;

    if (weightMatch) {
      finalWeightVal = parseFloat(weightMatch[1]);
    } else if (!hasPrice) {
      const standaloneNumMatch = term.match(/(?:\b|^)(\d+)(?:\b|$)/);
      if (standaloneNumMatch) {
        const num = parseFloat(standaloneNumMatch[1]);
        if (num < 2000) {
          finalWeightVal = num;
        }
      }
    }

    if (finalWeightVal !== null) {
      params.set('weight_min', Math.floor(finalWeightVal * 0.85));
      params.set('weight_max', Math.ceil(finalWeightVal * 1.15));
      params.set('target_weight', finalWeightVal);
    }

    navigate(`/livestock?${params.toString()}`);
    setShowSearchResults(false);
    setSearchQuery("");
    setIsSearchFocused(false);
    if (isMobileMenuVisible) closeMobileMenu();
  };

  return (
    <>
      <nav className="hidden lg:block bg-white shadow-sm w-full relative z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-8 xl:gap-10 flex-grow">
              <Link to="/" onClick={() => window.scrollTo(0, 0)} className="flex-shrink-0">
                <img src={logo} alt="Lahim Logo" className="h-14 w-auto object-contain" />
              </Link>

              <div className={`flex items-center justify-center gap-2 lg:gap-3 xl:gap-5 transition-all duration-500 ease-in-out overflow-hidden whitespace-nowrap ${isSearchFocused ? 'max-w-0 opacity-0 m-0' : 'max-w-[850px] opacity-100'}`}>
                <NavLink to="/" text={t("nav.home")} />
                <NavLink to="/livestock" text={t("nav.livestock")} />
                {opSettings?.is_adahi_season_active && (
                  <NavLink to="/adahi" text={t("nav.adahi")} />
                )}
                {opSettings?.enable_general_shares !== false && (
                  <NavLink to="/shares" text={t("nav.shares")} />
                )}
                <NavLink to="/partnerships" text={t("nav.partnerships")} />
                {user && user.is_corporate && (
                  <Link
                    to="/business"
                    className="flex items-center gap-2 text-[#b45309] hover:text-primary transition-colors text-[15px] font-bold"
                  >
                    <Briefcase size={18} strokeWidth={2.5} />
                    <span>{t("nav.business_portal")}</span>
                  </Link>
                )}
              </div>

              <div className={`transition-all duration-500 ease-in-out ${isSearchFocused ? 'flex-grow max-w-4xl' : 'flex-grow max-w-xs lg:max-w-sm'} mx-4 relative`} ref={searchRef}>
                <form onSubmit={handleSearchSubmit} className="relative group">
                  <button
                    type="submit"
                    className={`absolute top-0 bottom-0 ${
                      isRtl ? "right-3" : "left-3"
                    } flex items-center text-gray-400 group-focus-within:text-primary transition-colors bg-transparent border-0`}
                  >
                    <Search size={18} />
                  </button>
                  <input
                    type="text"
                    className={`w-full py-2 bg-gray-50 border border-gray-200 rounded-full focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-300 ease-in-out text-sm font-bold ${
                      isRtl ? "pr-10 pl-4" : "pl-10 pr-4"
                    }`}
                    placeholder={t('nav.search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSearchResults(true);
                    }}
                    onFocus={() => {
                      setShowSearchResults(true);
                      setIsSearchFocused(true);
                    }}
                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                  />
                </form>

                {showSearchResults && searchQuery.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-fade-in-up">
                    {searchResults.length > 0 ? (
                      searchResults.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => executeSearch(item)}
                          className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                        >
                          <Search size={16} className="text-gray-400" />
                          <span className="text-sm font-bold text-dark">{item}</span>
                        </div>
                      ))
                    ) : (
                      <div
                        onClick={() => executeSearch(searchQuery)}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer text-primary"
                      >
                        <Search size={16} />
                        <span className="text-sm font-bold">{t('nav.search_for', { query: searchQuery })}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 flex-shrink-0">
              <button
                onClick={handleLanguageChange}
                className="text-sm font-bold text-muted hover:text-primary transition-colors border border-gray-200 px-3 py-1 rounded-full"
              >
                {i18n.language === "ar" ? "EN" : "ع"}
              </button>

              <Link
                to="/cart"
                className="relative group text-dark hover:text-primary transition-colors"
              >
                <ShoppingCart size={24} strokeWidth={1.5} />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 bg-primary text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white animate-pulse-glow">
                    {cartCount}
                  </span>
                )}
              </Link>

              {user && (
                <Link to="/notifications" className="relative group text-dark hover:text-primary transition-colors me-2">
                  <Bell size={24} strokeWidth={1.5} />
                  {notificationCount > 0 && (
                    <>
                      <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 opacity-75 animate-ping"></span>
                      <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-white z-10 shadow-sm">
                        {notificationCount > 9 ? '9+' : notificationCount}
                      </span>
                    </>
                  )}
                </Link>
              )}

              {user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center gap-2 text-dark hover:bg-gray-50 px-3 py-2 rounded-xl transition-all border border-transparent hover:border-gray-100"
                  >
                    <div className="w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center">
                      <User size={18} />
                    </div>
                    <span className="font-semibold text-sm max-w-[80px] truncate">
                      {user.full_name?.split(" ")[0]}
                    </span>
                    <ChevronDown
                      size={14}
                      className={`text-muted transition-transform ${
                        isDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isDropdownOpen && (
                    <div className="absolute end-0 mt-2 w-60 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in-up z-50">
                      <div className="py-2">
                        <DropdownItem to="/account-dashboard" icon={<LayoutDashboard size={18} />} text={t("nav.dashboard")} />
                        <DropdownItem to="/my-orders" icon={<Package size={18} />} text={t("nav.my_orders")} />
                        {user.is_corporate && (
                          <DropdownItem to="/business" icon={<Briefcase size={18} />} text={t("nav.business_portal")} badge="New" />
                        )}
                        <DropdownItem to="/notifications" icon={<Bell size={18} />} text={t("nav.notifications")} badge={notificationCount > 0 ? notificationCount : null} />
                        <DropdownItem to="/profile" icon={<User size={18} />} text={t("profile.personal_info")} />
                        <div className="h-px bg-gray-100 my-1" />
                        <button
                          onClick={() => { logout(); navigate("/"); }}
                          className="w-full text-start px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors font-bold"
                        >
                          <LogOut size={18} /> {t("common.logout")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  to="/account/login-check"
                  className="bg-dark hover:bg-black text-white px-5 py-2 rounded-xl font-bold text-xs transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 flex items-center gap-2"
                >
                  <User size={16} /> {t("auth.login_btn")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div
        className={`lg:hidden bg-white shadow-sm w-full relative z-40 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]`}
        style={{ height: isAtTop ? "110px" : "65px" }}
      >
        <div className="relative w-full h-full px-4">
          <div
            className={`absolute top-4 ${isRtl ? "right-2" : "left-2"} z-20 transition-all duration-500 ${
              !isAtTop ? "opacity-0 pointer-events-none -translate-y-2" : "opacity-100 translate-y-0"
            }`}
          >
            <button onClick={openMobileMenu} className="text-dark p-2 hover:bg-gray-50 rounded-xl transition-colors active:scale-95">
              <Menu size={28} />
            </button>
          </div>

          <Link
            to="/"
            onClick={() => window.scrollTo(0, 0)}
            className={`absolute z-30 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] block`}
            style={{
              top: isAtTop ? "18px" : "15px",
              right: isRtl ? (isAtTop ? "60px" : "16px") : "auto",
              left: isRtl ? "auto" : (isAtTop ? "60px" : "16px"),
              transform: isAtTop ? "scale(1)" : "scale(0.9)",
            }}
          >
            <img src={logo} alt="Logo" className="h-8 w-auto object-contain" />
          </Link>

          <div
            className={`absolute top-5 ${isRtl ? "left-3" : "right-3"} z-20 flex items-center gap-2 transition-all duration-500 ${
              !isAtTop ? "opacity-0 pointer-events-none translate-x-4" : "opacity-100 translate-x-0"
            }`}
          >
            <button
              onClick={handleLanguageChange}
              className="text-[10px] font-bold text-gray-500 border border-gray-200 px-2 py-1 rounded-md"
            >
              {i18n.language === "ar" ? "EN" : "ع"}
            </button>
            {user ? (
              <Link to="/notifications" className="relative text-dark p-1.5 me-2 mt-1">
                <Bell size={24} />
                {notificationCount > 0 && (
                  <>
                    <span className="absolute top-1 end-1 block h-3 w-3 rounded-full bg-red-500 opacity-75 animate-ping" />
                    <span className="absolute top-1.5 end-1.5 block h-2 w-2 rounded-full bg-red-600 ring-2 ring-white z-10" />
                  </>
                )}
              </Link>
            ) : (
              <Link to="/account/login-check" className="bg-dark text-white px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm flex items-center gap-1">
                <User size={14} /> {t("auth.login_btn")}
              </Link>
            )}
          </div>

          <div
            className={`absolute transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]`}
            style={{
              bottom: isAtTop ? "12px" : "12px",
              top: isAtTop ? "auto" : "12px",
              left: isRtl ? "16px" : (isAtTop ? "16px" : "80px"),
              right: isRtl ? (isAtTop ? "16px" : "80px") : "16px",
              width: "auto",
            }}
          >
            <form onSubmit={handleSearchSubmit} className="h-10 w-full relative">
              <button
                type="submit"
                className={`absolute top-0 bottom-0 ${isRtl ? "right-3" : "left-3"} flex items-center text-gray-400 bg-transparent border-0 z-10 h-full`}
              >
                <Search size={16} />
              </button>
              <input
                type="text"
                className={`w-full h-full bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary text-sm font-bold transition-all duration-300 ${isRtl ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                placeholder={t('nav.search_placeholder_mobile')}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
              />

              {showSearchResults && searchQuery.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                  {searchResults.length > 0 ? (
                    searchResults.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => executeSearch(item)}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0"
                      >
                        <Search size={14} className="text-gray-400" />
                        <span className="text-xs font-bold text-dark">{item}</span>
                      </div>
                    ))
                  ) : (
                    <div
                      onClick={() => executeSearch(searchQuery)}
                      className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer text-primary"
                    >
                      <Search size={14} />
                      <span className="text-xs font-bold">{t('nav.search_for', { query: searchQuery })}</span>
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {isMobileMenuMounted &&
        createPortal(
          <div className="fixed inset-0 z-[9999]" dir={isRtl ? "rtl" : "ltr"}>
            <div
              className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${isMobileMenuVisible ? "opacity-100" : "opacity-0"}`}
              onClick={closeMobileMenu}
            />

            <div className={`absolute top-0 ${isRtl ? "right-0" : "left-0"} w-[85%] max-w-[320px] h-full bg-white shadow-2xl overflow-y-auto transform transition-transform duration-300 ease-out ${isMobileMenuVisible ? "translate-x-0" : isRtl ? "translate-x-full" : "-translate-x-full"}`}>
              <div className="bg-dark text-white p-5 pt-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl" />
                <button onClick={closeMobileMenu} className="absolute top-4 left-4 text-white/70 hover:text-white p-1">
                  <X size={24} />
                </button>

                {user ? (
                  <Link to="/profile" onClick={closeMobileMenu} className="relative z-10 flex items-center gap-3 group active:scale-95 transition-transform cursor-pointer">
                    <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center text-white border-2 border-white shadow-md text-xl font-bold group-hover:bg-primary-dark transition-colors">
                      {user.full_name?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-bold text-lg leading-tight text-white mb-0.5 group-hover:text-primary-light transition-colors">{user.full_name}</h3>
                      <p className="text-white/60 text-xs mb-0" dir="ltr">{user.phone}</p>
                    </div>
                  </Link>
                ) : (
                  <div className="relative z-10">
                    <h3 className="font-bold text-xl mb-3">{t("auth.check_title")} 👋</h3>
                    <Link to="/account/login-check" onClick={closeMobileMenu} className="inline-flex items-center gap-2 bg-white text-dark px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-100 transition-colors">
                      <User size={16} /> {t("auth.login_btn")}
                    </Link>
                  </div>
                )}
              </div>

              <div className="p-4 pb-20 space-y-6">
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">{t("nav.home")}</h4>
                  <div className="space-y-1">
                    <DrawerLink to="/" Icon={Home} text={t("common.home")} onClick={closeMobileMenu} />
                    <DrawerLink to="/livestock" Icon={ShoppingBag} text={t("nav.livestock")} onClick={closeMobileMenu} />
                    {opSettings?.is_adahi_season_active && (
                      <DrawerLink to="/adahi" Icon={Gift} text={t("nav.adahi")} badge={opSettings?.show_eid_timer || opSettings?.enable_eid_celebration ? t("eid.season_badge") : null} onClick={closeMobileMenu} />
                    )}
                    {opSettings?.enable_general_shares !== false && (
                      <DrawerLink to="/shares" Icon={Users} text={t("nav.shares")} onClick={closeMobileMenu} />
                    )}
                    <DrawerLink to="/request-livestock" Icon={FileText} text={t("orders_page.special_request")} onClick={closeMobileMenu} />
                  </div>
                </div>

                {user && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">{t("common.my_account")}</h4>
                    <div className="space-y-1">
                      <DrawerLink to="/account-dashboard" Icon={LayoutDashboard} text={t("nav.dashboard")} onClick={closeMobileMenu} />
                      {user.is_corporate && (
                        <DrawerLink to="/business" Icon={Briefcase} text={t("nav.business_portal")} badge="New" onClick={closeMobileMenu} />
                      )}
                      <DrawerLink to="/my-orders" Icon={Package} text={t("nav.my_orders")} onClick={closeMobileMenu} />
                      <DrawerLink to="/addresses" Icon={MapPin} text={t("profile.addresses")} onClick={closeMobileMenu} />
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 px-2">{t("nav.home")}</h4>
                  <div className="space-y-1">
                    <DrawerLink to="/partnerships" Icon={Handshake} text={t("nav.partnerships")} onClick={closeMobileMenu} />
                    <DrawerLink to="/about" Icon={Info} text={t("home.about_us")} onClick={closeMobileMenu} />
                    <DrawerLink to="/contact" Icon={Phone} text={t("footer.contact")} onClick={closeMobileMenu} />
                    <DrawerLink to="/faq" Icon={HelpCircle} text={t("nav.faq")} onClick={closeMobileMenu} />
                  </div>
                </div>

                {user && (
                  <button onClick={() => { logout(); closeMobileMenu(); navigate("/"); }} className="flex items-center gap-3 w-full p-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors mt-4 font-bold border border-red-100">
                    <LogOut size={20} /> {t("common.logout")}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export default Navbar;
