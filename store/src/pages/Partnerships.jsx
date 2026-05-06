
import React, { useState } from 'react';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import { Truck, Utensils, CheckCircle, Building2, Send, Phone, Mail, MapPin, FileText, AlertCircle, Briefcase } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams, Link } from 'react-router-dom';

const Partnerships = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const [searchParams] = useSearchParams();

    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const [errors, setErrors] = useState({});
    const[shakeError, setShakeError] = useState(false);
    const [generalError, setGeneralError] = useState('');

    const [activeTab, setActiveTab] = useState(() => {
        const tabParam = searchParams.get('tab');
        return tabParam === 'business' ? 'business' : 'farm';
    });

    const [formData, setFormData] = useState({
        name: '',
        phone: '',
        email: '',
        address: '',
        details: ''
    });

    const handleTabSelect = (tab) => {
        setActiveTab(tab);
        setFormData({ name: '', phone: '', email: '', address: '', details: '' });
        setErrors({});
        setGeneralError('');
        setSubmitted(false);
        const newUrl = new URL(window.location);
        newUrl.searchParams.set('tab', tab);
        window.history.pushState({}, '', newUrl);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        let finalValue = value;

        if (name === 'phone') {
            finalValue = value.replace(/[^\d+]/g, '');
        }

        setFormData({ ...formData, [name]: finalValue });

        if (errors[name]) {
            setErrors(prev => {
                const newErrs = { ...prev };
                delete newErrs[name];
                return newErrs;
            });
        }
        if (generalError) setGeneralError('');
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) newErrors.name = t('errors.required', 'هذا الحقل مطلوب');
        if (!formData.phone.trim()) {
            newErrors.phone = t('errors.required', 'هذا الحقل مطلوب');
        } else if (formData.phone.length < 10) {
            newErrors.phone = t('errors.invalid_phone_format', 'رقم الهاتف قصير جداً');
        }
        if (!formData.address.trim()) newErrors.address = t('errors.required', 'هذا الحقل مطلوب');
        if (!formData.details.trim()) newErrors.details = t('errors.required', 'هذا الحقل مطلوب');

        setErrors(newErrors);

        if (Object.keys(newErrors).length > 0) {
            setGeneralError(t('errors.complete_required_fields', 'يرجى إكمال جميع الحقول الإجبارية بشكل صحيح.'));
            setShakeError(true);
            setTimeout(() => setShakeError(false), 400);
            window.scrollTo({ top: 100, behavior: 'smooth' });
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        try {
            await axios.post('/partnerships/apply/', {
                ...formData,
                application_type: activeTab
            });
            setSubmitted(true);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            toast.error(error.response?.data?.detail || t('errors.generic'));
        } finally {
            setLoading(false);
        }
    };

    //    (Input)
    const InputWrapper = ({ label, name, icon: Icon, type = "text", placeholder, required = true, isTextArea = false }) => {
        const hasError = !!errors[name];

        return (
            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2 ms-1">
                    {label} {required && <span className="text-red-500">*</span>}
                    {!required && <span className="text-gray-400 font-normal text-xs ms-1">({t('auth.optional', 'اختياري')})</span>}
                </label>
                <div className="relative group">
                    {isTextArea ? (
                        <textarea
                            name={name}
                            value={formData[name]}
                            onChange={handleChange}
                            placeholder={placeholder}
                            rows="4"
                            className={`w-full p-4 rounded-2xl bg-gray-50 border focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium resize-none text-sm md:text-base ${
                                hasError ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-200'
                            }`}
                        />
                    ) : (
                        <input
                            type={type}
                            name={name}
                            value={formData[name]}
                            onChange={handleChange}
                            placeholder={placeholder}
                            dir={type === 'tel' || type === 'email' ? 'ltr' : 'auto'}
                            className={`w-full h-12 md:h-14 rounded-2xl bg-gray-50 border focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium text-sm md:text-base ${
                                isRtl && type !== 'tel' && type !== 'email' ? 'pr-12 pl-4' : 'pl-12 pr-4'
                            } ${
                                hasError ? 'border-red-500 bg-red-50 text-red-900' : 'border-gray-200'
                            } ${
                                (type === 'tel' || type === 'email') && isRtl ? 'text-end' : ''
                            }`}
                        />
                    )}

                    {!isTextArea && Icon && (
                        <div className={`absolute top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors pointer-events-none ${
                            isRtl && type !== 'tel' && type !== 'email' ? 'right-4' : 'left-4'
                        } ${hasError ? 'text-red-400' : ''}`}>
                            <Icon size={20} />
                        </div>
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
            <div className="min-h-[80vh] flex items-center justify-center bg-secondary/20 p-4 pb-20">
                <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 p-8 md:p-12 max-w-md w-full text-center animate-fade-in-up">
                    <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-100 shadow-sm">
                        <CheckCircle size={48} className="text-green-500" />
                    </div>
                    <h2 className="text-2xl md:text-3xl font-black text-dark mb-3">{t('partnerships_page.success_title')}</h2>
                    <p className="text-gray-500 leading-relaxed mb-8 text-sm md:text-base">
                        {t('partnerships_page.success_desc')}
                        <br/>
                        {t('partnerships_page.contact_within_24').split('وسيتم')[1] ? `وسيتم ${t('partnerships_page.contact_within_24').split('وسيتم')[1]}` : 'سنقوم بمراجعة طلبك والتواصل معك قريباً جداً.'}
                    </p>
                    <div className="d-flex flex-col gap-3">
                        <Link to="/" className="btn btn-primary w-full h-14 rounded-2xl text-lg font-bold flex justify-center items-center">
                            {t('not_found.back_home', 'العودة للرئيسية')}
                        </Link>
                        <button
                            onClick={() => setSubmitted(false)}
                            className="text-sm font-bold text-gray-500 hover:text-dark transition-colors py-2"
                        >
                            {t('common.submit_another')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-secondary/20 min-h-screen pb-20">
            {/* Header Section */}
            <div className="bg-dark text-white pt-12 pb-20 relative overflow-hidden">
                <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} w-full h-full bg-gradient-to-b from-primary/20 to-transparent`}></div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-md border border-white/20 shadow-lg transform rotate-3">
                        <Briefcase size={32} className="text-white" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black mb-3">{t('partnerships_page.title')}</h1>
                    <p className="text-gray-300 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed">
                        {t('partnerships_page.desc')}
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-12 relative z-20">
                <div className={`bg-white rounded-[2rem] shadow-xl border border-gray-100 max-w-3xl mx-auto overflow-hidden transition-all duration-300 p-4 md:p-8 ${shakeError ? 'animate-shake' : 'animate-fade-in-up'}`}>

                    {/* Custom Tab Switcher (Modern Pill Style) */}
                    <div className="flex bg-gray-50 p-1.5 rounded-2xl mb-8 border border-gray-100 shadow-inner">
                        <button
                            onClick={() => handleTabSelect('farm')}
                            className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 transition-all duration-300 rounded-xl font-bold text-sm md:text-base ${
                                activeTab === 'farm'
                                ? 'bg-white text-primary shadow-sm border border-gray-200'
                                : 'text-gray-500 hover:text-dark'
                            }`}
                        >
                            <Truck size={18} />
                            <span>{t('partnerships_page.farms')}</span>
                        </button>

                        <button
                            onClick={() => handleTabSelect('business')}
                            className={`flex-1 py-3 px-2 flex items-center justify-center gap-2 transition-all duration-300 rounded-xl font-bold text-sm md:text-base ${
                                activeTab === 'business'
                                ? 'bg-white text-primary shadow-sm border border-gray-200'
                                : 'text-gray-500 hover:text-dark'
                            }`}
                        >
                            <Utensils size={18} />
                            <span>{t('partnerships_page.business')}</span>
                        </button>
                    </div>

                    <div className="mb-6 text-center px-2">
                        <h3 className="text-xl md:text-2xl font-black text-dark mb-2">
                            {activeTab === 'farm' ? t('partnerships_page.farm_header') : t('partnerships_page.business_header')}
                        </h3>
                        <p className="text-muted text-xs md:text-sm">{t('partnerships_page.contact_within_24')}</p>
                    </div>

                    {generalError && (
                        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-6 flex items-start gap-3 animate-fade-in">
                            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                            <p className="text-red-800 text-sm font-bold m-0">{generalError}</p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} noValidate>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <InputWrapper
                                label={activeTab === 'farm' ? t('partnerships_page.farm_name') : t('partnerships_page.business_name')}
                                name="name"
                                icon={Building2}
                                placeholder={activeTab === 'farm' ? t('partnerships_page.farm_name_placeholder') : t('partnerships_page.business_name_placeholder')}
                            />

                            <InputWrapper
                                label={t('auth.phone')}
                                name="phone"
                                type="tel"
                                icon={Phone}
                                placeholder={t('auth.phone_placeholder', '01xxxxxxxxx')}
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                            <InputWrapper
                                label={t('auth.email')}
                                name="email"
                                type="email"
                                icon={Mail}
                                required={false}
                                placeholder={t('auth.email_placeholder', 'example@domain.com')}
                            />

                            <InputWrapper
                                label={t('auth.street', 'الشارع')}
                                name="address"
                                icon={MapPin}
                                placeholder={t('partnerships_page.address_placeholder')}
                            />
                        </div>

                        <InputWrapper
                            label={activeTab === 'farm' ? t('partnerships_page.farm_details') : t('partnerships_page.business_details')}
                            name="details"
                            isTextArea={true}
                            placeholder={activeTab === 'farm' ? t('partnerships_page.farm_details_placeholder') : t('partnerships_page.business_details_placeholder')}
                        />

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-4 h-14 rounded-2xl font-bold text-lg text-white shadow-lg hover:shadow-xl active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 bg-primary hover:bg-primary-dark disabled:opacity-70"
                        >
                            {loading ? (
                                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    {activeTab === 'farm' ? t('partnerships_page.send_partnership_request') : t('partnerships_page.send_contract_request')}
                                    {}
                                    <Send size={20} className={isRtl ? '-scale-x-100' : ''} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Partnerships;