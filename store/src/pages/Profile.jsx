
import React, { useEffect, useState, useCallback } from "react";
import axiosInstance from "../services/axiosConfig";
import useAuth from "../context/auth/useAuth";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { User, Mail, Phone, LogOut, Edit3, Save, X, MapPin, CheckCircle, AlertCircle, Loader } from "lucide-react";
import { useTranslation } from "react-i18next";

const Profile = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const { user, updateUserContext, logout } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
  });

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const fetchProfileData = useCallback(async () => {
    if (!user) {
        setLoading(false);
        return;
    }
    setLoading(true);
    try {
      setFormData({
        full_name: user.full_name || '',
        email: user.email || '',
      });
    } catch (error) {
      if (error.response?.status === 401) {
          toast.error(t('errors.session_expired'));
          logout();
          navigate('/account/login-check');
      }
    } finally {
      setLoading(false);
    }
  },[user, navigate, logout, t]);

  useEffect(() => {
    fetchProfileData();
  }, [fetchProfileData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});

    try {
      //  null        
      const finalEmail = formData.email.trim() === "" ? null : formData.email.trim();

      const payload = {
          full_name: formData.full_name,
          email: finalEmail
      };

      const res = await axiosInstance.patch("accounts/me/", payload);

      updateUserContext(res.data);
      toast.success(t('profile.update_success', 'تم تحديث البيانات بنجاح'));

      if (finalEmail && finalEmail !== user.email && res.data.email && !res.data.is_email_verified) {
        toast.info(t('auth.otp_email_sent', 'تم إرسال كود تفعيل للبريد الإلكتروني'));
        navigate('/otp-verification', { state: { identifier: user.phone, email: res.data.email, fromProfile: true } });
      }

      setIsEditing(false);
    } catch (error) {
      const errorData = error.response?.data;
      if (errorData) {
        setErrors(errorData);
        toast.error(errorData.email?.[0] || errorData.detail || t('errors.generic'));
      } else {
        toast.error(t('errors.generic'));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyEmail = async () => {
    if (!user.email) return;
    const toastId = toast.loading(t('common.loading', 'جاري الإرسال...'));
    try {
      await axiosInstance.post('/accounts/resend-otp/', { email: user.email });
      toast.update(toastId, { render: t('auth.otp_email_sent', 'تم إرسال الكود بنجاح'), type: "success", isLoading: false, autoClose: 3000 });
      navigate('/otp-verification', { state: { identifier: user.phone, email: user.email, fromProfile: true } });
    } catch (err) {
      const errorMsg = err.response?.data?.detail || t('errors.generic');
      toast.update(toastId, { render: errorMsg, type: "error", isLoading: false, autoClose: 5000 });

      if (err.response?.status === 429) {
        setTimeout(() => {
            navigate('/otp-verification', { state: { identifier: user.phone, email: user.email, fromProfile: true } });
        }, 2000);
      }
    }
  };

  if (loading || !user) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-secondary/20 min-h-[calc(100vh-60px)] pb-10">
      <div className="container mx-auto px-4 py-8 max-w-2xl">

        <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 mb-6 text-center relative overflow-hidden animate-fade-in-up">
            <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} w-full h-24 bg-primary/10`}></div>
            <div className="relative">
                <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-primary shadow-md border-4 border-white">
                    <User size={48} />
                </div>
                <h2 className="text-2xl font-black text-dark mb-1">{formData.full_name || t('auth.new_account', 'حساب جديد')}</h2>
                <p className="text-muted font-medium dir-ltr inline-block">{user.phone}</p>
            </div>
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-6 animate-fade-in-up">
          <div className="flex justify-between items-center mb-6 border-b border-gray-50 pb-4">
            <h3 className="text-lg font-bold text-dark flex items-center gap-2">
                <Edit3 size={20} className="text-primary"/> {t('profile.personal_info')}
            </h3>
            {!isEditing && (
                <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm font-bold text-primary hover:bg-primary/5 px-3 py-1.5 rounded-lg transition-colors"
                >
                    {t('common.edit')}
                </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <User size={16} className="text-muted"/> {t('auth.fullname')}
              </label>
              <input
                type="text"
                name="full_name"
                className={`w-full px-4 py-3 rounded-xl border transition-all outline-none ${
                    isEditing
                    ? 'bg-white border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                    : 'bg-gray-50 border-transparent text-gray-600'
                } ${errors.full_name ? 'border-red-500 bg-red-50' : ''}`}
                value={formData.full_name}
                onChange={handleChange}
                readOnly={!isEditing}
              />
              {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name}</p>}
            </div>

            {}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Mail size={16} className="text-muted"/> {t('auth.email')}
              </label>
              <div className="relative flex flex-col md:flex-row gap-2">
                <input
                  type="email"
                  name="email"
                  className={`w-full text-left font-sans py-3 rounded-xl border transition-all outline-none pl-4 pr-4 ${
                      isEditing
                      ? 'bg-white border-gray-300 focus:ring-2 focus:ring-primary/20 focus:border-primary'
                      : 'bg-gray-50 border-transparent text-gray-600'
                  } ${errors.email ? 'border-red-500 bg-red-50' : ''}`}
                  value={formData.email || ''}
                  onChange={handleChange}
                  readOnly={!isEditing}
                  dir="ltr"
                  placeholder={isEditing ? "example@email.com" : "لا يوجد بريد إلكتروني مسجل"}
                />

                {!isEditing && user.email && (
                    <div className="flex items-center shrink-0">
                        {user.is_email_verified ? (
                            <span className="flex w-full md:w-auto justify-center items-center gap-1.5 text-green-700 text-xs font-bold bg-green-50 px-4 py-3 md:py-2 rounded-xl border border-green-200">
                                <CheckCircle size={16} /> {t('profile.verified', 'مؤكد')}
                            </span>
                        ) : (
                            <button
                                type="button"
                                onClick={handleVerifyEmail}
                                className="flex w-full md:w-auto justify-center items-center gap-1.5 text-red-600 text-xs font-bold bg-red-50 hover:bg-red-100 px-4 py-3 md:py-2 rounded-xl border border-red-200 transition-colors shadow-sm"
                            >
                                <AlertCircle size={16} /> {t('profile.not_verified', 'تحقق الآن')}
                            </button>
                        )}
                    </div>
                )}
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
            </div>

            {}
            <div>
              <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                <Phone size={16} className="text-muted"/> {t('auth.phone')}
              </label>
              <div className="relative flex flex-col md:flex-row gap-2">
                <input
                  type="text"
                  className="w-full text-left font-sans py-3 rounded-xl border border-transparent bg-gray-50 text-gray-500 cursor-not-allowed pl-4 pr-4"
                  value={user.phone || ''}
                  readOnly
                  disabled
                  dir="ltr"
                />
                <div className="flex items-center shrink-0">
                    <span className="flex w-full md:w-auto justify-center items-center gap-1.5 text-green-700 text-xs font-bold bg-green-50 px-4 py-3 md:py-2 rounded-xl border border-green-200">
                        <CheckCircle size={16} /> {t('profile.verified', 'مؤكد')}
                    </span>
                </div>
              </div>
              <p className="text-[10px] text-muted mt-1 me-1">{t('profile.phone_readonly', 'رقم الهاتف مرتبط بالحساب ولا يمكن تغييره.')}</p>
            </div>

            {isEditing && (
                <div className="flex gap-3 pt-4 border-t border-gray-50">
                    <button
                        type="submit"
                        disabled={saving}
                        className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader size={18} className="animate-spin" /> : <><Save size={18} /> {t('common.save')}</>}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsEditing(false); fetchProfileData(); setErrors({}); }}
                        className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors flex items-center gap-2"
                    >
                        <X size={18} /> {t('common.cancel')}
                    </button>
                </div>
            )}
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fade-in-up">
            <button onClick={() => navigate('/addresses')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 hover:shadow-md transition-all group text-start">
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                    <MapPin size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-dark">{t('profile.manage_addresses')}</h4>
                    <p className="text-xs text-muted m-0">{t('profile.manage_addresses_desc')}</p>
                </div>
            </button>

            <button onClick={() => { logout(); navigate('/'); }} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-3 hover:shadow-md transition-all group text-start group">
                <div className="bg-red-50 p-3 rounded-xl text-red-600 group-hover:bg-red-600 group-hover:text-white transition-colors">
                    <LogOut size={20} />
                </div>
                <div>
                    <h4 className="font-bold text-dark group-hover:text-red-600 transition-colors">{t('common.logout')}</h4>
                    <p className="text-xs text-muted m-0">{t('profile.logout_desc')}</p>
                </div>
            </button>
        </div>

      </div>
    </div>
  );
};

export default Profile;
