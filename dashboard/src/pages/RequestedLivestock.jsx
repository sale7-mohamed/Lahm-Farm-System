import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Table, Badge, Button, Modal, Form, Spinner, Row, Col, Image, Nav, Card, Accordion } from 'react-bootstrap';
import { format } from 'date-fns';
import { X, CheckCircle, Clock, Search, Plus, User, Calendar, Tag, RefreshCw } from 'lucide-react';
import { validateImage } from '../utils/fileValidators';
import { compressImage } from '../utils/fileHelpers';

const FulfillRequestModal = ({ show, handleClose, request, onFulfilled, categories }) => {
    const [mode, setMode] = useState('select');
    const [selectedAnimalId, setSelectedAnimalId] = useState('');
    const [animals, setAnimals] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [filteredAnimals, setFilteredAnimals] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    const [suppliers, setSuppliers] = useState([]);
    const [isOurFarm, setIsOurFarm] = useState(true);
    const [newAnimalData, setNewAnimalData] = useState({});
    const [imageFile, setImageFile] = useState(null);
    const [additionalImageFiles, setAdditionalImageFiles] = useState([]);
    const [imagePreview, setImagePreview] = useState(null);
    const [additionalImagePreviews, setAdditionalImagePreviews] = useState([]);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (show && request) {
            setMode('select');
            setSelectedAnimalId(request.sourced_animal_details?.id || '');
            setIsOurFarm(true);
            setNewAnimalData({
                sex: 'male',
                birth_date: '',
                initial_weight_kg: '',
                initial_weight_date: format(new Date(), 'yyyy-MM-dd'),
                status: 'available',
                entry_type: 'purchased',
                category_id: '',
                price_egp: '',
                purchase_price: '0.00',
                deposit_egp: '0.00',
                source_farm_id: '',
                supplier_code: '',
                location: '',
                internal_notes: '',
                description: ''
            });
            setImageFile(null);
            setImagePreview(null);
            setAdditionalImageFiles([]);
            setAdditionalImagePreviews([]);
            setSearchTerm('');

            axios.get('/management/animals/?status=available&limit=100')
                .then(res => setAnimals(res.data.results || []))
                .catch(() => toast.error("فشل تحميل الحيوانات المتاحة."));

            axios.get('/management/suppliers/')
                .then(res => setSuppliers(res.data.results || []))
                .catch(() => {});
        }
    }, [show, request]);

    useEffect(() => {
        if (searchTerm) {
            const filtered = animals.filter(animal =>
                animal.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                animal.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                animal.price_egp?.toString().includes(searchTerm)
            );
            setFilteredAnimals(filtered);
        } else {
            setFilteredAnimals(animals);
        }
    }, [searchTerm, animals]);

    const handleFulfillExisting = async () => {
        if (!selectedAnimalId) {
            toast.warn("يرجى اختيار حيوان لتلبية الطلب.");
            return;
        }
        setLoading(true);
        try {
            await axios.post(`/management/special-requests/${request.id}/source-animal/`, {
                animal_id: selectedAnimalId
            });
            toast.success("تم ربط الحيوان بالطلب بنجاح.");
            onFulfilled();
            handleClose();
        } catch {
            toast.error("فشل تلبية الطلب.");
        } finally {
            setLoading(false);
        }
    };

    const handleFulfillNew = async () => {
        if (!newAnimalData.initial_weight_kg || !imageFile || !newAnimalData.category_id || !newAnimalData.price_egp) {
            toast.warn("يرجى إكمال الحقول الإجبارية (الوزن، الفئة، السعر، الصورة).");
            return;
        }

        setLoading(true);
        const submissionData = new FormData();
        Object.keys(newAnimalData).forEach(key => {
            if (newAnimalData[key] !== null && newAnimalData[key] !== '') {
                if (isOurFarm && (key === 'source_farm_id' || key === 'supplier_code')) return;
                submissionData.append(key, newAnimalData[key]);
            }
        });

        if (imageFile) {
            try {
                const compressed = await compressImage(imageFile);
                submissionData.append('image', compressed);
            } catch {
                submissionData.append('image', imageFile);
            }
        }

        additionalImageFiles.forEach(file => submissionData.append('images', file));

        try {
            await axios.post(`/management/special-requests/${request.id}/source-new-animal/`, submissionData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success("تم إنشاء حيوان جديد وربطه بالطلب بنجاح.");
            onFulfilled();
            handleClose();
        } catch {
            toast.error("فشل إنشاء الحيوان الجديد.");
        } finally {
            setLoading(false);
        }
    };

    const handleNewAnimalChange = (e) => setNewAnimalData(p => ({...p, [e.target.name]: e.target.value}));

    const handleImageChange = async (e) => {
        if (e.target.files[0]) {
            try {
                validateImage(e.target.files[0]);
                setImageFile(e.target.files[0]);
                setImagePreview(URL.createObjectURL(e.target.files[0]));
            } catch (err) {
                toast.error(err.message);
            }
        }
    };

    const handleAdditionalImagesChange = (e) => {
        const files = Array.from(e.target.files);
        setAdditionalImageFiles(files);
        setAdditionalImagePreviews(files.map(f => URL.createObjectURL(f)));
    };

    const livestockFarms = suppliers.filter(s => s.supplier_type === 'LIVESTOCK_FARM');

    const MobileAnimalCard = ({ animal, isSelected, onClick }) => (
        <Card className={`mb-2 border ${isSelected ? 'border-primary border-2 bg-primary bg-opacity-10' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
            <Card.Body className="p-2 d-flex gap-2 align-items-center">
                {animal.image ? (
                    <Image src={animal.image} style={{ width: '50px', height: '50px', objectFit: 'cover' }} rounded />
                ) : (
                    <div className="bg-secondary rounded" style={{ width: '50px', height: '50px' }}></div>
                )}
                <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-1 mb-1">
                        <Tag size={14} className="text-primary" />
                        <span className="fw-bold small">{animal.code}</span>
                    </div>
                    <div className="small text-muted">{animal.category_name} - {animal.current_weight} كجم</div>
                </div>
                <div className="text-end fw-bold text-success small">{animal.price_after_discount || animal.price_egp} ج.م</div>
            </Card.Body>
        </Card>
    );

    return (
        <Modal show={show} onHide={handleClose} size={isMobile ? "md" : "lg"} fullscreen={isMobile ? "sm-down" : undefined} centered>
            <Modal.Header closeButton className="border-bottom-0 pb-1">
                <Modal.Title className={isMobile ? 'h6' : 'h5'}>
                    توفير حيوان للطلب الخاص #{request?.id}
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                <Card className="border mb-3 bg-light">
                    <Card.Body className="p-2 p-md-3">
                        <h6 className="mb-2 fw-bold text-primary">المواصفات التي طلبها العميل:</h6>
                        <div className="small d-flex flex-wrap gap-3">
                            {Object.entries(request?.requested_specs || {}).map(([key, value]) => (
                                value && (
                                    <div key={key} className="bg-white px-2 py-1 rounded border shadow-sm">
                                        <span className="text-muted me-1">{key}:</span>
                                        <span className="fw-bold">{value}</span>
                                    </div>
                                )
                            ))}
                        </div>
                        {request?.notes && (
                            <div className="mt-2 small text-muted"><strong>ملاحظات العميل:</strong> {request.notes}</div>
                        )}
                    </Card.Body>
                </Card>

                <Nav variant="pills" activeKey={mode} onSelect={(k) => setMode(k)} className="mb-3">
                    <Nav.Item className="flex-fill text-center">
                        <Nav.Link eventKey="select" className={`${isMobile ? 'small py-2' : 'py-2'} fw-bold`}>
                            <Search size={16} className="me-1"/> ربط بحيوان موجود
                        </Nav.Link>
                    </Nav.Item>
                    <Nav.Item className="flex-fill text-center">
                        <Nav.Link eventKey="create" className={`${isMobile ? 'small py-2' : 'py-2'} fw-bold`}>
                            <Plus size={16} className="me-1"/> إنشاء حيوان جديد
                        </Nav.Link>
                    </Nav.Item>
                </Nav>

                {mode === 'select' ? (
                    <>
                        <Form.Control type="text" placeholder="ابحث برقم أو نوع..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} size="sm" className="mb-3" />
                        {isMobile ? (
                            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
                                {filteredAnimals.map(a => <MobileAnimalCard key={a.id} animal={a} isSelected={selectedAnimalId === a.id} onClick={() => setSelectedAnimalId(a.id)} />)}
                            </div>
                        ) : (
                            <div className="table-responsive" style={{ maxHeight: '300px' }}>
                                <Table size="sm" hover className="align-middle">
                                    <thead className="table-light sticky-top">
                                        <tr><th>اختيار</th><th>الصورة</th><th>الكود</th><th>الفئة</th><th>الوزن</th><th>السعر</th></tr>
                                    </thead>
                                    <tbody>
                                        {filteredAnimals.map(animal => (
                                            <tr key={animal.id} className={selectedAnimalId === animal.id ? 'table-primary' : ''} onClick={() => setSelectedAnimalId(animal.id)} style={{ cursor: 'pointer' }}>
                                                <td><Form.Check type="radio" checked={selectedAnimalId === animal.id} readOnly /></td>
                                                <td>{animal.image ? <Image src={animal.image} rounded style={{width:'40px', height:'40px', objectFit:'cover'}}/> : '-'}</td>
                                                <td className="fw-bold">{animal.code}</td>
                                                <td>{animal.category_name}</td>
                                                <td>{animal.current_weight} كجم</td>
                                                <td className="text-success fw-bold">{animal.price_after_discount || animal.price_egp} ج.م</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            </div>
                        )}
                    </>
                ) : (
                    <Accordion defaultActiveKey="0" className="mb-3 shadow-sm border rounded">
                        <Accordion.Item eventKey="0">
                            <Accordion.Header className="small fw-bold">البيانات الأساسية للحيوان الجديد</Accordion.Header>
                            <Accordion.Body className="p-2 p-md-3 bg-light">
                                <Row className="g-2">
                                    <Col xs={12}>
                                        <div className="btn-group w-100 mb-2">
                                            <Button variant={isOurFarm ? "primary" : "outline-primary"} size="sm" onClick={() => setIsOurFarm(true)}>من مزارعنا</Button>
                                            <Button variant={!isOurFarm ? "primary" : "outline-primary"} size="sm" onClick={() => setIsOurFarm(false)}>من مورد خارجي</Button>
                                        </div>
                                    </Col>
                                    {!isOurFarm && (
                                        <>
                                            <Col xs={6}>
                                                <Form.Select size="sm" name="source_farm_id" value={newAnimalData.source_farm_id} onChange={handleNewAnimalChange}>
                                                    <option value="">-- المزرعة الموردة --</option>
                                                    {livestockFarms.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </Form.Select>
                                            </Col>
                                            <Col xs={6}>
                                                <Form.Control size="sm" type="text" name="supplier_code" placeholder="كود المورد" value={newAnimalData.supplier_code} onChange={handleNewAnimalChange}/>
                                            </Col>
                                        </>
                                    )}
                                    <Col xs={6}>
                                        <Form.Label className="small mb-1">الفئة *</Form.Label>
                                        <Form.Select size="sm" name="category_id" value={newAnimalData.category_id} onChange={handleNewAnimalChange} required>
                                            <option value="">اختر...</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                                        </Form.Select>
                                    </Col>
                                    <Col xs={6}>
                                        <Form.Label className="small mb-1">الجنس</Form.Label>
                                        <Form.Select size="sm" name="sex" value={newAnimalData.sex} onChange={handleNewAnimalChange}>
                                            <option value="male">ذكر</option>
                                            <option value="female">أنثى</option>
                                        </Form.Select>
                                    </Col>
                                    <Col xs={6}>
                                        <Form.Label className="small mb-1">الوزن التقريبي للعميل (كجم) *</Form.Label>
                                        <Form.Control size="sm" type="number" step="0.01" name="initial_weight_kg" value={newAnimalData.initial_weight_kg} onChange={handleNewAnimalChange} required />
                                    </Col>
                                    <Col xs={6}>
                                        <Form.Label className="small mb-1">السعر للعميل (جنيه) *</Form.Label>
                                        <Form.Control size="sm" type="number" step="0.01" name="price_egp" value={newAnimalData.price_egp} onChange={handleNewAnimalChange} required />
                                    </Col>
                                    <Col xs={6}>
                                        <Form.Label className="small mb-1">تكلفة الشراء علينا</Form.Label>
                                        <Form.Control size="sm" type="number" step="0.01" name="purchase_price" value={newAnimalData.purchase_price} onChange={handleNewAnimalChange} />
                                    </Col>
                                    <Col xs={6}>
                                        <Form.Label className="small mb-1">عربون ثابت (اختياري)</Form.Label>
                                        <Form.Control size="sm" type="number" step="0.01" name="deposit_egp" value={newAnimalData.deposit_egp} onChange={handleNewAnimalChange} />
                                    </Col>
                                    <Col xs={12}>
                                        <Form.Label className="small mb-1">ملاحظات داخلية (لا تظهر للعميل)</Form.Label>
                                        <Form.Control as="textarea" rows={2} size="sm" name="internal_notes" value={newAnimalData.internal_notes} onChange={handleNewAnimalChange} placeholder="مثال: تم شراءه خصيصاً لتلبية هذا الطلب" />
                                    </Col>
                                    <Col xs={12}>
                                        <Form.Label className="small mb-1">الصورة الرئيسية للحيوان *</Form.Label>
                                        {imagePreview && <div className="mb-2"><Image src={imagePreview} thumbnail style={{ maxHeight: 80 }} /></div>}
                                        <Form.Control type="file" size="sm" accept="image/*" onChange={handleImageChange} required />
                                    </Col>
                                    <Col xs={12}>
                                        <Form.Label className="small mb-1">صور إضافية (اختياري)</Form.Label>
                                        <Form.Control type="file" multiple size="sm" accept="image/*" onChange={handleAdditionalImagesChange} />
                                        {additionalImagePreviews.length > 0 && (
                                            <div className="mt-2 d-flex flex-wrap gap-2">
                                                {additionalImagePreviews.map((src, idx) => (
                                                    <Image key={idx} src={src} thumbnail style={{ width: '60px', height: '60px', objectFit: 'cover' }} />
                                                ))}
                                            </div>
                                        )}
                                    </Col>
                                </Row>
                            </Accordion.Body>
                        </Accordion.Item>
                    </Accordion>
                )}
            </Modal.Body>
            <Modal.Footer className="border-top-0 pt-1">
                <Button variant="outline-secondary" onClick={handleClose} size={isMobile ? "sm" : ""}>إلغاء</Button>
                <Button variant="primary" onClick={mode === 'select' ? handleFulfillExisting : handleFulfillNew} disabled={loading} size={isMobile ? "sm" : ""}>
                    {loading ? <Spinner size="sm" className="me-2" /> : null}
                    {mode === 'select' ? 'تأكيد الربط' : 'إنشاء وربط بالطلب'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

function RequestedLivestock() {
    const [requests, setRequests] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [showFulfillModal, setShowFulfillModal] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [reqRes, catRes] = await Promise.all([
                axios.get('/management/special-requests/'),
                axios.get('/livestock/categories/')
            ]);
            setRequests(reqRes.data.results || []);
            setCategories(catRes.data.results || catRes.data || []);
        } catch {
            toast.error("فشل تحميل البيانات.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const filteredRequests = requests.filter(req => filter === 'all' ? true : req.status === filter);

    return (
        <div className="container-fluid px-2 px-md-3 py-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-4">
                <div>
                    <h1 className="h3 mb-1 fw-bold">طلبات الماشية الخاصة</h1>
                    <p className="text-muted mb-0">متابعة وتوفير طلبات العملاء غير المتوفرة بالمتجر</p>
                </div>
                <Button variant="outline-primary" size="sm" onClick={fetchData}><RefreshCw size={16} className="me-1"/> تحديث</Button>
            </div>

            <div className="d-flex gap-2 mb-3">
                <Button variant={filter === 'all' ? 'dark' : 'outline-dark'} size="sm" onClick={() => setFilter('all')}>الكل ({requests.length})</Button>
                <Button variant={filter === 'pending' ? 'warning' : 'outline-warning'} size="sm" onClick={() => setFilter('pending')}>قيد الانتظار ({requests.filter(r => r.status === 'pending').length})</Button>
                <Button variant={filter === 'sourced' ? 'success' : 'outline-success'} size="sm" onClick={() => setFilter('sourced')}>تم التوفير ({requests.filter(r => r.status === 'sourced').length})</Button>
            </div>

            <Card className="border-0 shadow-sm">
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div>
                    ) : filteredRequests.length === 0 ? (
                        <div className="text-center py-5 text-muted">لا توجد طلبات خاصة لعرضها.</div>
                    ) : isMobile ? (
                        <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                            {filteredRequests.map(req => (
                                <Card key={req.id} className="mb-2 border shadow-sm">
                                    <Card.Body className="p-3">
                                        <div className="d-flex justify-content-between mb-2">
                                            <h6 className="fw-bold mb-0">طلب #{req.id}</h6>
                                            <Badge bg={req.status === 'sourced' ? 'success' : 'warning'} text={req.status === 'pending' ? 'dark' : 'white'}>
                                                {req.status_display}
                                            </Badge>
                                        </div>
                                        <div className="small text-muted mb-2">
                                            <User size={12} className="me-1"/> {req.user_details?.full_name} <br/>
                                            <Calendar size={12} className="me-1"/> {format(new Date(req.created_at), 'yyyy-MM-dd')}
                                        </div>
                                        <div className="bg-light p-2 rounded small mb-2 border">
                                            {Object.entries(req.requested_specs).map(([k, v]) => v && <div key={k}><strong>{k}:</strong> {v}</div>)}
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center mt-2">
                                            {req.status === 'sourced' ? (
                                                <Badge bg="success" className="fs-6">الحيوان الموفر: #{req.sourced_animal_details?.code}</Badge>
                                            ) : (
                                                <Button size="sm" variant="primary" className="w-100" onClick={() => { setSelectedRequest(req); setShowFulfillModal(true); }}>
                                                    <Plus size={14} className="me-1"/> توفير حيوان
                                                </Button>
                                            )}
                                        </div>
                                    </Card.Body>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="mb-0 align-middle">
                                <thead className="table-light">
                                    <tr>
                                        <th>رقم الطلب</th>
                                        <th>العميل</th>
                                        <th>التاريخ</th>
                                        <th>المواصفات المطلوبة</th>
                                        <th>الحيوان الموفر</th>
                                        <th>الحالة والإجراء</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRequests.map(req => (
                                        <tr key={req.id}>
                                            <td className="fw-bold">#{req.id}</td>
                                            <td>
                                                <div className="fw-bold">{req.user_details?.full_name}</div>
                                                <small className="text-muted" dir="ltr">{req.user_details?.phone}</small>
                                            </td>
                                            <td>{format(new Date(req.created_at), 'yyyy-MM-dd')}</td>
                                            <td>
                                                <div className="small">
                                                    {Object.entries(req.requested_specs).map(([k, v]) => v && <div key={k}><strong>{k}:</strong> {v}</div>)}
                                                </div>
                                            </td>
                                            <td>
                                                {req.status === 'sourced' && req.sourced_animal_details ? (
                                                    <Badge bg="success" className="fs-6">#{req.sourced_animal_details.code}</Badge>
                                                ) : <span className="text-muted small">لم يتم التوفير بعد</span>}
                                            </td>
                                            <td>
                                                {req.status === 'pending' ? (
                                                    <Button size="sm" variant="primary" onClick={() => { setSelectedRequest(req); setShowFulfillModal(true); }}>
                                                        <Plus size={14} className="me-1"/> توفير حيوان
                                                    </Button>
                                                ) : (
                                                    <div className="d-flex flex-column gap-1 w-fit">
                                                        <Badge bg="success" className="p-2"><CheckCircle size={12} className="me-1"/> تم التوفير</Badge>
                                                        <Button size="sm" variant="outline-warning" onClick={() => { setSelectedRequest(req); setShowFulfillModal(true); }} className="d-flex align-items-center justify-content-center">
                                                            <RefreshCw size={12} className="me-1"/> تغيير الحيوان
                                                        </Button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>

            <FulfillRequestModal
                show={showFulfillModal}
                handleClose={() => setShowFulfillModal(false)}
                request={selectedRequest}
                onFulfilled={fetchData}
                categories={categories}
            />
        </div>
    );
}

export default RequestedLivestock;
