import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Tab, Nav, Form, Row, Col, Button, Table, Badge, Spinner, Card, Modal, Alert } from 'react-bootstrap';
import { format } from 'date-fns';
import { Eye, DollarSign, Calendar, User, Phone, ShoppingBag, XCircle, Printer, CheckSquare, Truck, FileText, Wallet } from 'lucide-react';

const PaymentsModal = ({ show, handleClose, order }) => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (show && order) {
            setLoading(true);
            axios.get(`/payments/?order=${order.id}`)
                .then(res => setPayments(res.data.results || res.data || []))
                .catch(() => toast.error("فشل تحميل المدفوعات"))
                .finally(() => setLoading(false));
        }
    }, [show, order]);

    return (
        <Modal show={show} onHide={handleClose} centered size={isMobile ? "md" : "lg"} fullscreen={isMobile ? "sm-down" : undefined}>
            <Modal.Header closeButton className="border-bottom-0 pb-1">
                <Modal.Title className={isMobile ? "h6" : "h5"}>
                    سجل مدفوعات طلب #{order?.id}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                {loading ? (
                    <div className="text-center py-4">
                        <Spinner animation="border" size={isMobile ? "sm" : undefined} />
                        <div className="mt-2 small">جاري تحميل المدفوعات...</div>
                    </div>
                ) : (
                    <div className={isMobile ? "table-responsive-sm" : "table-responsive"}>
                        <Table striped bordered size={isMobile ? "sm" : undefined} className="mb-0">
                            <thead className="table-light">
                                <tr>
                                    <th className={isMobile ? "small" : ""}>التاريخ</th>
                                    <th className={isMobile ? "small" : ""}>الطريقة</th>
                                    <th className={isMobile ? "small" : ""}>المصدر</th>
                                    <th className={isMobile ? "small" : ""}>المبلغ</th>
                                    <th className={isMobile ? "small" : ""}>الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payments.map(p => (
                                    <tr key={p.id}>
                                        <td className={isMobile ? "small" : ""}>
                                            {format(new Date(p.created_at), isMobile ? 'MM-dd HH:mm' : 'yyyy-MM-dd HH:mm')}
                                        </td>
                                        <td className={isMobile ? "small" : ""} dir="ltr">
                                            {p.payment_method === 'cash' ? 'كاش' :
                                             p.payment_method === 'pos' ? 'ماكينة POS' :
                                             p.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                                             (p.payment_method === 'paymob_link' && p.status === 'pending') ? 'رابط دفع قيد الانتظار...' :
                                             (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? p.payment_method :
                                             p.payment_method === 'paymob' ? 'أونلاين (المتجر)' :
                                             p.payment_method}
                                        </td>
                                        <td>
                                            <Badge
                                                bg={p.payment_method.includes('رابط') || (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'warning' : 'secondary'}
                                                text={p.payment_method.includes('رابط') || (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'dark' : 'light'}
                                            >
                                                {p.payment_method.includes('رابط') || (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'رابط دفع أونلاين (SMS)' : 'المتجر الإلكتروني'}
                                            </Badge>
                                        </td>
                                        <td className={isMobile ? "small" : ""}>{p.amount} ج</td>
                                        <td>
                                            <Badge
                                                bg={p.status === 'completed' ? 'success' : 'warning'}
                                                className={isMobile ? "small" : ""}
                                            >
                                                {p.status}
                                            </Badge>
                                        </td>
                                    </tr>
                                ))}
                                {payments.length === 0 && (
                                    <tr>
                                        <td colSpan="4" className="text-center py-3 text-muted">
                                            لا توجد مدفوعات.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer className="border-top-0 pt-1">
                <Button
                    variant="secondary"
                    onClick={handleClose}
                    size={isMobile ? "sm" : undefined}
                    className="w-100"
                >
                    إغلاق
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const getOrderTypeBadge = (typeLabel) => {
    switch (typeLabel) {
        case 'نقطة بيع': return { bg: 'info', text: 'dark' };
        case 'مجموعة خاصة': return { bg: 'purple', text: 'white', style: { backgroundColor: '#6f42c1' } };
        case 'مسبح أضاحي': return { bg: 'primary', text: 'white' };
        case 'مشاركة (لحم)': return { bg: 'primary', text: 'white' };
        case 'أضحية كاملة': return { bg: 'success', text: 'white' };
        default: return { bg: 'secondary', text: 'white' };
    }
};

const MobileOrderCard = ({ order, onViewPayments, onCancelOrder }) => {
    const typeBadge = getOrderTypeBadge(order.order_type_display || order.order_type);
    return (
        <Card className="mb-2 border shadow-sm">
            <Card.Body className="p-3">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <div>
                        <div className="d-flex align-items-center mb-1">
                            <ShoppingBag size={16} className="me-1 text-primary" />
                            <strong className="h6 mb-0">طلب #{order.id}</strong>
                        </div>
                        <div className="d-flex align-items-center small text-muted mb-1">
                            <Calendar size={12} className="me-1" />
                            <span>{format(new Date(order.created_at), 'MM-dd HH:mm')}</span>
                        </div>
                    </div>
                    <Badge
                        bg={order.status === 'canceled' ? 'secondary' : parseFloat(order.remaining_amount) > 0 ? 'warning' : 'success'}
                        className="small"
                    >
                        {order.status === 'canceled' ? 'ملغي' : parseFloat(order.remaining_amount) > 0 ? 'متبقي' : 'خالص'}
                    </Badge>
                </div>

                <div className="mb-2">
                    <div className="d-flex align-items-center mb-1 small">
                        <User size={12} className="me-1 text-muted" />
                        <span className="fw-semibold">{order.customer_name}</span>
                    </div>
                    <div className="d-flex align-items-center small">
                        <Phone size={12} className="me-1 text-muted" />
                        <span>{order.customer_phone}</span>
                    </div>
                </div>

                <div className="mb-2 small text-muted">
                    <div>الموظف: {order.employee_name}</div>
                    <div>القسم: {order.employee_department}</div>
                    <div className="mt-1">
                        <Badge bg={typeBadge.bg} text={typeBadge.text} style={typeBadge.style}>
                            {order.order_type_display || order.order_type}
                        </Badge>
                    </div>
                </div>

                <div className="border-top border-bottom py-2 mb-2">
                    <div className="row small text-center">
                        <div className="col-4">
                            <div className="text-muted mb-1">الإجمالي</div>
                            <div className="fw-bold">{parseFloat(order.total_price).toFixed(2)} ج</div>
                        </div>
                        <div className="col-4">
                            <div className="text-muted mb-1">المدفوع</div>
                            <div className="fw-bold text-success">{parseFloat(order.deposit_total).toFixed(2)} ج</div>
                        </div>
                        <div className="col-4">
                            <div className="text-muted mb-1">المتبقي</div>
                            <div className={`fw-bold ${order.status === 'canceled' ? 'text-muted' : parseFloat(order.remaining_amount) > 0 ? 'text-danger' : 'text-success'}`}>
                                {order.status === 'canceled' ? 'ملغي' : `${parseFloat(order.remaining_amount).toFixed(2)} ج`}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="d-flex gap-2">
                    <Button
                        variant="outline-info"
                        size="sm"
                        onClick={() => onViewPayments(order)}
                        className="flex-fill d-flex align-items-center justify-content-center gap-1"
                    >
                        <DollarSign size={14} />
                        <span>المدفوعات</span>
                    </Button>
                    {order.status !== 'canceled' && order.status !== 'completed' && (
                        <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => onCancelOrder(order)}
                            className="flex-fill d-flex align-items-center justify-content-center gap-1"
                        >
                            <XCircle size={14} />
                            <span>إلغاء</span>
                        </Button>
                    )}
                </div>
            </Card.Body>
        </Card>
    );
};

const DesktopOrderTable = ({ orders, loading, onViewPayments, onCancelOrder }) => {
    const getTypeBadge = (typeLabel) => {
        const badge = getOrderTypeBadge(typeLabel);
        return <Badge bg={badge.bg} text={badge.text} style={badge.style}>{typeLabel}</Badge>;
    };

    return (
        <div className="table-responsive">
            <Table striped bordered hover className="mb-0">
                <thead className="table-light">
                    <tr>
                        <th>#</th>
                        <th>التاريخ والوقت</th>
                        <th>النوع</th>
                        <th>العميل</th>
                        <th>الهاتف</th>
                        <th>الموظف</th>
                        <th>الإجمالي (ج)</th>
                        <th>المدفوع (ج)</th>
                        <th>المتبقي (ج)</th>
                        <th>الحالة</th>
                        <th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    {loading ? (
                        <tr>
                            <td colSpan="11" className="text-center py-4">
                                <Spinner animation="border" />
                                <div className="mt-2">جاري تحميل البيانات...</div>
                            </td>
                        </tr>
                    ) : orders.length === 0 ? (
                        <tr>
                            <td colSpan="11" className="text-center py-4 text-muted">
                                لا توجد طلبات تطابق الفلتر.
                            </td>
                        </tr>
                    ) : (
                        orders.map(order => (
                            <tr key={order.id}>
                                <td className="fw-semibold">{order.id}</td>
                                <td>{format(new Date(order.created_at), 'yyyy-MM-dd HH:mm')}</td>
                                <td>{getTypeBadge(order.order_type_display || order.order_type)}</td>
                                <td>{order.customer_name}</td>
                                <td>{order.customer_phone}</td>
                                <td>{order.employee_name} ({order.employee_department})</td>
                                <td>{parseFloat(order.total_price).toFixed(2)}</td>
                                <td className="text-success fw-bold">{parseFloat(order.deposit_total).toFixed(2)}</td>
                                <td>
                                    {order.status === 'canceled' ? (
                                        <Badge bg="secondary">ملغي</Badge>
                                    ) : parseFloat(order.remaining_amount) > 0 ?
                                        <span className="text-danger fw-bold">{parseFloat(order.remaining_amount).toFixed(2)}</span> :
                                        <Badge bg="success">خالص</Badge>
                                    }
                                </td>
                                <td>
                                    <Badge bg={
                                        order.status === 'completed' ? 'success' :
                                        order.status === 'canceled' ? 'danger' : 'warning'
                                    }>
                                        {order.status_display}
                                    </Badge>
                                </td>
                                <td>
                                    <div className="d-flex gap-1">
                                        <Button
                                            variant="outline-info"
                                            size="sm"
                                            onClick={() => onViewPayments(order)}
                                            title="سجل الدفعات"
                                            className="d-flex align-items-center gap-1"
                                        >
                                            <DollarSign size={14} />
                                            <span className="d-none d-md-inline">المدفوعات</span>
                                        </Button>
                                        {order.status !== 'canceled' && order.status !== 'completed' && (
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => onCancelOrder(order)}
                                                title="إلغاء الطلب"
                                                className="d-flex align-items-center gap-1"
                                            >
                                                <XCircle size={14} />
                                                <span className="d-none d-md-inline">إلغاء</span>
                                            </Button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </Table>
        </div>
    );
};

const SalesLedger = () => {
    const [activeTab, setActiveTab] = useState('reconciliation');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [reconciliationData, setReconciliationData] = useState(null);
    const [ordersData, setOrdersData] = useState({ online_store: [], on_farm: [] });
    const [ordersLoading, setOrdersLoading] = useState({ online_store: true, on_farm: true });
    const [reconciliationLoading, setReconciliationLoading] = useState(true);
    const [ordersKey, setOrdersKey] = useState('online_store');
    const [filters, setFilters] = useState({
        start_date: new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0],
        end_date: new Date().toISOString().split('T')[0],
    });
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchReconciliationData = useCallback(async () => {
        setReconciliationLoading(true);
        try {
            const res = await axios.get(`/management/reconciliation/?date=${date}`);
            setReconciliationData(res.data);
        } catch {
            toast.error("فشل تحميل بيانات الجرد.");
        } finally {
            setReconciliationLoading(false);
        }
    }, [date]);

    const fetchOrdersData = useCallback(async (source) => {
        setOrdersLoading(prev => ({ ...prev, [source]: true }));
        try {
            const params = { ...filters, source };
            const response = await axios.get('/management/order-ledger/', { params });
            setOrdersData(prev => ({ ...prev, [source]: response.data.results || [] }));
        } catch {
            toast.error(`فشل تحميل طلبات ${source === 'on_farm' ? 'نقطة البيع' : 'المتجر'}.`);
        } finally {
            setOrdersLoading(prev => ({ ...prev, [source]: false }));
        }
    }, [filters]);

    useEffect(() => {
        if (activeTab === 'reconciliation') {
            fetchReconciliationData();
        } else {
            fetchOrdersData('online_store');
            fetchOrdersData('on_farm');
        }
    }, [activeTab, date, filters, fetchReconciliationData, fetchOrdersData]);

    const handleFilterChange = (e) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleApplyFilters = () => {
        fetchOrdersData('online_store');
        fetchOrdersData('on_farm');
    };

    const handleCancelOrder = async (order) => {
        if(window.confirm(`هل أنت متأكد من إلغاء الطلب رقم #${order.id}؟`)) {
            try {
                await axios.post(`/management/orders/${order.id}/cancel/`);
                toast.success("تم إلغاء الطلب.");
                fetchOrdersData(order.source === 'on_farm' ? 'on_farm' : 'online_store');
            } catch {
                toast.error("فشل إلغاء الطلب.");
            }
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const driversTotalCash = reconciliationData?.drivers_reconciliation.reduce((sum, d) => sum + d.total_cash_to_collect, 0) || 0;
    const salesTotalCash = reconciliationData?.sales_reconciliation.reduce((sum, s) => sum + parseFloat(s.cash_in_hand), 0) || 0;

    const currentOrders = ordersData[ordersKey];
    const currentOrdersLoading = ordersLoading[ordersKey];

    return (
        <div className="container-fluid py-3 sales-ledger-page">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3 no-print">
                <div>
                    <h2 className="h4 fw-bold mb-1 d-flex align-items-center gap-2">
                        <CheckSquare className="text-primary" />
                        سجل الجرد اليومي والمطابقة
                    </h2>
                    <p className="text-muted mb-0">مطابقة النقدية والأوراق للموظفين والسائقين</p>
                </div>

                <div className="d-flex gap-2 bg-white p-2 rounded shadow-sm border">
                    <div className="d-flex align-items-center gap-2">
                        <Calendar size={18} className="text-muted" />
                        <span className="small fw-bold">تاريخ الجرد:</span>
                    </div>
                    <Form.Control
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        size="sm"
                        style={{ width: '150px' }}
                        disabled={activeTab === 'orders'}
                    />
                    <Button variant="secondary" size="sm" onClick={handlePrint}>
                        <Printer size={16} />
                    </Button>
                </div>
            </div>

            <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                <Card className="shadow-sm border-0">
                    <Card.Header className="bg-white p-0 border-bottom-0">
                        <Nav variant="tabs" className="px-3 pt-3">
                            <Nav.Item>
                                <Nav.Link eventKey="reconciliation" className="fw-bold px-4">
                                    <Truck size={18} className="me-2" />
                                    جرد السائقين (العهد)
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="orders" className="fw-bold px-4">
                                    <ShoppingBag size={18} className="me-2" />
                                    سجل الطلبات
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>
                    </Card.Header>

                    <Card.Body className="p-4 bg-light">
                        <Tab.Content>
                            <Tab.Pane eventKey="reconciliation">
                                {reconciliationLoading ? (
                                    <div className="text-center py-5">
                                        <Spinner animation="border" variant="primary" />
                                        <p className="mt-2 text-muted">جاري تجميع بيانات الجرد...</p>
                                    </div>
                                ) : (
                                    <>
                                        <Row className="mb-4 g-3">
                                            <Col md={6}>
                                                <Card className="border-start border-success border-4 shadow-sm h-100">
                                                    <Card.Body className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <small className="text-muted fw-bold">إجمالي الكاش المتوقع من السائقين</small>
                                                            <h3 className="mb-0 text-success fw-black">{driversTotalCash.toLocaleString()} ج.م</h3>
                                                        </div>
                                                        <div className="bg-success bg-opacity-10 p-3 rounded-circle text-success">
                                                            <Truck size={24} />
                                                        </div>
                                                    </Card.Body>
                                                </Card>
                                            </Col>
                                            <Col md={6}>
                                                <Card className="border-start border-primary border-4 shadow-sm h-100">
                                                    <Card.Body className="d-flex justify-content-between align-items-center">
                                                        <div>
                                                            <small className="text-muted fw-bold">إجمالي الكاش في الدرج (مبيعات)</small>
                                                            <h3 className="mb-0 text-primary fw-black">{salesTotalCash.toLocaleString()} ج.م</h3>
                                                        </div>
                                                        <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary">
                                                            <Wallet size={24} />
                                                        </div>
                                                    </Card.Body>
                                                </Card>
                                            </Col>
                                        </Row>

                                        {reconciliationData?.drivers_reconciliation.length === 0 ? (
                                            <Alert variant="info" className="text-center m-0">
                                                لا توجد رحلات توصيل مسجلة لهذا اليوم.
                                            </Alert>
                                        ) : (
                                            <div className="d-flex flex-column gap-4">
                                                {reconciliationData?.drivers_reconciliation.map((shipment, idx) => (
                                                    <Card key={idx} className="border shadow-sm">
                                                        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                                                            <div>
                                                                <h5 className="mb-1 fw-bold text-dark">
                                                                    <Truck size={20} className="me-2 text-muted" />
                                                                    {shipment.driver_name}
                                                                </h5>
                                                                <small className="text-muted">
                                                                    {shipment.vehicle ? `السيارة: ${shipment.vehicle}` : ''}
                                                                    {shipment.shipment_id !== 'no-shipment' && ` • رحلة #${shipment.shipment_id}`}
                                                                </small>
                                                            </div>
                                                            <div className="text-end bg-warning bg-opacity-10 px-3 py-2 rounded border border-warning">
                                                                <small className="d-block text-muted">المطلوب توريده</small>
                                                                <span className="h5 fw-black text-dark mb-0">
                                                                    {shipment.total_cash_to_collect.toLocaleString()} ج.م
                                                                </span>
                                                            </div>
                                                        </Card.Header>
                                                        <Card.Body className="p-0">
                                                            <Table responsive striped hover className="mb-0">
                                                                <thead className="bg-light">
                                                                    <tr>
                                                                        <th>رقم الطلب</th>
                                                                        <th>العميل</th>
                                                                        <th>المطلوب تحصيله</th>
                                                                        <th>الورق المطلوب</th>
                                                                        <th className="text-center no-print">تأكيد الاستلام</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {shipment.paperwork.map((paper, pIdx) => (
                                                                        <tr key={pIdx}>
                                                                            <td className="fw-bold">#{paper.order_id}</td>
                                                                            <td>{paper.customer_name}</td>
                                                                            <td className="fw-bold text-danger">
                                                                                {paper.amount_collected > 0 ? `${paper.amount_collected} ج.م` : '-'}
                                                                            </td>
                                                                            <td>
                                                                                <div className="d-flex align-items-center gap-2">
                                                                                    <FileText size={16} className="text-muted" />
                                                                                    {paper.doc_name}
                                                                                </div>
                                                                            </td>
                                                                            <td className="text-center no-print">
                                                                                <Form.Check type="checkbox" aria-label="confirm" />
                                                                            </td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </Table>
                                                        </Card.Body>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </Tab.Pane>

                            <Tab.Pane eventKey="orders">
                                <Card className="shadow-sm border-0 mb-3">
                                    <Card.Body className="p-2 p-md-3">
                                        <Row className="g-2 g-md-3 align-items-end">
                                            <Col xs={12} sm={6} md={4}>
                                                <Form.Group>
                                                    <Form.Label className={`${isMobile ? 'small mb-1' : 'mb-1'}`}>من تاريخ</Form.Label>
                                                    <Form.Control
                                                        type="date"
                                                        name="start_date"
                                                        value={filters.start_date}
                                                        onChange={handleFilterChange}
                                                        size={isMobile ? "sm" : undefined}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col xs={12} sm={6} md={4}>
                                                <Form.Group>
                                                    <Form.Label className={`${isMobile ? 'small mb-1' : 'mb-1'}`}>إلى تاريخ</Form.Label>
                                                    <Form.Control
                                                        type="date"
                                                        name="end_date"
                                                        value={filters.end_date}
                                                        onChange={handleFilterChange}
                                                        size={isMobile ? "sm" : undefined}
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col xs={12} md={4}>
                                                <Button
                                                    onClick={handleApplyFilters}
                                                    className="w-100"
                                                    size={isMobile ? "sm" : undefined}
                                                >
                                                    {isMobile ? 'تطبيق' : 'تطبيق الفلتر'}
                                                </Button>
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>

                                <div className="mb-3">
                                    <Nav variant="pills" className={`${isMobile ? 'flex-row' : ''}`}>
                                        <Nav.Item className="flex-fill text-center">
                                            <Nav.Link
                                                eventKey="online_store"
                                                active={ordersKey === 'online_store'}
                                                onClick={() => setOrdersKey('online_store')}
                                                className={`py-2 ${isMobile ? 'small' : ''}`}
                                            >
                                                {isMobile ? 'المتجر' : 'طلبات المتجر الإلكتروني'}
                                            </Nav.Link>
                                        </Nav.Item>
                                        <Nav.Item className="flex-fill text-center">
                                            <Nav.Link
                                                eventKey="on_farm"
                                                active={ordersKey === 'on_farm'}
                                                onClick={() => setOrdersKey('on_farm')}
                                                className={`py-2 ${isMobile ? 'small' : ''}`}
                                            >
                                                {isMobile ? 'نقطة البيع' : 'طلبات نقطة البيع'}
                                            </Nav.Link>
                                        </Nav.Item>
                                    </Nav>
                                </div>

                                <div className="orders-content">
                                    {isMobile ? (
                                        <div className="mobile-orders-view">
                                            {currentOrdersLoading ? (
                                                <div className="text-center py-4">
                                                    <Spinner animation="border" size="sm" />
                                                    <div className="mt-2 small">جاري تحميل الطلبات...</div>
                                                </div>
                                            ) : currentOrders.length === 0 ? (
                                                <Card className="text-center border-0 shadow-sm">
                                                    <Card.Body className="py-5">
                                                        <ShoppingBag size={32} className="text-muted mb-2" />
                                                        <h6 className="text-muted">لا توجد طلبات</h6>
                                                        <p className="small text-muted mb-0">لا توجد طلبات تطابق الفلتر المحدد</p>
                                                    </Card.Body>
                                                </Card>
                                            ) : (
                                                <div className="orders-list">
                                                    {currentOrders.map(order => (
                                                        <MobileOrderCard
                                                            key={order.id}
                                                            order={order}
                                                            onViewPayments={(o) => { setSelectedOrder(o); setShowPaymentModal(true); }}
                                                            onCancelOrder={handleCancelOrder}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <DesktopOrderTable
                                            orders={currentOrders}
                                            loading={currentOrdersLoading}
                                            onViewPayments={(o) => { setSelectedOrder(o); setShowPaymentModal(true); }}
                                            onCancelOrder={handleCancelOrder}
                                        />
                                    )}
                                </div>
                            </Tab.Pane>
                        </Tab.Content>
                    </Card.Body>
                </Card>
            </Tab.Container>

            <PaymentsModal
                show={showPaymentModal}
                handleClose={() => setShowPaymentModal(false)}
                order={selectedOrder}
            />

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    .sales-ledger-page { background: white !important; }
                    .card { border: 1px solid #ddd !important; break-inside: avoid; }
                    .badge { border: 1px solid #000; color: #000 !important; background: none !important; }
                    .nav-tabs { display: none !important; }
                    .tab-content > .tab-pane { display: block !important; opacity: 1 !important; }
                }

                @media (max-width: 768px) {
                    .sales-ledger-container {
                        max-width: 100%;
                        overflow-x: hidden;
                    }

                    .table-responsive {
                        font-size: 0.85rem;
                    }

                    .card {
                        border-radius: 10px;
                    }

                    .btn {
                        min-height: 44px;
                        padding: 0.5rem;
                    }

                    .btn-sm {
                        min-height: 38px;
                    }

                    .form-control {
                        padding: 0.375rem 0.5rem;
                    }

                    .nav-pills .nav-link {
                        padding: 0.5rem;
                        font-size: 0.9rem;
                    }
                }

                .orders-list {
                    max-height: 70vh;
                    overflow-y: auto;
                }

                .orders-list::-webkit-scrollbar {
                    width: 4px;
                }

                .orders-list::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }

                .orders-list::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 2px;
                }

                .orders-list::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }

                .mobile-orders-view .btn {
                    touch-action: manipulation;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .mobile-orders-view .orders-list > * {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default SalesLedger;
