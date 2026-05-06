import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Form, Button, Card, Row, Col, Spinner, Accordion, Nav, Container, Badge, Alert } from 'react-bootstrap';
import { useAuth } from '../hooks/useAuth';
import { Navigate } from 'react-router-dom';
import { Shield, Users, Building, UserCheck, Clock, Save, Lock, Eye, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

const MODULES_DETAILS = {
    'orders': {
        desc: 'العصب التشغيلي الأكبر. تُعطى لمسؤولي المبيعات، الكاشير، ومديري التشغيل والخدمات اللوجستية.',
        pages: [
            { path: '/on-farm-sale', name: 'شاشة نقطة البيع (الكاشير)' },
            { path: '/orders', name: 'إدارة الطلبات (المتجر)' },
            { path: '/business-orders', name: 'طلبات الشركات والمطاعم (B2B)' },
            { path: '/sales-ledger', name: 'سجل الطلبات الشامل' },
            { path: '/dispatcher', name: 'اللوجستيات: منسق الرحلات' },
            { path: '/fleet', name: 'اللوجستيات: إدارة أسطول السيارات' },
            { path: '/farm-prep', name: 'التجهيزات: شاشة تحضير المزرعة' },
            { path: '/butcher-screen', name: 'التجهيزات: شاشة الجزار للذبح' },
            { path: '/customer-lookup', name: 'خدمة العملاء (البحث وسجلات المكالمات)' },
            { path: '/adahi-manager', name: 'إدارة مواسم الأضاحي' },
        ]
    },
    'livestock': {
        desc: 'إدارة المنتجات الحية. تُعطى للطبيب البيطري، مدير المزرعة، ومسؤول البيانات.',
        pages: [
            { path: '/livestock', name: 'إدارة المواشي (إضافة/تعديل/حذف)' },
            { path: '/shared-purchases', name: 'إدارة مجموعات التشارك والأسهم' },
        ]
    },
    'inventory': {
        desc: 'المخازن والمشتريات. تُعطى لأمين المخزن، ومسؤول المشتريات.',
        pages: [
            { path: '/inventory', name: 'إدارة المخزون (أعلاف، أدوية، معدات)' },
            { path: '/suppliers', name: 'إدارة الموردين والمزارع الخارجية' },
            { path: '/fridge-manager', name: 'إدارة الثلاجة والتغليف' },
            { path: '/partnerships-applications', name: 'متابعة طلبات الشراكة من المطاعم' },
        ]
    },
    'hr': {
        desc: 'شؤون العاملين. تُعطى لمدير الموارد البشرية HR أو المحاسب الإداري.',
        pages: [
            { path: '/employees', name: 'قائمة الموظفين (إضافة وتعديل)' },
            { path: '/payrolls', name: 'مسيرات الرواتب والسلف' },
            { path: '/daily-attendance', name: 'سجل الحضور والانصراف اليومي' },
            { path: '/careers-manager', name: 'إدارة التوظيف وطلبات الـ CVs' },
        ]
    },
    'accounting': {
        desc: 'الأموال والخزن. تُعطى للمحاسب المالي أو المدير المالي.',
        pages: [
            { path: '/accounting', name: 'تسجيل المصروفات وإدارة الأصول' },
            { path: '/journal-entries', name: 'قيود اليومية' },
            { path: '/reports', name: 'التقارير المالية والإحصائيات' },
        ]
    },
    'settings': {
        desc: 'أخطر وحدة في السيستم (لا تُعطى إلا لمدير النظام أو الإدارة العليا).',
        pages: [
            { path: '/settings', name: 'إعدادات النظام العامة (أسعار، مواسم)' },
            { path: '/document-archive', name: 'أرشيف الوثائق والعقود' },
            { path: '/sms-manager', name: 'مدير الإشعارات و الـ SMS' },
            { path: '/permissions-manager', name: 'إدارة الصلاحيات والأمان' },
        ]
    }
};

const PermissionsManager = () => {
    const { user } = useAuth();
    const [roles, setRoles] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [systemModules, setSystemModules] = useState([]);

    const [editType, setEditType] = useState('department');
    const [selectedId, setSelectedId] = useState('');

    const [permissionsState, setPermissionsState] = useState({});
    const [excludedPagesState, setExcludedPagesState] = useState({});
    const [approvalRouting, setApprovalRouting] = useState({});

    const [shiftStart, setShiftStart] = useState('');
    const [shiftEnd, setShiftEnd] = useState('');
    const [sessionDuration, setSessionDuration] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 992);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [
                rolesRes, deptsRes, empsRes,
                modulesRes, routingRes
            ] = await Promise.all([
                axios.get('/management/roles/?page_size=1000'),
                axios.get('/management/departments/?page_size=1000'),
                axios.get('/management/employees/?page_size=1000'),
                axios.get('/management/system-modules/'),
                axios.get('/management/approval-routing/')
            ]);
            setRoles(rolesRes.data.results || rolesRes.data || []);
            setDepartments(deptsRes.data.results || deptsRes.data || []);
            setEmployees(empsRes.data.results || empsRes.data || []);
            setSystemModules(modulesRes.data || []);

            const routingMap = {};
            routingRes.data.forEach(r => routingMap[r.module_name] = r.designated_approver);
            setApprovalRouting(routingMap);
        } catch {
            toast.error("فشل تحميل البيانات الأساسية.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user?.is_superuser) {
            fetchData();
        }
    }, [fetchData, user]);

    useEffect(() => {
        if (!selectedId) return;

        const fetchPermissions = async () => {
            try {
                const res = await axios.get(`/management/access-rules/bulk_update/?target_type=${editType}&target_id=${selectedId}`);
                const stateMap = {};
                const excludedMap = {};

                res.data.forEach(p => {
                    stateMap[p.module_name] = {
                        view: p.actions?.view || false,
                        add: p.actions?.add || 'deny',
                        edit: p.actions?.edit || 'deny',
                        delete: p.actions?.delete || 'deny'
                    };
                    excludedMap[p.module_name] = p.excluded_pages || [];
                });

                setPermissionsState(stateMap);
                setExcludedPagesState(excludedMap);
            } catch {
                setPermissionsState({});
                setExcludedPagesState({});
            }
        };

        fetchPermissions();

        let target;
        if (editType === 'role') target = roles.find(r => r.id === parseInt(selectedId));
        else if (editType === 'department') target = departments.find(d => d.id === parseInt(selectedId));
        else if (editType === 'employee') target = employees.find(e => e.id === parseInt(selectedId));

        if (target) {
            setShiftStart(target.shift_start || '');
            setShiftEnd(target.shift_end || '');
            setSessionDuration(target.session_duration || '');
        } else {
            setShiftStart('');
            setShiftEnd('');
            setSessionDuration('');
        }
    }, [selectedId, editType, roles, departments, employees]);

    const handleActionChange = (moduleName, actionKey, value) => {
        setPermissionsState(prev => {
            const currentMod = prev[moduleName] || { view: false, add: 'deny', edit: 'deny', delete: 'deny' };
            return {
                ...prev,
                [moduleName]: { ...currentMod, [actionKey]: value }
            };
        });
    };

    const handleExcludedPageToggle = (moduleName, pagePath) => {
        setExcludedPagesState(prev => {
            const currentExcluded = prev[moduleName] || [];
            let newExcluded;
            if (currentExcluded.includes(pagePath)) {
                newExcluded = currentExcluded.filter(p => p !== pagePath);
            } else {
                newExcluded = [...currentExcluded, pagePath];
            }
            return { ...prev, [moduleName]: newExcluded };
        });
    };

    const handleApprovalRoutingChange = (moduleName, approverId) => {
        setApprovalRouting(prev => ({ ...prev, [moduleName]: approverId }));
    };

    const handleSavePermissions = async () => {
        if (!selectedId) {
            toast.warn("الرجاء اختيار عنصر للتعديل.");
            return;
        }
        setSaving(true);
        try {
            const payload = {
                target_type: editType,
                target_id: selectedId,
                rules: permissionsState,
                excluded_pages: excludedPagesState
            };
            await axios.post('/management/access-rules/bulk_update/', payload);
            toast.success("تم تحديث الصلاحيات بنجاح!");
        } catch {
            toast.error("فشل حفظ الصلاحيات.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveSecuritySettings = async () => {
        if (!selectedId) return;
        setSaving(true);
        let url = '';
        const payload = {
            shift_start: shiftStart || null,
            shift_end: shiftEnd || null,
            session_duration: sessionDuration || 0
        };
        if (editType === 'role') url = `/management/roles/${selectedId}/`;
        else if (editType === 'department') url = `/management/departments/${selectedId}/`;
        else if (editType === 'employee') url = `/management/employees/${selectedId}/`;

        try {
            await axios.patch(url, payload);
            toast.success("تم حفظ إعدادات الأمان.");
        } catch {
            toast.error("فشل حفظ إعدادات الأمان.");
        } finally {
            setSaving(false);
        }
    };

    const handleSaveRouting = async (moduleName) => {
        try {
            await axios.post('/management/approval-routing/set/', {
                module_name: moduleName,
                designated_approver: approvalRouting[moduleName] || null
            });
            toast.success("تم تعيين المسؤول بنجاح!");
        } catch {
            toast.error("فشل تعيين المسؤول.");
        }
    };

    const renderSelector = () => {
        const getRoleDisplayName = (r) => {
            const deptName = departments.find(d => d.id === r.department)?.name || 'بدون قسم';
            return `${r.name} (${deptName})`;
        };

        const getEmployeeDisplayName = (e) => {
            const rName = e.role_name || 'موظف';
            const dName = e.department_name || 'بدون قسم';
            return `${e.full_name} (${rName} - ${dName})`;
        };

        const options = {
            department: { data: departments, label: 'القسم', icon: <Building size={16} />, format: d => d.name },
            role: { data: roles, label: 'الدور الوظيفي', icon: <UserCheck size={16} />, format: getRoleDisplayName },
            employee: { data: employees, label: 'الموظف محدد', icon: <Users size={16} />, format: getEmployeeDisplayName }
        };

        const currentOption = options[editType];
        return (
            <Form.Group>
                <Form.Label className="d-flex align-items-center gap-2 mb-2 fw-bold text-primary">
                    {currentOption.icon}
                    <span>اختر {currentOption.label}</span>
                </Form.Label>
                <Form.Select
                    value={selectedId}
                    onChange={e => setSelectedId(e.target.value)}
                    size="lg"
                    className="shadow-sm"
                >
                    <option value="">-- اختر {currentOption.label} --</option>
                    {currentOption.data.map(item => (
                        <option key={item.id} value={item.id}>
                            {currentOption.format(item)}
                        </option>
                    ))}
                </Form.Select>
            </Form.Group>
        );
    };

    const renderPermissionGrid = (moduleName) => {
        const currentActions = permissionsState[moduleName] || { view: false, add: 'deny', edit: 'deny', delete: 'deny' };

        const renderRadioGroup = (actionKey, label) => (
            <div className="d-flex align-items-center justify-content-between p-2 border-bottom">
                <span className="fw-bold text-dark">{label}</span>
                <div className="btn-group" role="group">
                    <Button
                        variant={currentActions[actionKey] === 'allow' ? 'success' : 'outline-success'}
                        size="sm"
                        onClick={() => handleActionChange(moduleName, actionKey, 'allow')}
                    >مسموح</Button>
                    <Button
                        variant={currentActions[actionKey] === 'approval' ? 'warning' : 'outline-warning'}
                        size="sm"
                        onClick={() => handleActionChange(moduleName, actionKey, 'approval')}
                        className="text-dark"
                    >بموافقة</Button>
                    <Button
                        variant={currentActions[actionKey] === 'deny' ? 'danger' : 'outline-danger'}
                        size="sm"
                        onClick={() => handleActionChange(moduleName, actionKey, 'deny')}
                    >ممنوع</Button>
                </div>
            </div>
        );

        return (
            <div className="bg-white p-3 rounded-4 border shadow-sm">
                <div className="d-flex align-items-center justify-content-between p-2 border-bottom bg-light rounded-top">
                    <span className="fw-bold text-primary"><Eye size={18} className="me-1"/> رؤية الوحدة (الدخول للشاشة)</span>
                    <Form.Check
                        type="switch"
                        checked={currentActions.view || false}
                        onChange={(e) => handleActionChange(moduleName, 'view', e.target.checked)}
                    />
                </div>

                {currentActions.view && (
                    <div className="mt-2 animate-fade-in">
                        {renderRadioGroup('add', 'إضافة / إنشاء جديد')}
                        {renderRadioGroup('edit', 'تعديل البيانات')}
                        {renderRadioGroup('delete', 'الحذف')}
                    </div>
                )}
            </div>
        );
    };

    if (!user?.is_superuser) return <Navigate to="/" />;

    if (loading) return (
        <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <div className="mt-3 fw-bold text-muted">جاري تحميل بيانات الأمان والصلاحيات...</div>
        </div>
    );

    const selectedItem = selectedId ?
        (editType === 'role' ? roles.find(r => r.id === parseInt(selectedId)) :
         editType === 'department' ? departments.find(d => d.id === parseInt(selectedId)) :
         employees.find(e => e.id === parseInt(selectedId))) : null;

    return (
        <Container fluid className={`permissions-container ${isMobile ? 'px-2' : 'px-3'} py-3`}>
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-4">
                <div className="d-flex align-items-center gap-3">
                    <div className="bg-primary bg-opacity-10 p-3 rounded-xl border border-primary border-opacity-25">
                        <Shield size={28} className="text-primary" />
                    </div>
                    <div>
                        <h1 className={`${isMobile ? 'h4' : 'h3'} mb-1 fw-bold text-dark`}>التحكم الدقيق بالصلاحيات</h1>
                        <p className="text-muted mb-0 small">تخصيص الوصول للصفحات وإعدادات الأمان وتوجيه الموافقات</p>
                    </div>
                </div>
                {selectedItem && (
                    <Badge bg="primary" className="p-2 fs-6">
                        {editType === 'role' ? 'الدور: ' : editType === 'department' ? 'القسم: ' : 'الموظف: '}
                        {selectedItem.name || selectedItem.full_name}
                    </Badge>
                )}
            </div>

            <Row>
                <Col lg={8}>
                    <Card className="shadow-sm border-0 mb-4 rounded-4">
                        <Card.Body className="p-3 p-md-4">
                            <Nav variant="pills" activeKey={editType} onSelect={(k) => { setEditType(k); setSelectedId(''); }} className="mb-4 d-flex bg-light p-1 rounded-3">
                                <Nav.Item className="flex-fill text-center">
                                    <Nav.Link eventKey="department" className="fw-bold d-flex align-items-center justify-content-center gap-2 py-2 rounded-3">
                                        <Building size={18} /> {isMobile ? 'أقسام' : '1. إعدادات الأقسام'}
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item className="flex-fill text-center">
                                    <Nav.Link eventKey="role" className="fw-bold d-flex align-items-center justify-content-center gap-2 py-2 rounded-3">
                                        <UserCheck size={18} /> {isMobile ? 'أدوار' : '2. إعدادات الأدوار الوظيفية'}
                                    </Nav.Link>
                                </Nav.Item>
                                <Nav.Item className="flex-fill text-center">
                                    <Nav.Link eventKey="employee" className="fw-bold d-flex align-items-center justify-content-center gap-2 py-2 rounded-3">
                                        <Users size={18} /> {isMobile ? 'أفراد' : '3. استثناء موظف محدد'}
                                    </Nav.Link>
                                </Nav.Item>
                            </Nav>

                            <Row className="mb-4">
                                <Col md={8} lg={6}>
                                    {renderSelector()}
                                </Col>
                            </Row>

                            {selectedId && (
                                <div className="animate-fade-in-up">
                                    <div className="mb-5">
                                        <h5 className="mb-3 text-primary fw-bold d-flex align-items-center gap-2 border-bottom pb-2">
                                            <Clock size={20} /> أوقات الدخول وساعات العمل
                                        </h5>
                                        <div className="bg-light p-4 rounded-4 border border-light">
                                            <Row className="g-3">
                                                <Col xs={12} md={4}>
                                                    <Form.Group>
                                                        <Form.Label className="fw-bold small text-muted">وقت بدء الوردية</Form.Label>
                                                        <Form.Control type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} size="lg" className="border-0 shadow-sm" />
                                                    </Form.Group>
                                                </Col>
                                                <Col xs={12} md={4}>
                                                    <Form.Group>
                                                        <Form.Label className="fw-bold small text-muted">وقت نهاية الوردية</Form.Label>
                                                        <Form.Control type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} size="lg" className="border-0 shadow-sm" />
                                                    </Form.Group>
                                                </Col>
                                                <Col xs={12} md={4}>
                                                    <Form.Group>
                                                        <Form.Label className="fw-bold small text-muted">مدة الجلسة (ساعات)</Form.Label>
                                                        <Form.Control type="number" value={sessionDuration} onChange={(e) => setSessionDuration(e.target.value)} placeholder="0 للوراثة" size="lg" className="border-0 shadow-sm" />
                                                    </Form.Group>
                                                </Col>
                                            </Row>
                                            <Button onClick={handleSaveSecuritySettings} variant="primary" className="mt-3 fw-bold" disabled={saving}>
                                                حفظ إعدادات الوقت
                                            </Button>
                                        </div>
                                    </div>

                                    <div>
                                        <h5 className="mb-3 text-primary fw-bold d-flex align-items-center gap-2 border-bottom pb-2">
                                            <Lock size={20} /> تخصيص صلاحيات الوحدات والصفحات
                                        </h5>

                                        <Alert variant="warning" className="small d-flex align-items-start gap-2 border-warning border-opacity-50">
                                            <Info size={20} className="shrink-0 mt-1" />
                                            <div>
                                                <strong>الداشبورد والشات أساسيان:</strong> لوحة التحكم الرئيسية والمحادثات تظهران لجميع الموظفين بشكل افتراضي.<br/>
                                                لتخصيص الوصول، حدد أولاً مستوى الوصول للوحدة، ثم يمكنك اختيار <strong>إخفاء بعض الصفحات المحددة</strong> بداخلها.
                                            </div>
                                        </Alert>

                                        {isMobile ? (
                                            <div className="mobile-permissions-view">
                                                {systemModules.map((mod) => {
                                                    const details = MODULES_DETAILS[mod.id] || { desc: '', pages: [] };
                                                    const currentActions = permissionsState[mod.id] || { view: false, add: 'deny', edit: 'deny', delete: 'deny' };
                                                    const excludedPages = excludedPagesState[mod.id] || [];

                                                    return (
                                                        <Card key={mod.id} className="mb-3 border-0 shadow-sm rounded-4 overflow-hidden">
                                                            <Card.Header className="bg-light d-flex justify-content-between align-items-center py-3">
                                                                <span className="fw-black text-dark fs-6">{mod.name}</span>
                                                                <Badge bg={currentActions.view ? 'success' : 'danger'}>
                                                                    {currentActions.view ? 'مسموح بالرؤية' : 'ممنوع'}
                                                                </Badge>
                                                            </Card.Header>
                                                            <Card.Body className="p-3">
                                                                <p className="text-muted small mb-3">{details.desc}</p>
                                                                {renderPermissionGrid(mod.id)}

                                                                {currentActions.view && details.pages.length > 0 && (
                                                                    <div className="bg-white p-3 rounded-3 border mt-3">
                                                                        <h6 className="fw-bold text-danger mb-3 d-flex align-items-center gap-2 small">
                                                                            <XCircle size={16} /> إخفاء صفحات معينة (اختياري)
                                                                        </h6>
                                                                        <div className="d-flex flex-column gap-2">
                                                                            {details.pages.map(page => (
                                                                                <div key={page.path} className={`p-2 rounded border transition-colors ${excludedPages.includes(page.path) ? 'bg-danger bg-opacity-10 border-danger' : 'bg-light border-light'}`}>
                                                                                    <Form.Check
                                                                                        type="checkbox"
                                                                                        id={`mobile-${mod.id}-${page.path}`}
                                                                                        label={<span className={`small ${excludedPages.includes(page.path) ? 'text-danger fw-bold text-decoration-line-through opacity-75' : 'text-dark'}`}>{page.name}</span>}
                                                                                        checked={excludedPages.includes(page.path)}
                                                                                        onChange={() => handleExcludedPageToggle(mod.id, page.path)}
                                                                                    />
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Card.Body>
                                                        </Card>
                                                    );
                                                })}
                                            </div>
                                        ) : (
                                            <Accordion alwaysOpen className="custom-accordion shadow-sm">
                                                {systemModules.map(mod => {
                                                    const details = MODULES_DETAILS[mod.id] || { desc: '', pages: [] };
                                                    const currentActions = permissionsState[mod.id] || { view: false, add: 'deny', edit: 'deny', delete: 'deny' };
                                                    const excludedPages = excludedPagesState[mod.id] || [];

                                                    return (
                                                        <Accordion.Item key={mod.id} eventKey={mod.id} className="border-0 border-bottom">
                                                            <Accordion.Header>
                                                                <div className="d-flex justify-content-between align-items-center w-100 pe-3">
                                                                    <div>
                                                                        <span className="fw-black text-dark fs-6 d-block mb-1">{mod.name}</span>
                                                                        <small className="text-muted fw-normal">{details.desc}</small>
                                                                    </div>
                                                                    <Badge bg={currentActions.view ? 'success' : 'danger'} className="ms-3 p-2">
                                                                        {currentActions.view ? 'مسموح بالرؤية' : 'ممنوع'}
                                                                    </Badge>
                                                                </div>
                                                            </Accordion.Header>
                                                            <Accordion.Body className="bg-light pt-4 pb-4">
                                                                <div className="mb-4">
                                                                    <h6 className="fw-bold text-dark mb-3">1. حدد مستوى التحكم في العمليات داخل الوحدة:</h6>
                                                                    {renderPermissionGrid(mod.id)}
                                                                </div>

                                                                {currentActions.view && details.pages.length > 0 && (
                                                                    <div className="bg-white p-3 rounded-4 border">
                                                                        <h6 className="fw-bold text-danger mb-3 d-flex align-items-center gap-2">
                                                                            <XCircle size={18} /> 2. إخفاء صفحات معينة من هذه الوحدة (اختياري)
                                                                        </h6>
                                                                        <Row className="g-2">
                                                                            {details.pages.map(page => (
                                                                                <Col xs={12} md={6} key={page.path}>
                                                                                    <div className={`p-2 rounded border transition-colors ${excludedPages.includes(page.path) ? 'bg-danger bg-opacity-10 border-danger' : 'bg-light border-light hover-bg-light'}`}>
                                                                                        <Form.Check
                                                                                            type="checkbox"
                                                                                            id={`desktop-${mod.id}-${page.path}`}
                                                                                            label={<span className={excludedPages.includes(page.path) ? 'text-danger fw-bold text-decoration-line-through opacity-75' : 'text-dark'}>{page.name}</span>}
                                                                                            checked={excludedPages.includes(page.path)}
                                                                                            onChange={() => handleExcludedPageToggle(mod.id, page.path)}
                                                                                        />
                                                                                    </div>
                                                                                </Col>
                                                                            ))}
                                                                        </Row>
                                                                    </div>
                                                                )}
                                                            </Accordion.Body>
                                                        </Accordion.Item>
                                                    );
                                                })}
                                            </Accordion>
                                        )}

                                        {selectedId && (
                                            <div className="bg-success bg-opacity-10 p-4 rounded-4 border border-success mb-4 mt-4 animate-fade-in-up">
                                                <h5 className="fw-bold text-success mb-3 d-flex align-items-center gap-2">
                                                    <CheckCircle size={22} /> ملخص الصفحات التي ستظهر لهذا {editType === 'role' ? 'الدور' : editType === 'department' ? 'القسم' : 'الموظف'}:
                                                </h5>

                                                {(() => {
                                                    const visibleItems = [];
                                                    systemModules.forEach(mod => {
                                                        const actions = permissionsState[mod.id] || { view: false, add: 'deny', edit: 'deny', delete: 'deny' };
                                                        if (actions.view) {
                                                            const details = MODULES_DETAILS[mod.id];
                                                            const excluded = excludedPagesState[mod.id] || [];
                                                            const visiblePages = details?.pages.filter(p => !excluded.includes(p.path)) || [];

                                                            if (visiblePages.length > 0) {
                                                                visibleItems.push({ moduleName: mod.name, actions, pages: visiblePages });
                                                            }
                                                        }
                                                    });

                                                    if (visibleItems.length === 0) {
                                                        return <p className="text-muted mb-0 fw-bold">لن يظهر له أي صفحات (الصلاحيات مسحوبة بالكامل).</p>;
                                                    }

                                                    return (
                                                        <Row className="g-3">
                                                            {visibleItems.map((item, idx) => (
                                                                <Col md={6} lg={4} key={idx}>
                                                                    <div className="bg-white p-3 rounded shadow-sm border border-success h-100">
                                                                        <h6 className="fw-bold text-dark border-bottom pb-2 mb-2 d-flex justify-content-between align-items-center">
                                                                            {item.moduleName}
                                                                            <Badge bg="success" className="ms-2">مسموح بالرؤية</Badge>
                                                                        </h6>
                                                                        <ul className="mb-0 ps-3 small text-secondary">
                                                                            {item.pages.map((p, i) => (
                                                                                <li key={i} className="mb-1 fw-medium">{p.name}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                </Col>
                                                            ))}
                                                        </Row>
                                                    );
                                                })()}
                                            </div>
                                        )}

                                        <div className="mt-4 pt-3 border-top sticky-bottom bg-white" style={{ zIndex: 100 }}>
                                            <Button onClick={handleSavePermissions} disabled={saving} variant="success" size="lg" className="w-100 fw-bold shadow-lg d-flex align-items-center justify-content-center gap-2">
                                                {saving ? <><Spinner size="sm" /> جاري حفظ الصلاحيات...</> : <><Save size={20} /> اعتماد وحفظ كافة الصلاحيات المحددة</>}
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {!selectedId && (
                                <div className="text-center py-5 text-muted bg-light rounded-4 border border-dashed mt-4">
                                    <Shield size={64} className="mb-3 opacity-50" />
                                    <h4 className="fw-bold">لم يتم اختيار أي عنصر</h4>
                                    <p className="mb-0">حدد قسماً أو دوراً وظيفياً من القائمة العلوية للبدء في تخصيص الصلاحيات الخاصة به.</p>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={4}>
                    <Card className="shadow-sm border-0 bg-warning bg-opacity-10 border-top border-warning border-4 rounded-4 sticky-top" style={{ top: '80px' }}>
                        <Card.Body className="p-4">
                            <h5 className="fw-bold text-dark d-flex align-items-center gap-2 mb-3">
                                <CheckCircle size={20} className="text-warning-emphasis" /> توجيه طلبات الموافقات
                            </h5>
                            <p className="text-muted small mb-4">
                                عندما يحاول موظف إجراء تعديل في وحدة ليس له عليها تحكم كامل، لمن يذهب هذا الطلب للموافقة؟
                                <br/><br/>
                                <strong className="text-dark">إذا تركته فارغاً:</strong> ستذهب الطلبات للمدير العام فقط (Superuser).
                            </p>

                            {systemModules.map(mod => (
                                <Form.Group key={mod.id} className="mb-3 bg-white p-3 rounded-3 border shadow-sm">
                                    <Form.Label className="fw-bold text-primary mb-2 d-block">{mod.name}</Form.Label>
                                    <Form.Select
                                        value={approvalRouting[mod.id] || ''}
                                        onChange={e => handleApprovalRoutingChange(mod.id, e.target.value)}
                                        onBlur={() => handleSaveRouting(mod.id)}
                                        className="border-0 bg-light fw-bold"
                                    >
                                        <option value="">-- يذهب للمدير العام فقط --</option>
                                        {employees.map(e => (
                                            <option key={e.id} value={e.id}>{e.full_name} ({e.role_name})</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            ))}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <style>{`
                .permissions-container { max-width: 100%; overflow-x: hidden; }
                .hover-bg-light:hover { background-color: #e9ecef; }

                .custom-accordion .accordion-button {
                    padding: 1.5rem 1rem;
                    background-color: transparent;
                    box-shadow: none !important;
                }
                .custom-accordion .accordion-button:not(.collapsed) {
                    background-color: #f8f9fa;
                    color: inherit;
                }
                .custom-accordion .accordion-button:focus {
                    border-color: transparent;
                }

                @media (max-width: 992px) {
                    .mobile-permissions-view { max-height: 60vh; overflow-y: auto; }
                    .mobile-permissions-view::-webkit-scrollbar { width: 4px; }
                    .mobile-permissions-view::-webkit-scrollbar-track { background: #f1f1f1; }
                    .mobile-permissions-view::-webkit-scrollbar-thumb { background: #888; border-radius: 2px; }
                    .btn { min-height: 44px; }
                    .form-select { min-height: 48px; }
                    .custom-accordion .accordion-button { padding: 1rem; }
                }
            `}</style>
        </Container>
    );
};

export default PermissionsManager;
