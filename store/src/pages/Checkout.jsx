import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../context/auth/useAuth';
import { useApp } from '../context/app/useApp';
import { toast } from 'react-toastify';
import axios from '../services/axiosConfig';
import {
    Truck, Store, MapPin, Calendar, CreditCard,
    CheckCircle, ArrowRight, ArrowLeft, Loader, Wallet, Info, Clock, AlertTriangle,
    ShoppingBag, Tag
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

const Checkout = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const navigate = useNavigate();
    const { user } = useAuth();
    const { triggerRefetch, pendingOrder } = useApp();

    const formatDateWithDay = useCallback((dateString) => {
        if (!dateString) return '';
        const dateObj = new Date(dateString);
        const days = [
            t('common.days.sunday', 'الأحد'),
            t('common.days.monday', 'الإثنين'),
            t('common.days.tuesday', 'الثلاثاء'),
            t('common.days.wednesday', 'الأربعاء'),
            t('common.days.thursday', 'الخميس'),
            t('common.days.friday', 'الجمعة'),
            t('common.days.saturday', 'السبت')
        ];
        const dayName = days[dateObj.getDay()];
        return `${dayName} ${t('common.corresponding_to', 'الموافق')} ${dateString}`;
    }, [t]);

    const [step, setStep] = useState(1);
    const [isRedirecting, setIsRedirecting] = useState(false);
    const [cart, setCart] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [deliveryAreas, setDeliveryAreas] = useState([]);
    const [opSettings, setOpSettings] = useState(null);
    const [deliveryOption, setDeliveryOption] = useState('to_home');
    const [availableDates, setAvailableDates] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [dailyLimitError, setDailyLimitError] = useState('');

    const paymentMethod = 'paymob';
    const [paymentType, setPaymentType] = useState('deposit');

    const displayTotal = useMemo(() => {
        if (!cart) return 0;
        let total = parseFloat(cart.cart_totals?.total_price || cart.total_price || 0);
        if (total === 0 && cart.items?.length > 0) {
            total = cart.items.reduce((sum, item) => {
                const price = parseFloat(
                    item.calculated_details?.final_price ||
                    item.price_per_item ||
                    0
                );
                return sum + price;
            }, 0);
        }
        return total;
    }, [cart]);

    const deliveryDetails = useMemo(() => {
        if (deliveryOption !== 'to_home' || !selectedAddressId) return { baseFee: 0, extraFee: 0, totalFee: 0, gov: '' };

        const address = addresses.find(a => String(a.id) === String(selectedAddressId));
        if (!address) return { baseFee: 0, extraFee: 0, totalFee: 0, gov: '' };

        const area = deliveryAreas.find(a =>
            a.governorate_name === address.governorate ||
            a.governorate_name_ar === address.governorate ||
            a.governorate?.name_ar === address.governorate
        );

        let baseFee = area ? parseFloat(area.delivery_price || 0) : 0;
        let extraFee = 0;

        if (cart && cart.items) {
            cart.items.forEach(item => {
                const catExtraFee = parseFloat(item.animal?.extra_delivery_fee || 0);
                const context = item.selected_services?._order_context || 'general';
                const isFullSale = item.pipeline === 'M' || ['general', 'adahi', 'adahi_full'].includes(context);
                if (isFullSale) {
                    extraFee += catExtraFee;
                } else {
                    const maxShares = parseFloat(item.animal?.default_max_shares || item.animal?.max_shares || 1);
                    const shares = parseFloat(item.share_quantity || 1);
                    extraFee += catExtraFee * (shares / maxShares);
                }
            });
        }

        return {
            baseFee,
            extraFee,
            totalFee: baseFee + extraFee,
            gov: address.governorate
        };
    }, [deliveryOption, selectedAddressId, addresses, deliveryAreas, cart]);

    const deliveryFee = deliveryDetails.totalFee;

    const finalOrderTotal = useMemo(() => {
        return displayTotal + deliveryFee;
    }, [displayTotal, deliveryFee]);

    const finalDepositToPay = useMemo(() => {
        if (paymentType === 'full') return finalOrderTotal;
        const baseDeposit = parseFloat(cart?.deposit_total || 0);
        return baseDeposit > 0 ? Math.min(baseDeposit + deliveryFee, finalOrderTotal) : 0;
    },[cart?.deposit_total, deliveryFee, paymentType, finalOrderTotal]);

    const finalRemaining = Math.max(0, finalOrderTotal - finalDepositToPay);

    const isSharePurchase = useMemo(() => {
        if (!cart?.items) return false;
        return cart.items.some(item => {
            const context = item.selected_services?._order_context || 'general';
            const maxShares = item.animal?.default_max_shares || item.animal?.max_shares || 1;
            return ['shares', 'adahi_pool', 'adahi_group'].includes(context) && item.share_quantity < maxShares;
        });
    }, [cart]);

    const discountAmount = useMemo(() => {
        if (!cart?.items) return 0;
        const totalOriginal = cart.items.reduce((sum, item) => {
            const price = parseFloat(item.animal?.price_egp || 0);
            const maxShares = parseFloat(item.animal?.max_shares || 1);
            const shares = parseFloat(item.share_quantity || 1);
            return sum + (price / (maxShares || 1)) * shares;
        }, 0);
        const totalFinalAnimals = cart.items.reduce((sum, item) => sum + parseFloat(item.calculated_details?.animal_base_price || 0), 0);
        return Math.max(0, totalOriginal - totalFinalAnimals);
    }, [cart]);

    const fetchInitialData = useCallback(async () => {
        setLoading(true);
        try {
            const [cartRes, addressesRes, opRes, areasRes] = await Promise.all([
                axios.get('/cart/'),
                axios.get('/accounts/addresses/'),
                axios.get('/core/public-operation-settings/'),
                axios.get('/livestock/delivery-areas/')
            ]);

            if (cartRes.status === 200 && cartRes.data) {
                const serverData = cartRes.data;
                let calculatedDepositTotal = 0;
                let finalTotal = parseFloat(serverData.cart_totals?.total_price || 0);

                if (serverData.items?.length > 0) {
                    serverData.items.forEach(item => {
                        const itemFinalPrice = parseFloat(item.calculated_details?.final_price || item.price_per_item || 0);
                        const paymentType = item.selected_services?.payment_type || item.payment_type;
                        const userDeposit = parseFloat(item.selected_services?.user_entered_deposit_amount || item.user_entered_deposit_amount || 0);

                        if (paymentType === 'deposit' && userDeposit > 0) {
                            calculatedDepositTotal += userDeposit;
                        } else {
                            calculatedDepositTotal += itemFinalPrice;
                        }
                    });
                    if (finalTotal === 0) {
                        finalTotal = serverData.items.reduce((sum, item) => sum + parseFloat(item.calculated_details?.final_price || item.price_per_item || 0), 0);
                    }
                }

                serverData.deposit_total = calculatedDepositTotal.toFixed(2);
                if (!serverData.cart_totals) serverData.cart_totals = {};
                serverData.cart_totals.total_price = finalTotal;

                setCart(serverData);
            }

            if (addressesRes.status === 200 && addressesRes.data?.results) {
                const userAddresses = addressesRes.data.results;
                setAddresses(userAddresses);
                const defaultAddress = userAddresses.find(a => a.is_default);
                if (defaultAddress) {
                    setSelectedAddressId(String(defaultAddress.id));
                } else if (userAddresses.length > 0) {
                    setSelectedAddressId(String(userAddresses[0].id));
                }
            }

            if (opRes.status === 200) {
                setOpSettings(opRes.data);
                if (!opRes.data.delivery_active && opRes.data.pickup_active) {
                    setDeliveryOption('pickup');
                } else if (!opRes.data.pickup_active && opRes.data.delivery_active) {
                    setDeliveryOption('to_home');
                }
            }

            if (areasRes.status === 200 && areasRes.data) {
                setDeliveryAreas(areasRes.data.results || areasRes.data || []);
            }
        } catch (error) {
            console.error('Fetch initial data error:', error);
            toast.error(t('checkout.load_error', 'فشل تحميل بيانات السلة'));
            navigate('/cart');
        } finally {
            setLoading(false);
        }
    }, [navigate, t]);

    useEffect(() => {
        const fetchDates = async () => {
            try {
                const itemsPayload = cart?.items?.map(item => ({
                    category_id: item.animal?.category?.id || item.animal?.category_id,
                    share_quantity: item.share_quantity || 1,
                    max_shares: item.animal?.category?.default_max_shares || 1,
                    services: item.selected_services || {}
                })) || [];

                const datesRes = await axios.post('/livestock/available-dates/', {
                    option: deliveryOption,
                    items: itemsPayload
                });

                if (datesRes.status === 200 && datesRes.data) {
                    setAvailableDates(datesRes.data);
                }
                setSelectedDate('');
            } catch (error) {
                console.error('Fetch dates error:', error);
                setAvailableDates([]);
            }
        };

        if (deliveryOption && cart) {
            fetchDates();
        }
    }, [deliveryOption, cart]);

    useEffect(() => {
        if (user?.id) {
            fetchInitialData();
        } else {
            navigate('/login', { replace: true });
        }
    }, [user, fetchInitialData, navigate]);

    const getSelectedAddress = () => {
        return addresses.find(a => String(a.id) === selectedAddressId);
    };

    const getOrderContextLabel = useCallback((context) => {
        const cleanContext = (context || '').trim();
        const contextMap = {
          'general': t('cart.general_purchase', 'شراء عام'),
          'adahi': t('cart.sacrifice', 'أضحية'),
          'adahi_pool': t('cart.adahi_share', 'مشاركة أضاحي'),
          'shares': t('cart.meat_share', 'مشاركة لحم'),
          'adahi_group': t('cart.private_group', 'مجموعة خاصة')
        };
        return contextMap[cleanContext] || cleanContext;
    }, [t]);

    const handleSubmitDetails = (e) => {
        e.preventDefault();
        setError('');
        setDailyLimitError('');

        if (!user?.id) {
            navigate('/login');
            return;
        }

        if (deliveryOption === 'to_home') {
            if (!selectedAddressId) {
                setError(t('checkout.address_required', 'يرجى اختيار عنوان التوصيل.'));
                return;
            }
            const selectedAddrObj = getSelectedAddress();
            if (selectedAddrObj && opSettings?.active_governorates) {
                if (!opSettings.active_governorates.includes(selectedAddrObj.governorate)) {
                    setError(`${t('checkout.delivery_not_available_gov')} (${selectedAddrObj.governorate}). ${t('checkout.supported_govs')} ${opSettings.active_governorates.join('، ')}`);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    return;
                }
            }
        }

        if (availableDates.length > 0 && !selectedDate && !isSharePurchase) {
            setError(t('checkout.date_required', 'يرجى اختيار موعد التسليم.'));
            return;
        }

        setStep(2);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleConfirmOrder = async () => {
        setSubmitting(true);
        setError('');
        setDailyLimitError('');

        try {
            const itemsPrefs = {};
            const itemsServices = {};

            if (cart?.items) {
                cart.items.forEach(item => {
                    if (item.animal?.id) {
                        const animalId = String(item.animal.id);
                        if (item.extra_parts_preference) {
                            itemsPrefs[animalId] = item.extra_parts_preference;
                        }
                        if (item.selected_services) {
                            itemsServices[animalId] = item.selected_services;
                        }
                    }
                });
            }

            const payload = {
                delivery_type: deliveryOption === 'to_home' ? 'delivery' : 'pickup',
                delivery_date: selectedDate || null,
                payment_method: paymentMethod,
                payment_type: paymentType,
                delivery_address_id: deliveryOption === 'to_home' ? selectedAddressId : null,
                ...(Object.keys(itemsPrefs).length > 0 && { items_prefs: itemsPrefs }),
                ...(Object.keys(itemsServices).length > 0 && { items_services: itemsServices })
            };

            const response = await axios.post('/orders/list/checkout/', payload);

            if (response.status === 200 || response.status === 201) {
                toast.success(t('checkout.order_success', 'تم تسجيل طلبك بنجاح!'));
                triggerRefetch();

                if (user?.id) localStorage.removeItem(`userCart_${user.id}`);
                localStorage.removeItem('guestCart');

                if (response.data?.payment_url) {
                    setIsRedirecting(true);
                    window.location.href = response.data.payment_url;
                } else {
                    navigate('/my-orders', { replace: true });
                }
            }
        } catch (err) {
            console.error('Order confirmation error:', err);
            const errorData = err.response?.data;

            if (errorData?.error_code === 'daily_limit_exceeded') {
                setDailyLimitError(errorData.detail);
                setError('');
                setStep(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const errorMessage = errorData?.detail || t('checkout.order_failed', 'فشل تأكيد الطلب، يرجى المحاولة لاحقاً.');
                setError(errorMessage);
                toast.error(errorMessage);
                setStep(1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }

            if (err.response?.status === 401) {
                navigate('/login', { replace: true });
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col justify-center items-center h-[60vh]" role="status">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
                <p className="text-muted font-bold">{t('checkout.loading', 'جاري التجهيز لإتمام الطلب...')}</p>
            </div>
        );
    }

    if (pendingOrder && !isRedirecting) {
        return (
            <div className="container mx-auto px-4 py-20 text-center animate-fade-in-up">
                <div className="bg-red-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-white shadow-sm">
                    <AlertTriangle size={48} className="text-red-500" />
                </div>
                <h3 className="text-2xl font-black text-dark mb-4">{t('checkout.cannot_complete_order', 'لا يمكنك إتمام هذا الطلب!')}</h3>
                <div className="bg-white border border-red-200 p-6 rounded-2xl max-w-lg mx-auto shadow-sm">
                    <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                        {t('checkout.pending_order_exists', 'عذراً، لديك بالفعل طلب قيد الانتظار (رقم #')}{pendingOrder.id}).
                        <br/>
                        <strong>{t('checkout.must_pay_deposit_first', 'يجب سداد العربون لتأكيد طلبك الحالي أو القيام بإلغائه أولاً لتتمكن من إنشاء طلب جديد.')}</strong>
                    </p>
                    <button
                        onClick={() => navigate('/my-orders')}
                        className="btn bg-red-600 hover:bg-red-700 text-white px-8 py-3 rounded-xl shadow-lg w-full flex items-center justify-center gap-2 text-lg font-bold"
                    >
                        {t('checkout.go_to_orders_pay', 'الذهاب لصفحة طلباتي للدفع')} {isRtl ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
                    </button>
                </div>
            </div>
        );
    }

    if (!cart?.items?.length) {
        return (
            <div className="container mx-auto px-4 py-20 text-center">
                <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Truck size={40} className="text-orange-400" />
                </div>
                <h3 className="text-2xl font-bold text-dark mb-2">{t('checkout.empty_cart', 'السلة فارغة')}</h3>
                <p className="text-muted mb-8">{t('checkout.add_items', 'لم تقم بإضافة أي عناصر للمتابعة.')}</p>
                <button
                    onClick={() => navigate('/livestock')}
                    className="btn btn-primary px-8 py-3 rounded-full shadow-lg hover:shadow-xl transition-shadow"
                >
                    {t('checkout.start_shopping', 'العودة للمتجر')}
                </button>
            </div>
        );
    }

    const renderStepper = () => (
        <div className="flex items-center justify-center mb-8 w-full max-w-lg mx-auto">
            <div className={`flex flex-col items-center relative z-10 ${step >= 1 ? 'text-primary' : 'text-gray-400'}`}>
                <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${step >= 1 ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}
                >
                    1
                </div>
                <span className="text-[10px] md:text-xs font-bold mt-2">{t('checkout.step1', 'بيانات الطلب')}</span>
            </div>
            <div
                className={`flex-1 h-1 mx-2 rounded transition-all ${step >= 2 ? 'bg-primary' : 'bg-gray-200'}`}
            ></div>
            <div className={`flex flex-col items-center relative z-10 ${step >= 2 ? 'text-primary' : 'text-gray-400'}`}>
                <div
                    className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold border-2 transition-all ${step >= 2 ? 'bg-primary text-white border-primary' : 'bg-white border-gray-300'}`}
                >
                    2
                </div>
                <span className="text-[10px] md:text-xs font-bold mt-2">{t('checkout.step2', 'المراجعة والتأكيد')}</span>
            </div>
        </div>
    );

    const renderStep1Form = () => (
        <form onSubmit={handleSubmitDetails} className="space-y-6 md:space-y-8 animate-fade-in">
            <div>
                <h3 className="text-base md:text-lg font-bold text-dark mb-3 md:mb-4 flex items-center gap-2">
                    <Truck size={18} className="text-primary md:w-5 md:h-5" />
                    {t('checkout.delivery_option', 'طريقة الاستلام')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                    {[
                        {
                            id: 'to_home',
                            label: t('checkout.delivery_home', 'توصيل للمنزل'),
                            icon: <Truck size={20} className="md:w-6 md:h-6" />,
                            desc: t('checkout.delivery_home_desc', 'يصلك حتى باب البيت'),
                            show: opSettings?.delivery_active !== false
                        },
                        {
                            id: 'pickup',
                            label: t('checkout.pickup_farm', 'استلام من المزرعة'),
                            icon: <Store size={20} className="md:w-6 md:h-6" />,
                            desc: t('checkout.pickup_farm_desc', 'استلام بنفسك من مقرنا'),
                            show: opSettings?.pickup_active !== false
                        }
                    ].filter(opt => opt.show).map(opt => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setDeliveryOption(opt.id)}
                            className={`cursor-pointer p-3 md:p-4 rounded-2xl border-2 transition-all flex flex-row sm:flex-col items-center sm:text-center gap-3 sm:gap-2 ${
                                deliveryOption === opt.id
                                    ? 'border-primary bg-primary/5 text-primary shadow-sm'
                                    : 'border-gray-100 bg-white text-gray-500 hover:border-gray-200'
                            }`}
                        >
                            <div className={`p-2 rounded-full ${deliveryOption === opt.id ? 'bg-primary/10' : 'bg-gray-50'}`}>
                                {opt.icon}
                            </div>
                            <div className="text-start sm:text-center">
                                <div className="font-bold text-sm md:text-base">{opt.label}</div>
                                <div className="text-[10px] md:text-xs opacity-70 mt-0.5">{opt.desc}</div>
                            </div>
                        </button>
                    ))}

                    {opSettings?.delivery_active === false && opSettings?.pickup_active === false && (
                        <div className="col-span-full bg-red-50 text-red-600 p-4 rounded-xl text-center text-sm font-bold border border-red-100">
                            {t('checkout.no_delivery_pickup_available', 'عذراً، لا توجد طرق استلام/توصيل متاحة حالياً. يرجى التواصل مع الإدارة.')}
                        </div>
                    )}
                </div>
            </div>

            {deliveryOption === 'to_home' && (
                <div className="animate-fade-in-up">
                    <div className="flex justify-between items-center mb-3 md:mb-4">
                        <h3 className="text-base md:text-lg font-bold text-dark flex items-center gap-2 m-0">
                            <MapPin size={18} className="text-primary md:w-5 md:h-5" />
                            {t('checkout.delivery_address', 'عنوان التوصيل')}
                        </h3>
                        <Link
                            to="/addresses"
                            className="text-xs md:text-sm font-bold text-primary hover:underline bg-primary/5 px-2 py-1 rounded-lg"
                        >
                            + {t('checkout.new_address', 'عنوان جديد')}
                        </Link>
                    </div>

                    {!addresses.length ? (
                        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl text-xs md:text-sm border border-yellow-100 flex items-center justify-between">
                            <span>{t('checkout.no_addresses', 'لا توجد عناوين مسجلة.')}</span>
                            <Link to="/addresses" className="font-bold text-yellow-900 underline">
                                {t('checkout.add_address_now', 'أضف الآن')}
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {addresses.map(addr => (
                                <label
                                    key={addr.id}
                                    className={`flex items-start gap-3 p-3 md:p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                                        selectedAddressId === String(addr.id)
                                            ? 'border-primary bg-primary/5 shadow-sm'
                                            : 'border-gray-100 bg-white hover:border-gray-200'
                                    }`}
                                >
                                    <input
                                        type="radio"
                                        name="address"
                                        value={addr.id}
                                        checked={selectedAddressId === String(addr.id)}
                                        onChange={(e) => setSelectedAddressId(e.target.value)}
                                        className="mt-1 accent-primary w-4 h-4 md:w-5 md:h-5 shrink-0 cursor-pointer"
                                    />
                                    <div className="flex-grow min-w-0">
                                        <div className="font-bold text-dark text-sm truncate">{addr.city}, {addr.street}</div>
                                        <div className="text-xs text-muted mt-1 truncate">
                                            {addr.governorate}
                                            {addr.building_number ? ` ${t('addresses_page.building', 'مبنى')} ${addr.building_number}` : ''}
                                        </div>
                                        {addr.is_default && (
                                            <span className="inline-block mt-2 bg-primary/10 text-primary text-[9px] md:text-[10px] px-2 py-0.5 rounded font-bold">
                                                {t('addresses_page.default_badge', 'الافتراضي')}
                                            </span>
                                        )}
                                    </div>
                                </label>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div>
                <h3 className="text-base md:text-lg font-bold text-dark mb-3 md:mb-4 flex items-center gap-2">
                    <Calendar size={18} className="text-primary md:w-5 md:h-5" />
                    {t('checkout.delivery_date', 'موعد الاستلام')}
                </h3>

                {isSharePurchase ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 md:p-4 animate-fade-in-up">
                        <div className="flex items-center gap-2 text-amber-800 font-bold mb-1.5 md:mb-2 text-sm md:text-base">
                            <Clock size={18} className="text-amber-600 md:w-5 md:h-5" />
                            {t('checkout.delivery_date_determined_later', 'موعد التسليم يُحدد لاحقاً')}
                        </div>
                        <p className="text-amber-900 text-xs md:text-sm mb-0 leading-relaxed">
                            {t('checkout.share_purchase_date_note')}
                            <strong> {t('checkout.admin_will_contact')}</strong>
                        </p>
                    </div>
                ) : (
                    <>
                        {opSettings?.enable_eid_receive_button && opSettings?.eid_adha_date && (() => {
                            const eidDate = opSettings.eid_adha_date.split('T')[0];
                            const isEidSelected = selectedDate === eidDate;
                            return (
                                <button
                                    type="button"
                                    onClick={() => setSelectedDate(eidDate)}
                                    className={`mb-3 w-full py-3 px-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 text-sm md:text-base ${
                                        isEidSelected
                                        ? 'bg-emerald-600 text-white shadow-md border border-emerald-600 ring-2 ring-emerald-600/30 transform scale-[1.01]'
                                        : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                    }`}
                                >
                                    <span className="text-lg md:text-xl">🐑</span>
                                    {t('checkout.receive_on_eid_days', 'استلام أيام عيد الأضحى المبارك')}
                                    {isEidSelected && <CheckCircle size={18} className="md:w-5 md:h-5" />}
                                </button>
                            );
                        })()}

                        {availableDates.length > 0 ? (
                            <div className="relative">
                                <select
                                    className="w-full appearance-none bg-white border border-gray-200 text-dark py-3 px-4 pe-10 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-bold text-sm transition-shadow cursor-pointer"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    required={!isSharePurchase}
                                >
                                    <option value="">-- {t('checkout.select_date', 'اختر التاريخ المناسب')} --</option>
                                    {availableDates.map(date => (
                                        <option key={date} value={date}>{formatDateWithDay(date)}</option>
                                    ))}
                                    {opSettings?.eid_adha_date && !availableDates.includes(opSettings.eid_adha_date.split('T')[0]) && (
                                        <option value={opSettings.eid_adha_date.split('T')[0]} className="hidden">
                                            {formatDateWithDay(opSettings.eid_adha_date.split('T')[0])}
                                        </option>
                                    )}
                                </select>
                                <div className={`pointer-events-none absolute inset-y-0 ${isRtl ? 'left-3' : 'right-3'} flex items-center text-gray-400`}>
                                    <Calendar size={18} />
                                </div>
                            </div>
                        ) : (
                            <div className="bg-gray-50 p-3 rounded-xl text-muted text-xs md:text-sm text-center border border-gray-100">
                                {t('checkout.no_dates', 'لا توجد مواعيد متاحة حالياً، يرجى التواصل مع الإدارة.')}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div>
                <h3 className="text-base md:text-lg font-bold text-dark mb-3 md:mb-4 flex items-center gap-2">
                    <CreditCard size={18} className="text-primary md:w-5 md:h-5" />
                    {t('checkout.payment_method', 'طريقة الدفع')}
                </h3>

                <div className="space-y-3">
                    <div className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl border-2 border-primary bg-primary/5 shadow-sm cursor-default">
                        <input
                            type="radio"
                            id="paymob"
                            name="paymentMethod"
                            value="paymob"
                            checked={true}
                            readOnly
                            className="accent-primary w-4 h-4 md:w-5 md:h-5 shrink-0"
                        />
                        <div className="p-2 md:p-2.5 rounded-full bg-white text-primary shadow-sm shrink-0">
                            <CreditCard size={20} className="md:w-6 md:h-6" />
                        </div>
                        <div>
                            <div className="font-bold text-dark text-sm md:text-base">{t('checkout.paymob', 'دفع إلكتروني')}</div>
                            <div className="text-[10px] md:text-xs text-gray-500 mt-0.5">{t('checkout.paymob_desc', 'بطاقة بنكية / محفظة إلكترونية')}</div>
                        </div>
                    </div>

                    <div className="bg-blue-50 text-blue-800 p-2.5 md:p-3 rounded-xl text-[10px] md:text-xs flex items-start gap-2 border border-blue-100">
                        <Info size={16} className="mt-0.5 shrink-0 text-blue-600" />
                        <span className="font-medium leading-relaxed">{t('checkout.electronic_payment_only', 'لضمان جدية الحجز، الدفع إلكتروني فقط (كامل أو عربون).')}</span>
                    </div>
                </div>
            </div>

            <div className="hidden lg:block pt-4">
                <button
                    type="submit"
                    className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex justify-center items-center gap-2"
                >
                    {t('checkout.review_order', 'مراجعة الطلب')}
                    {isRtl ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
                </button>
            </div>
        </form>
    );

    const renderStep2Review = () => {
        const selectedAddress = getSelectedAddress();

        return (
            <div className="space-y-4 md:space-y-6 animate-fade-in">
                <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm">
                    <h3 className="text-base md:text-lg font-bold text-dark mb-3 md:mb-4 flex items-center justify-between border-b border-gray-50 pb-2 md:pb-3">
                        <div className="flex items-center gap-2">
                           <ShoppingBag size={18} className="text-primary md:w-5 md:h-5"/>
                           <span>{t('checkout.order_summary', 'ملخص السلة')}</span>
                        </div>
                        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md text-xs font-bold">{cart?.items?.length}</span>
                    </h3>

                    <div className="space-y-3">
                        {cart?.items?.map(item => {
                            const itemPrice = parseFloat(item.calculated_details?.final_price || item.price_per_item || 0);
                            const context = item.selected_services?._order_context || 'general';
                            const isShareMode = ['shares', 'adahi_pool', 'adahi_group'].includes(context);

                            return (
                                <div key={item.id} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl border border-gray-100">
                                    <div className="w-12 h-12 md:w-16 md:h-16 rounded-lg overflow-hidden bg-white shrink-0 border border-gray-200">
                                        <img src={item.animal?.image || '/default-image.png'} alt={item.animal?.code} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-grow min-w-0">
                                        <h4 className="font-bold text-xs md:text-sm text-dark truncate mb-0.5">
                                            {item.animal?.category_name} <span className="text-gray-400 font-normal">#{item.animal?.code?.replace('#', '')}</span>
                                        </h4>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            <span className="text-[9px] md:text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">
                                                {getOrderContextLabel(context)}
                                            </span>
                                            {isShareMode && (
                                                <span className="text-[9px] md:text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                                                    {item.share_quantity} {t('common.share', 'سهم')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-primary font-black text-sm md:text-base shrink-0" dir="ltr">
                                        {itemPrice.toLocaleString()} <span className="text-[10px] text-gray-500 font-normal">{t('common.currency')}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-white p-4 md:p-6 rounded-2xl md:rounded-3xl border border-gray-100 shadow-sm space-y-3 md:space-y-4">
                    <h3 className="text-base md:text-lg font-bold text-dark mb-2 md:mb-3 border-b border-gray-50 pb-2 md:pb-3 flex items-center gap-2">
                        <Truck size={18} className="text-primary md:w-5 md:h-5"/>
                        {t('orders_page.delivery_details', 'بيانات الاستلام')}
                    </h3>

                    <div className="flex justify-between py-1.5 md:py-2 border-b border-gray-50 text-sm md:text-base">
                        <span className="text-gray-500 font-medium">{t('checkout.delivery_option', 'طريقة الاستلام')}</span>
                        <span className="font-bold text-dark">
                            {deliveryOption === 'to_home' ? t('checkout.delivery_home', 'توصيل للمنزل') : t('checkout.pickup_farm', 'استلام من المزرعة')}
                        </span>
                    </div>

                    {deliveryOption === 'to_home' && selectedAddress && (
                        <div className="flex justify-between py-1.5 md:py-2 border-b border-gray-50 text-sm md:text-base">
                            <span className="text-gray-500 font-medium">{t('checkout.delivery_address', 'العنوان')}</span>
                            <div className="text-end">
                                <span className="font-bold text-dark block">{selectedAddress.city}، {selectedAddress.governorate}</span>
                                <span className="text-xs text-gray-400 block mt-0.5">{selectedAddress.street}</span>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between py-1.5 md:py-2 text-sm md:text-base">
                        <span className="text-gray-500 font-medium">{t('checkout.delivery_date', 'موعد الاستلام')}</span>
                        <span className="font-bold text-dark">{selectedDate || t('checkout.not_specified', 'يُحدد لاحقاً')}</span>
                    </div>
                </div>

                <div className="hidden lg:flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={() => setStep(1)}
                        className="flex-1 bg-white border border-gray-200 text-dark py-3.5 rounded-2xl font-bold hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                        {isRtl ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
                        {t('checkout.back_to_edit', 'رجوع للتعديل')}
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirmOrder}
                        disabled={submitting}
                        className="flex-[2] bg-primary hover:bg-primary-dark text-white py-3.5 rounded-2xl font-bold shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {submitting ? (
                            <>
                                <Loader size={20} className="animate-spin" />
                                {t('checkout.confirming_order', 'جاري تأكيد الطلب...')}
                            </>
                        ) : (
                            <>
                                <CheckCircle size={20} />
                                {t('checkout.confirm_and_pay', 'تأكيد الطلب والدفع')}
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-secondary/20 min-h-screen pb-32 md:pb-20">
            <div className="container mx-auto px-3 md:px-4 py-6 md:py-8">
                {isRedirecting && (
                    <div className="fixed inset-0 z-[99999] bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center">
                        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                        <h2 className="text-xl font-bold text-dark">جاري تحويلك لبوابة الدفع الآمنة...</h2>
                        <p className="text-muted text-sm mt-2">يرجى عدم إغلاق الصفحة</p>
                    </div>
                )}

                <h1 className="text-2xl md:text-3xl font-black text-dark text-center mb-6 md:mb-8">{t('checkout.title', 'إتمام عملية الشراء')}</h1>
                {renderStepper()}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
                    <div className="lg:col-span-7">
                        {dailyLimitError && (
                            <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-4 mb-5 shadow-sm animate-fade-in-up">
                                <div className="flex items-start gap-3">
                                    <div className="bg-white p-2 rounded-full shadow-sm shrink-0">
                                        <AlertTriangle size={24} className="text-red-500" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-red-700 text-base md:text-lg mb-1">{t('checkout.order_paused', 'تم إيقاف الطلب مؤقتاً!')}</h4>
                                        <p className="text-red-600 text-xs md:text-sm font-medium mb-0 leading-relaxed">
                                            {dailyLimitError}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div
                                className="bg-red-50 text-red-600 p-3 md:p-4 rounded-xl text-xs md:text-sm font-bold border border-red-100 flex items-center gap-2 mb-5"
                                role="alert"
                            >
                                <CheckCircle size={18} className="shrink-0" /> {error}
                            </div>
                        )}

                        {step === 1 ? renderStep1Form() : renderStep2Review()}
                    </div>

                    {/* Side Summary - Desktop */}
                    <div className="hidden lg:block lg:col-span-5 lg:sticky top-6 mt-6 lg:mt-0">
                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
                            <h3 className="text-lg font-bold text-dark mb-4 flex items-center justify-between border-b border-gray-50 pb-4">
                                <div className="flex items-center gap-2">
                                  <Store size={20} className="text-primary" />
                                  {t('checkout.order_summary', 'ملخص الطلب')}
                                </div>
                            </h3>

                            <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                                <div className="flex justify-between text-sm text-gray-500 font-medium">
                                    <span>{t('checkout.purchases_and_services', 'المشتريات والخدمات')}</span>
                                    <span dir="ltr" className="font-bold text-dark">
                                        {(displayTotal + parseFloat(cart?.cart_totals?.voucher_discount || 0)).toLocaleString()} {t('common.currency')}
                                    </span>
                                </div>

                                {deliveryOption === 'to_home' && deliveryFee > 0 && (
                                    <div className="flex justify-between text-sm text-blue-600 font-bold mt-2">
                                        <span className="d-flex flex-column">
                                            <span>{t('checkout.delivery_fees', 'رسوم التوصيل')}</span>
                                            <span className="text-[10px] text-blue-400 mt-1 font-medium">
                                                {t('checkout.delivery_fee_breakdown', { base: deliveryDetails.baseFee, extra: deliveryDetails.extraFee })}
                                            </span>
                                        </span>
                                        <span dir="ltr">+{deliveryFee.toLocaleString()} {t('common.currency')}</span>
                                    </div>
                                )}

                                {deliveryOption === 'to_home' && deliveryFee === 0 && selectedAddressId && (
                                     <div className="flex justify-between text-sm text-green-600 font-bold mt-2">
                                        <span>{t('checkout.delivery_fees', 'رسوم التوصيل')}</span>
                                        <span>{t('checkout.free', 'مجانًا')}</span>
                                    </div>
                                )}

                                {(() => {
                                    const voucherDiscount = parseFloat(cart?.cart_totals?.voucher_discount || 0);
                                    if (voucherDiscount > 0) {
                                        return (
                                            <div className="flex justify-between items-center text-red-600 font-bold bg-red-50 p-2 rounded-xl border border-red-200 mt-2 shadow-sm">
                                                <span className="flex items-center gap-1.5"><Tag size={16}/> قسيمة خصم (Voucher):</span>
                                                <span dir="ltr" className="text-base">
                                                    -{voucherDiscount.toLocaleString(undefined, {maximumFractionDigits: 0})} {t('common.currency')}
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                <div className="h-px bg-gray-200 my-3"></div>

                                <div className="flex justify-between items-center text-lg font-black text-dark">
                                    <div>
                                        <span className="block">{t('checkout.grand_total', 'المجموع الكلي')}</span>
                                        <span className="text-[10px] text-gray-400 font-normal block">{t('checkout.includes_delivery_if_any', 'شامل التوصيل إن وُجد')}</span>
                                    </div>
                                    <span dir="ltr" className="text-primary">
                                        {finalOrderTotal.toLocaleString()} {t('common.currency')}
                                    </span>
                                </div>

                                {discountAmount > 0 && (
                                    <div className="flex justify-between items-center text-sm text-red-600 bg-red-50 p-2 rounded-lg border border-red-100 mt-2">
                                        <span className="font-bold flex items-center gap-1">
                                            <Tag size={16}/> {t('orders_page.applied_discount', "إجمالي التوفير (الخصم):")}
                                        </span>
                                        <span className="font-black" dir="ltr">
                                            -{discountAmount.toLocaleString()} {t('common.currency', 'ج.م')}
                                        </span>
                                    </div>
                                )}

                                {(() => {
                                    const totalOriginal = cart?.items?.reduce((sum, item) => sum + (parseFloat(item.animal?.price_egp || 0) / (item.animal?.max_shares || 1)) * (item.share_quantity || 1), 0) || 0;
                                    const totalFinalAnimals = cart?.items?.reduce((sum, item) => sum + parseFloat(item.calculated_details?.animal_base_price || 0), 0) || 0;
                                    const saved = totalOriginal - totalFinalAnimals;

                                    if (saved > 0) {
                                        return (
                                            <div className="flex justify-between items-center text-sm text-red-600 font-bold bg-red-50 p-2 rounded-lg border border-red-100 mt-2">
                                                <span className="flex items-center gap-1"><Tag size={16}/> لقد وفرت:</span>
                                                <span dir="ltr">-{saved.toLocaleString(undefined, {maximumFractionDigits: 0})} {t('common.currency')}</span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            {finalDepositToPay > 0 && finalDepositToPay < finalOrderTotal && (
                                <div className="mt-4 p-4 bg-blue-50 rounded-2xl border border-blue-200 shadow-sm animate-fade-in-up">
                                    <div className="flex justify-between text-blue-900 font-black mb-1 items-center">
                                        <div>
                                            <span className="block text-base">{t('checkout.deposit_now', 'المطلوب دفعه الآن')}</span>
                                            <span className="text-[10px] text-blue-600 block fw-normal mt-0.5">
                                                {t('checkout.deposit_plus_services', '(عربون الماشية + إجمالي التجهيز والتوصيل)')}
                                            </span>
                                        </div>
                                        <span className="text-xl" dir="ltr">
                                            {finalDepositToPay.toLocaleString()} {t('common.currency')}
                                        </span>
                                    </div>

                                    <div className="mt-3 text-[10px] text-blue-700 bg-blue-100/50 p-2.5 rounded-lg border border-blue-100/50 flex items-start gap-1.5">
                                        <Info size={14} className="shrink-0 mt-0.5" />
                                        <span className="leading-relaxed">{t('checkout.services_paid_upfront_note', 'لضمان الجدية، يتم تحصيل تكلفة الخدمات والتوصيل بنسبة 100% مقدماً وتُضاف إلى عربون الماشية، ويُخصم الإجمالي من فاتورتك.')}</span>
                                    </div>

                                    <div className="flex justify-between items-center text-sm text-blue-800 pt-3 mt-3 border-t border-blue-200/50">
                                        <span className="font-bold">{t('checkout.remaining_at_delivery', 'المتبقي عند الاستلام')}</span>
                                        <span dir="ltr" className="font-black text-base">
                                            {finalRemaining.toLocaleString()} {t('common.currency')}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {finalDepositToPay === finalOrderTotal && finalDepositToPay > 0 && (
                                <div className="mt-4 p-4 bg-green-50 rounded-2xl border border-green-200 shadow-sm animate-fade-in-up">
                                    <div className="flex justify-between text-green-900 font-black items-center">
                                        <span>{t('checkout.pay_now_full', 'المطلوب دفعه الآن (كامل)')}</span>
                                        <span className="text-xl" dir="ltr">
                                            {finalDepositToPay.toLocaleString()} {t('common.currency')}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Floating bottom bar for mobile */}
            <div className="lg:hidden fixed bottom-[65px] left-0 right-0 bg-white border-t border-gray-200 px-3 py-2 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.08)] rounded-t-3xl pb-safe">
                <div className="flex justify-between items-center mb-2 px-1">
                    <div className="flex flex-col">
                        <span className="text-[10px] text-gray-500 font-bold mb-0.5">{t('cart.total', 'الإجمالي')}</span>
                        <span className="font-bold text-dark text-sm" dir="ltr">
                            {finalOrderTotal.toLocaleString()} <span className="text-[10px]">{t('common.currency')}</span>
                        </span>
                    </div>
                    <div className="flex flex-col text-center">
                        <span className="text-[10px] text-blue-600 font-bold mb-0.5">{t('checkout.pay_now_mobile', 'يُدفع الآن')}</span>
                        <span className="font-black text-blue-700 text-base" dir="ltr">
                            {finalDepositToPay.toLocaleString()} <span className="text-[10px]">{t('common.currency')}</span>
                        </span>
                    </div>
                    <div className="flex flex-col text-end">
                        <span className="text-[10px] text-red-500 font-bold mb-0.5">{t('checkout.remaining_mobile', 'الباقي عند الاستلام')}</span>
                        <span className="font-bold text-red-600 text-sm" dir="ltr">
                            {finalRemaining.toLocaleString()} <span className="text-[10px]">{t('common.currency')}</span>
                        </span>
                    </div>
                </div>

                {step === 1 ? (
                    <button
                        onClick={handleSubmitDetails}
                        className="w-full bg-primary hover:bg-primary-dark text-white py-3 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 mt-1"
                    >
                        {t('checkout.review_order', 'مراجعة الطلب')}
                        {isRtl ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
                    </button>
                ) : (
                    <div className="flex gap-2 mt-1">
                         <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="bg-gray-100 text-gray-600 py-3 px-4 rounded-2xl font-bold text-sm hover:bg-gray-200 transition-colors flex items-center justify-center"
                            aria-label={t('common.back', 'رجوع')}
                        >
                            {isRtl ? <ArrowRight size={18} /> : <ArrowLeft size={18} />}
                        </button>
                        <button
                            onClick={handleConfirmOrder}
                            disabled={submitting}
                            className="flex-grow bg-green-600 hover:bg-green-700 text-white py-3 rounded-2xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {submitting ? (
                                <Loader size={18} className="animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle size={18} /> {t('checkout.confirm_and_pay', 'تأكيد ودفع')}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Checkout;

