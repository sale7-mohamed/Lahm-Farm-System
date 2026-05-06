import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import { KeyRound, ArrowRight, ArrowLeft, Phone, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function RequestPasswordReset() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const location = useLocation();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (location.state?.phone) {
      const phoneValue = location.state.phone;
      const formattedPhone = location.state.fromCheckAccount ? phoneValue.replace('+20', '0') : phoneValue;
      setPhone(formattedPhone);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!phone) {
      setError(t('errors.required', 'يرجى إدخال رقم الهاتف'));
      return;
    }

    setLoading(true);
    try {
      let identifier = phone.replace(/\D/g, '');
      if (identifier.startsWith('0')) identifier = '+20' + identifier.substring(1);
      else if (!identifier.startsWith('20') && identifier.length === 10) identifier = '+20' + identifier;
      else if (!identifier.startsWith('+')) identifier = '+' + identifier;

      await axios.post('/accounts/reset-password/request/', { identifier });

      toast.success(t('auth.otp_sent', 'تم إرسال كود التحقق بنجاح'));
      localStorage.setItem('resetPasswordPhone', identifier);
      navigate('/reset-password/verify', { state: { phone: identifier } });

    } catch (err) {
      if (err.response?.status === 429) {
        setError(err.response?.data?.detail || t('auth.rate_limit_error', 'لقد تجاوزت الحد المسموح. يرجى الانتظار ثم المحاولة مجدداً.'));
      } else {
        const errorData = err.response?.data;
        setError(errorData?.identifier?.[0] || errorData?.detail || t('errors.generic'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] bg-secondary/20 flex items-center justify-center p-4 pb-20">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-xl p-6 md:p-10 border border-gray-100 animate-fade-in-up">

        <div className="text-center mb-8">
            <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/20 shadow-sm">
                <KeyRound size={36} className="text-primary" />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-dark">{t('auth.reset_password_title')}</h2>
            <p className="text-gray-500 text-sm mt-2 leading-relaxed px-2">
                {t('auth.reset_password_desc', 'أدخل رقم هاتفك المسجل لدينا وسنقوم بإرسال كود تحقق مكون من 6 أرقام لتتمكن من تعيين كلمة مرور جديدة.')}
            </p>
        </div>

        {error && (
            <div className="flex items-start gap-2 text-red-600 bg-red-50 p-3 rounded-2xl border border-red-100 text-sm font-bold mb-6 animate-fade-in">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
            </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 ms-1">{t('auth.phone')}</label>
                <div className="relative">
                    <input
                        type="tel"
                        className={`w-full h-14 pl-12 pr-4 rounded-2xl bg-gray-50 border focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold text-lg tracking-wider text-left dir-ltr ${error ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}
                        value={phone}
                        onChange={(e) => {
                            setPhone(e.target.value.replace(/[^\d+]/g, ''));
                            if(error) setError('');
                        }}
                        placeholder={t('auth.phone_placeholder', '01xxxxxxxxx')}
                        dir="ltr"
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary pointer-events-none">
                        <Phone size={20} />
                    </div>
                </div>
            </div>

            <button
                type="submit"
                className="w-full bg-primary hover:bg-primary-dark text-white h-14 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all disabled:opacity-70 flex items-center justify-center gap-3"
                disabled={loading}
            >
                {loading ? (
                    <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                    <>
                        {t('auth.send_code_btn', 'إرسال كود التحقق')}
                        {isRtl ? <ArrowLeft size={20}/> : <ArrowRight size={20}/>}
                    </>
                )}
            </button>

            <div className="text-center pt-4">
                <button
                    type="button"
                    onClick={() => navigate('/account/login-check')}
                    className="text-sm font-bold text-gray-500 hover:text-dark transition-colors flex items-center justify-center gap-1.5 mx-auto p-2"
                >
                    {isRtl ? <ArrowRight size={16}/> : <ArrowLeft size={16}/>} {t('auth.back_to_login', 'العودة لتسجيل الدخول')}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}

export default RequestPasswordReset;
