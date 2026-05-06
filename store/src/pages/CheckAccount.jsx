import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import useAuth from '../context/auth/useAuth';
import { ChevronDown, ArrowRight, ArrowLeft, LogIn, Lock, AlertCircle, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const safeSessionStorage = {
    getItem: (key) => {
        try {
            return sessionStorage.getItem(key);
        } catch (error) {
            console.warn(`Error getting session storage key "${key}":`, error);
            return null;
        }
    },
    setItem: (key, value) => {
        try {
            sessionStorage.setItem(key, value);
            return value;
        } catch (error) {
            console.error(`Error setting session storage key "${key}":`, error);
            return null;
        }
    },
    removeItem: (key) => {
        try {
            sessionStorage.removeItem(key);
        } catch (error) {
            console.warn(`Error removing session storage key "${key}":`, error);
        }
    },
    clearTempData: () => {
        try {
            sessionStorage.removeItem('temp_check_id');
            sessionStorage.removeItem('temp_check_step');
            sessionStorage.removeItem('returnUrl');
        } catch (error) {
            console.warn("Error clearing temp data from session storage:", error);
        }
    }
};

function CheckAccount() {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const [identifier, setIdentifier] = useState(() => safeSessionStorage.getItem('temp_check_id') || '');
    const [password, setPassword] = useState('');
    const [step, setStep] = useState(() => safeSessionStorage.getItem('temp_check_step') || 'check');
    const [loading, setLoading] = useState(false);

    const [isEmptyError, setIsEmptyError] = useState(false);
    const [validationError, setValidationError] = useState('');
    const [shakeError, setShakeError] = useState(false);
    const [inputType, setInputType] = useState('neutral');

    const [countryCode, setCountryCode] = useState('+20');
    const [showCountryDropdown, setShowCountryDropdown] = useState(false);
    const [currentCountry, setCurrentCountry] = useState(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        safeSessionStorage.setItem('temp_check_id', identifier);
        safeSessionStorage.setItem('temp_check_step', step);
    }, [identifier, step]);

    const countries = useMemo(() => [
        {
            code: '+20',
            name: t('countries.egypt', 'مصر'),
            flag: '🇪🇬',
            formats: [/^(\+?20|0)?1[0-9]{9}$/, /^01[0-9]{9}$/, /^1[0-9]{9}$/]
        },
        {
            code: '+966',
            name: t('countries.saudi_arabia', 'السعودية'),
            flag: '🇸🇦',
            formats: [/^(\+?966)?5[0-9]{8}$/]
        },
        {
            code: '+971',
            name: t('countries.uae', 'الإمارات'),
            flag: '🇦🇪',
            formats: [/^(\+?971)?5[0-9]{8}$/]
        }
    ], [t]);

    const navigate = useNavigate();
    const location = useLocation();
    const { login } = useAuth();

    const detectCountryFromIP = useCallback(async () => {
        try {
            const response = await axios.get('/accounts/detect-country/');
            const detectedCode = response.data.country_code.startsWith('+')
                ? response.data.country_code
                : `+${response.data.country_code}`;
            const found = countries.find(c => c.code === detectedCode) || countries[0];
            setCountryCode(found.code);
            setCurrentCountry(found);
        } catch {
            setCurrentCountry(countries[0]);
            setCountryCode(countries[0].code);
        }
    }, [countries]);

    useEffect(() => {
        detectCountryFromIP();
        if (location.state?.error) {
            setValidationError(location.state.error);
        }

        return () => {
            if (step === 'login') {
                safeSessionStorage.clearTempData();
            }
        };
    }, [detectCountryFromIP, location.state, step]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowCountryDropdown(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!identifier) {
            setInputType('neutral');
            setValidationError('');
        } else if (/^[0-9+\s]+$/.test(identifier)) {
            setInputType('phone');
            setIsEmptyError(false);
            setValidationError('');
        } else {
            setInputType('email');
            setIsEmptyError(false);
            setValidationError('');
        }
    }, [identifier]);

    const triggerShake = useCallback(() => {
        setShakeError(true);
        setTimeout(() => setShakeError(false), 400);
    }, []);

    const validatePhoneNumber = useCallback((phone, country) => {
        if (!country) return true;
        return country.formats.some(pattern => pattern.test(phone));
    }, []);

    const handleCheckAccount = async (e) => {
        e.preventDefault();
        setValidationError('');

        if (!identifier.trim()) {
            setIsEmptyError(true);
            triggerShake();
            return;
        }

        let finalIdentifier = identifier.trim();

        if (inputType === 'email') {
            if (!/^\S+@\S+\.\S+$/.test(finalIdentifier)) {
                setValidationError(t('errors.invalid_email', 'البريد الإلكتروني غير صحيح'));
                triggerShake();
                return;
            }
        } else if (inputType === 'phone') {
            if (!validatePhoneNumber(finalIdentifier, currentCountry)) {
                setValidationError(t('errors.invalid_phone_format', 'صيغة الرقم غير صحيحة'));
                triggerShake();
                return;
            }

            let normalized = finalIdentifier.replace(/\D/g, '');
            const codeDigits = currentCountry?.code.replace('+', '');
            if (normalized.startsWith(codeDigits)) {
                normalized = normalized.substring(codeDigits.length);
            }
            if (normalized.startsWith('0')) {
                normalized = normalized.substring(1);
            }
            finalIdentifier = `${currentCountry?.code}${normalized}`;
        }

        setLoading(true);
        try {
            const res = await axios.post('/accounts/check-account/', {
                identifier: finalIdentifier
            });
            const { account_exists, password_set, is_verified } = res.data;

            if (account_exists) {
                if (is_verified) {
                    if (password_set) {
                        setIdentifier(finalIdentifier);
                        setStep('login');
                    } else {
                        toast.info(t('auth.account_exists'));
                        safeSessionStorage.setItem('pendingIdentifier', finalIdentifier);
                        navigate('/reset-password/request', {
                            state: {
                                phone: finalIdentifier,
                                fromCheckAccount: true
                            }
                        });
                    }
                } else {
                    try {
                        const payload = inputType === 'phone' ? { phone: finalIdentifier } : { email: finalIdentifier };
                        await axios.post('/accounts/resend-otp/', payload);
                    } catch (e) {
                        // ignore error, they can click resend manually
                    }
                    toast.info('حسابك مسجل ولكن لم يتم تفعيله بعد، تم إرسال كود جديد لهاتفك وسيتم توجيهك لإدخاله.', { autoClose: 6000 });
                    safeSessionStorage.setItem('pendingIdentifier', finalIdentifier);
                    navigate('/otp-verification', {
                        state: { identifier: finalIdentifier, fromCheckAccount: true }
                    });
                }
            } else {
                if (inputType === 'email') {
                    setValidationError(t('auth.no_account_email'));
                    triggerShake();
                } else {
                    toast.info(t('auth.new_account'));
                    navigate('/register', {
                        state: { phone: finalIdentifier }
                    });
                }
            }
        } catch (err) {
            const errorDetail = err.response?.data?.detail;
            setValidationError(errorDetail || t('errors.generic'));
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!password) {
            setIsEmptyError(true);
            triggerShake();
            return;
        }

        setLoading(true);
        let guestCart;
        try {
            guestCart = JSON.parse(localStorage.getItem('guestCart') || '[]');
        } catch {
            guestCart = [];
        }

        try {
            const res = await axios.post('/accounts/login/', {
                identifier,
                password,
                guest_cart_items: guestCart
            });

            if (res.data.needs_verification) {
                toast.info(t('auth.account_inactive', 'حسابك غير مفعل، سيتم إرسال كود تفعيل.'));
                safeSessionStorage.setItem('pendingIdentifier', res.data.phone);

                navigate('/otp-verification', {
                    state: {
                        identifier: res.data.phone,
                        email: res.data.email,
                        fromCheckAccount: true
                    }
                });
                return;
            }

            const { access, refresh, user_info } = res.data;

            safeSessionStorage.clearTempData();

            await login(user_info, access, refresh);
            toast.success(t('auth.welcome_back'));

            const returnUrl = safeSessionStorage.getItem('returnUrl');
            if (returnUrl) {
                safeSessionStorage.removeItem('returnUrl');
                navigate(returnUrl);
            } else {
                const destination = location.state?.from || '/';
                navigate(destination, { replace: true });
            }

        } catch (err) {
            console.error('Login error:', err);
            const errorData = err.response?.data;

            if (errorData?.code === 'account_suspended') {
                setValidationError(errorData?.detail);
            } else {
                setValidationError(errorData?.detail || t('auth.login_failed', 'فشل تسجيل الدخول'));
            }
            triggerShake();
        } finally {
            setLoading(false);
        }
    };

    const handleResetForm = useCallback(() => {
        setStep('check');
        setValidationError('');
        setIdentifier('');
        setPassword('');
        setIsEmptyError(false);
        safeSessionStorage.clearTempData();
    }, []);

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className={`w-full max-w-md bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-gray-100 transition-all ${shakeError ? 'animate-shake' : ''}`}>
                <div className="text-center mb-8">
                    <div className="bg-primary/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/10">
                        {step === 'check' ? (
                            <LogIn size={36} className="text-primary" />
                        ) : (
                            <Lock size={36} className="text-primary" />
                        )}
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-dark mb-2">
                        {step === 'check' ? t('auth.check_title') : t('auth.welcome_back')}
                    </h2>
                    <p className="text-gray-500 text-sm">
                        {step === 'check' ? t('auth.check_subtitle') : t('auth.enter_details')}
                    </p>
                </div>

                {step === 'check' ? (
                    <form onSubmit={handleCheckAccount} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">
                                {t('auth.identifier_label')}
                            </label>

                            <div className="relative flex items-center transition-all duration-300">
                                <div
                                    className={`transition-all duration-300 overflow-hidden ease-in-out ${inputType === 'phone' ? 'w-[85px] opacity-100 me-2' : 'w-0 opacity-0 me-0'}`}
                                    ref={dropdownRef}
                                >
                                    <button
                                        type="button"
                                        onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                                        className="w-full h-14 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-center gap-1 hover:bg-gray-100 transition-colors whitespace-nowrap"
                                    >
                                        <span className="text-xl">{currentCountry?.flag}</span>
                                        <span className="text-xs font-bold text-gray-600 dir-ltr">{countryCode}</span>
                                        <ChevronDown size={16} className="text-gray-400" />
                                    </button>

                                    {showCountryDropdown && (
                                        <div className="absolute top-full mt-2 w-48 bg-white border border-gray-100 rounded-2xl shadow-xl overflow-hidden py-1 z-50 animate-fade-in-up">
                                            {countries.map((c) => (
                                                <button
                                                    key={c.code}
                                                    type="button"
                                                    className={`flex items-center w-full px-4 py-3 text-sm text-gray-700 hover:bg-primary/5 hover:text-primary transition-colors gap-3 ${isRtl ? 'text-right' : 'text-left'}`}
                                                    onClick={() => {
                                                        setCountryCode(c.code);
                                                        setCurrentCountry(c);
                                                        setShowCountryDropdown(false);
                                                    }}
                                                >
                                                    <span className="text-lg">{c.flag}</span>
                                                    <span className="font-bold flex-grow">{c.name}</span>
                                                    <span className="text-xs text-muted dir-ltr">{c.code}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="relative flex-grow">
                                    <input
                                        type="text"
                                        className={`w-full h-14 px-5 bg-gray-50 border rounded-2xl outline-none transition-all duration-300 font-medium
                                            ${(isEmptyError || validationError)
                                                ? 'border-red-500 bg-red-50 text-red-900 placeholder:text-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                                                : 'border-gray-200 text-dark focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10 placeholder:text-gray-400'
                                            }
                                            ${inputType === 'email' ? (isRtl ? 'pl-12' : 'pr-12') : ''}
                                        `}
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                        disabled={loading}
                                        dir="auto"
                                        placeholder={isEmptyError ? t('auth.identifier_error_placeholder') : t('auth.check_placeholder', 'أدخل رقم هاتفك أو بريدك الإلكتروني')}
                                        autoFocus
                                        autoComplete="username"
                                    />

                                    {inputType === 'email' && (
                                        <div className={`absolute top-0 bottom-0 ${isRtl ? 'left-4' : 'right-4'} flex items-center text-primary pointer-events-none animate-fade-in`}>
                                            <Mail size={20} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {validationError && (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 text-sm font-bold animate-fade-in">
                                <AlertCircle size={18} className="flex-shrink-0" />
                                <span>{validationError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-3 border-white/30 border-t-white"></div>
                            ) : (
                                <>
                                    {t('auth.continue')}
                                    {isRtl ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
                                </>
                            )}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleLogin} className="space-y-6 animate-fade-in-up">
                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-2">
                                {t('auth.identifier_label')}
                            </label>
                            <div className="w-full h-14 bg-gray-50 border border-gray-200 text-gray-600 rounded-2xl px-5 flex justify-between items-center">
                                <span dir="ltr" className="font-medium">{identifier}</span>
                                <button
                                    type="button"
                                    onClick={handleResetForm}
                                    className="text-primary text-sm font-bold hover:bg-primary/10 px-3 py-1 rounded-lg transition-colors"
                                >
                                    {t('auth.change')}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-gray-700 block mb-2">
                                {t('auth.password_label')}
                            </label>
                            <div className="relative">
                                <input
                                    type="password"
                                    className={`w-full h-14 px-5 bg-gray-50 border rounded-2xl outline-none transition-all duration-300 font-medium
                                        ${isEmptyError
                                            ? 'border-red-500 bg-red-50 text-red-900 placeholder:text-red-500 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                                            : 'border-gray-200 text-dark focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10'
                                        }
                                    `}
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        if (isEmptyError) setIsEmptyError(false);
                                        if (validationError) setValidationError('');
                                    }}
                                    autoFocus
                                    placeholder={isEmptyError ? t('auth.password_required_error') : "••••••••"}
                                    autoComplete="current-password"
                                />
                                <div className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none`}>
                                    <Lock size={20} className={isEmptyError ? 'text-red-400' : ''} />
                                </div>
                            </div>

                            <div className="flex justify-end mt-2">
                                <Link
                                    to="/reset-password/request"
                                    state={{ phone: identifier, fromCheckAccount: true }}
                                    className="text-xs font-bold text-primary hover:text-primary-dark transition-colors"
                                >
                                    <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>
                                        {t('auth.forgot_password')}
                                    </span>
                                </Link>
                            </div>
                        </div>

                        {validationError && !isEmptyError && (
                            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 text-sm font-bold animate-fade-in">
                                <AlertCircle size={18} className="flex-shrink-0" />
                                <span>{validationError}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed"
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="animate-spin rounded-full h-6 w-6 border-3 border-white/30 border-t-white"></div>
                            ) : (
                                t('auth.login_btn')
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

export default CheckAccount;



