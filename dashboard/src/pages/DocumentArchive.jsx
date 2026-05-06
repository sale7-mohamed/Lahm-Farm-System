import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Card, Button, Form, Modal, Table, Badge, Spinner, Row, Col } from 'react-bootstrap';
import { FileText, PlusCircle, Eye, Trash2, Filter, Building, Store, User, Printer } from 'lucide-react';
import { format } from 'date-fns';
import PrintModal from '../components/ui/PrintModal';

const DocumentArchive = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [suppliers, setSuppliers] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [b2bCustomers, setB2bCustomers] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [businessRequests, setBusinessRequests] = useState([]);
    const [filterType, setFilterType] = useState('');

    const [title, setTitle] = useState('');
    const [docType, setDocType] = useState('supplier_contract');
    const [supplierId, setSupplierId] = useState('');
    const [b2bId, setB2bId] = useState('');
    const [employeeId, setEmployeeId] = useState('');
    const [isExternalEmployee, setIsExternalEmployee] = useState(false);
    const [externalName, setExternalName] = useState('');
    const [orderId, setOrderId] = useState('');
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    const [printConfig, setPrintConfig] = useState({ show: false, title: '', endpoint: '' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const url = filterType ? `/management/document-archive/?document_type=${filterType}` : '/management/document-archive/';
            const [docsRes, supRes, empRes] = await Promise.all([
                axios.get(url),
                axios.get('/management/suppliers/'),
                axios.get('/management/employees/')
            ]);
            setDocuments(docsRes.data.results || docsRes.data || []);
            setSuppliers(supRes.data.results || []);
            setEmployees(empRes.data.results || []);
        } catch {
            toast.error('فشل تحميل البيانات');
        } finally {
            setLoading(false);
        }
    }, [filterType]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (docType === 'b2b_contract' && b2bCustomers.length === 0) {
            axios.get('/management/corporate-customers/')
                .then(res => setB2bCustomers(res.data || []))
                .catch(() => {});
        }
        if (docType === 'order_doc' && recentOrders.length === 0) {
            axios.get('/management/recent-orders/')
                .then(res => setRecentOrders(res.data || []))
                .catch(() => {});
        }
        if (docType === 'b2b_order_doc' && businessRequests.length === 0) {
            axios.get('/orders/business-requests/')
                .then(res => setBusinessRequests(res.data.results || res.data || []))
                .catch(() => {});
        }
    }, [docType, b2bCustomers.length, recentOrders.length, businessRequests.length]);

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file || !title) {
            toast.warn('يجب إدخال العنوان واختيار الملف');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('document_type', docType);
        formData.append('file', file);

        if (docType === 'supplier_contract' && supplierId) formData.append('supplier', supplierId);
        if (docType === 'b2b_contract' && b2bId) formData.append('b2b_customer', b2bId);
        if (docType === 'order_doc' && orderId) formData.append('order', orderId);
        if (docType === 'b2b_order_doc' && b2bId) formData.append('business_request', b2bId);

        if (docType === 'employee_doc') {
            if (isExternalEmployee && externalName) formData.append('external_name', externalName);
            else if (!isExternalEmployee && employeeId) formData.append('employee_file', employeeId);
        }

        setUploading(true);
        try {
            await axios.post('/management/document-archive/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success('تم رفع الوثيقة بنجاح');
            setShowModal(false);
            resetForm();
            fetchData();
        } catch {
            toast.error('فشل رفع الوثيقة');
        } finally {
            setUploading(false);
        }
    };

    const resetForm = () => {
        setTitle('');
        setFile(null);
        setSupplierId('');
        setB2bId('');
        setEmployeeId('');
        setOrderId('');
        setExternalName('');
        setIsExternalEmployee(false);
    };

    const handleDelete = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذه الوثيقة نهائياً؟')) return;
        try {
            await axios.delete(`/management/document-archive/${id}/`);
            toast.success('تم الحذف');
            fetchData();
        } catch {
            toast.error('فشل الحذف');
        }
    };

    const printBlankContract = (type) => {
        if (type === 'emp') setPrintConfig({show: true, title: 'عقد موظف فارغ', endpoint: '/contracts/employee/'});
        if (type === 'farm') setPrintConfig({show: true, title: 'عقد مزرعة فارغ', endpoint: '/contracts/farm/'});
        if (type === 'b2b') setPrintConfig({show: true, title: 'عقد شركات (B2B) فارغ', endpoint: '/contracts/b2b/'});
    };

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-3">
                <div>
                    <h1 className="h3 fw-bold mb-1">أرشيف الوثائق والعقود</h1>
                    <p className="text-muted mb-0">حفظ وإدارة العقود وملفات الإثبات الموقعة</p>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                    <Button variant="outline-success" onClick={() => printBlankContract('farm')} className="d-flex gap-1 align-items-center">
                        <Printer size={16} /> عقد مزرعة
                    </Button>
                    <Button variant="outline-primary" onClick={() => printBlankContract('b2b')} className="d-flex gap-1 align-items-center">
                        <Printer size={16} /> عقد B2B
                    </Button>
                    <Button variant="outline-info" onClick={() => printBlankContract('emp')} className="d-flex gap-1 align-items-center">
                        <Printer size={16} /> عقد موظف
                    </Button>
                    <Button variant="dark" onClick={() => setShowModal(true)}>
                        <PlusCircle size={18} className="me-2" /> رفع وثيقة موقعة
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm border-0 mb-4">
                <Card.Body className="p-3">
                    <div className="d-flex align-items-center gap-3">
                        <Filter size={20} className="text-muted" />
                        <span className="fw-bold">تصفية حسب النوع:</span>
                        <Form.Select style={{ width: '250px' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                            <option value="">جميع الوثائق</option>
                            <option value="supplier_contract">عقود المزارع والموردين</option>
                            <option value="b2b_contract">عقود عملاء الأعمال (مطاعم/فنادق)</option>
                            <option value="b2b_order_doc">إيصالات استلام طلبات الشركات</option>
                            <option value="employee_doc">مستندات موظفين/عمال</option>
                            <option value="order_doc">إيصالات طلبات العملاء</option>
                            <option value="other">وثائق أخرى</option>
                        </Form.Select>
                    </div>
                </Card.Body>
            </Card>

            <Card className="shadow-sm border-0">
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5"><Spinner animation="border" /></div>
                    ) : documents.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <FileText size={48} className="mb-3 opacity-50" />
                            <h5>لا توجد وثائق في الأرشيف</h5>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="mb-0 align-middle">
                                <thead className="bg-light">
                                    <tr>
                                        <th>عنوان الوثيقة</th>
                                        <th>الارتباط</th>
                                        <th>تاريخ الرفع</th>
                                        <th>بواسطة</th>
                                        <th className="text-center">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {documents.map(doc => (
                                        <tr key={doc.id}>
                                            <td className="fw-bold">{doc.title}</td>
                                            <td>
                                                <Badge bg="secondary" className="mb-1 d-block w-fit">
                                                    {doc.document_type}
                                                </Badge>
                                                {doc.supplier_name && <div className="small text-success fw-bold"><Building size={12} /> {doc.supplier_name} <span dir="ltr">({doc.supplier_phone})</span></div>}
                                                {doc.b2b_customer_name && <div className="small text-primary fw-bold"><Store size={12} /> {doc.b2b_customer_name} <span dir="ltr">({doc.b2b_customer_phone})</span></div>}
                                                {doc.employee_name && <div className="small text-info fw-bold"><User size={12} /> {doc.employee_name} <span dir="ltr">({doc.employee_phone})</span></div>}
                                                {doc.external_name && <div className="small text-warning fw-bold"><User size={12} /> {doc.external_name} (خارجي)</div>}
                                                {doc.order && <div className="small text-dark fw-bold">طلب رقم: #{doc.order}</div>}
                                            </td>
                                            <td>{format(new Date(doc.created_at), 'yyyy-MM-dd')}</td>
                                            <td className="text-muted small">{doc.uploaded_by_name}</td>
                                            <td className="text-center">
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    className="me-2"
                                                    onClick={() => window.open(doc.file, '_blank')}
                                                    title="عرض الوثيقة"
                                                >
                                                    <Eye size={14} />
                                                </Button>
                                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(doc.id)}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>

            <Modal show={showModal} onHide={() => { setShowModal(false); resetForm(); }} centered size="lg">
                <Modal.Header closeButton className="bg-dark text-white">
                    <Modal.Title className="fs-5">إضافة وثيقة للأرشيف</Modal.Title>
                </Modal.Header>
                <Form onSubmit={handleUpload}>
                    <Modal.Body>
                        <Row className="g-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label>عنوان الوثيقة *</Form.Label>
                                    <Form.Control required value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: عقد عمل أو إيصال تسليم..." />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>تصنيف الوثيقة *</Form.Label>
                                    <Form.Select value={docType} onChange={e => setDocType(e.target.value)}>
                                        <option value="supplier_contract">عقد مورد / مزرعة</option>
                                        <option value="b2b_contract">عقد تأسيس عميل تجاري (B2B)</option>
                                        <option value="b2b_order_doc">إذن استلام لطلب شركات (B2B)</option>
                                        <option value="order_doc">إيصال استلام طلب أفراد عادي</option>
                                        <option value="employee_doc">مستند موظف / عامل</option>
                                        <option value="other">وثائق أخرى</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label>الملف (PDF أو صورة) *</Form.Label>
                                    <Form.Control type="file" required onChange={e => setFile(e.target.files[0])} accept=".pdf,image/*" />
                                </Form.Group>
                            </Col>

                            {docType === 'supplier_contract' && (
                                <Col md={12}>
                                    <Form.Group className="bg-light p-3 rounded border">
                                        <Form.Label className="fw-bold text-success"><Building size={16} /> اختر المزرعة / المورد</Form.Label>
                                        <Form.Select value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                                            <option value="">-- بدون ربط --</option>
                                            {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            )}

                            {docType === 'b2b_contract' && (
                                <Col md={12}>
                                    <Form.Group className="bg-light p-3 rounded border">
                                        <Form.Label className="fw-bold text-primary"><Store size={16} /> اختر العميل التجاري</Form.Label>
                                        <Form.Select value={b2bId} onChange={e => setB2bId(e.target.value)}>
                                            <option value="">-- ابحث عن شركة --</option>
                                            {b2bCustomers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>)}
                                        </Form.Select>
                                        <Form.Text className="text-muted">العملاء الظاهرون هم من قاموا بطلبات شركات مسبقاً.</Form.Text>
                                    </Form.Group>
                                </Col>
                            )}

                            {docType === 'employee_doc' && (
                                <Col md={12}>
                                    <Form.Group className="bg-light p-3 rounded border">
                                        <div className="d-flex justify-content-between mb-2">
                                            <Form.Label className="fw-bold text-info m-0"><User size={16} /> بيانات الموظف/العامل</Form.Label>
                                            <Form.Check type="switch" label="هذا عامل يومية / خارجي (بدون حساب)" checked={isExternalEmployee} onChange={e => setIsExternalEmployee(e.target.checked)} />
                                        </div>
                                        {isExternalEmployee ? (
                                            <Form.Control type="text" placeholder="اكتب اسم العامل الخارجي (مثال: عامل الشحن أحمد)..." value={externalName} onChange={e => setExternalName(e.target.value)} required />
                                        ) : (
                                            <Form.Select value={employeeId} onChange={e => setEmployeeId(e.target.value)} required>
                                                <option value="">-- اختر موظف من النظام --</option>
                                                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.role_name})</option>)}
                                            </Form.Select>
                                        )}
                                    </Form.Group>
                                </Col>
                            )}

                            {docType === 'order_doc' && (
                                <Col md={12}>
                                    <Form.Group className="bg-light p-3 rounded border">
                                        <Form.Label className="fw-bold text-dark">رقم طلب الأفراد (Order ID)</Form.Label>
                                        <Form.Select required value={orderId} onChange={e => setOrderId(e.target.value)}>
                                            <option value="">-- اختر الطلب --</option>
                                            {recentOrders.map(o => (
                                                <option key={o.id} value={o.id}>
                                                    طلب #{o.id} - {o.customer_name}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            )}

                            {docType === 'b2b_order_doc' && (
                                <Col md={12}>
                                    <Form.Group className="bg-light p-3 rounded border">
                                        <Form.Label className="fw-bold text-primary">رقم طلب الشركات (B2B Request ID)</Form.Label>
                                        <Form.Select required value={b2bId} onChange={e => setB2bId(e.target.value)}>
                                            <option value="">-- اختر طلب الشركة --</option>
                                            {businessRequests.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    طلب شركات #{r.id} - {r.user_business_name || r.user_full_name}
                                                </option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>
                            )}
                        </Row>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowModal(false)}>إلغاء</Button>
                        <Button variant="dark" type="submit" disabled={uploading}>
                            {uploading ? <Spinner size="sm" /> : 'تأكيد الرفع والأرشفة'}
                        </Button>
                    </Modal.Footer>
                </Form>
            </Modal>

            <PrintModal
                show={printConfig.show}
                handleClose={() => setPrintConfig({show: false, title: '', endpoint: ''})}
                title={printConfig.title}
                endpoint={printConfig.endpoint}
            />
        </div>
    );
};

export default DocumentArchive;
