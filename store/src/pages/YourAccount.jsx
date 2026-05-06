import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { UserCog, Package, MapPin, Star, Bell, HelpCircle, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import useAuth from '../context/auth/useAuth';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

const DashboardCard = ({ to, icon, title, text, colorClass, isRtl, viewText }) => (
    <Link to={to} className="group bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col h-full w-full">
        <div className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center mb-3 md:mb-4 transition-colors ${colorClass}`}>
            {React.cloneElement(icon, { className: "w-5 h-5 md:w-7 md:h-7" })}
        </div>
        <h3 className="text-sm md:text-lg font-bold text-dark mb-1 md:mb-2 group-hover:text-primary transition-colors line-clamp-1">{title}</h3>
        <p className="text-[10px] md:text-sm text-gray-500 leading-relaxed mb-3 md:mb-4 flex-grow line-clamp-2 md:line-clamp-none">{text}</p>
        <div className="flex items-center justify-between text-[10px] md:text-xs font-bold text-gray-400 group-hover:text-primary transition-colors mt-auto">
            <span>{viewText}</span>
            {isRtl ?
                <ChevronLeft size={16} className="transition-transform group-hover:-translate-x-1" /> :
                <ChevronRight size={16} className="transition-transform group-hover:translate-x-1" />
            }
        </div>
    </Link>
);

const YourAccount = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const { user } = useAuth();
    const [specialRequests, setSpecialRequests] = useState([]);
    const[loading, setLoading] = useState(true);

    const fetchSpecialRequests = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const res = await axios.get('/orders/special-requests/');
            setSpecialRequests(res.data.results ||[]);
        } catch {
            toast.error(t('errors.generic', 'حدث خطأ ما. حاول مرة أخرى.'));
        } finally {
            setLoading(false);
        }
    },[user, t]);

    useEffect(() => {
        fetchSpecialRequests();
    }, [fetchSpecialRequests]);

    return (
        <div className="bg-secondary/20 min-h-[calc(100vh-60px)] pb-20">
            <div className="container mx-auto px-4 py-8 md:py-10">

                {/* Header */}
                <div className="text-center mb-8 md:mb-10 animate-fade-in-up">
                    <h1 className="text-xl md:text-3xl font-black text-dark mb-2">
                        {t('profile.welcome', 'مرحباً')}، <span className="text-primary">{user?.full_name.split(' ')[0]}</span> 👋
                    </h1>
                    <p className="text-muted text-sm md:text-base">{t('profile.manage_account', 'إدارة الحساب')}</p>
                </div>

                <div className="flex flex-wrap justify-center gap-3 md:gap-6 mb-10 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>

                    <div className="w-[calc(50%-0.375rem)] md:w-[calc(33.333%-1rem)]">
                        <DashboardCard
                            to="/profile"
                            icon={<UserCog />}
                            title={t('profile.personal_info', 'المعلومات الشخصية')}
                            text={t('profile.personal_info_desc', 'تحديث بياناتك الشخصية، كلمة المرور.')}
                            colorClass="bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                            isRtl={isRtl}
                            viewText={t('common.view_details', 'عرض التفاصيل')}
                        />
                    </div>

                    <div className="w-[calc(50%-0.375rem)] md:w-[calc(33.333%-1rem)]">
                        <DashboardCard
                            to="/my-orders"
                            icon={<Package />}
                            title={t('profile.my_orders', 'مشترياتي')}
                            text={t('profile.my_orders_desc', 'تتبع حالة طلباتك الحالية والسابقة.')}
                            colorClass="bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white"
                            isRtl={isRtl}
                            viewText={t('common.view_details', 'عرض التفاصيل')}
                        />
                    </div>

                    <div className="w-[calc(50%-0.375rem)] md:w-[calc(33.333%-1rem)]">
                        <DashboardCard
                            to="/addresses"
                            icon={<MapPin />}
                            title={t('profile.addresses', 'العناوين')}
                            text={t('profile.addresses_desc', 'إدارة عناوين التوصيل.')}
                            colorClass="bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white"
                            isRtl={isRtl}
                            viewText={t('common.view_details', 'عرض التفاصيل')}
                        />
                    </div>

                    <div className="w-[calc(50%-0.375rem)] md:w-[calc(33.333%-1rem)]">
                        <DashboardCard
                            to="/notifications"
                            icon={<Bell />}
                            title={t('nav.notifications', 'الإشعارات')}
                            text={t('profile.notifications_desc', 'آخر التنبيهات حول حالة الطلبات.')}
                            colorClass="bg-purple-50 text-purple-600 group-hover:bg-purple-600 group-hover:text-white"
                            isRtl={isRtl}
                            viewText={t('common.view_details', 'عرض التفاصيل')}
                        />
                    </div>

                    <div className="w-[calc(50%-0.375rem)] md:w-[calc(33.333%-1rem)]">
                        <DashboardCard
                            to="/recommendations"
                            icon={<Star />}
                            title={t('profile.recommendations', 'توصيات لك')}
                            text={t('profile.recommendations_desc', 'منتجات مختارة خصيصاً لك.')}
                            colorClass="bg-yellow-50 text-yellow-600 group-hover:bg-yellow-500 group-hover:text-white"
                            isRtl={isRtl}
                            viewText={t('common.view_details', 'عرض التفاصيل')}
                        />
                    </div>

                </div>

                {/* Special Requests Section */}
                {loading ? (
                    <div className="flex justify-center py-10"><div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div></div>
                ) : specialRequests.length > 0 && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 md:p-8 animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                        <h2 className="text-lg md:text-xl font-bold text-dark mb-4 md:mb-6 flex items-center gap-2">
                            <Activity className="text-primary w-5 h-5 md:w-6 md:h-6"/> {t('profile.special_requests', 'طلباتك الخاصة')}
                        </h2>

                        <div className="space-y-4">
                            {specialRequests.map((req) => (
                                <div key={req.id} className="bg-gray-50 rounded-2xl p-4 md:p-5 border border-gray-100">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <span className="text-[10px] md:text-xs text-muted font-bold block mb-1">{t('profile.order_date', 'تاريخ الطلب')}</span>
                                            <span className="text-dark font-bold text-xs md:text-sm">{new Date(req.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-US')}</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-bold border ${
                                            req.status === 'sourced' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                                        }`}>
                                            {t(`orders_page.status.${req.status}`) || req.status}
                                        </span>
                                    </div>

                                    <div className="bg-white p-3 rounded-xl border border-gray-100 text-xs md:text-sm text-gray-600 mb-3">
                                        <ul className="space-y-1.5">
                                            {Object.entries(req.requested_specs).map(([key, value]) => (
                                                value && <li key={key} className="flex gap-1.5"><span className="text-primary">•</span> <strong>{t(`orders_page.specs.${key}`, key)}:</strong> <span dir="ltr" className="ms-1">{typeof value === 'string' ? value.replace(/كجم|kg/gi, t('common.kg', 'kg')).replace(/جنيه|جنية|egp/gi, t('common.currency', 'EGP')) : value}</span></li>
                                            ))}
                                        </ul>
                                    </div>

                                    {req.status === 'sourced' && req.sourced_animal_details ? (
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex justify-between items-center">
                                            <div className="flex items-center gap-2 text-green-800 text-xs md:text-sm font-bold">
                                                <Star size={16} /> {t('profile.sourced', 'تم التوفير!')}
                                            </div>
                                            <Link to={`/animal/${req.sourced_animal_details.unique_id}`} className="bg-green-600 hover:bg-green-700 text-white text-[10px] md:text-xs px-4 py-2 rounded-lg font-bold transition-colors">
                                                {t('profile.view_buy', 'عرض وشراء')}
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="text-[10px] md:text-xs text-blue-600 flex items-center gap-1 font-bold">
                                            <HelpCircle size={14} /> {t('profile.searching', 'جاري البحث عن طلبك...')}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YourAccount;
