// src/pages/ContactUs.jsx
import React, { useState, useEffect } from 'react';
import { Mail, Phone, Send, MessageSquare, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import axios from '../services/axiosConfig';
import useAuth from '../context/auth/useAuth';

const ContactCard = ({ icon: Icon, title, value, href, colorClass, delay }) => (
  <div
    className={`bg-white p-4 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-gray-100 flex flex-col items-center text-center hover:shadow-xl transition-all duration-500 hover:-translate-y-2 group animate-fade-in-up`}
    style={{ animationDelay: delay }}
  >
    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3 ${colorClass}`}>
      {Icon && <Icon size={24} className="md:w-7 md:h-7" />}
    </div>
    <h3 className="font-bold text-gray-500 text-xs md:text-sm mb-1 md:mb-2">{title}</h3>
    {href ? (
      <a href={href} className="text-sm md:text-lg font-black text-dark hover:text-primary transition-colors block dir-ltr">
        {value}
      </a>
    ) : (
      <p className="text-sm md:text-base font-bold text-dark">{value}</p>
    )}
  </div>
);

const ContactUs = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const[isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  },[]);

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.full_name || '',
        phone: user.phone || '',
        email: user.email || ''
      }));
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'phone') {
      const formatted = value.replace(/[^\d+]/g, '');
      setFormData({ ...formData, [name]: formatted });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone || !formData.message) {
      toast.warn(t('contact_page.form.required_fields', 'يرجى إكمال الحقول الأساسية (الاسم، الهاتف، الرسالة)'));
      return;
    }

    const phoneRegex = /^(\+?20|0)?1[0-9]{9}$/;
    if (!phoneRegex.test(formData.phone.trim())) {
      toast.warn(t('errors.invalid_phone_format', 'رقم الهاتف المدخل غير صحيح.'));
      return;
    }

    let finalPhone = formData.phone.trim();
    if (finalPhone.startsWith('0')) {
      finalPhone = '+20' + finalPhone.substring(1);
    } else if (finalPhone.startsWith('20') && finalPhone.length > 10) {
      finalPhone = '+' + finalPhone;
    }

    const payload = {
      name: formData.name,
      phone: finalPhone,
      subject: formData.subject,
      message: formData.message
    };

    if (formData.email && formData.email.trim() !== '') {
      payload.email = formData.email.trim();
    }

    setLoading(true);
    try {
      await axios.post('/management/contact-messages/', payload);
      toast.success(t('contact_page.form.success_msg', 'تم إرسال رسالتك بنجاح، سنتواصل معك قريباً.'));
      setFormData({ ...formData, subject: '', message: '' });
    } catch  {
      toast.error(t('errors.generic', 'حدث خطأ أثناء الإرسال.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-secondary/30 min-h-screen pb-20">
      {/* Hero Section */}
      <div className="bg-dark text-white pt-10 md:pt-16 pb-20 md:pb-28 relative overflow-hidden">
        <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} w-full h-full bg-gradient-to-b from-primary/20 to-transparent`}></div>

        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="bg-white/10 w-14 h-14 md:w-20 md:h-20 rounded-2xl md:rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-6 backdrop-blur-md border border-white/20 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-300">
            <MessageSquare size={28} className="text-white md:w-9 md:h-9" />
          </div>
          <h1 className="text-2xl md:text-5xl font-black mb-3 md:mb-4 tracking-tight">
            {t('contact_page.title', 'تواصل معنا')}
          </h1>
          <p className="text-gray-300 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed px-2">
            {t('contact_page.desc', 'نحن هنا للإجابة على استفساراتك وتلبية طلباتك. لا تتردد في مراسلتنا في أي وقت.')}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 -mt-12 md:-mt-16 relative z-20">
        {/* Contact Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 mb-8 md:mb-10 justify-center">

          <ContactCard
            icon={Phone}
            title={t('contact_page.phone_label', 'رقم الهاتف')}
            value="+20 103 702 9909"
            href="tel:+201037029909"
            colorClass="bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
            delay="0s"
          />

          <ContactCard
            icon={Mail}
            title={t('contact_page.email_label', 'البريد الإلكتروني')}
            value="info@lahmfarm.com"
            href="mailto:info@lahmfarm.com"
            colorClass="bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white"
            delay="0.1s"
          />

          {/*

                               (Ctrl + /)
          */}
          <ContactCard
            icon={MapPin}
            title={t('contact_page.address_label', 'العنوان')}
            value={t('contact_page.address_value', 'سيدي جابر، الإسكندرية، مصر')}
            href="https://maps.google.com/?q=Sidi+Gaber,Alexandria,Egypt"
            colorClass="bg-orange-50 text-orange-600 group-hover:bg-orange-600 group-hover:text-white"
            delay="0.2s"
          />
          {}

        </div>

        {/* Form Section */}
        <div className="max-w-4xl mx-auto bg-white rounded-3xl md:rounded-[2.5rem] shadow-xl border border-gray-100 p-5 md:p-12 animate-fade-in-up">
          <div className="text-center mb-6 md:mb-10">
            <h2 className="text-xl md:text-3xl font-black text-dark mb-2 md:mb-3">
              {t('contact_page.form.title', 'أرسل لنا رسالة')}
            </h2>
            <p className="text-gray-500 text-xs md:text-base">
              {t('contact_page.form.desc', 'املأ النموذج أدناه وسيقوم فريقنا بالرد عليك في أقرب وقت ممكن.')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 md:mb-2 ms-1">
                  {t('contact_page.form.name', 'الاسم الكامل')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder={t('contact_page.form.name_placeholder', 'الاسم الكامل')}
                  className="w-full h-12 md:h-14 px-4 md:px-5 rounded-xl md:rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium text-sm md:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 md:mb-2 ms-1">
                  {t('contact_page.form.phone', 'رقم الهاتف')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  dir="ltr"
                  maxLength="15"
                  placeholder={t('auth.phone_placeholder', '01xxxxxxxxx')}
                  className="w-full h-12 md:h-14 px-4 md:px-5 rounded-xl md:rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium text-end text-sm md:text-base"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 md:mb-2 ms-1">
                  {t('contact_page.form.email', 'البريد الإلكتروني')} <span className="text-gray-400 font-normal text-xs">({t('auth.optional', 'اختياري')})</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  dir="ltr"
                  placeholder={t('auth.email_placeholder', 'example@domain.com')}
                  className="w-full h-12 md:h-14 px-4 md:px-5 rounded-xl md:rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium text-end text-sm md:text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 md:mb-2 ms-1">
                  {t('contact_page.form.subject', 'موضوع الرسالة')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  required
                  value={formData.subject}
                  onChange={handleChange}
                  placeholder={t('contact_page.form.subject_placeholder', 'موضوع الرسالة')}
                  className="w-full h-12 md:h-14 px-4 md:px-5 rounded-xl md:rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium text-sm md:text-base"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5 md:mb-2 ms-1">
                {t('contact_page.form.message', 'رسالتك')} <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={isMobile ? "4" : "5"}
                name="message"
                required
                value={formData.message}
                onChange={handleChange}
                placeholder={t('contact_page.form.message_placeholder', 'اكتب تفاصيل رسالتك هنا...')}
                className="w-full p-4 md:p-5 rounded-xl md:rounded-2xl bg-gray-50 border border-gray-200 focus:bg-white focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-medium resize-none text-sm md:text-base"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary-dark text-white h-12 md:h-14 rounded-xl md:rounded-2xl font-bold text-base md:text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed mt-2 md:mt-4"
            >
              {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  {t('contact_page.form.send_btn', 'إرسال الرسالة')}
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

export default ContactUs;