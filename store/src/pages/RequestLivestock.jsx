import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import { ClipboardList, Send, AlertCircle, CheckCircle, Lock, Tag, Scale, DollarSign } from 'lucide-react';
import useAuth from '../context/auth/useAuth';
import { useTranslation } from 'react-i18next';

//      sessionStorage
const safeSessionStorage = {
    getItem: (key) => { try { return sessionStorage.getItem(key); } catch { return null; } },
    setItem: (key, value) => { try { sessionStorage.setItem(key, value); } catch { /* ignore */ } },
    removeItem: (key) => { try { sessionStorage.removeItem(key); } catch { /* ignore */ } }
};

const RequestLivestock = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const { user } = useAuth();
    const navigate = useNavigate();

    const[formData, setFormData] = useState(() => {
        const saved = safeSessionStorage.getItem('temp_special_request_form');
        return saved ? JSON.parse(saved) : { category: '', weight: '', price: '', notes: '' };
    });

    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [errors, setErrors] = useState({});
    const [shakeError, setShakeError] = useState(false);

    const submittedRef = useRef(false);

    const submitPayload = useCallback(async (dataToSubmit) => {
        if (loading || submittedRef.current) return;

        submittedRef.current = true;
        setLoading(true);

        try {
            const payload = {
                requested_specs: {
                    "الفئة": dataToSubmit.category,
                    "الوزن التقريبي": dataToSubmit.weight ? `${dataToSubmit.weight} ${t('common.kg')}` : "",
                    "الميزانية": dataToSubmit.price ? `${dataToSubmit.price} ${t('common.currency')}` : ""
                },
                notes: dataToSubmit.notes
            };

            await axios.post('/orders/special-requests/', payload);
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });

            safeSessionStorage.removeItem('temp_special_request_form');
            safeSessionStorage.removeItem('pendingRequestData');
            safeSessionStorage.removeItem('returnUrl');
        } catch {
            toast.error(t('errors.generic'));
            submittedRef.current = false;
        } finally {
            setLoading(false);
        }
    },[t, loading]);

    useEffect(() => {
        const pendingData = safeSessionStorage.getItem('pendingRequestData');
        if (user && pendingData && !submittedRef.current) {
            try {
                const parsedData = JSON.parse(pendingData);
                setFormData(parsedData);
                submitPayload(parsedData);
            } catch { /* ignore */ }
        }
    }, [user, submitPayload]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        const updatedData = { ...formData, [name]: value };
        setFormData(updatedData);
        safeSessionStorage.setItem('temp_special_request_form', JSON.stringify(updatedData));

        if (errors[name]) {
            setErrors(prev => {
                const newErrs = { ...prev };
                delete newErrs[name];
                return newErrs;
            });
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.category.trim()) newErrors.category = t('errors.required', 'يرجى تحديد الفئة المطلوبة');
        if (!formData.weight) newErrors.weight = t('errors.required', 'يرجى إدخال الوزن التقريبي');
        if (!formData.price) newErrors.price = t('errors.required', 'يرجى إدخال الميزانية المقترحة');

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            setShakeError(true);
            setTimeout(() => setShakeError(false), 400);
            window.scrollTo({ top: 150, behavior: 'smooth' });
            return false;
        }
        return true;
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        if (!user) {
            safeSessionStorage.setItem('pendingRequestData', JSON.stringify(formData));
            safeSessionStorage.setItem('temp_special_request_form', JSON.stringify(formData));
            safeSessionStorage.setItem('returnUrl', '/request-livestock');
            toast.info(t('auth.login_required_desc', "يرجى تسجيل الدخول لإتمام طلبك"));
            navigate('/account/login-check');
            return;
        }

        submitPayload(formData);
    };

    const InputField = ({ label, name, type = "text", icon: Icon, placeholder, isTextArea = false }) => {
        const hasError = !!errors[name];
        return (
            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2 ms-1">
                    {label} <span className="text-red-500">*</span>
                </label>
                <div className="relative group">
                    {isTextArea ? (
                        <textarea
                            name={name}
                            value={formData[name]}
                            onChange={handleChange}
                            placeholder={placeholder}
                            rows="4"
                            className={`w-full p-4 rounded-2xl bg-gray-50 border focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none text-sm md:text-base ${
                                hasError ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-200'
                            }`}
                        />
                    ) : (
                        <>
                            <input
                                type={type}
                                name={name}
                                value={formData[name]}
                                onChange={handleChange}
                                placeholder={placeholder}
                                dir={type === 'number' ? 'ltr' : 'auto'}
                                className={`w-full h-12 md:h-14 rounded-2xl bg-gray-50 border focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-bold text-sm md:text-base ${
                                    isRtl ? 'pr-12 pl-4' : 'pl-12 pr-4'
                                } ${hasError ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-200'} ${type === 'number' && isRtl ? 'text-end' : ''}`}
                            />
                            <div className={`absolute top-1/2 -translate-y-1/2 transition-colors pointer-events-none ${
                                isRtl ? 'right-4' : 'left-4'
                            } ${hasError ? 'text-red-400' : 'text-gray-400 group-focus-within:text-primary'}`}>
                                {Icon && <Icon size={20} />}
                            </div>
                        </>
                    )}
                </div>
                {hasError && (
                    <div className="flex items-center gap-1.5 text-red-500 text-xs font-bold mt-2 animate-fade-in">
                        <AlertCircle size={14} />
                        <span>{errors[name]}</span>
                    </div>
                )}
            </div>
        );
    };

    if (submitted) {
        return (
            <div className="min-h-[70vh] flex items-center justify-center bg-secondary/30 px-4">
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 text-center max-w-md w-full animate-fade-in-up">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 text-green-600 border border-green-100 shadow-sm">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-2xl font-black text-dark mb-2">{t('partnerships_page.success_title')}</h2>
                    <p className="text-gray-500 mb-8 leading-relaxed text-sm md:text-base">
                        {t('request_livestock.success_msg', 'تم استلام طلبك بنجاح! سنقوم بالبحث وإبلاغك فور التوفر.')}
                    </p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => navigate('/account-dashboard')}
                            className="btn btn-primary w-full h-12 rounded-2xl justify-center font-bold"
                        >
                            {t('profile.my_orders', 'طلباتي')}
                        </button>
                        <button
                            onClick={() => {
                                setSubmitted(false);
                                submittedRef.current = false;
                                setFormData({ category: '', weight: '', price: '', notes: '' });
                                safeSessionStorage.removeItem('temp_special_request_form');
                            }}
                            className="text-gray-500 hover:text-dark font-bold text-sm transition-colors py-2"
                        >
                            {t('common.submit_another', 'إرسال طلب آخر')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-secondary/20 min-h-screen pb-20">
            <div className="bg-dark text-white py-12 md:py-16 relative overflow-hidden">
                <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} w-full h-full bg-gradient-to-b from-primary/20 to-transparent`}></div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <div className="bg-white/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/20 shadow-lg transform rotate-3">
                        <ClipboardList size={32} className="text-primary" />
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black mb-2">{t('request_livestock.title', 'طلب مواصفات خاصة')}</h1>
                    <p className="text-primary font-bold mb-3">{t('request_livestock.subtitle', 'لم تجد ما تبحث عنه؟')}</p>
                    <p className="text-gray-300 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed px-2">
                        {t('request_livestock.desc', 'سجل مواصفات الماشية التي ترغب بها، وسيقوم فريقنا بالبحث عنها وتوفيرها لك بأفضل سعر وجودة.')}
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-8 relative z-20">
                <div className={`bg-white rounded-3xl shadow-xl border border-gray-100 max-w-3xl mx-auto p-5 md:p-10 transition-all duration-300 ${shakeError ? 'animate-shake' : 'animate-fade-in-up'}`}>

                    {Object.keys(errors).length > 0 && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 flex items-start gap-3">
                            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                            <p className="text-red-800 text-sm font-bold m-0">{t('errors.complete_required_fields', 'يرجى إكمال جميع الحقول الإجبارية المحددة باللون الأحمر.')}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate>
                        <InputField
                            label={t('request_livestock.category_label', 'نوع الماشية')}
                            name="category"
                            icon={Tag}
                            placeholder={t('request_livestock.category_placeholder', 'مثال: عجل بقري، خروف برقي...')}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <InputField
                                label={t('request_livestock.weight_label', 'الوزن التقريبي (كجم)')}
                                name="weight"
                                type="number"
                                icon={Scale}
                                placeholder="0"
                            />
                            <InputField
                                label={t('request_livestock.price_label', 'ميزانيتك التقريبية (جنيه)')}
                                name="price"
                                type="number"
                                icon={DollarSign}
                                placeholder="0"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-bold text-gray-700 mb-2 ms-1">
                                {t('request_livestock.notes_label', 'ملاحظات إضافية')} <span className="text-gray-400 font-normal text-xs">({t('auth.optional', 'اختياري')})</span>
                            </label>
                            <textarea
                                rows="4"
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                className="w-full p-4 rounded-2xl bg-gray-50 border border-gray-200 focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all resize-none text-sm md:text-base"
                                placeholder={t('request_livestock.notes_placeholder', 'أي تفاصيل أخرى تهمك (السن، اللون، العلف...)')}
                            ></textarea>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-primary-dark text-white h-14 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-70 mt-6"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    {user ? t('request_livestock.submit_btn', 'إرسال الطلب') : t('auth.login_btn', 'تسجيل الدخول')}
                                    {user ? (
                                        <Send size={20} className={isRtl ? 'transform -scale-x-100' : ''} />
                                    ) : (
                                        <Lock size={18} />
                                    )}
                                </>
                            )}
                        </button>

                        {!user && (
                            <p className="text-center text-xs font-bold text-gray-400 mt-3">
                                {t('request_livestock.login_required_note', 'سيطلب منك تسجيل الدخول لإتمام إرسال الطلب')}
                            </p>
                        )}
                    </form>
                </div>
            </div>
        </div>
    );
};

export default RequestLivestock;
