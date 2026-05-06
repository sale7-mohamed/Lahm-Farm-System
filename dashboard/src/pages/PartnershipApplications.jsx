// src/pages/PartnershipApplications.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Table, Badge, Button, Modal, Form, Tab, Nav, Spinner, Card, Row, Col, Container } from 'react-bootstrap';
import { Phone, Mail, MapPin, FileText, CheckCircle, XCircle, Clock, Users, Building, Eye, Filter, RefreshCw } from 'lucide-react';

const StatusBadge = ({ status, isMobile }) => {
    const map = {
        'pending': { bg: 'warning', text: 'قيد المراجعة', icon: <Clock size={isMobile ? 12 : 14} /> },
        'contacted': { bg: 'info', text: 'تم التواصل', icon: <Phone size={isMobile ? 12 : 14} /> },
        'approved': { bg: 'success', text: 'تمت الموافقة', icon: <CheckCircle size={isMobile ? 12 : 14} /> },
        'rejected': { bg: 'danger', text: 'مرفوض', icon: <XCircle size={isMobile ? 12 : 14} /> },
    };
    const s = map[status] || { bg: 'secondary', text: status, icon: null };

    return (
        <Badge bg={s.bg} className={`d-flex align-items-center gap-1 ${isMobile ? 'small' : ''}`}>
            {s.icon}
            <span>{s.text}</span>
        </Badge>
    );
};

