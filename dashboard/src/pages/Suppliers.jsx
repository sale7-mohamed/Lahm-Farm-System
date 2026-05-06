import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Modal, Button, Form, Table, Badge, DropdownButton, Dropdown, Card, Spinner, Row, Col } from 'react-bootstrap';
import { PlusCircle, Edit, Trash2, XCircle, Phone, Mail, MapPin, User, Building, Package, CheckCircle, FileText, UploadCloud, Printer } from 'lucide-react';
import PrintModal from '../components/ui/PrintModal';

const PrintReceiptModal = ({ show, handleClose, supplier, setPrintConfig }) => {
    const [receiptData, setReceiptData] = useState({
        name: '',
        amount: '',
        national_id: '',
        date: '',
        notes: 'مستحقات توريد مزارع ومواشي / دفعة تحت الحساب.'
    });

    useEffect(() => {
        if (show) {
            setReceiptData({
                name: supplier?.name || '',
                amount: '',
                national_id: '',
                date: new Date().toISOString().slice(0, 16),
                notes: 'مستحقات توريد مزارع ومواشي / دفعة تحت الحساب.'
            });
        }
    }, [show, supplier]);

    const handlePrint = () => {
        const params = new URLSearchParams();
        if (receiptData.name) params.append('name', receiptData.name);
        if (receiptData.amount) params.append('amount', receiptData.amount);
        if (receiptData.national_id) params.append('national_id', receiptData.national_id);
        if (receiptData.date) {
            const d = new Date(receiptData.date);
            const formattedDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
            params.append('date', formattedDate);
        }
        if (receiptData.notes) params.append('notes', receiptData.notes);

        setPrintConfig({ show: true, title: 'إيصال استلام نقدية', endpoint: `/contracts/supplier-receipt/?${params.toString()}` });
        handleClose();
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton className="bg-primary text-white">
                <Modal.Title className="h5 d-flex align-items-center gap-2">
                    <Printer size={18} />
                    إصدار إيصال استلام نقدية
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="alert alert-info small">
                    يمكنك ملء البيانات أدناه لطباعتها في الإيصال المُمضي، أو تركها فارغة لملئها يدوياً بالقلم بعد الطباعة.
                </div>
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">اسم المستلم (المورد/المندوب)</Form.Label>
                    <Form.Control
                        type="text"
                        placeholder="اتركه فارغاً للكتابة يدوياً..."
                        value={receiptData.name}
                        onChange={e => setReceiptData({ ...receiptData, name: e.target.value })}
                    />
                </Form.Group>
                <Row className="g-3 mb-3">
                    <Col md={6}>
                        <Form.Group>
                            <Form.Label className="fw-bold">المبلغ (جنيه)</Form.Label>
                            <Form.Control
                                type="number"
                                placeholder="اختياري"
                                value={receiptData.amount}
                                onChange={e => setReceiptData({ ...receiptData, amount: e.target.value })}
                            />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group>
                            <Form.Label className="fw-bold">الرقم القومي</Form.Label>
                            <Form.Control
                                type="text"
                                maxLength="14"
                                placeholder="14 رقم (اختياري)"
                                value={receiptData.national_id}
                                onChange={e => setReceiptData({ ...receiptData, national_id: e.target.value })}
                            />
                        </Form.Group>
                    </Col>
                </Row>
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">تاريخ ووقت الإيصال</Form.Label>
                    <Form.Control
                        type="datetime-local"
                        value={receiptData.date}
                        onChange={e => setReceiptData({ ...receiptData, date: e.target.value })}
                    />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">ملاحظات وقيمة الدفعة</Form.Label>
                    <Form.Control
                        as="textarea"
                        rows={2}
                        value={receiptData.notes}
                        onChange={e => setReceiptData({ ...receiptData, notes: e.target.value })}
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                <Button variant="primary" onClick={handlePrint}>
                    <Printer size={16} className="me-1" /> توليد وطباعة
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const SupplierForm = ({ show, handleClose, onSave, supplierToEdit, supplierType, setSupplierType }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [phoneNumbers, setPhoneNumbers] = useState(['']);

    useEffect(() => {
        if (show) {
            const initialData = {
                name: '', email: '', address: '',
                supplier_type: supplierType,
                item_supplied_description: '', items_supplied: [],
                contact_persons: ''
            };

            if (supplierToEdit) {
                setFormData({ ...initialData, ...supplierToEdit });
                setSupplierType(supplierToEdit.supplier_type);
                const phones = supplierToEdit.additional_contacts?.split('\n').filter(p => p) || [];
                const allPhones = supplierToEdit.phone ? [supplierToEdit.phone, ...phones] : phones;
                setPhoneNumbers(allPhones.length > 0 ? allPhones : ['']);
            } else {
                setFormData(initialData);
                setPhoneNumbers(['']);
            }
        }
    }, [show, supplierToEdit, supplierType, setSupplierType]);

    const handlePhoneNumberChange = (index, value) => {
        const newPhoneNumbers = [...phoneNumbers];
        newPhoneNumbers[index] = value;
        setPhoneNumbers(newPhoneNumbers);
    };

    const addPhoneNumberField = () => setPhoneNumbers([...phoneNumbers, '']);

    const removePhoneNumberField = (index) => {
        if (phoneNumbers.length > 1) {
            setPhoneNumbers(phoneNumbers.filter((_, i) => i !== index));
        }
    };

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const method = supplierToEdit ? 'patch' : 'post';
        const url = supplierToEdit ? `/management/suppliers/${supplierToEdit.id}/` : '/management/suppliers/';

        const [primaryPhone, ...additionalPhones] = phoneNumbers.filter(p => p.trim());
        const payload = {
            ...formData,
            phone: primaryPhone || '',
            additional_contacts: additionalPhones.join('\n')
        };
        delete payload.items_supplied;

        try {
            await axios[method](url, payload);
            toast.success("تم حفظ البيانات بنجاح!");
            onSave();
            handleClose();
        } catch (error) {
            toast.error(error.response?.data?.name?.[0] || "فشل حفظ البيانات.");
        } finally {
            setLoading(false);
        }
    };

    const isLivestockFarm = formData.supplier_type === 'LIVESTOCK_FARM';

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton className="border-bottom-0 pb-0">
                <Modal.Title className="fs-5 fw-semibold">
                    {supplierToEdit
                        ? `تعديل: ${formData.name}`
                        : isLivestockFarm ? 'إضافة مزرعة موثوقة جديدة' : 'إضافة مورد عام جديد'
                    }
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                <Form onSubmit={handleSubmit}>
                    <Row className="g-3">
                        <Col xs={12}>
                            <Form.Group>
                                <Form.Label className="fw-medium d-flex align-items-center gap-2">
                                    <Building size={18} />
                                    اسم المزرعة / المورد (إجباري)
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    name="name"
                                    value={formData.name || ''}
                                    onChange={handleChange}
                                    required
                                    size="sm"
                                    placeholder="أدخل اسم المورد أو المزرعة"
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    <Row className="g-3 mt-2">
                        <Col xs={12}>
                            <Form.Group>
                                <Form.Label className="fw-medium d-flex align-items-center gap-2">
                                    <Phone size={18} />
                                    أرقام الهواتف
                                </Form.Label>
                                {phoneNumbers.map((phone, index) => (
                                    <div key={index} className="mb-2">
                                        <div className="d-flex align-items-stretch gap-2">
                                            <Form.Control
                                                type="tel"
                                                value={phone}
                                                onChange={(e) => handlePhoneNumberChange(index, e.target.value)}
                                                placeholder={index === 0 ? "الرقم الأساسي" : "رقم إضافي"}
                                                size="sm"
                                                className="flex-grow-1"
                                            />
                                            <div className="d-flex gap-1">
                                                <Badge bg="light" text="dark" className="d-flex align-items-center px-2">
                                                    <span className="small">{phone.length}</span>
                                                </Badge>
                                                {phoneNumbers.length > 1 && (
                                                    <Button
                                                        variant="outline-danger"
                                                        onClick={() => removePhoneNumberField(index)}
                                                        size="sm"
                                                        className="d-flex align-items-center"
                                                    >
                                                        <XCircle size={14} />
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <Button
                                    variant="outline-secondary"
                                    onClick={addPhoneNumberField}
                                    size="sm"
                                    className="mt-1 d-flex align-items-center gap-1"
                                >
                                    <PlusCircle size={14} />
                                    إضافة رقم آخر
                                </Button>
                            </Form.Group>
                        </Col>
                    </Row>

                    <Row className="g-3 mt-2">
                        <Col xs={12} md={6}>
                            <Form.Group>
                                <Form.Label className="fw-medium d-flex align-items-center gap-2">
                                    <Mail size={18} />
                                    البريد الإلكتروني (اختياري)
                                </Form.Label>
                                <Form.Control
                                    type="email"
                                    name="email"
                                    value={formData.email || ''}
                                    onChange={handleChange}
                                    size="sm"
                                    placeholder="example@domain.com"
                                />
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group>
                                <Form.Label className="fw-medium d-flex align-items-center gap-2">
                                    <MapPin size={18} />
                                    العنوان (اختياري)
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={2}
                                    name="address"
                                    value={formData.address || ''}
                                    onChange={handleChange}
                                    size="sm"
                                    placeholder="العنوان الكامل"
                                />
                            </Form.Group>
                        </Col>
                    </Row>

                    {isLivestockFarm ? (
                        <Row className="g-3 mt-2">
                            <Col xs={12}>
                                <Form.Group>
                                    <Form.Label className="fw-medium d-flex align-items-center gap-2">
                                        <User size={18} />
                                        أسماء المسؤولين للتواصل
                                    </Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        name="contact_persons"
                                        value={formData.contact_persons || ''}
                                        onChange={handleChange}
                                        size="sm"
                                        placeholder="مثال: م. أحمد، د. محمد"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    ) : (
                        <Row className="g-3 mt-2">
                            <Col xs={12}>
                                <Form.Group>
                                    <Form.Label className="fw-medium d-flex align-items-center gap-2">
                                        <Package size={18} />
                                        ماذا يورد؟ (وصف)
                                    </Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        name="item_supplied_description"
                                        value={formData.item_supplied_description || ''}
                                        onChange={handleChange}
                                        size="sm"
                                        placeholder="مثال: يورد علف مركز بروتين 21%"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    )}

                    <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <Button variant="outline-secondary" onClick={handleClose} size="sm" className="px-3">إلغاء</Button>
                        <Button variant="primary" type="submit" disabled={loading} size="sm" className="px-4">
                            {loading ? (
                                <>
                                    <Spinner as="span" animation="border" size="sm" className="me-2" />
                                    جاري الحفظ...
                                </>
                            ) : 'حفظ'}
                        </Button>
                    </div>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

function Suppliers() {
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [supplierToEdit, setSupplierToEdit] = useState(null);
    const [newSupplierType, setNewSupplierType] = useState('GENERAL_SUPPLIER');

    const [showLedgerModal, setShowLedgerModal] = useState(false);
    const [ledgerSupplier, setLedgerSupplier] = useState(null);
    const [ledgerData, setLedgerData] = useState({ animals: [], purchase_orders: [], payments: [] });
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNotes, setPaymentNotes] = useState('');
    const [paymentReceipt, setPaymentReceipt] = useState(null);

    const [showDocsModal, setShowDocsModal] = useState(false);
    const [docsSupplier, setDocsSupplier] = useState(null);
    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [receiptSupplier, setReceiptSupplier] = useState(null);

    const [printConfig, setPrintConfig] = useState({ show: false, title: '', endpoint: '' });

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/management/suppliers/');
            setSuppliers(res.data.results || []);
        } catch {
            toast.error("فشل تحميل الموردين.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEdit = (supplier) => { setSupplierToEdit(supplier); setShowModal(true); };
    const handleAddNew = (type) => { setSupplierToEdit(null); setNewSupplierType(type); setShowModal(true); };
    const handleDelete = async (id) => {
        if (window.confirm("هل أنت متأكد من حذف هذا العنصر؟")) {
            try {
                await axios.delete(`/management/suppliers/${id}/`);
                toast.success("تم الحذف بنجاح.");
                fetchData();
            } catch {
                toast.error("فشل الحذف.");
            }
        }
    };

    const handleOpenLedger = async (supplier) => {
        setLedgerSupplier(supplier);
        try {
            const res = await axios.get(`/management/suppliers/${supplier.id}/ledger/`);
            setLedgerData({
                animals: res.data.animals || [],
                purchase_orders: res.data.purchase_orders || [],
                payments: res.data.payments || []
            });
            setShowLedgerModal(true);
        } catch {
            toast.error("فشل جلب كشف الحساب");
        }
    };

    const handleAddPayment = async () => {
        if (!paymentAmount || paymentAmount <= 0) return;

        const formData = new FormData();
        formData.append('amount', paymentAmount);
        if (paymentNotes) formData.append('notes', paymentNotes);
        if (paymentReceipt) formData.append('receipt_image', paymentReceipt);

        try {
            await axios.post(`/management/suppliers/${ledgerSupplier.id}/add-payment/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("تم تسجيل الدفعة");

            setPaymentAmount('');
            setPaymentNotes('');
            setPaymentReceipt(null);

            handleOpenLedger(ledgerSupplier);
            fetchData();
        } catch {
            toast.error("فشل تسجيل الدفعة");
        }
    };

    const handlePrintContract = (supplier) => {
        setPrintConfig({ show: true, title: `عقد توريد: ${supplier.name}`, endpoint: `/contracts/farm/?farm_id=${supplier.id}` });
    };

    const handleOpenDocs = async (supplier) => {
        setDocsSupplier(supplier);
        try {
            const res = await axios.get(`/management/document-archive/?supplier=${supplier.id}`);
            setDocsSupplier(prev => ({ ...prev, contracts: res.data.results || [] }));
            setShowDocsModal(true);
        } catch {
            toast.error("فشل تحميل الوثائق");
        }
    };

    const handleUploadDoc = async (e) => {
        e.preventDefault();
        if (!uploadFile || !uploadTitle) return;

        const formData = new FormData();
        formData.append('title', uploadTitle);
        formData.append('document_type', 'supplier_contract');
        formData.append('supplier', docsSupplier.id);
        formData.append('file', uploadFile);

        setIsUploading(true);
        try {
            await axios.post('/management/document-archive/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            toast.success("تم رفع الوثيقة بنجاح");
            setUploadTitle('');
            setUploadFile(null);
            const res = await axios.get(`/management/document-archive/?supplier=${docsSupplier.id}`);
            setDocsSupplier(prev => ({ ...prev, contracts: res.data.results || [] }));
            fetchData();
        } catch {
            toast.error("فشل رفع الوثيقة");
        } finally {
            setIsUploading(false);
        }
    };

    const openReceiptModal = (supplier = null) => {
        setReceiptSupplier(supplier);
        setShowReceiptModal(true);
    };

    return (
        <div className="container-fluid px-2 px-sm-3 py-3">
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3 mb-4">
                <div>
                    <h1 className="h3 mb-0 fw-bold">إدارة الموردين والمزارع</h1>
                    <p className="text-muted small mb-0 mt-1">إدارة جميع الموردين والمزارع الموثوقة</p>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                    <Button variant="outline-success" size="sm" onClick={() => openReceiptModal(null)}>
                        <Printer size={16} className="me-1" /> إيصال استلام نقدية
                    </Button>

                    <DropdownButton
                        id="add-new-supplier-dropdown"
                        title={
                            <span className="d-flex align-items-center gap-1">
                                <PlusCircle size={18} />
                                <span className="d-none d-sm-inline">إضافة جديد</span>
                                <span className="d-inline d-sm-none">إضافة</span>
                            </span>
                        }
                        variant="primary"
                        size="sm"
                        align="end"
                    >
                        <Dropdown.Item onClick={() => handleAddNew('GENERAL_SUPPLIER')} className="d-flex align-items-center gap-2">
                            <Package size={16} />
                            <span>إضافة مورد عام</span>
                        </Dropdown.Item>
                        <Dropdown.Divider />
                        <Dropdown.Item onClick={() => handleAddNew('LIVESTOCK_FARM')} className="d-flex align-items-center gap-2">
                            <Building size={16} />
                            <span>إضافة مزرعة مواشي</span>
                        </Dropdown.Item>
                    </DropdownButton>
                </div>
            </div>

            <Card className="shadow-sm border-0">
                <Card.Header className="bg-white border-bottom py-3">
                    <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0 fs-5 fw-semibold">قائمة الموردين والمزارع</h5>
                        <Badge bg="light" text="dark" className="fs-6">{suppliers.length} عنصر</Badge>
                    </div>
                </Card.Header>
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="text-muted mt-2">جاري تحميل البيانات...</p>
                        </div>
                    ) : suppliers.length === 0 ? (
                        <div className="text-center py-5 text-muted">
                            <Package size={48} className="mb-3 opacity-50" />
                            <h6 className="mb-2">لا توجد بيانات</h6>
                            <p className="small">لم يتم إضافة موردين أو مزارع بعد</p>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th className="border-bottom-0">الاسم والحيوانات المرتبطة</th>
                                        <th className="border-bottom-0 d-none d-md-table-cell">النوع</th>
                                        <th className="border-bottom-0">الهاتف</th>
                                        <th className="border-bottom-0 d-none d-lg-table-cell">البريد</th>
                                        <th className="border-bottom-0 text-center">الإجراءات</th>
                                        <th className="border-bottom-0 text-center">الحسابات والوثائق</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map(sup => (
                                        <tr key={sup.id}>
                                            <td className="align-middle">
                                                <div className="fw-medium">{sup.name}</div>
                                                {sup.supplier_type === 'LIVESTOCK_FARM' && (
                                                    <div className="mt-2">
                                                        <Badge bg="primary" className="me-1 mb-1">
                                                            {sup.active_animals_count || 0} حيوان متاح/محجوز
                                                        </Badge>
                                                        {sup.active_animals_codes && sup.active_animals_codes.length > 0 && (
                                                            <div className="d-flex flex-wrap gap-1 mt-1">
                                                                {sup.active_animals_codes.slice(0, 20).map(code => (
                                                                    <Badge key={code} bg="light" text="dark" className="border fw-normal" style={{ fontSize: '11px' }}>
                                                                        #{code}
                                                                    </Badge>
                                                                ))}
                                                                {sup.active_animals_codes.length > 20 &&
                                                                    <span className="small text-muted" style={{ fontSize: '11px' }}>...المزيد</span>
                                                                }
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="d-md-none mt-2">
                                                    <Badge bg={sup.supplier_type === 'LIVESTOCK_FARM' ? 'success' : 'info'} className="fs-6">
                                                        {sup.supplier_type_display}
                                                    </Badge>
                                                </div>
                                            </td>
                                            <td className="align-middle d-none d-md-table-cell">
                                                <Badge bg={sup.supplier_type === 'LIVESTOCK_FARM' ? 'success' : 'info'} className="fs-6">
                                                    {sup.supplier_type_display}
                                                </Badge>
                                            </td>
                                            <td className="align-middle">
                                                <div className="d-flex align-items-center gap-1">
                                                    <Phone size={14} className="text-muted" />
                                                    <span>{sup.phone || 'لا يوجد'}</span>
                                                </div>
                                                {sup.additional_contacts && (
                                                    <small className="text-muted d-block">
                                                        + {sup.additional_contacts.split('\n').length} رقم إضافي
                                                    </small>
                                                )}
                                            </td>
                                            <td className="align-middle d-none d-lg-table-cell">
                                                <div className="d-flex align-items-center gap-1">
                                                    <Mail size={14} className="text-muted" />
                                                    <span className="text-truncate" style={{ maxWidth: '150px' }}>
                                                        {sup.email || 'لا يوجد'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="align-middle">
                                                <div className="d-flex justify-content-center gap-2">
                                                    <Button variant="outline-primary" size="sm" onClick={() => handleEdit(sup)} className="d-flex align-items-center gap-1">
                                                        <Edit size={14} />
                                                        <span className="d-none d-sm-inline">تعديل</span>
                                                    </Button>
                                                    <Button variant="outline-danger" size="sm" onClick={() => handleDelete(sup.id)} className="d-flex align-items-center gap-1">
                                                        <Trash2 size={14} />
                                                        <span className="d-none d-sm-inline">حذف</span>
                                                    </Button>
                                                </div>
                                            </td>
                                            <td className="align-middle text-center">
                                                <div className="small fw-bold text-danger mb-1">مستحق: {sup.balance} ج</div>

                                                {sup.is_contract_signed ? (
                                                    <Badge bg="success" className="d-block mb-2"><CheckCircle size={12} /> عقد مُوقع</Badge>
                                                ) : (
                                                    <Badge bg="warning" text="dark" className="d-block mb-2"><XCircle size={12} /> لا يوجد عقد</Badge>
                                                )}

                                                <Button variant="info" size="sm" className="mb-1 w-100" onClick={() => handleOpenLedger(sup)}>كشف الحساب</Button>

                                                <Button variant="outline-dark" size="sm" className="mb-1 w-100" onClick={() => handlePrintContract(sup)}>طباعة عقد</Button>

                                                <Button variant="outline-success" size="sm" className="mb-1 w-100" onClick={() => openReceiptModal(sup)}>
                                                    <Printer size={14} className="me-1" /> إيصال نقدية
                                                </Button>

                                                <Button variant="secondary" size="sm" className="w-100 d-flex align-items-center justify-content-center gap-1" onClick={() => handleOpenDocs(sup)}>
                                                    <FileText size={14} /> الوثائق ({sup.contracts?.length || 0})
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

            <SupplierForm
                show={showModal}
                handleClose={() => setShowModal(false)}
                onSave={fetchData}
                supplierToEdit={supplierToEdit}
                supplierType={newSupplierType}
                setSupplierType={setNewSupplierType}
            />

            <Modal show={showLedgerModal} onHide={() => setShowLedgerModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>كشف حساب: {ledgerSupplier?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="d-flex gap-3 mb-4 text-center">
                        <div className="flex-fill bg-light p-3 rounded">
                            إجمالي المسحوبات<br />
                            <strong className="text-dark fs-5">{ledgerSupplier?.total_owed} ج</strong>
                        </div>
                        <div className="flex-fill bg-success bg-opacity-10 p-3 rounded">
                            تم سداده<br />
                            <strong className="text-success fs-5">{ledgerSupplier?.total_paid} ج</strong>
                        </div>
                        <div className="flex-fill bg-danger bg-opacity-10 p-3 rounded">
                            المتبقي له<br />
                            <strong className="text-danger fs-5">{ledgerSupplier?.balance} ج</strong>
                        </div>
                    </div>

                    <div className="bg-light p-3 rounded mb-4 border">
                        <h6 className="fw-bold mb-3">تسجيل دفعة للمورد</h6>
                        <Row className="g-2 align-items-end">
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="small mb-1">المبلغ (ج.م) *</Form.Label>
                                    <Form.Control
                                        type="number"
                                        placeholder="0.00"
                                        value={paymentAmount}
                                        onChange={e => setPaymentAmount(e.target.value)}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={3}>
                                <Form.Group>
                                    <Form.Label className="small mb-1">ملاحظات</Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="مثال: فودافون كاش، كاش..."
                                        value={paymentNotes}
                                        onChange={e => setPaymentNotes(e.target.value)}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="small mb-1 text-primary fw-bold">إثبات تحويل/صورة (اختياري)</Form.Label>
                                    <Form.Control
                                        type="file"
                                        accept="image/*,.pdf"
                                        onChange={e => setPaymentReceipt(e.target.files[0])}
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={2}>
                                <Button variant="success" className="w-100" onClick={handleAddPayment} disabled={!paymentAmount}>
                                    تسجيل
                                </Button>
                            </Col>
                        </Row>
                    </div>

                    <h6 className="fw-bold">سجل الدفعات الصادرة للمورد</h6>
                    <div className="table-responsive mb-4">
                        <Table size="sm" striped hover className="align-middle text-center">
                            <thead className="table-light">
                                <tr>
                                    <th>التاريخ</th>
                                    <th>المبلغ</th>
                                    <th>ملاحظات</th>
                                    <th>بواسطة</th>
                                    <th>الإثبات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {ledgerData.payments.map((p, i) => (
                                    <tr key={i}>
                                        <td>{new Date(p.date).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                        <td className="text-success fw-bold">{p.amount} ج</td>
                                        <td>{p.notes || '-'}</td>
                                        <td>{p.recorded_by__full_name || '-'}</td>
                                        <td>
                                            {p.receipt_image ? (
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    onClick={() => window.open(p.receipt_image, '_blank')}
                                                >
                                                    عرض الإثبات
                                                </Button>
                                            ) : (
                                                <span className="text-muted small">لا يوجد</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>

                    {ledgerData.animals.length > 0 && (
                        <>
                            <h6 className="fw-bold">المواشي المستلمة من المورد</h6>
                            <Table size="sm" bordered className="mb-4">
                                <thead>
                                    <tr>
                                        <th>تاريخ الاستلام</th>
                                        <th>كود الحيوان</th>
                                        <th>تكلفة الشراء</th>
                                        <th>الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledgerData.animals.map((a, i) => (
                                        <tr key={i}>
                                            <td>{new Date(a.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                            <td>{a.code}</td>
                                            <td>{a.purchase_price} ج</td>
                                            <td>{a.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </>
                    )}

                    {ledgerData.purchase_orders.length > 0 && (
                        <>
                            <h6 className="fw-bold">أوامر الشراء المستلمة من المورد</h6>
                            <Table size="sm" bordered>
                                <thead>
                                    <tr>
                                        <th>تاريخ الأمر</th>
                                        <th>رقم الأمر</th>
                                        <th>التكلفة الإجمالية</th>
                                        <th>الحالة</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ledgerData.purchase_orders.map((po, i) => (
                                        <tr key={i}>
                                            <td>{new Date(po.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                            <td>#{po.id}</td>
                                            <td>{po.total_cost} ج</td>
                                            <td>{po.status}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </>
                    )}
                </Modal.Body>
            </Modal>

            <Modal show={showDocsModal} onHide={() => setShowDocsModal(false)} size="lg" centered>
                <Modal.Header closeButton className="bg-secondary text-white">
                    <Modal.Title>وثائق وعقود المورد: {docsSupplier?.name}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleUploadDoc} className="bg-light p-3 rounded mb-4 border">
                        <h6 className="fw-bold mb-3 d-flex align-items-center gap-2"><UploadCloud size={18} /> رفع عقد أو إيصال جديد للمورد</h6>
                        <Row className="g-2">
                            <Col md={5}>
                                <Form.Control required type="text" placeholder="عنوان الوثيقة..." value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
                            </Col>
                            <Col md={5}>
                                <Form.Control required type="file" accept=".pdf,image/*" onChange={e => setUploadFile(e.target.files[0])} />
                            </Col>
                            <Col md={2}>
                                <Button type="submit" variant="success" className="w-100" disabled={isUploading}>
                                    {isUploading ? <Spinner size="sm" /> : 'رفع وحفظ'}
                                </Button>
                            </Col>
                        </Row>
                    </Form>

                    <h6 className="fw-bold mb-3">سجل الوثائق المرفوعة:</h6>
                    {docsSupplier?.contracts?.length > 0 ? (
                        <div className="table-responsive">
                            <Table size="sm" hover>
                                <thead className="table-light">
                                    <tr>
                                        <th>الوثيقة</th>
                                        <th>التاريخ</th>
                                        <th>الإجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {docsSupplier.contracts.map(doc => (
                                        <tr key={doc.id}>
                                            <td className="fw-bold">{doc.title}</td>
                                            <td>{new Date(doc.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                            <td>
                                                <Button variant="outline-primary" size="sm" onClick={() => window.open(doc.file, '_blank')}>عرض</Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center text-muted py-4 border rounded">لا توجد وثائق مرفوعة لهذا المورد بعد.</div>
                    )}
                </Modal.Body>
            </Modal>

            <PrintReceiptModal
                show={showReceiptModal}
                handleClose={() => setShowReceiptModal(false)}
                supplier={receiptSupplier}
                setPrintConfig={setPrintConfig}
            />

            <PrintModal
                show={printConfig.show}
                handleClose={() => setPrintConfig({ show: false, title: '', endpoint: '' })}
                title={printConfig.title}
                endpoint={printConfig.endpoint}
            />
        </div>
    );
}

export default Suppliers;
