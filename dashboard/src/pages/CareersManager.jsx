import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import {
    Table, Button, Modal, Form, Badge, Row, Col, Card, Spinner
} from 'react-bootstrap';
import {
    Briefcase, PlusCircle, Edit, Trash2, Eye, Users,
    Calendar, MapPin, CheckCircle, XCircle, FileText, ExternalLink, Printer
} from 'lucide-react';
import PrintModal from '../components/ui/PrintModal';

const JobModal = ({ show, handleClose, onSave, jobToEdit }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            setFormData(jobToEdit || {
                title: '',
                job_type: 'Full-time',
                location: '',
                description: '',
                requirements: '',
                salary_range: '',
                vacancy_count: 1,
                deadline: '',
                is_active: true
            });
        }
    }, [show, jobToEdit]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (jobToEdit) {
                await axios.patch(`/management/jobs/${jobToEdit.id}/`, formData);
                toast.success("تم تحديث الوظيفة بنجاح");
            } else {
                await axios.post('/management/jobs/', formData);
                toast.success("تم نشر الوظيفة بنجاح");
            }
            onSave();
            handleClose();
        } catch {
            toast.error("فشل حفظ الوظيفة");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>{jobToEdit ? 'تعديل وظيفة' : 'إضافة وظيفة جديدة'}</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Row className="g-3">
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>المسمى الوظيفي *</Form.Label>
                                <Form.Control required name="title" value={formData.title} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>نوع الوظيفة</Form.Label>
                                <Form.Select name="job_type" value={formData.job_type} onChange={handleChange}>
                                    <option value="Full-time">دوام كامل</option>
                                    <option value="Part-time">دوام جزئي</option>
                                    <option value="Contract">عقد مؤقت</option>
                                    <option value="Remote">عن بعد</option>
                                    <option value="Shift-based">ورديات</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>الموقع</Form.Label>
                                <Form.Control required name="location" value={formData.location} onChange={handleChange} placeholder="مثال: المزرعة - طريق الإسماعيلية" />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>نطاق الراتب (اختياري)</Form.Label>
                                <Form.Control name="salary_range" value={formData.salary_range || ''} onChange={handleChange} placeholder="مثال: 5000 - 7000 ج.م" />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>العدد المطلوب</Form.Label>
                                <Form.Control type="number" min="1" name="vacancy_count" value={formData.vacancy_count} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>آخر موعد للتقديم</Form.Label>
                                <Form.Control type="date" name="deadline" value={formData.deadline || ''} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={12}>
                            <Form.Group>
                                <Form.Label>وصف الوظيفة</Form.Label>
                                <Form.Control as="textarea" rows={3} required name="description" value={formData.description} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={12}>
                            <Form.Group>
                                <Form.Label>المتطلبات (كل نقطة في سطر)</Form.Label>
                                <Form.Control as="textarea" rows={4} required name="requirements" value={formData.requirements} onChange={handleChange} placeholder="- خبرة سنتين&#10;- رخصة قيادة" />
                            </Form.Group>
                        </Col>
                        <Col md={12}>
                            <Form.Check
                                type="switch"
                                id="is-active"
                                label="نشط (ظاهر في المتجر)"
                                name="is_active"
                                checked={formData.is_active || false}
                                onChange={handleChange}
                            />
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                    <Button variant="primary" type="submit" disabled={loading}>
                        {loading ? <Spinner size="sm" /> : 'حفظ'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

const ApplicationsModal = ({ show, handleClose, jobId }) => {
    const [apps, setApps] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show && jobId) {
            setLoading(true);
            axios.get('/management/job-applications/')
                .then(res => {
                    const allApps = res.data.results || res.data;
                    setApps(allApps.filter(a => a.job === jobId));
                })
                .catch(() => toast.error("فشل تحميل الطلبات"))
                .finally(() => setLoading(false));
        }
    }, [show, jobId]);

    return (
        <Modal show={show} onHide={handleClose} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>طلبات التوظيف</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                {loading ? (
                    <div className="text-center py-4"><Spinner animation="border" /></div>
                ) : apps.length === 0 ? (
                    <div className="text-center text-muted py-4">لا يوجد متقدمين حتى الآن.</div>
                ) : (
                    <div className="table-responsive">
                        <Table hover>
                            <thead className="bg-light">
                                <tr>
                                    <th>الاسم</th>
                                    <th>رقم الهاتف</th>
                                    <th>التاريخ</th>
                                    <th>السيرة الذاتية</th>
                                </tr>
                            </thead>
                            <tbody>
                                {apps.map(app => (
                                    <tr key={app.id}>
                                        <td className="fw-bold">{app.name}</td>
                                        <td>{app.phone}</td>
                                        <td>{new Date(app.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</td>
                                        <td>
                                            <a href={app.cv_link} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary d-inline-flex align-items-center gap-1">
                                                <ExternalLink size={14} /> فتح الرابط
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Modal.Body>
        </Modal>
    );
};

const CareersManager = () => {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showJobModal, setShowJobModal] = useState(false);
    const [editingJob, setEditingJob] = useState(null);
    const [viewAppsJobId, setViewAppsJobId] = useState(null);
    const [printConfig, setPrintConfig] = useState({ show: false, title: '', endpoint: '' });

    const fetchJobs = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/management/jobs/');
            setJobs(res.data.results || res.data || []);
        } catch {
            toast.error("فشل تحميل الوظائف");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchJobs(); }, [fetchJobs]);

    const handleDelete = async (id) => {
        if (window.confirm("هل أنت متأكد من حذف هذه الوظيفة؟ سيتم حذف جميع الطلبات المرتبطة بها.")) {
            try {
                await axios.delete(`/management/jobs/${id}/`);
                toast.success("تم الحذف بنجاح");
                fetchJobs();
            } catch {
                toast.error("فشل الحذف");
            }
        }
    };

    const printBlankContract = () => {
        setPrintConfig({show: true, title: 'عقد موظف فارغ', endpoint: '/contracts/employee/'});
    };

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1">إدارة التوظيف</h1>
                    <p className="text-muted mb-0">نشر الوظائف ومتابعة المتقدمين</p>
                </div>
                <div className="d-flex gap-2">
                    <Button variant="outline-dark" onClick={printBlankContract}>
                        <Printer size={18} className="me-2 d-none d-md-inline" />
                        عقد فارغ
                    </Button>
                    <Button onClick={() => { setEditingJob(null); setShowJobModal(true); }}>
                        <PlusCircle size={18} className="me-2 d-none d-md-inline" /> وظيفة جديدة
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm border-0">
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5"><Spinner animation="border" /></div>
                    ) : jobs.length === 0 ? (
                        <div className="text-center py-5 text-muted">لا توجد وظائف مسجلة</div>
                    ) : (
                        <Table hover responsive className="mb-0 align-middle">
                            <thead className="bg-light">
                                <tr>
                                    <th>المسمى الوظيفي</th>
                                    <th>النوع / المكان</th>
                                    <th>المطلوب / المتقدمين</th>
                                    <th>آخر موعد</th>
                                    <th>الحالة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {jobs.map(job => (
                                    <tr key={job.id}>
                                        <td>
                                            <div className="fw-bold">{job.title}</div>
                                            {job.salary_range && <small className="text-muted">{job.salary_range}</small>}
                                        </td>
                                        <td>
                                            <Badge bg="light" text="dark" className="me-1">{job.job_type}</Badge>
                                            <div className="small text-muted mt-1"><MapPin size={12}/> {job.location}</div>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <Badge bg="info">{job.vacancy_count} مطلوب</Badge>
                                                <Button
                                                    variant="link"
                                                    size="sm"
                                                    className="p-0 text-decoration-none"
                                                    onClick={() => setViewAppsJobId(job.id)}
                                                >
                                                    ({job.application_count} متقدم)
                                                </Button>
                                            </div>
                                        </td>
                                        <td>
                                            {job.deadline ? new Date(job.deadline).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' }) : 'مفتوح'}
                                        </td>
                                        <td>
                                            {job.is_active ?
                                                <Badge bg="success"><CheckCircle size={12} className="me-1"/>نشط</Badge> :
                                                <Badge bg="secondary"><XCircle size={12} className="me-1"/>مغلق</Badge>
                                            }
                                        </td>
                                        <td>
                                            <div className="d-flex gap-1">
                                                <Button size="sm" variant="outline-primary" onClick={() => { setEditingJob(job); setShowJobModal(true); }}>
                                                    <Edit size={14}/>
                                                </Button>
                                                <Button size="sm" variant="outline-info" onClick={() => setViewAppsJobId(job.id)} title="عرض المتقدمين">
                                                    <Users size={14}/>
                                                </Button>
                                                <Button size="sm" variant="outline-danger" onClick={() => handleDelete(job.id)}>
                                                    <Trash2 size={14}/>
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Card.Body>
            </Card>

            <JobModal
                show={showJobModal}
                handleClose={() => setShowJobModal(false)}
                onSave={fetchJobs}
                jobToEdit={editingJob}
            />

            <ApplicationsModal
                show={!!viewAppsJobId}
                handleClose={() => setViewAppsJobId(null)}
                jobId={viewAppsJobId}
            />

            <PrintModal
                show={printConfig.show}
                handleClose={() => setPrintConfig({show: false, title: '', endpoint: ''})}
                title={printConfig.title}
                endpoint={printConfig.endpoint}
            />
        </div>
    );
};

export default CareersManager;
