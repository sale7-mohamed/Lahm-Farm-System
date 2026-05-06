import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Modal, Button, Form, Table, Badge, Card, Row, Col, ProgressBar } from 'react-bootstrap';
import { PlusCircle, Edit, Repeat, Package, AlertTriangle, CheckCircle, TrendingDown, TrendingUp } from 'lucide-react';

const StockMovementForm = ({ show, handleClose, onSave, items }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            setFormData({
                item: '',
                quantity: '',
                movement_type: 'adjustment_out',
                notes: ''
            });
        }
    }, [show]);

    const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.item) {
            toast.error("الرجاء اختيار الصنف");
            return;
        }

        if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
            toast.error("الرجاء إدخال كمية صحيحة");
            return;
        }

        setLoading(true);
        try {
            await axios.post('/management/stock-movements/', formData);
            toast.success("تم تسجيل الحركة بنجاح.");
            onSave();
            handleClose();
        } catch (error) {
            console.error("Failed to create stock movement:", error.response?.data);
            toast.error("فشل تسجيل الحركة.");
        } finally {
            setLoading(false);
        }
    };

    const selectedItem = items.find(item => item.id == formData.item);

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton className="bg-primary text-white">
                <Modal.Title>
                    <Repeat size={24} className="me-2" />
                    تسجيل حركة مخزون يدوية
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Row className="g-3">
                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">الصنف</Form.Label>
                                <Form.Select
                                    name="item"
                                    value={formData.item}
                                    onChange={handleChange}
                                    required
                                    className="form-select-lg"
                                >
                                    <option value="">اختر صنف...</option>
                                    {items.map(i => (
                                        <option key={i.id} value={i.id}>
                                            {i.name} ({i.current_stock} {i.unit_of_measure})
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">نوع الحركة</Form.Label>
                                <Form.Select
                                    name="movement_type"
                                    value={formData.movement_type}
                                    onChange={handleChange}
                                    required
                                    className="form-select-lg"
                                >
                                    <option value="adjustment_out">تسوية خصم (هالك/تالف)</option>
                                    <option value="adjustment_in">تسوية إضافة (جرد)</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>

                        <Col xs={12}>
                            {selectedItem && (
                                <Card className="mb-3 border-info">
                                    <Card.Body className="p-3">
                                        <Row>
                                            <Col xs={6}>
                                                <small className="text-muted d-block">المخزون الحالي</small>
                                                <h5 className="mb-0">
                                                    {selectedItem.current_stock} {selectedItem.unit_of_measure}
                                                </h5>
                                            </Col>
                                            <Col xs={6}>
                                                <small className="text-muted d-block">حد الطلب</small>
                                                <h5 className="mb-0">
                                                    {selectedItem.min_stock_level} {selectedItem.unit_of_measure}
                                                </h5>
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>
                            )}
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">الكمية</Form.Label>
                                <Form.Control
                                    type="number"
                                    step="0.01"
                                    name="quantity"
                                    value={formData.quantity}
                                    onChange={handleChange}
                                    required
                                    min="0.01"
                                    className="form-control-lg"
                                    placeholder="أدخل الكمية"
                                />
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">الوحدة</Form.Label>
                                <Form.Control
                                    type="text"
                                    value={selectedItem?.unit_of_measure || ''}
                                    readOnly
                                    className="form-control-lg bg-light"
                                    placeholder="سيتم تحديدها من الصنف"
                                />
                            </Form.Group>
                        </Col>

                        <Col xs={12}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">السبب / ملاحظات</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    rows={3}
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    required
                                    placeholder="أدخل سبب الحركة أو أي ملاحظات"
                                    className="form-control-lg"
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
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                جاري التسجيل...
                            </>
                        ) : 'تسجيل الحركة'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

const InventoryItemForm = ({ show, handleClose, onSave, itemToEdit }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState([]);

    const itemTypes = [
        { value: 'feed', label: 'علف', icon: '🌾' },
        { value: 'medicine', label: 'دواء', icon: '💊' },
        { value: 'consumable', label: 'مستهلكات', icon: '📦' },
        { value: 'equipment', label: 'معدات', icon: '🔧' },
    ];

    useEffect(() => {
        if (show) {
            const defaults = {
                name: '',
                type: 'feed',
                unit_of_measure: '',
                min_stock_level: '10',
                supplier: ''
            };

            setFormData(itemToEdit || defaults);

            const fetchSuppliers = async () => {
                try {
                    const res = await axios.get('/management/suppliers/');
                    setSuppliers(res.data.results || []);
                } catch {
                    toast.warn("لم نتمكن من تحميل قائمة الموردين.");
                }
            };
            fetchSuppliers();
        }
    }, [show, itemToEdit]);

    const handleChange = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error("الرجاء إدخال اسم الصنف");
            return;
        }

        if (!formData.unit_of_measure.trim()) {
            toast.error("الرجاء إدخال وحدة القياس");
            return;
        }

        setLoading(true);
        const method = itemToEdit ? 'patch' : 'post';
        const url = itemToEdit ? `/management/inventory-items/${itemToEdit.id}/` : '/management/inventory-items/';

        const payload = { ...formData, supplier: formData.supplier || null };

        try {
            await axios[method](url, payload);
            toast.success(itemToEdit ? "تم تحديث الصنف بنجاح!" : "تم إضافة الصنف بنجاح!");
            onSave();
            handleClose();
        } catch (error) {
            console.error("Save inventory error:", error.response?.data);
            toast.error("فشل حفظ الصنف.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton className={itemToEdit ? "bg-warning text-dark" : "bg-primary text-white"}>
                <Modal.Title>
                    <Package size={24} className="me-2" />
                    {itemToEdit ? 'تعديل صنف' : 'إضافة صنف جديد'}
                </Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body>
                    <Row className="g-3">
                        <Col xs={12}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">اسم الصنف</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="name"
                                    value={formData.name || ''}
                                    onChange={handleChange}
                                    required
                                    className="form-control-lg"
                                    placeholder="أدخل اسم الصنف"
                                />
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">نوع الصنف</Form.Label>
                                <Form.Select
                                    name="type"
                                    value={formData.type || ''}
                                    onChange={handleChange}
                                    required
                                    className="form-select-lg"
                                >
                                    {itemTypes.map(t => (
                                        <option key={t.value} value={t.value}>
                                            {t.icon} {t.label}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">المورد الأساسي (اختياري)</Form.Label>
                                <Form.Select
                                    name="supplier"
                                    value={formData.supplier || ''}
                                    onChange={handleChange}
                                    className="form-select-lg"
                                >
                                    <option value="">-- بلا مورد --</option>
                                    {suppliers.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">وحدة القياس</Form.Label>
                                <Form.Control
                                    type="text"
                                    name="unit_of_measure"
                                    placeholder="مثال: كجم، لتر، علبة"
                                    value={formData.unit_of_measure || ''}
                                    onChange={handleChange}
                                    required
                                    className="form-control-lg"
                                />
                            </Form.Group>
                        </Col>

                        <Col xs={12} md={6}>
                            <Form.Group className="mb-3">
                                <Form.Label className="fw-bold">حد الطلب (أقل كمية في المخزن)</Form.Label>
                                <Form.Control
                                    type="number"
                                    name="min_stock_level"
                                    value={formData.min_stock_level || ''}
                                    onChange={handleChange}
                                    required
                                    min="1"
                                    className="form-control-lg"
                                />
                            </Form.Group>
                        </Col>

                        {itemToEdit && (
                            <Col xs={12}>
                                <Card className="border-info">
                                    <Card.Body className="p-3">
                                        <Row>
                                            <Col xs={6}>
                                                <small className="text-muted d-block">المخزون الحالي</small>
                                                <h5 className="mb-0">
                                                    {itemToEdit.current_stock} {itemToEdit.unit_of_measure}
                                                </h5>
                                            </Col>
                                            <Col xs={6}>
                                                <small className="text-muted d-block">حالة المخزون</small>
                                                <h5 className="mb-0">
                                                    {parseFloat(itemToEdit.current_stock) <= parseFloat(itemToEdit.min_stock_level) ? (
                                                        <Badge bg="danger">تحت الحد</Badge>
                                                    ) : (
                                                        <Badge bg="success">آمن</Badge>
                                                    )}
                                                </h5>
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>
                            </Col>
                        )}
                    </Row>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="outline-secondary" onClick={handleClose} size="lg">
                        إلغاء
                    </Button>
                    <Button
                        variant={itemToEdit ? "warning" : "primary"}
                        type="submit"
                        disabled={loading}
                        size="lg"
                        className="px-4"
                    >
                        {loading ? (
                            <>
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                جاري الحفظ...
                            </>
                        ) : itemToEdit ? 'تحديث الصنف' : 'إضافة الصنف'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

function Inventory() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showItemModal, setShowItemModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState(false);
    const [itemToEdit, setItemToEdit] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/management/inventory-items/');
            setItems(res.data.results || []);
        } catch {
            toast.error("فشل تحميل أصناف المخزون.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const stats = {
        totalItems: items.length,
        lowStock: items.filter(item => parseFloat(item.current_stock) <= parseFloat(item.min_stock_level)).length,
        outOfStock: items.filter(item => parseFloat(item.current_stock) <= 0).length,
        healthyStock: items.filter(item => parseFloat(item.current_stock) > parseFloat(item.min_stock_level)).length
    };

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1">إدارة المخزون</h1>
                    <p className="text-muted mb-0">تتبع وإدارة أصناف المخزون</p>
                </div>
                <div className="d-flex flex-wrap gap-2">
                    <Button
                        onClick={() => setShowMovementModal(true)}
                        variant="outline-primary"
                        size="lg"
                        className="d-flex align-items-center"
                    >
                        <Repeat size={20} className="me-2" />
                        <span className="d-none d-md-inline">تسجيل حركة</span>
                    </Button>
                    <Button
                        onClick={() => { setItemToEdit(null); setShowItemModal(true); }}
                        variant="primary"
                        size="lg"
                        className="d-flex align-items-center"
                    >
                        <PlusCircle size={20} className="me-2" />
                        <span className="d-none d-md-inline">إضافة صنف</span>
                    </Button>
                </div>
            </div>

            {}
            <Row className="mb-4 g-2">
                <Col xs={6} md={3}>
                    <Card className="border-start border-primary border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">إجمالي الأصناف</h6>
                                    <h4 className="mb-0">{stats.totalItems}</h4>
                                </div>
                                <Package size={24} className="text-primary" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="border-start border-success border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">مخزون آمن</h6>
                                    <h4 className="mb-0">{stats.healthyStock}</h4>
                                </div>
                                <CheckCircle size={24} className="text-success" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="border-start border-warning border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">منخفض</h6>
                                    <h4 className="mb-0">{stats.lowStock}</h4>
                                </div>
                                <TrendingDown size={24} className="text-warning" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={3}>
                    <Card className="border-start border-danger border-3">
                        <Card.Body className="p-3">
                            <div className="d-flex justify-content-between align-items-center">
                                <div>
                                    <h6 className="text-muted mb-1">منتهي</h6>
                                    <h4 className="mb-0">{stats.outOfStock}</h4>
                                </div>
                                <AlertTriangle size={24} className="text-danger" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            {loading ? (
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">جاري التحميل...</span>
                    </div>
                    <p className="mt-2">جاري تحميل بيانات المخزون...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-5">
                    <div className="mb-3">
                        <Package size={64} className="text-muted" />
                    </div>
                    <h4 className="text-muted mb-3">لا توجد أصناف في المخزون</h4>
                    <Button
                        onClick={() => { setItemToEdit(null); setShowItemModal(true); }}
                        variant="primary"
                        size="lg"
                    >
                        <PlusCircle size={20} className="me-2" />
                        إضافة أول صنف
                    </Button>
                </div>
            ) : (
                <div className="row g-3">
                    {items.map(item => {
                        const isLowStock = parseFloat(item.current_stock) <= parseFloat(item.min_stock_level);
                        const isOutOfStock = parseFloat(item.current_stock) <= 0;
                        const stockPercentage = (parseFloat(item.current_stock) / (parseFloat(item.min_stock_level) * 3)) * 100;

                        return (
                            <div key={item.id} className="col-12 col-md-6 col-lg-4">
                                <Card className={`h-100 shadow-sm hover-shadow ${isOutOfStock ? 'border-danger' : isLowStock ? 'border-warning' : 'border-success'}`}>
                                    <Card.Body>
                                        <div className="d-flex justify-content-between align-items-start mb-3">
                                            <div>
                                                <h6 className="mb-1 text-primary">{item.name}</h6>
                                                <div className="d-flex align-items-center">
                                                    <Badge bg="light" text="dark" className="me-2">
                                                        {item.type_display}
                                                    </Badge>
                                                    {isOutOfStock ? (
                                                        <Badge bg="danger">
                                                            <AlertTriangle size={12} className="me-1" />
                                                            منتهي
                                                        </Badge>
                                                    ) : isLowStock ? (
                                                        <Badge bg="warning">
                                                            <TrendingDown size={12} className="me-1" />
                                                            منخفض
                                                        </Badge>
                                                    ) : (
                                                        <Badge bg="success">
                                                            <CheckCircle size={12} className="me-1" />
                                                            آمن
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline-primary"
                                                size="sm"
                                                onClick={() => { setItemToEdit(item); setShowItemModal(true); }}
                                            >
                                                <Edit size={16} />
                                            </Button>
                                        </div>

                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between mb-1">
                                                <small className="text-muted">المخزون الحالي</small>
                                                <small>
                                                    <strong>{item.current_stock} {item.unit_of_measure}</strong>
                                                </small>
                                            </div>
                                            <ProgressBar
                                                now={Math.min(stockPercentage, 100)}
                                                variant={
                                                    isOutOfStock ? 'danger' :
                                                    isLowStock ? 'warning' : 'success'
                                                }
                                                style={{ height: '8px' }}
                                            />
                                        </div>

                                        <Row className="g-2">
                                            <Col xs={6}>
                                                <div>
                                                    <small className="text-muted d-block">حد الطلب</small>
                                                    <strong>{item.min_stock_level} {item.unit_of_measure}</strong>
                                                </div>
                                            </Col>
                                            <Col xs={6}>
                                                <div>
                                                    <small className="text-muted d-block">المورد</small>
                                                    <small className="text-truncate d-block">
                                                        {item.supplier_details?.name || '---'}
                                                    </small>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                    <Card.Footer className="bg-transparent border-top-0">
                                        <Button
                                            variant="outline-secondary"
                                            size="sm"
                                            className="w-100"
                                            onClick={() => {
                                                setItemToEdit(item);
                                                setShowMovementModal(true);
                                            }}
                                        >
                                            <Repeat size={14} className="me-1" />
                                            تسجيل حركة
                                        </Button>
                                    </Card.Footer>
                                </Card>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modals */}
            <InventoryItemForm
                show={showItemModal}
                handleClose={() => setShowItemModal(false)}
                onSave={fetchData}
                itemToEdit={itemToEdit}
            />
            <StockMovementForm
                show={showMovementModal}
                handleClose={() => setShowMovementModal(false)}
                onSave={fetchData}
                items={items}
            />
        </div>
    );
}

export default Inventory;