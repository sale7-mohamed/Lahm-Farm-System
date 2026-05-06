// src/pages/DailyAttendance.jsx
import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Table, Button, Modal, Form, Spinner, Row, Col, Badge, Card, Alert, ProgressBar } from 'react-bootstrap';
import {
    PlusCircle,
    Clock,
    UserCheck,
    UserX,
    Calendar,
    Watch,
    TrendingUp,
    Users,
    FileText,
    Filter
} from 'lucide-react';

const AttendanceForm = ({ show, handleClose, onSave, employees }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);

    useEffect(() => {
        if (show) {
            const today = new Date().toISOString().split('T')[0];
            setFormData({
                employee: '',
                date: today,
                status: 'present',
                check_in_time: '',
                check_out_time: '',
                notes: ''
            });
            setSelectedEmployee(null);
        }
    }, [show]);

    const handleEmployeeChange = (e) => {
        const employeeId = e.target.value;
        setFormData(p => ({ ...p, employee: employeeId }));

        const employee = employees.find(emp => emp.id == employeeId);
        setSelectedEmployee(employee);
    };

    const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.employee) {
            toast.error("الرجاء اختيار الموظف");
            return;
        }

        setLoading(true);
        try {

            const payload = { ...formData };
            if (payload.check_in_time) payload.check_in_time += ':00';
            if (payload.check_out_time) payload.check_out_time += ':00';

            await axios.post('/management/attendance/', payload);
            toast.success("تم تسجيل الحضور بنجاح.");
            onSave();
            handleClose();
        } catch (error) {
            const errorDetail = error.response?.data?.unique_together?.[0] || "فشل تسجيل الحضور.";
            toast.error(errorDetail);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton className="bg-primary text-white">
                <Modal.Title>
                    <PlusCircle size={24} className="me-2" />
                    تسجيل حضور/غياب يدوي
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Row className="g-3">
                        <Col xs={12}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">الموظف</Form.Label>
                                <Form.Select
                                    name="employee"
                                    value={formData.employee}
                                    onChange={handleEmployeeChange}
                                    required
                                    className="form-select-lg"
                                >
                                    <option value="">اختر موظف...</option>
                                    {employees.map(e => (
                                        <option key={e.id} value={e.id}>
                                            {e.full_name} - {e.employee_id}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>

                        {selectedEmployee && (
                            <Col xs={12}>
                                <Card className="border-info mb-3">
                                    <Card.Body className="p-3">
                                        <Row>
                                            <Col xs={6}>
                                                <small className="text-muted d-block">رقم الموظف</small>
                                                <strong>{selectedEmployee.employee_id}</strong>
                                            </Col>
                                            <Col xs={6}>
                                                <small className="text-muted d-block">القسم</small>
                                                <strong>{selectedEmployee.department_name || '---'}</strong>
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>
                            </Col>
                        )}

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">
                                    <Calendar size={16} className="me-1" />
                                    التاريخ
                                </Form.Label>
                                <Form.Control
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleChange}
                                    required
                                    className="form-control-lg"
                                />
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">الحالة</Form.Label>
                                <Form.Select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    required
                                    className="form-select-lg"
                                >
                                    <option value="present">حضور</option>
                                    <option value="absent">غياب</option>
                                    <option value="late">تأخير</option>
                                    <option value="leave">أجازة</option>
                                    <option value="half_day">نصف يوم</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">
                                    <Watch size={16} className="me-1" />
                                    وقت الحضور
                                </Form.Label>
                                <Form.Control
                                    type="time"
                                    name="check_in_time"
                                    value={formData.check_in_time}
                                    onChange={handleChange}
                                    className="form-control-lg"
                                />
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">
                                    <Watch size={16} className="me-1" />
                                    وقت الانصراف
                                </Form.Label>
                                <Form.Control
                                    type="time"
                                    name="check_out_time"
                                    value={formData.check_out_time}
                                    onChange={handleChange}
                                    className="form-control-lg"
                                />
                            </Form.Group>
                        </Col>

                        <Col xs={12}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">
                                    <FileText size={16} className="me-1" />
                                    ملاحظات
                                </Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    className="form-control-lg"
                                    placeholder="أدخل أي ملاحظات حول الحضور..."
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={handleClose} size="lg">
                        إلغاء
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={loading}
                        size="lg"
                        className="px-4"
                    >
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2"></span>
                                جاري التسجيل...
                            </>
                        ) : 'تسجيل الحضور'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

const DailyAttendance = () => {
    const [logs, setLogs] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [filterDate, setFilterDate] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterStatus, setFilterStatus] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [logsRes, empsRes] = await Promise.all([
                axios.get('/management/attendance/'),
                axios.get('/management/employees/')
            ]);
            setLogs(logsRes.data.results || []);
            setEmployees(empsRes.data.results || []);
        } catch {
            toast.error("فشل تحميل البيانات.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const filteredLogs = logs.filter(log => {
        const matchesDate = !filterDate || log.date === filterDate;
        const matchesEmployee = !filterEmployee || log.employee == filterEmployee;
        const matchesStatus = !filterStatus || log.status === filterStatus;

        return matchesDate && matchesEmployee && matchesStatus;
    });

    const calculateStats = () => {
        const today = new Date().toISOString().split('T')[0];
        const todayLogs = logs.filter(log => log.date === today);

        return {
            totalEmployees: employees.length,
            presentToday: todayLogs.filter(log => log.status === 'present').length,
            absentToday: todayLogs.filter(log => log.status === 'absent').length,
            lateToday: todayLogs.filter(log => log.status === 'late').length,
            onLeaveToday: todayLogs.filter(log => log.status === 'leave').length,
            attendanceRate: employees.length > 0 ?
                Math.round((todayLogs.filter(log => log.status === 'present').length / employees.length) * 100) : 0
        };
    };

    const stats = calculateStats();

    const getStatusBadge = (status) => {
        const badges = {
            present: { bg: 'success', icon: <UserCheck size={12} />, text: 'حضور' },
            absent: { bg: 'danger', icon: <UserX size={12} />, text: 'غياب' },
            late: { bg: 'warning', icon: <Clock size={12} />, text: 'تأخير' },
            leave: { bg: 'info', icon: <Calendar size={12} />, text: 'أجازة' },
            half_day: { bg: 'primary', icon: <Watch size={12} />, text: 'نصف يوم' }
        };

        const badge = badges[status] || { bg: 'secondary', text: status };

        return (
            <Badge bg={badge.bg} className="d-flex align-items-center gap-1">
                {badge.icon}
                {badge.text}
            </Badge>
        );
    };

    return (
        <div className="container-fluid py-3">
            {}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1">سجل الحضور والانصراف</h1>
                    <p className="text-muted mb-0">تتبع حضور وانصراف الموظفين</p>
                </div>
                <Button
                    onClick={() => setShowModal(true)}
                    variant="primary"
                    size="lg"
                    className="shadow"
                >
                    <PlusCircle size={20} className="me-2" />
                    <span className="d-none d-md-inline">تسجيل يدوي</span>
                </Button>
            </div>

            {}
            <Row className="mb-4 g-2">
                <Col xs={6} md={3}>
                    <Card className="border-start border-primary border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">إجمالي الموظفين</h6>
                                    <h4 className="mb-0">{stats.totalEmployees}</h4>
                                </div>
                                <Users size={24} className="text-primary" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="border-start border-success border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">حضور اليوم</h6>
                                    <h4 className="mb-0">{stats.presentToday}</h4>
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
                                    <h6 className="text-muted mb-1">غياب اليوم</h6>
                                    <h4 className="mb-0">{stats.absentToday}</h4>
                                </div>
                                <UserX size={24} className="text-danger" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="border-start border-warning border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">نسبة الحضور</h6>
                                    <h4 className="mb-0">{stats.attendanceRate}%</h4>
                                </div>
                                <TrendingUp size={24} className="text-warning" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {}
            <Card className="mb-4 shadow-sm">
                <Card.Body>
                    <Row className="g-2 align-items-center">
                        <Col xs={12} md={4}>
                            <Form.Group>
                                <Form.Label className="fw-bold">
                                    <Calendar size={16} className="me-1" />
                                    التاريخ
                                </Form.Label>
                                <Form.Control
                                    type="date"
                                    value={filterDate}
                                    onChange={(e) => setFilterDate(e.target.value)}
                                    className="form-control-lg"
                                />
                            </Form.Group>
                        </Col>
                        <Col xs={12} md={4}>
                            <Form.Group>
                                <Form.Label className="fw-bold">
                                    <Filter size={16} className="me-1" />
                                    الموظف
                                </Form.Label>
                                <Form.Select
                                    value={filterEmployee}
                                    onChange={(e) => setFilterEmployee(e.target.value)}
                                    className="form-select-lg"
                                >
                                    <option value="">جميع الموظفين</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.full_name}
                                        </option>
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
                                    <option value="">جميع الحالات</option>
                                    <option value="present">حضور</option>
                                    <option value="absent">غياب</option>
                                    <option value="late">تأخير</option>
                                    <option value="leave">أجازة</option>
                                    <option value="half_day">نصف يوم</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                    </Row>
                </Card.Body>
            </Card>

            {}
            {employees.length > 0 && (
                <Card className="mb-4">
                    <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                            <h6 className="mb-0">نسبة الحضور اليوم</h6>
                            <span className="text-primary">
                                {stats.attendanceRate}%
                            </span>
                        </div>
                        <ProgressBar
                            now={stats.attendanceRate}
                            variant="primary"
                            style={{ height: '10px' }}
                        />
                        <div className="d-flex justify-content-between mt-2 small">
                            <span>{stats.presentToday} حضور</span>
                            <span>{stats.absentToday + stats.lateToday} غياب/تأخير</span>
                        </div>
                    </Card.Body>
                </Card>
            )}

            {}
            <Card className="shadow-sm">
                <Card.Header className="bg-light">
                    <div className="d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">سجلات الحضور ({filteredLogs.length})</h5>
                        <Badge bg="light" text="dark">
                            آخر تحديث: {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </Badge>
                    </div>
                </Card.Header>
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5">
                            <Spinner animation="border" variant="primary" />
                            <p className="mt-3">جاري تحميل سجلات الحضور...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="text-center py-5">
                            <Calendar size={64} className="text-muted mb-3" />
                            <h5 className="text-muted mb-3">لا توجد سجلات حضور</h5>
                            <p className="text-muted">
                                {logs.length === 0 ?
                                    'لم يتم تسجيل أي حضور بعد' :
                                    'لم يتم العثور على سجلات تطابق معايير البحث'
                                }
                            </p>
                            <Button
                                variant="primary"
                                onClick={() => setShowModal(true)}
                                className="mt-2"
                            >
                                <PlusCircle size={18} className="me-2" />
                                تسجيل أول حضور
                            </Button>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>التاريخ</th>
                                        <th>الموظف</th>
                                        <th>الحالة</th>
                                        <th>وقت الحضور</th>
                                        <th>وقت الانصراف</th>
                                        <th>الملاحظات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredLogs.map(log => (
                                        <tr key={log.id}>
                                            <td>
                                                <div className="fw-bold">{log.date}</div>
                                                <small className="text-muted">
                                                    {new Date(log.date).toLocaleDateString('ar-EG', { weekday: 'long' })}
                                                </small>
                                            </td>
                                            <td>
                                                <div className="fw-bold">{log.employee_name}</div>
                                                <small className="text-muted">{log.employee_id}</small>
                                            </td>
                                            <td>{getStatusBadge(log.status)}</td>
                                            <td>
                                                {log.check_in_time ? (
                                                    <Badge bg="success" className="fw-normal">
                                                        {log.check_in_time}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted">---</span>
                                                )}
                                            </td>
                                            <td>
                                                {log.check_out_time ? (
                                                    <Badge bg="info" className="fw-normal">
                                                        {log.check_out_time}
                                                    </Badge>
                                                ) : (
                                                    <span className="text-muted">---</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="text-truncate" style={{ maxWidth: '150px' }}>
                                                    {log.notes || '---'}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
                {filteredLogs.length > 0 && (
                    <Card.Footer className="bg-light">
                        <div className="d-flex justify-content-between align-items-center">
                            <small className="text-muted">
                                عرض {filteredLogs.length} من أصل {logs.length} سجل
                            </small>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => {
                                    setFilterDate('');
                                    setFilterEmployee('');
                                    setFilterStatus('');
                                }}
                            >
                                إعادة تعيين الفلتر
                            </Button>
                        </div>
                    </Card.Footer>
                )}
            </Card>

            {}
            {stats.presentToday > 0 && (
                <Card className="mt-4">
                    <Card.Header className="bg-success text-white">
                        <h5 className="mb-0">ملخص حضور اليوم</h5>
                    </Card.Header>
                    <Card.Body>
                        <Row className="g-3">
                            <Col xs={6} md={3}>
                                <div className="text-center">
                                    <h6 className="text-muted mb-2">حضور</h6>
                                    <h3 className="text-success mb-0">{stats.presentToday}</h3>
                                </div>
                            </Col>
                            <Col xs={6} md={3}>
                                <div className="text-center">
                                    <h6 className="text-muted mb-2">تأخير</h6>
                                    <h3 className="text-warning mb-0">{stats.lateToday}</h3>
                                </div>
                            </Col>
                            <Col xs={6} md={3}>
                                <div className="text-center">
                                    <h6 className="text-muted mb-2">غياب</h6>
                                    <h3 className="text-danger mb-0">{stats.absentToday}</h3>
                                </div>
                            </Col>
                            <Col xs={6} md={3}>
                                <div className="text-center">
                                    <h6 className="text-muted mb-2">أجازة</h6>
                                    <h3 className="text-info mb-0">{stats.onLeaveToday}</h3>
                                </div>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            )}

            {}
            <AttendanceForm
                show={showModal}
                handleClose={() => setShowModal(false)}
                onSave={fetchData}
                employees={employees}
            />
        </div>
    );
};

export default DailyAttendance;