import React, { useEffect, useState, useCallback, useRef, useContext } from "react";
import axios from "../services/axiosConfig";
import { toast } from "react-toastify";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
    Package, Clock, CheckCircle, AlertCircle, Calendar, Search,
    Users, Copy, Send, Info, MapPin, Truck, Check, ChevronLeft, ShoppingBag,
    XCircle, CreditCard, Eye, Printer, Wallet, Tag
} from "lucide-react";
import { useTranslation } from "react-i18next";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import ConfirmModal from "../components/ui/ConfirmModal";
import { AppContext } from "../context/app/AppContext";

const getStatusColor = (status) => {
    switch (status) {
        case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
        case 'processing': return 'bg-blue-50 text-blue-700 border-blue-200';
        case 'completed': return 'bg-green-50 text-green-700 border-green-200';
        case 'canceled': return 'bg-red-50 text-red-700 border-red-200';
        case 'sourced': return 'bg-purple-50 text-purple-700 border-purple-200';
        case 'requires_action': return 'bg-orange-50 text-orange-700 border-orange-200';
        default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
};

const LivePendingTimer = ({ order, onExpire }) => {
    const { t } = useTranslation();
    const [timeLeft, setTimeLeft] = useState(null);
    const hasExpiredRef = useRef(false);

    useEffect(() => {
        if (order.status !== 'pending') return;

        const expiryTime = new Date(order.created_at).getTime() + (15 * 60 * 1000);
        const calculateTime = () => {
            const diff = expiryTime - Date.now();
            if (diff <= 0) return null;
            return {
                m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                s: Math.floor((diff % (1000 * 60)) / 1000)
            };
        };

        const initial = calculateTime();
        if (initial) {
            setTimeLeft(initial);
            const timer = setInterval(() => {
                const updated = calculateTime();
                if (updated) {
                    setTimeLeft(updated);
                } else {
                    clearInterval(timer);
                    setTimeLeft(null);
                    if (onExpire && !hasExpiredRef.current) {
                        hasExpiredRef.current = true;
                        onExpire(order.id);
                    }
                }
            }, 1000);
            return () => clearInterval(timer);
        } else {
            if (onExpire && !hasExpiredRef.current) {
                hasExpiredRef.current = true;
                onExpire(order.id);
            }
        }
    }, [order.status, order.created_at, order.id, onExpire]);

    if (!timeLeft || order.status !== 'pending') return null;

    const timeText = timeLeft.m > 0 ? `${timeLeft.m} ${t('orders_page.minute', 'دقيقة')}` : t('orders_page.less_than_minute', "أقل من دقيقة");

    return (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-3 flex flex-col gap-2 animate-pulse">
            <div className="flex items-start gap-2 text-red-700 font-bold text-sm">
                <Clock size={18} className="mt-1 shrink-0" />
                <div dir="rtl" className="leading-relaxed">
                    {t('orders_page.auto_cancel_warning', 'تنبيه: سيتم إلغاء الطلب تلقائياً خلال 15 دقيقة في حال عدم دفع العربون لتأكيد الحجز.')}
                </div>
            </div>
            <div className="text-red-600 text-sm font-bold ms-4 ps-1">
                {t('orders_page.time_remaining', 'الوقت المتبقي:')} {timeText}
            </div>
        </div>
    );
};

function MyOrders() {
    const { t, i18n } = useTranslation();
    const { triggerRefetch } = useContext(AppContext);
    const location = useLocation();
    const navigate = useNavigate();

    const translateOrderType = (label) => {
        switch(label) {
            case 'نقطة بيع': return t('orders_page.pos_sale', 'نقطة بيع');
            case 'مجموعة خاصة': return t('orders_page.private_group', 'مجموعة خاصة');
            case 'مسبح أضاحي': return t('orders_page.adahi_pool', 'مسبح أضاحي');
            case 'مشاركة (لحم)': return t('orders_page.meat_share', 'مشاركة (لحم)');
            case 'أضحية كاملة': return t('orders_page.full_sacrifice', 'أضحية كاملة');
            case 'طلب متجر': return t('orders_page.store_order', 'طلب متجر');
            default: return label;
        }
    };

    const [orders, setOrders] = useState([]);
    const [specialRequests, setSpecialRequests] = useState([]);
    const [activeGroup, setActiveGroup] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('orders');
    const [invitePhone, setInvitePhone] = useState('');
    const [inviting, setInviting] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [payingLoading, setPayingLoading] = useState(false);
    const [paymentMode, setPaymentMode] = useState('full');
    const [customAmount, setCustomAmount] = useState('');
    const [orderToCancel, setOrderToCancel] = useState(null);

    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    const getStatusText = (status) => {
        const fallbackMap = {
            'pending': 'معلق',
            'confirmed': 'مؤكد',
            'processing': 'قيد التجهيز',
            'ready_for_shipment': 'جاهز للشحن',
            'out_for_delivery': 'في الطريق للتوصيل',
            'delivered': 'تم التوصيل',
            'completed': 'مكتمل',
            'canceled': 'ملغي',
            'sourced': 'تم التوفير',
            'requires_action': 'جاري تحديث الطلب'
        };
        return t(`orders_page.status.${status}`, fallbackMap[status] || status);
    };

    const fetchAllData = useCallback(async (pageNum = 1) => {
        if (pageNum === 1) setLoading(true);
        try {
            const [ordersRes, specialRequestsRes] = await Promise.all([
                axios.get(`/orders/list/?page=${pageNum}`),
                axios.get("/orders/special-requests/")
            ]);

            const orderData = ordersRes.data.results || ordersRes.data;
            if (pageNum === 1) {
                setOrders(Array.isArray(orderData) ? orderData : []);
            } else {
                setOrders(prev => [...prev, ...(Array.isArray(orderData) ? orderData : [])]);
            }

            setHasMore(!!ordersRes.data.next);

            if (pageNum === 1) {
                const specialData = specialRequestsRes.data.results || specialRequestsRes.data;
                if (Array.isArray(specialData)) setSpecialRequests(specialData);
            }

        } catch (error) {
            console.error("Orders fetch error:", error);
            toast.error(t('orders_page.load_error', "فشل تحميل البيانات"));
        }

        try {
            const groupRes = await axios.get("/livestock/adahi-groups/my-active-group/");
            if (groupRes.data && groupRes.data.id) setActiveGroup(groupRes.data);
            else setActiveGroup(null);
        } catch {
            setActiveGroup(null);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [t]);

    const loadMoreOrders = () => {
        if (!hasMore || loadingMore) return;
        setLoadingMore(true);
        const nextPage = page + 1;
        setPage(nextPage);
        fetchAllData(nextPage);
    };

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const paymentStatus = params.get('payment');
        const orderId = params.get('order_id');

        if (paymentStatus === 'success' || paymentStatus === 'failed') {
            window.history.replaceState(null, '', location.pathname);

            if (paymentStatus === 'success') {
                toast.success(
                    t('orders_page.payment_success', `تم الدفع بنجاح لطلب رقم #${orderId}! جاري تجهيز طلبك.`),
                    { autoClose: 8000 }
                );
                triggerRefetch();
            } else {
                toast.error(
                    t('orders_page.payment_failed', `عفواً، فشلت عملية الدفع لطلب رقم #${orderId}. يرجى المحاولة مرة أخرى.`)
                );
            }

            if (orderId && orders.length > 0) {
                const targetOrder = orders.find(o => String(o.id) === String(orderId));
                if (targetOrder) {
                    handleOpenDetails(targetOrder);
                }
            }
        }
    }, [location, triggerRefetch, t, orders]);

    const handleOpenDetails = (order) => {
        setSelectedOrder(order);
        setPaymentMode('full');
        setCustomAmount('');
        setShowDetailsModal(true);
    };

    const handlePayRemaining = async (orderToPay = null) => {
        const targetOrder = orderToPay || selectedOrder;
        if (!targetOrder) return;

        let amountToPay = targetOrder.remaining_amount;

        if (paymentMode === 'custom') {
            amountToPay = parseFloat(customAmount);
            if (!amountToPay || amountToPay <= 0) {
                toast.warn(t('errors.invalid_deposit', "يرجى إدخال مبلغ صحيح"));
                return;
            }
            if (amountToPay > targetOrder.remaining_amount) {
                toast.warn(t('orders_page.amount_must_not_exceed', "المبلغ المدخل أكبر من المبلغ المتبقي"));
                return;
            }
        }

        setPayingLoading(true);
        try {
            const response = await axios.post('/payments/pay-remainder/', {
                order_id: targetOrder.id,
                amount: amountToPay
            });

            if (response.data.payment_url) {
                window.location.href = response.data.payment_url;
            } else {
                throw new Error("No payment URL received");
            }
        } catch (err) {
            console.error("Payment error:", err);
            toast.error(t('orders_page.payment_error', "حدث خطأ أثناء الاتصال ببوابة الدفع"));
        } finally {
            setPayingLoading(false);
        }
    };

    const handleOrderExpire = useCallback(async (orderId) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'canceled' } : o));
        fetchAllData();

        try {
            await axios.post(`/orders/list/${orderId}/cancel/`);
            toast.info(t('orders_page.auto_canceled_timeout', "تم إلغاء الطلب تلقائياً لانتهاء مهلة السداد (15 دقيقة)."));
        } catch (err) {
            console.error(t('orders_page.auto_cancel_failed_backend', "فشل الإلغاء التلقائي في الباك إند:"), err);
        }
    }, [fetchAllData, t]);

    const requestCancelOrder = (order) => {
        setOrderToCancel(order);
    };

    const confirmCancelOrder = async () => {
        if (!orderToCancel) return;
        try {
            await axios.post(`/orders/list/${orderToCancel.id}/cancel/`);
            toast.success(t('orders_page.order_canceled_success', "تم إلغاء الطلب بنجاح."));
            setShowDetailsModal(false);
            setOrders(prev => prev.map(o => o.id === orderToCancel.id ? { ...o, status: 'canceled' } : o));
            triggerRefetch();
            fetchAllData();
        } catch (err) {
            toast.error(err.response?.data?.detail || t('orders_page.order_cancel_error', "حدث خطأ أثناء إلغاء الطلب."));
        } finally {
            setOrderToCancel(null);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!invitePhone.trim() || !activeGroup) return;

        const phoneRegex = /^01[0-9]{9}$/;
        if (!phoneRegex.test(invitePhone)) {
            toast.error(t('orders_page.invalid_phone', "رقم الهاتف غير صالح"));
            return;
        }

        setInviting(true);
        try {
            await axios.post(`/livestock/adahi-groups/${activeGroup.id}/invite/`, {
                phone: invitePhone.trim()
            });
            toast.success(t('orders_page.invite_success', "تم إرسال الدعوة بنجاح"));
            setInvitePhone('');
        } catch (err) {
            const msg = err.response?.data?.detail || t('orders_page.invite_error', "فشل إرسال الدعوة");
            toast.error(msg);
        } finally {
            setInviting(false);
        }
    };

    const copyCode = () => {
        if (activeGroup?.code) {
            navigator.clipboard.writeText(activeGroup.code).then(() => {
                toast.success(t('orders_page.code_copied', "تم نسخ الكود"));
            }).catch(() => {
                toast.error(t('orders_page.copy_error', "فشل النسخ"));
            });
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
                <p className="text-muted font-bold">{t('orders_page.loading', "جاري التحميل...")}</p>
            </div>
        );
    }

    let groupMaxShares = 7;
    let groupSoldShares = 0;
    let groupProgressPercent = 0;

    if (activeGroup) {
        groupMaxShares = activeGroup.listing_details?.total_shares || 7;
        groupSoldShares = activeGroup.sold_shares || 0;
        groupProgressPercent = (groupSoldShares / groupMaxShares) * 100;
    }

    const pendingGroupOrder = orders.find(o =>
        o.status === 'pending' &&
        o.items.some(i => i.animal?.code === activeGroup?.animal_details?.code)
    );

    const groupOrderForDisplay = orders.find(o =>
        o.items.some(i => i.animal?.code === activeGroup?.animal_details?.code && i.listing_section === 'adahi_group')
    );

    return (
        <div className="bg-secondary/20 min-h-screen pb-20">
            <div className="container mx-auto px-4 py-8">

                {activeGroup && (
                    <div className={`rounded-3xl p-6 mb-8 shadow-lg border-2 relative overflow-hidden animate-fade-in-up ${activeGroup.is_active ? 'bg-white border-purple-100' : 'bg-orange-50 border-orange-200'}`}>
                        {activeGroup.is_active && (
                            <>
                                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 to-indigo-600"></div>
                                <div className="absolute -right-10 -top-10 w-32 h-32 bg-purple-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
                            </>
                        )}

                        <div className="flex flex-col md:flex-row gap-6 relative z-10">
                            <div className="flex-grow">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${activeGroup.is_active ? 'bg-purple-100 text-purple-600' : 'bg-orange-100 text-orange-600'}`}>
                                        {activeGroup.is_active ? <Users size={24} /> : <AlertCircle size={24} />}
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-dark m-0">
                                            {activeGroup.is_active ? t('orders_page.active_group', "مجموعة الأضحية النشطة") : t('orders_page.group_pending_activation', "تفعيل المجموعة قيد الانتظار")}
                                        </h2>
                                        <p className="text-sm text-gray-500 m-0 mt-1">
                                            {t('orders_page.sacrifice', "الأضحية")}:
                                            <Link to={`/animal/${activeGroup.animal_details?.unique_id || activeGroup.animal_details?.id}`} state={{ isReadOnly: true }} className="text-primary hover:underline me-1">
                                                {activeGroup.animal_details?.category_name} (#{activeGroup.animal_details?.code})
                                            </Link>
                                            {groupOrderForDisplay && (
                                                <span className="me-2 text-white px-2 py-1 rounded text-xs" style={{ backgroundColor: '#6f42c1' }}>
                                                    {t('orders_page.associated_order', "الطلب التابع")}: #{groupOrderForDisplay.id}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                </div>

                                {!activeGroup.is_active ? (
                                    <div className="bg-white rounded-2xl p-5 border border-orange-200 text-center">
                                        <p className="text-gray-600 mb-4">
                                            {t('orders_page.group_pending_message', "لقد قمت بحجز المجموعة بنجاح، ولكن لم يتم سداد العربون بعد. يرجى الدفع لإصدار كود المشاركة وتفعيل المجموعة لأصدقائك.")}
                                        </p>
                                        {pendingGroupOrder ? (
                                            <Button
                                                variant="primary"
                                                onClick={() => handlePayRemaining(pendingGroupOrder)}
                                                isLoading={payingLoading}
                                                className="shadow-md"
                                            >
                                                <Wallet size={18} className="me-2" /> {t('orders_page.pay_deposit_now', "ادفع العربون الآن")}
                                            </Button>
                                        ) : (
                                            <span className="text-red-500 text-sm">{t('orders_page.group_order_missing', "الطلب الخاص بهذه المجموعة ملغي أو غير موجود.")}</span>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-4">
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div className="text-center sm:text-start">
                                                <span className="text-sm text-gray-500 block mb-1">{t('orders_page.invite_code', "كود الدعوة")}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-2xl font-black text-purple-600 tracking-wider font-mono">
                                                        {activeGroup.code}
                                                    </span>
                                                    <button
                                                        onClick={copyCode}
                                                        className="p-2 hover:bg-purple-100 rounded-full text-purple-500 transition-colors"
                                                        title={t('common.copy', "نسخ الكود")}
                                                        aria-label={t('common.copy', "نسخ الكود")}
                                                    >
                                                        <Copy size={18} />
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="w-full sm:w-1/2">
                                                <div className="flex justify-between text-xs font-bold mb-2">
                                                    <span className="text-gray-600">{t('orders_page.group_completion', "اكتمال المجموعة")}:</span>
                                                    <span className="text-purple-600">
                                                        {groupSoldShares} / {groupMaxShares}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-purple-200 rounded-full h-2.5 overflow-hidden">
                                                    <div
                                                        className="bg-purple-600 h-2.5 rounded-full transition-all duration-1000"
                                                        style={{ width: `${Math.max(5, groupProgressPercent)}%` }}
                                                    ></div>
                                                </div>
                                                <div className="mt-2 text-[10px] text-gray-400 flex items-start gap-1">
                                                    <Info size={12} className="mt-0.5" />
                                                    <span>{t('orders_page.group_expiry', "تنتهي المجموعة بعد 24 ساعة من بدايتها إذا لم تكتمل يتم تحويلها لمشاركة عامة")}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {activeGroup.is_active && (
                                <div className="md:w-1/3 border-t md:border-t-0 md:border-s border-gray-100 pt-4 md:pt-0 md:pr-6 mt-2 md:mt-0">
                                    <h3 className="text-sm font-bold text-dark mb-3 flex items-center gap-2">
                                        <Send size={16} className="text-purple-500" /> {t('orders_page.invite_friend', "دعوة صديق")}
                                    </h3>
                                    <form onSubmit={handleInvite} className="flex flex-col gap-2">
                                        <input
                                            type="tel"
                                            placeholder={t('orders_page.phone_placeholder', "رقم هاتف الصديق")}
                                            className="w-full px-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-sm"
                                            value={invitePhone}
                                            onChange={(e) => setInvitePhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                            pattern="01[0-9]{9}"
                                            maxLength="11"
                                            required
                                            aria-label={t('orders_page.phone_placeholder', "رقم هاتف الصديق")}
                                        />
                                        <button
                                            type="submit"
                                            disabled={inviting || !invitePhone.trim() || invitePhone.length !== 11}
                                            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            {inviting ? t('orders_page.sending', "جاري الإرسال...") : t('orders_page.send_invite', "إرسال الدعوة")}
                                        </button>
                                    </form>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <h1 className="text-2xl font-black text-dark mb-6 flex items-center gap-2">
                    <Package className="text-primary" /> {t('orders_page.title', "طلباتي")}
                </h1>

                <div className="flex bg-white p-1 rounded-2xl shadow-sm mb-6 w-full md:w-fit border border-gray-100">
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'orders' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        {t('orders_page.orders_tab', "الطلبات")} ({orders.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('requests')}
                        className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'requests' ? 'bg-primary text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}
                    >
                        {t('orders_page.requests_tab', "الطلبات الخاصة")} ({specialRequests.length})
                    </button>
                </div>

                {activeTab === 'orders' && (
                    <div className="space-y-4">
                        {orders.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border border-gray-100">
                                <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search className="text-gray-400" size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-dark mb-2">{t('orders_page.no_orders', "لا توجد طلبات")}</h3>
                                <Link to="/livestock" className="btn btn-primary inline-flex items-center gap-2">{t('orders_page.shop_now', "تسوق الآن")}</Link>
                            </div>
                        ) : (
                            <>
                                {orders.map((order) => (
                                    <div
                                        key={order.id}
                                        className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all group relative mb-4"
                                    >
                                        <LivePendingTimer order={order} onExpire={handleOrderExpire} />

                                        <div
                                            className="cursor-pointer"
                                            onClick={() => handleOpenDetails(order)}
                                        >
                                            <div className="flex flex-wrap justify-between items-start gap-4 mb-4 pb-4 border-b border-gray-50">
                                                <div>
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <h3 className="text-lg font-black text-dark group-hover:text-primary transition-colors">
                                                            {t('orders_page.order_num', "طلب #")}{order.id}
                                                        </h3>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                                                            {getStatusText(order.status)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                                        <Calendar size={14} />
                                                        {new Date(order.created_at).toLocaleDateString(i18n.language)}
                                                    </div>
                                                </div>
                                                <div className="text-end">
                                                    <div className="text-xl font-black text-primary" dir="ltr">
                                                        {parseFloat(order.total_price || 0).toLocaleString()} <span className="text-xs font-normal text-gray-500">{t('common.currency', "ج.م")}</span>
                                                    </div>

                                                    {order.status === 'canceled' ? (
                                                        <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1 mt-1 justify-end">
                                                            <XCircle size={12} /> {t('orders_page.canceled', 'تم الإلغاء')}
                                                        </span>
                                                    ) : parseFloat(order.remaining_amount || 0) > 0 ? (
                                                        <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded flex items-center gap-1 mt-1 justify-end">
                                                            <AlertCircle size={12} />
                                                            {t('orders_page.remaining', "المتبقي")}: {parseFloat(order.remaining_amount).toLocaleString()}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded flex items-center gap-1 mt-1 justify-end">
                                                            <CheckCircle size={12} /> {t('orders_page.fully_paid', "مدفوع بالكامل")}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center text-sm font-bold mt-2 pt-2 border-t border-gray-50">
                                                <div
                                                    className="text-primary flex items-center gap-1 hover:text-primary-dark"
                                                    onClick={(e) => { e.stopPropagation(); handleOpenDetails(order); }}
                                                >
                                                    <span>{t('orders_page.view_details', "عرض التفاصيل")}</span>
                                                    <ChevronLeft size={18} className={`transition-transform ${i18n.language === 'ar' ? 'group-hover:-translate-x-1' : 'rotate-180 group-hover:translate-x-1'}`} />
                                                </div>

                                                {order.status === 'pending' && (
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); requestCancelOrder(order); }}
                                                        className="text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors"
                                                    >
                                                        <XCircle size={16} />
                                                        {t('orders_page.cancel', 'إلغاء')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {hasMore && (
                                    <div className="text-center py-4">
                                        <button
                                            onClick={loadMoreOrders}
                                            disabled={loadingMore}
                                            className="btn btn-outline border-2 border-primary text-primary hover:bg-primary hover:text-white px-8 py-3 rounded-xl font-bold transition-all"
                                        >
                                            {loadingMore ? t('orders_page.loading', 'جاري التحميل...') : t('orders_page.load_more_orders', 'عرض المزيد من الطلبات')}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="space-y-4">
                        {specialRequests.length === 0 ? (
                            <div className="text-center py-12 bg-white rounded-3xl border border-gray-100">
                                <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Clock className="text-gray-400" size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-dark">{t('orders_page.no_requests', "لا توجد طلبات خاصة")}</h3>
                                <p className="text-gray-500 text-sm">{t('orders_page.no_requests_desc', "لم تقم بإرسال أي طلبات خاصة بعد")}</p>
                            </div>
                        ) : (
                            specialRequests.map(req => (
                                <div key={req.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-bold text-dark">{t('orders_page.special_request', "طلب خاص")}</h3>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(req.status)}`}>
                                                    {getStatusText(req.status)}
                                                </span>
                                            </div>
                                            <span className="text-xs text-gray-500 block mb-3">
                                                {new Date(req.created_at).toLocaleDateString(i18n.language)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4">
                                        <h6 className="text-xs font-bold text-gray-500 mb-2">{t('orders_page.requested_specs', "المواصفات المطلوبة")}:</h6>
                                        <ul className="text-sm space-y-1">
                                            {Object.entries(req.requested_specs || {}).map(([key, value]) => (
                                                value && (
                                                    <li key={key} className="flex gap-1">
                                                        <span className="text-primary font-bold">•</span>
                                                        <span className="font-medium">{t(`orders_page.specs.${key}`, key)}:</span> <span dir="ltr" className="ms-1">{typeof value === 'string' ? value.replace(/كجم|kg/gi, t('common.kg', 'kg')).replace(/جنيه|جنية|egp/gi, t('common.currency', 'EGP')) : value}</span>
                                                    </li>
                                                )
                                            ))}
                                        </ul>
                                    </div>

                                    {req.status === 'sourced' && req.sourced_animal_details && (
                                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 animate-fade-in-up">
                                            <div className="flex items-center gap-2 mb-2 text-green-800 font-bold">
                                                <CheckCircle size={18} /> {t('orders_page.request_sourced', "تم العثور على الأضحية")}
                                            </div>
                                            <p className="text-sm text-green-700 mb-3">{t('orders_page.request_sourced_desc', "وجدنا حيواناً يطابق مواصفاتك المطلوبة")}</p>

                                            <div className="flex items-center gap-3 bg-white p-3 rounded-lg border border-green-100">
                                                <img
                                                    src={req.sourced_animal_details.image || "/default-image.png"}
                                                    alt="animal"
                                                    className="w-16 h-16 rounded-lg object-cover"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = "/default-image.png";
                                                    }}
                                                />
                                                <div className="flex-grow">
                                                    <div className="font-bold text-dark">
                                                        {req.sourced_animal_details.category_name} #{req.sourced_animal_details.code}
                                                    </div>
                                                    <div className="text-primary font-bold text-sm" dir="ltr">
                                                        {parseFloat(req.sourced_animal_details.price_after_discount || req.sourced_animal_details.price_egp || 0).toLocaleString()} {t('common.currency', "ج.م")}
                                                    </div>
                                                </div>
                                                <Link
                                                    to={`/animal/${req.sourced_animal_details.unique_id}`}
                                                    className="btn bg-green-600 hover:bg-green-700 text-white text-xs px-4 py-2 rounded-lg"
                                                >
                                                    {t('orders_page.buy', "شراء")}
                                                </Link>
                                            </div>
                                        </div>
                                    )}

                                    {req.status === 'pending' && (
                                        <div className="flex items-center gap-2 text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                                            <Clock size={16} /> {t('orders_page.request_pending', "جاري البحث عن الأضحية المناسبة...")}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

            </div>

            <Modal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                title={`${t('orders_page.order_details', "تفاصيل الطلب")} #${selectedOrder?.id}`}
                size="lg"
            >
                {selectedOrder && (
                    <div className="pt-0">

                        <div className={`p-4 rounded-2xl border flex flex-col md:flex-row justify-between items-center gap-4 mb-4 ${getStatusColor(selectedOrder.status)}`}>
                            <div className="flex items-center gap-3">
                                <div className="bg-white/50 p-2 rounded-full">
                                    <Package size={24} />
                                </div>
                                <div>
                                    <div className="text-sm opacity-80">{t('orders_page.order_status', "حالة الطلب")}</div>
                                    <div className="font-bold text-lg">{getStatusText(selectedOrder.status)}</div>
                                </div>
                            </div>
                            <div className="text-center md:text-end w-full md:w-auto bg-white/40 px-4 py-2 rounded-xl">
                                <div className="text-sm opacity-80 mb-1">{t('orders_page.order_date', "تاريخ الطلب")}</div>
                                <div className="font-bold text-dark inline-block" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
                                    {new Date(selectedOrder.created_at).toLocaleDateString(i18n.language === 'ar' ? 'en-US' : 'en-US', {
                                        year: 'numeric',
                                        month: '2-digit',
                                        day: '2-digit',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        hour12: true
                                    }).replace(/(\d+)\/(\d+)\/(\d+)/, '$3/$1/$2')}
                                </div>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-dark mb-4 flex items-center gap-2">
                                <ShoppingBag size={20} className="text-primary" /> {t('orders_page.products_services', "المنتجات والخدمات")}
                            </h3>
                            <div className="space-y-4">
                                {selectedOrder.items.map((item, idx) => (
                                    <div key={idx} className="bg-white p-0 rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                                        <div className="flex flex-col md:flex-row gap-3 p-3 bg-gray-50 border-b border-gray-200">
                                            <div className="shrink-0 mx-auto md:mx-0">
                                                <img
                                                    src={item.animal?.image || "/default-image.png"}
                                                    className="w-24 h-24 md:w-20 md:h-20 rounded-xl object-cover bg-white shadow-sm border"
                                                    alt="animal"
                                                    onError={(e) => { e.target.onerror = null; e.target.src = "/default-image.png"; }}
                                                />
                                            </div>
                                            <div className="flex-grow text-center md:text-start">
                                                <div className="font-bold text-dark text-lg mb-1">
                                                    <Link
                                                        to={`/animal/${item.animal?.unique_id || item.animal?.id}`}
                                                        state={{ isReadOnly: true, itemToEdit: item }}
                                                        className="text-primary hover:text-primary-dark transition-colors inline-flex items-center gap-1 no-underline"
                                                    >
                                                        {item.animal?.category_name} #{item.animal?.code || item.animal_code}
                                                        <Eye size={14} />
                                                    </Link>
                                                </div>
                                                <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-2">
                                                    {item.animal?.sex && <span className="mx-1 px-2 py-1 rounded bg-gray-100 text-dark border text-xs">{t('orders_page.type', "النوع:")} {item.animal.sex === 'male' ? t('orders_page.male', 'ذكر') : t('orders_page.female', 'أنثى')}</span>}
                                                    {item.animal?.age_months && <span className="mx-1 px-2 py-1 rounded bg-gray-100 text-dark border text-xs">{t('orders_page.age', "العمر:")} {item.animal.age_months} {t('orders_page.month_s', "شهر")}</span>}
                                                    {selectedOrder.order_type_label && <span className="mx-1 px-2 py-1 rounded bg-gray-500 text-white font-normal text-xs">{translateOrderType(selectedOrder.order_type_label)}</span>}
                                                    {item.share_quantity > 1 && <span className="mx-1 px-2 py-1 rounded text-white text-xs" style={{ backgroundColor: '#6f42c1' }}>{item.share_quantity} {t('orders_page.shares', "أسهم")}</span>}
                                                </div>

                                                {item.actual_weight ? (
                                                    <div className="bg-blue-50 border border-blue-100 p-2 rounded text-blue-800 text-xs font-bold inline-block">
                                                        ⚖️ {t('orders_page.actual_weight_received', "الوزن الفعلي المستلم:")} {item.actual_weight} {t('orders_page.kg', "كجم")}
                                                        <span className="text-gray-500 block mt-1" style={{ fontSize: '10px' }}>{t('orders_page.was_estimated', "(كان تقديرياً:")} {item.original_weight || 0} {t('orders_page.kg', "كجم")})</span>
                                                    </div>
                                                ) : (
                                                    item.original_weight && (
                                                        <div className="text-gray-500 text-xs bg-gray-50 border px-2 py-1 rounded inline-block">
                                                            {t('orders_page.estimated_weight', "الوزن التقديري:")} {item.original_weight} {t('orders_page.kg', "كجم")}
                                                        </div>
                                                    )
                                                )}
                                            </div>
                                            <div className="text-center md:text-end flex flex-col justify-center border-t md:border-0 pt-2 md:pt-0 mt-2 md:mt-0">
                                                {item.original_price && item.original_price !== item.price_per_item && (
                                                    <div className="text-gray-500 line-through text-xs" dir="ltr">
                                                        {parseFloat(item.original_price).toFixed(2)}
                                                    </div>
                                                )}
                                                <div className="font-black text-primary text-2xl" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
                                                    {parseFloat(item.price_per_item || 0).toLocaleString()} <span className="text-sm text-gray-500">{t('common.currency', "ج.م")}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-3">
                                            <div className="flex flex-col md:flex-row gap-3">
                                                <div className="w-full md:w-2/3">
                                                    <h6 className="font-bold text-dark text-sm mb-2">{t('orders_page.requested_services', "الخدمات المطلوبة:")}</h6>
                                                    <div className="flex flex-wrap gap-2 mb-2">
                                                        <span className="px-2 py-1 bg-gray-50 text-dark border rounded text-xs">
                                                            {t('orders_page.source', "المصدر:")} {item.animal?.source_farm ? t('orders_page.trusted_farms', 'مزارع موثوقة') : t('orders_page.our_farms', 'مزارعنا')}
                                                        </span>
                                                        {item.selected_services && Object.keys(item.selected_services).map(k => {
                                                            if (k.startsWith('_') || ['is_group_creator', 'payment_type', 'user_entered_deposit_amount', 'butcher_notes', 'extra_parts_preference'].includes(k)) return null;
                                                            if (item.selected_services[k] === true || item.selected_services[k] === 'yes') {
                                                                return <span key={k} className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded text-xs">✓ {t(`services.${k}`, k)}</span>;
                                                            }
                                                            return null;
                                                        })}
                                                    </div>

                                                    {(() => {
                                                        const context = item.selected_services?._order_context || 'general';
                                                        const isShareMode = ['shares', 'adahi_pool', 'adahi_group'].includes(context);
                                                        const hasExtraParts = item.extra_parts_preference_display && isShareMode;
                                                        const hasNotes = item.selected_services?.butcher_notes;

                                                        if (hasExtraParts || hasNotes) {
                                                            return (
                                                                <div className="bg-gray-50 p-2 rounded text-xs text-gray-500 border mt-2">
                                                                    {hasExtraParts && (
                                                                        <div className="mb-1"><strong className="text-dark">{t('orders_page.extra_parts_fate', "مصير الأجزاء الإضافية:")}</strong> {item.extra_parts_preference_display}</div>
                                                                    )}
                                                                    {hasNotes && (
                                                                        <div><strong className="text-dark">{t('orders_page.butcher_notes', "ملاحظات الجزار:")}</strong> {item.selected_services.butcher_notes}</div>
                                                                    )}
                                                                </div>
                                                            );
                                                        }
                                                        return null;
                                                    })()}

                                                    {item.request_slaughter_video && (
                                                        <div className="bg-danger bg-opacity-10 p-2 rounded text-xs border border-danger mt-2 d-flex align-items-center justify-content-between">
                                                            <strong className="text-danger">🎥 طلب تصوير فيديو للذبح</strong>
                                                            {item.slaughter_video ? (
                                                                <a href={item.slaughter_video} target="_blank" rel="noreferrer" className="bg-danger text-white px-2 py-1 rounded text-decoration-none fw-bold">
                                                                    مشاهدة الفيديو
                                                                </a>
                                                            ) : (
                                                                <span className="text-muted">جاري التجهيز...</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="w-full md:w-1/3 flex flex-col justify-center md:items-end border-t md:border-t-0 md:border-s md:ps-3 mt-3 md:mt-0 pt-3 md:pt-0 border-gray-100">
                                                    <div className="text-gray-500 text-xs mb-1 text-center md:text-end w-full">{t('orders_page.extra_services_cost', "تكلفة الخدمات الإضافية")}</div>
                                                    <div className="font-bold text-dark text-xl text-center md:text-end w-full" dir="ltr" style={{ unicodeBidi: 'isolate' }}>
                                                        +{parseFloat(item.service_cost || 0).toLocaleString()} <span className="text-sm text-gray-500">{t('common.currency', "ج.م")}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                            <div className="border border-blue-100 rounded-2xl overflow-hidden mt-5">
                                <div className="bg-blue-50 p-3 border-b border-blue-100">
                                    <h4 className="font-bold text-blue-900 text-sm mb-0 flex items-center gap-2">
                                        <Wallet size={16}/> سجل المدفوعات لهذا الطلب
                                    </h4>
                                </div>
                                <div className="p-0 overflow-x-auto">
                                    <table className="w-full text-sm text-center">
                                        <thead className="bg-gray-50 text-gray-500">
                                            <tr>
                                                <th className="p-2">التاريخ</th>
                                                <th className="p-2">المبلغ</th>
                                                <th className="p-2">الطريقة</th>
                                                <th className="p-2">الحالة</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {selectedOrder.payments.map((p, i) => {
                                                const isManual = p.transaction_id && p.transaction_id.startsWith('MANUAL-');
                                                const isPOS = p.transaction_id && p.transaction_id.startsWith('POS-');
                                                const isLink = p.payment_method === 'paymob_link' || p.payment_method.includes('رابط');
                                                const isPendingLink = isLink && p.status === 'pending';

                                                let sourceText = 'المتجر الإلكتروني';
                                                let sourceBadge = 'secondary';
                                                let methodText = p.payment_method;

                                                if (isManual) {
                                                    sourceText = p.recorded_by_name ? `موظف: ${p.recorded_by_name}` : 'تسجيل يدوي (موظف)';
                                                    sourceBadge = 'warning';
                                                } else if (isPOS) {
                                                    sourceText = 'نقطة البيع (كاشير)';
                                                    sourceBadge = 'info';
                                                } else if (isLink) {
                                                    sourceText = 'رابط دفع خارجي (SMS)';
                                                    sourceBadge = 'warning';
                                                } else if (p.payment_method === 'paymob') {
                                                    sourceText = 'المتجر الإلكتروني';
                                                    sourceBadge = 'primary';
                                                }

                                                if (isPendingLink) {
                                                    methodText = 'رابط قيد الانتظار...';
                                                } else if (p.payment_method === 'cash') {
                                                    methodText = 'كاش نقدي';
                                                } else if (p.payment_method === 'pos') {
                                                    methodText = 'ماكينة POS';
                                                } else if (p.payment_method === 'bank_transfer') {
                                                    methodText = 'تحويل بنكي';
                                                } else if (p.payment_method === 'paymob') {
                                                    methodText = 'أونلاين (المتجر)';
                                                }

                                                return (
                                                    <tr key={i}>
                                                        <td className="p-2" dir="ltr">
                                                            {new Date(p.created_at).toLocaleDateString()}
                                                        </td>
                                                        <td className="p-2 font-bold text-success">
                                                            {parseFloat(p.amount).toFixed(2)} ج
                                                        </td>
                                                        <td className="p-2 text-wrap" style={{ maxWidth: '150px' }}>
                                                            <span className={`badge bg-${sourceBadge} me-1`}>{sourceText}</span>
                                                            <br />
                                                            {methodText}
                                                        </td>
                                                        <td className="p-2">
                                                            <span className={`px-2 py-0.5 rounded text-[10px] text-white ${p.status === 'completed' ? 'bg-green-500' : p.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`}>
                                                                {p.status === 'completed' ? 'مكتمل' : p.status === 'failed' ? 'فشل' : 'معلق'}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="border border-gray-100 rounded-2xl overflow-hidden mt-4">
                            <div className="bg-gray-50 p-4 border-b border-gray-100">
                                <h4 className="font-bold text-dark text-sm">{t('orders_page.payment_details', "التسوية المالية")}</h4>
                            </div>
                            <div className="p-4 space-y-3">
                                {(() => {
                                    const totalAnimalsPrice = selectedOrder.items.reduce((sum, item) => sum + (parseFloat(item.original_price || item.price_per_item || 0) * (item.share_quantity || 1)), 0);
                                    const totalItemsServices = parseFloat(selectedOrder.total_items_services || 0);
                                    const deliveryFee = parseFloat(selectedOrder.delivery_fee || 0);
                                    const discountAmount = parseFloat(selectedOrder.applied_discount_amount || 0);
                                    const totalOrderPrice = parseFloat(selectedOrder.total_price || 0);

                                    return (
                                        <>
                                            <div className="flex justify-between items-center text-sm mb-1">
                                                <span className="text-gray-600">{t('orders_page.total_animal_price', "المشتريات والخدمات:")}</span>
                                                <span className="font-bold text-dark" dir="ltr">
                                                    {(totalAnimalsPrice + totalItemsServices).toLocaleString()} {t('common.currency', 'ج.م')}
                                                </span>
                                            </div>

                                            {deliveryFee > 0 && (
                                                <div className="flex justify-between items-center text-sm mb-1 text-orange-600">
                                                    <span>{t('orders_page.delivery_cost', "رسوم التوصيل:")}</span>
                                                    <span className="font-bold" dir="ltr">
                                                        +{deliveryFee.toLocaleString()} {t('common.currency', 'ج.م')}
                                                    </span>
                                                </div>
                                            )}

                                            {discountAmount > 0 && (
                                                <div className="flex justify-between items-center text-sm mb-1 text-red-500 bg-red-50 px-2 py-1 rounded">
                                                    <span className="flex items-center gap-1"><Tag size={14}/> قسيمة خصم (Voucher):</span>
                                                    <span className="font-bold" dir="ltr">
                                                        -{discountAmount.toLocaleString()} {t('common.currency', 'ج.م')}
                                                    </span>
                                                </div>
                                            )}

                                            <hr className="my-2" />

                                            <div className="flex justify-between items-center mb-3">
                                                <span className="text-gray-800 font-bold">{t('orders_page.total_order', "الإجمالي الكلي")}</span>
                                                <span className="font-black text-primary fs-5" dir="ltr">
                                                    {totalOrderPrice.toLocaleString()} {t('common.currency', 'ج.م')}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center text-green-700 bg-green-50 p-2 rounded-lg mt-2">
                                                <span className="font-medium">{t('orders_page.amount_paid', "تم دفعه (عربون/أقساط)")}</span>
                                                <span className="font-bold" dir="ltr">
                                                    {parseFloat(selectedOrder.deposit_total || 0).toLocaleString()} {t('common.currency', 'ج.م')}
                                                </span>
                                            </div>

                                            <div className="flex justify-between items-center text-red-700 bg-red-50 p-2 rounded-lg mt-2">
                                                <span className="font-medium">{t('orders_page.remaining_at_delivery', "المتبقي (يُدفع عند الاستلام)")}</span>
                                                <span className="font-bold" dir="ltr">
                                                    {parseFloat(selectedOrder.remaining_amount || 0).toLocaleString()} {t('common.currency', 'ج.م')}
                                                </span>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-sm text-blue-800 mt-4">
                            <div className="flex items-center gap-2 mb-2 font-bold">
                                <Truck size={18} /> {t('orders_page.delivery_details', "تفاصيل التوصيل")}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                                <div>
                                    <span className="opacity-70 block text-xs">{t('orders_page.delivery_method', "طريقة التوصيل")}:</span>
                                    <strong>{selectedOrder.delivery_type === 'delivery' ? t('orders_page.home_delivery', "توصيل للمنزل") : t('orders_page.farm_pickup', "استلام من المزرعة")}</strong>
                                </div>
                                {selectedOrder.delivery_date && (
                                    <div>
                                        <span className="opacity-70 block text-xs">{t('orders_page.delivery_date', "تاريخ التوصيل")}:</span>
                                        <strong dir="ltr">{selectedOrder.delivery_date}</strong>
                                    </div>
                                )}
                                {selectedOrder.delivery_address_text && (
                                    <div className="col-span-full">
                                        <span className="opacity-70 block text-xs">{t('orders_page.address', "العنوان")}:</span>
                                        <strong>{selectedOrder.delivery_address_text}</strong>
                                    </div>
                                )}
                            </div>
                        </div>

                        {selectedOrder.status === 'canceled' ? (
                            <div className="bg-gray-100 text-gray-600 p-3 rounded-xl text-center font-bold flex items-center justify-center gap-2 mt-4">
                                <XCircle size={20} /> {t('orders_page.order_canceled', 'تم إلغاء هذا الطلب')}
                            </div>
                        ) : parseFloat(selectedOrder.remaining_amount || 0) > 0 ? (
                            <div className="pt-3 border-t border-gray-100 mt-4">
                                <h5 className="font-bold text-dark mb-3">{t('orders_page.electronic_payment_options', 'خيارات الدفع الإلكتروني')}</h5>

                                {selectedOrder.status === 'pending' && (
                                    <p className="text-sm text-red-600 mb-3 font-bold">
                                        {t('orders_page.payment_reminder', '⚠️ تذكير: يجب دفع العربون أو المبلغ كاملاً لتأكيد الطلب قبل مرور 15 دقيقة من وقت الإنشاء.')}
                                    </p>
                                )}

                                <div className="flex gap-2 mb-3">
                                    <Button
                                        variant={paymentMode === 'full' ? 'primary' : 'secondary'}
                                        className="flex-1 text-sm py-2"
                                        onClick={() => setPaymentMode('full')}
                                    >
                                        {t('orders_page.pay_full_amount', 'دفع المبلغ كاملاً')}
                                    </Button>
                                    {selectedOrder.items?.some(item => item.animal?.category?.allow_deposit !== false) && parseFloat(selectedOrder.min_deposit_required || 0) < parseFloat(selectedOrder.remaining_amount) && (
                                    <Button
                                        variant={paymentMode === 'custom' ? 'primary' : 'secondary'}
                                        className="flex-1 text-sm py-2"
                                        onClick={() => setPaymentMode('custom')}
                                    >
                                        {t('orders_page.pay_deposit_part', 'دفع عربون / جزء')}
                                    </Button>
                                    )}
                                </div>

                                {paymentMode === 'custom' && (() => {
                                    const isFirstPayment = parseFloat(selectedOrder.deposit_total || 0) <= 0;
                                    const minRequired = isFirstPayment ? parseFloat(selectedOrder.min_deposit_required || 1) : 1;

                                    return (
                                        <div className="mb-3 animate-fade-in-up">
                                            <input
                                                type="number"
                                                placeholder={`${t('orders_page.enter_amount_min', 'أدخل المبلغ (الحد الأدنى')} ${minRequired} ${t('common.currency', 'ج.م')})`}
                                                value={customAmount}
                                                onChange={(e) => setCustomAmount(e.target.value)}
                                                min={minRequired}
                                                max={selectedOrder.remaining_amount}
                                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                                dir="ltr"
                                            />
                                            <small className="text-gray-500 mt-1 block">
                                                {isFirstPayment ? <span className="text-red-500 font-bold block mb-1">{t('product.min_deposit', 'الحد الأدنى')}: {minRequired.toFixed(2)} {t('common.currency', 'ج.م')}</span> : null}
                                                {t('orders_page.amount_must_not_exceed', 'يجب ألا يتجاوز المبلغ المتبقي')} ({parseFloat(selectedOrder.remaining_amount).toFixed(2)} {t('common.currency', 'ج.م')})
                                            </small>
                                        </div>
                                    );
                                })()}

                                <Button
                                    variant="primary"
                                    onClick={() => handlePayRemaining()}
                                    isLoading={payingLoading}
                                    className="w-full shadow-lg hover:shadow-xl hover:-translate-y-1 text-lg py-3 mt-2 flex items-center justify-center gap-2"
                                    disabled={
                                        paymentMode === 'custom' &&
                                        (
                                            !customAmount ||
                                            parseFloat(customAmount) < (parseFloat(selectedOrder.deposit_total || 0) <= 0 ? parseFloat(selectedOrder.min_deposit_required || 1) : 1) ||
                                            parseFloat(customAmount) > parseFloat(selectedOrder.remaining_amount)
                                        )
                                    }
                                >
                                    <CreditCard size={20} />
                                    {t('orders_page.pay_now', "ادفع الآن")} ({(paymentMode === 'full' ? parseFloat(selectedOrder.remaining_amount) : parseFloat(customAmount) || 0).toLocaleString()} {t('common.currency', 'ج.م')})
                                </Button>

                                {selectedOrder.status === 'pending' && (
                                    <Button
                                        variant="danger"
                                        onClick={() => {
                                            setShowDetailsModal(false);
                                            requestCancelOrder(selectedOrder);
                                        }}
                                        className="mt-3 shadow-sm hover:shadow-md transition-all py-3 w-full flex items-center justify-center gap-2"
                                    >
                                        <XCircle size={20} className="me-2" />
                                        {t('orders_page.cancel_order_release', 'إلغاء الطلب (تحرير الماشية)')}
                                    </Button>
                                )}
                            </div>
                        ) : (
                            <div className="bg-green-100 text-green-800 p-3 rounded-xl text-center font-bold flex items-center justify-center gap-2 mt-4">
                                <CheckCircle size={20} /> {t('orders_page.fully_paid_confirmation', 'تم دفع الطلب بالكامل')}
                            </div>
                        )}
                    </div>
                )}
            </Modal>

            <ConfirmModal
                isOpen={!!orderToCancel}
                onClose={() => setOrderToCancel(null)}
                onConfirm={confirmCancelOrder}
                title={t('orders_page.cancel_order_title', 'إلغاء الطلب')}
                message={`${t('orders_page.cancel_order_confirm', 'هل أنت متأكد أنك تريد إلغاء الطلب رقم #')}${orderToCancel?.id}${t('orders_page.cancel_order_consequence', '؟ سيتم تحرير الماشية وإرجاعها للمتجر.')}`}
                confirmText={t('orders_page.yes_cancel', 'نعم، قم بالإلغاء')}
                icon="cancel"
            />
        </div>
    );
}

export default MyOrders;

