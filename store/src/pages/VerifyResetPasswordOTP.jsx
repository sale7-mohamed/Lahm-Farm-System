import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import { ShieldCheck, RefreshCw, AlertCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

function VerifyResetPasswordOTP() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  const phone = location.state?.phone || localStorage.getItem('resetPasswordPhone');
  const fromCheckAccount = location.state?.fromCheckAccount;

  useEffect(() => {
    if (!phone) {
      navigate('/reset-password/request', { replace: true });
    }
  }, [phone, navigate]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!code || code.length !== 6) {
      setError(t('auth.otp_length_error', 'يجب إدخال 6 أرقام'));
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/accounts/reset-password/verify/', { phone, code });
      localStorage.setItem('resetPasswordToken', response.data.token);
      navigate('/reset-password/set', { state: { token: response.data.token }, replace: true });
    } catch (err) {
      const errData = err.response?.data;
      let msg = t('auth.otp_invalid', 'الكود غير صحيح أو منتهي الصلاحية');
      if (errData?.non_field_errors && Array.isArray(errData.non_field_errors)) {
          msg = errData.non_field_errors[0];
      } else if (errData?.detail) {
          msg = errData.detail;
      } else if (err.message) {
          msg = err.message;
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setError('');
    try {
      await axios.post('/accounts/reset-password/request/', { identifier: phone });
      toast.success(t('auth.code_resent', 'تم إعادة إرسال الكود بنجاح'));
      setResendCooldown(60);
    } catch (err) {
      if (err.response?.status === 429) {
        toast.error(err.response?.data?.detail || 'لقد تجاوزت الحد المسموح للإرسال. يرجى الانتظار بضع دقائق.');
        if (err.response?.data?.wait_time) {
          setResendCooldown(err.response.data.wait_time);
        }
      } else {
        toast.error('حدث خطأ ما. حاول مرة أخرى.');
      }
    } finally {
      setResendLoading(false);
    }
  };

  if (!phone) return null;

  return (
    <div className="min-h-[80vh] bg-secondary/20 flex items-center justify-center p-4 pb-20">
      <div className="bg-white w-full max-w-md rounded-[2rem] shadow-xl p-6 md:p-10 border border-gray-100 text-center animate-fade-in-up">

        <div className="bg-primary/10 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 text-primary border border-primary/20 shadow-sm">
            <ShieldCheck size={40} />
        </div>

        <h2 className="text-2xl md:text-3xl font-black text-dark mb-4">{t('auth.verify_btn', 'تأكيد الرمز')}</h2>

        {fromCheckAccount && (
            <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl text-xs md:text-sm mb-4 font-bold border border-blue-100 flex items-start gap-2 text-start">
               <span className="text-xl mt-0.5">💡</span>
               <span>{t('auth.account_exists_reset', 'لدينا حساب مسجل بهذا الرقم بالفعل، يرجى استعادة كلمة المرور لتسجيل الدخول بأمان.')}</span>
            </div>
        )}

        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            {t('auth.otp_sent_desc', 'لقد أرسلنا كوداً مكوناً من 6 أرقام إلى هاتفك')}<br/>
            <span className="font-bold text-dark text-lg mt-2 inline-block bg-gray-50 px-4 py-1 rounded-xl border border-gray-100 dir-ltr" dir="ltr">{phone}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className={`w-full h-16 text-center text-3xl font-bold tracking-[0.5em] rounded-2xl border-2 bg-gray-50 outline-none transition-all mb-4 dir-ltr ${error ? 'border-red-500 text-red-600 bg-red-50' : 'border-gray-200 focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10 text-primary'}`}
            value={code}
            onChange={(e) => {
                setCode(e.target.value.replace(/\D/g, ''));
                if(error) setError('');
            }}
            maxLength="6"
            required
            autoFocus
            placeholder="------"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
          />

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-red-500 text-sm font-bold mb-6 animate-fade-in">
                <AlertCircle size={16} />
                <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-primary hover:bg-primary-dark text-white h-14 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl active:scale-95 transition-all disabled:opacity-70 mb-6 flex items-center justify-center gap-3"
            disabled={loading || code.length !== 6}
          >
            {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                <>
                    {t('auth.verify_btn', 'تأكيد الرمز')}
                    {isRtl ? <ArrowLeft size={20}/> : <ArrowRight size={20}/>}
                </>
            )}
          </button>

          <button
            type="button"
            className={`text-sm font-bold flex items-center justify-center gap-2 mx-auto p-2 rounded-xl transition-all ${resendCooldown > 0 ? 'text-gray-400 cursor-not-allowed bg-gray-50' : 'text-primary hover:bg-primary/5'}`}
            onClick={handleResendCode}
            disabled={resendLoading || resendCooldown > 0}
          >
            {resendLoading ? <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div> : <RefreshCw size={16} className={resendCooldown > 0 ? 'opacity-50' : ''} />}
            {resendCooldown > 0 ? t('auth.resend_wait', { count: resendCooldown }) : t('auth.didnt_receive_code', 'لم يصلك الكود؟ أعد الإرسال')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default VerifyResetPasswordOTP;
