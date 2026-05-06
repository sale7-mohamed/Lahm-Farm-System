import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import {
  Card, Button, Badge, Form, Modal, Table, Spinner, Row, Col, Alert, Nav, Tab
} from 'react-bootstrap';
import {
  Truck, Printer, RefreshCw, MapPin, Navigation, Filter, Activity, AlertTriangle,
  Wallet, CreditCard, FileText, CheckCircle, Info, PlusCircle, Trash2, Clock, ShieldCheck
} from 'lucide-react';
import PrintModal from '../components/ui/PrintModal';

const CreateRouteModal = ({ show, handleClose, vehicles, employees, onCreate, availableOrders }) => {
  const [formData, setFormData] = useState({
    supervisor: '',
    vehicle: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [routePlan, setRoutePlan] = useState([]);
  const [newTaskType, setNewTaskType] = useState('pickup');
  const [newTaskAddress, setNewTaskAddress] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');

  const handleAddTask = () => {
    if (newTaskType === 'delivery' && !selectedOrderId) {
      toast.warn('يرجى اختيار طلب التوصيل');
      return;
    }
    if (newTaskType !== 'delivery' && !newTaskAddress.trim()) {
      toast.warn('يرجى إدخال العنوان أو الوصف');
      return;
    }

    let address = newTaskAddress;
    if (newTaskType === 'delivery' && selectedOrderId) {
      const order = availableOrders.find(o => o.id == selectedOrderId);
      if (order) {
        address = `توصيل لعميل: ${order.user?.full_name} - ${order.delivery_address?.governorate} - ${order.delivery_address?.street || ''}`;
      }
    }

    const task = {
      type: newTaskType,
      address: address,
      order_id: selectedOrderId || null,
    };
    setRoutePlan([...routePlan, task]);
    setNewTaskAddress('');
    setSelectedOrderId('');
  };

  const removeTask = (index) => {
    setRoutePlan(routePlan.filter((_, i) => i !== index));
  };

  const moveTask = (index, direction) => {
    if (index + direction < 0 || index + direction >= routePlan.length) return;
    const newRoute = [...routePlan];
    const temp = newRoute[index];
    newRoute[index] = newRoute[index + direction];
    newRoute[index + direction] = temp;
    setRoutePlan(newRoute);
  };

  const handleSubmit = () => {
    if (!formData.supervisor || !formData.vehicle) {
      toast.warn('يجب اختيار السائق والمركبة');
      return;
    }
    if (routePlan.length === 0) {
      toast.warn('يجب إضافة محطة واحدة على الأقل للمسار');
      return;
    }

    const orderIds = routePlan.map(r => r.order_id).filter(id => id);
    onCreate({ ...formData, route_plan: routePlan, order_ids: orderIds, shipment_type: 'delivery' });
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="lg" backdrop="static">
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>تخطيط مسار رحلة شاملة</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Row className="g-3 mb-4">
          <Col md={6}>
            <Form.Label className="fw-bold">المركبة *</Form.Label>
            <Form.Select
              value={formData.vehicle}
              onChange={e => setFormData({ ...formData, vehicle: e.target.value })}
            >
              <option value="">اختر المركبة...</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.plate_number})</option>
              ))}
            </Form.Select>
          </Col>
          <Col md={6}>
            <Form.Label className="fw-bold">السائق (مستخدم التطبيق) *</Form.Label>
            <Form.Select
              value={formData.supervisor}
              onChange={e => setFormData({ ...formData, supervisor: e.target.value })}
            >
              <option value="">اختر السائق...</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.full_name}</option>
              ))}
            </Form.Select>
          </Col>
        </Row>

        <div className="bg-light p-3 rounded border mb-3">
          <h6 className="fw-bold">إضافة محطات للمسار (بالترتيب):</h6>
          <Row className="g-2 align-items-end">
            <Col md={3}>
              <Form.Select value={newTaskType} onChange={e => setNewTaskType(e.target.value)}>
                <option value="pickup">استلام من مورد</option>
                <option value="slaughter">ذهاب للمجزر</option>
                <option value="delivery">توصيل لعميل</option>
              </Form.Select>
            </Col>
            {newTaskType === 'delivery' ? (
              <Col md={6}>
                <Form.Select
                  value={selectedOrderId}
                  onChange={e => setSelectedOrderId(e.target.value)}
                >
                  <option value="">اختر طلب العميل...</option>
                  {availableOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      طلب #{o.id} - {o.user?.full_name} ({o.delivery_address?.governorate})
                    </option>
                  ))}
                </Form.Select>
              </Col>
            ) : (
              <Col md={6}>
                <Form.Control
                  type="text"
                  placeholder="اكتب العنوان أو الوصف..."
                  value={newTaskAddress}
                  onChange={e => setNewTaskAddress(e.target.value)}
                />
              </Col>
            )}
            <Col md={3}>
              <Button variant="success" className="w-100" onClick={handleAddTask}>
                <PlusCircle size={16} /> أضف للمسار
              </Button>
            </Col>
          </Row>
        </div>

        <div className="route-timeline p-3 border rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {routePlan.length === 0 ? (
            <div className="text-center text-muted py-4">لم يتم إضافة محطات بعد</div>
          ) : (
            routePlan.map((task, idx) => (
              <div key={idx} className="d-flex align-items-center justify-content-between p-2 mb-2 bg-white border rounded shadow-sm">
                <div className="d-flex align-items-center gap-3">
                  <Badge bg="dark" pill>{idx + 1}</Badge>
                  <strong>
                    {task.type === 'pickup' && 'استلام مورد'}
                    {task.type === 'slaughter' && 'مجزر'}
                    {task.type === 'delivery' && 'توصيل عميل'}
                  </strong>
                  <span className="text-muted small">{task.address}</span>
                </div>
                <div className="d-flex gap-1">
                  <Button size="sm" variant="light" onClick={() => moveTask(idx, -1)} disabled={idx === 0}>↑</Button>
                  <Button size="sm" variant="light" onClick={() => moveTask(idx, 1)} disabled={idx === routePlan.length - 1}>↓</Button>
                  <Button size="sm" variant="danger" onClick={() => removeTask(idx)}><Trash2 size={14} /></Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
        <Button variant="primary" onClick={handleSubmit}>اعتماد المسار وتكليف السائق</Button>
      </Modal.Footer>
    </Modal>
  );
};

const CreateShipmentModal = ({ show, handleClose, selectedOrders, vehicles, employees, onCreate, shipmentType }) => {
  const [formData, setFormData] = useState({
    supervisor: '',
    vehicle: '',
    driver_name: '',
    driver_phone: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    shipment_type: shipmentType
  });
  const [loading, setLoading] = useState(false);
  const [capacityWarning, setCapacityWarning] = useState(null);

  useEffect(() => {
    setFormData(prev => ({ ...prev, shipment_type: shipmentType }));
    setCapacityWarning(null);
  }, [shipmentType, show]);

  const extractCapacity = (desc) => {
    if (!desc) return 999;
    const match = desc.match(/\d+/);
    return match ? parseInt(match[0], 10) : 999;
  };

  const handleVehicleChange = (e) => {
    const vId = e.target.value;
    const vehicle = vehicles.find(v => v.id == vId);
    if (vehicle) {
      const cap = extractCapacity(vehicle.capacity_description);
      const ordersCount = selectedOrders.length;
      if (ordersCount > cap) {
        setCapacityWarning(`⚠️ تحذير: حمولة السيارة المحددة (${cap}) أقل من عدد الطلبات (${ordersCount}).`);
      } else if (ordersCount <= Math.ceil(cap * 0.25) && cap > 3) {
        setCapacityWarning(`💡 تنبيه: هذه السيارة تتسع لـ (${cap})، تكليفها بـ (${ordersCount}) طلب فقط قد يهدر الموارد.`);
      } else {
        setCapacityWarning(null);
      }
    } else {
      setCapacityWarning(null);
    }
    setFormData(prev => ({
      ...prev,
      vehicle: vId,
      driver_name: vehicle?.driver_name || '',
      driver_phone: vehicle?.driver_phone || ''
    }));
  };

  const handleSubmit = async () => {
    if (!formData.supervisor || !formData.vehicle) {
      toast.warn('يجب اختيار السائق/المشرف والمركبة');
      return;
    }
    setLoading(true);
    try {
      await onCreate(formData);
    } finally {
      setLoading(false);
    }
  };

  const getModalTitle = () => {
    if (shipmentType === 'pickup') return 'نقل من مورد';
    if (shipmentType === 'slaughter') return 'نقل للمجزر';
    return 'توصيل عملاء';
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="lg">
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title>{getModalTitle()}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Alert variant="info" className="py-2 mb-3 d-flex justify-content-between align-items-center">
          <span>عدد الطلبات في هذه الرحلة:</span>
          <strong className="fs-5">{selectedOrders.length} طلبات</strong>
        </Alert>
        {capacityWarning && (
          <Alert variant={capacityWarning.includes('⚠️') ? 'danger' : 'warning'} className="py-2 d-flex align-items-center gap-2">
            <AlertTriangle size={18} />
            <strong>{capacityWarning}</strong>
          </Alert>
        )}
        <Row className="g-3">
          <Col md={6}>
            <Form.Group>
              <Form.Label className="fw-bold">المركبة *</Form.Label>
              <Form.Select value={formData.vehicle} onChange={handleVehicleChange} required>
                <option value="">اختر المركبة...</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plate_number}) - {v.capacity_description}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label className="fw-bold">حساب السائق (التطبيق) *</Form.Label>
              <Form.Select value={formData.supervisor} onChange={e => setFormData({ ...formData, supervisor: e.target.value })} required>
                <option value="">اختر حساب السائق...</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </Form.Select>
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label className="fw-bold">اسم السائق الفعلي</Form.Label>
              <Form.Control value={formData.driver_name} onChange={e => setFormData({ ...formData, driver_name: e.target.value })} />
            </Form.Group>
          </Col>
          <Col md={6}>
            <Form.Group>
              <Form.Label className="fw-bold">تاريخ الرحلة</Form.Label>
              <Form.Control type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
            </Form.Group>
          </Col>
          <Col md={12}>
            <Form.Group>
              <Form.Label className="fw-bold">تعليمات للسائق</Form.Label>
              <Form.Control as="textarea" rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="مثال: يرجى الاتصال بالعملاء قبل التحرك..." />
            </Form.Group>
          </Col>
        </Row>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading || !formData.vehicle || !formData.supervisor}>
          {loading ? 'جاري الإصدار...' : 'تأكيد الرحلة وتكليف السائق'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

const Dispatcher = () => {
  const [deliveries, setDeliveries] = useState({});
  const [pickups, setPickups] = useState([]);
  const [externalSlaughter, setExternalSlaughter] = useState([]);
  const [activeShipments, setActiveShipments] = useState([]);
  const [completedShipments, setCompletedShipments] = useState([]);
  const [reconciliationData, setReconciliationData] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [currentShipmentType, setCurrentShipmentType] = useState('delivery');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('deliveries');
  const [filterGov, setFilterGov] = useState('all');
  const [filterService, setFilterService] = useState('all');
  const [groupedDeliveries, setGroupedDeliveries] = useState({});
  const [printConfig, setPrintConfig] = useState({ show: false, title: '', endpoint: '' });

  const fetchData = useCallback(async (showToast = false) => {
    if (showToast) setRefreshing(true);
    setLoading(true);
    try {
      const [dispatchRes, vehiclesRes, employeesRes, reconRes] = await Promise.all([
        axios.get('/management/dispatcher/'),
        axios.get('/management/vehicles/?is_active=true'),
        axios.get('/management/employees/'),
        axios.get('/management/reconciliation/')
      ]);
      setDeliveries(dispatchRes.data.deliveries || {});
      setPickups(dispatchRes.data.pickups || []);
      setExternalSlaughter(dispatchRes.data.external_slaughter || []);
      setActiveShipments(dispatchRes.data.active_shipments || []);
      setCompletedShipments(dispatchRes.data.completed_shipments || []);
      setVehicles(vehiclesRes.data.results || []);
      setEmployees(employeesRes.data.results || []);
      if (reconRes.data && reconRes.data.drivers_reconciliation) {
        setReconciliationData(reconRes.data.drivers_reconciliation);
      }
      if (showToast) toast.success('تم تحديث الشاشة');
    } catch {
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const grouped = {};
    Object.entries(deliveries).forEach(([governorate, orders]) => {
      orders.forEach(order => {
        const sourceFarm = order.items?.[0]?.source_farm_name || 'مزرعتنا';
        const key = `${sourceFarm}||${governorate}`;
        if (!grouped[key]) {
          grouped[key] = { source: sourceFarm, destination: governorate, orders: [] };
        }
        grouped[key].orders.push(order);
      });
    });
    setGroupedDeliveries(grouped);
  }, [deliveries]);

  const toggleSelection = (id) => {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectAllInGroup = (groupKey) => {
    const groupOrderIds = (groupedDeliveries[groupKey]?.orders || []).map(o => o.id);
    const allSelected = groupOrderIds.every(id => selectedOrders.includes(id));
    if (allSelected) {
      setSelectedOrders(prev => prev.filter(id => !groupOrderIds.includes(id)));
    } else {
      setSelectedOrders(prev => [...new Set([...prev, ...groupOrderIds])]);
    }
  };

  const openShipmentModal = (type) => {
    setCurrentShipmentType(type);
    setShowShipmentModal(true);
  };

  const handleCreateShipment = async (formData) => {
    try {
      await axios.post('/orders/shipments/', { ...formData, order_ids: selectedOrders });
      toast.success('تم تكليف السائق بالرحلة بنجاح');
      setShowShipmentModal(false);
      setSelectedOrders([]);
      fetchData();
    } catch {
      toast.error('فشل إنشاء الرحلة');
    }
  };

  const handleCreateRoute = async (formData) => {
    try {
      await axios.post('/orders/shipments/', formData);
      toast.success('تم إنشاء خطة الرحلة وتكليف السائق');
      setShowRouteModal(false);
      setSelectedOrders([]);
      fetchData();
    } catch {
      toast.error('فشل إنشاء الرحلة المجمعة');
    }
  };

  const handleAdvanceLogistics = async (orderId, actionType) => {
    try {
      await axios.patch(`/management/dispatcher/${orderId}/`, { action: actionType });
      toast.success('تم التحديث');
      fetchData();
    } catch {
      toast.error('فشل التحديث');
    }
  };

  const handleBulkPrint = () => {
    if (selectedOrders.length === 0) {
      toast.warn('اختر طلبات للطباعة');
      return;
    }
    const idsString = selectedOrders.join(',');
    setPrintConfig({
      show: true,
      title: 'طباعة مجمعة لطلبات الرحلة',
      endpoint: `/orders/bulk-print/?ids=${idsString}`
    });
  };

  const handleDispatcherResendOtp = async (orderId) => {
    if (!window.confirm('هل تريد إرسال كود الاستلام لهذا العميل استثنائياً؟ (ستصلك رسالة للكود في لوحة SMS إذا أردت إملائه للسائق)')) return;
    try {
      await axios.post(`/management/orders/${orderId}/send-delivery-otp/`);
      toast.success('تم إرسال كود الـ OTP الاستثنائي بنجاح.');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل الإرسال');
    }
  };

  const filteredGroupedDeliveries = Object.entries(groupedDeliveries).reduce((acc, [key, group]) => {
    if (filterGov !== 'all' && group.destination !== filterGov) return acc;
    const filteredOrders = group.orders.filter(order => {
      if (filterService === 'all') return true;
      if (filterService === 'slaughter') return order.has_slaughter_service;
      if (filterService === 'live') return !order.has_slaughter_service;
      return true;
    });
    if (filteredOrders.length > 0) {
      acc[key] = { ...group, orders: filteredOrders };
    }
    return acc;
  }, {});

  const governorates = [...new Set(Object.values(groupedDeliveries).map(g => g.destination))];

  const renderActiveShipments = () => (
    <div className="mt-3">
      {activeShipments.length === 0 ? (
        <Alert variant="info" className="text-center py-4">لا توجد رحلات نشطة في الوقت الحالي.</Alert>
      ) : (
        activeShipments.map(ship => (
          <Card key={ship.id} className="mb-3 border-primary shadow-sm">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center py-3">
              <div>
                <h5 className="mb-0 fw-bold text-primary">رحلة #{ship.id}</h5>
                <small className="text-muted">السائق: {ship.supervisor_name} | المركبة: {ship.vehicle_name}</small>
              </div>
              <Badge bg={ship.status === 'out_for_delivery' ? 'primary' : 'success'} className="fs-6 px-3 py-2">
                {ship.status_display}
              </Badge>
            </Card.Header>
            <Card.Body className="bg-light p-3">
              <h6 className="fw-bold mb-3 d-flex align-items-center gap-2">
                <Activity size={18} className="text-primary" /> تتبع مسار الرحلة المباشر
              </h6>
              <div className="table-responsive">
                <Table size="sm" bordered hover className="mb-0 bg-white">
                  <thead className="table-light">
                    <tr>
                      <th>رقم الطلب والعميل</th>
                      <th>المنطقة</th>
                      <th>المبلغ المطلوب</th>
                      <th>حالة التوصيل</th>
                      <th>آخر تحديثات السائق</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ship.orders_details?.map(order => (
                      <tr key={order.id} className={order.status === 'delivered' ? 'table-success' : ''}>
                        <td className="fw-bold">
                          #{order.id} <br />
                          <small className="text-muted fw-normal">{order.customer_name}</small>
                        </td>
                        <td>{order.governorate}</td>
                        <td className="text-danger fw-bold">{order.remaining_amount} ج.م</td>
                        <td>
                          {order.status === 'delivered' ? (
                            <Badge bg="success"><CheckCircle size={12} className="me-1" /> تم التسليم</Badge>
                          ) : (
                            <Badge bg="warning" text="dark"><Truck size={12} className="me-1" /> جاري التوصيل</Badge>
                          )}
                        </td>
                        <td style={{ maxWidth: '300px', whiteSpace: 'pre-wrap' }}>
                          <div className="small text-muted" style={{ maxHeight: '80px', overflowY: 'auto' }}>
                            {order.notes || 'في انتظار تحرك السائق...'}
                          </div>
                        </td>
                        <td className="text-center">
                          {order.status !== 'delivered' && (
                            <Button
                              variant="outline-danger"
                              size="sm"
                              style={{ fontSize: '10px', padding: '2px 5px' }}
                              onClick={() => handleDispatcherResendOtp(order.id)}
                              title="إرسال OTP للعميل كتدخل إداري إذا استنفذ السائق المحاولات"
                            >
                              <ShieldCheck size={12} className="me-1" /> إرسال OTP استثنائي
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {ship.last_lat && ship.last_lng && (
                <div className="mt-3 p-3 bg-light border rounded small d-flex justify-content-between align-items-center">
                  <div>
                    <MapPin size={16} className="text-danger me-1" />
                    <strong>آخر موقع تم التقاطه للسائق:</strong>
                    <div className="text-muted mt-1" dir="ltr" style={{ textAlign: 'right' }}>
                      {new Date(ship.last_location_update).toLocaleString('ar-EG', { numberingSystem: 'latn' })}
                    </div>
                  </div>
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${ship.last_lat},${ship.last_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1"
                  >
                    <MapPin size={14} /> عرض على الخريطة
                  </a>
                </div>
              )}
              {ship.history_log && ship.history_log.length > 0 && (
                <div className="mt-3">
                  <h6 className="fw-bold mb-2 text-primary small"><Clock size={14}/> سجل تحركات السائق (Log)</h6>
                  <div className="bg-light p-2 rounded border" style={{maxHeight: '150px', overflowY: 'auto'}}>
                    {ship.history_log.map((log, lIdx) => (
                      <div key={lIdx} className="mb-2 pb-2 border-bottom small">
                        <strong className="text-dark">{log.action}</strong>
                        <span className="text-muted ms-2" dir="ltr">{new Date(log.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                        {log.details && <div className="text-muted mt-1">{log.details}</div>}
                        {log.location && <div className="text-muted mt-1" dir="ltr">{log.location}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        ))
      )}
    </div>
  );

  const renderReconciliation = () => {
    const totalCash = reconciliationData.reduce((sum, d) => sum + parseFloat(d.total_cash_collected || 0), 0);
    const totalPos = reconciliationData.reduce((sum, d) => sum + parseFloat(d.total_pos_collected || 0), 0);

    return (
      <div className="mt-3">
        <Row className="mb-4 g-3">
          <Col md={6}>
            <Card className="border-start border-success border-4 shadow-sm h-100">
              <Card.Body className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-muted fw-bold">إجمالي الكاش المستلم اليوم</small>
                  <h3 className="mb-0 text-success fw-black">{totalCash.toLocaleString()} ج.م</h3>
                </div>
                <div className="bg-success bg-opacity-10 p-3 rounded-circle text-success"><Wallet size={24} /></div>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="border-start border-primary border-4 shadow-sm h-100">
              <Card.Body className="d-flex justify-content-between align-items-center">
                <div>
                  <small className="text-muted fw-bold">إجمالي ماكينات POS اليوم</small>
                  <h3 className="mb-0 text-primary fw-black">{totalPos.toLocaleString()} ج.م</h3>
                </div>
                <div className="bg-primary bg-opacity-10 p-3 rounded-circle text-primary"><CreditCard size={24} /></div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {reconciliationData.length === 0 ? (
          <Alert variant="info" className="text-center">لم يقم أي سائق بتسليم طلبات وإنهاء عهدته لليوم بعد.</Alert>
        ) : (
          <div className="d-flex flex-column gap-4">
            {reconciliationData.map((shipment, idx) => (
              <Card key={idx} className="border shadow-sm">
                <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <h5 className="mb-1 fw-bold text-dark"><Truck size={20} className="me-2 text-muted" />{shipment.driver_name}</h5>
                    <small className="text-muted">المركبة: {shipment.vehicle} | رحلة #{shipment.shipment_id}</small>
                  </div>
                  <div className="d-flex gap-3 text-end">
                    <div className="bg-success bg-opacity-10 px-3 py-2 rounded border border-success">
                      <small className="d-block text-success fw-bold">كاش (نقدية)</small>
                      <span className="h5 fw-black text-success mb-0">{shipment.total_cash_collected.toLocaleString()} ج.م</span>
                    </div>
                    <div className="bg-primary bg-opacity-10 px-3 py-2 rounded border border-primary">
                      <small className="d-block text-primary fw-bold">ماكينة POS</small>
                      <span className="h5 fw-black text-primary mb-0">{shipment.total_pos_collected.toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body className="p-0">
                  <Table responsive striped hover className="mb-0 align-middle text-center">
                    <thead className="bg-light">
                      <tr>
                        <th>رقم الطلب</th>
                        <th>العميل</th>
                        <th>المبلغ المُحصّل</th>
                        <th>طريقة الدفع</th>
                        <th>الورق (الإيصال)</th>
                        <th className="no-print">إخلاء طرف (المنسق)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipment.paperwork.map((paper, pIdx) => (
                        <tr key={pIdx}>
                          <td className="fw-bold">#{paper.order_id}</td>
                          <td>{paper.customer_name}</td>
                          <td className="fw-bold text-dark">{paper.amount_collected} ج.م</td>
                          <td>
                            {paper.is_pos ? <Badge bg="primary"><CreditCard size={12} className="me-1" /> ماكينة POS</Badge> : <Badge bg="success"><Wallet size={12} className="me-1" /> كاش</Badge>}
                          </td>
                          <td>
                            <div className="d-flex align-items-center justify-content-center gap-2">
                              <FileText size={16} className="text-muted" />
                              {paper.doc_name}
                              {paper.has_image ? <Badge bg="success" className="ms-1">مرفوع ✓</Badge> : <Badge bg="danger" className="ms-1">غير مرفوع</Badge>}
                            </div>
                          </td>
                          <td className="no-print">
                            <Form.Check type="checkbox" label="استلمت" className="d-inline-block fw-bold text-success" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            ))}
          </div>
        )}
      </div>
    );
  };

  const allAvailableOrders = [
    ...Object.values(deliveries).flat(),
    ...pickups,
    ...externalSlaughter
  ];

  return (
    <div className="container-fluid py-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 mb-1 d-flex align-items-center gap-2">
            <Navigation className="text-primary" /> منسق العمليات والرحلات
          </h1>
          <p className="text-muted mb-0">تخطيط المسارات، تتبع السائقين، واستلام العهدة</p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-primary" onClick={() => fetchData(true)} disabled={refreshing}>
            <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'جاري التحديث...' : 'تحديث'}
          </Button>
          <Button variant="success" onClick={() => setShowRouteModal(true)}>
            <PlusCircle size={18} className="me-2" /> بناء خطة رحلة مجمعة
          </Button>
          {activeTab === 'deliveries' && (
            <>
              <Button variant="secondary" onClick={handleBulkPrint} disabled={selectedOrders.length === 0}>
                <Printer size={18} className="me-2" /> طباعة ({selectedOrders.length})
              </Button>
              <Button variant="primary" onClick={() => openShipmentModal('delivery')} disabled={selectedOrders.length === 0}>
                <Truck size={18} className="me-2" /> تكليف سائق ({selectedOrders.length})
              </Button>
            </>
          )}
          {activeTab === 'pickups' && (
            <Button variant="danger" onClick={() => openShipmentModal('pickup')} disabled={selectedOrders.length === 0}>
              <Truck size={18} className="me-2" /> إرسال سيارة للمورد ({selectedOrders.length})
            </Button>
          )}
          {activeTab === 'slaughter' && (
            <Button variant="warning" onClick={() => openShipmentModal('slaughter')} disabled={selectedOrders.length === 0}>
              <Truck size={18} className="me-2" /> إرسال سيارة للمجزر ({selectedOrders.length})
            </Button>
          )}
        </div>
      </div>

      <Row>
        <Col lg={8}>
          <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
            <Card className="shadow-sm mb-4 border-0">
              <Card.Header className="bg-white p-0 border-bottom-0">
                <Nav variant="tabs" className="px-3 pt-3 flex-nowrap overflow-auto hide-scrollbar">
                  <Nav.Item><Nav.Link eventKey="deliveries" className="fw-bold px-3 py-2">1. تجهيز رحلات التوصيل <Badge bg="success" className="ms-1">{Object.values(deliveries).reduce((a, c) => a + c.length, 0)}</Badge></Nav.Link></Nav.Item>
                  <Nav.Item><Nav.Link eventKey="pickups" className="fw-bold px-3 py-2">نقل من الموردين <Badge bg="danger" className="ms-1">{pickups.length}</Badge></Nav.Link></Nav.Item>
                  <Nav.Item><Nav.Link eventKey="slaughter" className="fw-bold px-3 py-2">نقل للمجزر <Badge bg="warning" text="dark" className="ms-1">{externalSlaughter.length}</Badge></Nav.Link></Nav.Item>
                  <Nav.Item><Nav.Link eventKey="tracking" className="fw-bold px-4 py-2 text-primary border-start ms-2"><Activity size={16} className="me-1" /> 2. تتبع مباشر <Badge bg="primary" className="ms-1">{activeShipments.length}</Badge></Nav.Link></Nav.Item>
                  <Nav.Item><Nav.Link eventKey="reconciliation" className="fw-bold px-4 py-2 text-success"><Wallet size={16} className="me-1" /> 3. استلام العهد</Nav.Link></Nav.Item>
                  <Nav.Item>
                    <Nav.Link eventKey="history" className="fw-bold px-4 py-2 text-secondary">
                      <Clock size={16} className="me-1" /> الرحلات السابقة
                    </Nav.Link>
                  </Nav.Item>
                </Nav>
              </Card.Header>
              <Card.Body className="bg-light p-3">
                {loading ? (
                  <div className="text-center py-5"><Spinner animation="border" /></div>
                ) : (
                  <Tab.Content>
                    <Tab.Pane eventKey="deliveries">
                      <Alert variant="info" className="d-flex align-items-center gap-2 mb-3">
                        <Info size={20} />
                        قم بتحديد الطلبات حسب المنطقة، ثم اضغط على "تكليف سائق" بالأعلى لإنشاء رحلة توصيل للسائق.
                      </Alert>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <div className="d-flex align-items-center gap-2"><Filter size={18} /><span className="fw-bold">تصفية</span></div>
                        <div className="d-flex gap-2">
                          <Form.Select size="sm" value={filterGov} onChange={e => setFilterGov(e.target.value)} style={{ width: '150px' }}>
                            <option value="all">كل المحافظات</option>
                            {governorates.map(gov => <option key={gov} value={gov}>{gov}</option>)}
                          </Form.Select>
                          <Form.Select size="sm" value={filterService} onChange={e => setFilterService(e.target.value)} style={{ width: '150px' }}>
                            <option value="all">كل الخدمات</option>
                            <option value="slaughter">مذبوح</option>
                            <option value="live">حي</option>
                          </Form.Select>
                        </div>
                      </div>
                      {Object.keys(filteredGroupedDeliveries).length === 0 ? (
                        <div className="text-center py-5 text-muted bg-white rounded border">لا توجد طلبات توصيل جاهزة حالياً</div>
                      ) : (
                        Object.entries(filteredGroupedDeliveries).map(([key, group]) => (
                          <Card key={key} className="mb-4 shadow-sm border-0 border-top border-success border-4">
                            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
                              <div>
                                <h6 className="mb-1 fw-bold d-flex align-items-center gap-2">
                                  <MapPin size={18} className="text-danger" /> الوجهة: {group.destination}
                                </h6>
                                <small className="text-muted fw-bold">إجمالي: {group.orders.length} طلبات جاهزة للشحن</small>
                              </div>
                              <Button size="sm" variant={group.orders.every(o => selectedOrders.includes(o.id)) ? 'primary' : 'outline-primary'} onClick={() => selectAllInGroup(key)}>
                                {group.orders.every(o => selectedOrders.includes(o.id)) ? 'إلغاء الكل' : 'تحديد الكل'}
                              </Button>
                            </Card.Header>
                            <Card.Body className="p-0">
                              <Table hover className="mb-0 align-middle">
                                <thead className="bg-light">
                                  <tr>
                                    <th className="px-3">تحديد</th>
                                    <th>الطلب والعميل</th>
                                    <th>النوع</th>
                                    <th className="text-end pe-3">المتبقي للدفع</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {group.orders.map(order => (
                                    <tr key={order.id} className={selectedOrders.includes(order.id) ? 'table-primary' : ''}>
                                      <td className="px-3"><Form.Check type="checkbox" checked={selectedOrders.includes(order.id)} onChange={() => toggleSelection(order.id)} /></td>
                                      <td><div className="fw-bold">#{order.id} - {order.user?.full_name}</div><small className="text-muted">{order.user?.phone} | {order.delivery_address?.street}</small></td>
                                      <td><Badge bg={order.has_slaughter_service ? 'success' : 'warning'} text={order.has_slaughter_service ? 'white' : 'dark'}>{order.has_slaughter_service ? 'مذبوح' : 'حي'}</Badge></td>
                                      <td className="text-end fw-bold text-danger pe-3">{order.remaining_amount > 0 ? `${order.remaining_amount} ج` : <Badge bg="success">خالص</Badge>}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                            </Card.Body>
                          </Card>
                        ))
                      )}
                    </Tab.Pane>
                <Tab.Pane eventKey="pickups">
                      {pickups.length === 0 ? (
                        <div className="text-center py-4 bg-white rounded border text-muted">لا توجد مهام جلب من مزارع موردين</div>
                      ) : (
                        pickups.map(order => (
                          <Card key={order.id} className="mb-3 border-danger shadow-sm">
                            <Card.Body className="d-flex justify-content-between align-items-center">
                              <div>
                                <h6 className="fw-bold mb-1">طلب #{order.id} - {order.user?.full_name}</h6>
                                <p className="small text-muted mb-0">المورد: {order.items[0]?.source_farm_name || 'غير محدد'} | كود الحيوان: {order.items[0]?.animal_code}</p>
                              </div>
                              <div className="d-flex gap-2 align-items-center">
                                <Form.Check type="checkbox" label="تحديد للرحلة" checked={selectedOrders.includes(order.id)} onChange={() => toggleSelection(order.id)} className="fw-bold text-danger me-3" />
                                <Button size="sm" variant="success" onClick={() => handleAdvanceLogistics(order.id, 'pickup_completed')}>
                                  وصل المزرعة (تأكيد يدوي)
                                </Button>
                              </div>
                            </Card.Body>
                          </Card>
                        ))
                      )}
                    </Tab.Pane>

                    <Tab.Pane eventKey="slaughter">
                      <Alert variant="warning" className="mb-3 small fw-bold">الطلبات التي تتطلب ذبح خارجي (لعدم وجود مجزر داخلي)</Alert>
                      {externalSlaughter.length === 0 ? (
                        <div className="text-center py-4 bg-white rounded border text-muted">لا توجد مهام للمجزر الخارجي</div>
                      ) : (
                        externalSlaughter.map(order => (
                          <Card key={order.id} className="mb-3 border-warning shadow-sm">
                            <Card.Body className="d-flex justify-content-between align-items-center">
                              <div>
                                <h6 className="fw-bold mb-1">طلب #{order.id} - {order.user?.full_name}</h6>
                                <p className="small text-muted mb-0">عدد الحيوانات: {order.items?.length}</p>
                              </div>
                              <div className="d-flex gap-2 align-items-center">
                                <Form.Check type="checkbox" label="تحديد للرحلة" checked={selectedOrders.includes(order.id)} onChange={() => toggleSelection(order.id)} className="fw-bold text-warning me-3" />
                                <Button size="sm" variant="success" onClick={() => handleAdvanceLogistics(order.id, 'slaughter_completed')}>
                                  تم الذبح والعودة (تأكيد يدوي)
                                </Button>
                              </div>
                            </Card.Body>
                          </Card>
                        ))
                      )}
                    </Tab.Pane>

                    <Tab.Pane eventKey="tracking">{renderActiveShipments()}</Tab.Pane>
                    <Tab.Pane eventKey="reconciliation">{renderReconciliation()}</Tab.Pane>

                    <Tab.Pane eventKey="history">
                      {completedShipments.length === 0 ? (
                        <Alert variant="secondary" className="text-center py-4">لا توجد رحلات سابقة.</Alert>
                      ) : (
                        completedShipments.map(ship => (
                          <Card key={ship.id} className="mb-3 border-secondary shadow-sm">
                            <Card.Header className="bg-light d-flex justify-content-between align-items-center">
                              <div>
                                <h6 className="mb-0 fw-bold text-dark">سجل رحلة منتهية #{ship.id}</h6>
                                <small className="text-muted">السائق: {ship.supervisor_name} | {new Date(ship.date).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</small>
                              </div>
                              <Badge bg="secondary">أرشيف مكتمل</Badge>
                            </Card.Header>
                            <Card.Body className="p-0">
                              <Table size="sm" responsive className="mb-0 text-muted align-middle">
                                <thead className="table-light">
                                  <tr>
                                    <th>الطلب والعميل</th>
                                    <th>الملاحظات وتتبع الرحلة</th>
                                    <th className="text-center">إيصال الاستلام</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ship.orders_details?.map(order => (
                                    <tr key={order.id}>
                                      <td className="fw-bold text-dark" style={{ minWidth: '150px' }}>
                                        #{order.id}<br />
                                        <small className="fw-normal">{order.customer_name}</small><br />
                                        <Badge bg="light" text="dark" className="border mt-1">المطلوب: {order.remaining_amount} ج</Badge>
                                      </td>
                                      <td style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                                        {order.notes ? (
                                          <div className="p-2 bg-light rounded border border-gray-200">
                                            {order.notes}
                                          </div>
                                        ) : (
                                          <span className="text-muted">لا توجد ملاحظات مسجلة</span>
                                        )}
                                      </td>
                                      <td className="text-center">
                                        <div className="d-flex flex-column align-items-center justify-content-center">
                                          {order.signed_receipt_image ? (
                                            <a href={order.signed_receipt_image} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1">
                                              <FileText size={14} /> عرض الإيصال المُمضي
                                            </a>
                                          ) : (
                                            <span className="badge bg-danger">بدون إيصال مرفق</span>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </Table>
                              {ship.history_log && ship.history_log.length > 0 && (
                                <div className="p-3 bg-light border-top">
                                  <h6 className="fw-bold text-secondary small">سجل رحلة السائق الكامل</h6>
                                  <div style={{maxHeight: '150px', overflowY: 'auto'}}>
                                    {ship.history_log.map((log, lIdx) => (
                                      <div key={lIdx} className="small mb-1 text-muted">[{new Date(log.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}] <strong>{log.action}</strong> - {log.details || log.location}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </Card.Body>
                          </Card>
                        ))
                      )}
                    </Tab.Pane>
                  </Tab.Content>
                )}
              </Card.Body>
            </Card>
          </Tab.Container>
        </Col>

        <Col lg={4}>
          <Card className="shadow-sm sticky-top" style={{ top: '80px' }}>
            <Card.Header className="bg-light"><h6 className="mb-0 fw-bold">حالة أسطول السيارات</h6></Card.Header>
            <Card.Body className="p-0">
              <ul className="list-group list-group-flush" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {vehicles.map(v => {
                  const isBusy = activeShipments.some(s => s.vehicle === v.id);
                  return (
                    <li key={v.id} className={`list-group-item py-3 ${isBusy ? 'bg-light' : ''}`}>
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div className="fw-bold"><Truck size={16} className={`me-1 ${isBusy ? 'text-warning' : 'text-success'}`} /> {v.name}</div>
                        {isBusy ? <Badge bg="warning" text="dark">في رحلة</Badge> : <Badge bg="success">متاحة</Badge>}
                      </div>
                      <div className="small text-muted mb-1">السعة: {v.capacity_description || 'غير محدد'}</div>
                      <div className="small text-primary fw-bold">النوع: {v.vehicle_type === 'refrigerated' ? 'مبرد' : 'نقل مواشي'}</div>
                    </li>
                  );
                })}
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <CreateShipmentModal
        show={showShipmentModal}
        handleClose={() => setShowShipmentModal(false)}
        selectedOrders={selectedOrders}
        vehicles={vehicles}
        employees={employees}
        onCreate={handleCreateShipment}
        shipmentType={currentShipmentType}
      />

      <CreateRouteModal
        show={showRouteModal}
        handleClose={() => setShowRouteModal(false)}
        vehicles={vehicles}
        employees={employees}
        onCreate={handleCreateRoute}
        availableOrders={allAvailableOrders}
      />

      <PrintModal
        show={printConfig.show}
        handleClose={() => setPrintConfig({ show: false, title: '', endpoint: '' })}
        title={printConfig.title}
        endpoint={printConfig.endpoint}
      />

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Dispatcher;
