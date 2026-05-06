import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Modal, Button, Table, Badge, Form, Tab, Nav, Spinner, Card, Container } from 'react-bootstrap';
import {
  Eye,
  Printer,
  ShoppingBag,
  User,
  Calendar,
  MapPin,
  Phone,
  DollarSign,
  RefreshCw,
  Truck,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Tag,
  Wallet,
  FileText,
  UploadCloud,
  AlertTriangle,
  Bot,
  CalendarCheck
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { format } from 'date-fns';
import PrintModal from '../components/ui/PrintModal';

const getOrderTypeBadge = (typeLabel) => {
  switch (typeLabel) {
    case 'نقطة بيع':
      return { bg: 'info', text: 'dark' };
    case 'مجموعة خاصة':
      return { bg: 'purple', text: 'white', style: { backgroundColor: '#6f42c1' } };
    case 'مسبح أضاحي':
      return { bg: 'primary', text: 'white' };
    case 'مشاركة (لحم)':
      return { bg: 'primary', text: 'white' };
    case 'أضحية كاملة':
      return { bg: 'success', text: 'white' };
    default:
      return { bg: 'secondary', text: 'white' };
  }
};

const PaymentsModal = ({ show, handleClose, order }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (show && order) {
      setLoading(true);
      axios
        .get(`/payments/?order=${order.id}`)
        .then((res) => setPayments(res.data.results || res.data || []))
        .catch(() => toast.error('فشل تحميل المدفوعات'))
        .finally(() => setLoading(false));
    }
  }, [show, order]);

  return (
    <Modal show={show} onHide={handleClose} centered size="lg" fullscreen={isMobile ? 'sm-down' : undefined}>
      <Modal.Header closeButton className="border-bottom-0 pb-1">
        <Modal.Title className={isMobile ? 'h6' : 'h5'}>سجل مدفوعات طلب #{order?.id}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="pt-0">
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" size={isMobile ? 'sm' : undefined} />
            <div className="mt-2 small">جاري تحميل المدفوعات...</div>
          </div>
        ) : (
          <div className="table-responsive">
            <Table striped bordered hover size={isMobile ? 'sm' : undefined} className="mb-0 text-center align-middle">
              <thead className="table-light">
                <tr>
                  <th className={isMobile ? 'small' : ''}>التاريخ والوقت</th>
                  <th className={isMobile ? 'small' : ''}>المبلغ</th>
                  <th className={isMobile ? 'small' : ''}>الطريقة</th>
                  <th className={isMobile ? 'small' : ''}>المصدر / بواسطة</th>
                  <th className={isMobile ? 'small' : ''}>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const isManual = p.transaction_id && p.transaction_id.startsWith('MANUAL-');
                  const isPOS = p.transaction_id && p.transaction_id.startsWith('POS-');

                  let sourceText = 'المتجر الإلكتروني';
                  let sourceBadge = 'secondary';

                  if (isManual) {
                    sourceText = p.recorded_by_name ? `موظف: ${p.recorded_by_name}` : 'تسجيل يدوي (موظف)';
                    sourceBadge = 'warning';
                  } else if (isPOS) {
                    sourceText = 'نقطة البيع (كاشير)';
                    sourceBadge = 'info';
                  } else {
                    sourceText = p.payment_method.includes('رابط') || (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'رابط دفع أونلاين (SMS)' : 'المتجر الإلكتروني';
                    sourceBadge = p.payment_method.includes('رابط') || (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'warning' : 'primary';
                  }

                  return (
                    <tr key={p.id}>
                      <td style={{ direction: 'ltr' }} className={isMobile ? 'small text-muted' : 'text-muted'}>
                        {format(new Date(p.created_at), 'yyyy-MM-dd hh:mm a')}
                      </td>
                      <td className="fw-bold text-success">{parseFloat(p.amount).toFixed(2)} ج</td>
                      <td className={isMobile ? 'small' : ''} dir="ltr">
                        {p.payment_method === 'cash' ? 'كاش نقدي' :
                         p.payment_method === 'pos' ? 'ماكينة POS' :
                         p.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                         (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'فيزا - رابط SMS' :
                         p.payment_method === 'paymob' ? 'أونلاين (المتجر)' :
                         p.payment_method}
                       </td>
                      <td>
                        <Badge
                          bg={p.payment_method.includes('رابط') || (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'warning' : sourceBadge}
                          text={p.payment_method.includes('رابط') || (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'dark' : (sourceBadge === 'warning' ? 'dark' : 'light')}
                          className="fw-bold px-2 py-1 shadow-sm"
                        >
                          {p.payment_method.includes('رابط') || (p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'رابط دفع أونلاين (SMS)' : sourceText}
                        </Badge>
                       </td>
                      <td>
                        <Badge
                          bg={
                            p.status === 'completed' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'
                          }
                          className={isMobile ? 'small' : ''}
                        >
                          {p.status === 'completed' ? 'مكتمل' : p.status === 'failed' ? 'فشل' : 'معلق'}
                        </Badge>
                       </td>
                    </tr>
                  );
                })}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center py-3 text-muted">
                      لا توجد مدفوعات.
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        )}
      </Modal.Body>
      <Modal.Footer className="border-top-0 pt-1">
        <Button variant="secondary" onClick={handleClose} size={isMobile ? 'sm' : undefined} className="w-100">
          إغلاق
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

const RecordPaymentModal = ({ show, handleClose, order, onSaved }) => {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && order) {
      const isFirstPayment = parseFloat(order.deposit_total || 0) <= 0;
      const suggestedAmount = isFirstPayment ? order.min_deposit_required : order.remaining_amount;
      setAmount(suggestedAmount || '');
      setMethod('cash');
    }
  }, [show, order]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const val = parseFloat(amount);
    const isFirstPayment = parseFloat(order?.deposit_total || 0) <= 0;
    const minRequired = isFirstPayment ? parseFloat(order?.min_deposit_required || 1) : 1;

    if (!val || val <= 0) {
      toast.warn('يرجى إدخال مبلغ صحيح');
      return;
    }

    if (val < minRequired) {
      toast.warn(`الحد الأدنى المطلوب كعربون هو ${minRequired} ج.م`);
      return;
    }

    if (val > parseFloat(order?.remaining_amount || 0)) {
      toast.warn('المبلغ المدخل يتجاوز إجمالي المتبقي على العميل.');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`/management/orders/${order.id}/record-payment/`, {
        amount: val,
        payment_method: method,
      });
      toast.success('تم تسجيل الدفعة بنجاح');
      onSaved();
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'فشل تسجيل الدفعة');
    } finally {
      setLoading(false);
    }
  };

  const isFirstPayment = parseFloat(order?.deposit_total || 0) <= 0;
  const minRequired = isFirstPayment ? parseFloat(order?.min_deposit_required || 1) : 1;

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header closeButton>
        <Modal.Title className="fs-5">تسجيل دفعة يدوية (طلب #{order?.id})</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <div className="alert alert-info py-2">
            المبلغ المتبقي على العميل: <strong>{order?.remaining_amount} ج.م</strong>
            {isFirstPayment && (
              <div className="text-danger mt-1">
                الحد الأدنى المطلوب (عربون): <strong>{minRequired.toFixed(2)} ج.م</strong>
              </div>
            )}
          </div>
          <Form.Group className="mb-3">
            <Form.Label>المبلغ المستلم (ج.م)</Form.Label>
            <Form.Control
              type="number"
              step="0.01"
              min={minRequired}
              max={order?.remaining_amount}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>طريقة الدفع</Form.Label>
            <Form.Select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">كاش (نقدي)</option>
              <option value="bank_transfer">تحويل بنكي / إنستاباي</option>
              <option value="pos">ماكينة POS</option>
              <option value="paymob_link">إرسال رابط دفع (أونلاين) في SMS</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            إلغاء
          </Button>
          <Button variant="success" type="submit" disabled={loading}>
            {loading ? <Spinner size="sm" /> : 'تأكيد وحفظ'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

const UpdateServicesModal = ({ show, handleClose, item, orderId, onSuccess }) => {
  const [services, setServices] = useState({ slaughter: false, cutting: false, packaging: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && item) {
      setServices({
        slaughter: item.selected_services?.slaughter || false,
        cutting: item.selected_services?.cutting || false,
        packaging: item.selected_services?.packaging || false,
      });
    }
  }, [show, item]);

  const handleToggle = (e) => {
    const { name, checked } = e.target;
    setServices(prev => {
      const newSrv = { ...prev, [name]: checked };
      if (name === 'slaughter' && !checked) {
        newSrv.cutting = false;
        newSrv.packaging = false;
      }
      if (name === 'cutting' && !checked) {
        newSrv.packaging = false;
      }
      return newSrv;
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await axios.post(`/management/orders/${orderId}/update-item-services/`, {
        item_id: item.id,
        services: services
      });
      toast.success("تم تحديث الخدمات وتعديل الفاتورة للعميل.");
      onSuccess();
      handleClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || "فشل تحديث الخدمات.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} centered style={{ zIndex: 1060 }}>
      <Modal.Header closeButton className="bg-primary text-white">
        <Modal.Title className="h6">تعديل خدمات الحيوان #{item?.animal_code}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className="alert alert-info small">
          أي تعديل هنا سيقوم بتحديث التكلفة آلياً، وسيرى العميل الفاتورة الجديدة والمبلغ المتبقي في حسابه فوراً.
        </div>
        <div className="d-flex flex-column gap-3 p-3 bg-light rounded border">
          <div>
              <Form.Check
                type="switch"
                name="slaughter"
                label={`خدمة الذبح (+${item?.animal?.category?.slaughter_price || item?.category_prices?.slaughter_price || 0} ج)`}
                checked={services.slaughter}
                onChange={handleToggle}
                className="fw-bold"
              />
              {item?.animal?.category?.enable_slaughter === false && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1 animate-pulse">
                      <AlertTriangle size={14} /> تنبيه: خدمة الذبح غير مدعومة لهذه الفئة!
                  </div>
              )}
          </div>
          <div>
              <Form.Check
                type="switch"
                name="cutting"
                label={`خدمة التقطيع (+${item?.animal?.category?.cutting_price || item?.category_prices?.cutting_price || 0} ج)`}
                checked={services.cutting}
                onChange={handleToggle}
                disabled={!services.slaughter}
              />
              {item?.animal?.category?.enable_cutting === false && services.slaughter && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1 animate-pulse">
                      <AlertTriangle size={14} /> تنبيه: خدمة التقطيع غير مدعومة لهذه الفئة!
                  </div>
              )}
          </div>
          <div>
              <Form.Check
                type="switch"
                name="packaging"
                label={`خدمة التغليف (+${item?.animal?.category?.packaging_price || item?.category_prices?.packaging_price || 0} ج)`}
                checked={services.packaging}
                onChange={handleToggle}
                disabled={!services.cutting}
              />
              {item?.animal?.category?.enable_packaging === false && services.cutting && (
                  <div className="text-danger small mt-1 d-flex align-items-center gap-1 animate-pulse">
                      <AlertTriangle size={14} /> تنبيه: خدمة التغليف غير مدعومة لهذه الفئة!
                  </div>
              )}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
        <Button variant="primary" onClick={handleSubmit} disabled={loading}>
          {loading ? <Spinner size="sm" /> : 'حفظ التعديلات'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

const OrderDetailModal = ({ show, handleClose, order, isMobile, onOpenPayment }) => {
  const[updatingDate, setUpdatingDate] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [payments, setPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState({});
  const fileInputRef = useRef(null);
  const [currentOrder, setCurrentOrder] = useState(null);
  const [printConfig, setPrintConfig] = useState({ show: false, title: '', endpoint: '' });

  const [showUpdateWeightModal, setShowUpdateWeightModal] = useState(false);
  const [weightUpdateItem, setWeightUpdateItem] = useState(null);
  const [newActualWeight, setNewActualWeight] = useState('');
  const [newActualPrice, setNewActualPrice] = useState('');

  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapItem, setSwapItem] = useState(null);
  const [swapSuggestions, setSwapSuggestions] = useState([]);
  const [isSwapping, setIsSwapping] = useState(false);

  const [showUpdateServicesModal, setShowUpdateServicesModal] = useState(false);
  const[serviceUpdateItem, setServiceUpdateItem] = useState(null);
  const [newDeliveryDate, setNewDeliveryDate] = useState('');
  useEffect(() => { if (currentOrder) setNewDeliveryDate(currentOrder.delivery_date || ''); },[currentOrder]);

  useEffect(() => {
    if (order) {
      setCurrentOrder(order);
      setNewStatus(order.status);
    }
  }, [order]);

  useEffect(() => {
    if (show && currentOrder) {
      setLoadingPayments(true);
      axios
        .get(`/payments/?order=${currentOrder.id}`)
        .then((res) => setPayments(res.data.results || res.data || []))
        .catch(() => toast.error('فشل تحميل سجل المدفوعات'))
        .finally(() => setLoadingPayments(false));
    }
  }, [show, currentOrder]);

  const fetchOrderDetails = async () => {
    if (!currentOrder) return;
    try {
      const res = await axios.get(`/management/orders/${currentOrder.id}/`);
      setCurrentOrder(res.data);
    } catch {
      toast.error('فشل تحديث بيانات الطلب');
    }
  };

  const handleStatusUpdate = async () => {
    try {
      await axios.patch(`/management/orders/${currentOrder.id}/`, { status: newStatus });
      toast.success('تم تحديث حالة الطلب بنجاح');
      handleClose(true);
    } catch {
      toast.error('فشل تحديث حالة الطلب.');
    }
  };

  const handleUploadReceipt = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const title = window.prompt(
      'يرجى إدخال عنوان أو وصف لهذه الوثيقة (مثال: إذن تسليم، صورة حوالة، الخ):',
      `وثيقة تابعة للطلب #${currentOrder.id}`
    );
    if (!title) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const formData = new FormData();
    formData.append('title', title);
    formData.append('document_type', 'order_doc');
    formData.append('order', currentOrder.id);
    formData.append('file', file);

    setUploadingDoc(true);
    try {
      await axios.post('/management/document-archive/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('تم رفع وحفظ الوثيقة بنجاح');
      handleClose(true);
    } catch {
      toast.error('فشل رفع المستند');
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadVideo = async (itemId, file) => {
    if (!file) return;
    setUploadingVideo((prev) => ({ ...prev, [itemId]: true }));

    const formData = new FormData();
    formData.append('item_id', itemId);
    formData.append('video', file);

    const toastId = toast.loading('جاري رفع الفيديو ووضع العلامة المائية...');
    try {
      await axios.post(`/management/orders/${currentOrder.id}/upload-slaughter-video/`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.update(toastId, {
        render: 'تم رفع الفيديو بنجاح!',
        type: 'success',
        isLoading: false,
        autoClose: 3000,
      });
      await fetchOrderDetails();
    } catch {
      toast.update(toastId, {
        render: 'فشل رفع الفيديو',
        type: 'error',
        isLoading: false,
        autoClose: 3000,
      });
    } finally {
      setUploadingVideo((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const openUpdateWeight = (item) => {
    setWeightUpdateItem(item);
    setNewActualWeight(item.animal?.current_weight || '');
    setNewActualPrice(item.price_per_item || '');
    setShowUpdateWeightModal(true);
  };

  const submitUpdateWeight = async () => {
    try {
      await axios.post(`/management/orders/${currentOrder.id}/update-weight-price/`, {
        item_id: weightUpdateItem.id,
        new_weight: newActualWeight,
        new_price: newActualPrice,
      });
      toast.success("تم تحديث الوزن والفاتورة.");
      setShowUpdateWeightModal(false);
      fetchOrderDetails();
      handleClose(true);
    } catch  {
      toast.error("فشل التحديث.");
    }
  };

  const openSwapModal = async (item) => {
    setSwapItem(item);
    setShowSwapModal(true);
    setIsSwapping(true);
    try {
      const res = await axios.get(`/management/orders/${currentOrder.id}/suggest-replacements/?item_id=${item.id}`);
      setSwapSuggestions(res.data);
    } catch  {
      toast.error("فشل جلب الترشيحات");
    } finally {
      setIsSwapping(false);
    }
  };

  const confirmSwap = async (newAnimalId) => {
    if (!window.confirm("هل أنت متأكد من استبدال الحيوان وتحديث الفاتورة؟")) return;
    try {
      await axios.post(`/management/orders/${currentOrder.id}/swap-animal/`, {
        item_id: swapItem.id,
        new_animal_id: newAnimalId,
      });
      toast.success("تم الاستبدال بنجاح.");
      setShowSwapModal(false);
      fetchOrderDetails();
      handleClose(true);
    } catch  {
      toast.error("فشل الاستبدال.");
    }
  };

  const openUpdateServices = (item) => {
    setServiceUpdateItem(item);
    setShowUpdateServicesModal(true);
  };

  if (!currentOrder) return null;

  const incompleteShareItem = currentOrder.items?.find(item =>
    ['adahi_pool', 'adahi_group', 'shares'].includes(item.listing_section) &&
    (item.animal?.remaining_shares > 0)
  );

  const isAdvancedStatus =['processing', 'packaging', 'ready_for_shipment', 'out_for_delivery', 'shipped', 'delivered', 'completed'].includes(newStatus);
  const isStatusUpdateDisabled = incompleteShareItem && isAdvancedStatus;

  const getServiceNames = (services) => {
    if (!services || typeof services !== 'object') return 'لا يوجد';

    const serviceMap = {
      slaughter: 'ذبح',
      cutting: 'تقطيع',
      packaging: 'تغليف',
      request_video: 'طلب تصوير فيديو',
    };

    const ignoredKeys = [
      'is_group_creator',
      'payment_type',
      'user_entered_deposit_amount',
      'butcher_notes',
      'extra_parts_preference',
      'slaughter_option_type',
      'cutting_option',
      'packaging_option',
    ];

    const activeServices = [];
    const serviceCosts = services._service_costs || {};

    Object.keys(services).forEach((key) => {
      if (key.startsWith('_') || ignoredKeys.includes(key)) return;

      if (services[key] === true || services[key] === 'yes') {
        const arName = serviceMap[key] || key;
        const cost = serviceCosts[key] || 0;
        activeServices.push(cost > 0 ? `${arName} (${cost} ج)` : arName);
      } else if (typeof services[key] === 'string' && services[key] !== 'no' && services[key] !== 'false') {
        activeServices.push(`${key} (${services[key]} ج)`);
      }
    });

    return activeServices.length > 0 ? activeServices.join('، ') : 'لا يوجد';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock size={16} />;
      case 'confirmed':
        return <CheckCircle size={16} />;
      case 'processing':
        return <Package size={16} />;
      case 'ready_for_shipment':
        return <Package size={16} />;
      case 'out_for_delivery':
        return <Truck size={16} />;
      case 'delivered':
        return <CheckCircle size={16} />;
      case 'completed':
        return <CheckCircle size={16} />;
      case 'canceled':
        return <XCircle size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'confirmed':
        return 'info';
      case 'processing':
        return 'primary';
      case 'ready_for_shipment':
        return 'info';
      case 'out_for_delivery':
        return 'primary';
      case 'delivered':
        return 'success';
      case 'completed':
        return 'success';
      case 'canceled':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const orderTypeStyle = currentOrder?.order_type_label
    ? getOrderTypeBadge(currentOrder.order_type_label)
    : { bg: 'secondary', text: 'white' };

  return (
    <Modal
      show={show}
      onHide={() => handleClose(false)}
      centered
      size={isMobile ? 'md' : 'lg'}
      fullscreen={isMobile ? 'sm-down' : undefined}
    >
      <Modal.Header closeButton className="border-bottom-0 pb-1">
        <Modal.Title className={isMobile ? 'h6' : ''}>تفاصيل الطلب #{currentOrder.id}</Modal.Title>
      </Modal.Header>
      <Modal.Body className="pt-0">
        <div className="mb-3 no-print d-flex gap-2 flex-wrap">
          <Button
            variant="outline-secondary"
            className={`flex-fill d-flex align-items-center justify-content-center gap-2 ${isMobile ? 'btn-sm' : ''}`}
            onClick={() => setPrintConfig({ show: true, title: `فاتورة طلب #${currentOrder.id}`, endpoint: `/orders/invoice/${currentOrder.id}/` })}
          >
            <Printer size={isMobile ? 14 : 16} /> فاتورة
          </Button>

          <Button
            variant="outline-secondary"
            className={`flex-fill d-flex align-items-center justify-content-center gap-2 ${isMobile ? 'btn-sm' : ''}`}
            onClick={() => setPrintConfig({ show: true, title: `إذن تسليم طلب #${currentOrder.id}`, endpoint: `/orders/delivery-note/${currentOrder.id}/` })}
          >
            <Printer size={isMobile ? 14 : 16} /> إذن تسليم
          </Button>

          {parseFloat(currentOrder.deposit_total) > 0 && (
            <Button
              variant="outline-secondary"
              className={`flex-fill d-flex align-items-center justify-content-center gap-2 ${isMobile ? 'btn-sm' : ''}`}
              onClick={() => setPrintConfig({ show: true, title: `إيصال عربون طلب #${currentOrder.id}`, endpoint: `/orders/receipt/${currentOrder.id}/` })}
            >
              <Printer size={isMobile ? 14 : 16} /> إيصال عربون
            </Button>
          )}

          {currentOrder.signed_receipt_image && (
            <Button
              variant="primary"
              onClick={(e) => {
                e.preventDefault();
                window.open(currentOrder.signed_receipt_image, '_blank');
              }}
              size={isMobile ? 'sm' : ''}
              className="flex-fill d-flex align-items-center justify-content-center gap-2 shadow-sm"
            >
              <Eye size={isMobile ? 14 : 16} /> عرض الإذن المُوقع
            </Button>
          )}

          {currentOrder.delivery_photo && (
            <Button
              variant="info"
              className="text-white flex-fill d-flex align-items-center justify-content-center gap-2 shadow-sm"
              onClick={(e) => {
                e.preventDefault();
                window.open(currentOrder.delivery_photo, '_blank');
              }}
              size={isMobile ? 'sm' : ''}
            >
              <Eye size={isMobile ? 14 : 16} /> صورة التسليم
            </Button>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".pdf,image/*"
            onChange={handleUploadReceipt}
          />
          <Button
            variant="outline-success"
            onClick={(e) => {
              e.preventDefault();
              fileInputRef.current?.click();
            }}
            size={isMobile ? 'sm' : ''}
            className="flex-fill d-flex align-items-center justify-content-center gap-2"
            disabled={uploadingDoc}
          >
            {uploadingDoc ? <Spinner size="sm" /> : <UploadCloud size={isMobile ? 14 : 16} />}
            رفع وإرفاق وثيقة
          </Button>
        </div>

        {(currentOrder.signed_receipt_image ||
          currentOrder.delivery_photo ||
          (currentOrder.documents && currentOrder.documents.length > 0)) && (
          <Card className="border mb-3 border-success shadow-sm">
            <Card.Header className="bg-success bg-opacity-10 d-flex align-items-center gap-2 py-2">
              <CheckCircle size={16} className="text-success" />
              <span className="fw-bold text-success">الوثائق والإيصالات المرفقة</span>
            </Card.Header>
            <Card.Body className="p-3 d-flex gap-4 overflow-auto flex-wrap">
              {currentOrder.signed_receipt_image && (
                <div className="text-center" style={{ minWidth: '100px' }}>
                  <small className="d-block text-muted mb-1 fw-bold text-truncate">إيصال الاستلام</small>
                  <a
                    href={currentOrder.signed_receipt_image}
                    target="_blank"
                    rel="noreferrer"
                    className="d-inline-flex align-items-center justify-content-center rounded border shadow-sm bg-light text-primary overflow-hidden"
                    style={{ height: '100px', width: '100%', textDecoration: 'none' }}
                  >
                    <img src={currentOrder.signed_receipt_image} alt="إيصال" className="w-100 h-100" style={{ objectFit: 'cover' }} />
                  </a>
                </div>
              )}
              {currentOrder.delivery_photo && (
                <div className="text-center" style={{ minWidth: '100px' }}>
                  <small className="d-block text-muted mb-1 fw-bold text-truncate">صورة التسليم</small>
                  <a
                    href={currentOrder.delivery_photo}
                    target="_blank"
                    rel="noreferrer"
                    className="d-inline-flex align-items-center justify-content-center rounded border shadow-sm bg-light text-primary overflow-hidden"
                    style={{ height: '100px', width: '100%', textDecoration: 'none' }}
                  >
                    <img src={currentOrder.delivery_photo} alt="صورة تسليم" className="w-100 h-100" style={{ objectFit: 'cover' }} />
                  </a>
                </div>
              )}
              {currentOrder.documents &&
                currentOrder.documents.map((doc) => (
                  <div key={doc.id} className="text-center" style={{ minWidth: '100px' }}>
                    <small
                      className="d-block text-muted mb-1 fw-bold text-truncate"
                      style={{ maxWidth: '120px' }}
                      title={doc.title}
                    >
                      {doc.title}
                    </small>
                    <a
                      href={doc.file}
                      target="_blank"
                      rel="noreferrer"
                      className="d-inline-flex align-items-center justify-content-center rounded border shadow-sm bg-light text-primary overflow-hidden"
                      style={{ height: '100px', width: '100px', textDecoration: 'none' }}
                    >
                      {doc.file.match(/\.(jpeg|jpg|gif|png|webp)$/i) ? (
                        <img src={doc.file} alt={doc.title} className="w-100 h-100" style={{ objectFit: 'cover' }} />
                      ) : (
                        <FileText size={40} />
                      )}
                    </a>
                  </div>
                ))}
            </Card.Body>
          </Card>
        )}

        <Card className="border mb-3">
          <Card.Header className="bg-light d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <User size={16} />
              <span className="fw-bold">بيانات العميل</span>
            </div>
            {currentOrder.order_type_label && (
              <Badge
                bg={orderTypeStyle.bg}
                text={orderTypeStyle.text}
                style={orderTypeStyle.style}
                className="d-flex align-items-center gap-1"
              >
                <Tag size={12} />
                {currentOrder.order_type_label}
              </Badge>
            )}
          </Card.Header>
          <Card.Body className="p-2 p-md-3">
            <div className={isMobile ? 'small' : ''}>
              <div className="d-flex align-items-center gap-2 mb-2">
                <User size={14} className="text-primary" />
                <strong>الاسم:</strong> {currentOrder.user.full_name}
              </div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <Phone size={14} className="text-primary" />
                <strong>الهاتف:</strong> <span dir="ltr">{currentOrder.user.phone}</span>
              </div>
              {currentOrder.delivery_address?.street && (
                <div className="d-flex align-items-center gap-2 mb-2">
                  <MapPin size={14} className="text-primary" />
                  <strong>العنوان:</strong> {currentOrder.delivery_address.street} - {currentOrder.delivery_address.city} -{' '}
                  {currentOrder.delivery_address.governorate}
                </div>
              )}
            </div>
          </Card.Body>
        </Card>

        <Card className="border mb-3">
          <Card.Header className="bg-light d-flex align-items-center gap-2">
            <Package size={16} />
            <span className="fw-bold">تفاصيل الطلب الأساسية</span>
          </Card.Header>
          <Card.Body className="p-2 p-md-3">
            <div className="row g-2">
              <div className="col-6 col-md-4">
                <div className="text-muted small">الحالة</div>
                <Badge bg={getStatusColor(currentOrder.status)} className="d-inline-flex align-items-center gap-1">
                  {getStatusIcon(currentOrder.status)}
                  {currentOrder.status_display}
                </Badge>
              </div>
              <div className="col-6 col-md-4">
                <div className="text-muted small">المصدر</div>
                <div>{currentOrder.source === 'on_farm' ? 'نقطة بيع (المزرعة)' : 'المتجر الإلكتروني'}</div>
              </div>
              <div className="col-6 col-md-4">
                <div className="text-muted small">نوع الاستلام</div>
                <div>{currentOrder.delivery_type === 'pickup' ? 'استلام من المزرعة' : 'توصيل للمنزل'}</div>
              </div>
              <div className="col-6 col-md-4">
                <div className="text-muted small">تاريخ التوصيل</div>
                <div className="d-flex align-items-center gap-1 mt-1">
                    <Form.Control
                        type="date"
                        size="sm"
                        value={newDeliveryDate}
                        onChange={(e) => setNewDeliveryDate(e.target.value)}
                        style={{ padding: '0.1rem 0.3rem', fontSize: '0.8rem' }}
                    />
                    <Button
                        variant="primary"
                        size="sm"
                        style={{ padding: '0.1rem 0.3rem', fontSize: '0.8rem' }}
                        disabled={updatingDate}
                        onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setUpdatingDate(true);
                            try {
                                await axios.patch(`/management/orders/${currentOrder.id}/`, { delivery_date: newDeliveryDate || null });
                                toast.success('تم تحديث موعد التوصيل');
                                setShouldReload(c => c + 1);
                            } catch(err){
                                if(err.response?.status !== 401 && !axios.isCancel(err)) { toast.error('فشل التحديث'); }
                            } finally {
                                setUpdatingDate(false);
                            }
                        }}
                    >
                        {updatingDate ? '...' : 'حفظ'}
                    </Button>
                </div>
              </div>
              <div className="col-6 col-md-4">
                <div className="text-muted small">تاريخ الطلب</div>
                <div className="d-flex align-items-center gap-1" dir="ltr">
                  {format(new Date(currentOrder.created_at), 'yyyy-MM-dd')}
                </div>
              </div>
              {currentOrder.order_type_label && (
                <div className="col-6 col-md-4">
                  <div className="text-muted small">نوع الطلب</div>
                  <Badge
                    bg={orderTypeStyle.bg}
                    text={orderTypeStyle.text}
                    style={orderTypeStyle.style}
                    className="d-inline-flex align-items-center gap-1"
                  >
                    <Tag size={12} />
                    {currentOrder.order_type_label}
                  </Badge>
                </div>
              )}
            </div>
          </Card.Body>
        </Card>

        {currentOrder.items && currentOrder.items.length > 0 && (
          <Card className="border mb-3">
            <Card.Header className="bg-light d-flex align-items-center gap-2">
              <ShoppingBag size={16} />
              <span className="fw-bold">المنتجات والخدمات</span>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table bordered hover size={isMobile ? 'sm' : ''} className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th className={isMobile ? 'small' : ''}>المنتج</th>
                      <th className={isMobile ? 'small text-center' : 'text-center'}>السعر</th>
                      <th className={isMobile ? 'small' : ''}>الخدمات</th>
                      <th className={isMobile ? 'small text-center' : 'text-center'}>تكلفة الخدمات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentOrder.items.map((item) => (
                      <React.Fragment key={item.id}>
                        <tr>
                          <td className={isMobile ? 'small' : ''}>
                            <div className="font-bold text-dark text-sm">
                              {item.animal?.category_name} #{item.animal_code || item.animal?.code}
                            </div>
                            <div className="text-xs mt-1 mb-1 p-1 bg-warning bg-opacity-10 text-dark rounded border border-warning d-inline-block">
                              <strong>المصدر:</strong> {item.source_farm_name || 'مزارعنا'}
                              {item.supplier_code && (
                                <span className="ms-2">
                                  | <strong>كود المورد:</strong> {item.supplier_code}
                                </span>
                              )}
                            </div>
                            {item.share_quantity && item.share_quantity > 1 && (
                              <div className="mt-1">
                                <Badge bg="purple" style={{ backgroundColor: '#6f42c1' }}>
                                  {item.share_quantity} أسهم
                                </Badge>
                              </div>
                            )}
                          </td>
                          <td className={`${isMobile ? 'small' : ''} text-center fw-bold align-middle`}>
                            {item.original_price && item.original_price !== item.price_per_item ? (
                              <>
                                <div className="text-muted text-decoration-line-through small">{parseFloat(item.original_price).toFixed(2)}</div>
                                <div className="text-success fs-6">{parseFloat(item.price_per_item).toFixed(2)}</div>
                              </>
                            ) : (
                              <div className="fs-6">{parseFloat(item.price_per_item).toFixed(2)}</div>
                            )}

                            {currentOrder.pricing_model === 'live_weight' && currentOrder.status !== 'canceled' && (
                              <Button variant="outline-primary" size="sm" className="mt-2 d-block mx-auto fw-bold" onClick={() => openUpdateWeight(item)}>
                                تحديث الميزان
                              </Button>
                            )}

                            {currentOrder.status !== 'canceled' && currentOrder.status !== 'completed' && (
                              <Button variant="outline-secondary" size="sm" className="mt-2 d-block mx-auto fw-bold" onClick={() => openUpdateServices(item)}>
                                🛠️ تعديل الخدمات
                              </Button>
                            )}

                            {(item.animal?.source_farm || (item.source_farm_name && item.source_farm_name !== 'مزارعنا')) && currentOrder.status !== 'canceled' && currentOrder.status !== 'completed' && currentOrder.status !== 'requires_action' && (
                              <Button variant="outline-warning" size="sm" className="mt-2 d-block mx-auto text-dark fw-bold" onClick={async () => {
                                if(window.confirm("تأكيد إبلاغ أن المورد باع الحيوان؟ سيتم إيقاف الطلب.")) {
                                  try {
                                    const animalId = item.animal?.unique_id || item.animal?.id || item.animal_id;
                                    if (animalId) {
                                        await axios.post(`/management/animals/${animalId}/mark-supplier-sold/`);
                                        fetchOrderDetails();
                                        handleClose(true);
                                    } else {
                                        toast.error("تعذر العثور على معرف الحيوان لإتمام العملية");
                                    }
                                  } catch { toast.error('فشل الإبلاغ'); }
                                }
                              }}>
                                أبلغ كمباع (مورد)
                              </Button>
                            )}

                            {currentOrder.status === 'requires_action' && (
                              <Button variant="danger" size="sm" className="mt-2 d-block mx-auto animate-pulse shadow-sm fw-bold" onClick={() => openSwapModal(item)}>
                                تخصيص بديل
                              </Button>
                            )}
                          </td>
                          <td className={isMobile ? 'small' : ''}>
                            {getServiceNames(item.selected_services)}
                            {item.selected_services?.extra_parts_preference && (
                              <div className="text-muted small mt-1">
                                <strong className="text-dark">الأجزاء الإضافية:</strong>{' '}
                                {item.selected_services.extra_parts_preference === 'donate'
                                  ? 'تبرع'
                                  : item.selected_services.extra_parts_preference === 'sell'
                                  ? 'بيع'
                                  : 'استلام'}
                              </div>
                            )}
                            {item.selected_services?.butcher_notes && (
                              <div className="text-muted small mt-1">
                                <strong className="text-dark">ملاحظات الجزار:</strong> {item.selected_services.butcher_notes}
                              </div>
                            )}
                          </td>
                          <td className={`${isMobile ? 'small' : ''} text-center text-primary fw-bold`}>
                            {parseFloat(item.service_cost).toFixed(2)}
                          </td>
                        </tr>
                        {item.request_slaughter_video && (
                          <tr>
                            <td colSpan="4" className="p-2">
                              <div className="mt-1 p-3 bg-danger bg-opacity-10 border border-danger rounded d-flex justify-content-between align-items-center">
                                <div>
                                  <strong className="text-danger d-block">⚠️ مطلوب تصوير فيديو للذبح!</strong>
                                  <small className="text-muted">هذا العميل طلب توثيق عملية الذبح.</small>
                                </div>
                                {item.slaughter_video ? (
                                  <Badge bg="success">تم رفع الفيديو ✔️</Badge>
                                ) : (
                                  <div>
                                    <input
                                      type="file"
                                      accept="video/*"
                                      id={`video-upload-${item.id}`}
                                      style={{ display: 'none' }}
                                      onChange={(e) => handleUploadVideo(item.id, e.target.files[0])}
                                    />
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => document.getElementById(`video-upload-${item.id}`).click()}
                                      disabled={uploadingVideo[item.id]}
                                    >
                                      {uploadingVideo[item.id] ? (
                                        <Spinner size="sm" className="me-1" />
                                      ) : (
                                        <UploadCloud size={14} className="me-1" />
                                      )}
                                      رفع الفيديو
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        )}

        <Card className="border mb-3">
          <Card.Header className="bg-light d-flex align-items-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-2">
              <DollarSign size={16} />
              <span className="fw-bold">الملخص المالي</span>
            </div>
            {parseFloat(currentOrder.remaining_amount) > 0 && currentOrder.status !== 'canceled' && (
              <Button
                variant="success"
                size="sm"
                className="d-flex align-items-center gap-1 shadow-sm"
                onClick={onOpenPayment}
              >
                <Wallet size={14} /> تسجيل دفعة
              </Button>
            )}
          </Card.Header>
          <Card.Body className="p-2 p-md-3">
            <div className="bg-light p-2 rounded mb-3 border">
              <div className="d-flex justify-content-between text-muted small mb-1">
                <span>المشتريات وتجهيزها:</span>
                <span dir="ltr">
                  {(
                    currentOrder.items.reduce((s, i) => s + parseFloat(i.original_price || i.price_per_item || 0) * (i.share_quantity || 1), 0) +
                    parseFloat(currentOrder.total_items_services || 0)
                  ).toLocaleString()} ج.م
                </span>
              </div>

              {parseFloat(currentOrder.delivery_fee || 0) > 0 && (
                <div className="d-flex justify-content-between text-primary small fw-bold mb-1">
                  <span>رسوم التوصيل:</span>
                  <span dir="ltr">+{parseFloat(currentOrder.delivery_fee).toLocaleString()} ج.م</span>
                </div>
              )}

              {parseFloat(currentOrder.applied_discount_amount || 0) > 0 && (
                <div className="d-flex justify-content-between text-danger small fw-bold mt-1 bg-danger bg-opacity-10 px-2 py-1 rounded">
                  <span><Tag size={12} className="me-1"/>قسيمة خصم (مطبقة):</span>
                  <span dir="ltr">-{parseFloat(currentOrder.applied_discount_amount).toLocaleString()} ج.م</span>
                </div>
              )}
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-bold">الإجمالي الكلي:</span>
              <strong className="fs-5">{parseFloat(currentOrder.total_price).toLocaleString()} ج.م</strong>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className={`${isMobile ? 'small' : ''} text-success fw-bold`}>المبلغ المدفوع:</span>
              <strong className={`${isMobile ? 'small' : ''} text-success fs-5`}>
                {parseFloat(currentOrder.deposit_total).toLocaleString()} ج.م
              </strong>
            </div>
            <div className="d-flex justify-content-between align-items-center bg-danger bg-opacity-10 p-2 rounded border border-danger border-opacity-25">
              <span className={`${isMobile ? 'small' : ''} text-danger fw-bold`}>المبلغ المتبقي:</span>
              <strong className={`${isMobile ? 'small' : ''} text-danger fs-5`}>
                {parseFloat(currentOrder.remaining_amount).toLocaleString()} ج.م
              </strong>
            </div>
          </Card.Body>
        </Card>

        <Card className="border mb-3 border-info">
          <Card.Header className="bg-info bg-opacity-10 d-flex align-items-center gap-2">
            <Wallet size={16} className="text-info" />
            <span className="fw-bold text-info">سجل المدفوعات للطلب</span>
          </Card.Header>
          <Card.Body className="p-0">
            {loadingPayments ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" variant="info" />
                <span className="ms-2 small text-muted">جاري تحميل المدفوعات...</span>
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-3 text-muted small">لا توجد مدفوعات مسجلة لهذا الطلب حتى الآن.</div>
            ) : (
              <div className="table-responsive">
                <Table hover size="sm" className="mb-0 align-middle text-center">
                  <thead className="table-light">
                    <tr>
                      <th>التاريخ والوقت</th>
                      <th>المبلغ</th>
                      <th>الطريقة</th>
                      <th>المصدر / بواسطة</th>
                      <th>النوع</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => {
                      const isManual = p.transaction_id && p.transaction_id.startsWith('MANUAL-');
                      const isPOS = p.transaction_id && p.transaction_id.startsWith('POS-');

                      let sourceText = 'المتجر الإلكتروني';
                      let sourceBadge = 'secondary';

                      if (isManual) {
                        sourceText = p.recorded_by_name ? `موظف: ${p.recorded_by_name}` : 'تسجيل يدوي (موظف)';
                        sourceBadge = 'warning';
                      } else if (isPOS) {
                        sourceText = 'نقطة البيع (كاشير)';
                        sourceBadge = 'info';
                      } else if (p.payment_method === 'paymob') {
                        sourceText = 'أونلاين (Paymob)';
                        sourceBadge = 'primary';
                      }

                      return (
                        <tr key={p.id}>
                          <td style={{ direction: 'ltr' }} className="text-muted small">
                            {format(new Date(p.created_at), 'yyyy-MM-dd hh:mm a')}
                          </td>
                          <td className="fw-bold text-success">{parseFloat(p.amount).toFixed(2)} ج.م</td>
                          <td>
                            {p.payment_method === 'cash'
                              ? 'كاش'
                              : p.payment_method === 'paymob'
                              ? 'فيزا/أونلاين'
                              : p.payment_method}
                          </td>
                          <td>
                            <Badge
                              bg={(p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'warning' : sourceBadge}
                              text={(p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'dark' : (sourceBadge === 'warning' ? 'dark' : 'light')}
                              className="fw-normal"
                            >
                              {(p.payment_method === 'paymob_link' || p.payment_method.includes('رابط SMS') || p.payment_method.includes('رابط')) ? 'رابط دفع أونلاين (SMS)' : sourceText}
                            </Badge>
                          </td>
                          <td className="small text-muted">
                            {p.payment_type === 'initial' ? 'دفعة أولى/عربون' : 'دفعة متبقية'}
                          </td>
                          <td>
                            <Badge
                              bg={
                                p.status === 'completed' ? 'success' : p.status === 'failed' ? 'danger' : 'warning'
                              }
                            >
                              {p.status === 'completed' ? 'مكتمل' : p.status === 'failed' ? 'فشل' : 'معلق'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>

        {currentOrder.notes && (
          <Card className="border mb-3">
            <Card.Header className="bg-light d-flex align-items-center gap-2">
              <FileText size={16} />
              <span className="fw-bold">ملاحظات الطلب الإضافية</span>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              <p
                className="mb-0 text-muted"
                style={{ whiteSpace: 'pre-wrap' }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(currentOrder.notes) }}
              />
            </Card.Body>
          </Card>
        )}

        {incompleteShareItem && (
            <div className="bg-warning bg-opacity-10 border border-warning p-3 rounded-xl mb-3 animate-fade-in-up">
                <div className="d-flex align-items-start gap-2">
                    <AlertTriangle className="text-warning flex-shrink-0 mt-1" size={24} />
                    <div>
                        <strong className="text-dark d-block mb-1">تنبيه: ماشية التشارك لم تكتمل!</strong>
                        <span className="text-muted small">
                            هذا الطلب يحتوي على <strong>{incompleteShareItem.share_quantity} سهم</strong> في الحيوان <strong>#{incompleteShareItem.animal_code || incompleteShareItem.animal?.code}</strong>.
                            <br/>
                            لا يزال يتبقى <strong>{incompleteShareItem.animal?.remaining_shares} أسهم</strong> غير مباعة في هذا الحيوان.
                            لا يمكنك تحويل حالة هذا الطلب إلى (قيد التجهيز / شحن / توصيل) حتى تكتمل مبيعات الحيوان بالكامل.
                        </span>
                    </div>
                </div>
            </div>
        )}

        <Card className="border">
          <Card.Header className="bg-light d-flex align-items-center gap-2">
            <Clock size={16} />
            <span className="fw-bold">تحديث الحالة (إداري)</span>
          </Card.Header>
          <Card.Body className="p-2 p-md-3">
            <Form.Group>
              <Form.Label className={isMobile ? 'small mb-1' : ''}>الحالة الجديدة</Form.Label>
              <Form.Select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                size={isMobile ? 'sm' : ''}
                className={isMobile ? 'py-2' : ''}
              >
                <option value="pending">معلق (بانتظار الدفع)</option>
                <option value="confirmed">مؤكد (جاهز للبدء)</option>
                <option value="requires_action">يتطلب تدخل (نواقص) ⚠️</option>
                <option value="processing" disabled={!!incompleteShareItem}>قيد التجهيز / التحضير</option>
                <option value="packaging" disabled={!!incompleteShareItem}>في الثلاجة / التغليف</option>
                <option value="ready_for_shipment" disabled={!!incompleteShareItem}>جاهز للشحن / للاستلام</option>
                <option value="out_for_delivery" disabled={!!incompleteShareItem}>في الطريق للتوصيل</option>
                <option value="shipped" disabled>تم الشحن (حالة قديمة)</option>
                <option value="delivered" disabled={!!incompleteShareItem}>تم التوصيل / تم الاستلام</option>
                <option value="completed" disabled={!!incompleteShareItem}>مكتمل ونهائي</option>
                <option value="canceled">ملغي</option>
              </Form.Select>
              {isStatusUpdateDisabled && (
                  <Form.Text className="text-danger fw-bold d-block mt-2">
                      ❌ لا يمكن اختيار هذه الحالة قبل اكتمال بيع الحيوان.
                  </Form.Text>
              )}
            </Form.Group>
          </Card.Body>
        </Card>
      </Modal.Body>
      <Modal.Footer className="border-top-0 pt-1 flex-wrap">
        {currentOrder.status === 'canceled' && parseFloat(currentOrder.deposit_total) > 0 && (
          <div className="w-100 bg-danger bg-opacity-10 border border-danger rounded p-3 mb-2 animate-pulse">
            <h6 className="text-danger fw-bold mb-2">🚨 طلب ملغي ولكن تم دفع مبلغه!</h6>
            <p className="small text-danger mb-3">
              العميل قام بالدفع بعد انتهاء الـ 15 دقيقة وإلغاء الطلب آلياً. يرجى اتخاذ إجراء:
            </p>
            <div className="d-flex gap-2">
              <Button
                variant="success"
                size="sm"
                className="flex-fill fw-bold"
                onClick={async () => {
                  const newAnimalId = window.prompt(
                    'لإحياء الطلب، يرجى كتابة (ID) الحيوان البديل المتاح من المخزن:'
                  );
                  if (newAnimalId) {
                    try {
                      await axios.post(`/management/orders/${currentOrder.id}/revive-order/`, {
                        new_animal_id: newAnimalId,
                      });
                      toast.success('تم إحياء الطلب بنجاح');
                      handleClose(true);
                    } catch (e) {
                      toast.error(e.response?.data?.detail || 'فشل إحياء الطلب');
                    }
                  }
                }}
              >
                إحياء الطلب (تخصيص ماشية بديلة)
              </Button>
              <Button
                variant="outline-danger"
                size="sm"
                className="flex-fill fw-bold"
                onClick={async () => {
                  if (
                    window.confirm(
                      'هل قمت باسترجاع المبلغ من لوحة Paymob؟ إذا ضغطت نعم سيتم تصفير الدفعة هنا لإغلاق التنبيه.'
                    )
                  ) {
                    try {
                      await axios.post(`/management/orders/${currentOrder.id}/refund-order/`);
                      toast.success('تم إغلاق التنبيه وتسجيل الـ Refund');
                      handleClose(true);
                    } catch  {
                      toast.error('فشل العملية');
                    }
                  }
                }}
              >
                تم الاسترجاع (Refund)
              </Button>
            </div>
          </div>
        )}

        <Button
          variant="outline-secondary"
          onClick={() => handleClose(false)}
          size={isMobile ? 'sm' : ''}
          className="flex-fill"
        >
          إغلاق النافذة
        </Button>

        {currentOrder.status !== 'canceled' && (
          <Button
            variant="primary"
            onClick={handleStatusUpdate}
            size={isMobile ? 'sm' : ''}
            className="flex-fill"
            disabled={isStatusUpdateDisabled}
          >
            حفظ التغييرات
          </Button>
        )}
      </Modal.Footer>

      <Modal show={showUpdateWeightModal} onHide={() => setShowUpdateWeightModal(false)} centered style={{ zIndex: 1060 }}>
        <Modal.Header closeButton className="bg-primary text-white">
          <Modal.Title className="h6">تحديث الوزن الفعلي والمحاسبة</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="alert alert-info small">
            تحديث البيانات هنا سيقوم بتعديل فاتورة العميل وإضافة سجل ميزان جديد للحيوان.
          </div>
          <Form.Group className="mb-3">
            <Form.Label>الوزن الفعلي وقت التسليم (كجم)</Form.Label>
            <Form.Control
              type="number"
              value={newActualWeight}
              onChange={(e) => setNewActualWeight(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>السعر النهائي المطلوب (ج.م)</Form.Label>
            <Form.Control
              type="number"
              value={newActualPrice}
              onChange={(e) => setNewActualPrice(e.target.value)}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowUpdateWeightModal(false)}>
            إلغاء
          </Button>
          <Button variant="primary" onClick={submitUpdateWeight}>
            تأكيد وتحديث الفاتورة
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSwapModal} onHide={() => setShowSwapModal(false)} centered size="lg" style={{zIndex: 1060}}>
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title className="h6">تخصيص حيوان بديل للعميل</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {isSwapping ? (
            <div className="text-center py-4"><Spinner variant="danger" /> <div className="mt-2 text-muted">جاري البحث عن بدائل مطابقة...</div></div>
          ) : (
            <>
              <div className="mb-3 p-3 bg-light border rounded small">
                <strong>الحيوان المفقود:</strong> #{swapItem?.animal_code || swapItem?.animal?.code} <br/>
                <span className="text-muted">(الوزن: {swapItem?.animal_weight || swapItem?.animal?.current_weight || 'غير محدد'} كجم | السعر: {swapItem?.original_price || swapItem?.price_per_item} ج.م)</span>
              </div>

              <h6 className="fw-bold mb-3 text-primary">الترشيحات الذكية المتاحة في المخزن (نفس الفئة):</h6>

              {swapSuggestions.length === 0 ? (
                <div className="alert alert-warning">عذراً، لا يوجد حيوانات بديلة متاحة من نفس الفئة حالياً.</div>
              ) : (
                <div className="list-group shadow-sm">
                  {swapSuggestions.map(sugg => (
                    <div key={sugg.id} className="list-group-item d-flex justify-content-between align-items-center p-3">
                      <div>
                        <strong className="fs-6">#{sugg.code}</strong>
                        <div className="small text-muted mt-1">
                          الوزن: <strong>{sugg.current_weight} كجم</strong> |
                          السعر: <strong className="text-success">{sugg.price_after_discount || sugg.price_egp} ج.م</strong>
                        </div>
                        <div className="mt-1">
                          {sugg.source_farm ? <Badge bg="info">مزرعة خارجية</Badge> : <Badge bg="success">من مزارعنا</Badge>}
                        </div>
                      </div>
                      <Button variant="danger" className="fw-bold shadow-sm" onClick={() => confirmSwap(sugg.id)}>
                        اختيار كبديل
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>

      <UpdateServicesModal
        show={showUpdateServicesModal}
        handleClose={() => setShowUpdateServicesModal(false)}
        item={serviceUpdateItem}
        orderId={currentOrder.id}
        onSuccess={() => {
          fetchOrderDetails();
          handleClose(true);
        }}
      />

      <PrintModal
        show={printConfig.show}
        handleClose={() => setPrintConfig({ show: false, title: '', endpoint: '' })}
        title={printConfig.title}
        endpoint={printConfig.endpoint}
      />
    </Modal>
  );
};

const DesktopOrderTable = ({ orders, loading, onViewDetails }) => (
  <div className="table-responsive">
    <Table hover className="mb-0 align-middle">
      <thead className="table-light">
        <tr>
          <th style={{ width: '60px' }}>#</th>
          <th>نوع الطلب</th>
          <th>العميل</th>
          <th>الإجمالي</th>
          <th>المدفوع</th>
          <th>المتبقي</th>
          <th>الحالة</th>
          <th>تاريخ الطلب</th>
          <th style={{ width: '100px' }}>إجراءات</th>
        </tr>
      </thead>
      <tbody>
        {loading ? (
          <tr>
            <td colSpan="9" className="text-center py-5">
              <Spinner animation="border" variant="primary" />
              <div className="mt-2 text-muted">جاري تحميل الطلبات...</div>
            </td>
          </tr>
        ) : orders.length === 0 ? (
          <tr>
            <td colSpan="9" className="text-center py-5 text-muted">
              لا توجد طلبات للعرض
            </td>
          </tr>
        ) : (
          orders.map((order) => {
            const typeStyle = getOrderTypeBadge(order.order_type_label);
            return (
              <tr key={order.id}>
                <td className="fw-bold">{order.id}</td>
                <td>
                  <Badge
                    bg={typeStyle.bg}
                    text={typeStyle.text}
                    style={typeStyle.style}
                    className="d-flex align-items-center gap-1 w-fit"
                  >
                    <Tag size={12} />
                    {order.order_type_label}
                  </Badge>
                </td>
                <td>
                  <div className="fw-bold">{order.user.full_name}</div>
                  <small className="text-muted">{order.user.phone}</small>
                </td>
                <td className="fw-bold">{parseFloat(order.total_price).toFixed(2)}</td>
                <td className="text-success">{parseFloat(order.deposit_total).toFixed(2)}</td>
                <td>
                  {parseFloat(order.remaining_amount) > 0 ? (
                    <span className="text-danger fw-bold">{parseFloat(order.remaining_amount).toFixed(2)}</span>
                  ) : (
                    <Badge bg="success">خالص</Badge>
                  )}
                </td>
                <td>
                  <Badge
                    bg={
                      order.status === 'completed'
                        ? 'success'
                        : order.status === 'canceled'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {order.status_display}
                  </Badge>
                </td>
                <td>
                  <div className="d-flex align-items-center gap-1 text-muted small">
                    <Calendar size={12} />
                    {new Date(order.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}
                  </div>
                </td>
                <td>
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => onViewDetails(order)}
                    className="d-flex align-items-center gap-1"
                  >
                    <Eye size={14} /> عرض
                  </Button>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </Table>
  </div>
);

const MobileOrderCard = ({ order, onClick }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'confirmed':
        return 'info';
      case 'processing':
        return 'primary';
      case 'ready_for_shipment':
        return 'info';
      case 'out_for_delivery':
        return 'primary';
      case 'delivered':
        return 'success';
      case 'completed':
        return 'success';
      case 'canceled':
        return 'danger';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock size={14} />;
      case 'confirmed':
        return <CheckCircle size={14} />;
      case 'processing':
        return <Package size={14} />;
      case 'ready_for_shipment':
        return <Package size={14} />;
      case 'out_for_delivery':
        return <Truck size={14} />;
      default:
        return <CheckCircle size={14} />;
    }
  };

  const typeStyle = order?.order_type_label ? getOrderTypeBadge(order.order_type_label) : { bg: 'secondary', text: 'white' };

  return (
    <Card className="mb-2 border shadow-sm" onClick={onClick} style={{ cursor: 'pointer' }}>
      <Card.Body className="p-3">
        <div className="d-flex justify-content-between align-items-start mb-2">
          <div className="d-flex align-items-center gap-2">
            <div className="bg-primary bg-opacity-10 p-2 rounded">
              <ShoppingBag size={16} className="text-primary" />
            </div>
            <div>
              <h6 className="mb-0 fw-bold">طلب #{order.id}</h6>
              <small className="text-muted">{order.user.full_name}</small>
            </div>
          </div>
          <div className="text-end">
            <Badge bg={getStatusColor(order.status)} className="d-flex align-items-center gap-1 small">
              {getStatusIcon(order.status)}
              {order.status_display}
            </Badge>
            <div className="mt-1 small text-muted">{new Date(order.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</div>
          </div>
        </div>

        <div className="mb-2">
          <div className="d-flex align-items-center gap-1 small text-muted mb-1 flex-wrap">
            <Badge
              bg={typeStyle.bg}
              text={typeStyle.text}
              style={typeStyle.style}
              className="d-inline-flex align-items-center gap-1 me-1"
            >
              <Tag size={10} />
              {order.order_type_label || 'طلب متجر'}
            </Badge>

            <Badge bg={order.source === 'on_farm' ? 'info' : 'secondary'} className="small me-1">
              {order.source === 'on_farm' ? 'نقطة بيع' : 'المتجر'}
            </Badge>
            <span className="mx-1">•</span>
            <span>{order.delivery_type === 'pickup' ? 'استلام' : 'توصيل'}</span>
          </div>
        </div>

        <div className="border-top border-bottom py-2 mb-2">
          <div className="row text-center small">
            <div className="col-4">
              <div className="text-muted mb-1">الإجمالي</div>
              <div className="fw-bold">{order.total_price} ج</div>
            </div>
            <div className="col-4">
              <div className="text-muted mb-1">المدفوع</div>
              <div className="fw-bold text-success">{order.deposit_total} ج</div>
            </div>
            <div className="col-4">
              <div className="text-muted mb-1">المتبقي</div>
              <div className="fw-bold text-danger">{order.remaining_amount} ج</div>
            </div>
          </div>
        </div>

        <div className="d-flex justify-content-between align-items-center">
          <Button
            size="sm"
            variant="outline-primary"
            className="d-flex align-items-center gap-1"
            onClick={(e) => {
              e.stopPropagation();
              onClick();
            }}
          >
            <Eye size={12} />
            <span>عرض التفاصيل</span>
          </Button>
          <small className="text-muted">{order.items?.length || 0} منتج</small>
        </div>
      </Card.Body>
    </Card>
  );
};

const Orders = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState(false);
  const [shouldReload, setShouldReload] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

  const [typeFilter, setTypeFilter] = useState('all');
  const [deliveryDateFilter, setDeliveryDateFilter] = useState('');
  const [ordering, setOrdering] = useState('-created_at');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [smartData, setSmartData] = useState(null);
  const [loadingSmart, setLoadingSmart] = useState(false);

  const quickStatusUpdate = async (orderId, newStatus) => {
    try {
      await axios.patch(`/management/orders/${orderId}/`, { status: newStatus });
      toast.success("تم تحديث حالة الطلب بنجاح");
      setShouldReload(c => c + 1);
    } catch {
      toast.error("فشل التحديث");
    }
  };

  useEffect(() => {
    if (activeTab === 'smart_assistant') {
      setLoadingSmart(true);
      axios.get('/management/smart-action-plan/')
        .then(res => setSmartData(res.data))
        .catch(() => toast.error('فشل تحميل بيانات المساعد الذكي'))
        .finally(() => setLoadingSmart(false));
    }
  }, [activeTab, shouldReload]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 992);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (activeTab === 'smart_assistant') {
        return;
    }

    setLoading(true);
    try {
      const params = {
        page: page,
        page_size: 10,
        ordering: ordering,
      };

      if (activeTab !== 'all') {
        if (activeTab === 'preparing') {
          params.status = 'processing';
        } else if (activeTab === 'shipped') {
          params.status = 'out_for_delivery';
        } else if (activeTab === 'late_paid') {
          params.status = 'canceled';
          params.late_paid = 'true';
        } else if (activeTab === 'requires_action') {
          params.status = 'requires_action';
        } else {
          params.status = activeTab;
        }
      }

      if (typeFilter !== 'all') {
        params.order_type = typeFilter;
      }

      if (deliveryDateFilter) {
        params.delivery_date = deliveryDateFilter;
      }

      const res = await axios.get('/management/orders/', { params });

      if (res.data.results) {
        setOrders(res.data.results);
        const total = res.data.count || 0;
        setTotalPages(Math.ceil(total / 10));
      } else {
        setOrders(res.data);
        setTotalPages(1);
      }
    } catch (error) {
      console.error(error);
      toast.error('فشل تحميل الطلبات');
    } finally {
      setLoading(false);
    }
  }, [activeTab, typeFilter, page, deliveryDateFilter, ordering]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders, shouldReload]);

  useEffect(() => {
    const handleGlobalNotif = () => setShouldReload(c => c + 1);
    window.addEventListener('app-notification-received', handleGlobalNotif);
    return () => window.removeEventListener('app-notification-received', handleGlobalNotif);
  }, []);

  const handleViewDetails = (order) => {
    setSelectedOrder(order);
    setShowModal(true);
  };

  const handleCloseModal = (refresh = false) => {
    setShowModal(false);
    setSelectedOrder(null);
    if (refresh) {
      setShouldReload((prev) => prev + 1);
      setPage(1);
    }
  };

  const tabs = [
    { key: 'smart_assistant', title: 'المساعد الذكي 🤖', icon: <Bot size={14} className="text-primary animate-pulse" /> },
    { key: 'all', title: 'الكل', icon: <ShoppingBag size={14} /> },
    { key: 'requires_action', title: 'نواقص/تدخل ⚠️', icon: <AlertTriangle size={14} className="text-danger animate-pulse" /> },
    { key: 'pending', title: 'معلقة', icon: <Clock size={14} /> },
    { key: 'confirmed', title: 'مؤكدة', icon: <CheckCircle size={14} /> },
    { key: 'preparing', title: 'قيد التحضير', icon: <Package size={14} /> },
    { key: 'shipped', title: 'تم الشحن', icon: <Truck size={14} /> },
    { key: 'completed', title: 'مكتملة', icon: <CheckCircle size={14} /> },
    { key: 'canceled', title: 'ملغاة', icon: <XCircle size={14} /> },
    { key: 'late_paid', title: 'دفعات متأخرة 🚨', icon: <AlertTriangle size={14} className="text-danger" /> },
  ];

  return (
    <Container fluid className="py-4">
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 mb-4">
        <div>
          <h1 className="h3 fw-bold text-dark mb-1">
            <ShoppingBag className="me-2 text-primary" size={28} />
            سجل الطلبات الشامل
          </h1>
          <p className="text-muted mb-0">عرض وإدارة جميع الطلبات</p>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <div className="btn-group shadow-sm" role="group">
            <Button
              variant={typeFilter === 'all' ? 'primary' : 'light'}
              size="sm"
              onClick={() => {
                setTypeFilter('all');
                setPage(1);
              }}
              className="border"
            >
              الكل
            </Button>
            <Button
              variant={typeFilter === 'store' ? 'primary' : 'light'}
              size="sm"
              onClick={() => {
                setTypeFilter('store');
                setPage(1);
              }}
              className="border"
            >
              متجر
            </Button>
            <Button
              variant={typeFilter === 'adahi' ? 'primary' : 'light'}
              size="sm"
              onClick={() => {
                setTypeFilter('adahi');
                setPage(1);
              }}
              className="border"
            >
              مشاركة/أضاحي
            </Button>
            <Button
              variant={typeFilter === 'pos' ? 'primary' : 'light'}
              size="sm"
              onClick={() => {
                setTypeFilter('pos');
                setPage(1);
              }}
              className="border"
            >
              نقطة البيع
            </Button>
          </div>

          <div className="d-flex align-items-center bg-white border rounded px-2">
            <Form.Control
              type="date"
              size="sm"
              className="border-0 shadow-none"
              value={deliveryDateFilter}
              onChange={(e) => {
                setDeliveryDateFilter(e.target.value);
                setPage(1);
              }}
              title="تصفية بتاريخ التوصيل"
            />
            {deliveryDateFilter && (
                <XCircle
                    size={16}
                    className="text-danger cursor-pointer ms-1"
                    onClick={() => { setDeliveryDateFilter(''); setPage(1); }}
                />
            )}
          </div>

          <Button
            variant={ordering === 'delivery_date' ? 'success' : 'outline-secondary'}
            size="sm"
            onClick={() => {
              setOrdering(ordering === 'delivery_date' ? '-created_at' : 'delivery_date');
              setPage(1);
            }}
            className="shadow-sm fw-bold"
          >
            {ordering === 'delivery_date' ? 'مرتبة: الأقرب توصيلاً' : 'مرتبة: الأحدث إضافة'}
          </Button>

          <Button
            variant="outline-primary"
            onClick={() => {
              setShouldReload((c) => c + 1);
              setPage(1);
            }}
            size="sm"
            className="shadow-sm"
          >
            <RefreshCw size={16} />
          </Button>
        </div>
      </div>

      <Tab.Container activeKey={activeTab} onSelect={(k) => {
        setActiveTab(k);
        setPage(1);
      }}>
        <Card className="shadow-sm border-0 mb-3">
          <Card.Body className="p-1">
            <Nav variant="pills" className="flex-nowrap overflow-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {tabs.map((tab) => (
                <Nav.Item key={tab.key}>
                  <Nav.Link
                    eventKey={tab.key}
                    className="d-flex align-items-center gap-2 px-3 py-2 small fw-bold text-nowrap"
                  >
                    {tab.icon} {tab.title}
                  </Nav.Link>
                </Nav.Item>
              ))}
            </Nav>
          </Card.Body>
        </Card>
      </Tab.Container>

      <Card className="shadow-sm border-0 bg-transparent">
        <Card.Body className="p-0">
          {activeTab === 'smart_assistant' ? (
            <div className="smart-assistant-view p-3 animate-fade-in-up">
              {loadingSmart ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <div className="mt-2 text-muted fw-bold">المساعد الذكي يجهز خطة العمل...</div>
                </div>
              ) : !smartData ? (
                <div className="text-center text-muted py-5">حدث خطأ في قراءة البيانات</div>
              ) : smartData.total_active_orders === 0 ? (
                <div className="text-center py-5 bg-white rounded-4 shadow-sm border border-light">
                  <CheckCircle size={64} className="text-success mb-3" />
                  <h4 className="fw-bold">كل شيء على ما يرام!</h4>
                  <p className="text-muted">لا توجد طلبات قيد التجهيز أو التسليم حالياً، يمكنك أخذ قسط من الراحة ☕</p>
                </div>
              ) : (
                <div className="d-flex flex-column gap-4">

                  {[
                    { key: 'late', title: '🚨 متأخرات (يجب إنجازها فوراً)', color: 'danger' },
                    { key: 'today', title: '🟢 خطة عمل اليوم', color: 'success' },
                    { key: 'tomorrow', title: '🟡 خطة عمل الغد', color: 'warning' }
                  ].map((period) => {
                    const plan = smartData.plan[period.key];
                    if (!plan || (plan.suppliers.length === 0 && plan.slaughter.length === 0 && plan.live.length === 0 && plan.deliveries.length === 0 && plan.pickups.length === 0)) {
                      return null;
                    }

                    return (
                      <div key={period.key} className={`border border-${period.color} rounded-4 overflow-hidden bg-white shadow-sm`}>
                        <div className={`bg-${period.color} text-white p-3 fw-bold fs-5`}>
                          {period.title}
                        </div>
                        <div className="p-4 d-flex flex-column gap-4">

                          {plan.suppliers.length > 0 && (
                            <div>
                              <h6 className="fw-black text-dark mb-3 border-bottom pb-2 d-flex align-items-center gap-2">
                                📞 1. مكالمات الموردين (نواقص المخزن):
                              </h6>
                              <div className="row g-3">
                                {plan.suppliers.map((sup, idx) => (
                                  <div className="col-md-6" key={idx}>
                                    <div className="p-3 bg-light rounded-3 border">
                                      <strong className="text-primary d-block mb-2">مزرعة: {sup.name} <span dir="ltr" className="text-muted small ms-2">({sup.phone})</span></strong>
                                      <p className="small fw-bold text-dark mb-2">اطلب منهم تجهيز المواشي التالية:</p>
                                      <ul className="mb-0 small text-secondary">
                                        {sup.animals.map((anim, i) => (
                                          <li key={i}>
                                            {anim.category} <strong>#{anim.code}</strong> (لطلب #{anim.order_id})
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {(plan.slaughter.length > 0 || plan.live.length > 0) && (
                            <div>
                              <h6 className="fw-black text-dark mb-3 border-bottom pb-2 d-flex align-items-center gap-2">
                                🔪 2. خطة تجهيز المواشي العملية:
                              </h6>
                              <div className="row g-3">
                                {plan.slaughter.length > 0 && (
                                  <div className="col-md-6">
                                    <div className="p-3 bg-danger bg-opacity-10 border border-danger rounded-3 h-100">
                                      <strong className="text-danger d-block mb-2">للمجزر (تحتاج ذبح وتقطيع):</strong>
                                      <ul className="mb-0 small text-dark fw-medium list-unstyled">
                                        {plan.slaughter.map((anim, i) => (
                                          <li key={i} className="mb-2 pb-2 border-bottom border-danger border-opacity-25 d-flex justify-content-between align-items-center">
                                            <span>خد <strong>{anim.category} #{anim.code}</strong> للمجزر (لطلب #{anim.order_id})</span>
                                            <Button variant="danger" size="sm" onClick={() => quickStatusUpdate(anim.order_id, 'ready_for_shipment')}>
                                                تم التجهيز
                                            </Button>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                                {plan.live.length > 0 && (
                                  <div className="col-md-6">
                                    <div className="p-3 bg-success bg-opacity-10 border border-success rounded-3 h-100">
                                      <strong className="text-success d-block mb-2">تسليم صاحي (عزل وتحميل):</strong>
                                      <ul className="mb-0 small text-dark fw-medium list-unstyled">
                                        {plan.live.map((anim, i) => (
                                          <li key={i} className="mb-2 pb-2 border-bottom border-success border-opacity-25 d-flex justify-content-between align-items-center">
                                            <span>اعزل <strong>{anim.category} #{anim.code}</strong> للتحميل (طلب #{anim.order_id})</span>
                                            <Button variant="success" size="sm" onClick={() => quickStatusUpdate(anim.order_id, 'ready_for_shipment')}>
                                                جاهز للشحن
                                            </Button>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {(plan.deliveries.length > 0 || plan.pickups.length > 0) && (
                            <div>
                              <h6 className="fw-black text-dark mb-3 border-bottom pb-2 d-flex align-items-center gap-2">
                                🚚 3. خط سير التسليمات:
                              </h6>
                              <div className="row g-3">
                                {plan.deliveries.length > 0 && (
                                  <div className="col-md-6">
                                    <div className="p-3 bg-primary bg-opacity-10 border border-primary rounded-3 h-100">
                                      <strong className="text-primary d-block mb-2">السواق هيتحرك يوصل العناوين دي:</strong>
                                      <ul className="mb-0 small text-dark fw-medium list-unstyled">
                                        {plan.deliveries.map((del, i) => (
                                          <li key={i} className="mb-3 pb-2 border-bottom border-primary border-opacity-25 last:border-0">
                                            • أرسل طلب <strong>#{del.order_id}</strong> للعميل ({del.customer})
                                            <br/>
                                            <span className="text-muted ms-2 mt-1 d-block">📍 {del.address}</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                                {plan.pickups.length > 0 && (
                                  <div className="col-md-6">
                                    <div className="p-3 bg-info bg-opacity-10 border border-info rounded-3 h-100">
                                      <strong className="text-info-emphasis d-block mb-2">عملاء جايين يستلموا من المزرعة:</strong>
                                      <ul className="mb-0 small text-dark fw-medium">
                                        {plan.pickups.map((pick, i) => (
                                          <li key={i} className="mb-1">
                                            • جهز طلب <strong>#{pick.order_id}</strong> لاستلام العميل ({pick.customer})
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                        </div>
                      </div>
                    );
                  })}

                  {smartData.shared_animals_status && smartData.shared_animals_status.length > 0 && (
                      <div className="border border-info rounded-4 overflow-hidden bg-white shadow-sm mt-2">
                          <div className="bg-info bg-opacity-10 text-info-emphasis p-3 fw-bold fs-5 d-flex align-items-center gap-2 border-bottom border-info">
                              🤝 متابعة اكتمال الأسهم والمشتركين
                          </div>
                          <div className="p-4 row g-3">
                              {smartData.shared_animals_status.map((shareInfo, idx) => {
                                  const progress = (shareInfo.sold_shares / shareInfo.total_shares) * 100;
                                  return (
                                      <div className="col-md-6 col-lg-4" key={idx}>
                                          <div className="p-3 bg-light rounded-3 border h-100 d-flex flex-column">
                                              <div className="d-flex justify-content-between align-items-center mb-2">
                                                  <strong className="text-dark fs-6 d-flex align-items-center gap-1">
                                                      {shareInfo.category} <span className="text-primary">#{shareInfo.animal_code}</span>
                                                  </strong>
                                                  <Badge bg={shareInfo.is_complete ? "success" : "primary"} text="white" className="shadow-sm">
                                                      {shareInfo.section}
                                                  </Badge>
                                              </div>

                                              <div className="mb-3">
                                                  <div className="d-flex justify-content-between small fw-bold mb-1">
                                                      <span className="text-muted">مباع: {shareInfo.sold_shares}</span>
                                                      <span className={shareInfo.is_complete ? "text-success" : "text-danger"}>
                                                          متبقي: {shareInfo.available_shares} أسهم
                                                      </span>
                                                  </div>
                                                  <div className="progress" style={{ height: '8px' }}>
                                                      <div
                                                          className={`progress-bar ${shareInfo.is_complete ? 'bg-success' : 'bg-info'}`}
                                                          style={{ width: `${progress}%` }}
                                                      ></div>
                                                  </div>
                                              </div>

                                              <div className="flex-grow-1">
                                                  <h6 className="small fw-bold text-secondary border-bottom pb-2 mb-2">قائمة المشتركين:</h6>
                                                  <ul className="mb-0 small list-unstyled">
                                                      {shareInfo.participants.map((p, i) => (
                                                          <li key={i} className="mb-2 d-flex justify-content-between align-items-center bg-white p-2 rounded border border-light shadow-sm">
                                                              <span>
                                                                  <User size={12} className="me-1 text-muted"/> {p.customer_name}
                                                                  <br/>
                                                                  <small className="text-muted ms-3">طلب #{p.order_id}</small>
                                                              </span>
                                                              <Badge bg="purple" style={{backgroundColor: '#6f42c1'}}>{p.shares_bought} سهم</Badge>
                                                          </li>
                                                      ))}
                                                  </ul>
                                              </div>

                                              {shareInfo.is_complete && (
                                                  <div className="mt-3 text-center text-success small fw-bold d-flex align-items-center justify-content-center gap-1 bg-success bg-opacity-10 p-2 rounded">
                                                      <CheckCircle size={16} /> العدد اكتمل! جاهز للتنفيذ.
                                                  </div>
                                              )}
                                          </div>
                                      </div>
                                  );
                              })}
                          </div>
                      </div>
                  )}

                  <div className="d-flex flex-wrap gap-3 mt-2">
                    {smartData.plan.unscheduled_count > 0 && (
                      <div className="bg-dark text-white p-3 rounded-4 flex-fill d-flex align-items-center gap-3 shadow-sm">
                        <AlertTriangle size={24} className="text-warning" />
                        <div>
                          <strong className="d-block">انتبه: يوجد {smartData.plan.unscheduled_count} طلبات مؤكدة بدون موعد!</strong>
                          <small className="opacity-75">يرجى التواصل مع العملاء لتحديد موعد الاستلام.</small>
                        </div>
                      </div>
                    )}
                    {smartData.plan.upcoming_count > 0 && (
                      <div className="bg-light text-dark border p-3 rounded-4 flex-fill d-flex align-items-center gap-3">
                        <CalendarCheck size={24} className="text-secondary" />
                        <div>
                          <strong className="d-block">طلبات الأيام القادمة: {smartData.plan.upcoming_count} طلبات</strong>
                          <small className="text-muted">مجدولة لأيام بعد الغد، لا تحتاج إجراء اليوم.</small>
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          ) : isMobile ? (
            <div className="mobile-orders-list" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <div className="mt-2 text-muted">جاري تحميل الطلبات...</div>
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-5 text-muted">لا توجد طلبات للعرض</div>
              ) : (
                orders.map((order) => (
                  <MobileOrderCard key={order.id} order={order} onClick={() => handleViewDetails(order)} />
                ))
              )}
            </div>
          ) : (
            <DesktopOrderTable orders={orders} loading={loading} onViewDetails={handleViewDetails} />
          )}
        </Card.Body>
      </Card>

      {activeTab !== 'smart_assistant' && totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center gap-2 mt-4 no-print">
          <Button
            variant="outline-primary"
            size="sm"
            disabled={page === 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>

          <span className="text-muted small fw-bold">
            صفحة {page} من {totalPages}
          </span>

          <Button
            variant="outline-primary"
            size="sm"
            disabled={page === totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            التالي
          </Button>
        </div>
      )}

      <OrderDetailModal
        show={showModal}
        handleClose={handleCloseModal}
        order={selectedOrder}
        isMobile={isMobile}
        onOpenPayment={() => setShowRecordPaymentModal(true)}
      />

      <RecordPaymentModal
        show={showRecordPaymentModal}
        handleClose={() => setShowRecordPaymentModal(false)}
        order={selectedOrder}
        onSaved={() => {
          setShouldReload((c) => c + 1);
          setShowModal(false);
        }}
      />

      <style>{`
        .mobile-orders-list {
          touch-action: pan-y;
        }
        .mobile-orders-list::-webkit-scrollbar {
          width: 4px;
        }
        .mobile-orders-list::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .mobile-orders-list::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 2px;
        }
        .w-fit {
          width: fit-content;
        }
        @media (max-width: 992px) {
          .card-body {
            padding: 1rem !important;
          }
          .btn {
            min-height: 44px;
            padding: 0.5rem;
          }
          .form-control, .form-select {
            font-size: 0.9rem;
            padding: 0.5rem;
          }
        }
      `}</style>
    </Container>
  );
};

export default Orders;

