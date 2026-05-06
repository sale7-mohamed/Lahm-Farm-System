import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Form, Button, Card, Spinner, Row, Col, Accordion, Badge, ListGroup, Alert, Container, Nav, Tab, Modal, Table } from 'react-bootstrap';
import { Search, User, Phone, Mail, Package, Save, Edit, XCircle, AlertTriangle, Percent, MapPin, Clock, Store, Briefcase, PhoneCall, Square, UserPlus, FileText, Printer, Eye, UploadCloud, PlusCircle, MessageSquare, Bell, Trash2, Calendar, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { useCall } from '../hooks/useCall';
import PrintModal from '../components/ui/PrintModal';

const AddressModal = ({ show, handleClose, customerId, onSave, addressToEdit }) => {
    const [formData, setFormData] = useState({ governorate: '', city: '', street: '', building_number: '', apartment_number: '', notes: '', is_default: false });
    const [governorates, setGovernorates] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            axios.get('/core/governorates/').then(res => setGovernorates(res.data || [])).catch(() => toast.error('فشل تحميل المحافظات'));
            if (addressToEdit) {
                setFormData({ ...addressToEdit });
            } else {
                setFormData({ governorate: '', city: '', street: '', building_number: '', apartment_number: '', notes: '', is_default: false });
            }
        }
    }, [show, addressToEdit]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (addressToEdit) {
                await axios.patch(`/management/customer-addresses/${addressToEdit.id}/`, formData);
                toast.success('تم تحديث العنوان بنجاح.');
            } else {
                await axios.post('/management/customer-addresses/', { ...formData, user: customerId });
                toast.success('تم إضافة العنوان بنجاح.');
            }
            onSave();
            handleClose();
        } catch {
            toast.error('فشل حفظ العنوان.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton><Modal.Title className="h5">{addressToEdit ? 'تعديل العنوان' : 'إضافة عنوان جديد'}</Modal.Title></Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Row className="g-3">
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="small fw-bold">المحافظة *</Form.Label>
                                <Form.Select name="governorate" value={formData.governorate} onChange={handleChange} required>
                                    <option value="">اختر المحافظة...</option>
                                    {governorates.map(g => <option key={g.id} value={g.name_ar}>{g.name_ar}</option>)}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label className="small fw-bold">المدينة/المركز *</Form.Label>
                                <Form.Control type="text" name="city" value={formData.city} onChange={handleChange} required />
                            </Form.Group>
                        </Col>
                        <Col md={12}>
                            <Form.Group>
                                <Form.Label className="small fw-bold">الشارع والتفاصيل *</Form.Label>
                                <Form.Control type="text" name="street" value={formData.street} onChange={handleChange} required />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group><Form.Label className="small fw-bold">رقم المبنى</Form.Label><Form.Control type="text" name="building_number" value={formData.building_number} onChange={handleChange} /></Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group><Form.Label className="small fw-bold">رقم الشقة/الدور</Form.Label><Form.Control type="text" name="apartment_number" value={formData.apartment_number} onChange={handleChange} /></Form.Group>
                        </Col>
                        <Col md={12}>
                            <Form.Check type="switch" name="is_default" label="تعيين كعنوان افتراضي" checked={formData.is_default} onChange={handleChange} className="fw-bold" />
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                    <Button variant="primary" type="submit" disabled={loading}>{loading ? 'جاري الحفظ...' : 'حفظ العنوان'}</Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

const CustomerLookup = () => {
    const { user } = useAuth();
    const location = useLocation();

    const [phoneQuery, setPhoneQuery] = useState('');
    const [customerData, setCustomerData] = useState(null);
    const [contactMessages, setContactMessages] = useState([]);
    const [callLogs, setCallLogs] = useState([]);
    const [combinedTimeline, setCombinedTimeline] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [searched, setSearched] = useState(false);

    const [editData, setEditData] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);

    const [activeTab, setActiveTab] = useState('orders');

    const [newName, setNewName] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const [showUploadModal, setShowUploadModal] = useState(false);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const [showAddressModal, setShowAddressModal] = useState(false);
    const [addressToEdit, setAddressToEdit] = useState(null);

    const [showCommModal, setShowCommModal] = useState(false);
    const [commType, setCommType] = useState('push');
    const [commTitle, setCommTitle] = useState('');
    const [commMessage, setCommMessage] = useState('');
    const [commSending, setCommSending] = useState(false);

    const [printConfig, setPrintConfig] = useState({ show: false, title: '', endpoint: '' });

    const { isCallActive, callStartTime, callData, setCallData, timerDisplay, startCall, endCall } = useCall();

    const getBasePhone = (p) => p ? p.replace(/\D/g, '').slice(-10) : '';

    const isValidIdentifier = (val) => {
        if (!val) return false;
        const clean = val.replace(/\s+/g, '');
        if (clean.includes('@')) return /^\S+@\S+\.\S+$/.test(clean);
        return /^(\+?20|0)?1[0-9]{9}$/.test(clean);
    };

    const fetchCallLogsForUnregistered = useCallback(async (phone) => {
        try {
            const res = await axios.get(`/management/call-logs/?search=${phone}`);
            setCallLogs(res.data.results || []);
            if (res.data.results?.length > 0) setActiveTab('call_log');
        } catch (e) {
            console.error(e);
        }
    }, []);

    const performSearch = useCallback(async (phoneToSearch) => {
        setLoading(true);
        setError('');
        setCustomerData(null);
        setContactMessages([]);
        setCallLogs([]);
        setCombinedTimeline([]);
        setSearched(true);
        setIsEditing(false);
        setActiveTab('orders');

        try {
            const response = await axios.get(`/management/customer-lookup/?phone=${phoneToSearch}`);
            const data = response.data;
            setCustomerData(data);
            setContactMessages(data.contact_messages || []);
            setCallLogs(data.call_logs || []);

            const sms = (data.sms_logs || []).map(item => ({ ...item, timelineType: item.message_type === 'EMAIL' ? 'email' : 'sms', dateObj: new Date(item.created_at) }));
            const push = (data.push_notifications || []).map(item => ({ ...item, timelineType: 'push', dateObj: new Date(item.created_at) }));
            const combinedRaw = [...sms, ...push].sort((a, b) => b.dateObj - a.dateObj);

            const uniqueTimeline = [];
            const seenMessages = new Set();

            combinedRaw.forEach(item => {
                const timeKey = item.dateObj.toISOString().slice(0, 16);
                const contentKey = item.message || item.content;
                const titleKey = item.title || '';
                const uniqueKey = `${timeKey}-${contentKey}-${titleKey}`;

                if (!seenMessages.has(uniqueKey)) {
                    seenMessages.add(uniqueKey);
                    uniqueTimeline.push(item);
                }
            });

            setCombinedTimeline(uniqueTimeline);

            const details = data.user_details;
            setEditData({
                notes: details.notes || '',
                is_suspended: details.is_suspended || false,
                suspension_reason: details.suspension_reason || '',
                custom_notification: details.custom_notification || '',
                is_restricted: details.is_restricted || false,
                restriction_reason: details.restriction_reason || '',
                allow_global_discount: details.allow_global_discount ?? true,
                is_discount_active: !!details.is_discount_active,
                special_discount_type: details.special_discount_type || 'percentage',
                special_discount_percentage: details.special_discount_percentage || 0,
                special_discount_amount: details.special_discount_amount || 0,
                discount_applies_to_services: details.discount_applies_to_services || false,
                discount_start_date: details.discount_start_date ? details.discount_start_date.slice(0, 16) : '',
                discount_end_date: details.discount_end_date ? details.discount_end_date.slice(0, 16) : '',
                discount_max_animals: details.discount_max_animals || 0,
                discount_custom_message: details.discount_custom_message || '',
                is_corporate: details.is_corporate || false,
                business_name: details.business_name || '',
            });
        } catch (err) {
            const errorMessage = err.response?.data?.detail || "لا يوجد عميل مسجل بهذا الرقم.";
            setError(errorMessage);
            setCustomerData(null);
            if (err.response?.status === 404) {
                fetchCallLogsForUnregistered(phoneToSearch);
            }
        } finally {
            setLoading(false);
        }
    }, [fetchCallLogsForUnregistered]);

    useEffect(() => {
        if (location.state?.searchPhone) {
            setPhoneQuery(location.state.searchPhone);
            if (location.state?.searchName) {
                setNewName(location.state.searchName);
            }
            performSearch(location.state.searchPhone);
            window.history.replaceState({}, document.title);
        }
    }, [location.state, performSearch]);

    useEffect(() => {
        if (isCallActive && callData?.customer_phone && !searched && !loading && !phoneQuery) {
            setPhoneQuery(callData.customer_phone);
            performSearch(callData.customer_phone);
        }
    }, [isCallActive, callData?.customer_phone, searched, loading, performSearch, phoneQuery]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (!phoneQuery) {
            toast.warn("يرجى إدخال رقم هاتف للبحث.");
            return;
        }
        performSearch(phoneQuery);
    };

    const handleCreateAccount = async (e) => {
        e.preventDefault();
        if (!newName.trim()) {
            toast.warn("يرجى إدخال اسم العميل");
            return;
        }
        setIsCreating(true);
        try {
            const isEmail = phoneQuery.includes('@');
            await axios.post('/management/customer-lookup/', {
                phone: isEmail ? '' : phoneQuery,
                email: isEmail ? phoneQuery : '',
                full_name: newName.trim()
            });
            toast.success("تم إنشاء الحساب بنجاح");
            performSearch(phoneQuery);
        } catch (err) {
            console.error(err);
            toast.error("فشل إنشاء الحساب");
        } finally {
            setIsCreating(false);
        }
    };

    const handleEditChange = (e) => {
        const { name, value, type, checked } = e.target;
        const newValue = (type === 'checkbox' || type === 'radio' || e.target.getAttribute('role') === 'switch') ? checked : value;
        setEditData(prev => ({ ...prev, [name]: newValue }));
    };

    const handleSaveChanges = async () => {
        if (!customerData) return;
        if (editData.is_discount_active) {
            if (editData.special_discount_type === 'percentage') {
                const percent = parseFloat(editData.special_discount_percentage);
                if (!percent || percent <= 0) {
                    toast.warn("لا يمكن تفعيل الخصم الخاص وقيمته 0%. يرجى إدخال نسبة أكبر من صفر.");
                    return;
                }
            } else if (editData.special_discount_type === 'fixed') {
                const amount = parseFloat(editData.special_discount_amount);
                if (!amount || amount <= 0) {
                    toast.warn("لا يمكن تفعيل الخصم الخاص والمبلغ 0. يرجى إدخال مبلغ أكبر من صفر.");
                    return;
                }
            }
            const maxAnimals = parseInt(editData.discount_max_animals, 10);
            if (isNaN(maxAnimals) || maxAnimals < 0) {
                toast.warn("يرجى إدخال عدد صحيح غير سالب لأقصى عدد مواشي.");
                return;
            }
        }
        setSaving(true);
        try {
            const response = await axios.patch(`/management/customer-lookup/?phone=${customerData.user_details.phone}`, editData);
            if (response.data.detail?.includes("للموافقة")) {
                toast.info(response.data.detail);
            } else {
                toast.success("تم حفظ التغييرات بنجاح.");
                performSearch(customerData.user_details.phone);
            }
            setIsEditing(false);
        } catch (err) {
            const errorMessage = err.response?.data?.detail || "فشل حفظ التغييرات.";
            toast.error(errorMessage);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteAddress = async (id) => {
        if (!window.confirm('حذف العنوان؟')) return;
        try {
            await axios.delete(`/management/customer-addresses/${id}/`);
            toast.success('تم الحذف');
            performSearch(customerData.user_details.phone);
        } catch {
            toast.error('فشل الحذف');
        }
    };

    const handleUploadContract = async (e) => {
        e.preventDefault();
        if (!uploadFile || !uploadTitle) {
            toast.warn("يرجى إدخال اسم العقد واختيار الملف");
            return;
        }

        const formData = new FormData();
        formData.append('title', uploadTitle);
        formData.append('document_type', 'b2b_contract');
        formData.append('b2b_customer', customerData.user_details.id);
        formData.append('file', uploadFile);

        setIsUploading(true);
        try {
            await axios.post('/management/document-archive/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("تم رفع العقد وتوثيقه في الأرشيف بنجاح");
            setShowUploadModal(false);
            setUploadTitle('');
            setUploadFile(null);
            performSearch(customerData.user_details.phone);
        } catch {
            toast.error("فشل رفع العقد");
        } finally {
            setIsUploading(false);
        }
    };

    const handleDirectCommunicate = async (e) => {
        e.preventDefault();
        if (!commMessage.trim() || (commType === 'push' && !commTitle.trim())) {
            toast.warn("يرجى إكمال الحقول المطلوبة");
            return;
        }

        setCommSending(true);
        try {
            if (commType === 'push') {
                await axios.post('/messaging/send/push_single/', {
                    phone: customerData.user_details.phone,
                    title: commTitle,
                    message: commMessage,
                    category: 'general'
                });
                toast.success("تم إرسال الإشعار للعميل بنجاح");
            } else {
                await axios.post('/messaging/send/bulk_send/', {
                    phones: [customerData.user_details.phone],
                    message: commMessage
                });
                toast.success("تم إرسال رسالة SMS للعميل بنجاح");
            }
            setShowCommModal(false);
            setCommTitle('');
            setCommMessage('');
            performSearch(customerData.user_details.phone);
        } catch (error) {
            toast.error(error.response?.data?.detail || "فشل الإرسال");
        } finally {
            setCommSending(false);
        }
    };

    const getServiceNames = (services) => {
        if (!services || typeof services !== 'object') return 'لا يوجد';

        const serviceMap = {
            'slaughter': 'ذبح',
            'cutting': 'تقطيع',
            'packaging': 'تغليف'
        };

        const activeServices = [];
        const serviceCosts = services._service_costs || {};

        Object.keys(services).forEach(key => {
            if (key.startsWith('_') || key === 'is_group_creator') return;

            if (services[key] === true || services[key] === 'yes') {
                const arName = serviceMap[key] || key;
                const cost = serviceCosts[key] || 0;
                activeServices.push(cost > 0 ? `${arName} (${cost} ج)` : arName);
            } else if (typeof services[key] === 'string' && services[key] !== 'no' && services[key] !== 'false') {
                activeServices.push(`${key} (${services[key]} ج)`);
            }
        });

        return activeServices.length > 0 ? activeServices.join('، ') : 'لا يوجد';
    };

    const handleStartCall = () => {
        const phoneToUse = customerData ? customerData.user_details.phone : phoneQuery;
        const nameToUse = customerData ? customerData.user_details.full_name : 'غير مسجل';
        startCall(phoneToUse, nameToUse);
        setActiveTab('call_log');
    };

    const handleStopCallAndSave = async (e) => {
        e.preventDefault();
        if (!callData.notes.trim()) {
            toast.warn("يجب كتابة ملخص المكالمة.");
            return;
        }

        const payload = {
            ...callData,
            customer_phone: callData.customer_phone,
            customer_name: callData.customer_name,
            start_time: callStartTime ? new Date(callStartTime).toISOString() : new Date().toISOString(),
            end_time: new Date().toISOString()
        };

        try {
            await axios.post('/management/call-logs/', payload);
            toast.success("تم حفظ المكالمة بنجاح");
            endCall();

            if (getBasePhone(phoneQuery) === getBasePhone(payload.customer_phone)) {
                const res = await axios.get(`/management/call-logs/?search=${payload.customer_phone}`);
                setCallLogs(res.data.results || []);
            }
        } catch (err) {
            toast.error("فشل حفظ المكالمة");
            console.error(err);
        }
    };

    const searchedPhoneNormal = customerData ? customerData.user_details.phone : phoneQuery;
    const isActiveCallForThisCustomer = isCallActive && getBasePhone(callData?.customer_phone) === getBasePhone(searchedPhoneNormal);

    return (
        <Container fluid className="px-2 px-md-3 px-lg-4">
            <h1 className="mb-3 mb-md-4" style={{ fontSize: 'clamp(1.5rem, 4vw, 2rem)' }}>بحث عن عميل / إدارة</h1>

            <Card className="shadow-sm mb-4">
                <Card.Body className="p-3 p-md-4">
                    <Form onSubmit={handleSearch}>
                        <Row className="align-items-center g-2">
                            <Col xs={12} md={9}>
                                <Form.Control
                                    type="text"
                                    placeholder="أدخل رقم الهاتف أو البريد الإلكتروني للبحث..."
                                    value={phoneQuery}
                                    onChange={(e) => setPhoneQuery(e.target.value)}
                                    required
                                    size="lg"
                                    className="mb-2 mb-md-0"
                                    dir="ltr"
                                />
                            </Col>
                            <Col xs={12} md={3}>
                                <Button
                                    type="submit"
                                    className="w-100"
                                    disabled={loading}
                                    size="lg"
                                >
                                    {loading ? (
                                        <>
                                            <Spinner as="span" animation="border" size="sm" className="me-1" />
                                            جاري البحث...
                                        </>
                                    ) : (
                                        <>
                                            <Search size={18} className="me-1" />
                                            بحث
                                        </>
                                    )}
                                </Button>
                            </Col>
                        </Row>
                    </Form>
                </Card.Body>
            </Card>

            {searched && !loading && (
                error ? (
                    <div className="mt-3">
                        <Alert variant="warning" className="d-flex align-items-center gap-2">
                            <AlertTriangle size={20} />
                            {error}
                        </Alert>

                        {isValidIdentifier(phoneQuery) && !phoneQuery.includes('@') && (
                            <Card className="mt-3 border-success shadow-sm animate-fade-in-up">
                                <Card.Header className="bg-success text-white">
                                    <h6 className="mb-0 d-flex align-items-center gap-2">
                                        <UserPlus size={18} />
                                        إنشاء حساب جديد للرقم: <span dir="ltr">{phoneQuery}</span>
                                    </h6>
                                </Card.Header>
                                <Card.Body>
                                    <Form onSubmit={handleCreateAccount}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>اسم العميل</Form.Label>
                                            <Form.Control
                                                type="text"
                                                placeholder="أدخل اسم العميل (ثلاثي يفضل)..."
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                required
                                            />
                                        </Form.Group>
                                        <Button type="submit" variant="success" disabled={isCreating} className="w-100">
                                            {isCreating ? <Spinner size="sm" className="me-2" /> : <UserPlus size={18} className="me-2" />}
                                            إنشاء وفتح الملف
                                        </Button>
                                    </Form>
                                </Card.Body>
                            </Card>
                        )}

                        {callLogs.length > 0 && (
                            <Card className="mt-3 border-info">
                                <Card.Header className="bg-info text-white">سجل المكالمات (زائر)</Card.Header>
                                <ListGroup variant="flush">
                                    {callLogs.map(log => (
                                        <ListGroup.Item key={log.id} className="py-3">
                                            <div className="d-flex justify-content-between mb-2">
                                                <div>
                                                    <small className="text-muted d-block" dir="ltr" style={{textAlign: 'right'}}>
                                                        {format(new Date(log.start_time), 'yyyy-MM-dd hh:mm a')}
                                                    </small>
                                                </div>
                                                <Badge bg="info">{log.reason_display || log.reason}</Badge>
                                            </div>
                                            <p className="mb-1 mt-2"><strong>الموظف:</strong> {log.handled_by_name || 'غير معروف'}</p>
                                            <p className="mb-0"><strong>ملخص:</strong> {log.notes}</p>
                                        </ListGroup.Item>
                                    ))}
                                </ListGroup>
                            </Card>
                        )}
                    </div>
                ) : customerData && (
                    <div className="mt-3">
                        {customerData.user_details.is_suspended && (
                            <Alert variant="danger" className="mb-3">
                                <AlertTriangle className="me-2" />
                                <strong>حساب موقوف!</strong> السبب: {customerData.user_details.suspension_reason || 'غير محدد'}.
                            </Alert>
                        )}

                        {customerData.user_details.is_restricted && (
                            <Alert variant="warning" className="mb-3">
                                <AlertTriangle className="me-2" />
                                <strong>حساب مقيد!</strong> السبب: {customerData.user_details.restriction_reason || 'غير محدد'}.
                            </Alert>
                        )}

                        <Row className="g-3">
                            <Col lg={4}>
                                <Card className="mb-3 border-primary shadow-sm">
                                    <Card.Header className="bg-primary text-white py-3">
                                        <h6 className="mb-0 d-flex align-items-center gap-2">
                                            <PhoneCall size={18} />
                                            إدارة المكالمات
                                        </h6>
                                    </Card.Header>
                                    <Card.Body className="py-3">
                                        {isCallActive && !isActiveCallForThisCustomer ? (
                                            <div className="text-center">
                                                <AlertTriangle size={48} className="text-warning mx-auto mb-2" />
                                                <h6 className="text-danger fw-bold mb-2">لديك مكالمة جارية حالياً مع عميل آخر!</h6>
                                                <p className="mb-3">{callData.customer_name} <br/><span dir="ltr">({callData.customer_phone})</span></p>
                                                <Button
                                                    variant="primary"
                                                    onClick={() => {
                                                        setPhoneQuery(callData.customer_phone);
                                                        performSearch(callData.customer_phone);
                                                    }}
                                                    className="w-100"
                                                >
                                                    فتح ملف المكالمة الجارية
                                                </Button>
                                            </div>
                                        ) : !isCallActive ? (
                                            <Button
                                                variant="outline-primary"
                                                onClick={handleStartCall}
                                                disabled={!customerData && !phoneQuery}
                                                className="w-100"
                                                size="lg"
                                            >
                                                <PhoneCall size={18} className="me-1" /> بدء مكالمة مع هذا العميل
                                            </Button>
                                        ) : (
                                            <div>
                                                <div className="text-center mb-3">
                                                    <div className="badge bg-danger mb-2 animate-pulse px-3 py-2">مكالمة جارية...</div>
                                                    <h2 className="display-6 font-monospace" dir="ltr">{timerDisplay}</h2>
                                                </div>
                                                <Form onSubmit={handleStopCallAndSave}>
                                                    <Form.Group className="mb-2">
                                                        <Form.Label>سبب المكالمة</Form.Label>
                                                        <Form.Select
                                                            name="reason"
                                                            value={callData.reason}
                                                            onChange={(e) => setCallData({ ...callData, reason: e.target.value })}
                                                        >
                                                            <option value="inquiry">استفسار</option>
                                                            <option value="complaint">شكوى</option>
                                                            <option value="order">طلب</option>
                                                            <option value="support">دعم فني</option>
                                                            <option value="other">أخرى</option>
                                                        </Form.Select>
                                                    </Form.Group>
                                                    <Form.Group className="mb-2">
                                                        <Form.Label>حالة المكالمة</Form.Label>
                                                        <Form.Select
                                                            name="status"
                                                            value={callData.status}
                                                            onChange={(e) => setCallData({ ...callData, status: e.target.value })}
                                                        >
                                                            <option value="resolved">تم الحل / الانتهاء</option>
                                                            <option value="pending">قيد المتابعة</option>
                                                        </Form.Select>
                                                    </Form.Group>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label>ملخص وملاحظات <span className="text-danger">*</span></Form.Label>
                                                        <Form.Control
                                                            as="textarea"
                                                            rows={3}
                                                            name="notes"
                                                            value={callData.notes}
                                                            onChange={(e) => setCallData({ ...callData, notes: e.target.value })}
                                                            required
                                                            placeholder="اكتب باختصار ما تم في المكالمة..."
                                                        />
                                                    </Form.Group>
                                                    <Button type="submit" variant="danger" className="w-100" size="lg">
                                                        <Square size={18} className="me-2" /> إنهاء وحفظ المكالمة
                                                    </Button>
                                                </Form>
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>

                                <Card className="mb-3 shadow-sm">
                                    <Card.Header className="d-flex justify-content-between align-items-center py-3 bg-white flex-wrap gap-2">
                                        <h5 className="mb-0">بيانات العميل</h5>
                                        <div className="d-flex gap-2">
                                            <Button variant="outline-success" size="sm" onClick={() => { setCommType('push'); setShowCommModal(true); }}>
                                                <Bell size={14} className="me-1"/> إشعار (Push)
                                            </Button>
                                            <Button variant="outline-primary" size="sm" onClick={() => { setCommType('sms'); setShowCommModal(true); }}>
                                                <MessageSquare size={14} className="me-1"/> رسالة (SMS)
                                            </Button>
                                            {!isEditing && (
                                                <Button variant="light" size="sm" onClick={() => setIsEditing(true)} className="text-primary border">
                                                    <Edit size={14} className="me-1"/> تعديل البيانات
                                                </Button>
                                            )}
                                        </div>
                                    </Card.Header>
                                    <ListGroup variant="flush">
                                        <ListGroup.Item className="py-3 bg-light border-bottom">
                                            <div className="d-flex flex-column gap-2 small text-muted">
                                                <div className="d-flex justify-content-between">
                                                    <span><Calendar size={14} className="me-1"/> <strong>تاريخ التسجيل:</strong></span>
                                                    <span dir="ltr" className="fw-bold text-dark">{customerData.user_details.date_joined ? format(new Date(customerData.user_details.date_joined), 'yyyy-MM-dd') : 'غير محدد'}</span>
                                                </div>
                                                <div className="d-flex justify-content-between">
                                                    <span><Phone size={14} className="me-1"/> <strong>توثيق الهاتف:</strong></span>
                                                    <span>
                                                        {customerData.user_details.is_phone_verified ?
                                                        <span className="text-success fw-bold"><CheckCircle size={12}/> نعم ({customerData.user_details.phone_verified_at ? format(new Date(customerData.user_details.phone_verified_at), 'yyyy-MM-dd') : 'مسبقاً'})</span> :
                                                        <span className="text-danger fw-bold"><XCircle size={12}/> لا</span>}
                                                    </span>
                                                </div>
                                                <div className="d-flex justify-content-between">
                                                    <span><Mail size={14} className="me-1"/> <strong>توثيق البريد:</strong></span>
                                                    <span>
                                                        {customerData.user_details.is_email_verified ?
                                                        <span className="text-success fw-bold"><CheckCircle size={12}/> نعم ({customerData.user_details.email_verified_at ? format(new Date(customerData.user_details.email_verified_at), 'yyyy-MM-dd') : 'مسبقاً'})</span> :
                                                        <span className="text-danger fw-bold"><XCircle size={12}/> لا</span>}
                                                    </span>
                                                </div>
                                            </div>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="py-3">
                                            <User className="me-2 text-muted" size={18} />
                                            <strong>الاسم:</strong> {customerData.user_details.full_name}
                                        </ListGroup.Item>
                                        <ListGroup.Item className="py-3">
                                            <Phone className="me-2 text-muted" size={18} />
                                            <strong>الهاتف:</strong> <span dir="ltr">{customerData.user_details.phone}</span>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="py-3">
                                            <Mail className="me-2 text-muted" size={18} />
                                            <strong>البريد:</strong> <span dir="ltr">{customerData.user_details.email || 'غير مسجل'}</span>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="py-3">
                                            <Package className="me-2 text-muted" size={18} />
                                            <strong>إجمالي الطلبات:</strong> {customerData.order_count}
                                        </ListGroup.Item>
                                        <ListGroup.Item className={`py-3 ${customerData.user_details.is_discount_active ? "bg-success bg-opacity-10" : ""}`}>
                                            <div className="d-flex flex-column gap-2">
                                                <div className="d-flex justify-content-between align-items-center">
                                                    <div>
                                                        <Percent className="me-2 text-success" size={18} />
                                                        <strong>حالة الخصم:</strong>
                                                    </div>
                                                    <Badge bg={customerData.user_details.is_discount_active ? "success" : (customerData.user_details.allow_global_discount ? "info" : "secondary")}>
                                                        {customerData.user_details.is_discount_active
                                                            ? `خاص (${customerData.user_details.special_discount_type === 'fixed' ? customerData.user_details.special_discount_amount + ' ج.م قسيمة' : Number(customerData.user_details.special_discount_percentage) + '%'})`
                                                            : (customerData.user_details.allow_global_discount ? "عام فقط" : "لا يوجد")}
                                                    </Badge>
                                                </div>
                                                {customerData.user_details.is_discount_active && customerData.user_details.discount_max_animals > 0 && (
                                                    <div className="small fw-bold text-success mt-1">
                                                        الاستخدام: {customerData.user_details.discount_used_animals} من أصل {customerData.user_details.discount_max_animals} (سينتهي الخصم آلياً عند الاستهلاك)
                                                    </div>
                                                )}
                                                {customerData.user_details.voucher_used_in_order_id && (
                                                    <div className="small fw-bold text-muted bg-white p-2 rounded border mt-2">
                                                        <CheckCircle size={14} className="text-success me-1"/>
                                                        تم استخدام هذه القسيمة في طلب رقم <strong>#{customerData.user_details.voucher_used_in_order_id}</strong>
                                                        <div className="text-muted mt-1" dir="ltr" style={{textAlign: 'right'}}>
                                                            {format(new Date(customerData.user_details.voucher_used_at), 'yyyy-MM-dd hh:mm a')}
                                                        </div>
                                                    </div>
                                                )}
                                                {customerData.user_details.discount_custom_message && (
                                                    <div className="small text-muted fst-italic border-top pt-2 mt-2">
                                                        "{customerData.user_details.discount_custom_message}"
                                                    </div>
                                                )}
                                            </div>
                                        </ListGroup.Item>
                                    </ListGroup>

                                    {customerData.user_details.is_corporate && (
                                        <div className="bg-primary bg-opacity-10 border border-primary p-3 rounded-3 m-3 d-flex align-items-center gap-3 shadow-sm">
                                            <div className="bg-white p-2 rounded-circle text-primary shadow-sm">
                                                <Store size={28} />
                                            </div>
                                            <div>
                                                <h5 className="mb-1 text-primary fw-black">حساب أعمال (B2B)</h5>
                                                <p className="mb-0 fw-bold text-dark">{customerData.user_details.business_name || 'بدون اسم تجاري مسجل'}</p>
                                            </div>
                                        </div>
                                    )}

                                    <Card.Body className="py-3 bg-light border-top">
                                        <h6 className="fw-bold text-secondary">ملاحظات إدارية (مخفية عن العميل)</h6>
                                        {isEditing ? (
                                            <Form.Control
                                                as="textarea"
                                                rows={3}
                                                name="notes"
                                                value={editData.notes}
                                                onChange={handleEditChange}
                                                className="mt-2"
                                            />
                                        ) : (
                                            <p className="text-muted mt-2 mb-0 small">
                                                {customerData.user_details.notes || 'لا توجد ملاحظات.'}
                                            </p>
                                        )}
                                    </Card.Body>
                                </Card>

                                {customerData.user_details.is_corporate && (
                                    <>
                                        <Card className="mb-3 border-dark shadow-sm">
                                            <Card.Header className="bg-dark text-white py-3 d-flex align-items-center justify-content-between">
                                                <h6 className="mb-0 d-flex align-items-center gap-2">
                                                    <FileText size={18} />
                                                    عقود الشركة (B2B)
                                                </h6>
                                                <div className="d-flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="primary"
                                                        className="fw-bold"
                                                        onClick={() => setShowUploadModal(true)}
                                                    >
                                                        <UploadCloud size={14} className="me-1" /> رفع عقد
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="light"
                                                        className="text-dark fw-bold border"
                                                        onClick={() => {
                                                            setPrintConfig({ show: true, title: `عقد أعمال (B2B)`, endpoint: `/contracts/b2b/?user_id=${customerData.user_details.id}` });
                                                        }}
                                                    >
                                                        <Printer size={14} className="me-1" /> طباعة
                                                    </Button>
                                                </div>
                                            </Card.Header>
                                            <Card.Body className="p-0">
                                                <ListGroup variant="flush">
                                                    {customerData.b2b_contracts && customerData.b2b_contracts.length > 0 ? (
                                                        customerData.b2b_contracts.map(contract => (
                                                            <ListGroup.Item key={contract.id} className="d-flex justify-content-between align-items-center py-3">
                                                                <div>
                                                                    <div className="fw-bold text-dark">{contract.title}</div>
                                                                    <small className="text-muted">{format(new Date(contract.created_at), 'yyyy-MM-dd')}</small>
                                                                </div>
                                                                <Button
                                                                    variant="outline-success"
                                                                    size="sm"
                                                                    onClick={() => window.open(contract.file, '_blank')}
                                                                >
                                                                    <Eye size={14} className="me-1" /> عرض العقد المرفوع
                                                                </Button>
                                                            </ListGroup.Item>
                                                        ))
                                                    ) : (
                                                        <ListGroup.Item className="text-center text-muted py-4">
                                                            <AlertTriangle size={24} className="mb-2 opacity-50" />
                                                            <p className="mb-0 small">لم يتم رفع أي عقد موقع لهذه الشركة حتى الآن في الأرشيف.</p>
                                                        </ListGroup.Item>
                                                    )}
                                                </ListGroup>
                                            </Card.Body>
                                            <Card.Footer className="bg-light text-center">
                                                <small className="text-muted">لرفع عقد جديد موقع، استخدم الزر أعلى القائمة.</small>
                                            </Card.Footer>
                                        </Card>
                                    </>
                                )}

                                {isEditing && (
                                    <Card className="mb-3 border-info shadow-sm">
                                        <Card.Header className="bg-info text-white py-3">
                                            <h6 className="mb-0 d-flex align-items-center gap-2">
                                                <Briefcase size={18} />
                                                توصيف العميل (شركات/أعمال)
                                            </h6>
                                        </Card.Header>
                                        <Card.Body className="py-3">
                                            <Form.Check
                                                type="switch"
                                                id="is_corporate"
                                                name="is_corporate"
                                                label={
                                                    <span className="fw-bold">
                                                        {editData.is_corporate ? "حساب تجاري (شركة/مطعم)" : "حساب فردي (أفراد)"}
                                                    </span>
                                                }
                                                checked={!!editData.is_corporate}
                                                onChange={handleEditChange}
                                                className="mb-2"
                                            />

                                            {editData.is_corporate && (
                                                <div className="mt-3">
                                                    <Form.Group>
                                                        <Form.Label>اسم النشاط التجاري</Form.Label>
                                                        <Form.Control
                                                            type="text"
                                                            name="business_name"
                                                            value={editData.business_name}
                                                            onChange={handleEditChange}
                                                            placeholder="مثال: مطعم البركة، فندق رمسيس..."
                                                        />
                                                    </Form.Group>
                                                </div>
                                            )}
                                        </Card.Body>
                                    </Card>
                                )}

                                {isEditing && (
                                    <Card className="mb-3 border-success shadow-sm">
                                        <Card.Header className="bg-success text-white py-3">
                                            <h6 className="mb-0">إدارة الخصومات</h6>
                                        </Card.Header>
                                        <Card.Body className="py-3">
                                            <div className="p-3 mb-3 border rounded bg-light">
                                                <Form.Check
                                                    type="switch"
                                                    id="allow_global_discount"
                                                    name="allow_global_discount"
                                                    label={
                                                        <span className="fw-bold">
                                                            {editData.allow_global_discount ? "يستفيد من الخصم العام (مفعل)" : "محروم من الخصم العام (متوقف)"}
                                                        </span>
                                                    }
                                                    checked={!!editData.allow_global_discount}
                                                    onChange={handleEditChange}
                                                />
                                            </div>

                                            <div className="p-3 border rounded bg-white">
                                                <Form.Check
                                                    type="switch"
                                                    id="is_discount_active"
                                                    name="is_discount_active"
                                                    label={
                                                        <span className="fw-bold">
                                                            {editData.is_discount_active ? "تخصيص خصم خاص (سيلغي العام)" : "لا يوجد خصم خاص"}
                                                        </span>
                                                    }
                                                    checked={!!editData.is_discount_active}
                                                    onChange={handleEditChange}
                                                    className="mb-2"
                                                />

                                                {editData.is_discount_active && (
                                                    <div className="ps-2 ps-md-3 border-start border-3 border-success pe-2 mt-3">
                                                        <Form.Group className="mb-3">
                                                            <Form.Label>نوع الخصم الخاص</Form.Label>
                                                            <Form.Select
                                                                name="special_discount_type"
                                                                value={editData.special_discount_type}
                                                                onChange={handleEditChange}
                                                            >
                                                                <option value="percentage">نسبة مئوية (%)</option>
                                                                <option value="fixed">مبلغ ثابت كقسيمة (ج.م)</option>
                                                            </Form.Select>
                                                        </Form.Group>

                                                        {editData.special_discount_type === 'fixed' ? (
                                                            <Form.Group className="mb-3">
                                                                <Form.Label>مبلغ الخصم (ج.م)</Form.Label>
                                                                <Form.Control
                                                                    type="number"
                                                                    min="0"
                                                                    name="special_discount_amount"
                                                                    value={editData.special_discount_amount}
                                                                    onChange={handleEditChange}
                                                                />
                                                            </Form.Group>
                                                        ) : (
                                                            <Form.Group className="mb-3">
                                                                <Form.Label>نسبة الخصم (%)</Form.Label>
                                                                <Form.Control
                                                                    type="number"
                                                                    min="0"
                                                                    max="100"
                                                                    step="0.01"
                                                                    name="special_discount_percentage"
                                                                    value={editData.special_discount_percentage}
                                                                    onChange={handleEditChange}
                                                                />
                                                            </Form.Group>
                                                        )}

                                                        <Form.Check
                                                            type="switch"
                                                            id="discount_services"
                                                            name="discount_applies_to_services"
                                                            label="تطبيق الخصم على الخدمات أيضاً"
                                                            checked={editData.discount_applies_to_services}
                                                            onChange={handleEditChange}
                                                            className="mb-3"
                                                        />

                                                        <Form.Group className="mb-3">
                                                            <Form.Label>رسالة خاصة للعميل</Form.Label>
                                                            <Form.Control
                                                                type="text"
                                                                name="discount_custom_message"
                                                                value={editData.discount_custom_message}
                                                                onChange={handleEditChange}
                                                                placeholder="مثال: خصم خاص لك يا غالي!"
                                                            />
                                                        </Form.Group>

                                                        <Row className="g-2">
                                                            <Col xs={12} md={4}>
                                                                <Form.Group className="mb-2">
                                                                    <Form.Label>أقصى عدد مواشي</Form.Label>
                                                                    <Form.Control
                                                                        type="number"
                                                                        name="discount_max_animals"
                                                                        value={editData.discount_max_animals || 0}
                                                                        onChange={handleEditChange}
                                                                        min="0"
                                                                        step="1"
                                                                    />
                                                                </Form.Group>
                                                            </Col>
                                                            <Col xs={12} md={4}>
                                                                <Form.Group className="mb-2">
                                                                    <Form.Label>تاريخ البدء</Form.Label>
                                                                    <Form.Control
                                                                        type="datetime-local"
                                                                        name="discount_start_date"
                                                                        value={editData.discount_start_date}
                                                                        onChange={handleEditChange}
                                                                    />
                                                                </Form.Group>
                                                            </Col>
                                                            <Col xs={12} md={4}>
                                                                <Form.Group className="mb-2">
                                                                    <Form.Label>تاريخ الانتهاء</Form.Label>
                                                                    <Form.Control
                                                                        type="datetime-local"
                                                                        name="discount_end_date"
                                                                        value={editData.discount_end_date}
                                                                        onChange={handleEditChange}
                                                                    />
                                                                </Form.Group>
                                                            </Col>
                                                        </Row>
                                                    </div>
                                                )}
                                            </div>
                                        </Card.Body>
                                    </Card>
                                )}

                                <Card className="mb-3 shadow-sm">
                                    <Card.Header className="py-3 bg-white d-flex justify-content-between align-items-center">
                                        <h5 className="mb-0 fw-bold d-flex align-items-center">
                                            <MapPin size={18} className="me-2 text-danger" />
                                            العناوين المسجلة
                                        </h5>
                                        <Button
                                            variant="outline-primary"
                                            size="sm"
                                            onClick={() => {setAddressToEdit(null); setShowAddressModal(true);}}
                                        >
                                            <PlusCircle size={14} className="me-1" /> إضافة عنوان
                                        </Button>
                                    </Card.Header>
                                    <ListGroup variant="flush">
                                        {customerData.addresses && customerData.addresses.length > 0 ? (
                                            customerData.addresses.map(addr => (
                                                <ListGroup.Item key={addr.id} className="py-3">
                                                    <div className="fw-bold">{addr.city}, {addr.governorate}</div>
                                                    <div className="text-muted small mt-1">
                                                        {addr.street}
                                                        {addr.building_number && ` - مبنى: ${addr.building_number}`}
                                                        {addr.apartment_number && ` - شقة: ${addr.apartment_number}`}
                                                    </div>
                                                    {addr.notes && <div className="text-muted small mt-1 fst-italic">ملاحظات: {addr.notes}</div>}
                                                    {addr.is_default && <Badge bg="primary" className="mt-2">الافتراضي</Badge>}
                                                    <div className="mt-2 d-flex gap-2">
                                                        <Button variant="outline-secondary" size="sm" className="py-0 px-2" onClick={() => {setAddressToEdit(addr); setShowAddressModal(true);}}><Edit size={12}/></Button>
                                                        <Button variant="outline-danger" size="sm" className="py-0 px-2" onClick={() => handleDeleteAddress(addr.id)}><Trash2 size={12}/></Button>
                                                    </div>
                                                </ListGroup.Item>
                                            ))
                                        ) : (
                                            <ListGroup.Item className="text-muted py-4 text-center small">
                                                لا توجد عناوين مسجلة لهذا العميل.
                                            </ListGroup.Item>
                                        )}
                                    </ListGroup>
                                </Card>

                                {isEditing && (
                                    <Card className="mb-3 border-danger shadow-sm">
                                        <Card.Header className="bg-danger text-white py-3">
                                            <h6 className="mb-0">إجراءات إدارية خطرة</h6>
                                        </Card.Header>
                                        <Card.Body className="py-3">
                                            <Form.Check
                                                type="switch"
                                                id="is_suspended"
                                                name="is_suspended"
                                                label={<span className="fw-bold text-danger">إيقاف حساب العميل (منع الدخول للموقع)</span>}
                                                checked={editData.is_suspended}
                                                onChange={handleEditChange}
                                                className="mb-2"
                                            />
                                            {!user.is_superuser && (
                                                <Form.Text className="text-muted small d-block mb-3">
                                                    سيتم إرسال طلب للمدير للموافقة على هذا الإجراء.
                                                </Form.Text>
                                            )}
                                            {editData.is_suspended && (
                                                <div className="bg-danger bg-opacity-10 p-3 rounded mt-3 mb-3">
                                                    <Form.Group className="mb-3">
                                                        <Form.Label className="fw-bold">سبب الإيقاف (إداري)</Form.Label>
                                                        <Form.Control
                                                            as="textarea"
                                                            rows={2}
                                                            name="suspension_reason"
                                                            value={editData.suspension_reason}
                                                            onChange={handleEditChange}
                                                        />
                                                    </Form.Group>
                                                    <Form.Group className="mb-0">
                                                        <Form.Label className="fw-bold">الرسالة التي تظهر للعميل</Form.Label>
                                                        <Form.Control
                                                            as="textarea"
                                                            rows={2}
                                                            name="custom_notification"
                                                            value={editData.custom_notification}
                                                            onChange={handleEditChange}
                                                        />
                                                    </Form.Group>
                                                </div>
                                            )}

                                            <Form.Check
                                                type="switch"
                                                id="is_restricted"
                                                name="is_restricted"
                                                label={<span className="fw-bold text-warning">تقييد العميل (منع الطلبات فقط مع السماح بالتصفح)</span>}
                                                checked={editData.is_restricted || false}
                                                onChange={handleEditChange}
                                                className="mb-2 mt-3 border-top pt-3"
                                            />
                                            {editData.is_restricted && (
                                                <div className="bg-warning bg-opacity-10 p-3 rounded mt-3 mb-3 border border-warning">
                                                    <Form.Group className="mb-0">
                                                        <Form.Label className="fw-bold">سبب التقييد</Form.Label>
                                                        <Form.Control
                                                            as="textarea"
                                                            rows={2}
                                                            name="restriction_reason"
                                                            value={editData.restriction_reason || ''}
                                                            onChange={handleEditChange}
                                                        />
                                                    </Form.Group>
                                                </div>
                                            )}
                                        </Card.Body>
                                    </Card>
                                )}

                                {isEditing && (
                                    <div className="d-grid gap-2 mb-3">
                                        <Button
                                            variant="success"
                                            onClick={handleSaveChanges}
                                            disabled={saving}
                                            size="lg"
                                        >
                                            <Save size={18} className="me-2" />
                                            {saving ? 'جاري الحفظ...' : 'حفظ جميع التغييرات'}
                                        </Button>
                                        <Button
                                            variant="light"
                                            className="border text-secondary"
                                            onClick={() => setIsEditing(false)}
                                            size="lg"
                                        >
                                            <XCircle size={18} className="me-2" />
                                            إلغاء التعديل
                                        </Button>
                                    </div>
                                )}
                            </Col>

                            <Col lg={8}>
                                <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                                    <Card className="shadow-sm border-0 mb-3">
                                        <Card.Header className="bg-white p-0 border-bottom-0">
                                            <Nav variant="tabs" className="px-3 pt-3">
                                                <Nav.Item>
                                                    <Nav.Link eventKey="orders" className="fw-bold">
                                                        الطلبات <Badge bg="secondary" className="ms-1">{customerData.orders?.length || 0}</Badge>
                                                    </Nav.Link>
                                                </Nav.Item>
                                                <Nav.Item>
                                                    <Nav.Link eventKey="messages" className="fw-bold">
                                                        رسائل الموقع <Badge bg="secondary" className="ms-1">{contactMessages.length}</Badge>
                                                    </Nav.Link>
                                                </Nav.Item>
                                                <Nav.Item>
                                                    <Nav.Link eventKey="timeline" className="fw-bold text-primary">
                                                        <Bell size={16} className="me-1" /> سجل الإشعارات والـ SMS <Badge bg="secondary" className="ms-1">{combinedTimeline.length}</Badge>
                                                    </Nav.Link>
                                                </Nav.Item>
                                                <Nav.Item>
                                                    <Nav.Link eventKey="call_log" className="fw-bold">
                                                        سجل المكالمات <Badge bg="secondary" className="ms-1">{callLogs.length}</Badge>
                                                    </Nav.Link>
                                                </Nav.Item>
                                                <Nav.Item>
                                                    <Nav.Link eventKey="discount_logs" className="fw-bold text-success">
                                                        سجل الخصومات <Badge bg="secondary" className="ms-1">{customerData?.discount_logs?.length || 0}</Badge>
                                                    </Nav.Link>
                                                </Nav.Item>
                                                <Nav.Item>
                                                    <Nav.Link eventKey="admin_logs" className="fw-bold text-danger">
                                                        سجل الإدارة <Badge bg="secondary" className="ms-1">{(customerData?.note_logs?.length || 0) + (customerData?.suspension_logs?.length || 0)}</Badge>
                                                    </Nav.Link>
                                                </Nav.Item>
                                            </Nav>
                                        </Card.Header>
                                    </Card>

                                    <Tab.Content>
                                        <Tab.Pane eventKey="orders">
                                            {customerData.orders && customerData.orders.length > 0 ? (
                                                <Accordion className="mb-4 shadow-sm">
                                                    {customerData.orders.map((order, index) => (
                                                        <Accordion.Item eventKey={index.toString()} key={order.id}>
                                                            <Accordion.Header>
                                                                <div className="d-flex justify-content-between w-100 align-items-center pe-3 flex-wrap gap-2">
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <Package size={18} className={order.source === 'b2b' ? "text-success" : "text-primary"} />
                                                                        <span className="fw-bold">
                                                                            {order.source === 'b2b' && order.business_request_info
                                                                                ? `طلب شركات B2B #${order.business_request_info.id}`
                                                                                : `طلب أفراد #${order.id}`
                                                                            }
                                                                        </span>
                                                                        <span className="text-muted small" dir="ltr">
                                                                            {format(new Date(order.created_at), 'yyyy-MM-dd')}
                                                                        </span>
                                                                    </div>
                                                                    <Badge
                                                                        bg={order.status === 'completed' ? 'success' : order.status === 'canceled' ? 'danger' : 'warning'}
                                                                    >
                                                                        {order.status_display || order.status}
                                                                    </Badge>
                                                                </div>
                                                            </Accordion.Header>
                                                            <Accordion.Body className="bg-light">
                                                                <div className="mb-3 d-flex gap-4 flex-wrap">
                                                                    <div>
                                                                        <small className="text-muted d-block">إجمالي الطلب</small>
                                                                        <strong className="text-primary fs-5">{order.total_price} ج.م</strong>
                                                                    </div>
                                                                    <div>
                                                                        <small className="text-muted d-block">المصدر</small>
                                                                        <Badge bg={order.source === 'b2b' ? 'success' : order.source === 'on_farm' ? 'info' : 'secondary'} text={order.source === 'on_farm' ? 'dark' : 'white'}>
                                                                            {order.source === 'b2b' ? 'توريد شركات' : order.source === 'on_farm' ? 'نقطة بيع' : 'المتجر الإلكتروني'}
                                                                        </Badge>
                                                                    </div>
                                                                    {order.source === 'b2b' && order.business_request_info && (
                                                                        <div>
                                                                            <small className="text-muted d-block">المطلوب</small>
                                                                            <strong>{order.business_request_info.total_quantity} رأس</strong>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {order.source !== 'b2b' && order.items && order.items.length > 0 && (
                                                                    <>
                                                                        <h6 className="fw-bold text-secondary mb-2 border-bottom pb-2">تفاصيل الأصناف</h6>
                                                                        <ul className="list-unstyled mb-0">
                                                                            {order.items.map(item => (
                                                                                <li key={item.id} className="mb-3 pb-3 border-bottom bg-white p-3 rounded shadow-sm">
                                                                                    <div className="d-flex justify-content-between mb-1">
                                                                                        <strong className="text-dark">حيوان #{item.animal_code}</strong>
                                                                                        <strong className="text-success">{item.price_per_item} ج.م</strong>
                                                                                    </div>
                                                                                    <div className="small text-muted mt-2 bg-light p-2 rounded">
                                                                                        <strong>الخدمات المرفقة:</strong> {getServiceNames(item.selected_services)}
                                                                                    </div>
                                                                                </li>
                                                                            ))}
                                                                        </ul>
                                                                    </>
                                                                )}
                                                            </Accordion.Body>
                                                        </Accordion.Item>
                                                    ))}
                                                </Accordion>
                                            ) : (
                                                <div className="text-center py-5 bg-white rounded shadow-sm border">
                                                    <Package size={48} className="text-muted mb-3 opacity-50" />
                                                    <p className="text-muted">لا يوجد سجل طلبات لهذا العميل.</p>
                                                </div>
                                            )}
                                        </Tab.Pane>
                                        <Tab.Pane eventKey="messages">
                                            {contactMessages.length > 0 ? (
                                                <div className="d-flex flex-column gap-3">
                                                    {contactMessages.map(msg => (
                                                        <Card key={msg.id} className="shadow-sm border-0">
                                                            <Card.Body>
                                                                <div className="d-flex justify-content-between mb-2 border-bottom pb-2">
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <Mail size={16} className="text-primary" />
                                                                        <strong className="text-dark">{msg.subject}</strong>
                                                                    </div>
                                                                    <div className="text-muted small" dir="ltr" style={{textAlign: 'right'}}>
                                                                        {format(new Date(msg.created_at), 'yyyy-MM-dd hh:mm a')}
                                                                    </div>
                                                                </div>
                                                                <p className="mb-0 text-secondary bg-light p-3 rounded" style={{ whiteSpace: 'pre-wrap' }}>{msg.message}</p>
                                                            </Card.Body>
                                                        </Card>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-5 bg-white rounded shadow-sm border">
                                                    <Mail size={48} className="text-muted mb-3 opacity-50" />
                                                    <p className="text-muted">لم يقم العميل بإرسال أي رسائل تواصل.</p>
                                                </div>
                                            )}
                                        </Tab.Pane>
                                        <Tab.Pane eventKey="timeline">
                                            <Card className="border-0 shadow-sm">
                                                <Card.Body>
                                                    {combinedTimeline.length === 0 ? (
                                                        <div className="text-center text-muted py-4">لا توجد إشعارات أو رسائل أرسلت لهذا العميل.</div>
                                                    ) : (
                                                        <div className="timeline-wrapper ps-3 border-start border-2 border-light">
                                                            {combinedTimeline.map((item, idx) => (
                                                                <div key={idx} className="position-relative mb-4">
                                                                    <div className="position-absolute top-0 translate-middle-x bg-white p-1" style={{ left: '-18px' }}>
                                                                        {item.timelineType === 'push' ? (
                                                                            <Bell size={20} className="text-warning"/>
                                                                        ) : item.timelineType === 'email' ? (
                                                                            <Mail size={20} className="text-info"/>
                                                                        ) : (
                                                                            <MessageSquare size={20} className="text-primary"/>
                                                                        )}
                                                                    </div>
                                                                    <div className="ps-4">
                                                                        <div className="d-flex justify-content-between align-items-center mb-1">
                                                                            <Badge
                                                                                bg={item.timelineType === 'push' ? 'warning' : item.timelineType === 'email' ? 'info' : 'primary'}
                                                                                text={item.timelineType === 'push' ? 'dark' : 'light'}
                                                                            >
                                                                                {item.timelineType === 'push' ? 'إشعار الموقع (Push)' : item.timelineType === 'email' ? 'بريد إلكتروني' : 'رسالة نصية (SMS)'}
                                                                            </Badge>
                                                                            <small className="text-muted" dir="ltr">{format(item.dateObj, 'yyyy-MM-dd hh:mm a')}</small>
                                                                        </div>
                                                                        {item.title && <h6 className="fw-bold mb-1">{item.title}</h6>}
                                                                        <div className="bg-light p-3 rounded text-secondary small border">
                                                                            {item.message || item.content}
                                                                        </div>
                                                                        {item.timelineType === 'push' && (
                                                                            <div className="mt-1 small">
                                                                                <span className="text-muted">مقروء من العميل؟ </span>
                                                                                {item.is_read ? <span className="text-success fw-bold">نعم</span> : <span className="text-danger fw-bold">لا</span>}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </Card.Body>
                                            </Card>
                                        </Tab.Pane>
                                        <Tab.Pane eventKey="call_log">
                                            {callLogs.length > 0 ? (
                                                <div className="d-flex flex-column gap-3">
                                                    {callLogs.map(log => (
                                                        <Card key={log.id} className={`shadow-sm border-0 border-start border-4 ${log.status === 'resolved' ? 'border-success' : 'border-warning'}`}>
                                                            <Card.Body>
                                                                <div className="d-flex justify-content-between mb-3 border-bottom pb-2">
                                                                    <div>
                                                                        <div className="fw-bold small text-muted" dir="ltr" style={{textAlign: 'right'}}>
                                                                            {format(new Date(log.start_time), 'yyyy-MM-dd hh:mm a')}
                                                                        </div>
                                                                        <div className="mt-1 text-primary small fw-bold">
                                                                            الموظف: {log.handled_by_name || 'غير معروف'}
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-end">
                                                                        <Badge bg="info" className="mb-1 d-block">{log.reason_display || log.reason}</Badge>
                                                                        <Badge bg="light" text="dark" className="border d-flex align-items-center justify-content-center gap-1">
                                                                            <Clock size={10} /> {Math.floor(log.duration_seconds / 60)} دقيقة
                                                                        </Badge>
                                                                    </div>
                                                                </div>
                                                                <div className="bg-light p-3 rounded text-dark small">
                                                                    <strong>ملخص المكالمة:</strong><br/>
                                                                    {log.notes}
                                                                </div>
                                                            </Card.Body>
                                                        </Card>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-5 bg-white rounded shadow-sm border">
                                                    <PhoneCall size={48} className="text-muted mb-3 opacity-50" />
                                                    <p className="text-muted">لا توجد مكالمات مسجلة لهذا العميل.</p>
                                                </div>
                                            )}
                                        </Tab.Pane>

                                        <Tab.Pane eventKey="discount_logs">
                                            <Card className="border-success shadow-sm">
                                                <Card.Header className="bg-success text-white fw-bold">
                                                    تاريخ الخصومات والقسائم
                                                </Card.Header>
                                                <Card.Body className="p-0">
                                                    {!customerData?.discount_logs?.length ? (
                                                        <div className="text-center p-4 text-muted">لا توجد سجلات خصم مسجلة.</div>
                                                    ) : (
                                                        <div className="table-responsive m-0">
                                                            <Table hover className="mb-0 align-middle" size="sm">
                                                                <thead className="bg-light">
                                                                    <tr>
                                                                        <th>التاريخ والوقت</th>
                                                                        <th>الخصم</th>
                                                                        <th>تفاصيل / ملاحظات</th>
                                                                        <th>بواسطة</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {customerData.discount_logs.map((log, i) => (
                                                                        <tr key={i}>
                                                                            <td dir="ltr" className="text-muted small text-end" style={{whiteSpace: 'nowrap'}}>{format(new Date(log.timestamp), 'yyyy-MM-dd hh:mm a')}</td>
                                                                            <td className="fw-bold text-success" dir="ltr">
                                                                                {log.notes.includes('مبلغ') ? '-' : `${log.new_percentage}%`}
                                                                            </td>
                                                                            <td className="small text-dark">{log.notes}</td>
                                                                            <td className="small text-info fw-bold">{log.changed_by_name} <br/><span className="text-muted">({log.department_snapshot})</span></td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </Table>
                                                        </div>
                                                    )}
                                                </Card.Body>
                                            </Card>
                                        </Tab.Pane>

                                        <Tab.Pane eventKey="admin_logs">
                                            <div className="d-flex flex-column gap-4">
                                                <Card className="border-danger shadow-sm">
                                                    <Card.Header className="bg-danger text-white fw-bold">
                                                        سجل إيقاف وتفعيل الحساب
                                                    </Card.Header>
                                                    <Card.Body className="p-0">
                                                        {!customerData?.suspension_logs?.length ? (
                                                            <div className="text-center p-4 text-muted">لم يتم إيقاف هذا الحساب مسبقاً.</div>
                                                        ) : (
                                                            <div className="table-responsive m-0">
                                                                <Table hover className="mb-0 text-center align-middle" size="sm">
                                                                    <thead className="bg-light">
                                                                        <tr>
                                                                            <th>التاريخ والوقت</th>
                                                                            <th>الإجراء</th>
                                                                            <th>السبب</th>
                                                                            <th>بواسطة (الموظف)</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {customerData.suspension_logs.map((log, i) => (
                                                                            <tr key={i}>
                                                                                <td dir="ltr" className="text-muted small">{format(new Date(log.created_at), 'yyyy-MM-dd hh:mm a')}</td>
                                                                                <td>
                                                                                    {log.action === 'suspended' ? <Badge bg="danger">إيقاف الحساب</Badge> :
                                                                                     log.action === 'restricted' ? <Badge bg="warning" text="dark">تقييد من الطلب</Badge> :
                                                                                     log.action === 'unrestricted' ? <Badge bg="success">فك التقييد</Badge> :
                                                                                     <Badge bg="success">إعادة تفعيل</Badge>}
                                                                                </td>
                                                                                <td className="fw-bold">{log.reason || '-'}</td>
                                                                                <td className="small text-primary fw-bold">{log.changed_by_name} <span className="text-muted">({log.changed_by_dept})</span></td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </Table>
                                                            </div>
                                                        )}
                                                    </Card.Body>
                                                </Card>

                                                <Card className="border-info shadow-sm">
                                                    <Card.Header className="bg-info text-white fw-bold">
                                                        سجل الملاحظات الإدارية التاريخي
                                                    </Card.Header>
                                                    <Card.Body className="p-0">
                                                        {!customerData?.note_logs?.length ? (
                                                            <div className="text-center p-4 text-muted">لا توجد ملاحظات سابقة مسجلة.</div>
                                                        ) : (
                                                            <div className="table-responsive m-0">
                                                                <Table hover className="mb-0 align-middle" size="sm">
                                                                    <thead className="bg-light">
                                                                        <tr>
                                                                            <th>التاريخ والوقت</th>
                                                                            <th>الملاحظة</th>
                                                                            <th>كاتب الملاحظة (القسم)</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {customerData.note_logs.map((log, i) => (
                                                                            <tr key={i}>
                                                                                <td dir="ltr" className="text-muted small text-end" style={{whiteSpace: 'nowrap'}}>{format(new Date(log.created_at), 'yyyy-MM-dd hh:mm a')}</td>
                                                                                <td className="fw-medium text-dark" style={{whiteSpace: 'pre-wrap'}}>{log.note}</td>
                                                                                <td className="small text-info fw-bold">{log.added_by_name} <br/><span className="text-muted">({log.added_by_dept})</span></td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </Table>
                                                            </div>
                                                        )}
                                                    </Card.Body>
                                                </Card>
                                            </div>
                                        </Tab.Pane>
                                    </Tab.Content>
                                </Tab.Container>
                            </Col>
                        </Row>
                    </div>
                )
            )}

            <AddressModal
                show={showAddressModal}
                handleClose={() => setShowAddressModal(false)}
                customerId={customerData?.user_details?.id}
                onSave={() => performSearch(customerData.user_details.phone)}
                addressToEdit={addressToEdit}
            />

            <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>رفع عقد أعمال للشركة</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleUploadContract}>
                    <Modal.Body>
                        <Form.Group className="mb-3">
                            <Form.Label>عنوان العقد (مثال: عقد توريد 2026)</Form.Label>
                            <Form.Control required type="text" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>ملف العقد (PDF أو صورة ممضية)</Form.Label>
                            <Form.Control required type="file" accept=".pdf,image/*" onChange={e => setUploadFile(e.target.files[0])} />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowUploadModal(false)}>إلغاء</Button>
                        <Button variant="primary" type="submit" disabled={isUploading}>
                            {isUploading ? <Spinner size="sm" /> : 'تأكيد الرفع والأرشفة'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <Modal show={showCommModal} onHide={() => setShowCommModal(false)} centered>
                <Modal.Header closeButton className={commType === 'push' ? 'bg-success text-white' : 'bg-primary text-white'}>
                    <Modal.Title className="fs-5">
                        {commType === 'push' ? 'إرسال إشعار للموقع (Push)' : 'إرسال رسالة نصية (SMS)'}
                    </Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleDirectCommunicate}>
                    <Modal.Body>
                        <Alert variant="info" className="small py-2 mb-3">
                            إرسال إلى: <strong>{customerData?.user_details?.full_name}</strong> ({customerData?.user_details?.phone})
                        </Alert>

                        {commType === 'push' && (
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold small">عنوان الإشعار</Form.Label>
                                <Form.Control
                                    type="text"
                                    required
                                    value={commTitle}
                                    onChange={(e) => setCommTitle(e.target.value)}
                                    placeholder="مثال: تحديث بخصوص طلبك..."
                                />
                            </Form.Group>
                        )}

                        <Form.Group className="mb-3">
                            <Form.Label className="fw-bold small">نص الرسالة</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={4}
                                required
                                value={commMessage}
                                onChange={(e) => setCommMessage(e.target.value)}
                                placeholder="اكتب رسالتك هنا..."
                            />
                        </Form.Group>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowCommModal(false)}>إلغاء</Button>
                        <Button variant={commType === 'push' ? 'success' : 'primary'} type="submit" disabled={commSending}>
                            {commSending ? <Spinner size="sm"/> : 'تأكيد وإرسال'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <PrintModal
                show={printConfig.show}
                handleClose={() => setPrintConfig({ show: false, title: '', endpoint: '' })}
                title={printConfig.title}
                endpoint={printConfig.endpoint}
            />
        </Container>
    );
};

export default CustomerLookup;
