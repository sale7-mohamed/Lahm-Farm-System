import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Modal, Button, Form, Table, Badge, Accordion, Row, Col, Card, Container, Spinner } from 'react-bootstrap';
import { PlusCircle, RotateCcw, Trash2, FileText, DollarSign, Users, Calendar, Building, Wallet, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

const getMonthName = (month) => {
    const months = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
                   'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    return months[month - 1] || '';
};

const getEntryTypeBadge = (type) => {
    switch(type) {
        case 'base_salary': return 'primary';
        case 'allowance': return 'success';
        case 'deduction': return 'danger';
        case 'advance': return 'warning';
        default: return 'secondary';
    }
};

const getEntryTypeName = (type) => {
    switch(type) {
        case 'base_salary': return 'راتب أساسي';
        case 'allowance': return 'بدل';
        case 'deduction': return 'خصم';
        case 'advance': return 'سلفة';
        default: return type;
    }
};

const PayrollForm = ({ show, handleClose, onSave, employees, isMobile }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    useEffect(() => {
        if (show) {
            const now = new Date();
            setFormData({
                employee: '',
                month: now.getMonth() + 1,
                year: now.getFullYear()
            });
            setSelectedEmployee(null);
        }
    }, [show]);

    const handleEmployeeChange = useCallback((e) => {
        const employeeId = e.target.value;
        setFormData(prev => ({ ...prev, employee: employeeId }));

        const employee = employees.find(emp => emp.id == employeeId);
        setSelectedEmployee(employee);

        if (employee) {
            toast.info(`الراتب الأساسي للموظف: ${employee.base_salary || 'غير محدد'}`);
        }
    }, [employees]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const validateForm = () => {
        if (!formData.employee) {
            toast.error("يرجى اختيار الموظف");
            return false;
        }
        if (formData.month < 1 || formData.month > 12) {
            toast.error("الشهر يجب أن يكون بين 1 و 12");
            return false;
        }
        if (formData.year < 2020) {
            toast.error("السنة يجب أن تكون 2020 أو أكبر");
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        try {
            await axios.post('/management/payrolls/', formData);
            toast.success("تم إنشاء مسير الراتب بنجاح!");
            onSave();
            handleClose();
        } catch (error) {
            toast.error(error.response?.data?.error || "فشل إنشاء مسير الراتب. قد يكون موجودًا بالفعل لهذا الشهر.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            show={show}
            onHide={handleClose}
            centered
            size={isMobile ? "md" : "lg"}
            fullscreen={isMobile ? "sm-down" : undefined}
        >
            <Modal.Header closeButton className="border-bottom-0 pb-1">
                <Modal.Title className={isMobile ? "h6" : ""}>
                    إنشاء مسير راتب جديد
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body className="pt-0">
                    <Form.Group className="mb-3">
                        <Form.Label className={isMobile ? "small mb-1" : ""}>
                            الموظف <span className="text-danger">*</span>
                        </Form.Label>
                        <Form.Select
                            name="employee"
                            value={formData.employee || ''}
                            onChange={handleEmployeeChange}
                            required
                            size={isMobile ? "sm" : ""}
                        >
                            <option value="">اختر موظف...</option>
                            {employees.map(emp => (
                                <option key={emp.id} value={emp.id}>
                                    {emp.full_name} ({emp.department_name || 'بدون قسم'})
                                </option>
                            ))}
                        </Form.Select>
                        {selectedEmployee && (
                            <Card className="mt-2 border bg-light">
                                <Card.Body className="p-2">
                                    <div className={isMobile ? "small" : ""}>
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <Wallet size={14} />
                                            <strong>الراتب الأساسي:</strong>
                                            <span className="fw-bold">{selectedEmployee.base_salary || 'غير محدد'} ج.م</span>
                                        </div>
                                        <div className="d-flex align-items-center gap-2 mb-1">
                                            <Building size={14} />
                                            <strong>القسم:</strong> {selectedEmployee.department_name || 'غير محدد'}
                                        </div>
                                        <div className="d-flex align-items-center gap-2">
                                            <Users size={14} />
                                            <strong>الدور:</strong> {selectedEmployee.role_name || 'غير محدد'}
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        )}
                    </Form.Group>

                    <Row className="g-2">
                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className={isMobile ? "small mb-1" : ""}>
                                    الشهر <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="number"
                                    name="month"
                                    value={formData.month || ''}
                                    onChange={handleChange}
                                    required
                                    min="1"
                                    max="12"
                                    size={isMobile ? "sm" : ""}
                                />
                                {formData.month && (
                                    <div className="d-flex align-items-center gap-1 mt-1">
                                        <Calendar size={14} />
                                        <small className="text-muted">
                                            {getMonthName(parseInt(formData.month))}
                                        </small>
                                    </div>
                                )}
                            </Form.Group>
                        </Col>
                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className={isMobile ? "small mb-1" : ""}>
                                    السنة <span className="text-danger">*</span>
                                </Form.Label>
                                <Form.Control
                                    type="number"
                                    name="year"
                                    value={formData.year || ''}
                                    onChange={handleChange}
                                    required
                                    min="2020"
                                    size={isMobile ? "sm" : ""}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer className="border-top-0 pt-1">
                    <Button
                        variant="outline-secondary"
                        onClick={handleClose}
                        size={isMobile ? "sm" : ""}
                        className="flex-fill"
                    >
                        إلغاء
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={loading}
                        size={isMobile ? "sm" : ""}
                        className="flex-fill"
                    >
                        {loading ? (
                            <>
                                <Spinner size="sm" animation="border" className="me-2" />
                                جاري الإنشاء...
                            </>
                        ) : 'إنشاء'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

const PayrollEntryForm = ({ show, handleClose, onSave, payrollId, isMobile }) => {
    const [formData, setFormData] = useState({ entry_type: 'allowance', description: '', amount: '' });

    useEffect(() => {
        if (show) setFormData({ entry_type: 'allowance', description: '', amount: '' });
    }, [show]);

    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`/management/payrolls/${payrollId}/add-entry/`, formData);
            toast.success("تمت إضافة البند بنجاح.");
            onSave();
            handleClose();
        } catch (error) {
            toast.error(error.response?.data?.error || "فشل إضافة البند.");
        }
    };

    return (
        <Modal
            show={show}
            onHide={handleClose}
            centered
            size={isMobile ? "md" : "lg"}
            fullscreen={isMobile ? "sm-down" : undefined}
        >
            <Modal.Header closeButton className="border-bottom-0 pb-1">
                <Modal.Title className={isMobile ? "h6" : ""}>
                    إضافة بند لمسير الراتب
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body className="pt-0">
                    <Form.Group className="mb-3">
                        <Form.Label className={isMobile ? "small mb-1" : ""}>نوع البند</Form.Label>
                        <Form.Select
                            name="entry_type"
                            value={formData.entry_type || ''}
                            onChange={handleChange}
                            size={isMobile ? "sm" : ""}
                        >
                            <option value="allowance">بدل</option>
                            <option value="deduction">خصم</option>
                            <option value="advance">سلفة</option>
                        </Form.Select>
                        <small className="text-muted small">الراتب الأساسي يضاف تلقائياً عند الإنشاء</small>
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className={isMobile ? "small mb-1" : ""}>الوصف (اختياري)</Form.Label>
                        <Form.Control
                            type="text"
                            name="description"
                            value={formData.description || ''}
                            onChange={handleChange}
                            placeholder="اتركه فارغًا لاستخدام اسم النوع"
                            size={isMobile ? "sm" : ""}
                        />
                    </Form.Group>

                    <Form.Group className="mb-3">
                        <Form.Label className={isMobile ? "small mb-1" : ""}>
                            المبلغ <span className="text-danger">*</span>
                        </Form.Label>
                        <div className="input-group">
                            <span className="input-group-text">ج.م</span>
                            <Form.Control
                                type="number"
                                step="0.01"
                                name="amount"
                                value={formData.amount || ''}
                                onChange={handleChange}
                                required
                                size={isMobile ? "sm" : ""}
                            />
                        </div>
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="border-top-0 pt-1">
                    <Button
                        variant="outline-secondary"
                        onClick={handleClose}
                        size={isMobile ? "sm" : ""}
                        className="flex-fill"
                    >
                        إلغاء
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        size={isMobile ? "sm" : ""}
                        className="flex-fill"
                    >
                        إضافة
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

const ConfirmationModal = ({ show, handleClose, title, body, onConfirm, confirmVariant = 'danger', isMobile }) => (
    <Modal
        show={show}
        onHide={handleClose}
        centered
        size={isMobile ? "md" : "lg"}
    >
        <Modal.Header closeButton className="border-bottom-0 pb-1">
            <Modal.Title className={isMobile ? "h6" : ""}>
                {title}
            </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-0">
            <div className="text-center py-2">
                {confirmVariant === 'danger' ? <XCircle size={40} className="text-danger mb-2" /> :
                 confirmVariant === 'warning' ? <RotateCcw size={40} className="text-warning mb-2" /> :
                 <CheckCircle size={40} className="text-success mb-2" />}
                <p>{body}</p>
            </div>
        </Modal.Body>
        <Modal.Footer className="border-top-0 pt-1">
            <Button
                variant="outline-secondary"
                onClick={handleClose}
                size={isMobile ? "sm" : ""}
                className="flex-fill"
            >
                إلغاء
            </Button>
            <Button
                variant={confirmVariant}
                onClick={onConfirm}
                size={isMobile ? "sm" : ""}
                className="flex-fill"
            >
                تأكيد
            </Button>
        </Modal.Footer>
    </Modal>
);

const MobilePayrollCard = ({ payroll, index, employees, onToggle, isOpen, onMarkAsPaid, onReversePayment, onDeletePayroll, onAddEntry, calculateTotals }) => {
    const totals = calculateTotals(payroll.entries);
    const employeeInfo = employees.find(emp => emp.id == payroll.employee) || {};

    return (
        <Card className="mb-3 border shadow-sm">
            <Card.Header
                className="bg-white border-bottom-0 p-3"
                onClick={() => onToggle(index)}
                style={{ cursor: 'pointer' }}
            >
                <div className="d-flex justify-content-between align-items-center">
                    <div className="d-flex align-items-center gap-2">
                        <div className="bg-primary bg-opacity-10 p-2 rounded">
                            <Users size={18} className="text-primary" />
                        </div>
                        <div>
                            <h6 className="mb-0 fw-bold">{payroll.employee_name}</h6>
                            <small className="text-muted">
                                {employeeInfo.department_name || payroll.employee_department || 'بدون قسم'}
                            </small>
                        </div>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                        <Badge bg={payroll.is_paid ? 'success' : 'warning'} className="small">
                            {payroll.is_paid ? 'مدفوع' : 'غير مدفوع'}
                        </Badge>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>

                <div className="mt-2">
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <small className="text-muted">
                                {getMonthName(payroll.month)} {payroll.year}
                            </small>
                        </div>
                        <div className="fw-bold text-primary">
                            {parseFloat(payroll.net_salary).toFixed(2)} ج.م
                        </div>
                    </div>
                </div>
            </Card.Header>

            {isOpen && (
                <Card.Body className="pt-0">
                    {}
                    <Card className="border bg-light mb-3">
                        <Card.Body className="p-2">
                            <div className="row small">
                                <div className="col-6">
                                    <div className="text-muted">الراتب الأساسي</div>
                                    <div className="fw-bold">{employeeInfo.base_salary || 'غير محدد'} ج.م</div>
                                </div>
                                <div className="col-6">
                                    <div className="text-muted">رقم الموظف</div>
                                    <div>{employeeInfo.employee_id || 'غير محدد'}</div>
                                </div>
                            </div>
                        </Card.Body>
                    </Card>

                    {}
                    {payroll.entries.length > 0 ? (
                        <div className="mb-3">
                            <h6 className="mb-2 small fw-bold">بنود الراتب:</h6>
                            <div className="entries-list" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                                {payroll.entries.map(entry => (
                                    <div key={entry.id} className="d-flex justify-content-between align-items-center border-bottom py-2">
                                        <div>
                                            <Badge
                                                bg={getEntryTypeBadge(entry.entry_type)}
                                                className="small me-2"
                                            >
                                                {getEntryTypeName(entry.entry_type)}
                                            </Badge>
                                            <small>{entry.description || getEntryTypeName(entry.entry_type)}</small>
                                        </div>
                                        <div className={entry.entry_type === 'base_salary' || entry.entry_type === 'allowance'
                                            ? 'text-success fw-bold small'
                                            : 'text-danger fw-bold small'}>
                                            {parseFloat(entry.amount).toFixed(2)} ج.م
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {}
                            <div className="mt-3 p-2 border rounded bg-white">
                                <div className="d-flex justify-content-between mb-1 small">
                                    <span>الإضافات:</span>
                                    <span className="text-success fw-bold">{totals.additions.toFixed(2)} ج.م</span>
                                </div>
                                <div className="d-flex justify-content-between mb-1 small">
                                    <span>الخصومات:</span>
                                    <span className="text-danger fw-bold">{totals.deductions.toFixed(2)} ج.م</span>
                                </div>
                                <div className="d-flex justify-content-between mb-1 small">
                                    <span>الصافي:</span>
                                    <span className="text-primary fw-bold">{totals.net.toFixed(2)} ج.م</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-3 border rounded bg-light">
                            <small className="text-muted">لا توجد بنود مضافة</small>
                        </div>
                    )}

                    {}
                    <div className="d-flex flex-wrap gap-2 mt-3">
                        {!payroll.is_paid ? (
                            <>
                                <Button
                                    size="sm"
                                    onClick={() => onAddEntry(payroll.id)}
                                    className="flex-fill d-flex align-items-center justify-content-center gap-1"
                                >
                                    <PlusCircle size={14} />
                                    <span>إضافة بند</span>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="success"
                                    onClick={() => onMarkAsPaid(payroll.id)}
                                    className="flex-fill d-flex align-items-center justify-content-center gap-1"
                                >
                                    <CheckCircle size={14} />
                                    <span>تم الدفع</span>
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline-danger"
                                    onClick={() => onDeletePayroll(payroll.id)}
                                    className="flex-fill d-flex align-items-center justify-content-center gap-1"
                                >
                                    <Trash2 size={14} />
                                    <span>حذف</span>
                                </Button>
                            </>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline-warning"
                                onClick={() => onReversePayment(payroll.id)}
                                className="w-100 d-flex align-items-center justify-content-center gap-1"
                            >
                                <RotateCcw size={14} />
                                إلغاء الدفع
                            </Button>
                        )}
                    </div>
                </Card.Body>
            )}
        </Card>
    );
};

function Payrolls() {
    const [payrolls, setPayrolls] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEntryModal, setShowEntryModal] = useState(false);
    const [selectedPayrollId, setSelectedPayrollId] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
    const [openAccordion, setOpenAccordion] = useState(null);

    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        body: '',
        onConfirm: () => {},
        confirmVariant: 'danger'
    });

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 992);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [payrollsRes, employeesRes] = await Promise.all([
                axios.get('/management/payrolls/'),
                axios.get('/management/employees/')
            ]);
            setPayrolls(payrollsRes.data.results || payrollsRes.data || []);
            setEmployees(employeesRes.data.results || employeesRes.data || []);
        } catch (error) {
            console.error("Failed to fetch data:", error);
            toast.error("فشل تحميل بيانات الرواتب.");
        }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const calculateTotals = useCallback((entries) => {
        const additions = entries
            .filter(entry => entry.entry_type === 'base_salary' || entry.entry_type === 'allowance')
            .reduce((sum, entry) => sum + parseFloat(entry.amount), 0);

        const deductions = entries
            .filter(entry => entry.entry_type === 'deduction' || entry.entry_type === 'advance')
            .reduce((sum, entry) => sum + parseFloat(entry.amount), 0);

        return { additions, deductions, net: additions - deductions };
    }, []);

    const handleMarkAsPaid = (id) => {
        setConfirmModal({
            show: true,
            title: 'تأكيد الدفع',
            body: 'هل أنت متأكد من وضع علامة "مدفوع" على هذا الراتب؟ سيتم إنشاء قيد محاسبي.',
            confirmVariant: 'success',
            onConfirm: async () => {
                try {
                    await axios.post(`/management/payrolls/${id}/mark-as-paid/`);
                    toast.success("تم تحديث حالة الراتب بنجاح.");
                    fetchData();
                } catch (error) {
                    toast.error(error.response?.data?.error || "فشل تحديث الحالة.");
                }
                setConfirmModal({ ...confirmModal, show: false });
            }
        });
    };

    const handleReversePayment = (id) => {
        setConfirmModal({
            show: true,
            title: 'تأكيد إلغاء الدفع',
            body: 'هل أنت متأكد من إلغاء عملية الدفع؟ سيتم حذف القيد المحاسبي المرتبط.',
            confirmVariant: 'warning',
            onConfirm: async () => {
                try {
                    await axios.post(`/management/payrolls/${id}/reverse-payment/`);
                    toast.success("تم إلغاء عملية الدفع بنجاح.");
                    fetchData();
                } catch (error) {
                    toast.error(error.response?.data?.error || "فشل إلغاء الدفع.");
                }
                setConfirmModal({ ...confirmModal, show: false });
            }
        });
    };

    const handleDeletePayroll = (id) => {
        setConfirmModal({
            show: true,
            title: 'تأكيد الحذف',
            body: 'هل أنت متأكد من حذف هذا الراتب؟ لا يمكن التراجع عن هذا الإجراء.',
            confirmVariant: 'danger',
            onConfirm: async () => {
                try {
                    const response = await axios.delete(`/management/payrolls/${id}/`);
                    toast.success(response.data.detail || "تم حذف الراتب بنجاح.");
                    fetchData();
                } catch (error) {
                    toast.error(error.response?.data?.detail || "فشل حذف الراتب.");
                }
                setConfirmModal({ ...confirmModal, show: false });
            }
        });
    };

    const toggleAccordion = (index) => {
        setOpenAccordion(openAccordion === index ? null : index);
    };

    const handleAddEntry = (payrollId) => {
        setSelectedPayrollId(payrollId);
        setShowEntryModal(true);
    };

    const stats = {
        total: payrolls.length,
        paid: payrolls.filter(p => p.is_paid).length,
        pending: payrolls.filter(p => !p.is_paid).length,
        totalAmount: payrolls.reduce((sum, p) => sum + parseFloat(p.net_salary), 0)
    };

    return (
        <Container fluid className={`payrolls-container ${isMobile ? 'px-2' : 'px-3'}`}>
            {/* Header Section */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
                <div className="d-flex align-items-center">
                    <div className="bg-primary bg-opacity-10 p-2 rounded me-2">
                        <DollarSign size={isMobile ? 20 : 24} className="text-primary" />
                    </div>
                    <div>
                        <h1 className={`${isMobile ? 'h5' : 'h4'} mb-0 fw-bold`}>إدارة الرواتب</h1>
                        <small className="text-muted">إدارة وصرف رواتب الموظفين</small>
                    </div>
                </div>

                <div className="d-flex flex-column flex-md-row align-items-center gap-2">
                    {!isMobile && (
                        <div className="d-flex gap-2 me-2">
                            <Badge bg="secondary" className="px-3 py-2">
                                <span className="small">الإجمالي: {stats.total}</span>
                            </Badge>
                            <Badge bg="success" className="px-3 py-2">
                                <span className="small">مدفوع: {stats.paid}</span>
                            </Badge>
                            <Badge bg="warning" className="px-3 py-2">
                                <span className="small">معلق: {stats.pending}</span>
                            </Badge>
                        </div>
                    )}

                    <Button
                        onClick={() => setShowCreateModal(true)}
                        size={isMobile ? "sm" : ""}
                        className="d-flex align-items-center justify-content-center gap-2"
                    >
                        <PlusCircle size={16} />
                        {isMobile ? 'مسير راتب' : 'إنشاء مسير راتب'}
                    </Button>
                </div>
            </div>

            {/* Stats Cards for Mobile */}
            {isMobile && payrolls.length > 0 && (
                <Row className="mb-3 g-2">
                    <Col xs={4}>
                        <Card className="border-0 bg-primary bg-opacity-10 text-center p-2">
                            <div className="fw-bold">{stats.total}</div>
                            <small className="text-muted">إجمالي</small>
                        </Card>
                    </Col>
                    <Col xs={4}>
                        <Card className="border-0 bg-success bg-opacity-10 text-center p-2">
                            <div className="fw-bold text-success">{stats.paid}</div>
                            <small className="text-muted">مدفوع</small>
                        </Card>
                    </Col>
                    <Col xs={4}>
                        <Card className="border-0 bg-warning bg-opacity-10 text-center p-2">
                            <div className="fw-bold text-warning">{stats.pending}</div>
                            <small className="text-muted">معلق</small>
                        </Card>
                    </Col>
                </Row>
            )}

            {/* Main Content */}
            <Card className="shadow-sm border-0">
                <Card.Body className="p-2 p-md-3">
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" size={isMobile ? "sm" : ""} />
                            <div className="mt-3 small">جاري تحميل بيانات الرواتب...</div>
                        </div>
                    ) : payrolls.length === 0 ? (
                        <div className="text-center py-5">
                            <div className="bg-light rounded-circle d-inline-flex p-3 mb-3">
                                <FileText size={32} className="text-muted" />
                            </div>
                            <h5 className="text-muted">لا توجد رواتب مضافة</h5>
                            <p className="text-muted mb-4">ابدأ بإضافة راتب جديد للموظفين</p>
                            <Button
                                variant="outline-primary"
                                onClick={() => setShowCreateModal(true)}
                                size={isMobile ? "sm" : ""}
                            >
                                <PlusCircle size={16} className="me-2" /> إنشاء أول راتب
                            </Button>
                        </div>
                    ) : isMobile ? (
                        // Mobile View - Cards
                        <div className="mobile-payrolls-list" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {payrolls.map((payroll, index) => (
                                <MobilePayrollCard
                                    key={payroll.id}
                                    payroll={payroll}
                                    index={index}
                                    employees={employees}
                                    onToggle={toggleAccordion}
                                    isOpen={openAccordion === index}
                                    onMarkAsPaid={handleMarkAsPaid}
                                    onReversePayment={handleReversePayment}
                                    onDeletePayroll={handleDeletePayroll}
                                    onAddEntry={handleAddEntry}
                                    calculateTotals={calculateTotals}
                                />
                            ))}
                        </div>
                    ) : (
                        // Desktop View - Accordion
                        <Accordion>
                            {payrolls.map((payroll, index) => {
                                const totals = calculateTotals(payroll.entries);
                                const employeeInfo = employees.find(emp => emp.id == payroll.employee) || {};

                                return (
                                    <Accordion.Item eventKey={index.toString()} key={payroll.id}>
                                        <Accordion.Header>
                                            <div className="w-100 d-flex justify-content-between align-items-center pe-3">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div>
                                                        <span className="fw-bold">{payroll.employee_name}</span>
                                                        {employeeInfo.department_name && (
                                                            <small className="text-muted ms-2">({employeeInfo.department_name})</small>
                                                        )}
                                                    </div>
                                                    <Badge bg={payroll.is_paid ? 'success' : 'warning'} className="fw-normal">
                                                        {payroll.is_paid ? `مدفوع بتاريخ ${payroll.paid_date}` : 'غير مدفوع'}
                                                    </Badge>
                                                </div>
                                                <div className="text-end">
                                                    <div className="fw-bold">
                                                        صافي الراتب: {parseFloat(payroll.net_salary).toFixed(2)} ج.م
                                                    </div>
                                                    <small className="text-muted">
                                                        {getMonthName(payroll.month)} {payroll.year}
                                                    </small>
                                                </div>
                                            </div>
                                        </Accordion.Header>
                                        <Accordion.Body>
                                            <div className="mb-3 p-3 border rounded bg-light">
                                                <Row>
                                                    <Col md={4}>
                                                        <div className="mb-2">
                                                            <small className="text-muted d-block">الموظف</small>
                                                            <strong>{payroll.employee_name}</strong>
                                                            {employeeInfo.employee_id && <small className="text-muted ms-2">(رقم: {employeeInfo.employee_id})</small>}
                                                        </div>
                                                    </Col>
                                                    <Col md={4}>
                                                        <div className="mb-2">
                                                            <small className="text-muted d-block">القسم</small>
                                                            <strong>{employeeInfo.department_name || payroll.employee_department || 'غير محدد'}</strong>
                                                        </div>
                                                    </Col>
                                                    <Col md={4}>
                                                        <div className="mb-2">
                                                            <small className="text-muted d-block">الراتب الأساسي</small>
                                                            <strong className="text-primary">{employeeInfo.base_salary || 'غير محدد'} ج.م</strong>
                                                        </div>
                                                    </Col>
                                                </Row>
                                            </div>

                                            <h6 className="mb-3">بنود الراتب:</h6>
                                            {payroll.entries.length === 0 ? (
                                                <p className="text-muted text-center py-3">لا توجد بنود مضافة</p>
                                            ) : (
                                                <>
                                                    <Table striped bordered hover size="sm" className="mb-4">
                                                        <thead>
                                                            <tr>
                                                                <th width="120">النوع</th>
                                                                <th>الوصف</th>
                                                                <th width="150">المبلغ</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {payroll.entries.map(entry => (
                                                                <tr key={entry.id}>
                                                                    <td>
                                                                        <Badge bg={getEntryTypeBadge(entry.entry_type)} className="fw-normal">
                                                                            {getEntryTypeName(entry.entry_type)}
                                                                        </Badge>
                                                                    </td>
                                                                    <td>{entry.description || getEntryTypeName(entry.entry_type)}</td>
                                                                    <td className={
                                                                        entry.entry_type === 'base_salary' || entry.entry_type === 'allowance'
                                                                            ? 'text-success fw-bold'
                                                                            : 'text-danger fw-bold'
                                                                    }>
                                                                        {parseFloat(entry.amount).toFixed(2)} ج.م
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>

                                                    <Table bordered size="sm" className="w-50">
                                                        <tbody>
                                                            <tr>
                                                                <td><strong>الإجمالي الإضافات:</strong></td>
                                                                <td className="text-success fw-bold text-end">
                                                                    {totals.additions.toFixed(2)} ج.م
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td><strong>الإجمالي الخصومات:</strong></td>
                                                                <td className="text-danger fw-bold text-end">
                                                                    {totals.deductions.toFixed(2)} ج.م
                                                                </td>
                                                            </tr>
                                                            <tr>
                                                                <td><strong>الصافي:</strong></td>
                                                                <td className="text-primary fw-bold text-end">
                                                                    {totals.net.toFixed(2)} ج.م
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </Table>
                                                </>
                                            )}

                                            <div className="mt-4">
                                                {!payroll.is_paid ? (
                                                    <div className="d-flex gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleAddEntry(payroll.id);
                                                            }}
                                                        >
                                                            إضافة بند
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="success"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleMarkAsPaid(payroll.id);
                                                            }}
                                                        >
                                                            وضع علامة كمدفوع
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline-danger"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeletePayroll(payroll.id);
                                                            }}
                                                        >
                                                            <Trash2 size={16} className="me-1" /> حذف
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        size="sm"
                                                        variant="outline-warning"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleReversePayment(payroll.id);
                                                        }}
                                                    >
                                                        <RotateCcw size={16} className="me-1" /> إلغاء الدفع
                                                    </Button>
                                                )}
                                            </div>
                                        </Accordion.Body>
                                    </Accordion.Item>
                                );
                            })}
                        </Accordion>
                    )}
                </Card.Body>
            </Card>

            {/* Modals */}
            <PayrollForm
                show={showCreateModal}
                handleClose={() => setShowCreateModal(false)}
                onSave={fetchData}
                employees={employees}
                isMobile={isMobile}
            />

            <PayrollEntryForm
                show={showEntryModal}
                handleClose={() => setShowEntryModal(false)}
                onSave={fetchData}
                payrollId={selectedPayrollId}
                isMobile={isMobile}
            />

            <ConfirmationModal
                show={confirmModal.show}
                handleClose={() => setConfirmModal({ ...confirmModal, show: false })}
                title={confirmModal.title}
                body={confirmModal.body}
                onConfirm={confirmModal.onConfirm}
                confirmVariant={confirmModal.confirmVariant}
                isMobile={isMobile}
            />

            {/* Responsive Styles */}
            <style>{`
                .payrolls-container {
                    max-width: 100%;
                    overflow-x: hidden;
                }

                .mobile-payrolls-list {
                    touch-action: pan-y;
                }

                .mobile-payrolls-list::-webkit-scrollbar {
                    width: 4px;
                }

                .mobile-payrolls-list::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }

                .mobile-payrolls-list::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 2px;
                }

                .entries-list::-webkit-scrollbar {
                    width: 3px;
                }

                .entries-list::-webkit-scrollbar-track {
                    background: #f8f9fa;
                }

                .entries-list::-webkit-scrollbar-thumb {
                    background: #dee2e6;
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
                    .payrolls-container {
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

                .btn, .form-check-input, .accordion-button, .nav-link {
                    touch-action: manipulation;
                }

                .badge {
                    font-weight: 500;
                }

                .card {
                    border-radius: 10px;
                    transition: transform 0.2s ease;
                }

                .card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                }

                .table td, .table th {
                    vertical-align: middle;
                }

                .accordion-button:not(.collapsed) {
                    background-color: #f8f9fa;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    border: none;
                }

                .btn-primary:hover {
                    background: linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%);
                }
            `}</style>
        </Container>
    );
}

export default Payrolls;