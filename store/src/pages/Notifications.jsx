import React, { useState, useEffect, useCallback } from 'react';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import { Bell, CheckCheck, Clock, Package, CreditCard, Beef, CalendarCheck, Info, Sparkles, Tag, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import { useApp } from '../context/app/useApp';
import { useTranslation } from 'react-i18next';
import Modal from '../components/ui/Modal';

const getCategoryConfig = (category, title) => {
  const isOffer = title?.includes('عرض') || title?.includes('خصم') || title?.includes('🎉');
  const isGreeting = title?.includes('عيد') || title?.includes('رمضان') || title?.includes('🌙') || title?.includes('مبارك');

  if (isOffer) {
    return {
      icon: Tag,
      color: 'text-rose-600',
      bg: 'bg-gradient-to-br from-rose-50 to-red-100',
      border: 'border-rose-200',
      iconBg: 'bg-rose-500 text-white',
    };
  }
  if (isGreeting) {
    return {
      icon: Sparkles,
      color: 'text-amber-600',
      bg: 'bg-gradient-to-br from-amber-50 to-yellow-100',
      border: 'border-amber-200',
      iconBg: 'bg-amber-500 text-white',
    };
  }

  switch (category) {
    case 'order':
      return { icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100', iconBg: 'bg-blue-100 text-blue-600' };
    case 'payment':
      return { icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100', iconBg: 'bg-emerald-100 text-emerald-600' };
    case 'livestock':
      return { icon: Beef, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', iconBg: 'bg-orange-100 text-orange-600' };
    case 'reservation':
      return { icon: CalendarCheck, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', iconBg: 'bg-purple-100 text-purple-600' };
    default:
      return { icon: Info, color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20', iconBg: 'bg-primary/10 text-primary' };
  }
};

const NotificationItem = ({ notification, onClick, isRtl }) => {
  const { t, i18n } = useTranslation();
  const config = getCategoryConfig(notification.category, notification.title);
  const Icon = config.icon;

  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return t('notifications.ago', { count: Math.floor(interval), unit: t('notifications.year', 'سنة') });
    interval = seconds / 2592000;
    if (interval > 1) return t('notifications.ago', { count: Math.floor(interval), unit: t('notifications.month', 'شهر') });
    interval = seconds / 86400;
    if (interval > 1) return t('notifications.ago', { count: Math.floor(interval), unit: t('notifications.day', 'يوم') });
    interval = seconds / 3600;
    if (interval > 1) return t('notifications.ago', { count: Math.floor(interval), unit: t('notifications.hour', 'ساعة') });
    interval = seconds / 60;
    if (interval > 1) return t('notifications.ago', { count: Math.floor(interval), unit: t('notifications.minute', 'دقيقة') });
    return t('notifications.now', 'الآن');
  };

  const translatedTitle = i18n.language === 'en'
    ? notification.title
        .replace(/تم إنشاء طلب جديد/g, 'New Order Created')
        .replace(/طلب جديد/g, 'New Order')
        .replace(/تمت الموافقة/g, 'Approved')
        .replace(/تم الرفض/g, 'Rejected')
    : notification.title;

  const translatedMessage = i18n.language === 'en'
    ? notification.message
        .replace(/تم استلام طلب جديد من/g, 'New order received from')
        .replace(/تم إنشاء الطلب/g, 'Order')
        .replace(/بإجمالي/g, 'with total')
        .replace(/جنيه/g, 'EGP')
        .replace(/تم استلام دفعتك/g, 'Payment received')
    : notification.message;

  return (
    <div
      onClick={() => onClick(notification)}
      className={`p-4 rounded-3xl border transition-all duration-300 flex items-center gap-4 cursor-pointer group relative overflow-hidden ${
        notification.is_read
          ? 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-md'
          : `${config.bg} ${config.border} shadow-sm hover:shadow-md transform hover:-translate-y-1`
      }`}
    >
      {!notification.is_read && (
        <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} w-1.5 h-full ${config.iconBg.split(' ')[0]}`}></div>
      )}

      <div
        className={`flex-shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm ${
          notification.is_read ? 'bg-gray-100 text-gray-400' : config.iconBg
        }`}
      >
        <Icon size={24} />
      </div>

      <div className="flex-grow ps-1">
        <h6 className={`font-black text-sm md:text-base mb-1 transition-colors ${notification.is_read ? 'text-gray-700' : 'text-dark'}`}>
          {translatedTitle}
        </h6>
        <p className="text-xs md:text-sm text-gray-500 line-clamp-1 m-0 leading-relaxed font-medium">
          {translatedMessage}
        </p>
        <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-gray-400 mt-2 font-bold font-mono dir-ltr w-fit">
          <Clock size={12} />
          {timeAgo(notification.created_at)}
        </div>
      </div>

      <div
        className={`flex-shrink-0 transition-all ${notification.is_read ? 'text-gray-300' : config.color} ${
          isRtl ? 'group-hover:-translate-x-2' : 'group-hover:translate-x-2'
        }`}
      >
        {isRtl ? <ChevronLeft size={24} /> : <ChevronRight size={24} />}
      </div>
    </div>
  );
};

const Notifications = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const { triggerRefetch } = useApp();

  const [selectedNotif, setSelectedNotif] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchNotifications = useCallback(
    async (pageNum = 1) => {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      try {
        const res = await axios.get(`/notifications/?page=${pageNum}`);
        const newNotifs = res.data.results || [];

        if (pageNum === 1) {
          setNotifications(newNotifs);
        } else {
          setNotifications((prev) => [...prev, ...newNotifs]);
        }
        setHasMore(!!res.data.next);
      } catch {
        toast.error(t('notifications.load_error', 'فشل في تحميل الإشعارات'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [t]
  );

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNotifications(nextPage);
  };

  useEffect(() => {
    fetchNotifications(1);
  }, [fetchNotifications]);

  const handleOpenNotification = async (notification) => {
    setSelectedNotif(notification);
    setIsModalOpen(true);

    if (!notification.is_read) {
      try {
        await axios.post(`/notifications/${notification.id}/mark-read/`);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
        );
        triggerRefetch();
      } catch (err) {
        console.error('Failed to mark as read', err);
      }
    }
  };

  const markAllAsRead = async () => {
    try {
      await axios.post('/notifications/mark-all-read/');
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      triggerRefetch();
      toast.success(t('notifications.mark_all_read_success', 'تم تحديد الكل كمقروء ✅'));
    } catch {
      toast.error(t('notifications.mark_all_error', 'فشل في تحديث الإشعارات'));
    }
  };

  const filteredNotifications = notifications.filter((notif) => {
    if (filter === 'all') return true;
    if (filter === 'order' && (notif.category === 'order' || notif.category === 'reservation')) return true;
    if (
      filter === 'offer' &&
      (notif.category === 'livestock' || notif.title?.includes('عرض') || notif.title?.includes('خصم'))
    )
      return true;
    if (filter === 'general' && notif.category === 'general' && !notif.title?.includes('عرض')) return true;
    return false;
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="bg-secondary/20 min-h-screen pb-20">
      <div className="bg-dark text-white py-12 relative overflow-hidden">
        <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} w-full h-full bg-primary/10`}></div>
        <div className="container mx-auto px-4 relative z-10 flex flex-col md:flex-row justify-between items-center gap-4 max-w-3xl">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center text-primary border border-white/20 shadow-lg relative">
              <Bell size={32} />
              {unreadCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-dark animate-bounce">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </div>
            <div className="text-start">
              <h1 className="text-2xl md:text-3xl font-black mb-1 text-white">
                {t('notifications.your_notifications', 'إشعاراتك')}
              </h1>
              <p className="text-gray-400 text-sm m-0">
                {t('notifications.all_updates_offers', 'كل التحديثات والعروض في مكان واحد')}
              </p>
            </div>
          </div>

          {unreadCount > 0 && (
            <button
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-xl transition-all backdrop-blur-sm border border-white/10 font-bold text-sm"
              onClick={markAllAsRead}
            >
              <CheckCheck size={18} /> {t('notifications.mark_all_read', 'تحديد الكل كمقروء')}
            </button>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-3xl -mt-6 relative z-20">
        {notifications.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 hide-scrollbar">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === 'all' ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {t('common.all', 'الكل')}
            </button>
            <button
              onClick={() => setFilter('order')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === 'order'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {t('notifications.orders_bookings', 'الطلبات والحجوزات')}
            </button>
            <button
              onClick={() => setFilter('offer')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === 'offer'
                  ? 'bg-rose-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {t('notifications.offers_livestock', 'العروض والمواشي')}
            </button>
            <button
              onClick={() => setFilter('general')}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                filter === 'general'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {t('notifications.general', 'عام')}
            </button>
          </div>
        )}

        <div className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm animate-fade-in-up">
              <div className="bg-gray-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                <Bell size={40} />
              </div>
              <h3 className="text-xl font-black text-dark mb-2">
                {t('notifications.no_notifications_to_show', 'لا توجد إشعارات لعرضها')}
              </h3>
              <p className="text-muted text-sm max-w-xs mx-auto">
                {t('notifications.will_notify_you_here', 'سنخبرك هنا بكل جديد حول طلباتك وأحدث عروضنا.')}
              </p>
            </div>
          ) : (
            <>
              {filteredNotifications.map((notif) => (
                <div key={notif.id} className="animate-fade-in-up">
                  <NotificationItem notification={notif} onClick={handleOpenNotification} isRtl={isRtl} />
                </div>
              ))}
              {filteredNotifications.length > 0 && hasMore && (
                <div className="text-center pt-4">
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="bg-white border-2 border-primary text-primary hover:bg-primary hover:text-white px-6 py-2.5 rounded-xl font-bold transition-all"
                  >
                    {loadingMore
                      ? t('common.loading', 'جاري التحميل...')
                      : t('notifications.show_older_notifications', 'عرض إشعارات أقدم')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="" size="md">
        {selectedNotif &&
          (() => {
            const config = getCategoryConfig(selectedNotif.category, selectedNotif.title);
            const ModalIcon = config.icon;
            return (
              <div className="text-center space-y-5 py-4">
                <div
                  className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto shadow-lg rotate-3 ${config.iconBg}`}
                >
                  <ModalIcon size={40} />
                </div>

                <div>
                  <h3 className="text-2xl font-black text-dark mb-2 leading-tight">{selectedNotif.title}</h3>
                  <div className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full font-mono dir-ltr border border-gray-100">
                    <Clock size={14} className="text-gray-400" />
                    {new Date(selectedNotif.created_at)
                      .toLocaleString('en-GB', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })
                      .replace(',', '')}
                  </div>
                </div>

                <div className="bg-gray-50 border border-gray-100 rounded-3xl p-6 text-gray-700 leading-loose text-base text-center md:text-justify shadow-inner font-medium">
                  {selectedNotif.message}
                </div>

                <button
                  onClick={() => setIsModalOpen(false)}
                  className="w-full bg-dark hover:bg-black text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-md active:scale-95"
                >
                  <CheckCircle2 size={20} /> {t('notifications.ok_understood', 'حسناً، فهمت')}
                </button>
              </div>
            );
          })()}
      </Modal>
    </div>
  );
};

export default Notifications;

