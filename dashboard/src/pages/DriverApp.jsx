import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Card, Button, Badge, Modal, Form, Spinner, Alert } from 'react-bootstrap';
import {
    Navigation, Phone, CheckCircle, MapPin,
    Truck, RefreshCw, Camera, UploadCloud,
    DollarSign, ShieldCheck, Beef, CreditCard, AlertTriangle
} from 'lucide-react';

const DriverApp = () => {
    const [myShipment, setMyShipment] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [processing, setProcessing] = useState({});
    const [smsLoading, setSmsLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [cashReceived, setCashReceived] = useState(0);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [receiptImage, setReceiptImage] = useState(null);
    const [deliveryPhoto, setDeliveryPhoto] = useState(null);
    const [otpStep, setOtpStep] = useState('request');
    const [otpInput, setOtpInput] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);
    const [locationAllowed, setLocationAllowed] = useState(false);

    const MAX_FILE_SIZE = 5 * 1024 * 1024;

    const fetchMyRoute = useCallback(async (showToast = false) => {
        if (showToast) setRefreshing(true);
        try {
            const res = await axios.get('/orders/shipments/my-active-shipments/');
            const shipmentsData = res.data.results || res.data;

            if (shipmentsData?.length > 0) {
                setMyShipment(shipmentsData[0]);
                if (showToast) toast.success('تم تحديث مسار الرحلة');
            } else {
                setMyShipment(null);
            }
        } catch {
            toast.error('فشل تحميل الرحلة');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchMyRoute();
    }, [fetchMyRoute]);

    useEffect(() => {
        if (!myShipment) return;

        const updateLocation = () => {
            if (!navigator.geolocation) return;
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setLocationAllowed(true);
                    axios.post(`/management/shipments/${myShipment.id}/update-location/`, {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    }).catch(() => {});
                },
                (error) => {
                    console.error('GPS Error:', error);
                    setLocationAllowed(false);
                },
                { enableHighAccuracy: true }
            );
        };

        updateLocation();
        const interval = setInterval(updateLocation, 30000);
        return () => clearInterval(interval);
    }, [myShipment]);

    const handleSendArrivalSms = async (orderData) => {
        setSmsLoading(true);
        try {
            await axios.post(`/management/orders/${orderData.id}/send-arrival-sms/`);
            toast.success('تم إرسال رسالة (أنا في الطريق) للعميل بنجاح.');
            fetchMyRoute();
        } catch(err) {
            toast.error(err.response?.data?.detail || 'فشل إرسال الرسالة للعميل');
        } finally {
            setSmsLoading(false);
        }
    };

    const handleRequestOTP = async () => {
        setOtpLoading(true);
        try {
            await axios.post(`/management/orders/${selectedOrder.id}/send-delivery-otp/`);
            toast.success('تم إرسال كود الاستلام لهاتف العميل');
            setOtpStep('verify');
            fetchMyRoute();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'فشل إرسال الكود');
            if (error.response?.data?.detail?.includes('الحد الأقصى')) {
                setOtpStep('limit_reached');
            }
        } finally {
            setOtpLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otpInput || otpInput.length !== 6) {
            toast.warn('يرجى إدخال الكود المكون من 6 أرقام');
            return;
        }
        setOtpLoading(true);
        try {
            await axios.post(`/management/orders/${selectedOrder.id}/verify-delivery-otp/`, { otp: otpInput });
            toast.success('تم التحقق بنجاح. يمكنك الآن تسليم الطلب');
            setOtpStep('complete');
        } catch (error) {
            toast.error(error.response?.data?.detail || 'الكود غير صحيح');
        } finally {
            setOtpLoading(false);
        }
    };

    const handleFileChange = (e, setter) => {
        const file = e.target.files[0];
        if (file && file.size <= MAX_FILE_SIZE) {
            setter(file);
        } else {
            toast.warn('الملف كبير جداً أو غير صالح');
            e.target.value = '';
        }
    };

    const handleConfirmDelivery = async () => {
        if (!receiptImage) {
            toast.warn('يجب تصوير إيصال الاستلام المُمضي من العميل');
            return;
        }
        if (!myShipment) return;

        setProcessing(prev => ({ ...prev, [selectedOrder.id]: true }));
        const formData = new FormData();
        const finalCash = parseFloat(selectedOrder?.remaining_amount || 0) <= 0 ? 0 : cashReceived;
        formData.append('cash_received', finalCash);
        formData.append('payment_method', paymentMethod);
        formData.append('receipt_image', receiptImage);
        if (deliveryPhoto) formData.append('delivery_photo', deliveryPhoto);

        try {
            await axios.post(`/management/orders/${selectedOrder.id}/mark-delivered-driver/`, formData);
            await axios.post(`/management/shipments/${myShipment.id}/advance-step/`);
            toast.success('تم التسليم بنجاح، ننتقل للمحطة التالية');
            setShowModal(false);
            fetchMyRoute();
        } catch (error) {
            toast.error(error.response?.data?.detail || 'فشل تأكيد التسليم');
        } finally {
            setProcessing(prev => ({ ...prev, [selectedOrder.id]: false }));
        }
    };

    const handleTaskComplete = useCallback(async (taskId) => {
        if (!myShipment) return;
        if (!window.confirm('هل تأكدت من إتمام هذه المحطة بالكامل؟')) return;

        setProcessing(prev => ({ ...prev, [taskId]: true }));
        try {
            await axios.post(`/management/shipments/${myShipment.id}/advance-step/`);
            toast.success('تم إنجاز المحطة، اذهب للوجهة التالية');
            fetchMyRoute();
        } catch {
            toast.error('فشل تأكيد الإنجاز');
        } finally {
            setProcessing(prev => ({ ...prev, [taskId]: false }));
        }
    }, [myShipment, fetchMyRoute]);

    if (loading) {
        return (
            <div className="text-center py-5">
                <Spinner animation="border" />
            </div>
        );
    }

    if (!myShipment) {
        return (
            <div className="text-center py-5">
                <Truck size={64} className="text-muted mb-3" />
                <h5>لا توجد رحلات نشطة لك اليوم</h5>
                <Button onClick={() => fetchMyRoute(true)} variant="outline-primary" className="mt-3">
                    <RefreshCw size={16} /> تحديث
                </Button>
            </div>
        );
    }

    let routePlan = myShipment.route_plan || [];
    if (routePlan.length === 0 && myShipment.orders_details?.length > 0) {
        routePlan = myShipment.orders_details.map(order => ({
            type: 'delivery',
            address: `توصيل: ${order.customer_name} - ${order.governorate}`,
            order_id: order.id
        }));
    }

    const currentIndex = myShipment.current_step_index || 0;
    const isCompleted = currentIndex >= routePlan.length && routePlan.length > 0;

    return (
        <div className="container-fluid p-0" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="bg-primary text-white p-3 mb-2 shadow-sm sticky-top">
                <div className="d-flex justify-content-between align-items-center">
                    <div>
                        <h5 className="mb-0 fw-bold">الرحلة الشاملة #{myShipment.id}</h5>
                        <small className="d-flex align-items-center gap-1">
                            <Navigation size={14} className={locationAllowed ? 'text-success' : 'text-danger'} />
                            {locationAllowed ? 'الـ GPS متصل لايف' : 'الـ GPS معطل'}
                        </small>
                    </div>
                    <Button variant="light" size="sm" onClick={() => fetchMyRoute(true)} disabled={refreshing}>
                        <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                    </Button>
                </div>
            </div>

            <div className="px-2 pb-5 mt-3">
                {isCompleted ? (
                    <Alert variant="success" className="text-center shadow-sm border-success">
                        <CheckCircle size={48} className="mb-3 text-success mx-auto d-block" />
                        <h5 className="fw-bold">أحسنت يا بطل!</h5>
                        <p className="mb-0">تم إنهاء جميع المحطات في هذه الرحلة بنجاح. عد إلى المركز وسلم عهدتك.</p>
                    </Alert>
                ) : (
                    <>
                        <h6 className="fw-bold text-muted mb-3">
                            مسار الرحلة ({routePlan.length > 0 ? currentIndex + 1 : 0} من {routePlan.length})
                        </h6>
                        {routePlan.map((task, idx) => {
                            const isPast = idx < currentIndex;
                            const isActive = idx === currentIndex;
                            const orderData = myShipment.orders_details?.find(o => o.id === task.order_id);

                            return (
                                <Card
                                    key={idx}
                                    className={`mb-3 border-0 shadow-sm rounded-3 ${isPast ? 'opacity-50' : ''}`}
                                >
                                    <Card.Header
                                        className={`${isActive ? 'bg-primary text-white' : 'bg-light text-muted'} d-flex justify-content-between`}
                                    >
                                        <span className="fw-bold">محطة #{idx + 1}</span>
                                        {isActive && (
                                            <Badge bg="warning" text="dark" className="animate-pulse">
                                                وجهتك الحالية
                                            </Badge>
                                        )}
                                        {isPast && <Badge bg="success">تم الإنجاز</Badge>}
                                    </Card.Header>

                                    <Card.Body>
                                        <h5 className="fw-bold mb-2 d-flex align-items-center gap-2">
                                            {task.type === 'pickup' && (
                                                <><Truck className="text-danger" /> استلام من مورد</>
                                            )}
                                            {task.type === 'slaughter' && (
                                                <><Beef className="text-warning" /> التوجه للمجزر</>
                                            )}
                                            {task.type === 'delivery' && (
                                                <><MapPin className="text-success" /> توصيل لعميل</>
                                            )}
                                        </h5>

                                        <p className="text-muted fw-bold mb-3">{task.address || task.description}</p>

                                        {task.type === 'delivery' && orderData && (
                                            <div className="bg-light p-2 rounded mb-3 border">
                                                <div className="d-flex justify-content-between">
                                                    <strong>العميل: {orderData.customer_name}</strong>
                                                    {parseFloat(orderData.remaining_amount || 0) <= 0 ? (
                                                        <span className="text-success fw-bold">الطلب خالص (مسدد)</span>
                                                    ) : (
                                                        <span className="text-danger fw-bold">{orderData.remaining_amount} ج.م</span>
                                                    )}
                                                </div>
                                                <div className="small text-muted mt-1">{orderData.customer_phone}</div>
                                            </div>
                                        )}

                                        {isActive && (
                                            <div className="mt-3">
                                                {task.type === 'delivery' && orderData ? (
                                                    <div className="d-flex flex-column gap-2">
                                                        <Button
                                                            variant="info"
                                                            size="lg"
                                                            className="w-100 fw-bold shadow-sm text-white"
                                                            onClick={() => handleSendArrivalSms(orderData)}
                                                            disabled={smsLoading}
                                                        >
                                                            {smsLoading ? <Spinner size="sm" /> : <><Navigation size={20} className="me-2" /> تنبيه العميل (أنا في الطريق)</>}
                                                        </Button>

                                                        <Button
                                                            variant="primary"
                                                            size="lg"
                                                            className="w-100 fw-bold shadow-sm"
                                                            onClick={() => {
                                                                setSelectedOrder(orderData);
                                                                setCashReceived(orderData.remaining_amount || 0);
                                                                setOtpStep('request');
                                                                setShowModal(true);
                                                            }}
                                                        >
                                                            <CheckCircle size={20} className="me-2" />
                                                            تسليم الطلب والتحصيل
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="success"
                                                        size="lg"
                                                        className="w-100 fw-bold shadow-sm"
                                                        onClick={() => handleTaskComplete(idx)}
                                                        disabled={processing[idx]}
                                                    >
                                                        {processing[idx] ? (
                                                            <Spinner size="sm" />
                                                        ) : (
                                                            <>
                                                                <CheckCircle size={20} className="me-2" />
                                                                تأكيد إنجاز هذه المحطة
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            );
                        })}
                    </>
                )}
            </div>

            <Modal show={showModal} onHide={() => setShowModal(false)} centered fullscreen="sm-down">
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title className="fw-bold fs-6">
                        تسليم العميل: {selectedOrder?.customer_name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {otpStep === 'request' && (
                        <div className="text-center py-4">
                            <ShieldCheck size={64} className="text-primary mx-auto mb-3" />
                            <h5>تأكيد التسليم الآمن</h5>
                            <div className="bg-blue-50 text-blue-800 p-3 rounded-xl border border-blue-100 my-3 text-sm font-bold">
                                لديك (3) محاولات فقط لإرسال الكود للعميل. المحاولات المستخدمة: {selectedOrder?.otp_sent_count || 0}/3.
                            </div>
                            <Button
                                variant="primary"
                                size="lg"
                                className="w-100 mt-2 fw-bold"
                                onClick={handleRequestOTP}
                                disabled={otpLoading}
                            >
                                {otpLoading ? <Spinner size="sm" /> : 'إرسال كود الاستلام (OTP)'}
                            </Button>
                        </div>
                    )}

                    {otpStep === 'limit_reached' && (
                        <div className="text-center py-4">
                            <AlertTriangle size={64} className="text-danger mx-auto mb-3" />
                            <h5 className="text-danger fw-bold">استنفذت محاولاتك!</h5>
                            <p className="text-muted">لقد حاولت إرسال الكود 3 مرات ولم يتم الاستلام. النظام أوقف الإرسال لحماية الرصيد.</p>
                            <div className="bg-light p-3 rounded border font-bold">
                                يرجى الاتصال بـ (منسق الرحلات) من الإدارة ليقوم بـ (إرسال استثنائي) وقراءة الكود لك.
                            </div>
                            <Button variant="secondary" className="w-100 mt-4" onClick={() => setShowModal(false)}>
                                حسناً، سأتصل بالمنسق
                            </Button>
                        </div>
                    )}

                    {otpStep === 'verify' && (
                        <div className="text-center py-4">
                            <h5>أدخل كود الاستلام</h5>
                            <Form.Control
                                type="number"
                                className="text-center fs-2 font-monospace tracking-widest mb-3"
                                value={otpInput}
                                onChange={(e) => setOtpInput(e.target.value)}
                            />
                            <Button
                                variant="success"
                                size="lg"
                                className="w-100"
                                onClick={handleVerifyOTP}
                                disabled={otpLoading || otpInput.length !== 6}
                            >
                                {otpLoading ? <Spinner size="sm" /> : 'تحقق من الكود'}
                            </Button>
                        </div>
                    )}

                    {otpStep === 'complete' && (
                        <div>
                            {parseFloat(selectedOrder?.remaining_amount || 0) > 0 ? (
                                <>
                                    <div className="bg-danger bg-opacity-10 p-3 rounded text-center mb-4">
                                        <small className="text-danger fw-bold d-block">المطلوب تحصيله</small>
                                        <h3 className="text-danger fw-black mb-0">{selectedOrder?.remaining_amount} ج.م</h3>
                                    </div>

                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">طريقة الدفع المختارة</Form.Label>
                                        <div className="d-flex gap-2">
                                            <Button
                                                variant={paymentMethod === 'cash' ? 'success' : 'outline-success'}
                                                className="flex-fill"
                                                onClick={() => setPaymentMethod('cash')}
                                            >
                                                <DollarSign size={16} /> كاش
                                            </Button>
                                            <Button
                                                variant={paymentMethod === 'pos' ? 'primary' : 'outline-primary'}
                                                className="flex-fill"
                                                onClick={() => setPaymentMethod('pos')}
                                            >
                                                <CreditCard size={16} /> ماكينة POS
                                            </Button>
                                        </div>
                                    </Form.Group>

                                    <Form.Group className="mb-4">
                                        <Form.Label className="fw-bold text-muted small">المبلغ المستلم فعلياً</Form.Label>
                                        <div className="input-group">
                                            <Form.Control
                                                type="number"
                                                value={cashReceived}
                                                onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                                            />
                                            <span className="input-group-text">ج.م</span>
                                        </div>
                                    </Form.Group>
                                </>
                            ) : (
                                <div className="bg-success bg-opacity-10 p-4 rounded text-center mb-4 border border-success">
                                    <CheckCircle size={40} className="text-success mx-auto mb-2" />
                                    <h4 className="text-success fw-bold">الطلب خالص ومسدد بالكامل</h4>
                                    <p className="text-muted small mb-0">لا يوجد مبالغ مستحقة للتحصيل من العميل، ارفع الإيصال لإنهاء المهمة.</p>
                                </div>
                            )}

                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold text-primary small d-flex align-items-center gap-1">
                                    <Camera size={16} /> صورة الإيصال المُمضي (إجباري)
                                </Form.Label>
                                <Form.Control
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => handleFileChange(e, setReceiptImage)}
                                />
                            </Form.Group>

                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold text-info small d-flex align-items-center gap-1">
                                    <UploadCloud size={16} /> صورة مع العميل (اختياري)
                                </Form.Label>
                                <Form.Control
                                    type="file"
                                    accept="image/*"
                                    capture="environment"
                                    onChange={(e) => handleFileChange(e, setDeliveryPhoto)}
                                />
                            </Form.Group>

                            <Button
                                variant="primary"
                                size="lg"
                                className="w-100 fw-bold mt-3"
                                onClick={handleConfirmDelivery}
                                disabled={processing[selectedOrder?.id] || !receiptImage}
                            >
                                {processing[selectedOrder?.id] ? <Spinner size="sm" /> : 'تأكيد التسليم وإنهاء المحطة'}
                            </Button>
                        </div>
                    )}
                </Modal.Body>
            </Modal>

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @media (max-width: 768px) {
                    .btn {
                        min-height: 44px;
                    }
                    .modal-body {
                        padding: 16px;
                    }
                    .card {
                        margin-bottom: 12px;
                    }
                }
            `}</style>
        </div>
    );
};

export default DriverApp;