const ApplicationDetailsModal = ({ show, handleClose, app, onUpdate, isMobile }) => {
    const [status, setStatus] = useState('');
    const [notes, setNotes] = useState('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (app) {
            setStatus(app.status);
            setNotes(app.admin_notes || '');
        }
    }, [app]);

    const handleSave = async () => {
        setUpdating(true);
        try {
            await axios.patch(`/partnerships/manage/${app.id}/`, { status, admin_notes: notes });
            toast.success("تم تحديث الطلب بنجاح.");
            onUpdate();
            handleClose();
        } catch {
            toast.error("فشل التحديث.");
        } finally {
            setUpdating(false);
        }
    };

    if (!app) return null;

    return (
        <Modal
            show={show}
            onHide={handleClose}
            size={isMobile ? "md" : "lg"}
            centered
            fullscreen={isMobile ? "sm-down" : undefined}
        >
            <Modal.Header closeButton className="border-bottom-0 pb-1">
                <Modal.Title className={isMobile ? "h6" : ""}>
                    تفاصيل الطلب: {app.name}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                {}
                <Card className="border mb-3">
                    <Card.Body className="p-2 p-md-3">
                        <Row className="g-2 g-md-3">
                            <Col xs={12} md={6}>
                                <div className="d-flex align-items-center gap-2 mb-2">
                                    <Badge bg={app.application_type === 'farm' ? 'success' : 'primary'}>
                                        {app.application_type === 'farm' ? 'مزرعة' : 'أعمال'}
                                    </Badge>
                                    <StatusBadge status={app.status} isMobile={isMobile} />
                                </div>

                                <div className="d-flex align-items-center gap-2 mb-2 small">
                                    <Phone size={14} className="text-primary" />
                                    <span>{app.phone}</span>
                                </div>

                                {app.email && (
                                    <div className="d-flex align-items-center gap-2 mb-2 small">
                                        <Mail size={14} className="text-primary" />
                                        <span>{app.email}</span>
                                    </div>
                                )}
                            </Col>
                            <Col xs={12} md={6}>
                                <div className="d-flex align-items-center gap-2 mb-2 small">
                                    <MapPin size={14} className="text-primary" />
                                    <span>{app.address}</span>
                                </div>

                                <div className="d-flex align-items-center gap-2 mb-2 small">
                                    <Clock size={14} className="text-primary" />
                                    <span>{new Date(app.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                </div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {}
                <Card className="border mb-3">
                    <Card.Header className="bg-light d-flex align-items-center gap-2">
                        <FileText size={16} />
                        <span className="fw-bold">تفاصيل الطلب</span>
                    </Card.Header>
                    <Card.Body className="p-2 p-md-3">
                        <p className="mb-0" style={{whiteSpace: 'pre-wrap'}}>{app.details}</p>
                    </Card.Body>
                </Card>

                <hr className="my-3" />

                {}
                <h6 className="mb-2">تحديث الحالة</h6>
                <Form.Group className="mb-3">
                    <Form.Select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        size={isMobile ? "sm" : ""}
                        className={isMobile ? "py-2" : ""}
                    >
                        <option value="pending">قيد المراجعة</option>
                        <option value="contacted">تم التواصل</option>
                        <option value="approved">تمت الموافقة (التعاقد)</option>
                        <option value="rejected">مرفوض</option>
                    </Form.Select>
                </Form.Group>

                {}
                <Form.Group className="mb-3">
                    <Form.Label className={isMobile ? "small mb-1" : ""}>ملاحظات إدارية</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="سجل ملاحظات الاتصال هنا..."
                        size={isMobile ? "sm" : ""}
                        className={isMobile ? "small" : ""}
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer className="border-top-0 pt-1">
                <Button
                    variant="outline-secondary"
                    onClick={handleClose}
                    size={isMobile ? "sm" : ""}
                    className="flex-fill"
                >
                    إغلاق
                </Button>
                <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={updating}
                    size={isMobile ? "sm" : ""}
                    className="flex-fill"
                >
                    {updating ? (
                        <>
                            <Spinner size="sm" animation="border" className="me-2" />
                            جاري الحفظ...
                        </>
                    ) : 'حفظ التغييرات'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const MobileApplicationCard = ({ app, onClick, isMobile }) => {
    return (
        <Card className="mb-2 border shadow-sm" onClick={onClick} style={{ cursor: 'pointer' }}>
            <Card.Body className="p-3">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2">
                        <div className="bg-primary bg-opacity-10 p-2 rounded">
                            {app.application_type === 'farm' ?
                                <Building size={16} className="text-primary" /> :
                                <Users size={16} className="text-primary" />
                            }
                        </div>
                        <div>
                            <h6 className="mb-0 fw-bold">{app.name}</h6>
                            <small className="text-muted">{app.phone}</small>
                        </div>
                    </div>
                    <div className="text-end">
                        <StatusBadge status={app.status} isMobile={isMobile} />
                        <div className="mt-1 small text-muted">
                            {new Date(app.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}
                        </div>
                    </div>
                </div>

                <div className="mb-2">
                    <div className="d-flex align-items-center gap-1 small text-muted mb-1">
                        <MapPin size={12} />
                        <span className="text-truncate">{app.address}</span>
                    </div>
                    {app.email && (
                        <div className="d-flex align-items-center gap-1 small text-muted">
                            <Mail size={12} />
                            <span className="text-truncate">{app.email}</span>
                        </div>
                    )}
                </div>

                <div className="d-flex justify-content-between align-items-center mt-2">
                    <Badge bg={app.application_type === 'farm' ? 'success' : 'primary'} className="small">
                        {app.application_type === 'farm' ? 'مزرعة' : 'أعمال'}
                    </Badge>
                    <Button
                        size="sm"
                        variant="outline-primary"
                        className="d-flex align-items-center gap-1"
                        onClick={(e) => {
                            e.stopPropagation();
                            onClick();
                        }}
                    >
                        <Eye size={12} />
                        <span>عرض</span>
                    </Button>
                </div>
            </Card.Body>
        </Card>
    );
};

const PartnershipApplications = () => {
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [selectedApp, setSelectedApp] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 992);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/partnerships/manage/');
            setApps(res.data.results || []);
        } catch {
            toast.error("فشل تحميل الطلبات.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredApps = apps.filter(app => {
        const matchesFilter = filter === 'all' || app.application_type === filter;
        const matchesSearch = searchTerm === '' ||
            app.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            app.phone?.includes(searchTerm) ||
            app.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            app.address?.toLowerCase().includes(searchTerm.toLowerCase());

        return matchesFilter && matchesSearch;
    });

    const stats = {
        total: apps.length,
        pending: apps.filter(a => a.status === 'pending').length,
        contacted: apps.filter(a => a.status === 'contacted').length,
        approved: apps.filter(a => a.status === 'approved').length,
        rejected: apps.filter(a => a.status === 'rejected').length,
        farm: apps.filter(a => a.application_type === 'farm').length,
        business: apps.filter(a => a.application_type === 'business').length,
    };

    const handleRowClick = (app) => {
        setSelectedApp(app);
        setShowModal(true);
    };

    const handleRefresh = () => {
        fetchData();
        toast.success("تم تحديث البيانات");
    };

    return (
        <Container fluid className={`partnership-applications ${isMobile ? 'px-2' : 'px-3'}`}>
            {/* Header */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
                <div className="d-flex align-items-center">
                    <div className="bg-primary bg-opacity-10 p-2 rounded me-2">
                        <Users size={isMobile ? 20 : 24} className="text-primary" />
                    </div>
                    <div>
                        <h1 className={`${isMobile ? 'h5' : 'h4'} mb-0 fw-bold`}>طلبات الشراكة والتعاقد</h1>
                        <small className="text-muted">إدارة طلبات التعاون والشراكة</small>
                    </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                    {!isMobile && (
                        <div className="d-flex align-items-center gap-2 me-2">
                            <Badge bg="light" text="dark" className="px-3 py-2">
                                <span className="small">الإجمالي: {stats.total}</span>
                            </Badge>
                            <Badge bg="warning" text="dark" className="px-3 py-2">
                                <span className="small">قيد المراجعة: {stats.pending}</span>
                            </Badge>
                        </div>
                    )}

                    <Button
                        variant="outline-primary"
                        onClick={handleRefresh}
                        size={isMobile ? "sm" : ""}
                        className="d-flex align-items-center gap-1"
                    >
                        <RefreshCw size={14} />
                        {!isMobile && <span>تحديث</span>}
                    </Button>
                </div>
            </div>

            {}
            {isMobile && apps.length > 0 && (
                <Row className="mb-3 g-2">
                    <Col xs={4}>
                        <Card className="border-0 bg-primary bg-opacity-10 text-center p-2">
                            <div className="fw-bold">{stats.total}</div>
                            <small className="text-muted">إجمالي</small>
                        </Card>
                    </Col>
                    <Col xs={4}>
                        <Card className="border-0 bg-warning bg-opacity-10 text-center p-2">
                            <div className="fw-bold text-warning">{stats.pending}</div>
                            <small className="text-muted">قيد المراجعة</small>
                        </Card>
                    </Col>
                    <Col xs={4}>
                        <Card className="border-0 bg-success bg-opacity-10 text-center p-2">
                            <div className="fw-bold text-success">{stats.approved}</div>
                            <small className="text-muted">موافق</small>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Search Box */}
            <Card className="shadow-sm border-0 mb-3">
                <Card.Body className="p-2 p-md-3">
                    <div className="d-flex flex-column flex-md-row gap-2 align-items-center">
                        <div className="input-group flex-grow-1">
                            <span className="input-group-text bg-light border-end-0">
                                <Filter size={14} />
                            </span>
                            <Form.Control
                                type="text"
                                placeholder="ابحث بالاسم، الهاتف، البريد أو العنوان..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                size={isMobile ? "sm" : ""}
                            />
                        </div>

                        <div className="w-100 w-md-auto">
                            <Nav variant="pills" activeKey={filter} onSelect={(k) => setFilter(k)}>
                                <Nav.Item className="flex-fill text-center">
                                    <Nav.Link eventKey="all" className={isMobile ? "small py-2" : "py-2"}>
                                        الكل ({stats.total})
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item className="flex-fill text-center">
                                    <Nav.Link eventKey="farm" className={isMobile ? "small py-2" : "py-2"}>
                                        مزارع ({stats.farm})
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item className="flex-fill text-center">
                                    <Nav.Link eventKey="business" className={isMobile ? "small py-2" : "py-2"}>
                                        أعمال ({stats.business})
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>
                        </div>
                    </div>
                </Card.Body>
            </Card>

            {/* Applications List */}
            <Card className="shadow-sm border-0">
                <Card.Body className="p-2 p-md-3">
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" size={isMobile ? "sm" : ""} />
                            <div className="mt-3 small">جاري تحميل طلبات الشراكة...</div>
                        </div>
                    ) : filteredApps.length === 0 ? (
                        <div className="text-center py-5">
                            <div className="bg-light rounded-circle d-inline-flex p-3 mb-3">
                                <Users size={32} className="text-muted" />
                            </div>
                            <h5 className="text-muted">لا توجد طلبات شراكة</h5>
                            <p className="text-muted mb-0">
                                {searchTerm ? 'لا توجد نتائج مطابقة للبحث' : 'لم يتم تقديم أي طلبات شراكة بعد'}
                            </p>
                        </div>
                    ) : isMobile ? (
                        // Mobile View - Cards
                        <div className="mobile-applications-list" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {filteredApps.map(app => (
                                <MobileApplicationCard
                                    key={app.id}
                                    app={app}
                                    onClick={() => handleRowClick(app)}
                                    isMobile={isMobile}
                                />
                            ))}
                        </div>
                    ) : (
                        // Desktop View - Table
                        <div className="table-responsive">
                            <Table hover className="mb-0 align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: '100px' }}>النوع</th>
                                        <th>الاسم</th>
                                        <th style={{ width: '120px' }}>الهاتف</th>
                                        <th>المنطقة</th>
                                        <th style={{ width: '120px' }}>تاريخ الطلب</th>
                                        <th style={{ width: '120px' }}>الحالة</th>
                                        <th style={{ width: '80px' }}>إجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredApps.map(app => (
                                        <tr
                                            key={app.id}
                                            style={{cursor: 'pointer'}}
                                            onClick={() => handleRowClick(app)}
                                            className="table-row-hover"
                                        >
                                            <td>
                                                <Badge bg={app.application_type === 'farm' ? 'success' : 'primary'}>
                                                    {app.application_type === 'farm' ? 'مزرعة' : 'أعمال'}
                                                </Badge>
                                            </td>
                                            <td className="fw-bold">{app.name}</td>
                                            <td>{app.phone}</td>
                                            <td>
                                                <div className="text-truncate" style={{ maxWidth: '200px' }}>
                                                    {app.address}
                                                </div>
                                            </td>
                                            <td>{new Date(app.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                            <td>
                                                <StatusBadge status={app.status} isMobile={isMobile} />
                                            </td>
                                            <td>
                                                <Button
                                                    size="sm"
                                                    variant="outline-primary"
                                                    className="d-flex align-items-center gap-1"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleRowClick(app);
                                                    }}
                                                >
                                                    <Eye size={12} />
                                                    <span>عرض</span>
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}

                    {}
                    {filteredApps.length > 0 && (
                        <div className="mt-3 text-muted small">
                            <span>عرض {filteredApps.length} من {apps.length} طلب</span>
                            {searchTerm && (
                                <span className="ms-2">
                                    - نتائج البحث عن: "{searchTerm}"
                                </span>
                            )}
                        </div>
                    )}
                </Card.Body>
            </Card>

            {/* Modal */}
            <ApplicationDetailsModal
                show={showModal}
                handleClose={() => setShowModal(false)}
                app={selectedApp}
                onUpdate={fetchData}
                isMobile={isMobile}
            />

            {/* Responsive Styles */}
            <style>{`
                .partnership-applications {
                    max-width: 100%;
                    overflow-x: hidden;
                }

                .mobile-applications-list {
                    touch-action: pan-y;
                }

                .mobile-applications-list::-webkit-scrollbar {
                    width: 4px;
                }

                .mobile-applications-list::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }

                .mobile-applications-list::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 2px;
                }

                @media (max-width: 992px) {
                    .card-body {
                        padding: 1rem !important;
                    }

                    .btn {
                        min-height: 44px;
                        padding: 0.5rem;
                    }

                    .btn-sm {
                        min-height: 38px;
                    }

                    .form-control, .form-select {
                        font-size: 0.9rem;
                        padding: 0.5rem;
                    }

                    h1, h2, h3, h4, h5, h6 {
                        font-size: 1.1rem;
                    }

                    .table-responsive {
                        font-size: 0.85rem;
                    }
                }

                @media (max-width: 576px) {
                    .partnership-applications {
                        padding-left: 0.5rem !important;
                        padding-right: 0.5rem !important;
                    }

                    .mb-3 {
                        margin-bottom: 1rem !important;
                    }

                    .gap-2 {
                        gap: 0.5rem !important;
                    }
                }

                .btn, .form-check-input, .nav-link, .table-row-hover {
                    touch-action: manipulation;
                }

                /*  hover  */
                .table-row-hover:hover {
                    background-color: rgba(0, 123, 255, 0.05) !important;
                }

                .mobile-applications-list .card {
                    border-radius: 10px;
                    transition: transform 0.2s ease;
                }

                .mobile-applications-list .card:active {
                    transform: scale(0.98);
                }

                .badge {
                    font-weight: 500;
                }

                /*   nav pills */
                .nav-pills .nav-link {
                    transition: all 0.3s ease;
                }

                .input-group-text {
                    background-color: #f8f9fa;
                }

                .text-truncate {
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .card.border-0 {
                    border-radius: 10px;
                }
            `}</style>
        </Container>
    );
};

export default PartnershipApplications;