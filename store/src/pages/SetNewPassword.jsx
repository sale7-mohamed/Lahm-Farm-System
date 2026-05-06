import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import useAuth from '../context/auth/useAuth';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function SetNewPassword() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [newPassword, setNewPassword] = useState('');
  const[confirmPassword, setConfirmPassword] = useState('');
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState('');
  const [shakeError, setShakeError] = useState(false);

  const [passwordStrength, setPasswordStrength] = useState({ text: '', color: 'text-gray-300', width: '0%', bg: 'bg-gray-200' });

  const location = useLocation();
  const navigate = useNavigate();
  const { login: authLogin } = useAuth();

  const token = location.state?.token || localStorage.getItem('resetPasswordToken');

  useEffect(() => {
    if (!token) {
      toast.error(t('errors.session_expired', 'انتهت صلاحية الجلسة، يرجى المحاولة مجدداً'));
      navigate('/reset-password/request', { replace: true });
    }
  }, [token, navigate, t]);

  //      (    )
  const evaluatePasswordStrength = (password) => {
    if (!password) {
        setPasswordStrength({ text: '', color: 'text-gray-300', width: '0%', bg: 'bg-gray-200' });
        return;
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) || /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    switch (score) {
        case 1: setPasswordStrength({ text: t('auth.weak', 'ضعيفة'), color: 'text-red-500', width: '25%', bg: 'bg-red-500' }); break;
        case 2: setPasswordStrength({ text: t('auth.medium', 'متوسطة'), color: 'text-yellow-500', width: '50%', bg: 'bg-yellow-500' }); break;
        case 3: setPasswordStrength({ text: t('auth.good', 'جيدة'), color: 'text-blue-500', width: '75%', bg: 'bg-blue-500' }); break;
        case 4: setPasswordStrength({ text: t('auth.strong', 'قوية'), color: 'text-green-500', width: '100%', bg: 'bg-green-500' }); break;
        default: setPasswordStrength({ text: t('auth.weak', 'ضعيفة جداً'), color: 'text-red-500', width: '10%', bg: 'bg-red-500' });
    }
  };

  const handlePasswordChange = (e) => {
      const val = e.target.value;
      setNewPassword(val);
      if(error) setError('');
      evaluatePasswordStrength(val);
  };

  const triggerShake = () => {
      setShakeError(true);
      setTimeout(() => setShakeError(false), 400);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newPassword || newPassword.length < 8) {
      setError(t('auth.password_weak', 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'));
      triggerShake();
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('auth.passwords_mismatch', 'كلمتا المرور غير متطابقتين'));
      triggerShake();
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/accounts/reset-password/set/', { token, new_password: newPassword });
      const { access, refresh, user_info } = response.data;

      toast.success(t('auth.password_changed_success', 'تم تعيين كلمة المرور بنجاح وتسجيل الدخول'));
      if (access && user_info) {
        await authLogin(user_info, access, refresh);
        localStorage.removeItem('resetPasswordToken');
        localStorage.removeItem('resetPasswordPhone');
        navigate('/', { replace: true });
      } else {
        navigate('/account/login-check', { replace: true });
      }
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData?.new_password && Array.isArray(errorData.new_password)) {
          setError(errorData.new_password[0]);
      } else if (typeof errorData?.new_password === 'string') {
          setError(errorData.new_password);
      } else if (errorData?.non_field_errors && Array.isArray(errorData.non_field_errors)) {
          setError(errorData.non_field_errors[0]);
      } else {
          setError(errorData?.detail || t('errors.generic'));
      }
      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null;

  return (
    <div className="min-h-[80vh] bg-secondary/20 flex items-center justify-center p-4 pb-20">
      <div className={`bg-white w-full max-w-md rounded-[2rem] shadow-xl p-6 md:p-10 border border-gray-100 animate-fade-in-up transition-all duration-300 ${shakeError ? 'animate-shake' : ''}`}>

        <div className="text-center mb-8">
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-sm text-primary">
                <Lock size={40} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-dark mb-2">{t('auth.new_password_title', 'كلمة مرور جديدة')}</h2>
            <p className="text-gray-500 text-sm mt-1 px-4 leading-relaxed">
                {t('auth.new_password_desc', 'أدخل كلمة مرور قوية يسهل عليك تذكرها لتأمين حسابك.')}
            </p>
        </div>

        {}
        {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-2xl border border-red-100 text-sm font-bold mb-6 animate-fade-in">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
            </div>
        )}

        {/*   noValidate     */}
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ms-1">{t('auth.new_password_label', 'كلمة المرور الجديدة')}</label>
                <div className="relative group">
                    <input
                        type={showPassword1 ? "text" : "password"}
                        className={`w-full h-14 ${isRtl ? 'pr-12 pl-12' : 'pl-12 pr-12'} rounded-2xl bg-gray-50 border focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium dir-ltr ${error && (!newPassword || newPassword.length < 8) ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-200'}`}
                        value={newPassword}
                        onChange={handlePasswordChange}
                        placeholder={t('auth.password_placeholder', '••••••••')}
                        dir="ltr"
                    />
                    <Lock className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 ${error && (!newPassword || newPassword.length < 8) ? 'text-red-400' : 'text-gray-400 group-focus-within:text-primary'} transition-colors pointer-events-none`} size={20} />

                    <button
                        type="button"
                        onClick={() => setShowPassword1(!showPassword1)}
                        className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark transition-colors`}
                        tabIndex={-1}
                    >
                        {showPassword1 ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>

                {}
                {newPassword && (
                    <div className="mt-3 px-1 animate-fade-in">
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ease-out ${passwordStrength.bg}`}
                                style={{ width: passwordStrength.width }}
                            ></div>
                        </div>
                        <div className={`text-xs mt-1.5 font-bold text-end ${passwordStrength.color}`}>
                            {passwordStrength.text}
                        </div>
                    </div>
                )}
            </div>

            {}
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ms-1">{t('auth.confirm_password', 'تأكيد كلمة المرور')}</label>
                <div className="relative group">
                    <input
                        type={showPassword2 ? "text" : "password"}
                        className={`w-full h-14 ${isRtl ? 'pr-12 pl-12' : 'pl-12 pr-12'} rounded-2xl bg-gray-50 border focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium dir-ltr ${error && newPassword !== confirmPassword ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-200'}`}
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); if(error) setError(''); }}
                        placeholder={t('auth.password_placeholder', '••••••••')}
                        dir="ltr"
                    />
                    <CheckCircle className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 ${error && newPassword !== confirmPassword ? 'text-red-400' : 'text-gray-400 group-focus-within:text-primary'} transition-colors pointer-events-none`} size={20} />

                    <button
                        type="button"
                        onClick={() => setShowPassword2(!showPassword2)}
                        className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-1/2 -translate-y-1/2 text-gray-400 hover:text-dark transition-colors`}
                        tabIndex={-1}
                    >
                        {showPassword2 ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>
            </div>

            {}
            <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-dark text-white h-14 rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-2 mt-6"
                disabled={loading}
            >
                {loading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <>
                        <CheckCircle size={20} />
                        {t('auth.save_login_btn', 'حفظ وتسجيل الدخول')}
                    </>
                )}
            </button>
        </form>
      </div>
    </div>
  );
}

export default SetNewPassword;
