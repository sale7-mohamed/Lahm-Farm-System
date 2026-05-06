import React, { useState, useEffect } from 'react';
import axios from '../services/axiosConfig';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import useAuth from '../context/auth/useAuth';
import {
  ShieldCheck,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const safeSessionStorage = {
  getItem: (key) => {
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      sessionStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  },
  removeItem: (key) => {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

function OTPVerification() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const navigate = useNavigate();
  const location = useLocation();
  const { login: authLogin } = useAuth();

  const phoneIdentifier = location.state?.identifier;
  const [emailIdentifier, setEmailIdentifier] = useState(
    location.state?.email || ''
  );

  const [verifyMode, setVerifyMode] = useState(
    location.state?.fromProfile ? 'email' : 'phone'
  );

  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [error, setError] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (localStorage.getItem('access') && !location.state?.fromProfile) {
      navigate('/', { replace: true });
      return;
    }

    const hasPendingData = phoneIdentifier || location.state?.email;

    if (!hasPendingData) {
      safeSessionStorage.removeItem('otp_cooldown_end');
      safeSessionStorage.removeItem('temp_auth_data');
      navigate('/account/login-check', { replace: true });
    }
  }, [phoneIdentifier, location.state, navigate]);

  useEffect(() => {
    return () => {
      if (!phoneIdentifier && !location.state?.email) {
        safeSessionStorage.removeItem('pendingIdentifier');
      }
    };
  }, [phoneIdentifier, location.state?.email]);

  useEffect(() => {
    const pageTimeoutKey = 'otp_page_expiry';
    let sessionEnd = safeSessionStorage.getItem(pageTimeoutKey);

    if (!sessionEnd) {
      sessionEnd = Date.now() + 5 * 60 * 1000;
      safeSessionStorage.setItem(pageTimeoutKey, sessionEnd.toString());
    }

    const checkPageTimeout = setInterval(() => {
      const expiry = safeSessionStorage.getItem(pageTimeoutKey);
      if (expiry && Date.now() > parseInt(expiry, 10)) {
        clearInterval(checkPageTimeout);
        toast.error(t('session_expired', 'انتهت صلاحية الجلسة، يرجى المحاولة مرة أخرى.'), { autoClose: 4000 });

        safeSessionStorage.removeItem(pageTimeoutKey);
        safeSessionStorage.removeItem('pendingIdentifier');
        safeSessionStorage.removeItem('otp_cooldown_end');
        safeSessionStorage.removeItem('temp_auth_data');

        navigate('/account/login-check', { replace: true });
      }
    }, 1000);

    return () => clearInterval(checkPageTimeout);
  }, [navigate, t]);

  useEffect(() => {
    const calculateRemainingTime = () => {
      const endTime = safeSessionStorage.getItem('otp_cooldown_end');
      if (!endTime) return 0;

      const now = Date.now();
      const end = parseInt(endTime, 10);
      const diff = Math.ceil((end - now) / 1000);

      return diff > 0 ? diff : 0;
    };

    const startIfNeeded = () => {
      const remaining = calculateRemainingTime();
      if (!safeSessionStorage.getItem('otp_cooldown_end')) {
        startCooldown(60);
      } else {
        setResendCooldown(remaining);
      }
    };

    startIfNeeded();

    const timer = setInterval(() => {
      const left = calculateRemainingTime();
      setResendCooldown(left);

      if (left <= 0) {
        safeSessionStorage.removeItem('otp_cooldown_end');
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const startCooldown = (seconds) => {
    const endTime = Date.now() + seconds * 1000;
    safeSessionStorage.setItem('otp_cooldown_end', endTime.toString());
    setResendCooldown(seconds);
  };

  const triggerShake = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 400);
  };

  const performLogin = async (user_info, access, refresh, detailMsg) => {
    await authLogin(user_info, access, refresh);
    if (detailMsg) toast.success(detailMsg);

    safeSessionStorage.removeItem('pendingIdentifier');
    safeSessionStorage.removeItem('otp_cooldown_end');
    safeSessionStorage.removeItem('temp_auth_data');
    safeSessionStorage.removeItem('otp_page_expiry');

    const returnUrl = safeSessionStorage.getItem('returnUrl');
    if (returnUrl) {
      safeSessionStorage.removeItem('returnUrl');
      navigate(returnUrl, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');

    if (!otp || otp.trim().length !== 6) {
      setError(t('auth.otp_length_error'));
      triggerShake();
      return;
    }

    setLoading(true);

    const payload =
      verifyMode === 'phone'
        ? { phone: phoneIdentifier, code: otp }
        : { email: emailIdentifier, code: otp };

    try {
      const response = await axios.post('/accounts/verify-otp/', payload);
      const {
        access,
        refresh,
        user_info,
        email_verification_required,
        email,
        detail,
      } = response.data;

      if (email_verification_required) {
        toast.success(detail || t('auth.otp_email_sent'));

        if (access && refresh) {
          safeSessionStorage.setItem(
            'temp_auth_data',
            JSON.stringify({ access, refresh, user_info })
          );
        }

        setVerifyMode('email');
        setEmailIdentifier(email);
        setOtp('');

        safeSessionStorage.removeItem('otp_cooldown_end');
        startCooldown(60);
      } else {
        await performLogin(user_info, access, refresh, detail);
      }
    } catch (err) {
      const msg =
        err.response?.data?.detail || t('auth.otp_invalid');
      setError(msg);
      triggerShake();
      if (msg.includes("expired") || msg.includes("منتهي") || msg.includes("مستخدم")) {
        setOtp('');
        toast.error("الكود منتهي الصلاحية، يرجى الضغط على إرسال كود جديد.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    const storedData = safeSessionStorage.getItem('temp_auth_data');

    if (storedData) {
      const { user_info, access, refresh } = JSON.parse(storedData);
      performLogin(user_info, access, refresh, t('auth.welcome_back'));
    } else {
      safeSessionStorage.removeItem('pendingIdentifier');
      navigate('/account/login-check');
    }
  };

  const handleResendOTP = async () => {
    if (resendCooldown > 0 || resendLoading) return;

    setResendLoading(true);

    const payload =
      verifyMode === 'phone'
        ? { phone: phoneIdentifier }
        : { email: emailIdentifier };

    try {
      await axios.post('/accounts/resend-otp/', payload);
      toast.success(t('auth.code_resent'));
      startCooldown(60);
    } catch (err) {
      if (err.response?.status === 429) {
        toast.error(err.response?.data?.detail || t('errors.generic', 'يرجى الانتظار قليلاً قبل المحاولة مرة أخرى.'));
        if (err.response?.data?.wait_time) {
          startCooldown(err.response.data.wait_time);
        }
      } else {
        toast.error(err.response?.data?.detail || t('errors.generic'));
      }
    } finally {
      setResendLoading(false);
    }
  };

  const identifierDisplay =
    verifyMode === 'phone' ? phoneIdentifier : emailIdentifier;

  if (!identifierDisplay && !location.state?.fromProfile) return null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md bg-white p-6 md:p-10 rounded-[2rem] shadow-xl border border-gray-100 transition-all duration-300 ${
          shakeError ? 'animate-shake' : 'animate-fade-in-up'
        }`}
      >
        <div className="text-center mb-8">
          <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 shadow-sm border-4 border-white">
            <ShieldCheck size={40} />
          </div>

          <h2 className="text-2xl font-black text-dark mb-2">
            {verifyMode === 'phone'
              ? t('auth.otp_phone')
              : t('auth.otp_email')}
          </h2>

          <p className="text-muted text-sm px-4 leading-relaxed">
            {t('auth.otp_desc')}
          </p>

          <div className="mt-2 inline-block max-w-full bg-gray-50 px-4 py-2 rounded-xl border border-gray-100 font-bold text-dark dir-ltr font-mono text-lg break-all overflow-hidden text-ellipsis">
            {identifierDisplay}
          </div>
        </div>

        <form onSubmit={handleVerifyOTP} className="space-y-6" noValidate>
          <div className="space-y-2">
            <input
              type="text"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
              dir="ltr"
              autoFocus
              placeholder="------"
              value={otp}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setOtp(val);
                if (error) setError('');
              }}
              className={`w-full h-16 text-center text-3xl font-bold tracking-[0.5em] rounded-2xl border outline-none transition-all bg-gray-50 ${
                error
                  ? 'border-red-500 bg-red-50 text-red-900'
                  : 'border-gray-200 text-primary focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10'
              }`}
            />

            {error && (
              <div className="flex items-center justify-center gap-1 text-red-500 text-sm font-bold mt-2">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {t('auth.verify_btn')}
                {isRtl ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
              </>
            )}
          </button>

          {verifyMode === 'email' && !location.state?.fromProfile && (
            <button
              type="button"
              onClick={handleSkip}
              className="w-full bg-white border-2 border-gray-100 text-gray-500 py-3 rounded-2xl font-bold hover:bg-gray-50 hover:text-dark transition-all"
            >
              {t('auth.skip')}
            </button>
          )}

          <div className="text-center pt-2">
            <button
              type="button"
              onClick={handleResendOTP}
              disabled={resendLoading || resendCooldown > 0}
              className={`text-sm font-bold flex items-center justify-center gap-2 mx-auto ${
                resendCooldown > 0 || resendLoading
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-primary hover:text-primary-dark hover:underline'
              }`}
            >
              {resendLoading ? (
                <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent" />
              ) : (
                <RefreshCw size={14} />
              )}
              {resendCooldown > 0
                ? t('auth.resend_wait', { count: resendCooldown })
                : t('auth.resend')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default OTPVerification;



