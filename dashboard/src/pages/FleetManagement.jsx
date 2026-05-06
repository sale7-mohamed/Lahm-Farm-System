import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Card, Button, Table, Modal, Form, Badge, Row, Col, Spinner } from 'react-bootstrap';
import { Truck, PlusCircle, Edit, Trash2, CheckCircle, XCircle } from 'lucide-react';

const VehicleForm = ({ show, handleClose, onSave, vehicleToEdit }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            setFormData(vehicleToEdit || {
                name: '', plate_number: '', vehicle_type: 'livestock',
                ownership: 'owned', capacity_description: '',
                driver_name: '', driver_phone: '', is_active: true, notes: ''
            });
        }
    }, [show, vehicleToEdit]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const method = vehicleToEdit ? 'patch' : 'post';
        const url = vehicleToEdit ? `/management/vehicles/${vehicleToEdit.id}/` : '/management/vehicles/';

        try {
            await axios[method](url, formData);
            toast.success("تم حفظ بيانات السيارة بنجاح.");
            onSave();
            handleClose();
        } catch {
            toast.error("فشل الحفظ. تأكد من عدم تكرار رقم اللوحة.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title>{vehicleToEdit ? 'تعديل سيارة' : 'إضافة سيارة جديدة'}</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Row className="g-3">
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>اسم السيارة / الوصف *</Form.Label>
                                <Form.Control required name="name" value={formData.name || ''} onChange={handleChange} placeholder="مثال: شيفروليه جامبو"/>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>رقم اللوحة *</Form.Label>
                                <Form.Control required name="plate_number" value={formData.plate_number || ''} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>النوع</Form.Label>
                                <Form.Select name="vehicle_type" value={formData.vehicle_type} onChange={handleChange}>
                                    <option value="livestock">نقل مواشي (حية)</option>
                                    <option value="refrigerated">مبرد (لحوم)</option>
                                    <option value="general">نقل عام/إداري</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>الملكية</Form.Label>
                                <Form.Select name="ownership" value={formData.ownership} onChange={handleChange}>
                                    <option value="owned">مملوكة للمزرعة</option>
                                    <option value="rented">إيجار</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={12}>
                            <Form.Group>
                                <Form.Label>وصف السعة/الحمولة</Form.Label>
                                <Form.Control name="capacity_description" value={formData.capacity_description || ''} onChange={handleChange} placeholder="مثال: 5 عجول كبيرة"/>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>السائق الافتراضي</Form.Label>
                                <Form.Control name="driver_name" value={formData.driver_name || ''} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>رقم هاتف السائق</Form.Label>
                                <Form.Control name="driver_phone" value={formData.driver_phone || ''} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={12}>
                            <Form.Check type="switch" id="v-active" label="متاحة للعمل" name="is_active" checked={formData.is_active || false} onChange={handleChange} />
                        </Col>
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                    <Button variant="primary" type="submit" disabled={loading}>
                        {loading ? 'جاري الحفظ...' : 'حفظ'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

const FleetManagement = () => {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);

    const fetchVehicles = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/management/vehicles/');
            setVehicles(res.data.results || res.data || []);
        } catch {
            toast.error("فشل تحميل بيانات الأسطول.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

    const handleDelete = async (id) => {
        if (window.confirm("هل أنت متأكد من حذف هذه السيارة؟")) {
            try {
                await axios.delete(`/management/vehicles/${id}/`);
                toast.success("تم الحذف بنجاح.");
                fetchVehicles();
            } catch {
                toast.error("فشل الحذف.");
            }
        }
    };

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1">إدارة الأسطول</h1>
                    <p className="text-muted mb-0">إدارة السيارات والمركبات</p>
                </div>
                <Button onClick={() => { setSelectedVehicle(null); setShowModal(true); }}>
                    <PlusCircle size={18} className="me-2" /> إضافة سيارة
                </Button>
            </div>

            <Card className="shadow-sm">
                <Card.Body className="p-0">
                    {loading ? (
                        <div className="text-center py-5"><Spinner animation="border" /></div>
                    ) : (
                        <div className="table-responsive">
                            <Table hover className="mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>المركبة</th>
                                        <th>النوع</th>
                                        <th>الملكية</th>
                                        <th>السائق</th>
                                        <th>الحالة</th>
                                        <th>إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {vehicles.map(v => (
                                        <tr key={v.id}>
                                            <td>
                                                <div className="fw-bold">{v.name}</div>
                                                <small className="text-muted">{v.plate_number}</small>
                                            </td>
                                            <td>
                                                {v.vehicle_type === 'livestock' ? 'نقل مواشي' :
                                                 v.vehicle_type === 'refrigerated' ? 'مبرد' : 'عام'}
                                            </td>
                                            <td>
                                                <Badge bg={v.ownership === 'owned' ? 'info' : 'warning'}>
                                                    {v.ownership === 'owned' ? 'مملوكة' : 'إيجار'}
                                                </Badge>
                                            </td>
                                            <td>
                                                {v.driver_name || '-'}
                                                {v.driver_phone && <div className="small text-muted">{v.driver_phone}</div>}
                                            </td>
                                            <td>
                                                {v.is_active ?
                                                    <Badge bg="success"><CheckCircle size={12} className="me-1"/>متاحة</Badge> :
                                                    <Badge bg="danger"><XCircle size={12} className="me-1"/>خارج الخدمة</Badge>
                                                }
                                            </td>
                                            <td>
                                                <Button variant="link" size="sm" onClick={() => { setSelectedVehicle(v); setShowModal(true); }}>
                                                    <Edit size={16} />
                                                </Button>
                                                <Button variant="link" size="sm" className="text-danger" onClick={() => handleDelete(v.id)}>
                                                    <Trash2 size={16} />
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

            <VehicleForm
                show={showModal}
                handleClose={() => setShowModal(false)}
                onSave={fetchVehicles}
                vehicleToEdit={selectedVehicle}
            />
        </div>
    );
};

export default FleetManagement;
