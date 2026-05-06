import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Modal, Button, Form, Table, Badge, Row, Col, Image, Card, Accordion, Tooltip, OverlayTrigger, Spinner, InputGroup, Collapse, FormCheck, ListGroup, Alert } from 'react-bootstrap';
import { PlusCircle, Edit, Trash2, HeartPulse, X, Weight, Calendar, Tag, EyeOff, AlertTriangle, CheckCircle, Search, Filter, Scale, Image as ImageIcon, DollarSign, ArrowLeft, ArrowRight, Eye, Truck, Home, RefreshCw } from 'lucide-react';
import { format, subMonths, differenceInMonths } from 'date-fns';
import { validateImage, validateVideo } from '../utils/fileValidators';
import { compressImage } from '../utils/fileHelpers';
import { useSearchParams } from 'react-router-dom';
import { useHasPermission } from '../hooks/useHasPermission';

const MediaPreviewModal = ({ show, handleClose, media }) => {
    if (!media) return null;

    const isVideo = media.type?.startsWith('video') || media.url?.match(/\.(mp4|mov|avi|mkv|webm|m4v)$/i);

    return (
        <Modal show={show} onHide={handleClose} centered size="xl" contentClassName="bg-transparent border-0 shadow-none">
            <div className="position-relative text-center d-flex justify-content-center align-items-center" style={{ minHeight: '50vh' }}>
                <Button
                    variant="light"
                    className="position-absolute top-0 end-0 m-2 rounded-circle z-3 shadow"
                    onClick={handleClose}
                >
                    <X size={24} />
                </Button>

                {isVideo ? (
                    <div className="mw-100 rounded shadow-lg" style={{ maxHeight: '85vh', maxWidth: '100%' }}>
                        <video
                            controls
                            autoPlay
                            className="w-100 h-100"
                            style={{ maxHeight: '85vh' }}
                        >
                            <source src={media.url} type="video/mp4" />
                            متصفحك لا يدعم تشغيل الفيديو.
                        </video>
                    </div>
                ) : (
                    <img
                        src={media.url}
                        alt="Preview"
                        className="mw-100 rounded shadow-lg"
                        style={{ maxHeight: '85vh', maxWidth: '100%', objectFit: 'contain' }}
                    />
                )}
            </div>
        </Modal>
    );
};

