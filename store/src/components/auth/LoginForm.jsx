import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../../services/axiosConfig';
import useAuth from '../../context/auth/useAuth';
import { toast } from 'react-toastify';
import { useApp } from '../../context/app/useApp';
import { Eye, EyeOff, AlertCircle, ArrowRight, ArrowLeft, Lock, Phone } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function LoginForm({ preFilledIdentifier = '' }) {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const[identifier, setIdentifier] = useState(preFilledIdentifier);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [shakeError, setShakeError] = useState(false);
    const [loading, setLoading] = useState(false);

    const location = useLocation();
    const navigate = useNavigate();
    const { login: authLogin } = useAuth();
    const { triggerRefetch } = useApp();

    useEffect(() => {
        if (preFilledIdentifier) {
            setIdentifier(preFilledIdentifier);
        }
    }, [preFilledIdentifier]);

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!identifier.trim() || !password) {
            setError(t('errors.complete_required_fields'));
            setShakeError(true);
            setTimeout(() => setShakeError(false), 400);
            return;
        }

        setError('');
        setLoading(true);

        try {
            const response = await axiosInstance.post('/accounts/login/', {
                identifier: identifier.trim(),
                password,
            });

            if (response.data.needs_verification) {
                const phone = response.data.phone;
                sessionStorage.setItem('pendingIdentifier', phone);
                toast.info(t('auth.account_inactive'));
                navigate('/otp-verification', {
                    state: { identifier: phone }
                });
                return;
            }

            const { access, refresh, user_info } = response.data;
            await authLogin(user_info, access, refresh);
            triggerRefetch();

            toast.success(t('auth.welcome_back'));

            const destination = location.state?.from || '/';
            navigate(destination, { replace: true });

        } catch (err) {
            const errorData = err.response?.data;
            let errorMessage = t('auth.login_failed');

            if (errorData?.detail) {
                errorMessage = errorData.detail;
            } else if (errorData?.code === 'account_suspended') {
                errorMessage = t('errors.account_suspended');
            } else if (errorData?.identifier) {
                errorMessage = errorData.identifier[0];
            } else if (errorData?.password) {
                errorMessage = errorData.password[0];
            }

            setError(errorMessage);
            setShakeError(true);
            setTimeout(() => setShakeError(false), 400);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (setter) => (e) => {
        setter(e.target.value);
        if (error) setError('');
    };

    return (
        <div className={`w-full transition-all duration-300 ${shakeError ? 'animate-shake' : 'animate-fade-in-up'}`}>
            <form onSubmit={handleLogin} className="space-y-6" noValidate>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Phone size={16} className="text-primary" />
                        {t('auth.identifier_label')}
                    </label>

                    <input
                        type="text"
                        className={`w-full h-14 px-5 bg-gray-50 border rounded-2xl outline-none transition-all font-medium dir-ltr
                            ${error
                                ? 'border-red-500 bg-red-50'
                                : 'border-gray-200 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10'
                            }
                        `}
                        value={identifier}
                        onChange={handleInputChange(setIdentifier)}
                        placeholder={t('auth.identifier_placeholder')}
                        disabled={loading}
                        dir="ltr"
                        autoComplete="username"
                        maxLength="50"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <Lock size={16} className="text-primary" />
                        {t('auth.password_label')}
                    </label>

                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className={`w-full h-14 bg-gray-50 border rounded-2xl outline-none transition-all font-medium
                                ${isRtl ? 'pl-14 pr-5' : 'pr-14 pl-5'}
                                ${error
                                    ? 'border-red-500 bg-red-50'
                                    : 'border-gray-200 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10'
                                }
                            `}
                            value={password}
                            onChange={handleInputChange(setPassword)}
                            placeholder="••••••••"
                            disabled={loading}
                            dir={isRtl ? 'rtl' : 'ltr'}
                            autoComplete="current-password"
                            minLength="8"
                            maxLength="128"
                        />

                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className={`absolute top-1/2 -translate-y-1/2 ${
                                isRtl ? 'left-4' : 'right-4'
                            } text-gray-400 hover:text-dark`}
                            style={{ direction: 'ltr' }}
                            tabIndex={-1}
                            aria-label={showPassword ? t('auth.hide_password') : t('auth.show_password')}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    <div className="flex justify-end">
                        <Link
                            to="/reset-password/request"
                            state={{ phone: identifier }}
                            className="text-xs font-bold text-primary hover:text-primary-dark transition-colors duration-200"
                        >
                            <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>
                                {t('auth.forgot_password')}
                            </span>
                        </Link>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-bold border border-red-100 flex items-center gap-3 animate-fade-in">
                        <AlertCircle size={20} />
                        <span>{error}</span>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed focus:outline-none focus:ring-4 focus:ring-primary/30"
                >
                    {loading ? (
                        <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            {t('auth.login_btn')}
                            {isRtl ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}

export default LoginForm;
