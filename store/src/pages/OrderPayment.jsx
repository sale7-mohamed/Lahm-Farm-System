
// src/pages/OrderPayment.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import { CreditCard, Wallet, CheckCircle, Briefcase, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const OrderPayment = ({ isB2BRoute = false }) => {
    const { t } = useTranslation();
    const { id } = useParams();
    const navigate = useNavigate();
    const [order, setOrder] = useState(null);
    const[b2bRequest, setB2bRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        const fetchPaymentDetails = async () => {
            try {
                if (isB2BRoute) {
                    const res = await axios.get(`/orders/business-requests/${id}/`);
                    setB2bRequest(res.data);
                    if (res.data.converted_order_details) {
                        const orderRes = await axios.get(`/orders/list/${res.data.converted_order_details.id}/`);
                        setOrder(orderRes.data);
                    } else if (res.data.status === 'quoted' || res.data.quoted_total_price) {

                        setOrder({
                            id: res.data.id,
                            business_request_id: res.data.id,
                            source: 'b2b',
                            status: 'pending',
                            total_price: res.data.quoted_total_price,
                            min_deposit_required: res.data.quoted_deposit || 0,
                            deposit_total: 0,
                            remaining_amount: res.data.quoted_total_price
                        });
                    } else {
                        toast.error(t('order_payment.no_financial_order', 'لا يوجد طلب مالي مرتبط بهذا العرض بعد.'));
                        navigate('/business');
                    }
                } else {
                    const res = await axios.get(`/orders/list/${id}/`);
                    setOrder(res.data);
                }
            } catch  {
                toast.error(t('errors.generic'));
                navigate('/');
            } finally {
                setLoading(false);
            }
        };
        fetchPaymentDetails();
    },[id, isB2BRoute, navigate, t]);

    const handlePayment = async () => {
        setProcessing(true);
        try {
            const isFirstPayment = parseFloat(order.deposit_total || 0) <= 0;
            const amountToPay = isFirstPayment ? order.min_deposit_required : order.remaining_amount;

            const response = await axios.post('/payments/pay-remainder/', {
                order_id: order.id,
                amount: amountToPay,
                payment_method: 'paymob'
            });

            if (response.data.payment_url) {
                window.location.href = response.data.payment_url;
            } else {
                toast.success(t('cart.secure_payment'));
                navigate(order.source === 'b2b' ? '/business' : '/my-orders');
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || t('errors.generic'));
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[80vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (!order) return null;

    const isB2B = order.source === 'b2b';
    const displayId = isB2B ? (b2bRequest?.id || order.business_request_id) : order.id;

    if (order.status === 'canceled') {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] bg-secondary/30 p-4">
                <div className="bg-white p-8 rounded-3xl shadow-sm text-center max-w-md w-full border border-gray-100 animate-fade-in-up">
                    <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600">
                        <AlertCircle size={40} />
                    </div>
                    <h2 className="text-xl font-bold text-dark mb-2">{t('order_payment.order_canceled_title', 'هذا الطلب مُلغى')}</h2>
                    <p className="text-muted mb-6">{t('order_payment.order_canceled_desc', 'عذراً، لا يمكن الدفع لطلب تم إلغاؤه من قبل الإدارة أو بسبب التأخر في الدفع.')}</p>
                    <button onClick={() => navigate(isB2B ? '/business' : '/my-orders')} className="btn btn-primary w-full justify-center">
                        {t('order_payment.back_to_orders', 'العودة للطلبات')}
                    </button>
                </div>
            </div>
        );
    }

    if (parseFloat(order.remaining_amount) <= 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[80vh] bg-secondary/30 p-4">
                <div className="bg-white p-8 rounded-3xl shadow-sm text-center max-w-md w-full border border-gray-100 animate-fade-in-up">
                    <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                        <CheckCircle size={40} />
                    </div>
                    <h2 className="text-xl font-bold text-dark mb-2">{t('orders_page.paid_full')}</h2>
                    <p className="text-muted mb-6">{t('orders_page.no_amount_due')}</p>
                    <button onClick={() => navigate(isB2B ? '/business' : '/my-orders')} className="btn btn-primary w-full justify-center">
                        {t('order_payment.back_to_orders', 'العودة للطلبات')}
                    </button>
                </div>
            </div>
        );
    }

    const isFirstPayment = parseFloat(order.deposit_total || 0) <= 0;
    const amountToDisplay = isFirstPayment ? parseFloat(order.min_deposit_required) : parseFloat(order.remaining_amount);
    const paymentLabel = isFirstPayment ? t('order_payment.deposit_required', "المطلوب دفعه (عربون تأكيد)") : t('order_payment.remaining_amount', "المبلغ المتبقي");
    const headerTitle = isB2B ? t('order_payment.complete_corporate_payment', "إكمال دفع طلب التوريد") : t('orders_page.complete_payment', 'إكمال الدفع');
    const orderTitle = isB2B ? `${t('order_payment.corporate_order_num', 'طلب شركات #')}${displayId}` : `${t('orders_page.order_num', 'طلب #')}${displayId}`;

    return (
        <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-3xl shadow-xl border border-gray-100 overflow-hidden animate-fade-in-up">
                <div className={`${isB2B ? 'bg-blue-600/10 border-blue-100' : 'bg-primary/10 border-primary/10'} p-6 text-center border-b`}>
                    {isB2B && (
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3 text-blue-600">
                            <Briefcase size={24} />
                        </div>
                    )}
                    <h2 className="text-xl font-bold text-dark mb-1">{headerTitle}</h2>
                    <p className={`${isB2B ? 'text-blue-700' : 'text-primary'} font-black text-lg`}>{orderTitle}</p>
                </div>

                <div className="p-8">
                    <div className="text-center mb-8">
                        <p className="text-muted text-sm mb-2 font-bold">{paymentLabel}</p>
                        <div className="text-4xl font-black text-dark flex items-center justify-center gap-1" dir="ltr">
                            {amountToDisplay.toLocaleString()} <span className="text-lg text-gray-400 font-medium">{t('common.currency')}</span>
                        </div>
                        {isB2B && isFirstPayment && (
                            <p className="text-xs text-blue-600 mt-2 bg-blue-50 p-2 rounded-lg border border-blue-100">
                                {t('order_payment.deposit_note', 'بدفعك للعربون، سيتم تثبيت السعر والبدء في تجهيز طلبك.')}
                            </p>
                        )}
                    </div>

                    <button
                        className={`w-full ${isB2B ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'} text-white py-4 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center gap-2 mb-4`}
                        onClick={handlePayment}
                        disabled={processing}
                    >
                        {processing ? <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div> : <><Wallet size={20} /> {t('order_payment.pay_online_now', 'ادفع إلكترونياً الآن')}</>}
                    </button>
                    <button className="w-full text-gray-400 font-bold text-sm hover:text-dark transition-colors" onClick={() => navigate(isB2B ? '/business' : '/my-orders')}>
                        {t('common.cancel_back')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OrderPayment;
