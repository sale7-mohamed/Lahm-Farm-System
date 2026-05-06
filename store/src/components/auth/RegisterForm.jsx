import React, { useState, useEffect } from 'react';
import axios from '../../services/axiosConfig';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { UserPlus, User, Mail, Phone, MapPin, Lock, ArrowRight, ArrowLeft, AlertCircle, CheckCircle, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const InputField = ({ label, name, type = "text", icon: Icon, placeholder, disabled = false, value, onChange, error, isRtl, showPasswordToggle, onTogglePassword, inputMode }) => {

    //    (Padding)     
    
    let paddingClass = "";

    if (isRtl) {

        // :   (Icon) ->  pr-12
        // :   (Toggle) ->  pl-12
        const paddingRight = Icon ? 'pr-12' : 'pr-5';
        const paddingLeft = showPasswordToggle ? 'pl-12' : 'pl-5';
        paddingClass = `${paddingRight} ${paddingLeft}`;
    } else {

        // :   (Icon) ->  pl-12
        // :   (Toggle) ->  pr-12
        const paddingLeft = Icon ? 'pl-12' : 'pl-5';
        const paddingRight = showPasswordToggle ? 'pr-12' : 'pr-5';
        paddingClass = `${paddingLeft} ${paddingRight}`;
    }

    return (
        <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
            <div className="relative group">
                <input
                    type={type}
                    name={name}
                    className={`w-full h-14 bg-gray-50 border text-dark rounded-2xl outline-none transition-all duration-300 font-medium placeholder:text-gray-400 ${paddingClass}
                        ${error
                            ? 'border-red-500 bg-red-50 focus:border-red-500 text-red-900'
                            : 'border-gray-200 focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10'
                        }
                    `}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    placeholder={placeholder}
                    dir="auto"
                    inputMode={inputMode}
                    autoComplete="off"
                />


                {Icon && (
                    <div className={`absolute top-0 bottom-0 ${isRtl ? 'right-4' : 'left-4'} flex items-center pointer-events-none transition-colors ${error ? 'text-red-400' : 'text-gray-400 group-focus-within:text-primary'}`}>
                        <Icon size={20} />
                    </div>
                )}


                {showPasswordToggle && (
                    <button
                        type="button"
                        onClick={onTogglePassword}
                        className={`absolute top-0 bottom-0 ${isRtl ? 'left-4' : 'right-4'} flex items-center text-gray-400 hover:text-dark transition-colors z-10`}
                        tabIndex="-1"
                    >
                        {type === 'password' ? <Eye size={20} /> : <EyeOff size={20} />}
                    </button>
                )}
            </div>

            {}
            {error && (
                <div className="flex items-center gap-1 mt-2 text-red-500 text-xs font-bold animate-fade-in">
                    <AlertCircle size={14} />
                    <span>{Array.isArray(error) ? error[0] : error}</span>
                </div>
            )}
        </div>
    );
};

function RegisterForm() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const location = useLocation();
  const initialPhone = location.state?.phone || '';
  const initialIdentifier = location.state?.identifier || '';

  // 1.    State      sessionStorage
  const [formData, setFormData] = useState(() => {
    const saved = sessionStorage.getItem('temp_register_form');
    return saved ? JSON.parse(saved) : {
      full_name: '',
      email: initialIdentifier.includes('@') ? initialIdentifier : '',
      phone: initialPhone,
      password: '',
      confirmPassword: '',
      governorate: '',
      city: '',
      street: ''
    };
  });

  const[governorates, setGovernorates] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ key: 'weak', color: 'text-gray-300', width: '0%', bg: 'bg-gray-200' });
  const[generalError, setGeneralError] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.removeItem('otp_page_expiry');
    const fetchGovernorates = async () => {
        try {
            const response = await axios.get('/core/governorates/');
            setGovernorates(response.data ||[]);
        } catch {
            console.error("Failed to load governorates");
        }
    };
    fetchGovernorates();

    if (initialIdentifier.includes('@')) {
      setFormData(prev => ({ ...prev, email: initialIdentifier }));
    }
  }, [initialIdentifier]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const updatedData = { ...formData, [name]: value };
    setFormData(updatedData);

    sessionStorage.setItem('temp_register_form', JSON.stringify(updatedData));

    if (errors[name]) {
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[name];
            return newErrors;
        });
    }
    if (generalError) setGeneralError('');
    if (shakeError) setShakeError(false);

    if (name === 'password') checkPasswordStrength(value);
  };

  const checkPasswordStrength = (password) => {
    if (!password) {
        setPasswordStrength({ key: 'weak', color: 'text-gray-300', width: '0%', bg: 'bg-gray-200' });
        return;
    }

    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    switch (score) {
        case 1: setPasswordStrength({ key: 'weak', color: 'text-red-500', width: '25%', bg: 'bg-red-500' }); break;
        case 2: setPasswordStrength({ key: 'medium', color: 'text-yellow-500', width: '50%', bg: 'bg-yellow-500' }); break;
        case 3: setPasswordStrength({ key: 'good', color: 'text-blue-500', width: '75%', bg: 'bg-blue-500' }); break;
        case 4: setPasswordStrength({ key: 'strong', color: 'text-green-500', width: '100%', bg: 'bg-green-500' }); break;
        default: setPasswordStrength({ key: 'weak', color: 'text-red-500', width: '10%', bg: 'bg-red-500' });
    }
  };

  const triggerShake = () => {
    setShakeError(true);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => setShakeError(false), 400);
  };

  const cleanPhoneNumber = (phone) => {
      let cleaned = phone.replace(/[\s-]/g, '');
      if (cleaned.startsWith('+20')) {
          cleaned = cleaned.substring(3);
      } else if (cleaned.startsWith('20') && cleaned.length > 10) {
          cleaned = cleaned.substring(2);
      }
      if (cleaned.startsWith('0')) {
          cleaned = cleaned.substring(1);
      }
      return cleaned;
  };

  const validateForm = () => {
      const newErrors = {};

      if (!formData.full_name.trim()) newErrors.full_name = t('errors.required');

      if (!formData.phone.trim()) {
          newErrors.phone = t('errors.required');
      } else if (!/^[\d\s+-]+$/.test(formData.phone)) {
          newErrors.phone = t('errors.invalid_phone_format');
      }

      if (formData.email && formData.email.trim() !== "") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(formData.email)) {
              newErrors.email = t('errors.invalid_email');
          }
      }

      if (formData.password.length < 8) {
          newErrors.password = t('auth.password_weak');
      }

      if (formData.password !== formData.confirmPassword) {
          newErrors.confirmPassword = t('auth.passwords_mismatch');
      }

      if (!formData.governorate) newErrors.governorate = t('errors.required');
      if (!formData.city) newErrors.city = t('errors.required');
      if (!formData.street) newErrors.street = t('errors.required');

      setErrors(newErrors);

      const isValid = Object.keys(newErrors).length === 0;
      if (!isValid) {
          triggerShake();
          setGeneralError(t('errors.complete_required_fields'));
      }

      return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setGeneralError('');

    const cleanedPhone = cleanPhoneNumber(formData.phone);
    const finalPhone = `+20${cleanedPhone}`;

    try {
      const emailToSend = formData.email && formData.email.trim() !== "" ? formData.email : null;

      const response = await axios.post('/accounts/register/', {
        full_name: formData.full_name,
        email: emailToSend,
        phone: finalPhone,
        password: formData.password,
        governorate: formData.governorate,
        city: formData.city,
        street: formData.street,
        country_code: `+${formData.country_code || '20'}`,
      });

      const { needs_otp, phone, email } = response.data;
      if (needs_otp) {
        toast.success(t('auth.register_success_otp', 'تم إنشاء الحساب بنجاح، يرجى إدخال كود التفعيل المرسل لهاتفك.'), { autoClose: 5000 });
        sessionStorage.setItem('pendingIdentifier', phone);
        navigate('/otp-verification', { state: { identifier: phone, email } });
      } else {
        toast.success(t('auth.register_success'));
        sessionStorage.removeItem('temp_register_form');
        navigate('/login');
      }
    } catch (error) {
      const errorData = error.response?.data;

      if (errorData?.phone && errorData.phone[0].includes('مسجل ومفعل')) {
          toast.info('لديك حساب مسجل ومفعل بالفعل! يرجى تسجيل الدخول بكتابة كلمة المرور.', { autoClose: 5000 });
          navigate('/login', { state: { preFilledIdentifier: finalPhone } });
          return;
      }

      if (errorData && typeof errorData === 'object' && !errorData.detail) {
          setErrors(errorData);
          setGeneralError(t('errors.complete_required_fields'));
      } else {
          setGeneralError(errorData?.detail || t('auth.register_error'));
      }

      triggerShake();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-2xl mx-auto bg-white p-6 md:p-10 rounded-[2.5rem] shadow-xl border border-gray-100 transition-all duration-300 ${shakeError ? 'animate-shake' : 'animate-fade-in-up'}`}>

      <div className="text-center mb-10">
          <div className="bg-green-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-100 shadow-sm">
              <UserPlus size={36} className="text-green-600" />
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-dark mb-2">{t('auth.register_title')}</h2>
          <p className="text-gray-500 text-sm">{t('auth.join_us')}</p>
      </div>

      {generalError && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 mb-8 flex items-start gap-3 animate-fade-in">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-red-700 text-sm font-bold m-0">{generalError}</p>
          </div>
      )}

      {/*  noValidate           */}
      <form onSubmit={handleSubmit} className="space-y-2" noValidate>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <InputField
                label={t('auth.fullname')}
                name="full_name"
                icon={User}
                placeholder={t('auth.fullname')}
                value={formData.full_name}
                onChange={handleChange}
                error={errors.full_name}
                isRtl={isRtl}
                disabled={loading}
            />
            <InputField
                label={t('auth.phone')}
                name="phone"
                icon={Phone}
                placeholder={t('auth.phone_placeholder')}
                value={formData.phone}
                onChange={handleChange}
                error={errors.phone}
                isRtl={isRtl}
                disabled={loading}
                type="tel"
                inputMode="tel"
            />
        </div>

        <InputField
            label={t('auth.email')}
            name="email"
            type="email"
            icon={Mail}
            placeholder="example@mail.com"
            value={formData.email}
            onChange={handleChange}
            error={errors.email}
            isRtl={isRtl}
            disabled={loading}
            inputMode="email"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <div className="mb-4">
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('auth.governorate')}</label>
                <div className="relative group">
                    <select
                        name="governorate"
                        className={`w-full h-14 appearance-none bg-gray-50 border outline-none rounded-2xl transition-all duration-300 font-medium cursor-pointer
                            ${isRtl ? 'pl-5 pr-12' : 'pl-12 pr-5'}
                            ${errors.governorate
                                ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500'
                                : 'border-gray-200 text-dark focus:bg-white focus:border-primary focus:ring-4 focus:ring-primary/10'
                            }
                        `}
                        value={formData.governorate}
                        onChange={handleChange}
                        disabled={loading}
                    >
                        <option value="">{t('auth.select_governorate')}</option>
                        {governorates.map(gov => (
                            <option key={gov.id} value={gov.name_ar}>
                                {/*  :  gov.name   gov.name_ar */}
                                {gov.name}
                            </option>
                        ))}
                    </select>

                    <div className={`absolute top-0 bottom-0 ${isRtl ? 'right-4' : 'left-4'} flex items-center pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors`}>
                        <MapPin size={20} />
                    </div>
                    <div className={`absolute top-0 bottom-0 ${isRtl ? 'left-4' : 'right-4'} flex items-center pointer-events-none text-gray-400`}>
                        <ChevronDown size={16} />
                    </div>
                </div>
                {errors.governorate && (
                    <div className="flex items-center gap-1 mt-2 text-red-500 text-xs font-bold animate-fade-in">
                        <AlertCircle size={14} />
                        <span>{errors.governorate}</span>
                    </div>
                )}
            </div>

            <InputField
                label={t('auth.city')}
                name="city"
                icon={MapPin}
                placeholder={t('auth.city')}
                value={formData.city}
                onChange={handleChange}
                error={errors.city}
                isRtl={isRtl}
                disabled={loading}
            />
        </div>

        <InputField
            label={t('auth.street')}
            name="street"
            icon={MapPin}
            placeholder={t('auth.street')}
            value={formData.street}
            onChange={handleChange}
            error={errors.street}
            isRtl={isRtl}
            disabled={loading}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            <div>
                <InputField
                    label={t('auth.password_label')}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    icon={Lock}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    error={errors.password}
                    isRtl={isRtl}
                    disabled={loading}
                    showPasswordToggle={true}
                    onTogglePassword={() => setShowPassword(!showPassword)}
                />

                {formData.password && (
                    <div className="mb-4 -mt-2 px-1 animate-fade-in">
                        <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ease-out ${passwordStrength.bg}`}
                                style={{ width: passwordStrength.width }}
                            ></div>
                        </div>
                        <div className={`text-xs mt-1 font-bold text-end ${passwordStrength.color}`}>
                            {t(`auth.${passwordStrength.key}`)}
                        </div>
                    </div>
                )}
            </div>

            <InputField
                label={t('auth.confirm_password')}
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                icon={CheckCircle}
                placeholder="••••••••"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                isRtl={isRtl}
                disabled={loading}
                showPasswordToggle={true}
                onTogglePassword={() => setShowConfirmPassword(!showConfirmPassword)}
            />
        </div>

        <button
            type="submit"
            className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 active:scale-[0.98] transition-all duration-300 disabled:opacity-70 flex items-center justify-center gap-3 mt-6"
            disabled={loading}
        >
            {loading ? (
                <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
                <>
                    {t('auth.register_btn')}
                    {isRtl ? <ArrowLeft size={22}/> : <ArrowRight size={22}/>}
                </>
            )}
        </button>
      </form>
    </div>
  );
}

export default RegisterForm;