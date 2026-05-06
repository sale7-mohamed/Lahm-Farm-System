import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Table, Button, Modal, Form, Badge, Row, Col, Spinner, Card, Nav } from 'react-bootstrap';
import { CheckCircle, RefreshCw, DollarSign, Eye, PlusCircle, Trash2, Wallet, Edit, MapPin, Printer, UploadCloud, FileText, Info } from 'lucide-react';
import PrintModal from '../components/ui/PrintModal';

const QuoteModal = ({ show, handleClose, request, onSave }) => {
    const [formData, setFormData] = useState({
        quoted_total_price: '',
        quoted_deposit: '',
        admin_notes: '',
        expected_delivery_date: ''
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (request) {
            setFormData({
                quoted_total_price: request.quoted_total_price || '',
                quoted_deposit: request.quoted_deposit || '',
                admin_notes: request.admin_notes || '',
                expected_delivery_date: request.expected_delivery_date || ''
            });
        }
    }, [request]);

    const handleSubmit = async () => {
        if (!formData.quoted_total_price) {
            toast.warn("يجب تحديد السعر الإجمالي");
            return;
        }
        if (Number(formData.quoted_deposit) > Number(formData.quoted_total_price)) {
            toast.warn("لا يمكن أن يكون العربون أكبر من السعر الإجمالي");
            return;
        }
        setLoading(true);
        try {
            await axios.post(`/orders/business-requests/${request.id}/quote_price/`, {
                ...formData
            });
            toast.success("تم إرسال التسعير للعميل وإنشاء طلب مبدئي");
            onSave();
            handleClose();
        } catch (err) {
            toast.error("فشل الحفظ");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title>تسعير الطلب #{request?.id}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form>
                    <Row className="g-3">
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>السعر الإجمالي (ج.م)</Form.Label>
                                <Form.Control type="number" value={formData.quoted_total_price} onChange={e => setFormData({...formData, quoted_total_price: e.target.value})} />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>العربون المطلوب (ج.م)</Form.Label>
                                <Form.Control type="number" value={formData.quoted_deposit} onChange={e => setFormData({...formData, quoted_deposit: e.target.value})} />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>تاريخ التوصيل المتوقع</Form.Label>
                                <Form.Control type="date" value={formData.expected_delivery_date} onChange={e => setFormData({...formData, expected_delivery_date: e.target.value})} />
                            </Form.Group>
                        </Col>
                        <Col md={12}>
                            <Form.Group>
                                <Form.Label>ملاحظات للعميل</Form.Label>
                                <Form.Control as="textarea" rows={2} value={formData.admin_notes} onChange={e => setFormData({...formData, admin_notes: e.target.value})} />
                            </Form.Group>
                        </Col>
                    </Row>
                </Form>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={loading}>
                    {loading ? <Spinner size="sm"/> : 'حفظ وتسعير'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const FulfillModal = ({ show, handleClose, request, onSave }) => {
    const [activeTab, setActiveTab] = useState('existing');
    const [submitting, setSubmitting] = useState(false);

    const [availableAnimals, setAvailableAnimals] = useState([]);
    const [selectedAnimalIds, setSelectedAnimalIds] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingAnimals, setLoadingAnimals] = useState(false);

    const [newAnimals, setNewAnimals] = useState([]);
    const [categories, setCategories] = useState([]);
    const [suppliers, setSuppliers] = useState([]);

    const fetchAvailableAnimals = useCallback(async () => {
        if (!request) return;
        setLoadingAnimals(true);
        try {
            const res = await axios.get('/management/animals/', {
                params: {
                    category: request.request_details[0]?.category_id,
                    status: 'available',
                    search: searchTerm,
                    limit: 20
                }
            });
            setAvailableAnimals(res.data.results || []);
        } catch  {
            toast.error("فشل تحميل الحيوانات المتاحة");
        } finally {
            setLoadingAnimals(false);
        }
    }, [request, searchTerm]);

    const fetchSelectOptions = useCallback(async () => {
        try {
            const [catRes, supRes] = await Promise.all([
                axios.get('/livestock/categories/'),
                axios.get('/management/suppliers/?supplier_type=LIVESTOCK_FARM')
            ]);
            setCategories(catRes.data.results || catRes.data || []);
            setSuppliers(supRes.data.results || supRes.data || []);
        } catch  {
            console.error("Failed to load options");
        }
    }, []);

    useEffect(() => {
        if (show) {
            fetchAvailableAnimals();
            fetchSelectOptions();
            setSelectedAnimalIds([]);
            setNewAnimals([]);

            if (request && request.total_quantity > 0) {
                const initialForms = Array.from({ length: request.total_quantity }, () => ({
                    category_id: request.request_details[0]?.category_id || '',
                    weight: '',
                    cost: '',
                    price: '',
                    supplier_id: ''
                }));
                setNewAnimals(initialForms);
            }
        }
    }, [show, fetchAvailableAnimals, fetchSelectOptions, request]);

    const toggleAnimalSelection = (id) => {
        setSelectedAnimalIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handleNewAnimalChange = (index, field, value) => {
        const updated = [...newAnimals];
        updated[index][field] = value;
        setNewAnimals(updated);
    };

    const addRow = () => {
        setNewAnimals([...newAnimals, { category_id: '', weight: '', cost: '', price: '', supplier_id: '' }]);
    };

    const removeRow = (idx) => {
        setNewAnimals(newAnimals.filter((_, i) => i !== idx));
    };

    const handleSubmit = async () => {
        const totalSelected = selectedAnimalIds.length + newAnimals.filter(n => n.category_id && n.weight && n.price).length;

        if (totalSelected < (request?.total_quantity || 0)) {
            if(!window.confirm(`لقد قمت بتوفير ${totalSelected} رأس فقط بينما الطلب يطلب ${request?.total_quantity}. هل تريد الاستمرار وإغلاق الطلب؟`)) {
                return;
            }
        }

        const validNewAnimals = newAnimals.filter(n => n.category_id && n.weight && n.price);

        setSubmitting(true);
        try {
            await axios.post(`/orders/business-requests/${request.id}/convert_to_order/`, {
                existing_animal_ids: selectedAnimalIds,
                new_animals: validNewAnimals
            });
            toast.success("تم تخصيص المواشي وتحديث الطلب بنجاح");
            onSave();
            handleClose();
        } catch (err) {
            toast.error(err.response?.data?.detail || "فشل التخصيص");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="xl">
            <Modal.Header closeButton>
                <Modal.Title>تنفيذ الطلب وتخصيص المواشي #{request?.id}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="mb-4 p-3 bg-light rounded border d-flex justify-content-between">
                    <div>
                        <strong>المطلوب:</strong> {request?.total_quantity} رأس
                    </div>
                    <div className="text-success fw-bold">
                        تم توفيره الآن: {selectedAnimalIds.length + newAnimals.filter(n => n.category_id && n.weight && n.price).length} رأس
                    </div>
                </div>

                <div className="mb-3">
                    <Nav variant="tabs" activeKey={activeTab} onSelect={setActiveTab}>
                        <Nav.Item>
                            <Nav.Link eventKey="existing">تخصيص من المخزن الحالي</Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="new">إضافة سريعة (مواشي جديدة)</Nav.Link>
                        </Nav.Item>
                    </Nav>
                </div>

                {activeTab === 'existing' ? (
                    <>
                        <Form.Control
                            type="text"
                            placeholder="ابحث عن حيوان بالمخزن..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="mb-3"
                        />
                        {loadingAnimals ? <div className="text-center py-4"><Spinner /></div> : (
                            <div className="table-responsive" style={{maxHeight: '400px'}}>
                                <Table hover>
                                    <thead className="bg-light sticky-top">
                                        <tr>
                                            <th>تحديد</th>
                                            <th>الكود</th>
                                            <th>الفئة</th>
                                            <th>الوزن</th>
                                            <th>السعر</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {availableAnimals.map(a => (
                                            <tr key={a.id} className={selectedAnimalIds.includes(a.id) ? 'table-success' : ''}>
                                                <td>
                                                    <Form.Check type="checkbox" checked={selectedAnimalIds.includes(a.id)} onChange={() => toggleAnimalSelection(a.id)} />
                                                </td>
                                                <td className="fw-bold">{a.code}</td>
                                                <td>{a.category_name}</td>
                                                <td>{a.current_weight} كجم</td>
                                                <td>{a.price_egp} ج</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="table-responsive" style={{maxHeight: '400px'}}>
                        <Table bordered size="sm" className="align-middle">
                            <thead className="bg-light sticky-top">
                                <tr>
                                    <th>الفئة *</th>
                                    <th>الوزن (كجم) *</th>
                                    <th>تكلفة الشراء</th>
                                    <th>سعر البيع للعميل *</th>
                                    <th>المورد / المزرعة</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {newAnimals.map((item, idx) => (
                                    <tr key={idx}>
                                        <td>
                                            <Form.Select size="sm" value={item.category_id} onChange={e => handleNewAnimalChange(idx, 'category_id', e.target.value)}>
                                                <option value="">اختر...</option>
                                                {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                                            </Form.Select>
                                        </td>
                                        <td>
                                            <Form.Control size="sm" type="number" value={item.weight} onChange={e => handleNewAnimalChange(idx, 'weight', e.target.value)} />
                                        </td>
                                        <td>
                                            <Form.Control size="sm" type="number" value={item.cost} onChange={e => handleNewAnimalChange(idx, 'cost', e.target.value)} />
                                        </td>
                                        <td>
                                            <Form.Control size="sm" type="number" value={item.price} onChange={e => handleNewAnimalChange(idx, 'price', e.target.value)} />
                                        </td>
                                        <td>
                                            <Form.Select size="sm" value={item.supplier_id} onChange={e => handleNewAnimalChange(idx, 'supplier_id', e.target.value)}>
                                                <option value="">من مزارعنا</option>
                                                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </Form.Select>
                                        </td>
                                        <td>
                                            <Button variant="outline-danger" size="sm" onClick={() => removeRow(idx)}><Trash2 size={14}/></Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                        <Button variant="outline-primary" size="sm" onClick={addRow}><PlusCircle size={14} className="me-1"/> صنف آخر</Button>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                <Button variant="success" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <Spinner size="sm" /> : 'اعتماد وحفظ المواشي'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const RecordPaymentModal = ({ show, handleClose, request, onSave }) => {
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('cash');
    const [loading, setLoading] = useState(false);

    const orderId = request?.converted_order_details?.id;
    const remainingAmount = parseFloat(request?.converted_order_details?.remaining_amount || request?.quoted_total_price || 0);

    const handleSubmit = async () => {
        if (!amount || amount <= 0 || amount > remainingAmount) {
            toast.warn("مبلغ الدفعة غير صحيح أو يتجاوز المتبقي");
            return;
        }
        setLoading(true);
        try {
            await axios.post(`/management/orders/${orderId}/record-payment/`, {
                amount: amount,
                payment_method: method
            });
            toast.success("تم تسجيل الدفعة بنجاح");
            onSave();
            handleClose();
        } catch (err) {
            toast.error(err.response?.data?.detail || "فشل تسجيل الدفعة");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton>
                <Modal.Title>تسجيل دفعة لطلب #{request?.id}</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="alert alert-info">المبلغ المتبقي للتحصيل: <strong>{remainingAmount} ج.م</strong></div>
                <Form.Group className="mb-3">
                    <Form.Label>المبلغ المدفوع (ج.م)</Form.Label>
                    <Form.Control type="number" value={amount} onChange={e => setAmount(e.target.value)} max={remainingAmount} />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>طريقة الدفع</Form.Label>
                    <Form.Select value={method} onChange={e => setMethod(e.target.value)}>
                        <option value="cash">كاش / نقدي</option>
                        <option value="bank_transfer">تحويل بنكي / إنستاباي</option>
                        <option value="pos">POS</option>
                    </Form.Select>
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={loading || !amount}>حفظ الدفعة</Button>
            </Modal.Footer>
        </Modal>
    );
};

const ViewRequestModal = ({ show, handleClose, request, onRefresh }) => {
    const [showDeliveryModal, setShowDeliveryModal] = useState(false);
    const [deliveryData, setDeliveryData] = useState({
        delivery_type: 'pickup',
        delivery_date: '',
        delivery_address_id: '',
        newAddress: { governorate: '', city: '', street: '' },
        notes: '',
        admin_notes: ''
    });
    const [updating, setUpdating] = useState(false);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [governorates, setGovernorates] = useState([]);
    const [opSettings, setOpSettings] = useState(null);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const fileInputRef = useRef(null);
    const [reqDocs, setReqDocs] = useState([]);

    const [newStatus, setNewStatus] = useState('');
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const [printConfig, setPrintConfig] = useState({ show: false, title: '', endpoint: '' });

    useEffect(() => {
        if (request?.converted_order_details) {
            const order = request.converted_order_details;
            setDeliveryData({
                delivery_type: order.delivery_type || '',
                delivery_date: order.delivery_date || '',
                delivery_address_id: order.delivery_address?.id || '',
                newAddress: { governorate: '', city: '', street: '' },
                notes: order.notes || '',
                admin_notes: ''
            });
            setNewStatus(order.status || 'pending');
        }
    }, [request, showDeliveryModal]);

    useEffect(() => {
        if (showDeliveryModal && request && request.user_phone) {
            axios.get(`/management/customer-lookup/?phone=${encodeURIComponent(request.user_phone)}`)
                .then(res => {
                    if (res.data && res.data.addresses) {
                        setCustomerAddresses(res.data.addresses);
                    }
                }).catch(() => {});
        }
    }, [showDeliveryModal, request]);

    useEffect(() => {
        if (showDeliveryModal && request) {
            axios.get('/core/governorates/')
                .then(res => setGovernorates(res.data || []))
                .catch(() => {});
            axios.get('/core/public-operation-settings/')
                .then(res => setOpSettings(res.data))
                .catch(() => {});
        }
    }, [showDeliveryModal, request]);

    useEffect(() => {
        if (show && request) {
            axios.get(`/management/document-archive/?business_request=${request.id}`)
                .then(res => setReqDocs(res.data.results || []))
                .catch(() => {});
        }
    }, [show, request]);

    if (!request) return null;
    const orderDetails = request.converted_order_details;

    const handleUpdateDelivery = async () => {
        setUpdating(true);
        try {
            await axios.post(`/orders/business-requests/${request.id}/update-delivery/`, deliveryData);
            toast.success("تم تحديث بيانات التوصيل وإرسال الإشعار بنجاح");
            setShowDeliveryModal(false);
            if(onRefresh) onRefresh();
        } catch {
            toast.error("فشل التحديث");
        } finally {
            setUpdating(false);
        }
    };

    const handleStatusUpdate = async () => {
        if (!orderDetails) return;
        setUpdatingStatus(true);
        try {
            await axios.patch(`/management/orders/${orderDetails.id}/`, { status: newStatus });
            toast.success("تم تحديث حالة الطلب التشغيلية بنجاح");
            if(onRefresh) onRefresh();
        } catch {
            toast.error("فشل تحديث الحالة");
        } finally {
            setUpdatingStatus(false);
        }
    };

    const printDoc = (type) => {
        if(!orderDetails?.id) return;
        if (type === 'invoice') setPrintConfig({show: true, title: `فاتورة شركات #${request.id}`, endpoint: `/orders/invoice/${orderDetails.id}/`});
        if (type === 'delivery-note') setPrintConfig({show: true, title: `إذن تسليم شركات #${request.id}`, endpoint: `/orders/delivery-note/${orderDetails.id}/`});
    };

    const handleUploadReceipt = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const title = window.prompt('يرجى إدخال اسم للإيصال/المستند (مثال: إذن استلام ممضي):', `إيصال استلام طلب شركات #${request.id}`);
        if (!title) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('document_type', 'b2b_order_doc');
        formData.append('business_request', request.id);
        formData.append('b2b_customer', request.user);
        formData.append('file', file);

        setUploadingDoc(true);
        try {
            await axios.post('/management/document-archive/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success('تم رفع وحفظ الوثيقة في الأرشيف');
            const res = await axios.get(`/management/document-archive/?business_request=${request.id}`);
            setReqDocs(res.data.results || []);
            if (fileInputRef.current) fileInputRef.current.value = '';
        } catch (err) {
            toast.error('فشل رفع الوثيقة');
            console.error(err);
        } finally {
            setUploadingDoc(false);
        }
    };

    return (
        <>
            <Modal show={show} onHide={handleClose} centered size="lg">
                <Modal.Header closeButton className="bg-light">
                    <Modal.Title className="h5 mb-0 d-flex justify-content-between w-100 align-items-center pe-4">
                        <span>تفاصيل طلب الشركات #{request.id}</span>
                        {orderDetails && (
                            <div className="d-flex gap-2">
                                <Button variant="outline-primary" size="sm" onClick={() => printDoc('invoice')}>
                                    <Printer size={14}/> فاتورة
                                </Button>
                                <Button variant="outline-success" size="sm" onClick={() => printDoc('delivery-note')}>
                                    <Printer size={14}/> إذن تسليم
                                </Button>
                            </div>
                        )}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Row className="mb-4">
                        <Col md={6}>
                            <h6 className="fw-bold text-primary mb-3">بيانات العميل</h6>
                            <div className="bg-light p-3 rounded border">
                                <p className="mb-2"><strong>النشاط التجاري:</strong> {request.user_business_name || 'لا يوجد'}</p>
                                <p className="mb-2"><strong>الاسم:</strong> {request.user_full_name}</p>
                                <p className="mb-0"><strong>الهاتف:</strong> <span dir="ltr">{request.user_phone}</span></p>
                            </div>
                        </Col>
                        <Col md={6}>
                            <h6 className="fw-bold text-primary mb-3">الحالة المالية للطلب</h6>
                            <div className="bg-light p-3 rounded border h-100">
                                {orderDetails ? (
                                    <>
                                        <p className="mb-2"><strong>الإجمالي:</strong> {orderDetails.total_price} ج.م</p>
                                        <p className="mb-2 text-success"><strong>المدفوع:</strong> {orderDetails.deposit_total} ج.م</p>
                                        <p className="mb-0 text-danger"><strong>المتبقي:</strong> {orderDetails.remaining_amount} ج.م</p>
                                    </>
                                ) : (
                                    <p className="text-muted mt-2">لا يوجد طلب مالي مرتبط بعد.</p>
                                )}
                            </div>
                        </Col>
                    </Row>

                    <h6 className="fw-bold text-primary mb-3 d-flex justify-content-between align-items-center pb-2 border-bottom">
                        <span>تفاصيل الاستلام والتوصيل</span>
                        {orderDetails && (
                            <Button variant="outline-primary" size="sm" onClick={() => setShowDeliveryModal(true)}>
                                <Edit size={14} className="me-1"/> تعديل الإعدادات
                            </Button>
                        )}
                    </h6>
                    <div className="bg-light p-3 rounded border mb-4">
                        <Row>
                            <Col md={4}>
                                <p className="mb-1 text-muted small">الطريقة:</p>
                                <strong>
                                    {!orderDetails?.delivery_type ? 'غير محدد' :
                                     (orderDetails.delivery_type === 'delivery' ? 'توصيل للعنوان' : 'استلام من المزرعة')}
                                </strong>
                            </Col>
                            <Col md={4}>
                                <p className="mb-1 text-muted small">التاريخ:</p>
                                <strong>{orderDetails?.delivery_date || 'غير محدد'}</strong>
                            </Col>
                            <Col md={4}>
                                <p className="mb-1 text-muted small">العنوان:</p>
                                <strong>{orderDetails?.delivery_address?.street || orderDetails?.delivery_address_text || 'غير محدد'}</strong>
                            </Col>
                        </Row>
                    </div>

                    {orderDetails && (
                        <>
                            <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom mt-4">تحديث الحالة التشغيلية للطلب</h6>
                            <div className="bg-light p-3 rounded border mb-4">
                                <Row className="align-items-end">
                                    <Col md={8}>
                                        <Form.Group>
                                            <Form.Label className="small text-muted">اختر الحالة الجديدة</Form.Label>
                                            <Form.Select value={newStatus} onChange={e => setNewStatus(e.target.value)} size="sm">
                                                <option value="pending">معلق (بانتظار الدفع)</option>
                                                <option value="confirmed">مؤكد (جاهز للبدء)</option>
                                                <option value="processing">قيد التجهيز</option>
                                                <option value="ready_for_shipment">جاهز للشحن / للاستلام</option>
                                                <option value="out_for_delivery">في الطريق للتوصيل</option>
                                                <option value="delivered">تم التوصيل</option>
                                                <option value="completed">مكتمل</option>
                                                <option value="canceled">ملغي</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col md={4}>
                                        <Button variant="primary" size="sm" className="w-100" onClick={handleStatusUpdate} disabled={updatingStatus}>
                                            {updatingStatus ? 'جاري التحديث...' : 'تحديث الحالة'}
                                        </Button>
                                    </Col>
                                </Row>
                            </div>
                        </>
                    )}

                    <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom">الأصناف المطلوبة (الإجمالي: {request.total_quantity} رأس)</h6>
                    <div className="table-responsive mb-4">
                        <Table size="sm" bordered hover className="text-center align-middle mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th>الفئة</th>
                                    <th>العدد</th>
                                    <th>نطاق الوزن المتوقع</th>
                                    <th>تجهيز وذبح؟</th>
                                </tr>
                            </thead>
                            <tbody>
                                {request.request_details.map((item, i) => {
                                    const cat = request.categories_details?.find(c => c.id == item.category_id);
                                    return (
                                        <tr key={i}>
                                            <td className="fw-bold">{cat ? cat.name_ar : `فئة ${item.category_id}`}</td>
                                            <td><Badge bg="info" className="fs-6">{item.quantity}</Badge></td>
                                            <td dir="ltr">{item.weight_range}</td>
                                            <td>{item.services?.slaughter ? <Badge bg="success">نعم</Badge> : <Badge bg="secondary">لا</Badge>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    </div>

                    {orderDetails?.items && orderDetails.items.length > 0 && (
                        <>
                            <div className="d-flex justify-content-between align-items-center mt-4 mb-3 pb-2 border-bottom">
                                <h6 className="fw-bold text-success mb-0">المواشي المخصصة فعلياً للطلب</h6>
                                <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={() => {
                                        handleClose();
                                        window.location.href = '/orders';
                                    }}
                                >
                                    <Edit size={14} className="me-1"/> تعديل الأوزان والأسعار
                                </Button>
                            </div>
                            <div className="alert alert-info small py-2 mb-3 d-flex gap-2">
                                <Info size={16} className="shrink-0" />
                                <span>لتعديل وزن وسعر الماشية النهائي للعميل، اضغط على زر (تعديل الأوزان والأسعار) للتوجه لسجل الطلبات، ثم افتح الطلب واضغط على (تحديث الميزان).</span>
                            </div>
                            <div className="table-responsive mb-4">
                                <Table size="sm" bordered hover className="text-center align-middle mb-0">
                                    <thead className="table-success">
                                        <tr>
                                            <th>كود الماشية</th>
                                            <th>الفئة</th>
                                            <th>الوزن المسجل</th>
                                            <th>السعر الحالي</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orderDetails.items.map((item, i) => (
                                            <tr key={i}>
                                                <td className="fw-bold text-primary">#{item.animal_code}</td>
                                                <td>{item.category_name}</td>
                                                <td>{item.weight} كجم</td>
                                                <td className="text-success fw-bold">{item.price} ج.م</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        </>
                    )}

                    {(request.quoted_total_price || request.admin_notes || request.customer_notes) && (
                        <>
                            <h6 className="fw-bold text-primary mb-3 pb-2 border-bottom">التسعير والملاحظات</h6>
                            <Row className="g-3">
                                {request.quoted_total_price && (
                                    <Col md={12}>
                                        <div className="bg-success bg-opacity-10 p-3 rounded border border-success h-100 d-flex justify-content-between align-items-center">
                                            <div>
                                                <p className="mb-1 text-success"><strong>السعر الإجمالي المقترح:</strong> <span className="fw-bold fs-5">{request.quoted_total_price} ج.م</span></p>
                                                <p className="mb-0 text-dark"><strong>العربون المطلوب:</strong> {request.quoted_deposit} ج.م</p>
                                            </div>
                                            {request.expected_delivery_date && (
                                                <div className="text-end">
                                                    <p className="mb-0 text-muted small">التوصيل المتوقع</p>
                                                    <strong><span dir="ltr">{new Date(request.expected_delivery_date).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</span></strong>
                                                </div>
                                            )}
                                        </div>
                                    </Col>
                                )}

                                {(request.customer_notes || request.admin_notes) && (
                                    <>
                                        {request.customer_notes && (
                                            <Col md={6}>
                                                <div className="bg-warning bg-opacity-10 p-3 rounded border border-warning h-100">
                                                    <strong className="text-warning-emphasis">ملاحظات العميل:</strong>
                                                    <p className="mb-0 mt-2 text-dark">{request.customer_notes}</p>
                                                </div>
                                            </Col>
                                        )}
                                        {request.admin_notes && (
                                            <Col md={request.customer_notes ? 6 : 12}>
                                                <div className="bg-light p-3 rounded border border-secondary h-100">
                                                    <strong className="text-secondary">ملاحظات الإدارة:</strong>
                                                    <div className="mb-0 mt-2 text-muted" style={{ whiteSpace: 'pre-wrap' }}>
                                                        {request.admin_notes}
                                                    </div>
                                                </div>
                                            </Col>
                                        )}
                                    </>
                                )}
                            </Row>
                        </>
                    )}

                    {orderDetails?.payments?.length > 0 && (
                        <>
                            <h6 className="fw-bold text-primary mb-3 mt-4 pb-2 border-bottom">سجل المدفوعات</h6>
                            <Table size="sm" bordered hover className="text-center">
                                <thead className="table-light">
                                    <tr>
                                        <th>التاريخ</th>
                                        <th>المبلغ</th>
                                        <th>الطريقة</th>
                                        <th>الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {orderDetails.payments.map(p => (
                                        <tr key={p.id}>
                                            <td dir="ltr">{new Date(p.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                            <td className="text-success fw-bold">{p.amount} ج.م</td>
                                            <td>{p.payment_method}</td>
                                            <td><Badge bg={p.status === 'completed' ? 'success' : 'warning'}>{p.status}</Badge></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </>
                    )}

                    <h6 className="fw-bold text-primary mb-3 mt-4 pb-2 border-bottom">المستندات والإيصالات</h6>
                    <div className="bg-light p-3 rounded border mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <div className="text-muted small">رفع إيصالات أو مستندات متعلقة بالطلب</div>
                            <div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    style={{ display: 'none' }}
                                    onChange={handleUploadReceipt}
                                    accept=".pdf,.jpg,.jpeg,.png"
                                />
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={uploadingDoc}
                                >
                                    {uploadingDoc ? <Spinner size="sm" className="me-1" /> : <UploadCloud size={14} className="me-1" />}
                                    رفع مستند
                                </Button>
                            </div>
                        </div>
                        {reqDocs.length === 0 ? (
                            <div className="text-muted text-center py-2 small">لا توجد مستندات مرفوعة بعد</div>
                        ) : (
                            <div className="list-group list-group-flush">
                                {reqDocs.map(doc => (
                                    <div key={doc.id} className="list-group-item d-flex justify-content-between align-items-center py-2 px-0 border-0 border-bottom">
                                        <div className="d-flex align-items-center gap-2">
                                            <FileText size={16} className="text-secondary" />
                                            <span className="small">{doc.title}</span>
                                        </div>
                                        <a
                                            href={doc.file}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn btn-sm btn-link text-decoration-none"
                                        >
                                            عرض
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </Modal.Body>
            </Modal>

            <Modal show={showDeliveryModal} onHide={() => setShowDeliveryModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>إعدادات التوصيل للشركة وتحديث العميل</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-bold text-primary">طريقة الاستلام</Form.Label>
                        <Form.Select value={deliveryData.delivery_type} onChange={e => setDeliveryData({...deliveryData, delivery_type: e.target.value})}>
                            <option value="">-- اختر طريقة الاستلام --</option>
                            {opSettings?.pickup_active !== false && (
                                <option value="pickup">استلام من المزرعة</option>
                            )}
                            {opSettings?.delivery_active !== false && (
                                <option value="delivery">توصيل للعنوان (شركة/فرع)</option>
                            )}
                        </Form.Select>
                    </Form.Group>

                    {deliveryData.delivery_type === 'delivery' && (
                        <Form.Group className="mb-3 bg-light p-3 rounded border">
                            <Form.Label className="fw-bold text-primary">عنوان التوصيل</Form.Label>
                            <Form.Select
                                className="mb-2"
                                value={deliveryData.delivery_address_id}
                                onChange={e => setDeliveryData({...deliveryData, delivery_address_id: e.target.value})}
                            >
                                <option value="">-- اختر عنوان للعميل --</option>
                                {customerAddresses.map(addr => (
                                    <option key={addr.id} value={addr.id}>{addr.city}, {addr.street} ({addr.governorate})</option>
                                ))}
                                <option value="new_address">+ إضافة عنوان جديد للعميل...</option>
                            </Form.Select>

                            {deliveryData.delivery_address_id === 'new_address' && (
                                <div className="mt-3 p-3 bg-white rounded border border-primary animate-fade-in-up">
                                    <Form.Label className="small fw-bold">إضافة عنوان جديد وسيحفظ للعميل</Form.Label>
                                    <Form.Select size="sm" className="mb-2" value={deliveryData.newAddress.governorate} onChange={e => setDeliveryData({...deliveryData, newAddress: {...deliveryData.newAddress, governorate: e.target.value}})}>
                                        <option value="">اختر المحافظة...</option>
                                        {governorates.map(g => <option key={g.id} value={g.name_ar}>{g.name_ar}</option>)}
                                    </Form.Select>
                                    <Form.Control size="sm" className="mb-2" type="text" placeholder="المدينة/المنطقة" value={deliveryData.newAddress.city} onChange={e => setDeliveryData({...deliveryData, newAddress: {...deliveryData.newAddress, city: e.target.value}})} />
                                    <Form.Control size="sm" type="text" placeholder="الشارع والتفاصيل" value={deliveryData.newAddress.street} onChange={e => setDeliveryData({...deliveryData, newAddress: {...deliveryData.newAddress, street: e.target.value}})} />
                                </div>
                            )}
                        </Form.Group>
                    )}

                    <Form.Group className="mb-3">
                        <Form.Label className="fw-bold text-primary">تاريخ التوصيل / الاستلام</Form.Label>
                        <Form.Control type="date" value={deliveryData.delivery_date} onChange={e => setDeliveryData({...deliveryData, delivery_date: e.target.value})} />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className="fw-bold">ملاحظات للطلب (تظهر للسائق والجزار)</Form.Label>
                        <Form.Control as="textarea" rows={2} value={deliveryData.notes} onChange={e => setDeliveryData({...deliveryData, notes: e.target.value})} />
                    </Form.Group>

                    <div className="bg-warning bg-opacity-10 border border-warning p-3 rounded mt-4">
                        <Form.Group>
                            <Form.Label className="fw-bold text-dark">تحديث / رسالة تظهر للعميل في بوابته</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                placeholder="مثال: تم تعديل موعد التسليم بناءً على طلبكم إلى يوم الخميس..."
                                value={deliveryData.admin_notes}
                                onChange={e => setDeliveryData({...deliveryData, admin_notes: e.target.value})}
                            />
                        </Form.Group>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeliveryModal(false)}>إلغاء</Button>
                    <Button variant="primary" onClick={handleUpdateDelivery} disabled={updating}>
                        {updating ? <Spinner size="sm"/> : 'تحديث وإشعار العميل'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <PrintModal
                show={printConfig.show}
                handleClose={() => setPrintConfig({show: false, title: '', endpoint: ''})}
                title={printConfig.title}
                endpoint={printConfig.endpoint}
            />
        </>
    );
};

const BusinessOrders = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedReq, setSelectedReq] = useState(null);

    const [showQuoteModal, setShowQuoteModal] = useState(false);
    const [showFulfillModal, setShowFulfillModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/orders/business-requests/', {
                params: {
                    search: searchTerm,
                    status: statusFilter !== 'all' ? statusFilter : undefined
                }
            });
            setRequests(res.data.results || res.data || []);
        } catch (err) {
            console.error(err);
            toast.error("فشل تحميل طلبات الشركات");
        } finally {
            setLoading(false);
        }
    }, [searchTerm, statusFilter]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const getStatusBadge = (status) => {
        const map = {
            'pending': { bg: 'warning', text: 'قيد المراجعة', textColor: 'text-dark' },
            'quoted': { bg: 'info', text: 'بانتظار الدفع', textColor: 'text-dark' },
            'paid': { bg: 'primary', text: 'مدفوع (تجهيز)', textColor: 'text-white' },
            'fulfilled': { bg: 'success', text: 'مكتمل ومُنفذ', textColor: 'text-white' },
            'rejected': { bg: 'danger', text: 'مرفوض', textColor: 'text-white' },
        };
        const config = map[status] || { bg: 'secondary', text: status, textColor: 'text-white' };
        return <Badge bg={config.bg} className={config.textColor}>{config.text}</Badge>;
    };

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1">إدارة طلبات الشركات</h1>
                    <p className="text-muted mb-0">متابعة وتسعير وتخصيص طلبات التوريد (B2B)</p>
                </div>
                <Button variant="outline-primary" onClick={fetchData} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'spin' : ''}/> تحديث
                </Button>
            </div>

            <Card className="shadow-sm border-0 mb-4">
                <Card.Body>
                    <Row className="g-3">
                        <Col md={6}>
                            <Form.Control
                                type="text"
                                placeholder="ابحث بالاسم أو رقم الهاتف..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </Col>
                        <Col md={6}>
                            <Form.Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                <option value="all">جميع الحالات</option>
                                <option value="pending">قيد المراجعة</option>
                                <option value="quoted">بانتظار الدفع</option>
                                <option value="paid">تم الدفع (جاري التجهيز)</option>
                                <option value="fulfilled">مكتمل ومُنفذ</option>
                            </Form.Select>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            <Card className="shadow-sm border-0">
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5"><Spinner /></div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-5 text-muted">لا توجد طلبات شركات حالياً</div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="mb-0 align-middle">
                                <thead className="bg-light">
                                    <tr>
                                        <th>#</th>
                                        <th>العميل</th>
                                        <th>التاريخ</th>
                                        <th>المطلوب</th>
                                        <th>المالية</th>
                                        <th>الحالة</th>
                                        <th>الإجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.map(req => (
                                        <tr key={req.id}>
                                            <td className="fw-bold">{req.id}</td>
                                            <td>
                                                <div className="fw-bold text-primary">{req.user_business_name || 'بدون اسم تجاري'}</div>
                                                <div className="small text-muted">{req.user_full_name}</div>
                                            </td>
                                            <td>
                                                <div className="small text-muted" dir="ltr">
                                                    {new Date(req.created_at).toLocaleDateString('en-GB')}
                                                </div>
                                            </td>
                                            <td><Badge bg="info" className="fs-6 text-dark">{req.total_quantity} رأس</Badge></td>
                                            <td>
                                                {req.converted_order_details ? (
                                                    <>
                                                        <div className="fw-bold text-success">{req.converted_order_details.total_price} ج.م</div>
                                                        <div className="small text-danger">متبقي: {req.converted_order_details.remaining_amount} ج.م</div>
                                                    </>
                                                ) : req.quoted_total_price ? (
                                                    <div className="fw-bold text-success">{req.quoted_total_price} ج.م</div>
                                                ) : (
                                                    <span className="text-muted small">لم يسعر</span>
                                                )}
                                            </td>
                                            <td>{getStatusBadge(req.status)}</td>
                                            <td>
                                                <div className="d-flex flex-wrap gap-1">
                                                    {req.status === 'pending' && (
                                                        <Button size="sm" variant="primary" onClick={() => { setSelectedReq(req); setShowQuoteModal(true); }}>
                                                            تسعير
                                                        </Button>
                                                    )}

                                                    {['quoted', 'paid'].includes(req.status) && req.converted_order_details && parseFloat(req.converted_order_details.remaining_amount) > 0 && (
                                                        <Button size="sm" variant="success" onClick={() => { setSelectedReq(req); setShowPaymentModal(true); }}>
                                                            <Wallet size={14} className="me-1" /> تسجيل دفعة
                                                        </Button>
                                                    )}

                                                    {(req.status === 'paid' || req.status === 'quoted') && (
                                                        <Button size="sm" variant="warning" onClick={() => { setSelectedReq(req); setShowFulfillModal(true); }}>
                                                            تخصيص المواشي
                                                        </Button>
                                                    )}

                                                    <Button size="sm" variant="outline-secondary" onClick={() => { setSelectedReq(req); setShowViewModal(true); }}>
                                                        <Eye size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>

            <QuoteModal show={showQuoteModal} handleClose={() => setShowQuoteModal(false)} request={selectedReq} onSave={fetchData} />
            <FulfillModal show={showFulfillModal} handleClose={() => setShowFulfillModal(false)} request={selectedReq} onSave={fetchData} />
            <RecordPaymentModal show={showPaymentModal} handleClose={() => setShowPaymentModal(false)} request={selectedReq} onSave={fetchData} />
            <ViewRequestModal show={showViewModal} handleClose={() => setShowViewModal(false)} request={selectedReq} onRefresh={fetchData} />
        </div>
    );
};

export default BusinessOrders;