const MediaManager = ({
    existingMedia,
    newMedia,
    onAddMedia,
    onRemoveExisting,
    onRemoveNew,
    onPreview,
    onSetAsMainImage,
    onReorder,
    onReorderNew
}) => {
    const moveItem = (index, direction) => {
        if (index + direction < 0 || index + direction >= existingMedia.length) return;

        const newItems = [...existingMedia];
        const temp = newItems[index];
        newItems[index] = newItems[index + direction];
        newItems[index + direction] = temp;

        const reorderedItems = newItems.map((item, idx) => ({ ...item, order: idx }));
        onReorder(reorderedItems);
    };

    const moveNewItem = (index, direction) => {
        if (index + direction < 0 || index + direction >= newMedia.length) return;
        onReorderNew(index, direction);
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        const validFiles = [];

        files.forEach(file => {
            const isVideo = file.type.startsWith('video/') ||
                          file.name.match(/\.(mp4|mov|avi|mkv|webm|m4v)$/i);

            if (isVideo) {
                try {
                    validateVideo(file);
                    validFiles.push({
                        file,
                        preview: URL.createObjectURL(file),
                        type: 'video',
                        name: file.name
                    });
                } catch (error) {
                    toast.error(`الفيديو "${file.name}": ${error.message}`);
                }
            } else {
                try {
                    validateImage(file);
                    validFiles.push({
                        file,
                        preview: URL.createObjectURL(file),
                        type: 'image',
                        name: file.name
                    });
                } catch (error) {
                    toast.error(`الصورة "${file.name}": ${error.message}`);
                }
            }
        });

        if (validFiles.length > 0) {
            onAddMedia(validFiles);
        }

        e.target.value = '';
    };

    return (
        <div className="media-manager p-3 bg-light rounded border">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold mb-0 d-flex align-items-center gap-2">
                    <ImageIcon size={18}/> الوسائط
                </h6>
                <div className="btn btn-primary btn-sm position-relative overflow-hidden">
                    <PlusCircle size={16} className="me-2" />
                    <span>إضافة وسائط</span>
                    <input
                        type="file"
                        multiple
                        accept="image/*,video/*,.mp4,.mov,.avi,.mkv,.webm"
                        className="position-absolute top-0 start-0 opacity-0 w-100 h-100 cursor-pointer"
                        onChange={handleFileSelect}
                    />
                </div>
            </div>

            <Row xs={2} md={3} lg={4} className="g-3">
                {existingMedia.map((item, index) => {
                    const isVideo = item.is_video || item.file?.match(/\.(mp4|mov|avi|mkv|webm|m4v)$/i);
                    return (
                        <Col key={`exist-${item.id}`}>
                            <div className="position-relative rounded border bg-white overflow-hidden shadow-sm" style={{ height: '160px' }}>
                                <div
                                    className="w-100 h-100 cursor-pointer"
                                    style={{ paddingBottom: '35px' }}
                                    onClick={() => onPreview({
                                        url: item.file,
                                        type: isVideo ? 'video/mp4' : 'image/jpeg'
                                    })}
                                >
                                    {isVideo ? (
                                        <div className="w-100 h-100 bg-dark d-flex align-items-center justify-content-center">
                                            <div className="text-center">
                                                <div className="text-white opacity-75 mb-1">فيديو</div>
                                                <small className="text-white-50">{item.name || 'فيديو'}</small>
                                            </div>
                                        </div>
                                    ) : (
                                        <img
                                            src={item.file}
                                            alt="media"
                                            className="w-100 h-100 object-fit-cover"
                                        />
                                    )}
                                </div>

                                <div className="position-absolute top-0 end-0 p-1 d-flex flex-column gap-1">
                                    {!isVideo && (
                                        <button
                                            type="button"
                                            className="btn btn-success btn-sm p-0 d-flex align-items-center justify-content-center shadow-sm"
                                            style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                            onClick={(e) => { e.stopPropagation(); onSetAsMainImage(item.id); }}
                                            title="تعيين كصورة رئيسية"
                                        >
                                            <ImageIcon size={10} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="btn btn-danger btn-sm p-0 d-flex align-items-center justify-content-center shadow-sm"
                                        style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                        onClick={(e) => { e.stopPropagation(); onRemoveExisting(item.id); }}
                                        title="حذف"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>

                                <div className="position-absolute bottom-0 w-100 bg-light border-top d-flex justify-content-center align-items-center p-1 gap-2" style={{ height: '35px' }}>
                                    <button
                                        type="button"
                                        disabled={index === 0}
                                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                                        onClick={(e) => { e.stopPropagation(); moveItem(index, -1); }}
                                        title="تحريك لليمين"
                                    >
                                        <ArrowRight size={12} />
                                    </button>
                                    <span className="small text-muted fw-bold">{index + 1}</span>
                                    <button
                                        type="button"
                                        disabled={index === existingMedia.length - 1}
                                        className="btn btn-sm btn-outline-secondary py-0 px-2"
                                        onClick={(e) => { e.stopPropagation(); moveItem(index, 1); }}
                                        title="تحريك لليسار"
                                    >
                                        <ArrowLeft size={12} />
                                    </button>
                                </div>
                            </div>
                        </Col>
                    );
                })}

                {newMedia.map((item, idx) => (
                    <Col key={`new-${idx}`}>
                        <div className="position-relative rounded border border-success overflow-hidden shadow-sm" style={{ height: '160px' }}>
                            <div
                                className="w-100 h-100 cursor-pointer"
                                style={{ paddingBottom: '35px' }}
                                onClick={() => onPreview({ url: item.preview, type: item.type === 'video' ? 'video/mp4' : 'image/jpeg' })}
                            >
                                {item.type === 'video' ? (
                                    <div className="w-100 h-100 bg-dark d-flex align-items-center justify-content-center">
                                        <div className="text-center">
                                            <div className="text-white opacity-75 mb-1">فيديو جديد</div>
                                            <small className="text-white-50">{item.name || 'فيديو'}</small>
                                        </div>
                                    </div>
                                ) : (
                                    <img src={item.preview} alt="new" className="w-100 h-100 object-fit-cover" />
                                )}
                            </div>

                            <Badge bg="success" className="position-absolute top-0 start-0 m-1 shadow-sm" style={{ fontSize: '8px' }}>جديد</Badge>

                            <div className="position-absolute top-0 end-0 p-1">
                                <button
                                    type="button"
                                    className="btn btn-danger btn-sm p-0 d-flex align-items-center justify-content-center shadow-sm"
                                    style={{ width: '20px', height: '20px', borderRadius: '50%' }}
                                    onClick={(e) => { e.stopPropagation(); onRemoveNew(idx); }}
                                    title="حذف"
                                >
                                    <X size={12} />
                                </button>
                            </div>

                            <div className="position-absolute bottom-0 w-100 bg-success bg-opacity-10 border-top border-success d-flex justify-content-center align-items-center p-1 gap-2" style={{ height: '35px' }}>
                                <button
                                    type="button"
                                    disabled={idx === 0}
                                    className="btn btn-sm btn-outline-success py-0 px-2"
                                    onClick={(e) => { e.stopPropagation(); moveNewItem(idx, -1); }}
                                    title="تحريك لليمين"
                                >
                                    <ArrowRight size={12} />
                                </button>
                                <span className="small text-success fw-bold">{existingMedia.length + idx + 1}</span>
                                <button
                                    type="button"
                                    disabled={idx === newMedia.length - 1}
                                    className="btn btn-sm btn-outline-success py-0 px-2"
                                    onClick={(e) => { e.stopPropagation(); moveNewItem(idx, 1); }}
                                    title="تحريك لليسار"
                                >
                                    <ArrowLeft size={12} />
                                </button>
                            </div>
                        </div>
                    </Col>
                ))}
            </Row>

            {existingMedia.length === 0 && newMedia.length === 0 && (
                <div className="text-center py-4 text-muted border border-dashed rounded mt-2 bg-white">
                    <small>لا توجد وسائط. أضف صوراً أو فيديوهات.</small>
                </div>
            )}
        </div>
    );
};

const WeightLogManager = ({ animalId, onWeightUpdate }) => {
    const [logs, setLogs] = useState([]);
    const [newWeight, setNewWeight] = useState({ date: format(new Date(), 'yyyy-MM-dd'), weight_kg: '' });
    const [loading, setLoading] = useState(false);
    const [touched, setTouched] = useState(false);

    const fetchLogs = useCallback(async () => {
        if (!animalId) return;
        try {
            const response = await axios.get(`/management/animals/${animalId}/weight-logs/`);
            setLogs(response.data.results || response.data || []);
        } catch (error) {
            console.error("Error fetching weight logs", error);
        }
    }, [animalId]);

    useEffect(() => { fetchLogs(); }, [fetchLogs]);

    const handleAddWeight = async () => {
        setTouched(true);
        if (!newWeight.weight_kg) {
            toast.error("الرجاء إدخال الوزن");
            return;
        }

        setLoading(true);
        try {
            await axios.post(`/management/animals/${animalId}/weight-logs/`, newWeight);
            toast.success("تم إضافة الوزن بنجاح.");
            onWeightUpdate();
            fetchLogs();
            setNewWeight({ date: format(new Date(), 'yyyy-MM-dd'), weight_kg: '' });
            setTouched(false);
        } catch (error) {
            console.error(error);
            toast.error("فشل إضافة الوزن.");
        } finally {
            setLoading(false);
        }
    };

    const sortedLogs = [...logs].sort((a, b) => new Date(b.date) - new Date(a.date));
    const allWeightLogs = sortedLogs.map((log, index) => ({
        ...log,
        is_initial: index === sortedLogs.length - 1
    }));

    return (
        <div className="mt-4">
            <div className="d-flex align-items-center mb-3">
                <Weight size={20} className="me-2 text-primary" />
                <h5 className="mb-0">سجلات الأوزان</h5>
            </div>

            {allWeightLogs.length > 0 ? (
                <div className="table-responsive">
                    <Table striped bordered size="sm" className="mb-4">
                        <thead className="bg-light">
                            <tr>
                                <th>#</th>
                                <th>التاريخ</th>
                                <th>الوزن (كجم)</th>
                                <th>النوع</th>
                            </tr>
                        </thead>
                        <tbody>
                            {allWeightLogs.map((log, index) => (
                                <tr key={index} className={log.is_initial ? 'table-info' : ''}>
                                    <td>{index + 1}</td>
                                    <td>{log.date}</td>
                                    <td><strong>{log.weight_kg}</strong></td>
                                    <td>
                                        {log.is_initial ? (
                                            <Badge bg="primary">وزن أولي</Badge>
                                        ) : (
                                            <Badge bg="secondary">متابعة</Badge>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : (
                <div className="alert alert-info text-center">
                    لا توجد سجلات أوزان
                </div>
            )}

            <Card className="border-primary">
                <Card.Body>
                    <h6 className="mb-3">إضافة وزن جديد</h6>
                    <div className="w-100">
                        <Row className="g-2 align-items-end">
                            <Col xs={12} md={6}>
                                <Form.Group>
                                    <Form.Label>التاريخ</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="weight_log_date"
                                        value={newWeight.date}
                                        onChange={e => setNewWeight(p => ({...p, date: e.target.value}))}
                                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                    />
                                </Form.Group>
                            </Col>
                            <Col xs={12} md={4}>
                                <Form.Group>
                                    <Form.Label>الوزن (كجم)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        step="0.01"
                                        name="weight_kg"
                                        value={newWeight.weight_kg || ''}
                                        onChange={e => setNewWeight(p => ({...p, weight_kg: e.target.value}))}
                                        isInvalid={!newWeight.weight_kg && touched}
                                        placeholder="أدخل الوزن"
                                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        الرجاء إدخال الوزن
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                            <Col xs={12} md={2}>
                                <Button
                                    type="button"
                                    variant="primary"
                                    className="w-100"
                                    disabled={loading}
                                    onClick={handleAddWeight}
                                >
                                    {loading ? 'جاري...' : 'إضافة'}
                                </Button>
                            </Col>
                        </Row>
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
};

const HealthLogManager = ({ animalId, onHealthUpdate }) => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [touched, setTouched] = useState(false);
    const [newLog, setNewLog] = useState({
        log_date: format(new Date(), 'yyyy-MM-dd'),
        log_type: 'observation',
        description: '',
        cost: '0.00'
    });

    const fetchLogs = useCallback(async () => {
        if (!animalId) return;

        setFetching(true);
        try {
            const response = await axios.get(`/management/animals/${animalId}/health-logs/`);
            setLogs(response.data.results || response.data || []);
        } catch (error) {
            if (error.response?.status === 404) {
                setLogs([]);
            } else {
                console.error("Could not fetch health logs:", error);
            }
        } finally {
            setFetching(false);
        }
    }, [animalId]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleAddLog = async () => {
        setTouched(true);
        if (!newLog.description) {
            toast.error("الرجاء إدخال وصف السجل الصحي");
            return;
        }

        setLoading(true);
        try {
            await axios.post(`/management/animals/${animalId}/health-logs/`, newLog);
            toast.success("تم إضافة السجل الصحي بنجاح.");
            setNewLog({
                log_date: format(new Date(), 'yyyy-MM-dd'),
                log_type: 'observation',
                description: '',
                cost: '0.00'
            });
            onHealthUpdate();
            fetchLogs();
            setTouched(false);
        } catch (error) {
            console.error(error);
            toast.error("فشل إضافة السجل الصحي.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-4">
            <div className="d-flex align-items-center mb-3">
                <HeartPulse size={20} className="me-2 text-danger" />
                <h5 className="mb-0">السجلات الصحية</h5>
            </div>

            {fetching ? (
                <div className="text-center py-3">
                    <Spinner animation="border" size="sm" variant="primary" />
                    <span className="ms-2">جاري تحميل السجلات...</span>
                </div>
            ) : logs.length > 0 ? (
                <div className="table-responsive">
                    <Table striped bordered size="sm" className="mb-4">
                        <thead className="bg-light">
                            <tr>
                                <th>التاريخ</th>
                                <th>النوع</th>
                                <th>الوصف</th>
                                <th>التكلفة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((log, index) => (
                                <tr key={index}>
                                    <td>{log.log_date}</td>
                                    <td>
                                        <Badge bg={
                                            log.log_type === 'vaccination' ? 'success' :
                                            log.log_type === 'treatment' ? 'danger' : 'info'
                                        }>
                                            {log.log_type_display || log.log_type}
                                        </Badge>
                                    </td>
                                    <td>{log.description}</td>
                                    <td>{log.cost} ج.م</td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            ) : (
                <div className="alert alert-info text-center mb-3">
                    لا توجد سجلات صحية
                </div>
            )}

            <Card className="border-danger">
                <Card.Body>
                    <h6 className="mb-3">إضافة سجل صحي جديد</h6>
                    <div className="w-100">
                        <Row className="g-2 mb-2">
                            <Col xs={12} md={3}>
                                <Form.Group>
                                    <Form.Label>التاريخ</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="health_log_date"
                                        value={newLog.log_date}
                                        onChange={e => setNewLog(p => ({...p, log_date: e.target.value}))}
                                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                    />
                                </Form.Group>
                            </Col>
                            <Col xs={12} md={3}>
                                <Form.Group>
                                    <Form.Label>النوع</Form.Label>
                                    <Form.Select
                                        name="health_log_type"
                                        value={newLog.log_type}
                                        onChange={e => setNewLog(p => ({...p, log_type: e.target.value}))}
                                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                    >
                                        <option value="vaccination">تطعيم</option>
                                        <option value="treatment">علاج</option>
                                        <option value="observation">ملاحظة</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col xs={12} md={3}>
                                <Form.Group>
                                    <Form.Label>التكلفة (جنيه)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        step="0.01"
                                        name="health_cost"
                                        value={newLog.cost || '0.00'}
                                        onChange={e => setNewLog(p => ({...p, cost: e.target.value}))}
                                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                    />
                                </Form.Group>
                            </Col>
                            <Col xs={12} md={3}>
                                <Form.Group>
                                    <Form.Label>الوصف</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="health_description"
                                        value={newLog.description || ''}
                                        onChange={e => setNewLog(p => ({...p, description: e.target.value}))}
                                        isInvalid={!newLog.description && touched}
                                        placeholder="وصف السجل الصحي"
                                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                    />
                                    <Form.Control.Feedback type="invalid">
                                        الرجاء إدخال وصف السجل الصحي
                                    </Form.Control.Feedback>
                                </Form.Group>
                            </Col>
                        </Row>
                        <div className="text-end">
                            <Button
                                type="button"
                                variant="danger"
                                disabled={loading}
                                className="px-4"
                                onClick={handleAddLog}
                            >
                                {loading ? 'جاري...' : 'إضافة'}
                            </Button>
                        </div>
                    </div>
                </Card.Body>
            </Card>
        </div>
    );
};

const ViewAnimalModal = ({ show, handleClose, animal }) => {
    if (!animal) return null;

    return (
        <Modal show={show} onHide={handleClose} centered size="lg" scrollable>
            <Modal.Header closeButton className="bg-info text-white">
                <Modal.Title className="fs-5 d-flex align-items-center gap-2">
                    <Eye size={20} />
                    تفاصيل الحيوان: <strong>#{animal.code}</strong>
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Row className="g-4">
                    <Col xs={12} md={4} className="text-center">
                        <div className="rounded overflow-hidden border shadow-sm" style={{ height: '200px', backgroundColor: '#f8f9fa' }}>
                            {animal.image ? (
                                <Image src={animal.image} alt={animal.code} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                            ) : (
                                <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                                    <ImageIcon size={48} />
                                </div>
                            )}
                        </div>
                        <div className="mt-3">
                            <Badge bg={animal.status === 'available' ? 'success' : animal.status === 'sold' ? 'danger' : 'primary'} className="fs-6 w-100 py-2">
                                الحالة: {animal.status_display || animal.status}
                            </Badge>
                        </div>
                    </Col>

                    <Col xs={12} md={8}>
                        <Card className="border-0 shadow-sm mb-3">
                            <Card.Header className="bg-light fw-bold text-primary">المعلومات الأساسية</Card.Header>
                            <ListGroup variant="flush">
                                <ListGroup.Item className="d-flex justify-content-between">
                                    <span className="text-muted">الفئة:</span> <strong>{animal.category_name}</strong>
                                </ListGroup.Item>
                                <ListGroup.Item className="d-flex justify-content-between">
                                    <span className="text-muted">الجنس:</span> <strong>{animal.sex === 'male' ? 'ذكر' : 'أنثى'}</strong>
                                </ListGroup.Item>
                                <ListGroup.Item className="d-flex justify-content-between">
                                    <span className="text-muted">العمر:</span> <strong>{animal.age_months} شهر</strong>
                                </ListGroup.Item>
                                <ListGroup.Item className="d-flex justify-content-between">
                                    <span className="text-muted">الوزن الحالي:</span> <strong>{animal.current_weight || 'غير محدد'} كجم</strong>
                                </ListGroup.Item>
                            </ListGroup>
                        </Card>

                        <Card className="border-0 shadow-sm mb-3">
                            <Card.Header className="bg-light fw-bold text-success">المصدر والمكان</Card.Header>
                            <ListGroup variant="flush">
                                <ListGroup.Item className="d-flex justify-content-between">
                                    <span className="text-muted">المصدر:</span>
                                    <Badge bg={animal.source_farm ? 'info' : 'success'}>
                                        {animal.source_farm ? 'مزارع موثوقة' : 'من مزارعنا'}
                                    </Badge>
                                </ListGroup.Item>

                                <ListGroup.Item className="d-flex justify-content-between">
                                    <span className="text-muted">نوع الإدخال:</span>
                                    <strong>{animal.entry_type === 'born_on_farm' ? 'مولود بالمزرعة' : 'تم شراؤه'}</strong>
                                </ListGroup.Item>

                                {animal.entry_type === 'born_on_farm' && (
                                    <>
                                        <ListGroup.Item className="d-flex justify-content-between bg-success bg-opacity-10">
                                            <span className="text-success fw-bold">كود الأب:</span>
                                            <strong className="text-success">{animal.father_code ? `#${animal.father_code}` : 'غير مسجل'}</strong>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="d-flex justify-content-between bg-success bg-opacity-10">
                                            <span className="text-success fw-bold">كود الأم:</span>
                                            <strong className="text-success">{animal.mother_code ? `#${animal.mother_code}` : 'غير مسجل'}</strong>
                                        </ListGroup.Item>
                                    </>
                                )}

                                {animal.source_farm && (
                                    <>
                                        <ListGroup.Item className="d-flex justify-content-between">
                                            <span className="text-muted">اسم المزرعة:</span> <strong>{animal.source_farm.name}</strong>
                                        </ListGroup.Item>
                                        <ListGroup.Item className="d-flex justify-content-between">
                                            <span className="text-muted">كود المورد:</span> <strong>{animal.supplier_code || 'لا يوجد'}</strong>
                                        </ListGroup.Item>
                                    </>
                                )}
                                <ListGroup.Item className="d-flex justify-content-between">
                                    <span className="text-muted">المكان الداخلي:</span> <strong>{animal.location || 'غير محدد'}</strong>
                                </ListGroup.Item>
                            </ListGroup>
                        </Card>

                        {animal.internal_image && (
                            <Card className="border-0 shadow-sm mb-3">
                                <Card.Header className="bg-light fw-bold text-warning">صورة الإثبات الداخلية (سرية)</Card.Header>
                                <Card.Body className="text-center">
                                    <a href={animal.internal_image} target="_blank" rel="noopener noreferrer">
                                        <Image src={animal.internal_image} thumbnail style={{ maxHeight: '150px', cursor: 'pointer' }} />
                                    </a>
                                </Card.Body>
                            </Card>
                        )}

                        <Card className="border-0 shadow-sm mb-3">
                            <Card.Header className="bg-light fw-bold text-warning">المالية</Card.Header>
                            <ListGroup variant="flush">
                                <ListGroup.Item className="d-flex justify-content-between">
                                    <span className="text-muted">سعر البيع:</span> <strong className="text-primary">{animal.price_egp} ج.م</strong>
                                </ListGroup.Item>
                                <ListGroup.Item className="d-flex justify-content-between">
                                    <span className="text-muted">السعر بعد الخصم:</span> <strong>{animal.price_after_discount} ج.م</strong>
                                </ListGroup.Item>
                            </ListGroup>
                        </Card>

                        {(animal.internal_notes || animal.description) && (
                            <Card className="border-0 shadow-sm">
                                <Card.Header className="bg-light fw-bold text-secondary">ملاحظات</Card.Header>
                                <Card.Body>
                                    {animal.description && (
                                        <div className="mb-2">
                                            <span className="text-muted small d-block">وصف المتجر:</span>
                                            <span>{animal.description}</span>
                                        </div>
                                    )}
                                    {animal.internal_notes && (
                                        <div className="bg-warning bg-opacity-10 p-2 rounded">
                                            <span className="text-warning-emphasis small d-block fw-bold">ملاحظات إدارية (مخفية):</span>
                                            <span>{animal.internal_notes}</span>
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        )}
                    </Col>
                </Row>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>إغلاق</Button>
            </Modal.Footer>
        </Modal>
    );
};

const EditAnimalForm = ({ show, handleClose, onSave, animalToEdit, categories }) => {
    const [formData, setFormData] = useState({});
    const [mainImageFile, setMainImageFile] = useState(null);
    const [mainImagePreview, setMainImagePreview] = useState(null);
    const [isMainImageChanged, setIsMainImageChanged] = useState(false);
    const [existingMedia, setExistingMedia] = useState([]);
    const [deletedMediaIds, setDeletedMediaIds] = useState([]);
    const [newMediaFiles, setNewMediaFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [previewMedia, setPreviewMedia] = useState(null);
    const [ageInMonths, setAgeInMonths] = useState('');
    const [activeAccordion, setActiveAccordion] = useState('basic-info');
    const [isOurFarm, setIsOurFarm] = useState(true);
    const [suppliers, setSuppliers] = useState([]);
    const [finalPriceInput, setFinalPriceInput] = useState('');
    const [internalImageFile, setInternalImageFile] = useState(null);
    const [internalImagePreview, setInternalImagePreview] = useState(null);
    const [isInternalImageChanged, setIsInternalImageChanged] = useState(false);
    const [internalImageRemoved, setInternalImageRemoved] = useState(false);
    const [parents, setParents] = useState({ males: [], females: [] });

    useEffect(() => {
        if (show) {
            axios.get('/management/suppliers/').then(res => {
                setSuppliers(res.data.results || []);
            }).catch(() => toast.warn("لم نتمكن من تحميل الموردين."));

            axios.get('/management/animals/?limit=500').then(res => {
                const allAnimals = res.data.results || [];
                setParents({
                    males: allAnimals.filter(a => a.sex === 'male' && a.id !== animalToEdit?.id),
                    females: allAnimals.filter(a => a.sex === 'female' && a.id !== animalToEdit?.id)
                });
            }).catch(() => console.error("Failed to load parent animals"));
        }
    }, [show, animalToEdit]);

    const handleReorderMedia = (newOrderedList) => {
        setExistingMedia(newOrderedList);
    };

    const handleReorderNewMedia = (index, direction) => {
        if (index + direction < 0 || index + direction >= newMediaFiles.length) return;

        const newItems = [...newMediaFiles];
        const temp = newItems[index];
        newItems[index] = newItems[index + direction];
        newItems[index + direction] = temp;

        setNewMediaFiles(newItems);
    };

    useEffect(() => {
        if (animalToEdit) {
            const isOur = !animalToEdit.source_farm;
            setIsOurFarm(isOur);

            const data = {
                name: animalToEdit.name || '',
                category_id: animalToEdit.category?.id || '',
                sex: animalToEdit.sex || 'male',
                birth_date: animalToEdit.birth_date || '',
                price_egp: animalToEdit.price_egp || '',
                status: animalToEdit.status || 'available',
                purchase_price: animalToEdit.purchase_price || '0.00',
                breed: animalToEdit.breed || '',
                description: animalToEdit.description || '',
                deposit_egp: animalToEdit.deposit_egp || '0.00',
                discount_percent: animalToEdit.discount_percent || '0.00',
                is_offer: animalToEdit.is_offer || false,
                location: animalToEdit.location || '',
                internal_notes: animalToEdit.internal_notes || '',
                is_hidden_from_store: animalToEdit.is_hidden_from_store || false,
                has_defect: animalToEdit.has_defect || false,
                supplier_code: animalToEdit.supplier_code || '',
                source_farm_id: animalToEdit.source_farm?.id || null,
                entry_type: animalToEdit.entry_type || 'purchased',
                initial_weight_kg: animalToEdit.initial_weight_kg || '',
                initial_weight_date: animalToEdit.initial_weight_date || format(new Date(), 'yyyy-MM-dd'),
                mother: animalToEdit.mother || '',
                father: animalToEdit.father || '',
            };

            setFormData(data);
            setAgeInMonths(animalToEdit.age_months || '');
            setFinalPriceInput(animalToEdit.price_after_discount || animalToEdit.price_egp || '');

            setMainImageFile(null);
            setMainImagePreview(animalToEdit.image);
            setIsMainImageChanged(false);

            setExistingMedia(animalToEdit.images || []);
            setDeletedMediaIds([]);
            setNewMediaFiles([]);

            setInternalImageFile(null);
            setInternalImagePreview(animalToEdit.internal_image);
            setIsInternalImageChanged(false);
            setInternalImageRemoved(false);
        }
    }, [animalToEdit]);

    const livestockFarms = suppliers.filter(s => s.supplier_type === 'LIVESTOCK_FARM');

    const handleMainImageChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                validateImage(file);
                setMainImageFile(file);
                setMainImagePreview(URL.createObjectURL(file));
                setIsMainImageChanged(true);
            } catch (error) {
                toast.error(error.message);
            }
        }
    };

    const handleDeleteMainImage = () => {
        if (window.confirm("هل أنت متأكد من حذف الصورة الرئيسية؟")) {
            setMainImageFile(null);
            setMainImagePreview(null);
            setIsMainImageChanged(true);
        }
    };

    const handleAddMedia = (newFiles) => {
        setNewMediaFiles(prev => [...prev, ...newFiles]);
    };

    const handleRemoveExistingMedia = (id) => {
        setExistingMedia(prev => prev.filter(item => item.id !== id));
        setDeletedMediaIds(prev => [...prev, id]);
    };

    const handleRemoveNewMedia = (index) => {
        setNewMediaFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleSetAsMainImage = async (imageId) => {
        if (!window.confirm("هل تريد جعل هذه الصورة هي الصورة الرئيسية؟")) return;
        try {
            await axios.post(`/livestock/animals/${animalToEdit.unique_id}/set-main-image/`, {
                image_id: imageId
            });
            toast.success("تم تحديث الصورة الرئيسية بنجاح");
            onSave();
            handleClose();
        } catch (error) {
            console.error(error);
            toast.error("فشل تحديث الصورة الرئيسية.");
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (value || '')
        }));
    };

    const handleFinancialChange = (e) => {
        const { name, value } = e.target;

        let finalPrice = name === 'final_price_input' ? value : finalPriceInput;
        let discount = name === 'discount_percent' ? value : (formData.discount_percent || 0);

        if (name === 'final_price_input') setFinalPriceInput(value);
        if (name === 'discount_percent') setFormData(prev => ({...prev, discount_percent: value}));

        const finalP = parseFloat(finalPrice) || 0;
        const disc = parseFloat(discount) || 0;

        if (disc >= 0 && disc < 100 && finalP > 0) {
            const basePrice = finalP / (1 - (disc / 100));
            setFormData(prev => ({...prev, price_egp: basePrice.toFixed(2)}));
        } else if (disc === 0) {
            setFormData(prev => ({...prev, price_egp: finalP.toFixed(2)}));
        }
    };

    const handleBirthDateChange = (e) => {
        const dateStr = e.target.value;
        setFormData(prev => ({ ...prev, birth_date: dateStr }));
        if (dateStr) {
            const age = differenceInMonths(new Date(), new Date(dateStr));
            setAgeInMonths(age >= 0 ? age : '');
        } else {
            setAgeInMonths('');
        }
    };

    const handleAgeChange = (e) => {
        const age = e.target.value;
        setAgeInMonths(age);
        if (age && !isNaN(age) && age > 0) {
            const birthDate = subMonths(new Date(), parseInt(age, 10));
            setFormData(prev => ({ ...prev, birth_date: format(birthDate, 'yyyy-MM-dd') }));
        } else {
            setFormData(prev => ({ ...prev, birth_date: '' }));
        }
    };

    const handleInternalImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                validateImage(file);
                setInternalImageFile(file);
                setInternalImagePreview(URL.createObjectURL(file));
                setIsInternalImageChanged(true);
                setInternalImageRemoved(false);
            } catch (error) {
                toast.error(error.message);
            }
        }
    };

    const handleRemoveInternalImage = () => {
        if (window.confirm("هل أنت متأكد من حذف صورة الإثبات الداخلية؟")) {
            setInternalImageFile(null);
            setInternalImagePreview(null);
            setIsInternalImageChanged(true);
            setInternalImageRemoved(true);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isOurFarm && !formData.source_farm_id) {
            toast.error("يجب اختيار المزرعة الموردة.");
            setActiveAccordion('basic-info');
            return;
        }

        setLoading(true);

        const submissionData = new FormData();

        Object.keys(formData).forEach(key => {
            if (['images', 'image', 'category', 'weight_logs', 'health_logs', 'feeding_logs'].includes(key)) return;

            if (key === 'source_farm_id') {
                if (isOurFarm) {
                    submissionData.append('source_farm_id', '');
                } else if (formData.source_farm_id) {
                    submissionData.append('source_farm_id', formData.source_farm_id);
                }
            } else if (key === 'supplier_code') {
                if (isOurFarm) {
                    submissionData.append('supplier_code', '');
                } else {
                    submissionData.append('supplier_code', formData.supplier_code || '');
                }
            } else if (key === 'mother' || key === 'father') {
                const val = formData.entry_type === 'born_on_farm' ? formData[key] : '';
                submissionData.append(key, val || '');
            } else if (formData[key] !== null && formData[key] !== undefined) {
                submissionData.append(key, formData[key]);
            }
        });

        if (isMainImageChanged) {
            if (mainImageFile) {
                try {
                    const compressedMain = await compressImage(mainImageFile);
                    submissionData.append('image', compressedMain);
                } catch (error) {
                    console.error(error);
                    submissionData.append('image', mainImageFile);
                }
            } else {
                submissionData.append('image', '');
            }
        }

        if (isInternalImageChanged) {
            if (internalImageFile) {
                try {
                    const compressed = await compressImage(internalImageFile);
                    submissionData.append('internal_image', compressed);
                } catch (error) {
                    console.error(error);
                    submissionData.append('internal_image', internalImageFile);
                }
            } else if (internalImageRemoved) {
                submissionData.append('internal_image', '');
            }
        }

        for (const item of newMediaFiles) {
            if (item.type === 'image') {
                try {
                    const compressed = await compressImage(item.file);
                    submissionData.append('new_media', compressed);
                } catch (error) {
                    console.error(error);
                    submissionData.append('new_media', item.file);
                }
            } else {
                submissionData.append('new_media', item.file);
            }
        }

        if (deletedMediaIds.length > 0) {
            submissionData.append('deleted_media_ids', deletedMediaIds.join(','));
        }

        try {
            const response = await axios.patch(`/management/animals/${animalToEdit.unique_id}/`, submissionData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const orderData = existingMedia.map((item, index) => ({
                id: item.id,
                order: index
            }));

            if (orderData.length > 0) {
                await axios.post(`/management/animals/${animalToEdit.unique_id}/reorder-images/`, {
                    order_data: orderData
                });
            }

            if (response.data.detail && response.data.detail.includes('للموافقة')) {
                toast.info(response.data.detail);
            } else {
                toast.success("تم الحفظ بنجاح!");
                onSave();
            }
            handleClose();
        } catch (error) {
            console.error(error);
            const msg = error.response?.data?.detail || "فشل الحفظ.";
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!animalToEdit) return null;

    return (
        <>
            <Modal show={show} onHide={handleClose} centered size="lg" scrollable backdrop="static">
                <Modal.Header closeButton className="bg-warning text-dark">
                    <Modal.Title className="fs-5">
                        <Edit size={20} className="me-2" />
                        تعديل: <strong>{animalToEdit.code}</strong>
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSubmit} noValidate>
                        <Accordion activeKey={activeAccordion} onSelect={(key) => setActiveAccordion(key)}>
                            <Accordion.Item eventKey="basic-info">
                                <Accordion.Header><Tag size={18} className="me-2"/> الأساسية والمصدر</Accordion.Header>
                                <Accordion.Body>
                                    <Row className="g-3">
                                        <Col xs={12}>
                                            <div className="p-3 border rounded bg-light mb-3 d-flex flex-wrap gap-4">
                                                <Form.Check
                                                    type="switch"
                                                    name="is_hidden_from_store"
                                                    label="إخفاء من المتجر"
                                                    checked={formData.is_hidden_from_store || false}
                                                    onChange={handleChange}
                                                />
                                                <Form.Check
                                                    type="switch"
                                                    name="has_defect"
                                                    label="به عيب شرعي"
                                                    checked={formData.has_defect || false}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </Col>

                                        <Col xs={12}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>مصدر الحيوان</Form.Label>
                                                <div className="btn-group w-100">
                                                    <Button
                                                        variant={isOurFarm ? "primary" : "outline-primary"}
                                                        onClick={() => setIsOurFarm(true)}
                                                    >
                                                        من مزارعنا
                                                    </Button>
                                                    <Button
                                                        variant={!isOurFarm ? "primary" : "outline-primary"}
                                                        onClick={() => setIsOurFarm(false)}
                                                    >
                                                        من مزارع موثوقة
                                                    </Button>
                                                </div>
                                            </Form.Group>
                                        </Col>

                                        {!isOurFarm && (
                                            <>
                                                <Col xs={12} md={6}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label>اختر المزرعة الموردة</Form.Label>
                                                        <Form.Select
                                                            name="source_farm_id"
                                                            value={formData.source_farm_id || ''}
                                                            onChange={handleChange}
                                                            className="form-control"
                                                        >
                                                            <option value="">-- اختر المزرعة --</option>
                                                            {livestockFarms.map(s => (
                                                                <option key={s.id} value={s.id}>{s.name}</option>
                                                            ))}
                                                        </Form.Select>
                                                    </Form.Group>
                                                </Col>
                                                <Col xs={12} md={6}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label>كود الحيوان عند المورد</Form.Label>
                                                        <Form.Control
                                                            type="text"
                                                            name="supplier_code"
                                                            value={formData.supplier_code || ''}
                                                            onChange={handleChange}
                                                            className="form-control"
                                                        />
                                                    </Form.Group>
                                                </Col>
                                                <Col xs={12} md={12}>
                                                    <Form.Group className="mb-3 p-3 bg-warning bg-opacity-10 border border-warning rounded">
                                                        <Form.Label className="fw-bold text-dark d-flex align-items-center gap-2">
                                                            <ImageIcon size={18} className="text-warning" />
                                                            صورة الإثبات الداخلية (مخفية عن العملاء)
                                                        </Form.Label>
                                                        {internalImagePreview && (
                                                            <div className="mb-3 text-center">
                                                                <Image
                                                                    src={internalImagePreview}
                                                                    thumbnail
                                                                    style={{ maxHeight: '150px', objectFit: 'cover' }}
                                                                />
                                                                <Button
                                                                    variant="outline-danger"
                                                                    size="sm"
                                                                    className="mt-2"
                                                                    onClick={handleRemoveInternalImage}
                                                                >
                                                                    حذف الصورة
                                                                </Button>
                                                            </div>
                                                        )}
                                                        <Form.Control
                                                            type="file"
                                                            name="internal_image"
                                                            accept="image/*"
                                                            onChange={handleInternalImageChange}
                                                            className="form-control"
                                                        />
                                                        <Form.Text className="text-muted small">هذه الصورة للإدارة فقط لإثبات شكل الحيوان أو بوليصة المورد ولن تظهر في المتجر إطلاقاً.</Form.Text>
                                                    </Form.Group>
                                                </Col>
                                            </>
                                        )}

                                        <Col xs={12} md={6}>
                                            <Form.Group>
                                                <Form.Label>الفئة</Form.Label>
                                                <Form.Select
                                                    name="category_id"
                                                    value={formData.category_id || ''}
                                                    onChange={handleChange}
                                                    className="form-control"
                                                >
                                                    <option value="">اختر الفئة...</option>
                                                    {categories.map(c => (
                                                        <option key={c.id} value={c.id}>{c.name_ar}</option>
                                                    ))}
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col xs={12} md={6}>
                                            <Form.Group>
                                                <Form.Label>المكان في المزرعة</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="location"
                                                    value={formData.location || ''}
                                                    onChange={handleChange}
                                                    placeholder="مثال: عنبر 2، حظيرة 1"
                                                    className="form-control"
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col xs={12} md={6}>
                                            <Form.Group>
                                                <Form.Label>الجنس</Form.Label>
                                                <Form.Select
                                                    name="sex"
                                                    value={formData.sex || ''}
                                                    onChange={handleChange}
                                                    className="form-control"
                                                >
                                                    <option value="male">ذكر</option>
                                                    <option value="female">أنثى</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col xs={12} md={6}>
                                            <Form.Group>
                                                <Form.Label>السلالة</Form.Label>
                                                <Form.Control
                                                    type="text"
                                                    name="breed"
                                                    value={formData.breed || ''}
                                                    onChange={handleChange}
                                                    className="form-control"
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col xs={12} md={6}>
                                            <Form.Group>
                                                <Form.Label>العمر (شهور)</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    value={ageInMonths || ''}
                                                    onChange={handleAgeChange}
                                                    placeholder="أدخل العمر"
                                                    className="form-control"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col xs={12} md={6}>
                                            <Form.Group>
                                                <Form.Label>تاريخ الميلاد</Form.Label>
                                                <Form.Control
                                                    type="date"
                                                    name="birth_date"
                                                    value={formData.birth_date || ''}
                                                    onChange={handleBirthDateChange}
                                                    className="form-control"
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col xs={12}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>نوع الإدخال</Form.Label>
                                                <Form.Select
                                                    name="entry_type"
                                                    value={formData.entry_type}
                                                    onChange={handleChange}
                                                    className="form-control"
                                                >
                                                    <option value="purchased">تم شراؤه</option>
                                                    <option value="born_on_farm">مولود بالمزرعة</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>

                                        {formData.entry_type === 'born_on_farm' && (
                                            <>
                                                <Col xs={12} md={6}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label className="text-primary fw-bold">الأب (اختياري)</Form.Label>
                                                        <Form.Select
                                                            name="father"
                                                            value={formData.father || ''}
                                                            onChange={handleChange}
                                                            className="form-control border-primary border-opacity-50"
                                                        >
                                                            <option value="">-- غير معروف / بدون --</option>
                                                            {parents.males.map(p => (
                                                                <option key={p.id} value={p.id}>#{p.code} - {p.category_name}</option>
                                                            ))}
                                                        </Form.Select>
                                                    </Form.Group>
                                                </Col>
                                                <Col xs={12} md={6}>
                                                    <Form.Group className="mb-3">
                                                        <Form.Label className="text-primary fw-bold">الأم (اختياري)</Form.Label>
                                                        <Form.Select
                                                            name="mother"
                                                            value={formData.mother || ''}
                                                            onChange={handleChange}
                                                            className="form-control border-primary border-opacity-50"
                                                        >
                                                            <option value="">-- غير معروف / بدون --</option>
                                                            {parents.females.map(p => (
                                                                <option key={p.id} value={p.id}>#{p.code} - {p.category_name}</option>
                                                            ))}
                                                        </Form.Select>
                                                    </Form.Group>
                                                </Col>
                                            </>
                                        )}

                                        <Col xs={12}>
                                            <Form.Group>
                                                <Form.Label>الوصف</Form.Label>
                                                <Form.Control
                                                    as="textarea"
                                                    rows={3}
                                                    name="description"
                                                    value={formData.description || ''}
                                                    onChange={handleChange}
                                                    placeholder="وصف الحيوان للعملاء"
                                                    className="form-control"
                                                />
                                            </Form.Group>
                                        </Col>

                                        <Col xs={12}>
                                            <Form.Group>
                                                <Form.Label>ملاحظات داخلية (للمزرعة فقط)</Form.Label>
                                                <Form.Control
                                                    as="textarea"
                                                    rows={2}
                                                    name="internal_notes"
                                                    value={formData.internal_notes || ''}
                                                    onChange={handleChange}
                                                    placeholder="ملاحظات إدارية"
                                                    className="form-control"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                </Accordion.Body>
                            </Accordion.Item>

                            <Accordion.Item eventKey="media">
                                <Accordion.Header><ImageIcon size={18} className="me-2"/> الوسائط</Accordion.Header>
                                <Accordion.Body>
                                    <Card className="mb-3 border-primary">
                                        <Card.Header className="bg-primary text-white py-2">
                                            <strong>الصورة الرئيسية</strong>
                                            {isMainImageChanged && <Badge bg="warning" text="dark" className="ms-2">تم التغيير</Badge>}
                                        </Card.Header>
                                        <Card.Body>
                                            <Row className="align-items-center">
                                                <Col xs={4} md={3}>
                                                    <div
                                                        className="position-relative rounded border bg-light overflow-hidden cursor-pointer"
                                                        style={{ height: '120px' }}
                                                        onClick={() => mainImagePreview && setPreviewMedia({ url: mainImagePreview, type: 'image/jpeg' })}
                                                    >
                                                        {mainImagePreview ? (
                                                            <img
                                                                src={mainImagePreview}
                                                                alt="Main"
                                                                className="w-100 h-100 object-fit-cover"
                                                            />
                                                        ) : (
                                                            <div className="w-100 h-100 d-flex align-items-center justify-content-center text-muted">
                                                                <ImageIcon size={32} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </Col>
                                                <Col xs={8} md={9}>
                                                    <div className="d-flex flex-column gap-2">
                                                        <Form.Label className="btn btn-outline-primary btn-sm w-100 mb-0">
                                                            تغيير الصورة الرئيسية
                                                            <Form.Control
                                                                type="file"
                                                                onChange={handleMainImageChange}
                                                                accept="image/*"
                                                                hidden
                                                            />
                                                        </Form.Label>

                                                        {mainImagePreview && (
                                                            <Button
                                                                variant="outline-danger"
                                                                size="sm"
                                                                onClick={handleDeleteMainImage}
                                                            >
                                                                حذف الصورة
                                                            </Button>
                                                        )}
                                                    </div>
                                                </Col>
                                            </Row>
                                        </Card.Body>
                                    </Card>

                                    <MediaManager
                                        existingMedia={existingMedia}
                                        newMedia={newMediaFiles}
                                        onAddMedia={handleAddMedia}
                                        onRemoveExisting={handleRemoveExistingMedia}
                                        onRemoveNew={handleRemoveNewMedia}
                                        onPreview={setPreviewMedia}
                                        onSetAsMainImage={handleSetAsMainImage}
                                        onReorder={handleReorderMedia}
                                        onReorderNew={handleReorderNewMedia}
                                    />

                                    {deletedMediaIds.length > 0 && (
                                        <Alert variant="warning" className="mt-3 py-2 small">
                                            <AlertTriangle size={14} className="me-1"/>
                                            تم تحديد {deletedMediaIds.length} ملفات للحذف.
                                        </Alert>
                                    )}
                                </Accordion.Body>
                            </Accordion.Item>

                            <Accordion.Item eventKey="financial-info">
                                <Accordion.Header><DollarSign size={18} className="me-2"/> المالية</Accordion.Header>
                                <Accordion.Body>
                                    <Row className="g-3">
                                        <Col xs={12} md={4}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>السعر للعميل (بعد الخصم)</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    step="0.01"
                                                    name="final_price_input"
                                                    value={finalPriceInput}
                                                    onChange={handleFinancialChange}
                                                    className="form-control fw-bold text-success"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col xs={12} md={4}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>نسبة الخصم (%)</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    step="0.01"
                                                    name="discount_percent"
                                                    value={formData.discount_percent || '0.00'}
                                                    onChange={handleFinancialChange}
                                                    className="form-control"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col xs={12} md={4}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>السعر الأساسي الدفتري</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    step="0.01"
                                                    name="price_egp"
                                                    value={formData.price_egp || ''}
                                                    readOnly
                                                    className="form-control bg-light text-muted"
                                                    title="يتم حسابه تلقائياً (للمحاسبة)"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <Row className="g-3 mt-2">
                                        <Col xs={12} md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>العربون الثابت (جنيه)</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    step="0.01"
                                                    name="deposit_egp"
                                                    value={formData.deposit_egp || '0.00'}
                                                    onChange={handleChange}
                                                    className="form-control"
                                                    placeholder="اتركه 0 ليحسب بالنسبة المئوية"
                                                />
                                            </Form.Group>
                                        </Col>
                                        <Col xs={12} md={6}>
                                            <Form.Group className="mb-3">
                                                <Form.Label>تكلفة الشراء (دفترية)</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    step="0.01"
                                                    name="purchase_price"
                                                    value={formData.purchase_price || '0.00'}
                                                    onChange={handleChange}
                                                    className="form-control"
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <Row className="g-3 mt-2">
                                        <Col xs={12} md={6}>
                                            <Form.Group>
                                                <Form.Label>الحالة</Form.Label>
                                                <Form.Select
                                                    name="status"
                                                    value={formData.status || ''}
                                                    onChange={handleChange}
                                                    className="form-control"
                                                >
                                                    <option value="available">متاح</option>
                                                    <option value="reserved">محجوز</option>
                                                    <option value="sold">مباع</option>
                                                    <option value="lost">مفقود</option>
                                                </Form.Select>
                                            </Form.Group>
                                        </Col>
                                        <Col xs={12} md={6} className="d-flex align-items-center">
                                            <Form.Group className="w-100">
                                                <Form.Check
                                                    type="switch"
                                                    name="is_offer"
                                                    label="هل عليه عرض؟"
                                                    checked={formData.is_offer || false}
                                                    onChange={handleChange}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                </Accordion.Body>
                            </Accordion.Item>

                            <Accordion.Item eventKey="weight-logs">
                                <Accordion.Header><Weight size={18} className="me-2"/> الأوزان</Accordion.Header>
                                <Accordion.Body>
                                    <WeightLogManager
                                        animalId={animalToEdit.unique_id}
                                        onWeightUpdate={onSave}
                                    />
                                </Accordion.Body>
                            </Accordion.Item>

                            <Accordion.Item eventKey="health-logs">
                                <Accordion.Header><HeartPulse size={18} className="me-2"/> الصحية</Accordion.Header>
                                <Accordion.Body>
                                    <HealthLogManager
                                        animalId={animalToEdit.unique_id}
                                        onHealthUpdate={onSave}
                                    />
                                </Accordion.Body>
                            </Accordion.Item>
                        </Accordion>

                        <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top sticky-bottom bg-white">
                            <Button variant="secondary" onClick={handleClose} disabled={loading}>
                                إلغاء
                            </Button>
                            <Button variant="warning" type="submit" disabled={loading} className="px-4 fw-bold">
                                {loading ? (
                                    <>
                                        <Spinner size="sm" animation="border" className="me-2"/> جاري الحفظ...
                                    </>
                                ) : (
                                    <>
                                        <Edit size={18} className="me-2"/> حفظ
                                    </>
                                )}
                            </Button>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>

            <MediaPreviewModal
                show={!!previewMedia}
                handleClose={() => setPreviewMedia(null)}
                media={previewMedia}
            />
        </>
    );
};

const AddAnimalForm = ({ show, handleClose, onSave, categories }) => {
    const [isOurFarm, setIsOurFarm] = useState(true);
    const [suppliers, setSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        category_id: '',
        sex: 'male',
        birth_date: '',
        price_egp: '',
        status: 'available',
        purchase_price: '0.00',
        breed: '',
        description: '',
        deposit_egp: '0.00',
        discount_percent: '0.00',
        is_offer: false,
        initial_weight_kg: '',
        initial_weight_date: format(new Date(), 'yyyy-MM-dd'),
        entry_type: 'purchased',
        source_farm_id: null,
        supplier_code: '',
        internal_notes: '',
        location: '',
        is_hidden_from_store: false,
        has_defect: false,
        mother: '',
        father: ''
    });
    const [ageInMonths, setAgeInMonths] = useState('');
    const [imageFile, setImageFile] = useState(null);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [imagePreview, setImagePreview] = useState(null);
    const [previewMedia, setPreviewMedia] = useState(null);
    const [activeAccordion, setActiveAccordion] = useState('basic-info');
    const [finalPriceInput, setFinalPriceInput] = useState('');
    const [internalImageFile, setInternalImageFile] = useState(null);
    const [internalImagePreview, setInternalImagePreview] = useState(null);
    const [parents, setParents] = useState({ males: [], females: [] });

    const livestockFarms = suppliers.filter(s => s.supplier_type === 'LIVESTOCK_FARM');

    useEffect(() => {
        if (show) {
            axios.get('/management/suppliers/').then(res => {
                setSuppliers(res.data.results || []);
            }).catch(() => toast.warn("لم نتمكن من تحميل الموردين."));

            axios.get('/management/animals/?limit=500').then(res => {
                const allAnimals = res.data.results || [];
                setParents({
                    males: allAnimals.filter(a => a.sex === 'male'),
                    females: allAnimals.filter(a => a.sex === 'female')
                });
            }).catch(() => console.error("Failed to load parent animals"));

            setIsOurFarm(true);
            setFormData({
                name: '', category_id: '', sex: 'male', birth_date: '',
                price_egp: '', status: 'available', purchase_price: '0.00', breed: '',
                description: '', deposit_egp: '0.00', discount_percent: '0.00', is_offer: false,
                initial_weight_kg: '', initial_weight_date: format(new Date(), 'yyyy-MM-dd'),
                entry_type: 'purchased', source_farm_id: null, supplier_code: '',
                internal_notes: '', location: '', is_hidden_from_store: false, has_defect: false,
                mother: '', father: ''
            });
            setAgeInMonths('');
            setFinalPriceInput('');
            setImageFile(null);
            setImagePreview(null);
            setMediaFiles([]);
            setInternalImageFile(null);
            setInternalImagePreview(null);
            setActiveAccordion('basic-info');
        }
    }, [show]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : (value || '')
        }));
    };

    const handleFinancialChange = (e) => {
        const { name, value } = e.target;

        let finalPrice = name === 'final_price_input' ? value : finalPriceInput;
        let discount = name === 'discount_percent' ? value : (formData.discount_percent || 0);

        if (name === 'final_price_input') setFinalPriceInput(value);
        if (name === 'discount_percent') setFormData(prev => ({...prev, discount_percent: value}));

        const finalP = parseFloat(finalPrice) || 0;
        const disc = parseFloat(discount) || 0;

        if (disc >= 0 && disc < 100 && finalP > 0) {
            const basePrice = finalP / (1 - (disc / 100));
            setFormData(prev => ({...prev, price_egp: basePrice.toFixed(2)}));
        } else if (disc === 0) {
            setFormData(prev => ({...prev, price_egp: finalP.toFixed(2)}));
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        try {
            validateImage(file);
            if (file) {
                setImageFile(file);
                setImagePreview(URL.createObjectURL(file));
            }
        } catch (error) {
            toast.error(error.message);
            e.target.value = null;
        }
    };

    const handleReorderNewMedia = (index, direction) => {
        if (index + direction < 0 || index + direction >= mediaFiles.length) return;

        const newItems = [...mediaFiles];
        const temp = newItems[index];
        newItems[index] = newItems[index + direction];
        newItems[index + direction] = temp;
        setMediaFiles(newItems);
    };

    const handleAddMedia = (newFiles) => {
        setMediaFiles(prev => [...prev, ...newFiles]);
    };

    const handleRemoveMedia = (indexToRemove) => {
        setMediaFiles(prevFiles => prevFiles.filter((_, index) => index !== indexToRemove));
    };

    const handleAgeChange = (e) => {
        const age = e.target.value;
        setAgeInMonths(age);
        if (age && !isNaN(age) && age > 0) {
            const birthDate = subMonths(new Date(), parseInt(age, 10));
            setFormData(prev => ({ ...prev, birth_date: format(birthDate, 'yyyy-MM-dd') }));
        } else {
            setFormData(prev => ({ ...prev, birth_date: '' }));
        }
    };

    const handleBirthDateChange = (e) => {
        const dateStr = e.target.value;
        setFormData(prev => ({ ...prev, birth_date: dateStr }));
        if (dateStr) {
            const age = differenceInMonths(new Date(), new Date(dateStr));
            setAgeInMonths(age >= 0 ? age : '');
        } else {
            setAgeInMonths('');
        }
    };

    const handleInternalImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            try {
                validateImage(file);
                setInternalImageFile(file);
                setInternalImagePreview(URL.createObjectURL(file));
            } catch (error) {
                toast.error(error.message);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.initial_weight_kg) {
            toast.error("الوزن الأولي حقل إجباري.");
            setActiveAccordion('basic-info');
            return;
        }
        if (!imageFile) {
            toast.error("الصورة الرئيسية حقل إجباري.");
            setActiveAccordion('media');
            return;
        }
        if (!formData.birth_date && !ageInMonths) {
            toast.error("يجب إدخال العمر أو تاريخ الميلاد.");
            setActiveAccordion('basic-info');
            return;
        }
        if (!isOurFarm && !formData.source_farm_id) {
            toast.error("يجب اختيار مزرعة موردة.");
            setActiveAccordion('basic-info');
            return;
        }

        setLoading(true);
        const submissionData = new FormData();
        Object.keys(formData).forEach(key => {
            if (formData[key] !== null && formData[key] !== undefined && formData[key] !== '') {
                if (isOurFarm && (key === 'source_farm_id' || key === 'supplier_code')) {
                    return;
                }
                if (key === 'mother' || key === 'father') {
                    const val = formData.entry_type === 'born_on_farm' ? formData[key] : '';
                    if (val) submissionData.append(key, val);
                    return;
                }
                submissionData.append(key, formData[key]);
            }
        });

        if (imageFile) submissionData.append('image', imageFile);

        if (internalImageFile) {
            try {
                const compressed = await compressImage(internalImageFile);
                submissionData.append('internal_image', compressed);
            } catch (error) {
                console.error(error);
                submissionData.append('internal_image', internalImageFile);
            }
        }

        if (mediaFiles.length > 0) {
            mediaFiles.forEach(item => {
                submissionData.append('images', item.file);
            });
        }

        try {
            const response = await axios.post('/management/animals/', submissionData);
            if (response.data.detail && response.data.detail.includes('للموافقة')) {
                toast.info(response.data.detail);
            } else {
                toast.success("تم الإضافة بنجاح!");
                onSave();
            }
            handleClose();
        } catch (error) {
            console.error(error);
            const errorData = error.response?.data;
            const errorMessages = errorData ? Object.entries(errorData).map(([k, v]) => `${k}: ${v}`).join(' | ') : "فشل الحفظ.";
            toast.error(`فشل الحفظ: ${errorMessages}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Modal show={show} onHide={handleClose} centered size="lg" scrollable>
                <Modal.Header closeButton className="bg-primary text-white">
                    <Modal.Title>
                        <PlusCircle size={24} className="me-2" />
                        إضافة حيوان جديد
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Accordion activeKey={activeAccordion} onSelect={(key) => setActiveAccordion(key)}>
                        <Accordion.Item eventKey="basic-info">
                            <Accordion.Header>
                                <div className="d-flex align-items-center">
                                    <Tag size={18} className="me-2" />
                                    <span>المعلومات الأساسية</span>
                                </div>
                            </Accordion.Header>
                            <Accordion.Body>
                                <Row className="g-2">
                                    <Col xs={12}>
                                        <div className="p-3 border rounded bg-light mb-3">
                                            <Form.Label className="fw-bold d-block mb-2">حالة العرض</Form.Label>
                                            <div className="d-flex flex-wrap gap-4">
                                                <Form.Check
                                                    type="switch"
                                                    name="is_hidden_from_store"
                                                    label="إخفاء من المتجر"
                                                    checked={formData.is_hidden_from_store}
                                                    onChange={handleChange}
                                                />
                                                <Form.Check
                                                    type="switch"
                                                    name="has_defect"
                                                    label="به عيب شرعي"
                                                    checked={formData.has_defect}
                                                    onChange={handleChange}
                                                />
                                            </div>
                                        </div>
                                    </Col>

                                    <Col xs={12}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>مصدر الحيوان</Form.Label>
                                            <div className="btn-group w-100">
                                                <Button
                                                    variant={isOurFarm ? "primary" : "outline-primary"}
                                                    onClick={() => setIsOurFarm(true)}
                                                    className="btn"
                                                >
                                                    من مزارعنا
                                                </Button>
                                                <Button
                                                    variant={!isOurFarm ? "primary" : "outline-primary"}
                                                    onClick={() => setIsOurFarm(false)}
                                                    className="btn"
                                                >
                                                    من مزارع موثوقة
                                                </Button>
                                            </div>
                                        </Form.Group>
                                    </Col>

                                    {!isOurFarm && (
                                        <>
                                            <Col xs={12} md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>اختر المزرعة الموردة</Form.Label>
                                                    <Form.Select
                                                        name="source_farm_id"
                                                        value={formData.source_farm_id}
                                                        onChange={handleChange}
                                                        className="form-control"
                                                    >
                                                        <option value="">-- اختر المزرعة --</option>
                                                        {livestockFarms.map(s => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                            <Col xs={12} md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label>كود الحيوان عند المورد</Form.Label>
                                                    <Form.Control
                                                        type="text"
                                                        name="supplier_code"
                                                        value={formData.supplier_code || ''}
                                                        onChange={handleChange}
                                                        className="form-control"
                                                    />
                                                </Form.Group>
                                            </Col>
                                            <Col xs={12} md={12}>
                                                <Form.Group className="mb-3 p-3 bg-warning bg-opacity-10 border border-warning rounded">
                                                    <Form.Label className="fw-bold text-dark d-flex align-items-center gap-2">
                                                        <ImageIcon size={18} className="text-warning" />
                                                        صورة الإثبات الداخلية (مخفية عن العملاء)
                                                    </Form.Label>
                                                    {internalImagePreview && (
                                                        <div className="mb-3 text-center">
                                                            <Image
                                                                src={internalImagePreview}
                                                                thumbnail
                                                                style={{ maxHeight: '150px', objectFit: 'cover' }}
                                                            />
                                                        </div>
                                                    )}
                                                    <Form.Control
                                                        type="file"
                                                        name="internal_image"
                                                        accept="image/*"
                                                        onChange={handleInternalImageChange}
                                                        className="form-control"
                                                    />
                                                    <Form.Text className="text-muted small">هذه الصورة للإدارة فقط لإثبات شكل الحيوان أو بوليصة المورد ولن تظهر في المتجر إطلاقاً.</Form.Text>
                                                </Form.Group>
                                            </Col>
                                        </>
                                    )}

                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>الفئة</Form.Label>
                                            <Form.Select
                                                name="category_id"
                                                value={formData.category_id}
                                                onChange={handleChange}
                                                className="form-control"
                                            >
                                                <option value="">اختر الفئة...</option>
                                                {categories.map(c => (
                                                    <option key={c.id} value={c.id}>{c.name_ar}</option>
                                                ))}
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>المكان في المزرعة</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="location"
                                                value={formData.location || ''}
                                                onChange={handleChange}
                                                placeholder="موقع الحيوان"
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>

                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>نوع الإدخال</Form.Label>
                                            <Form.Select
                                                name="entry_type"
                                                value={formData.entry_type}
                                                onChange={handleChange}
                                                className="form-control"
                                            >
                                                <option value="purchased">تم شراؤه</option>
                                                <option value="born_on_farm">مولود بالمزرعة</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>الجنس</Form.Label>
                                            <Form.Select
                                                name="sex"
                                                value={formData.sex}
                                                onChange={handleChange}
                                                className="form-control"
                                            >
                                                <option value="male">ذكر</option>
                                                <option value="female">أنثى</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>

                                    {formData.entry_type === 'born_on_farm' && (
                                        <>
                                            <Col xs={12} md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label className="text-primary fw-bold">الأب (اختياري)</Form.Label>
                                                    <Form.Select
                                                        name="father"
                                                        value={formData.father || ''}
                                                        onChange={handleChange}
                                                        className="form-control border-primary border-opacity-50"
                                                    >
                                                        <option value="">-- غير معروف / بدون --</option>
                                                        {parents.males.map(p => (
                                                            <option key={p.id} value={p.id}>#{p.code} - {p.category_name}</option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                            <Col xs={12} md={6}>
                                                <Form.Group className="mb-3">
                                                    <Form.Label className="text-primary fw-bold">الأم (اختياري)</Form.Label>
                                                    <Form.Select
                                                        name="mother"
                                                        value={formData.mother || ''}
                                                        onChange={handleChange}
                                                        className="form-control border-primary border-opacity-50"
                                                    >
                                                        <option value="">-- غير معروف / بدون --</option>
                                                        {parents.females.map(p => (
                                                            <option key={p.id} value={p.id}>#{p.code} - {p.category_name}</option>
                                                        ))}
                                                    </Form.Select>
                                                </Form.Group>
                                            </Col>
                                        </>
                                    )}

                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>السلالة</Form.Label>
                                            <Form.Control
                                                type="text"
                                                name="breed"
                                                value={formData.breed || ''}
                                                onChange={handleChange}
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>العمر (بالأشهر)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                value={ageInMonths || ''}
                                                onChange={handleAgeChange}
                                                placeholder="أدخل العمر"
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>

                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>تاريخ الميلاد</Form.Label>
                                            <Form.Control
                                                type="date"
                                                name="birth_date"
                                                value={formData.birth_date}
                                                onChange={handleBirthDateChange}
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>الوزن الأولي (كجم)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                name="initial_weight_kg"
                                                value={formData.initial_weight_kg || ''}
                                                onChange={handleChange}
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>

                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>تاريخ الوزن الأولي</Form.Label>
                                            <Form.Control
                                                type="date"
                                                name="initial_weight_date"
                                                value={formData.initial_weight_date}
                                                onChange={handleChange}
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>

                                    <Col xs={12}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>الوصف</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={3}
                                                name="description"
                                                value={formData.description || ''}
                                                onChange={handleChange}
                                                placeholder="وصف الحيوان"
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>

                                    <Col xs={12}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>ملاحظات داخلية</Form.Label>
                                            <Form.Control
                                                as="textarea"
                                                rows={2}
                                                name="internal_notes"
                                                value={formData.internal_notes || ''}
                                                onChange={handleChange}
                                                placeholder="ملاحظات إدارية"
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Accordion.Body>
                        </Accordion.Item>

                        <Accordion.Item eventKey="media">
                            <Accordion.Header>
                                <div className="d-flex align-items-center">
                                    <ImageIcon size={18} className="me-2" />
                                    <span>الوسائط</span>
                                </div>
                            </Accordion.Header>
                            <Accordion.Body>
                                <Form.Group className="mb-3">
                                    <Form.Label className="fw-bold">
                                        الصورة الرئيسية
                                        <span className="text-danger mx-1">*</span>
                                    </Form.Label>
                                    {imagePreview && (
                                        <div className="mb-3 text-center">
                                            <Image
                                                src={imagePreview}
                                                thumbnail
                                                style={{ maxHeight: '200px', objectFit: 'cover' }}
                                            />
                                        </div>
                                    )}
                                    <Form.Control
                                        type="file"
                                        onChange={handleImageChange}
                                        accept="image/*"
                                        className="form-control"
                                    />
                                </Form.Group>

                                <Form.Label className="fw-bold">صور وفيديوهات المعرض</Form.Label>
                                <MediaManager
                                    existingMedia={[]}
                                    newMedia={mediaFiles}
                                    onAddMedia={handleAddMedia}
                                    onRemoveExisting={() => {}}
                                    onRemoveNew={handleRemoveMedia}
                                    onPreview={setPreviewMedia}
                                    onSetAsMainImage={() => {}}
                                    onReorder={() => {}}
                                    onReorderNew={handleReorderNewMedia}
                                />
                            </Accordion.Body>
                        </Accordion.Item>

                        <Accordion.Item eventKey="financial-info">
                            <Accordion.Header>
                                <div className="d-flex align-items-center">
                                    <DollarSign size={18} className="me-2" />
                                    <span>المعلومات المالية</span>
                                </div>
                            </Accordion.Header>
                            <Accordion.Body>
                                <Row className="g-3">
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>السعر للعميل (بعد الخصم)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                name="final_price_input"
                                                value={finalPriceInput}
                                                onChange={handleFinancialChange}
                                                className="form-control fw-bold text-success"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>نسبة الخصم (%)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                name="discount_percent"
                                                value={formData.discount_percent || '0.00'}
                                                onChange={handleFinancialChange}
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={4}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>السعر الأساسي الدفتري</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                name="price_egp"
                                                value={formData.price_egp || ''}
                                                readOnly
                                                className="form-control bg-light text-muted"
                                                title="يتم حسابه تلقائياً (للمحاسبة)"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row className="g-3 mt-2">
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>العربون (جنيه)</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                name="deposit_egp"
                                                value={formData.deposit_egp || '0.00'}
                                                onChange={handleChange}
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>تكلفة الشراء</Form.Label>
                                            <Form.Control
                                                type="number"
                                                step="0.01"
                                                name="purchase_price"
                                                value={formData.purchase_price || '0.00'}
                                                onChange={handleChange}
                                                className="form-control"
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Row className="g-3 mt-2">
                                    <Col xs={12} md={6}>
                                        <Form.Group className="mb-3">
                                            <Form.Label>الحالة</Form.Label>
                                            <Form.Select
                                                name="status"
                                                value={formData.status}
                                                onChange={handleChange}
                                                className="form-control"
                                            >
                                                <option value="available">متاح</option>
                                                <option value="reserved">محجوز</option>
                                                <option value="sold">مباع</option>
                                                <option value="lost">مفقود</option>
                                            </Form.Select>
                                        </Form.Group>
                                    </Col>
                                    <Col xs={12} md={6} className="d-flex align-items-center">
                                        <Form.Group className="w-100">
                                            <Form.Check
                                                type="switch"
                                                name="is_offer"
                                                label="هل عليه عرض؟"
                                                checked={formData.is_offer}
                                                onChange={handleChange}
                                            />
                                        </Form.Group>
                                    </Col>
                                </Row>
                            </Accordion.Body>
                        </Accordion.Item>
                    </Accordion>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={handleClose}>
                        إلغاء
                    </Button>
                    <Button variant="primary" onClick={handleSubmit} disabled={loading}>
                        <PlusCircle size={20} className="me-2" />
                        {loading ? 'جاري...' : 'إضافة الحيوان'}
                    </Button>
                </Modal.Footer>
            </Modal>

            <MediaPreviewModal
                show={!!previewMedia}
                handleClose={() => setPreviewMedia(null)}
                media={previewMedia}
            />
        </>
    );
};

const ConfirmationModal = ({ show, handleClose, title, body, onConfirm, confirmVariant = 'danger' }) => (
    <Modal show={show} onHide={handleClose} centered>
        <Modal.Header closeButton>
            <Modal.Title>{title}</Modal.Title>
        </Modal.Header>
        <Modal.Body>{body}</Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
            <Button variant={confirmVariant} onClick={onConfirm}>تأكيد</Button>
        </Modal.Footer>
    </Modal>
);

const SacrificeBadge = ({ animal }) => {
    const { is_sacrifice_valid_now, eid_prediction, has_defect } = animal;

    if (has_defect) {
        return (
            <OverlayTrigger
                overlay={<Tooltip>به عيب شرعي لا يصلح للأضحية</Tooltip>}
            >
                <Badge bg="danger" className="d-flex align-items-center gap-1">
                    <AlertTriangle size={12}/> معيب شرعي
                </Badge>
            </OverlayTrigger>
        );
    }

    if (is_sacrifice_valid_now) {
        return (
            <OverlayTrigger overlay={<Tooltip>صالح للأضحية الآن</Tooltip>}>
                <Badge bg="success" className="d-flex align-items-center gap-1">
                    <CheckCircle size={12}/> أضحية الآن
                </Badge>
            </OverlayTrigger>
        );
    }

    if (eid_prediction?.is_valid) {
        return (
            <OverlayTrigger overlay={
                <Tooltip>
                    متوقع أن يكون صالحاً يوم العيد
                </Tooltip>
            }>
                <Badge bg="info" text="dark" className="d-flex align-items-center gap-1">
                    <CheckCircle size={12}/> أضحية في العيد
                </Badge>
            </OverlayTrigger>
        );
    }

    return <Badge bg="secondary">غير أضحية</Badge>;
};

function Livestock() {
    const [animals, setAnimals] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totalCount, setTotalCount] = useState(0);
    const [searchParams, setSearchParams] = useSearchParams();

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [animalToEdit, setAnimalToEdit] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);
    const [animalToView, setAnimalToView] = useState(null);
    const [confirmModal, setConfirmModal] = useState({
        show: false,
        title: '',
        body: '',
        onConfirm: () => {}
    });

    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState({
        search: searchParams.get('search') || '',
        status: searchParams.get('status') || '',
        category: searchParams.get('category') || '',
        price_min: searchParams.get('price_min') || '',
        price_max: searchParams.get('price_max') || '',
        weight_min: searchParams.get('weight_min') || '',
        weight_max: searchParams.get('weight_max') || '',
        age_min: searchParams.get('age_min') || '',
        age_max: searchParams.get('age_max') || '',
        is_hidden: 'all',
        has_defect: 'all',
        ordering: '-created_at'
    });

    const [selectedIds, setSelectedIds] = useState([]);
    const [bulkActionLoading, setBulkActionLoading] = useState(false);

    const statusMap = {
        available: 'متاح',
        reserved: 'محجوز',
        sold: 'مباع',
        lost: 'مفقود'
    };

    const statusColorMap = {
        available: 'success',
        reserved: 'primary',
        sold: 'danger',
        lost: 'dark'
    };

    const getLastWeight = (animal) => {
        if (animal.current_weight) return animal.current_weight;

        if (animal.weight_logs?.length > 0) {
             const sortedLogs = [...animal.weight_logs].sort((a, b) =>
                new Date(b.date) - new Date(a.date)
            );
            return sortedLogs[0].weight_kg;
        }

        return animal.initial_weight_kg || 0;
    };

    const fetchAnimals = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                price_min: filters.price_min,
                price_max: filters.price_max,
                weight_min: filters.weight_min,
                weight_max: filters.weight_max,
                ordering: filters.ordering,
            });

            if (filters.status) {
                params.append('status', filters.status);
            }

            if (filters.category) params.append('category', filters.category);
            if (filters.search) params.append('search', filters.search);
            if (filters.age_min) params.append('age_min', filters.age_min);
            if (filters.age_max) params.append('age_max', filters.age_max);

            setSearchParams(params, { replace: true });

            const [animalsRes, categoriesRes] = await Promise.all([
                axios.get("/management/animals/", { params }),
                axios.get('/livestock/categories/')
            ]);

            let fetchedAnimals = animalsRes.data.results || animalsRes.data || [];

            if (filters.is_hidden !== 'all') {
                const isHidden = filters.is_hidden === 'hidden';
                fetchedAnimals = fetchedAnimals.filter(a => a.is_hidden_from_store === isHidden);
            }

            if (filters.has_defect !== 'all') {
                const hasDefect = filters.has_defect === 'yes';
                fetchedAnimals = fetchedAnimals.filter(a => a.has_defect === hasDefect);
            }

            setAnimals(fetchedAnimals);
            setTotalCount(fetchedAnimals.length);
            setCategories(categoriesRes.data.results || categoriesRes.data || []);

        } catch (error) {
            console.error(error);
            toast.error("فشل تحميل البيانات.");
        } finally {
            setLoading(false);
        }
    }, [filters, setSearchParams]);

    useEffect(() => {
        fetchAnimals();
    }, [fetchAnimals]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    const resetFilters = () => {
        setFilters({
            search: '', status: '', category: '', is_hidden: 'all', has_defect: 'all',
            price_min: '', price_max: '', weight_min: '', weight_max: '', age_min: '', age_max: '',
            ordering: '-created_at'
        });
        setSearchParams({}, { replace: true });
    };

    const handleDelete = async (animalId) => {
        try {
            const response = await axios.delete(`/management/animals/${animalId}/`);
            if (response.data.detail && response.data.detail.includes('للموافقة')) {
                toast.info(response.data.detail);
            } else {
                toast.success(response.data.detail);
                fetchAnimals();
            }
        } catch (error) {
            toast.error(error.response?.data?.detail || "فشل الحذف.");
        }
        setConfirmModal({ show: false });
    };

    const showConfirmDelete = (animal) => {
        setConfirmModal({
            show: true,
            title: 'تأكيد الحذف',
            body: `هل أنت متأكد من حذف الحيوان رقم "${animal.code}"؟`,
            onConfirm: () => handleDelete(animal.unique_id)
        });
    };

    const handleEditClick = (animal) => {
        setAnimalToEdit(animal);
        setShowEditModal(true);
    };

    const handleViewClick = (animal) => {
        setAnimalToView(animal);
        setShowViewModal(true);
    };

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allIds = animals.map(a => a.id);
            setSelectedIds(allIds);
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(item => item !== id));
        } else {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const handleBulkAction = async (action) => {
        if (selectedIds.length === 0) return;

        let confirmMsg = "";
        if (action === 'delete') confirmMsg = `هل أنت متأكد من حذف ${selectedIds.length} حيوان؟`;
        if (action === 'hide') confirmMsg = `هل أنت متأكد من إخفاء ${selectedIds.length} حيوان؟`;
        if (action === 'show') confirmMsg = `هل أنت متأكد من إظهار ${selectedIds.length} حيوان؟`;

        if (!window.confirm(confirmMsg)) return;

        setBulkActionLoading(true);
        try {
            const res = await axios.post('/livestock/animals/bulk-action/', {
                action: action,
                ids: selectedIds
            });
            toast.success(res.data.detail);
            setSelectedIds([]);
            fetchAnimals();
        } catch (error) {
            console.error(error);
            toast.error(error.response?.data?.detail || "فشل تنفيذ الإجراء");
        } finally {
            setBulkActionLoading(false);
        }
    };

    const handleRestoreToStore = async (animal) => {
        if (!window.confirm(`هل أنت متأكد من رغبتك في إعادة الحيوان #${animal.code} إلى المتجر؟ سيتم مسح أي إعدادات مجموعات عالقة له.`)) return;

        try {
            await axios.post(`/management/animals/${animal.unique_id}/restore-to-store/`);
            toast.success("تم إصلاح حالة الحيوان وإعادته للمتجر بنجاح!");
            fetchAnimals();
        } catch (error) {
            toast.error(error.response?.data?.detail || "فشل إصلاح حالة الحيوان.");
        }
    };

    const checkAccess = useHasPermission();
    const canEditDirectly = checkAccess('livestock', 'FULL_ACCESS');
    const needsApproval = checkAccess('livestock', 'REQUIRE_APPROVAL');
    const isViewOnly = checkAccess('livestock', 'VIEW_ONLY') && !canEditDirectly && !needsApproval;

    return (
        <div className="container-fluid py-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4 gap-3">
                <div>
                    <h1 className="h3 mb-1 fw-bold">
                        إدارة المواشي ({totalCount})
                    </h1>
                    <p className="text-muted mb-0">سجل شامل لجميع الحيوانات</p>
                </div>
                <div className="d-flex gap-2">
                    <Button variant="outline-secondary" onClick={() => setShowFilters(!showFilters)}>
                        <Filter size={18} className="me-2"/> تصفية
                    </Button>
                    {!isViewOnly && (
                        <Button onClick={() => setShowAddModal(true)} variant="primary" className="shadow">
                            <PlusCircle size={18} className="me-2" />
                            {needsApproval ? 'طلب إضافة حيوان' : 'إضافة حيوان'}
                        </Button>
                    )}
                </div>
            </div>

            {selectedIds.length > 0 && (
                <div className="fixed-bottom bg-white p-3 shadow-lg border-top d-flex justify-content-between align-items-center" style={{ left: 0, right: 0, zIndex: 100 }}>
                    <div className="container d-flex justify-content-between align-items-center flex-wrap gap-2">
                        <span className="fw-bold text-primary">{selectedIds.length} عنصر محدد</span>
                        <div className="d-flex gap-2 flex-wrap">
                            <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => handleBulkAction('hide')}
                                disabled={bulkActionLoading}
                            >
                                <EyeOff size={16} className="me-1"/> إخفاء
                            </Button>
                            <Button
                                variant="outline-success"
                                size="sm"
                                onClick={() => handleBulkAction('show')}
                                disabled={bulkActionLoading}
                            >
                                <Eye size={16} className="me-1"/> إظهار
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={() => handleBulkAction('delete')}
                                disabled={bulkActionLoading}
                            >
                                <Trash2 size={16} className="me-1"/> حذف نهائي
                            </Button>
                             <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setSelectedIds([])}
                            >
                                إلغاء
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            <Collapse in={showFilters}>
                <Card className="mb-4 shadow-sm border-0 bg-light">
                    <Card.Body>
                        <Row className="g-3">
                            <Col xs={12} md={6} lg={3}>
                                <Form.Label className="small fw-bold">بحث عام</Form.Label>
                                <InputGroup>
                                    <InputGroup.Text><Search size={16}/></InputGroup.Text>
                                    <Form.Control
                                        placeholder="كود، اسم، أو وصف..."
                                        name="search"
                                        value={filters.search}
                                        onChange={handleFilterChange}
                                        className="form-control"
                                    />
                                </InputGroup>
                            </Col>
                            <Col xs={12} md={6} lg={3}>
                                <Form.Label className="small fw-bold">الحالة</Form.Label>
                                <Form.Select name="status" value={filters.status} onChange={handleFilterChange} className="form-control">
                                    <option value="">الكل</option>
                                    <option value="available">متاح</option>
                                    <option value="reserved">محجوز</option>
                                    <option value="sold">مباع</option>
                                    <option value="lost">مفقود</option>
                                </Form.Select>
                            </Col>
                            <Col xs={12} md={6} lg={3}>
                                <Form.Label className="small fw-bold">الفئة</Form.Label>
                                <Form.Select name="category" value={filters.category} onChange={handleFilterChange} className="form-control">
                                    <option value="">كل الفئات</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                                </Form.Select>
                            </Col>
                            <Col xs={12} md={6} lg={3}>
                                <Form.Label className="small fw-bold">الظهور</Form.Label>
                                <Form.Select name="is_hidden" value={filters.is_hidden} onChange={handleFilterChange} className="form-control">
                                    <option value="all">الكل</option>
                                    <option value="visible">المعروض</option>
                                    <option value="hidden">المخفي</option>
                                </Form.Select>
                            </Col>

                            <Col xs={12} md={6} lg={3}>
                                <Form.Label className="small fw-bold">السعر</Form.Label>
                                <div className="d-flex gap-2">
                                    <Form.Control type="number" placeholder="Min" name="price_min" value={filters.price_min} onChange={handleFilterChange} size="sm" className="form-control"/>
                                    <Form.Control type="number" placeholder="Max" name="price_max" value={filters.price_max} onChange={handleFilterChange} size="sm" className="form-control"/>
                                </div>
                            </Col>
                            <Col xs={12} md={6} lg={3}>
                                <Form.Label className="small fw-bold">الوزن (كجم)</Form.Label>
                                <div className="d-flex gap-2">
                                    <Form.Control type="number" placeholder="Min" name="weight_min" value={filters.weight_min} onChange={handleFilterChange} size="sm" className="form-control"/>
                                    <Form.Control type="number" placeholder="Max" name="weight_max" value={filters.weight_max} onChange={handleFilterChange} size="sm" className="form-control"/>
                                </div>
                            </Col>
                            <Col xs={12} md={6} lg={3}>
                                <Form.Label className="small fw-bold">العمر (شهر)</Form.Label>
                                <div className="d-flex gap-2">
                                    <Form.Control type="number" placeholder="Min" name="age_min" value={filters.age_min} onChange={handleFilterChange} size="sm" className="form-control"/>
                                    <Form.Control type="number" placeholder="Max" name="age_max" value={filters.age_max} onChange={handleFilterChange} size="sm" className="form-control"/>
                                </div>
                            </Col>
                            <Col xs={12} md={6} lg={3}>
                                <Form.Label className="small fw-bold">عيوب شرعية</Form.Label>
                                <Form.Select name="has_defect" value={filters.has_defect} onChange={handleFilterChange} className="form-control">
                                    <option value="all">الكل</option>
                                    <option value="no">سليم</option>
                                    <option value="yes">به عيب</option>
                                </Form.Select>
                            </Col>

                            <Col xs={12} className="text-end">
                                <Button variant="link" className="text-danger p-0 text-decoration-none" onClick={resetFilters}>
                                    <X size={14} className="me-1"/> إعادة تعيين
                                </Button>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            </Collapse>

            {loading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="mt-2 text-muted">جاري التحميل...</p>
                </div>
            ) : animals.length === 0 ? (
                <div className="text-center py-5 bg-white rounded shadow-sm border border-dashed">
                    <div className="mb-3"><Search size={48} className="text-muted opacity-50" /></div>
                    <h5 className="text-muted">لا توجد نتائج</h5>
                    <Button variant="link" onClick={resetFilters}>عرض الكل</Button>
                </div>
            ) : (
                <Row className="g-3">
                    {animals.length > 0 && (
                        <Col xs={12}>
                            <div className="bg-light p-2 rounded d-flex align-items-center mb-2">
                                <FormCheck
                                    type="checkbox"
                                    id="select-all"
                                    label="تحديد الكل في هذه الصفحة"
                                    checked={selectedIds.length === animals.length && animals.length > 0}
                                    onChange={handleSelectAll}
                                    className="fw-bold"
                                />
                            </div>
                        </Col>
                    )}

                    {animals.map(animal => {
                        const currentWeight = getLastWeight(animal);
                        const displayStatus = animal.detailed_display_status || {
                            label: statusMap[animal.status] || animal.status,
                            color: statusColorMap[animal.status] || 'secondary',
                            details: ''
                        };

                        return (
                            <Col key={animal.id} xs={12} sm={6} lg={4} xl={3}>
                                <Card className={`h-100 shadow-sm ${animal.status === 'sold' ? 'border-start border-danger border-4 bg-light' : ''} ${selectedIds.includes(animal.id) ? 'border-primary bg-primary bg-opacity-10' : ''}`}>
                                    <div className="position-relative top-0 start-0 p-2 z-3">
                                        <FormCheck
                                            type="checkbox"
                                            checked={selectedIds.includes(animal.id)}
                                            onChange={() => handleSelectOne(animal.id)}
                                            style={{ transform: 'scale(1.3)' }}
                                        />
                                    </div>

                                    <div className="position-relative">
                                        <div style={{ height: '200px', overflow: 'hidden' }} className="bg-light d-flex align-items-center justify-content-center">
                                            {animal.image ? (
                                                <Image src={animal.image} className="w-100 h-100 object-fit-cover" />
                                            ) : (
                                                <span className="text-muted small">لا توجد صورة</span>
                                            )}
                                        </div>

                                        <div className="position-absolute top-0 end-0 p-2 d-flex flex-column gap-1">
                                            <OverlayTrigger
                                                placement="bottom"
                                                overlay={<Tooltip>{displayStatus.details}</Tooltip>}
                                            >
                                                <Badge bg={displayStatus.color} className="shadow-sm border border-light">
                                                    {displayStatus.label}
                                                </Badge>
                                            </OverlayTrigger>
                                            {animal.is_hidden_from_store && <Badge bg="secondary"><EyeOff size={10} className="me-1"/>مخفي</Badge>}
                                    {animal.has_discount && <Badge bg="danger" className="shadow-sm border border-light">خصم {animal.discount_percent}%</Badge>}
                                        </div>
                                        <div className="position-absolute bottom-0 start-0 p-2">
                                            <SacrificeBadge animal={animal} />
                                        </div>
                                    </div>
                                    <Card.Body className="p-3">
                                        <div className="d-flex justify-content-between mb-2">
                                            <h6 className="fw-bold mb-0">#{animal.code}</h6>
                                            {animal.has_discount ? (
                                        <div className="text-end">
                                            <span className="text-muted text-decoration-line-through small d-block" style={{fontSize: '10px'}}>{parseFloat(animal.price_egp).toLocaleString()} ج.م</span>
                                            <span className="text-success fw-bold">{parseFloat(animal.price_after_discount).toLocaleString()} ج.م</span>
                                        </div>
                                    ) : (
                                        <span className="text-primary fw-bold">{parseFloat(animal.price_egp).toLocaleString()} ج.م</span>
                                    )}
                                        </div>

                                        <div className="d-flex flex-wrap gap-2 mb-3 text-muted small">
                                            <span className="d-flex align-items-center gap-1 bg-white px-2 py-1 rounded border">
                                                <Tag size={12}/> {animal.category_name}
                                            </span>
                                            <span className="d-flex align-items-center gap-1 bg-white px-2 py-1 rounded border">
                                                <Scale size={12}/>
                                                <strong>{currentWeight}</strong> كجم
                                            </span>
                                            <span className="d-flex align-items-center gap-1 bg-white px-2 py-1 rounded border">
                                                <Calendar size={12}/> {animal.age_months} شهر
                                            </span>
                                            <span className={`d-flex align-items-center gap-1 px-2 py-1 rounded border ${animal.source_farm ? 'bg-info bg-opacity-10 text-info border-info' : 'bg-success bg-opacity-10 text-success border-success'}`}>
                                                {animal.source_farm ? <Truck size={12}/> : <Home size={12}/>}
                                                <strong style={{ fontSize: '11px' }}>{animal.source_farm ? animal.source_farm.name : 'مزارعنا'}</strong>
                                            </span>
                                        </div>

                                        {animal.status === 'sold' && animal.sold_date && (
                                            <div className="alert alert-danger py-2 px-2 small mb-3 text-center border-danger border-opacity-50">
                                                <div className="fw-bold mb-1 text-danger d-flex align-items-center justify-content-center gap-1">
                                                    <CheckCircle size={14} />
                                                    مباع في طلب #{animal.sold_order_id}
                                                </div>
                                                <div className="text-dark fw-semibold text-truncate mb-1">
                                                    العميل: {animal.sold_customer_name}
                                                </div>
                                                <div className="text-muted" dir="ltr">
                                                    {format(new Date(animal.sold_date), 'yyyy-MM-dd hh:mm a')}
                                                </div>
                                            </div>
                                        )}

                                        {animal.status === 'available' && displayStatus.details?.includes('مخزون') && (
                                            <div className="mb-2">
                                                <Button
                                                    variant="success"
                                                    size="sm"
                                                    className="w-100 fw-bold d-flex align-items-center justify-content-center gap-1 shadow-sm animate-pulse"
                                                    onClick={() => handleRestoreToStore(animal)}
                                                >
                                                    <RefreshCw size={14} /> إصلاح وعرض في المتجر
                                                </Button>
                                            </div>
                                        )}

                                        <div className="d-flex gap-2 mt-auto">
                                            <Button variant="outline-info" size="sm" className="flex-fill" onClick={() => handleViewClick(animal)}>
                                                <Eye size={14} className="me-1"/> عرض
                                            </Button>
                                            {!isViewOnly && (
                                                <>
                                                    <Button variant="outline-primary" size="sm" className="flex-fill" onClick={() => handleEditClick(animal)}>
                                                        <Edit size={14} className="me-1"/>
                                                        {needsApproval ? 'طلب تعديل' : 'تعديل'}
                                                    </Button>
                                                    <Button variant="outline-danger" size="sm" className="flex-fill" onClick={() => showConfirmDelete(animal)}>
                                                        <Trash2 size={14} className="me-1"/>
                                                        {needsApproval ? 'طلب حذف' : 'حذف'}
                                                    </Button>
                                                </>
                                            )}
                                            {animal.source_farm && animal.status !== 'lost' && !isViewOnly && (
                                                <Button
                                                    variant="warning"
                                                    size="sm"
                                                    className="flex-fill d-flex align-items-center justify-content-center fw-bold"
                                                    title="المورد باع الحيوان"
                                                    onClick={async () => {
                                                        if(window.confirm("تحذير: سيتم تحويل أي طلبات مرتبطة بهذا الحيوان إلى (يتطلب تدخل). هل أنت متأكد؟")) {
                                                            try {
                                                                const res = await axios.post(`/management/animals/${animal.unique_id}/mark-supplier-sold/`);
                                                                toast.success(res.data.detail);
                                                                fetchAnimals();
                                                            } catch {
                                                                toast.error("فشل الإجراء");
                                                            }
                                                        }
                                                    }}
                                                >
                                                    <AlertTriangle size={14} className="me-1"/> إبلاغ مباع
                                                </Button>
                                            )}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>
                        );
                    })}
                </Row>
            )}

            <AddAnimalForm
                show={showAddModal}
                handleClose={() => setShowAddModal(false)}
                onSave={fetchAnimals}
                categories={categories}
            />

            <EditAnimalForm
                show={showEditModal}
                handleClose={() => setShowEditModal(false)}
                onSave={fetchAnimals}
                animalToEdit={animalToEdit}
                categories={categories}
            />

            <ViewAnimalModal
                show={showViewModal}
                handleClose={() => setShowViewModal(false)}
                animal={animalToView}
            />

            <ConfirmationModal
                show={confirmModal.show}
                handleClose={() => setConfirmModal({ ...confirmModal, show: false })}
                title={confirmModal.title}
                body={confirmModal.body}
                onConfirm={confirmModal.onConfirm}
            />
        </div>
    );
}

export default Livestock;
