import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Modal, Button, Form, Table, Badge, Row, Col, Image, InputGroup, Card, Accordion } from 'react-bootstrap';
import { PlusCircle, Edit, Trash2, Eye, EyeOff, DollarSign, UserCheck, UserX, Key, Phone, MapPin, Building, User, Shield, FileText, UploadCloud, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { checkPasswordStrength } from '../utils/validators';
import logAction from '../utils/auditLogger';
import { useAuth } from '../hooks/useAuth';
import { useHasPermission } from '../hooks/useHasPermission';
import PrintModal from '../components/ui/PrintModal';

const DeactivationModal = ({ show, handleClose, onConfirm, employeeName }) => {
    const [reason, setReason] = useState('');
    const [loading, setLoading] = useState(false);

    const handleConfirm = async () => {
        if (!reason.trim()) {
            toast.warn("يرجى إدخال سبب إلغاء التفعيل.");
            return;
        }
        setLoading(true);
        await onConfirm(reason);
        setLoading(false);
    };

    useEffect(() => {
        if (!show) {
            setReason('');
        }
    }, [show]);

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton className="bg-warning text-dark">
                <Modal.Title>
                    <UserX size={24} className="me-2" />
                    إلغاء تفعيل حساب: {employeeName}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="alert alert-warning mb-3">
                    <strong>تنبيه:</strong> هل أنت متأكد من إلغاء تفعيل هذا الحساب؟
                </div>
                <Form.Group>
                    <Form.Label className="fw-bold">سبب الإلغاء</Form.Label>
                    <Form.Text className="d-block text-muted mb-2">
                        (سيظهر للموظف عند محاولة الدخول)
                    </Form.Text>
                    <Form.Control
                        as="textarea"
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="مثال: انتهاء العقد، مخالفة إدارية..."
                        required
                        className="form-control-lg"
                    />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" onClick={handleClose} size="lg">
                    إلغاء
                </Button>
                <Button variant="warning" onClick={handleConfirm} disabled={loading} size="lg">
                    {loading ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            جاري الإلغاء...
                        </>
                    ) : 'تأكيد إلغاء التفعيل'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const translateTimeAgo = (englishTime) => {
    if (!englishTime) return '';

    return englishTime
        .replace('hours', 'ساعة')
        .replace('hour', 'ساعة')
        .replace('minutes', 'دقيقة')
        .replace('minute', 'دقيقة')
        .replace('seconds', 'ثانية')
        .replace('second', 'ثانية')
        .replace('days', 'يوم')
        .replace('day', 'يوم')
        .replace('weeks', 'أسبوع')
        .replace('week', 'أسبوع')
        .replace('months', 'شهر')
        .replace('month', 'شهر')
        .replace('years', 'سنة')
        .replace('year', 'سنة')
        .replace('ago', 'منذ')
        .replace('about', 'حوالي')
        .replace('less than', 'أقل من')
        .replace('almost', 'تقريباً')
        .replace('over', 'أكثر من')
        .replace(',', '،');
};

const EmployeeForm = ({ show, handleClose, onSave, employeeToEdit, onDeactivateClick, onActivateClick }) => {
    const [formData, setFormData] = useState({});
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    const [saving, setSaving] = useState(false);
    const [tempNationalIdImage, setTempNationalIdImage] = useState(null);

    const [newPassword, setNewPassword] = useState('');
    const [passwordStrength, setPasswordStrength] = useState({ text: '', color: '' });
    const [showPassword, setShowPassword] = useState(false);
    const [passwordSaving, setPasswordSaving] = useState(false);

    const [currentDetails, setCurrentDetails] = useState(employeeToEdit);
    const [activeAccordion, setActiveAccordion] = useState('basic-info');
    const { user } = useAuth();

    const [uploadTitle, setUploadTitle] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [isUploadingDoc, setIsUploadingDoc] = useState(false);

    useEffect(() => {
        setCurrentDetails(employeeToEdit);
    }, [employeeToEdit]);

    useEffect(() => {
        const fetchRolesForDepartment = async (departmentId) => {
            if (!departmentId) { setRoles([]); return; }
            try {
                const roleRes = await axios.get(`/management/roles/?department=${departmentId}`);
                setRoles(roleRes.data.results || roleRes.data);
            } catch { toast.error("فشل تحميل الأدوار لهذا القسم."); }
        };
        if (formData.department) { fetchRolesForDepartment(formData.department); }
    }, [formData.department]);

    useEffect(() => {
        const defaults = {
            full_name: '', phone: '', password: '', department: '', role: '',
            hire_date: new Date().toISOString().split('T')[0], is_active: true, base_salary: '0.00',
            national_id: '', address: ''
        };
        if (employeeToEdit) {
            setFormData({ ...defaults, ...employeeToEdit });
        } else {
            setFormData(defaults);
        }
        setTempNationalIdImage(null);
        setNewPassword('');
        setPasswordStrength({ text: '', color: '' });
        setUploadTitle('');
        setUploadFile(null);

        if (show) {
            const fetchDepartments = async () => {
                try {
                    const deptRes = await axios.get('/management/departments/');
                    setDepartments(deptRes.data.results || deptRes.data);
                } catch { toast.error("فشل تحميل بيانات الأقسام."); }
            };
            fetchDepartments();
        }
    }, [employeeToEdit, show]);

    const handlePasswordInputChange = (e) => {
        const pass = e.target.value;
        setNewPassword(pass);
        setPasswordStrength(checkPasswordStrength(pass));
    };

    const handlePasswordChange = async () => {
        if (user.id !== employeeToEdit.id && !user.is_superuser) {
            toast.error("ليس لديك الصلاحية لتغيير كلمة مرور هذا الموظف.");
            return;
        }

        if (checkPasswordStrength(newPassword).score < 3) {
            toast.warn("الرجاء اختيار كلمة مرور أقوى.");
            return;
        }

        setPasswordSaving(true);
        try {
            const response = await axios.post(`/management/employees/${employeeToEdit.id}/change-password/`, {
                new_password: newPassword,
                notes: 'تغيير من لوحة التحكم'
            });
            toast.success("تم تغيير كلمة المرور بنجاح.");
            setNewPassword('');
            setPasswordStrength({ text: '', color: '' });

            logAction('PASSWORD_CHANGE', {
                targetUserId: employeeToEdit.id,
                changedBy: user.id
            });

            setCurrentDetails(response.data);
            onSave();
        } catch (error) {
            console.error(error);
            toast.error("فشل تغيير كلمة المرور.");
        } finally {
            setPasswordSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newFormData = { ...prev, [name]: value };
            if (name === 'department') { newFormData.role = ''; }
            return newFormData;
        });
    };

    const handleActiveToggle = (e) => {
        const isChecked = e.target.checked;
        if (isChecked) {
            onActivateClick(employeeToEdit);
        } else {
            onDeactivateClick(employeeToEdit);
        }
    };

    const handleUploadEmployeeDoc = async (e) => {
        e.preventDefault();
        if (!uploadFile || !uploadTitle) return;

        if (employeeToEdit) {
            const formData = new FormData();
            formData.append('title', uploadTitle);
            formData.append('document_type', 'employee_doc');
            formData.append('employee_file', employeeToEdit.id);
            formData.append('file', uploadFile);

            setIsUploadingDoc(true);
            try {
                await axios.post('/management/document-archive/', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                toast.success("تم أرشفة المستند بنجاح");
                setUploadTitle('');
                setUploadFile(null);
                onSave();

                setCurrentDetails(prev => ({
                    ...prev,
                    documents: [{ id: Date.now(), title: uploadTitle, file: URL.createObjectURL(uploadFile), created_at: new Date() }, ...(prev.documents || [])]
                }));
            } catch {
                toast.error("فشل الرفع");
            } finally {
                setIsUploadingDoc(false);
            }
        } else {
            setTempNationalIdImage(uploadFile);
            toast.info("سيتم رفع هذه الصورة كصورة البطاقة عند حفظ الموظف.");
            setUploadTitle('');
            setUploadFile(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        const payload = { ...formData };
        if (employeeToEdit) {
            delete payload.password;
            delete payload.national_id_image;
            delete payload.status_logs;
            delete payload.user_permissions;
            delete payload.shift_start;
            delete payload.shift_end;
            delete payload.session_duration;
            delete payload.password_changes;
            delete payload.last_password_change_ago;
            delete payload.last_password_change_formatted;
            delete payload.is_active;
            delete payload.deactivation_reason;
            delete payload.salary_changes;
        }

        const submissionData = new FormData();
        Object.keys(payload).forEach(key => {
             if (payload[key] !== null && payload[key] !== undefined) {
                submissionData.append(key, payload[key]);
            }
        });

        if (!employeeToEdit && tempNationalIdImage) {
            submissionData.append('national_id_image', tempNationalIdImage);
        }

        const method = employeeToEdit ? 'patch' : 'post';
        const url = employeeToEdit ? `/management/employees/${employeeToEdit.id}/` : '/management/employees/';

        try {
            const response = await axios({
                method: method,
                url: url,
                data: submissionData,
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data.detail && response.data.detail.includes('للموافقة')) {
                toast.info(response.data.detail);
            } else {
                toast.success(employeeToEdit ? "تم تحديث البيانات!" : "تم إنشاء الموظف!");
                if (employeeToEdit) {
                    setCurrentDetails(response.data);
                }
                onSave();
            }
            handleClose();
        } catch (error) {
            console.error("Failed to save employee:", error.response?.data);
            toast.error("فشل الحفظ. تأكد من إكمال كل الحقول المطلوبة.");
        }
        finally { setSaving(false); }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="lg" scrollable>
            <Modal.Header closeButton className={employeeToEdit ? "bg-warning text-dark" : "bg-primary text-white"}>
                <Modal.Title>
                    <User size={24} className="me-2" />
                    {employeeToEdit ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Accordion activeKey={activeAccordion} onSelect={setActiveAccordion}>
                    <Accordion.Item eventKey="basic-info">
                        <Accordion.Header>
                            <div className="d-flex align-items-center">
                                <User size={18} className="me-2" />
                                <span>المعلومات الأساسية</span>
                            </div>
                        </Accordion.Header>
                        <Accordion.Body>
                            <Row className="g-3">
                                <Col xs={12} md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">الاسم الكامل</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="full_name"
                                            value={formData.full_name || ''}
                                            onChange={handleChange}
                                            required
                                            className="form-control-lg"
                                            placeholder="أدخل الاسم الكامل"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col xs={12} md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">
                                            <Phone size={16} className="me-1" />
                                            رقم الهاتف
                                        </Form.Label>
                                        <Form.Control
                                            type="tel"
                                            name="phone"
                                            value={formData.phone || ''}
                                            onChange={handleChange}
                                            required
                                            className="form-control-lg"
                                            placeholder="أدخل رقم الهاتف"
                                        />
                                    </Form.Group>
                                </Col>

                                {!employeeToEdit && (
                                    <Col xs={12}>
                                        <Form.Group className="mb-3">
                                            <Form.Label className="fw-bold">
                                                <Key size={16} className="me-1" />
                                                كلمة المرور
                                            </Form.Label>
                                            <Form.Control
                                                type="password"
                                                name="password"
                                                onChange={handleChange}
                                                required
                                                className="form-control-lg"
                                                placeholder="أدخل كلمة المرور"
                                            />
                                        </Form.Group>
                                    </Col>
                                )}

                                <Col xs={12} md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">الرقم القومي</Form.Label>
                                        <Form.Control
                                            type="text"
                                            name="national_id"
                                            value={formData.national_id || ''}
                                            onChange={handleChange}
                                            required
                                            maxLength="14"
                                            className="form-control-lg"
                                            placeholder="14 رقم"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col xs={12} md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">تاريخ الميلاد</Form.Label>
                                        <Form.Control
                                            type="date"
                                            name="birth_date"
                                            value={formData.birth_date || ''}
                                            readOnly
                                            disabled
                                            className="form-control-lg bg-light"
                                        />
                                        <Form.Text className="text-muted">
                                            يتم حسابه تلقائياً من الرقم القومي
                                        </Form.Text>
                                    </Form.Group>
                                </Col>

                                <Col xs={12}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">
                                            <MapPin size={16} className="me-1" />
                                            العنوان التفصيلي
                                        </Form.Label>
                                        <Form.Control
                                            as="textarea"
                                            rows={2}
                                            name="address"
                                            value={formData.address || ''}
                                            onChange={handleChange}
                                            required
                                            className="form-control-lg"
                                            placeholder="أدخل العنوان بالتفصيل"
                                        />
                                    </Form.Group>
                                </Col>
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>

                    <Accordion.Item eventKey="job-info">
                        <Accordion.Header>
                            <div className="d-flex align-items-center">
                                <Building size={18} className="me-2" />
                                <span>معلومات الوظيفة</span>
                            </div>
                        </Accordion.Header>
                        <Accordion.Body>
                            <Row className="g-3">
                                <Col xs={12} md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">
                                            <DollarSign size={16} className="me-1" />
                                            الراتب الأساسي
                                        </Form.Label>
                                        <Form.Control
                                            type="number"
                                            step="0.01"
                                            name="base_salary"
                                            value={formData.base_salary || ''}
                                            onChange={handleChange}
                                            required
                                            className="form-control-lg"
                                            placeholder="أدخل الراتب"
                                        />
                                    </Form.Group>
                                </Col>
                                <Col xs={12} md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">القسم</Form.Label>
                                        <Form.Select
                                            name="department"
                                            value={formData.department || ''}
                                            onChange={handleChange}
                                            required
                                            className="form-select-lg"
                                        >
                                            <option value="">اختر القسم...</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>

                                <Col xs={12} md={6}>
                                    <Form.Group className="mb-3">
                                        <Form.Label className="fw-bold">الدور الوظيفي</Form.Label>
                                        <Form.Select
                                            name="role"
                                            value={formData.role || ''}
                                            onChange={handleChange}
                                            required
                                            disabled={!formData.department || roles.length === 0}
                                            className="form-select-lg"
                                        >
                                            <option value="">
                                                {formData.department ? 'اختر الدور...' : 'اختر القسم أولاً'}
                                            </option>
                                            {roles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </Form.Select>
                                    </Form.Group>
                                </Col>

                                {employeeToEdit && (
                                    <Col xs={12} md={6} className="d-flex align-items-center">
                                        <Form.Group className="w-100">
                                            <Form.Check
                                                type="switch"
                                                id="is_active_switch"
                                                name="is_active"
                                                label={
                                                    <span className="fw-bold">
                                                        <UserCheck size={16} className="me-1" />
                                                        موظف نشط
                                                    </span>
                                                }
                                                checked={formData.is_active}
                                                onChange={handleActiveToggle}
                                            />
                                        </Form.Group>
                                    </Col>
                                )}
                            </Row>
                        </Accordion.Body>
                    </Accordion.Item>

                    {employeeToEdit && (
                        <Accordion.Item eventKey="password-change">
                            <Accordion.Header>
                                <div className="d-flex align-items-center">
                                    <Key size={18} className="me-2" />
                                    <span>تغيير كلمة المرور</span>
                                </div>
                            </Accordion.Header>
                            <Accordion.Body>
                                <Card className="border-warning">
                                    <Card.Body>
                                        <div className="mb-3">
                                            <Form.Label className="fw-bold d-flex justify-content-between align-items-center">
                                                <span>كلمة مرور جديدة</span>
                                                {currentDetails?.last_password_change_ago && (
                                                    <small className="fw-normal text-muted">
                                                        آخر تغيير: {translateTimeAgo(currentDetails.last_password_change_ago)}
                                                    </small>
                                                )}
                                            </Form.Label>

                                            {currentDetails?.last_password_change_formatted && (
                                                <div className="text-muted small mb-3">
                                                    {currentDetails.last_password_change_formatted}
                                                </div>
                                            )}

                                            <InputGroup className="mb-3">
                                                <Form.Control
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="اكتب كلمة المرور الجديدة..."
                                                    value={newPassword}
                                                    onChange={handlePasswordInputChange}
                                                    className="form-control-lg"
                                                />
                                                <Button
                                                    variant="outline-secondary"
                                                    onMouseDown={() => setShowPassword(true)}
                                                    onMouseUp={() => setShowPassword(false)}
                                                    onMouseLeave={() => setShowPassword(false)}
                                                    size="lg"
                                                >
                                                    {showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                                                </Button>
                                            </InputGroup>

                                            {passwordStrength.text && (
                                                <div className={`alert alert-${passwordStrength.color} mb-3`}>
                                                    قوة كلمة المرور: <strong>{passwordStrength.text}</strong>
                                                </div>
                                            )}

                                            <Button
                                                variant="warning"
                                                size="lg"
                                                onClick={handlePasswordChange}
                                                disabled={passwordSaving || !newPassword}
                                                className="w-100"
                                            >
                                                {passwordSaving ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-2"></span>
                                                        جاري التغيير...
                                                    </>
                                                ) : 'حفظ كلمة المرور الجديدة'}
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Accordion.Body>
                        </Accordion.Item>
                    )}

                    <Accordion.Item eventKey="documents">
                        <Accordion.Header>
                            <div className="d-flex align-items-center">
                                <FileText size={18} className="me-2 text-info" />
                                <span>الوثائق والأرشيف ({currentDetails?.documents?.length || (tempNationalIdImage ? 1 : 0)})</span>
                            </div>
                        </Accordion.Header>
                        <Accordion.Body>
                            <div className="bg-light p-3 rounded border mb-4">
                                <h6 className="fw-bold small mb-2 text-dark">
                                    <UploadCloud size={16} className="me-1"/> رفع مستند جديد (عقد، صورة بطاقة، فيش...)
                                </h6>
                                <Row className="g-2 align-items-end">
                                    <Col md={5}>
                                        <Form.Control
                                            size="sm"
                                            type="text"
                                            placeholder="عنوان المستند"
                                            value={uploadTitle}
                                            onChange={e => setUploadTitle(e.target.value)}
                                        />
                                    </Col>
                                    <Col md={5}>
                                        <Form.Control
                                            size="sm"
                                            type="file"
                                            accept=".pdf,image/*"
                                            onChange={e => setUploadFile(e.target.files[0])}
                                        />
                                    </Col>
                                    <Col md={2}>
                                        <Button
                                            size="sm"
                                            variant="success"
                                            className="w-100"
                                            onClick={handleUploadEmployeeDoc}
                                            disabled={isUploadingDoc || !uploadFile || !uploadTitle}
                                        >
                                            {isUploadingDoc ? 'جاري...' : (employeeToEdit ? 'أرشفة' : 'إرفاق')}
                                        </Button>
                                    </Col>
                                </Row>
                                {!employeeToEdit && (
                                    <small className="text-muted mt-2 d-block">
                                        سيتم ربط المستند كصورة البطاقة عند حفظ الموظف.
                                    </small>
                                )}
                            </div>

                            <div className="table-responsive">
                                <Table size="sm" bordered hover>
                                    <thead className="table-light">
                                        <tr>
                                            <th>اسم الوثيقة</th>
                                            <th width="120">التاريخ</th>
                                            <th width="80" className="text-center">عرض</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employeeToEdit && currentDetails?.national_id_image && (
                                            <tr>
                                                <td className="fw-bold text-primary">صورة البطاقة (القديمة)</td>
                                                <td className="text-muted small">سجل أساسي</td>
                                                <td className="text-center">
                                                    <Button
                                                        variant="outline-primary"
                                                        size="sm"
                                                        className="py-0 px-2"
                                                        onClick={() => window.open(currentDetails.national_id_image, '_blank')}
                                                    >
                                                        <Eye size={14} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        )}

                                        {employeeToEdit && currentDetails?.documents && currentDetails.documents.length > 0 ? (
                                            currentDetails.documents.map((doc, index) => (
                                                <tr key={index}>
                                                    <td className="fw-bold">{doc.title}</td>
                                                    <td className="text-muted small" dir="ltr">
                                                        {format(new Date(doc.created_at), 'yyyy/MM/dd')}
                                                    </td>
                                                    <td className="text-center">
                                                        <Button
                                                            variant="outline-primary"
                                                            size="sm"
                                                            className="py-0 px-2"
                                                            onClick={() => window.open(doc.file, '_blank')}
                                                        >
                                                            <Eye size={14} />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            !employeeToEdit && !tempNationalIdImage && (
                                                <tr>
                                                    <td colSpan="3" className="text-center text-muted py-3">
                                                        لا توجد وثائق محفوظة
                                                    </td>
                                                </tr>
                                            )
                                        )}

                                        {!employeeToEdit && tempNationalIdImage && (
                                            <tr>
                                                <td className="fw-bold text-success">صورة البطاقة (مرفوعة مؤقتاً)</td>
                                                <td className="text-muted small">قيد الحفظ</td>
                                                <td className="text-center">
                                                    <Button
                                                        variant="outline-success"
                                                        size="sm"
                                                        className="py-0 px-2"
                                                        onClick={() => window.open(URL.createObjectURL(tempNationalIdImage), '_blank')}
                                                    >
                                                        <Eye size={14} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                        </Accordion.Body>
                    </Accordion.Item>

                    {employeeToEdit && currentDetails && (
                        <>
                            {currentDetails.salary_changes && currentDetails.salary_changes.length > 0 && (
                                <Accordion.Item eventKey="salary-history">
                                    <Accordion.Header>
                                        <div className="d-flex align-items-center">
                                            <DollarSign size={18} className="me-2 text-success" />
                                            <span>سجل تغييرات الراتب</span>
                                        </div>
                                    </Accordion.Header>
                                    <Accordion.Body>
                                        <div className="table-responsive">
                                            <Table size="sm" bordered hover>
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>التاريخ</th>
                                                        <th>الراتب القديم</th>
                                                        <th>الراتب الجديد</th>
                                                        <th>قام بالتغيير</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentDetails.salary_changes.map((log, index) => (
                                                        <tr key={index}>
                                                            <td>
                                                                <small className="text-muted">{log.timestamp_formatted}</small>
                                                            </td>
                                                            <td className="text-danger fw-bold">
                                                                {log.old_salary}
                                                            </td>
                                                            <td className="text-success fw-bold">
                                                                {log.new_salary}
                                                            </td>
                                                            <td>
                                                                <small>
                                                                    {log.changed_by_name}
                                                                    {log.changed_by_department && ` (${log.changed_by_department})`}
                                                                </small>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </Accordion.Body>
                                </Accordion.Item>
                            )}

                            {currentDetails.status_logs && currentDetails.status_logs.length > 0 && (
                                <Accordion.Item eventKey="status-history">
                                    <Accordion.Header>
                                        <div className="d-flex align-items-center">
                                            <UserCheck size={18} className="me-2 text-primary" />
                                            <span>سجلات حالة الموظف</span>
                                        </div>
                                    </Accordion.Header>
                                    <Accordion.Body>
                                        <div className="table-responsive">
                                            <Table size="sm" bordered hover>
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>التاريخ</th>
                                                        <th>الحالة</th>
                                                        <th>قام بالتغيير</th>
                                                        <th>السبب</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentDetails.status_logs.map((log, index) => (
                                                        <tr key={index}>
                                                            <td>
                                                                <small className="text-muted">
                                                                    {format(new Date(log.timestamp), 'yyyy/MM/dd, hh:mm a')}
                                                                </small>
                                                            </td>
                                                            <td>
                                                                <Badge
                                                                    bg={log.status === 'activated' ? 'success' :
                                                                        log.status === 'deactivated' ? 'danger' : 'warning'}
                                                                    className="fw-normal"
                                                                >
                                                                    {log.status_display}
                                                                </Badge>
                                                            </td>
                                                            <td>
                                                                <small>
                                                                    {log.changed_by_name || 'نظام'}
                                                                    {log.changed_by_department && ` (${log.changed_by_department})`}
                                                                </small>
                                                            </td>
                                                            <td>
                                                                {log.reason && (
                                                                    <small className="text-muted">
                                                                        {log.reason}
                                                                    </small>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </Accordion.Body>
                                </Accordion.Item>
                            )}

                            {currentDetails.password_changes && currentDetails.password_changes.length > 0 && (
                                <Accordion.Item eventKey="password-history">
                                    <Accordion.Header>
                                        <div className="d-flex align-items-center">
                                            <Shield size={18} className="me-2 text-warning" />
                                            <span>سجلات تغيير كلمة المرور</span>
                                        </div>
                                    </Accordion.Header>
                                    <Accordion.Body>
                                        <div className="table-responsive">
                                            <Table size="sm" bordered hover>
                                                <thead className="table-light">
                                                    <tr>
                                                        <th>التاريخ</th>
                                                        <th>قام بالتغيير</th>
                                                        <th>القسم</th>
                                                        <th>عنوان IP</th>
                                                        <th>مضى</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {currentDetails.password_changes.map((log, index) => (
                                                        <tr key={index}>
                                                            <td>{log.timestamp_formatted}</td>
                                                            <td>
                                                                <small>{log.changed_by_name || 'غير معروف'}</small>
                                                            </td>
                                                            <td>
                                                                <small>{log.changed_by_department || '---'}</small>
                                                            </td>
                                                            <td>
                                                                <small className="text-muted">{log.ip_address || '-'}</small>
                                                            </td>
                                                            <td>
                                                                <Badge bg="info" className="fw-normal">
                                                                    {translateTimeAgo(log.time_ago)}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </Accordion.Body>
                                </Accordion.Item>
                            )}
                        </>
                    )}
                </Accordion>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" onClick={handleClose} size="lg">
                    إغلاق
                </Button>
                <Button
                    variant={employeeToEdit ? "warning" : "primary"}
                    type="submit"
                    disabled={saving}
                    onClick={handleSubmit}
                    size="lg"
                    className="px-4"
                >
                    {saving ? (
                        <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            جاري الحفظ...
                        </>
                    ) : employeeToEdit ? 'تحديث البيانات' : 'إضافة الموظف'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const ConfirmationModal = ({ show, handleClose, title, body, onConfirm, confirmVariant = 'danger' }) => (
    <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton>
            <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{body}</Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={handleClose} size="lg">إلغاء</Button>
            <Button variant={confirmVariant} onClick={onConfirm} size="lg">تأكيد</Button>
        </Modal.Footer>
    </Modal>
);

function Employees() {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [employeeToEdit, setEmployeeToEdit] = useState(null);
    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        body: '',
        onConfirm: () => {},
        confirmVariant: 'danger'
    });
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [employeeToProcess, setEmployeeToProcess] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDepartment, setFilterDepartment] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [printConfig, setPrintConfig] = useState({ show: false, title: '', endpoint: '' });

    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get('/management/employees/');
            setEmployees(response.data.results || response.data);
        } catch (error) {
            console.error("Failed to fetch employees", error);
            toast.error("فشل تحميل بيانات الموظفين");
        }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchEmployees();
    }, [fetchEmployees]);

    const handleDelete = async (employeeId) => {
        try {
            const response = await axios.delete(`/management/employees/${employeeId}/`);
            if (response.data.detail && response.data.detail.includes('للموافقة')) {
                toast.info(response.data.detail);
            } else {
                toast.success(response.data.detail);
                fetchEmployees();
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "فشل إرسال طلب الحذف.");
        }
        setConfirmModal({ ...confirmModal, show: false });
    };

    const showConfirmDelete = (employee) => {
        setConfirmModal({
            show: true,
            title: 'تأكيد الحذف',
            body: `هل أنت متأكد من رغبتك في حذف الموظف "${employee.full_name}"؟ سيتم إرسال طلب للموافقة.`,
            onConfirm: () => handleDelete(employee.id),
            confirmVariant: 'danger'
        });
    };

    const showDeactivationConfirm = (employee) => {
        setEmployeeToProcess(employee);
        setShowDeactivateModal(true);
    };

    const handleDeactivate = async (reason) => {
        if (!employeeToProcess) return;
        try {
            await axios.post(`/management/employees/${employeeToProcess.id}/deactivate/`, { reason });
            toast.success(`تم إلغاء تفعيل حساب ${employeeToProcess.full_name}.`);
            fetchEmployees();
            setShowDeactivateModal(false);
        } catch  {
            toast.error("فشل إلغاء تفعيل الحساب.");
        }
    };

    const handleActivate = (employee) => {
        setConfirmModal({
            show: true,
            title: 'تأكيد التفعيل',
            body: `هل أنت متأكد من إعادة تفعيل حساب الموظف "${employee.full_name}"؟`,
            confirmVariant: 'success',
            onConfirm: async () => {
                try {
                    await axios.post(`/management/employees/${employee.id}/activate/`);
                    toast.success("تم إعادة تفعيل الحساب بنجاح.");
                    fetchEmployees();
                } catch {
                    toast.error("فشل إعادة تفعيل الحساب.");
                }
                setConfirmModal({ ...confirmModal, show: false });
            }
        });
    };

    const handleEditClick = (employee) => {
        setEmployeeToEdit(employee);
        setShowModal(true);
    };

    const handleAddNewClick = () => {
        setEmployeeToEdit(null);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEmployeeToEdit(null);
    };

    const handlePrintContract = (employee) => {
        setPrintConfig({ show: true, title: `عقد موظف: ${employee.full_name}`, endpoint: `/contracts/employee/?emp_id=${employee.id}` });
    };

    const filteredEmployees = employees.filter(emp => {
        const matchesSearch = emp.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            emp.phone?.includes(searchTerm);

        const matchesDepartment = !filterDepartment || emp.department_name === filterDepartment;
        const matchesStatus = !filterStatus ||
                            (filterStatus === 'active' && emp.is_active) ||
                            (filterStatus === 'inactive' && !emp.is_active);

        return matchesSearch && matchesDepartment && matchesStatus;
    });

    const departments = [...new Set(employees.map(emp => emp.department_name).filter(Boolean))];

    const stats = {
        total: employees.length,
        active: employees.filter(emp => emp.is_active).length,
        inactive: employees.filter(emp => !emp.is_active).length,
        departments: departments.length
    };

    const checkAccess = useHasPermission();
    const canEditDirectly = checkAccess('employees', 'FULL_ACCESS');
    const needsApproval = checkAccess('employees', 'REQUIRE_APPROVAL');
    const isViewOnly = checkAccess('employees', 'VIEW_ONLY') && !canEditDirectly && !needsApproval;

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1">إدارة الموظفين</h1>
                    <p className="text-muted mb-0">إدارة بيانات وصول الموظفين</p>
                </div>
                {!isViewOnly && (
                    <Button onClick={handleAddNewClick} variant="primary" size="lg" className="shadow">
                        <PlusCircle size={20} className="me-2" />
                        <span className="d-none d-md-inline">{needsApproval ? 'طلب إضافة موظف' : 'إضافة موظف'}</span>
                    </Button>
                )}
            </div>

            <Row className="mb-4 g-2">
                <Col xs={6} md={3}>
                    <Card className="border-start border-primary border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">إجمالي الموظفين</h6>
                                    <h4 className="mb-0">{stats.total}</h4>
                                </div>
                                <User size={24} className="text-primary" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="border-start border-success border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">نشطين</h6>
                                    <h4 className="mb-0">{stats.active}</h4>
                                </div>
                                <UserCheck size={24} className="text-success" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="border-start border-danger border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">غير نشطين</h6>
                                    <h4 className="mb-0">{stats.inactive}</h4>
                                </div>
                                <UserX size={24} className="text-danger" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="border-start border-info border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">عدد الأقسام</h6>
                                    <h4 className="mb-0">{stats.departments}</h4>
                                </div>
                                <Building size={24} className="text-info" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Card className="mb-4 shadow-sm">
                <Card.Body>
                    <Row className="g-2 align-items-center">
                        <Col xs={12} md={4}>
                            <Form.Group>
                                <Form.Label className="fw-bold">بحث</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="ابحث بالاسم، الرقم، أو الهاتف..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="form-control-lg"
                                />
                            </Form.Group>
                        </Col>
                        <Col xs={12} md={4}>
                            <Form.Group>
                                <Form.Label className="fw-bold">القسم</Form.Label>
                                <Form.Select
                                    value={filterDepartment}
                                    onChange={(e) => setFilterDepartment(e.target.value)}
                                    className="form-select-lg"
                                >
                                    <option value="">كل الأقسام</option>
                                    {departments.map(dept => (
                                        <option key={dept} value={dept}>{dept}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col xs={12} md={4}>
                            <Form.Group>
                                <Form.Label className="fw-bold">الحالة</Form.Label>
                                <Form.Select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="form-select-lg"
                                >
                                    <option value="">كل الحالات</option>
                                    <option value="active">نشطين فقط</option>
                                    <option value="inactive">غير نشطين فقط</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">جاري التحميل...</span>
                    </div>
                    <p className="mt-2">جاري تحميل بيانات الموظفين...</p>
                </div>
            ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-5">
                    <div className="mb-3">
                        <UserX size={64} className="text-muted" />
                    </div>
                    <h4 className="text-muted mb-3">لا يوجد موظفين</h4>
                    {employees.length === 0 ? (
                        !isViewOnly && (
                            <Button
                                variant="primary"
                                size="lg"
                                onClick={handleAddNewClick}
                            >
                                <PlusCircle size={20} className="me-2" />
                                إضافة أول موظف
                            </Button>
                        )
                    ) : (
                        <p className="text-muted">لم يتم العثور على موظفين يطابقون معايير البحث</p>
                    )}
                </div>
            ) : (
                <div className="row g-3">
                    {filteredEmployees.map(emp => (
                        <div key={emp.id} className="col-12 col-md-6 col-lg-4">
                            <Card className="h-100 shadow-sm hover-shadow">
                                <Card.Body>
                                    <div className="d-flex align-items-start mb-3">
                                        <div className="flex-grow-1">
                                            <div className="d-flex justify-content-between align-items-start">
                                                <h6 className="mb-1 text-primary fw-bold">
                                                    {emp.full_name}
                                                </h6>
                                                <Badge bg={emp.is_active ? 'success' : 'danger'}>
                                                    {emp.is_active ? 'نشط' : 'غير نشط'}
                                                </Badge>
                                            </div>

                                            <div className="mb-2">
                                                <small className="text-muted d-block">رقم الموظف</small>
                                                <Badge bg="secondary" className="fw-normal">
                                                    {emp.employee_id}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    <Row className="g-2 mb-3">
                                        <Col xs={6}>
                                            <div>
                                                <small className="text-muted d-block">الراتب</small>
                                                <strong className="text-success">
                                                    {emp.base_salary} ج.م
                                                </strong>
                                            </div>
                                        </Col>
                                        <Col xs={6}>
                                            <div>
                                                <small className="text-muted d-block">القسم</small>
                                                <div className="text-truncate">
                                                    {emp.department_name || '---'}
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>

                                    <Row className="g-2 mb-3">
                                        <Col xs={6}>
                                            <div>
                                                <small className="text-muted d-block">الدور</small>
                                                <div className="text-truncate">
                                                    {emp.role_name || '---'}
                                                </div>
                                            </div>
                                        </Col>
                                        <Col xs={6}>
                                            <div>
                                                <small className="text-muted d-block">الهاتف</small>
                                                <div className="text-truncate">
                                                    {emp.phone || '---'}
                                                </div>
                                            </div>
                                        </Col>
                                    </Row>

                                    {emp.deactivation_reason && !emp.is_active && (
                                        <div className="alert alert-danger p-2 mb-3">
                                            <small>
                                                <strong>سبب الإلغاء:</strong> {emp.deactivation_reason}
                                            </small>
                                        </div>
                                    )}
                                </Card.Body>
                                <Card.Footer className="bg-transparent border-top-0 pt-0">
                                    {!isViewOnly && (
                                        <>
                                            <div className="d-flex flex-wrap gap-2">
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    onClick={() => handleEditClick(emp)}
                                                    className="flex-fill"
                                                >
                                                    <Edit size={14} className="me-1" />
                                                    {needsApproval ? 'طلب تعديل' : 'تعديل'}
                                                </Button>
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    onClick={() => showConfirmDelete(emp)}
                                                    className="flex-fill"
                                                >
                                                    <Trash2 size={14} className="me-1" />
                                                    {needsApproval ? 'طلب حذف' : 'حذف'}
                                                </Button>
                                                <Button
                                                    variant="outline-dark"
                                                    size="sm"
                                                    onClick={() => handlePrintContract(emp)}
                                                    className="flex-fill"
                                                >
                                                    <Printer size={14} className="me-1" />
                                                    طباعة العقد
                                                </Button>
                                            </div>

                                            <div className="d-flex flex-wrap gap-2 mt-2">
                                                {emp.is_active ? (
                                                    <Button
                                                        variant="outline-warning"
                                                        size="sm"
                                                        onClick={() => showDeactivationConfirm(emp)}
                                                        className="w-100"
                                                    >
                                                        <UserX size={14} className="me-1" />
                                                        إلغاء التفعيل
                                                    </Button>
                                                ) : (
                                                    <Button
                                                        variant="outline-success"
                                                        size="sm"
                                                        onClick={() => handleActivate(emp)}
                                                        className="w-100"
                                                    >
                                                        <UserCheck size={14} className="me-1" />
                                                        إعادة التفعيل
                                                    </Button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </Card.Footer>
                            </Card>
                        </div>
                    ))}
                </div>
            )}

            <EmployeeForm
                show={showModal}
                handleClose={handleCloseModal}
                onSave={fetchEmployees}
                employeeToEdit={employeeToEdit}
                onDeactivateClick={showDeactivationConfirm}
                onActivateClick={handleActivate}
            />

            <ConfirmationModal
                show={confirmModal.show}
                handleClose={() => setConfirmModal({ ...confirmModal, show: false })}
                title={confirmModal.title}
                body={confirmModal.body}
                onConfirm={confirmModal.onConfirm}
                confirmVariant={confirmModal.confirmVariant}
            />

            <DeactivationModal
                show={showDeactivateModal}
                handleClose={() => setShowDeactivateModal(false)}
                onConfirm={handleDeactivate}
                employeeName={employeeToProcess?.full_name}
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

export default Employees;
