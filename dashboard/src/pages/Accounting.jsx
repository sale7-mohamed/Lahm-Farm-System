import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import {
  Modal,
  Button,
  Form,
  Table,
  Tab,
  Nav,
  Card,
  Row,
  Col,
  Badge,
  Spinner,
  Accordion,
  ListGroup,
  InputGroup
} from 'react-bootstrap';
import {
  PlusCircle,
  DollarSign,
  TrendingDown,
  TrendingUp,
  Wallet,
  Banknote,
  Calendar,
  FileText,
  Calculator,
  Filter,
  Search,
  RefreshCw,
  Info
} from 'lucide-react';
import { useHasPermission } from '../hooks/useHasPermission';

const ExpenseForm = ({ show, handleClose, onSave, accounts }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});

    const expenseAccounts = accounts.filter(a => a.account_type === 'EXPENSE');
    const assetAccounts = accounts.filter(a => a.account_type === 'ASSET');

    useEffect(() => {
        if (show) {
            setFormData({
                date: new Date().toISOString().split('T')[0],
                description: '',
                amount: '',
                expense_account: '',
                payment_account: ''
            });
            setErrors({});
        }
    }, [show]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.description?.trim()) newErrors.description = 'الوصف مطلوب';
        if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'المبلغ يجب أن يكون أكبر من صفر';
        if (!formData.expense_account) newErrors.expense_account = 'حساب المصروف مطلوب';
        if (!formData.payment_account) newErrors.payment_account = 'حساب الدفع مطلوب';
        return newErrors;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validateForm();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post('/accounting/expenses/', {
                ...formData,
                amount: parseFloat(formData.amount)
            });
            if (response.data.detail && response.data.detail.includes('للموافقة')) {
                toast.info(response.data.detail);
            } else {
                toast.success("تم تسجيل المصروف بنجاح!");
                onSave();
            }
            handleClose();
        } catch (error) {
            console.error("Failed to save expense:", error.response?.data);
            const errorMsg = error.response?.data?.message || "فشل تسجيل المصروف.";
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton className="border-bottom-0">
                <Modal.Title className="text-center w-100">
                    <DollarSign size={24} className="me-2" />
                    تسجيل مصروف جديد
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>
                                    <FileText size={16} className="me-2 text-muted" />
                                    الوصف
                                </Form.Label>
                                <Form.Control
                                    type="text"
                                    name="description"
                                    value={formData.description || ''}
                                    onChange={handleChange}
                                    isInvalid={!!errors.description}
                                    placeholder="أدخل وصف المصروف"
                                    style={{ fontSize: '16px' }}
                                />
                                <Form.Control.Feedback type="invalid">
                                    {errors.description}
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>
                                    <Calculator size={16} className="me-2 text-muted" />
                                    المبلغ
                                </Form.Label>
                                <InputGroup>
                                    <InputGroup.Text>ج.م</InputGroup.Text>
                                    <Form.Control
                                        type="number"
                                        name="amount"
                                        value={formData.amount || ''}
                                        onChange={handleChange}
                                        isInvalid={!!errors.amount}
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        style={{ fontSize: '16px' }}
                                    />
                                </InputGroup>
                                <Form.Control.Feedback type="invalid">
                                    {errors.amount}
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Col>
                    </Row>

                    <Row>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>
                                    <TrendingDown size={16} className="me-2 text-muted" />
                                    حساب المصروف
                                </Form.Label>
                                <Form.Select
                                    name="expense_account"
                                    value={formData.expense_account || ''}
                                    onChange={handleChange}
                                    isInvalid={!!errors.expense_account}
                                    style={{ fontSize: '16px' }}
                                >
                                    <option value="">اختر حساب المصروف...</option>
                                    {expenseAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} ({acc.account_number})
                                        </option>
                                    ))}
                                </Form.Select>
                                <Form.Control.Feedback type="invalid">
                                    {errors.expense_account}
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label>
                                    <Wallet size={16} className="me-2 text-muted" />
                                    حساب الدفع
                                </Form.Label>
                                <Form.Select
                                    name="payment_account"
                                    value={formData.payment_account || ''}
                                    onChange={handleChange}
                                    isInvalid={!!errors.payment_account}
                                    style={{ fontSize: '16px' }}
                                >
                                    <option value="">اختر حساب الدفع...</option>
                                    {assetAccounts.map(acc => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} ({acc.account_number})
                                        </option>
                                    ))}
                                </Form.Select>
                                <Form.Control.Feedback type="invalid">
                                    {errors.payment_account}
                                </Form.Control.Feedback>
                            </Form.Group>
                        </Col>
                    </Row>

                    <Form.Group className="mb-3">
                        <Form.Label>
                            <Calendar size={16} className="me-2 text-muted" />
                            التاريخ
                        </Form.Label>
                        <Form.Control
                            type="date"
                            name="date"
                            value={formData.date || ''}
                            onChange={handleChange}
                            style={{ fontSize: '16px' }}
                        />
                    </Form.Group>

                    <div className="alert alert-light">
                        <small className="text-muted">
                            <Info size={14} className="me-1" />
                            سيتم خصم المبلغ من حساب الدفع وإضافته إلى حساب المصروف تلقائياً.
                        </small>
                    </div>
                </Modal.Body>
                <Modal.Footer className="border-top-0">
                    <Button
                        variant="outline-secondary"
                        onClick={handleClose}
                        style={{ minHeight: '44px' }}
                    >
                        إلغاء
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={loading}
                        style={{ minHeight: '44px' }}
                    >
                        {loading ? (
                            <>
                                <Spinner animation="border" size="sm" className="me-2" />
                                جاري الحفظ...
                            </>
                        ) : (
                            <>
                                <PlusCircle size={18} className="me-2" />
                                حفظ المصروف
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

function Accounting() {
    const [accounts, setAccounts] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [activeTab, setActiveTab] = useState('accounts');
    const [searchTerm, setSearchTerm] = useState('');
    const [accountTypeFilter, setAccountTypeFilter] = useState('all');
    const [expenseFilter, setExpenseFilter] = useState('all');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [accRes, expRes] = await Promise.all([
                axios.get('/accounting/accounts/'),
                axios.get('/accounting/expenses/')
            ]);
            setAccounts(accRes.data || []);
            setExpenses(expRes.data.results || []);
        } catch (error) {
            toast.error("فشل تحميل البيانات المحاسبية.");
            console.error("Fetch error:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth <= 768);
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
    const totalAssets = accounts
        .filter(a => a.account_type === 'ASSET')
        .reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const totalExpenseAccounts = accounts
        .filter(a => a.account_type === 'EXPENSE')
        .reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);
    const totalEquity = accounts
        .filter(a => a.account_type === 'EQUITY')
        .reduce((sum, acc) => sum + parseFloat(acc.balance || 0), 0);

    const filteredAccounts = accounts.filter(acc => {
        if (accountTypeFilter !== 'all' && acc.account_type !== accountTypeFilter) return false;
        if (searchTerm && !acc.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const isRecentExpense = (expense) => {
        const expenseDate = new Date(expense.date);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return expenseDate > weekAgo;
    };

    const filteredExpenses = expenses.filter(exp => {
        if (expenseFilter === 'recent' && isRecentExpense(exp)) return true;
        if (expenseFilter === 'high' && parseFloat(exp.amount) > 1000) return true;
        return expenseFilter === 'all';
    });

    const formatCurrency = (amount) => {
        return parseFloat(amount || 0).toLocaleString('ar-EG', { numberingSystem: 'latn' }) + ' ج.م';
    };

    const checkAccess = useHasPermission();
    const canAddDirectly = checkAccess('accounting', 'FULL_ACCESS');
    const needsApproval = checkAccess('accounting', 'REQUIRE_APPROVAL');
    const isViewOnly = checkAccess('accounting', 'VIEW_ONLY') && !canAddDirectly && !needsApproval;

    const DesktopView = () => (
        <>
            <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
                <Card className="shadow-sm">
                    <Card.Header className="bg-white border-bottom-0">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <h4 className="mb-0">إدارة المحاسبة</h4>
                                <p className="text-muted mb-0">إدارة الحسابات والمصروفات المالية</p>
                            </div>
                            <div className="d-flex">
                                <Button
                                    variant="outline-primary"
                                    className="me-2"
                                    onClick={fetchData}
                                    disabled={loading}
                                >
                                    <RefreshCw size={16} className={loading ? 'spin' : ''} />
                                </Button>
                                {activeTab === 'expenses' && !isViewOnly && (
                                    <Button
                                        variant="primary"
                                        onClick={() => setShowModal(true)}
                                    >
                                        <PlusCircle size={18} className="me-2" />
                                        {needsApproval ? 'طلب مصروف جديد' : 'مصروف جديد'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card.Header>

                    <Card.Body className="p-0">
                        <Row className="px-3 pt-3">
                            <Col md={3}>
                                <Card className="border-0 bg-success bg-opacity-10">
                                    <Card.Body className="py-3">
                                        <div className="d-flex align-items-center">
                                            <Wallet size={20} className="text-success me-3" />
                                            <div>
                                                <small className="text-muted d-block">إجمالي الأصول</small>
                                                <strong className="d-block fs-5">{formatCurrency(totalAssets)}</strong>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={3}>
                                <Card className="border-0 bg-danger bg-opacity-10">
                                    <Card.Body className="py-3">
                                        <div className="d-flex align-items-center">
                                            <TrendingDown size={20} className="text-danger me-3" />
                                            <div>
                                                <small className="text-muted d-block">إجمالي المصروفات</small>
                                                <strong className="d-block fs-5">{formatCurrency(totalExpenses)}</strong>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={3}>
                                <Card className="border-0 bg-warning bg-opacity-10">
                                    <Card.Body className="py-3">
                                        <div className="d-flex align-items-center">
                                            <DollarSign size={20} className="text-warning me-3" />
                                            <div>
                                                <small className="text-muted d-block">رصيد المصروفات</small>
                                                <strong className="d-block fs-5">{formatCurrency(totalExpenseAccounts)}</strong>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                            <Col md={3}>
                                <Card className="border-0 bg-info bg-opacity-10">
                                    <Card.Body className="py-3">
                                        <div className="d-flex align-items-center">
                                            <Banknote size={20} className="text-info me-3" />
                                            <div>
                                                <small className="text-muted d-block">حقوق الملكية</small>
                                                <strong className="d-block fs-5">{formatCurrency(totalEquity)}</strong>
                                            </div>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>

                        <Nav variant="pills" className="px-3 pt-3">
                            <Nav.Item>
                                <Nav.Link eventKey="accounts" className="d-flex align-items-center">
                                    <Banknote size={18} className="me-2" />
                                    شجرة الحسابات
                                    <Badge bg="light" text="dark" className="ms-2">
                                        {accounts.length}
                                    </Badge>
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="expenses" className="d-flex align-items-center">
                                    <TrendingDown size={18} className="me-2" />
                                    المصروفات
                                    <Badge bg="light" text="dark" className="ms-2">
                                        {expenses.length}
                                    </Badge>
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>

                        <Tab.Content>
                            <Tab.Pane eventKey="accounts" className="p-3">
                                <div className="mb-3">
                                    <Row className="g-2">
                                        <Col md={8}>
                                            <InputGroup>
                                                <InputGroup.Text>
                                                    <Search size={16} />
                                                </InputGroup.Text>
                                                <Form.Control
                                                    placeholder="بحث في الحسابات..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </InputGroup>
                                        </Col>
                                        <Col md={4}>
                                            <Form.Select
                                                value={accountTypeFilter}
                                                onChange={(e) => setAccountTypeFilter(e.target.value)}
                                            >
                                                <option value="all">جميع الأنواع</option>
                                                <option value="ASSET">الأصول</option>
                                                <option value="LIABILITY">الخصوم</option>
                                                <option value="EQUITY">حقوق الملكية</option>
                                                <option value="EXPENSE">المصروفات</option>
                                            </Form.Select>
                                        </Col>
                                    </Row>
                                </div>

                                {loading ? (
                                    <div className="text-center py-5">
                                        <Spinner animation="border" variant="primary" />
                                        <p className="mt-2">جاري تحميل الحسابات...</p>
                                    </div>
                                ) : filteredAccounts.length === 0 ? (
                                    <div className="text-center py-5">
                                        <Banknote size={48} className="text-muted mb-3" />
                                        <h5 className="text-muted">لا توجد حسابات</h5>
                                        <p className="text-muted">لم يتم العثور على حسابات تطابق البحث</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <Table hover className="mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th width="15%">رقم الحساب</th>
                                                    <th width="30%">اسم الحساب</th>
                                                    <th width="20%">نوع الحساب</th>
                                                    <th width="20%">الرصيد</th>
                                                    <th width="15%">الحالة</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredAccounts.map(acc => (
                                                    <tr key={acc.id}>
                                                        <td>
                                                            <Badge bg="secondary">
                                                                {acc.account_number}
                                                            </Badge>
                                                        </td>
                                                        <td className="fw-bold">{acc.name}</td>
                                                        <td>
                                                            <Badge bg={
                                                                acc.account_type === 'ASSET' ? 'success' :
                                                                acc.account_type === 'LIABILITY' ? 'warning' :
                                                                acc.account_type === 'EQUITY' ? 'info' : 'danger'
                                                            }>
                                                                {acc.account_type}
                                                            </Badge>
                                                        </td>
                                                        <td className="fw-bold">
                                                            {formatCurrency(acc.balance)}
                                                        </td>
                                                        <td>
                                                            <Badge bg={parseFloat(acc.balance || 0) >= 0 ? 'success' : 'danger'}>
                                                                {parseFloat(acc.balance || 0) >= 0 ? 'إيجابي' : 'سلبي'}
                                                            </Badge>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                )}
                            </Tab.Pane>

                            <Tab.Pane eventKey="expenses" className="p-3">
                                <div className="mb-3">
                                    <Row className="g-2 align-items-center">
                                        <Col md={4}>
                                            <Form.Select
                                                value={expenseFilter}
                                                onChange={(e) => setExpenseFilter(e.target.value)}
                                            >
                                                <option value="all">جميع المصروفات</option>
                                                <option value="recent">المصروفات الأخيرة (أسبوع)</option>
                                                <option value="high">مصروفات كبيرة (أكثر من 1000 ج.م)</option>
                                            </Form.Select>
                                        </Col>
                                        {!isViewOnly && (
                                            <Col md={4} className="ms-auto">
                                                <Button
                                                    variant="primary"
                                                    className="w-100"
                                                    onClick={() => setShowModal(true)}
                                                >
                                                    <PlusCircle size={18} className="me-2" />
                                                    {needsApproval ? 'طلب مصروف جديد' : 'تسجيل مصروف جديد'}
                                                </Button>
                                            </Col>
                                        )}
                                    </Row>
                                </div>

                                {loading ? (
                                    <div className="text-center py-5">
                                        <Spinner animation="border" variant="primary" />
                                        <p className="mt-2">جاري تحميل المصروفات...</p>
                                    </div>
                                ) : filteredExpenses.length === 0 ? (
                                    <div className="text-center py-5">
                                        <TrendingDown size={48} className="text-muted mb-3" />
                                        <h5 className="text-muted">لا توجد مصروفات</h5>
                                        <p className="text-muted">لم يتم العثور على مصروفات تطابق البحث</p>
                                    </div>
                                ) : (
                                    <div className="table-responsive">
                                        <Table hover className="mb-0">
                                            <thead className="table-light">
                                                <tr>
                                                    <th width="15%">التاريخ</th>
                                                    <th width="25%">الوصف</th>
                                                    <th width="15%">المبلغ</th>
                                                    <th width="25%">حساب المصروف</th>
                                                    <th width="20%">حساب الدفع</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredExpenses.map(exp => (
                                                    <tr key={exp.id}>
                                                        <td>
                                                            <div className="d-flex align-items-center">
                                                                <Calendar size={14} className="me-1 text-muted" />
                                                                {exp.date}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="fw-bold">{exp.description}</div>
                                                            {exp.notes && (
                                                                <small className="text-muted">{exp.notes}</small>
                                                            )}
                                                        </td>
                                                        <td className="fw-bold text-danger">
                                                            <TrendingDown size={14} className="me-1" />
                                                            {formatCurrency(exp.amount)}
                                                        </td>
                                                        <td>
                                                            <div className="d-flex align-items-center">
                                                                <Badge bg="danger" className="me-2">
                                                                    {exp.expense_account_details?.account_number}
                                                                </Badge>
                                                                {exp.expense_account_details?.name}
                                                            </div>
                                                        </td>
                                                        <td>
                                                            <div className="d-flex align-items-center">
                                                                <Badge bg="success" className="me-2">
                                                                    {exp.payment_account_details?.account_number}
                                                                </Badge>
                                                                {exp.payment_account_details?.name}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </Table>
                                    </div>
                                )}
                            </Tab.Pane>
                        </Tab.Content>
                    </Card.Body>
                </Card>
            </Tab.Container>
        </>
    );

    const MobileView = () => (
        <div>
            <Card className="shadow-sm mb-3">
                <Card.Header className="bg-white">
                    <div className="d-flex justify-content-between align-items-center">
                        <div>
                            <h5 className="mb-0">المحاسبة</h5>
                            <p className="text-muted small mb-0">إدارة المالية</p>
                        </div>
                        <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={fetchData}
                            disabled={loading}
                            style={{ minHeight: '44px', minWidth: '44px' }}
                        >
                            <RefreshCw size={16} className={loading ? 'spin' : ''} />
                        </Button>
                    </div>
                </Card.Header>
                <Card.Body>
                    <Row className="mb-3 g-2">
                        <Col xs={6}>
                            <Card className="border-0 bg-success bg-opacity-10">
                                <Card.Body className="py-2">
                                    <div className="d-flex align-items-center">
                                        <Wallet size={20} className="text-success me-2" />
                                        <div>
                                            <small className="text-muted d-block">الأصول</small>
                                            <strong className="d-block">{formatCurrency(totalAssets)}</strong>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xs={6}>
                            <Card className="border-0 bg-danger bg-opacity-10">
                                <Card.Body className="py-2">
                                    <div className="d-flex align-items-center">
                                        <TrendingDown size={20} className="text-danger me-2" />
                                        <div>
                                            <small className="text-muted d-block">المصروفات</small>
                                            <strong className="d-block">{formatCurrency(totalExpenses)}</strong>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    <Row className="mb-3 g-2">
                        <Col xs={6}>
                            <Card className="border-0 bg-warning bg-opacity-10">
                                <Card.Body className="py-2">
                                    <div className="d-flex align-items-center">
                                        <DollarSign size={20} className="text-warning me-2" />
                                        <div>
                                            <small className="text-muted d-block">رصيد المصروفات</small>
                                            <strong className="d-block">{formatCurrency(totalExpenseAccounts)}</strong>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                        <Col xs={6}>
                            <Card className="border-0 bg-info bg-opacity-10">
                                <Card.Body className="py-2">
                                    <div className="d-flex align-items-center">
                                        <Banknote size={20} className="text-info me-2" />
                                        <div>
                                            <small className="text-muted d-block">حقوق الملكية</small>
                                            <strong className="d-block">{formatCurrency(totalEquity)}</strong>
                                        </div>
                                    </div>
                                </Card.Body>
                            </Card>
                        </Col>
                    </Row>

                    <div className="d-flex mb-3 overflow-auto pb-2">
                        {[
                            { key: 'accounts', label: 'الحسابات', icon: <Banknote size={16} />, count: accounts.length },
                            { key: 'expenses', label: 'المصروفات', icon: <TrendingDown size={16} />, count: expenses.length }
                        ].map(tab => (
                            <Button
                                key={tab.key}
                                variant={activeTab === tab.key ? 'primary' : 'outline-primary'}
                                size="sm"
                                className="me-2 flex-shrink-0 d-flex align-items-center"
                                onClick={() => setActiveTab(tab.key)}
                                style={{ minHeight: '44px' }}
                            >
                                {tab.icon}
                                <span className="mx-2">{tab.label}</span>
                                <Badge bg="light" text="dark">
                                    {tab.count}
                                </Badge>
                            </Button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="text-center py-4">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-2">جاري التحميل...</p>
                        </div>
                    ) : activeTab === 'accounts' ? (
                        <div>
                            <div className="mb-3">
                                <InputGroup>
                                    <InputGroup.Text>
                                        <Search size={16} />
                                    </InputGroup.Text>
                                    <Form.Control
                                        placeholder="بحث في الحسابات..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        style={{ fontSize: '16px' }}
                                    />
                                </InputGroup>
                            </div>

                            {filteredAccounts.length === 0 ? (
                                <div className="text-center py-4">
                                    <Banknote size={48} className="text-muted mb-3" />
                                    <h6 className="text-muted">لا توجد حسابات</h6>
                                    <p className="text-muted small">لم يتم العثور على حسابات تطابق البحث</p>
                                </div>
                            ) : (
                                <Accordion>
                                    {filteredAccounts.map((acc, index) => (
                                        <Accordion.Item key={acc.id} eventKey={index.toString()}>
                                            <Accordion.Header>
                                                <div className="d-flex align-items-center w-100">
                                                    <div className="flex-grow-1">
                                                        <div className="d-flex justify-content-between align-items-start mb-1">
                                                            <strong className="me-2">{acc.name}</strong>
                                                            <Badge bg={
                                                                acc.account_type === 'ASSET' ? 'success' :
                                                                acc.account_type === 'LIABILITY' ? 'warning' :
                                                                acc.account_type === 'EQUITY' ? 'info' : 'danger'
                                                            }>
                                                                {acc.account_type}
                                                            </Badge>
                                                        </div>
                                                        <div className="d-flex">
                                                            <small className="text-muted me-3">
                                                                # {acc.account_number}
                                                            </small>
                                                            <small className="fw-bold">
                                                                {formatCurrency(acc.balance)}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Accordion.Header>
                                            <Accordion.Body>
                                                <ListGroup variant="flush">
                                                    <ListGroup.Item className="border-0 px-0 pb-2">
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span className="text-muted">رقم الحساب:</span>
                                                            <strong>#{acc.account_number}</strong>
                                                        </div>
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span className="text-muted">نوع الحساب:</span>
                                                            <strong>{acc.account_type}</strong>
                                                        </div>
                                                        <div className="d-flex justify-content-between mb-1">
                                                            <span className="text-muted">الرصيد:</span>
                                                            <strong className={
                                                                parseFloat(acc.balance || 0) >= 0 ? 'text-success' : 'text-danger'
                                                            }>
                                                                {formatCurrency(acc.balance)}
                                                            </strong>
                                                        </div>
                                                    </ListGroup.Item>
                                                </ListGroup>
                                            </Accordion.Body>
                                        </Accordion.Item>
                                    ))}
                                </Accordion>
                            )}
                        </div>
                    ) : (
                        <div>
                            {!isViewOnly && (
                                <div className="mb-3">
                                    <Button
                                        variant="primary"
                                        className="w-100 mb-2"
                                        onClick={() => setShowModal(true)}
                                        style={{ minHeight: '44px' }}
                                    >
                                        <PlusCircle size={18} className="me-2" />
                                        {needsApproval ? 'طلب مصروف جديد' : 'تسجيل مصروف جديد'}
                                    </Button>
                                </div>
                            )}

                            {filteredExpenses.length === 0 ? (
                                <div className="text-center py-4">
                                    <TrendingDown size={48} className="text-muted mb-3" />
                                    <h6 className="text-muted">لا توجد مصروفات</h6>
                                    <p className="text-muted small">لم يتم تسجيل أي مصروفات بعد</p>
                                </div>
                            ) : (
                                <div>
                                    {filteredExpenses.map(exp => (
                                        <Card key={exp.id} className="mb-3 border-0 shadow-sm">
                                            <Card.Body>
                                                <div className="d-flex justify-content-between align-items-start mb-2">
                                                    <div>
                                                        <h6 className="mb-1">{exp.description}</h6>
                                                        <small className="text-muted">
                                                            <Calendar size={12} className="me-1" />
                                                            {exp.date}
                                                        </small>
                                                    </div>
                                                    <Badge bg="danger" className="fs-6">
                                                        {formatCurrency(exp.amount)}
                                                    </Badge>
                                                </div>

                                                <div className="row small">
                                                    <div className="col-6">
                                                        <div className="text-muted">حساب المصروف:</div>
                                                        <div className="fw-bold">
                                                            {exp.expense_account_details?.name}
                                                        </div>
                                                    </div>
                                                    <div className="col-6">
                                                        <div className="text-muted">حساب الدفع:</div>
                                                        <div className="fw-bold">
                                                            {exp.payment_account_details?.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </Card.Body>
            </Card>
        </div>
    );

    return (
        <div className="container-fluid py-3">
            <div className="mb-4">
                <h1 className="mb-1 text-center">إدارة المحاسبة</h1>
                <p className="text-center text-muted mb-0">إدارة الحسابات والمصروفات المالية</p>
            </div>

            {isMobile ? <MobileView /> : <DesktopView />}

            <ExpenseForm
                show={showModal}
                handleClose={() => setShowModal(false)}
                onSave={fetchData}
                accounts={accounts}
            />

            <style>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                .spin {
                    animation: spin 1s linear infinite;
                }

                @media (max-width: 768px) {
                    .container-fluid {
                        padding-left: 10px;
                        padding-right: 10px;
                    }

                    .accordion-button {
                        min-height: 70px;
                        padding: 12px;
                    }
                }

                button, .btn, .accordion-button {
                    min-height: 44px;
                }

                .table-responsive {
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }

                @media (min-width: 769px) {
                    .card {
                        transition: transform 0.2s ease;
                    }

                    .card:hover {
                        transform: translateY(-2px);
                    }

                    tr:hover {
                        background-color: rgba(0, 0, 0, 0.02);
                    }
                }

                @media (max-width: 576px) {
                    .form-control, .form-select {
                        font-size: 16px !important;
                    }

                    .input-group-text {
                        min-height: 44px;
                    }
                }
            `}</style>
        </div>
    );
}

export default Accounting;
