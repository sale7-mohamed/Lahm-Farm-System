import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Card, Button, Form, Table, Badge, Tab, Nav, Spinner, Row, Col, Modal } from 'react-bootstrap';
import { PhoneCall, Mail, Play, CheckCircle, Clock, Eye, UserSearch, UserPlus, ArrowLeft, Headphones } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCall } from '../hooks/useCall';
import { format } from 'date-fns';

const CustomerService = () => {
    const [activeTab, setActiveTab] = useState('calls');
    const [messages, setMessages] = useState([]);
    const [callLogs, setCallLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewMessage, setViewMessage] = useState(null);
    const navigate = useNavigate();

    const { isCallActive, callData, timerDisplay, startCall } = useCall();

    const [dialPhone, setDialPhone] = useState('');
    const [dialName, setDialName] = useState('');
    const [foundCustomer, setFoundCustomer] = useState(null);
    const [isCheckingCustomer, setIsCheckingCustomer] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            if (activeTab === 'messages') {
                const res = await axios.get('/management/contact-messages/');
                setMessages(res.data.results || res.data || []);
            } else {
                const res = await axios.get('/management/call-logs/');
                setCallLogs(res.data.results || res.data || []);
            }
        } catch {
            toast.error('فشل تحميل البيانات');
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const handleGlobalNotif = () => fetchData();
        window.addEventListener('app-notification-received', handleGlobalNotif);
        return () => window.removeEventListener('app-notification-received', handleGlobalNotif);
    }, [fetchData]);

    useEffect(() => {
        const phone = dialPhone.replace(/\D/g, '');
        if (phone.length === 11 && phone.startsWith('01')) {
            setIsCheckingCustomer(true);
            const delay = setTimeout(async () => {
                try {
                    const res = await axios.get(`/management/customer-lookup/?phone=${phone}`);
                    setFoundCustomer(res.data.user_details);
                    setDialName(res.data.user_details.full_name);
                } catch {
                    setFoundCustomer(null);
                } finally {
                    setIsCheckingCustomer(false);
                }
            }, 800);
            return () => clearTimeout(delay);
        } else {
            setFoundCustomer(null);
            setIsCheckingCustomer(false);
            setDialName('');
        }
    }, [dialPhone]);

    const resetDialer = () => {
        setDialPhone('');
        setDialName('');
        setFoundCustomer(null);
    };

    const handleStartRegisteredCall = () => {
        startCall(dialPhone, foundCustomer.full_name);
        navigate('/customer-lookup', { state: { searchPhone: dialPhone } });
        resetDialer();
    };

    const handleCreateAndStartCall = async () => {
        if (!dialName.trim()) {
            toast.warn('يرجى إدخال اسم العميل');
            return;
        }
        try {
            await axios.post('/management/customer-lookup/', {
                phone: dialPhone,
                full_name: dialName.trim()
            });
            toast.success('تم إنشاء الحساب بنجاح.');
            startCall(dialPhone, dialName.trim());
            navigate('/customer-lookup', { state: { searchPhone: dialPhone } });
            resetDialer();
        } catch {
            toast.error('فشل إنشاء الحساب.');
        }
    };

    const markMessageAsRead = async (id) => {
        try {
            await axios.patch(`/management/contact-messages/${id}/`, { is_read: true });
            toast.success('تم تحديث الحالة');
            fetchData();
            setViewMessage(null);
        } catch {
            toast.error('فشل التحديث');
        }
    };

    const handleOpenCustomerProfile = (phone, name = '') => {
        navigate('/customer-lookup', { state: { searchPhone: phone, searchName: name } });
    };

    return (
        <div className="container-fluid py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 fw-bold mb-1">مركز خدمة العملاء</h1>
                    <p className="text-muted mb-0">متابعة المكالمات والرسائل</p>
                </div>
            </div>

            <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
                <Card className="shadow-sm border-0 mb-4">
                    <Card.Header className="bg-white border-bottom-0 p-0">
                        <Nav variant="tabs" className="px-3 pt-3">
                            <Nav.Item>
                                <Nav.Link eventKey="calls" className="fw-bold px-4 py-3 d-flex align-items-center gap-2">
                                    <PhoneCall size={18} /> سجل المكالمات
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="messages" className="fw-bold px-4 py-3 d-flex align-items-center gap-2">
                                    <Mail size={18} /> رسائل الموقع
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>
                    </Card.Header>

                    <Card.Body className="bg-light">
                        <Tab.Content>
                            <Tab.Pane eventKey="calls">
                                <Row className="g-4">
                                    <Col lg={4}>
                                        <Card className="border-0 shadow-sm sticky-top" style={{ top: '80px' }}>
                                            <Card.Header className="bg-primary text-white py-3">
                                                <h6 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                                    {isCallActive ? <Headphones size={20} className="animate-pulse" /> : <PhoneCall size={20} />}
                                                    {isCallActive ? 'مكالمة جارية' : 'بدء مكالمة جديدة'}
                                                </h6>
                                            </Card.Header>
                                            <Card.Body>
                                                {isCallActive ? (
                                                    <div className="text-center py-4">
                                                        <PhoneCall size={48} className="text-danger mb-3 animate-pulse" />
                                                        <h5 className="text-danger mb-2">هناك مكالمة جارية حالياً</h5>
                                                        <p className="text-muted mb-3 fw-bold">{callData.customer_name}</p>
                                                        <p className="text-muted mb-4" dir="ltr">{callData.customer_phone}</p>
                                                        <div className="bg-light p-3 rounded fw-bold font-monospace mb-4 fs-3 border" dir="ltr">
                                                            {timerDisplay}
                                                        </div>
                                                        <Button
                                                            variant="primary"
                                                            onClick={() => navigate('/customer-lookup', { state: { searchPhone: callData.customer_phone } })}
                                                            className="w-100 rounded-pill d-flex justify-content-center align-items-center gap-2"
                                                            size="lg"
                                                        >
                                                            العودة لملف العميل <ArrowLeft size={18} />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <Form.Group className="mb-4">
                                                            <Form.Label className="small fw-bold">رقم الهاتف *</Form.Label>
                                                            <Form.Control
                                                                type="tel"
                                                                value={dialPhone}
                                                                onChange={(e) => setDialPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                                                                dir="ltr"
                                                                placeholder="01xxxxxxxxx"
                                                                size="lg"
                                                                className="text-center fw-bold tracking-wider"
                                                            />
                                                        </Form.Group>

                                                        {dialPhone.length === 11 && dialPhone.startsWith('01') && (
                                                            <div className="mb-4 animate-fade-in-up">
                                                                {isCheckingCustomer ? (
                                                                    <div className="text-center text-muted py-3">
                                                                        <Spinner size="sm" animation="border" className="me-2"/> جاري التحقق...
                                                                    </div>
                                                                ) : foundCustomer ? (
                                                                    <Form.Group>
                                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                                            <Form.Label className="small fw-bold m-0">اسم العميل</Form.Label>
                                                                            <Badge bg="success">مسجل</Badge>
                                                                        </div>
                                                                        <Form.Control
                                                                            type="text"
                                                                            value={foundCustomer.full_name}
                                                                            disabled
                                                                            className="bg-light fw-bold text-dark"
                                                                        />
                                                                    </Form.Group>
                                                                ) : (
                                                                    <Form.Group>
                                                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                                                            <Form.Label className="small fw-bold m-0">اسم العميل الجديد</Form.Label>
                                                                            <Badge bg="secondary">غير مسجل</Badge>
                                                                        </div>
                                                                        <Form.Control
                                                                            type="text"
                                                                            value={dialName}
                                                                            onChange={e => setDialName(e.target.value)}
                                                                            placeholder="اكتب اسم العميل لإنشاء الحساب..."
                                                                            autoFocus
                                                                        />
                                                                    </Form.Group>
                                                                )}
                                                            </div>
                                                        )}

                                                        <Button
                                                            variant={foundCustomer ? "success" : "primary"}
                                                            size="lg"
                                                            className="w-100 rounded-pill d-flex justify-content-center align-items-center gap-2 mt-4"
                                                            disabled={dialPhone.length !== 11 || isCheckingCustomer || (!foundCustomer && !dialName.trim())}
                                                            onClick={foundCustomer ? handleStartRegisteredCall : handleCreateAndStartCall}
                                                        >
                                                            {foundCustomer ? (
                                                                <><Play size={20} /> بدء المكالمة والانتقال للملف</>
                                                            ) : (
                                                                <><UserPlus size={20} /> إنشاء حساب وبدء المكالمة</>
                                                            )}
                                                        </Button>
                                                    </div>
                                                )}
                                            </Card.Body>
                                        </Card>
                                    </Col>

                                    <Col lg={8}>
                                        <Card className="border-0 shadow-sm">
                                            <Card.Header className="bg-white py-3">
                                                <h6 className="mb-0 fw-bold">سجل المكالمات السابقة</h6>
                                            </Card.Header>
                                            <Card.Body className="p-0">
                                                {loading ? (
                                                    <div className="text-center p-4"><Spinner animation="border" /></div>
                                                ) : (
                                                    <Table hover responsive className="mb-0">
                                                        <thead className="bg-light">
                                                            <tr>
                                                                <th>التاريخ والمدة</th>
                                                                <th>العميل</th>
                                                                <th>النوع والحالة</th>
                                                                <th>الملاحظات</th>
                                                                <th>الموظف</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {callLogs.map(log => (
                                                                <tr key={log.id}>
                                                                    <td>
                                                                        <div className="fw-bold small" dir="ltr" style={{textAlign: 'right'}}>
                                                                            {format(new Date(log.start_time), 'yyyy-MM-dd hh:mm a')}
                                                                        </div>
                                                                        <Badge bg="light" text="dark" className="mt-1 border">
                                                                            <Clock size={10} className="me-1" /> {Math.floor(log.duration_seconds / 60)} د {log.duration_seconds % 60} ث
                                                                        </Badge>
                                                                    </td>
                                                                    <td>
                                                                        <div className="fw-bold">{log.customer_name || 'غير مسجل'}</div>
                                                                        <div className="text-muted small" dir="ltr" style={{textAlign: 'right'}}>{log.customer_phone}</div>
                                                                    </td>
                                                                    <td>
                                                                        <Badge bg="info" className="me-1 mb-1">{log.reason_display}</Badge><br />
                                                                        <Badge bg={log.status === 'resolved' ? 'success' : 'warning'}>{log.status_display}</Badge>
                                                                    </td>
                                                                    <td>
                                                                        <div className="text-truncate small" style={{ maxWidth: '200px' }} title={log.notes}>
                                                                            {log.notes}
                                                                        </div>
                                                                    </td>
                                                                    <td className="small">{log.handled_by_name}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                )}
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                </Row>
                            </Tab.Pane>

                            <Tab.Pane eventKey="messages">
                                <Card className="border-0 shadow-sm">
                                    <Card.Body className="p-0">
                                        {loading ? (
                                            <div className="text-center p-4"><Spinner animation="border" /></div>
                                        ) : (
                                            <Table hover responsive className="mb-0 align-middle">
                                                <thead className="bg-light">
                                                    <tr>
                                                        <th>التاريخ</th>
                                                        <th>العميل</th>
                                                        <th>الموضوع</th>
                                                        <th>الحالة</th>
                                                        <th>الإجراءات</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {messages.map(msg => (
                                                        <tr key={msg.id} className={msg.is_read ? 'bg-light text-muted' : ''}>
                                                            <td className="small" dir="ltr" style={{textAlign: 'right'}}>
                                                                {format(new Date(msg.created_at), 'yyyy-MM-dd hh:mm a')}
                                                            </td>
                                                            <td>
                                                                <div className="fw-bold">{msg.name}</div>
                                                                <div className="text-muted small" dir="ltr" style={{textAlign: 'right'}}>{msg.phone}</div>
                                                                {msg.is_registered ? (
                                                                    <Badge bg="success" className="mt-1" style={{ fontSize: '10px' }}>مسجل</Badge>
                                                                ) : (
                                                                    <Badge bg="secondary" className="mt-1" style={{ fontSize: '10px' }}>زائر</Badge>
                                                                )}
                                                            </td>
                                                            <td className="fw-bold text-truncate" style={{ maxWidth: '200px' }}>{msg.subject}</td>
                                                            <td>
                                                                {msg.is_read ? (
                                                                    <Badge bg="light" text="muted">مقروءة</Badge>
                                                                ) : (
                                                                    <Badge bg="danger">جديدة</Badge>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <div className="d-flex gap-2">
                                                                    <Button variant="outline-primary" size="sm" onClick={() => setViewMessage(msg)}>
                                                                        <Eye size={14} className="me-1" /> عرض
                                                                    </Button>
                                                                    <Button
                                                                        variant={msg.is_registered ? 'success' : 'info'}
                                                                        size="sm"
                                                                        onClick={() => handleOpenCustomerProfile(msg.phone, msg.name)}
                                                                    >
                                                                        <UserSearch size={14} className="me-1" />
                                                                        {msg.is_registered ? 'الملف' : 'إنشاء حساب'}
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {messages.length === 0 && (
                                                        <tr>
                                                            <td colSpan="5" className="text-center py-5 text-muted">
                                                                <Mail size={40} className="mb-3 opacity-50" />
                                                                <p>لا توجد رسائل.</p>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </Table>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Tab.Pane>
                        </Tab.Content>
                    </Card.Body>
                </Card>
            </Tab.Container>

            <Modal show={!!viewMessage} onHide={() => setViewMessage(null)} centered>
                <Modal.Header closeButton>
                    <Modal.Title className="fs-5">رسالة من: {viewMessage?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="mb-3 p-3 bg-light rounded border">
                        <div className="mb-2"><strong>الموضوع:</strong> {viewMessage?.subject}</div>
                        <div className="mb-2"><strong>رقم الهاتف:</strong> <span dir="ltr">{viewMessage?.phone}</span></div>
                        <div className="mb-2"><strong>البريد:</strong> {viewMessage?.email || 'لا يوجد'}</div>
                        <div className="small text-muted" dir="ltr" style={{textAlign: 'right'}}>
                            <strong>التاريخ:</strong> {viewMessage ? format(new Date(viewMessage.created_at), 'yyyy-MM-dd hh:mm a') : ''}
                        </div>
                    </div>
                    <div>
                        <strong className="d-block mb-2">نص الرسالة:</strong>
                        <div className="p-3 border rounded bg-white" style={{ whiteSpace: 'pre-wrap', minHeight: '100px' }}>
                            {viewMessage?.message}
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setViewMessage(null)}>إغلاق</Button>
                    {!viewMessage?.is_read && (
                        <Button variant="success" onClick={() => markMessageAsRead(viewMessage.id)}>
                            <CheckCircle size={16} className="me-1" /> تحديد كمقروءة
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default CustomerService;

