import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import {
  Table,
  Badge,
  Button,
  Modal,
  Form,
  Card,
  Accordion,
  ListGroup,
  Row,
  Col,
  Spinner,
  OverlayTrigger,
  Tooltip,
} from 'react-bootstrap';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  AlertCircle,
  Info,
  FileText,
  Calendar,
  RefreshCw,
  Trash2,
  Edit,
} from 'lucide-react';

function Approvals() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [currentRequest, setCurrentRequest] = useState(null);
  const [actionType, setActionType] = useState('');
  const [notes, setNotes] = useState('');
  const [filter, setFilter] = useState('all');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/management/approvals/');
      setRequests(res.data.results || []);
    } catch (error) {
      toast.error('فشل تحميل طلبات الموافقة.');
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleActionClick = (request, type) => {
    setCurrentRequest(request);
    setActionType(type);
    setNotes('');
    setShowModal(true);
  };

  const handleConfirmAction = async () => {
    if (!currentRequest) return;
    const url = `/management/approvals/${currentRequest.id}/${actionType}/`;
    try {
      await axios.post(url, { notes });
      toast.success(`تم ${actionType === 'approve' ? 'الموافقة على' : 'رفض'} الطلب بنجاح.`);
      setShowModal(false);
      setNotes('');
      fetchData();
    } catch (error) {
      toast.error('حدث خطأ أثناء معالجة الطلب.');
      console.error(error.response?.data);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <Badge bg="warning" className="d-flex align-items-center">
            <Clock size={12} className="me-1" /> معلق
          </Badge>
        );
      case 'approved':
        return (
          <Badge bg="success" className="d-flex align-items-center">
            <CheckCircle size={12} className="me-1" /> معتمد
          </Badge>
        );
      case 'rejected':
        return (
          <Badge bg="danger" className="d-flex align-items-center">
            <XCircle size={12} className="me-1" /> مرفوض
          </Badge>
        );
      default:
        return <Badge bg="secondary">{status}</Badge>;
    }
  };

  const getActionTypeIcon = (actionType) => {
    switch (actionType) {
      case 'delete_animal':
        return <AlertCircle className="text-danger" />;
      case 'update_price':
        return <Info className="text-info" />;
      case 'add_discount':
        return <FileText className="text-success" />;
      case 'update_animal':
        return <FileText className="text-primary" />;
      default:
        return <FileText className="text-primary" />;
    }
  };

  const renderRequestDetails = (request) => {
    if (request.action_type.startsWith('delete_')) {
      return (
        <div>
          <div className="fw-bold text-danger d-flex align-items-center gap-1">
            <Trash2 size={16} /> طلب حذف نهائي
          </div>
          <div className="text-muted small mt-1">
            الهدف:{' '}
            <Badge bg="dark">
              {request.details?.animal_code ||
                request.details?.employee_name ||
                request.target_object_id}
            </Badge>
          </div>
        </div>
      );
    } else if (request.action_type.startsWith('update_')) {
      const newData = request.pending_data || {};
      return (
        <div>
          <div className="fw-bold text-warning d-flex align-items-center gap-1">
            <Edit size={16} /> طلب تعديل بيانات
          </div>
          <div className="text-muted small mt-1 mb-2">
            الهدف:{' '}
            <Badge bg="dark">
              {request.details?.animal_code ||
                request.details?.employee_name ||
                request.target_object_id}
            </Badge>
          </div>
          <div
            className="bg-light p-2 rounded border"
            style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px' }}
          >
            <strong className="d-block mb-1 text-primary">البيانات الجديدة:</strong>
            <ul className="mb-0 ps-3">
              {Object.entries(newData).map(([key, value]) => (
                <li key={key}>
                  <span className="text-muted">{key}: </span>
                  <span className="fw-bold text-dark">{String(value)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }
    return <div className="fw-bold">{request.action_type}</div>;
  };

  const filteredRequests = requests.filter((req) => {
    if (filter === 'all') return true;
    return req.status === filter;
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const DesktopView = () => (
    <Card className="shadow-sm">
      <Card.Header className="bg-white border-bottom-0">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h4 className="mb-0">طلبات الموافقات</h4>
            <p className="text-muted mb-0">مراجعة واعتماد الطلبات المعلقة</p>
          </div>
          <div className="d-flex align-items-center">
            <div className="btn-group btn-group-sm me-3">
              <Button
                variant={filter === 'all' ? 'primary' : 'outline-primary'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                الكل ({requests.length})
              </Button>
              <Button
                variant={filter === 'pending' ? 'warning' : 'outline-warning'}
                size="sm"
                onClick={() => setFilter('pending')}
              >
                معلق ({pendingCount})
              </Button>
            </div>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={fetchData}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </Button>
          </div>
        </div>
      </Card.Header>
      <Card.Body className="p-0">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="mt-2">جاري تحميل طلبات الموافقة...</p>
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-5">
            <CheckCircle size={64} className="text-success mb-3" />
            <h5 className="text-success">لا توجد طلبات</h5>
            <p className="text-muted">
              لا توجد طلبات موافقات{' '}
              {filter !== 'all' ? `بالحالة "${filter}"` : ''}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="table-light">
                <tr>
                  <th width="30%">تفاصيل الطلب</th>
                  <th width="15%">الحالة</th>
                  <th width="15%">مقدم الطلب</th>
                  <th width="20%">التاريخ</th>
                  <th width="20%">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    className={req.status === 'pending' ? 'table-warning' : ''}
                  >
                    <td>
                      <div className="d-flex align-items-center">
                        <div className="me-2">{getActionTypeIcon(req.action_type)}</div>
                        <div>{renderRequestDetails(req)}</div>
                      </div>
                    </td>
                    <td>{getStatusBadge(req.status)}</td>
                    <td>
                      <div className="d-flex align-items-center">
                        <User size={14} className="me-1 text-muted" />
                        {req.requester_name}
                      </div>
                    </td>
                    <td>
                      <div className="d-flex align-items-center">
                        <Calendar size={14} className="me-1 text-muted" />
                        {new Date(req.created_at).toLocaleString('ar-EG', {
                          numberingSystem: 'latn',
                        })}
                      </div>
                    </td>
                    <td>
                      {req.status === 'pending' ? (
                        <div className="d-flex">
                          <OverlayTrigger overlay={<Tooltip>موافقة</Tooltip>}>
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="me-2"
                              onClick={() => handleActionClick(req, 'approve')}
                              style={{ minWidth: '40px' }}
                            >
                              <CheckCircle size={16} />
                            </Button>
                          </OverlayTrigger>
                          <OverlayTrigger overlay={<Tooltip>رفض</Tooltip>}>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => handleActionClick(req, 'reject')}
                              style={{ minWidth: '40px' }}
                            >
                              <XCircle size={16} />
                            </Button>
                          </OverlayTrigger>
                        </div>
                      ) : (
                        <span className="text-muted small">تمت المعالجة</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </Card.Body>
      <Card.Footer className="bg-light">
        <div className="d-flex justify-content-between align-items-center">
          <small className="text-muted">
            {filteredRequests.length} من أصل {requests.length} طلب
          </small>
          <small className="text-muted">التحديث التلقائي كل دقيقة</small>
        </div>
      </Card.Footer>
    </Card>
  );

  const MobileView = () => (
    <div>
      <Card className="shadow-sm mb-3">
        <Card.Header className="bg-white">
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h5 className="mb-0">طلبات الموافقات</h5>
              <p className="text-muted small mb-0">{pendingCount} طلب معلق</p>
            </div>
            <Button
              variant="outline-primary"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <div className="d-flex mb-3 overflow-auto pb-2">
            {['all', 'pending', 'approved', 'rejected'].map((f) => (
              <Button
                key={f}
                variant={filter === f ? 'primary' : 'outline-primary'}
                size="sm"
                className="me-2 flex-shrink-0"
                onClick={() => setFilter(f)}
                style={{ minHeight: '44px', whiteSpace: 'nowrap' }}
              >
                {f === 'all' && 'الكل'}
                {f === 'pending' && 'معلق'}
                {f === 'approved' && 'معتمد'}
                {f === 'rejected' && 'مرفوض'}
                <Badge bg="light" text="dark" className="ms-1">
                  {requests.filter((r) => (f === 'all' ? true : r.status === f)).length}
                </Badge>
              </Button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-4">
              <Spinner animation="border" variant="primary" />
              <p className="mt-2">جاري التحميل...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-5">
              <CheckCircle size={48} className="text-success mb-3" />
              <h6 className="text-success">لا توجد طلبات</h6>
              <p className="text-muted mb-0">
                لا توجد طلبات {filter !== 'all' ? `بالحالة "${filter}"` : 'للعرض'}
              </p>
            </div>
          ) : (
            <Accordion>
              {filteredRequests.map((req, index) => (
                <Accordion.Item
                  key={req.id}
                  eventKey={index.toString()}
                  className={req.status === 'pending' ? 'border-warning' : ''}
                >
                  <Accordion.Header>
                    <div className="d-flex align-items-center w-100">
                      <div className="me-2">{getActionTypeIcon(req.action_type)}</div>
                      <div className="flex-grow-1">
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <strong className="me-2">
                            {req.action_type === 'delete_animal'
                              ? 'حذف حيوان'
                              : req.action_type === 'update_price'
                              ? 'تحديث سعر'
                              : req.action_type === 'update_animal'
                              ? 'تعديل حيوان'
                              : req.action_type}
                          </strong>
                          {getStatusBadge(req.status)}
                        </div>
                        <div className="d-flex">
                          <small className="text-muted me-3">
                            <User size={12} className="me-1" />
                            {req.requester_name}
                          </small>
                          <small className="text-muted">
                            <Calendar size={12} className="me-1" />
                            {new Date(req.created_at).toLocaleDateString('ar-EG', {
                              numberingSystem: 'latn',
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </small>
                        </div>
                      </div>
                    </div>
                  </Accordion.Header>
                  <Accordion.Body>
                    <ListGroup variant="flush">
                      <ListGroup.Item className="border-0 px-0 pb-3">
                        {renderRequestDetails(req)}
                      </ListGroup.Item>
                      <ListGroup.Item className="border-0 px-0">
                        {req.status === 'pending' ? (
                          <div className="d-flex justify-content-between">
                            <Button
                              variant="success"
                              size="sm"
                              onClick={() => handleActionClick(req, 'approve')}
                              className="flex-fill me-2"
                              style={{ minHeight: '44px' }}
                            >
                              <CheckCircle size={16} className="me-1" />
                              موافقة
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleActionClick(req, 'reject')}
                              className="flex-fill"
                              style={{ minHeight: '44px' }}
                            >
                              <XCircle size={16} className="me-1" />
                              رفض
                            </Button>
                          </div>
                        ) : (
                          <div className="alert alert-light text-center">
                            <small>
                              تم{' '}
                              {req.status === 'approved' ? 'الموافقة على' : 'رفض'} هذا الطلب
                            </small>
                          </div>
                        )}
                      </ListGroup.Item>
                    </ListGroup>
                  </Accordion.Body>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </Card.Body>
      </Card>
    </div>
  );

  return (
    <div className="container-fluid py-3">
      <div className="mb-4">
        <h1 className="mb-1 text-center">طلبات الموافقات المعلقة</h1>
        <p className="text-center text-muted mb-0">
          مراجعة واتخاذ القرار بشأن الطلبات المعلقة
        </p>
      </div>

      {isMobile ? <MobileView /> : <DesktopView />}

      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="text-center w-100">
            {actionType === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="text-center mb-4">
            {actionType === 'approve' ? (
              <CheckCircle size={48} className="text-success" />
            ) : (
              <XCircle size={48} className="text-danger" />
            )}
          </div>
          <p className="text-center">
            هل أنت متأكد أنك تريد {actionType === 'approve' ? 'الموافقة على' : 'رفض'} هذا
            الطلب؟
          </p>
          {currentRequest && (
            <div className="alert alert-light mb-3">
              <small>
                <strong>نوع الطلب:</strong> {currentRequest.action_type}
                <br />
                <strong>مقدم الطلب:</strong> {currentRequest.requester_name}
              </small>
            </div>
          )}
          {actionType === 'reject' && (
            <Form.Group className="mb-3">
              <Form.Label>سبب الرفض (اختياري)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أدخل سبب الرفض..."
                style={{ fontSize: '16px' }}
              />
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <Button
            variant="outline-secondary"
            onClick={() => setShowModal(false)}
            style={{ minHeight: '44px' }}
          >
            إلغاء
          </Button>
          <Button
            variant={actionType === 'approve' ? 'success' : 'danger'}
            onClick={handleConfirmAction}
            style={{ minHeight: '44px' }}
          >
            {actionType === 'approve' ? 'تأكيد الموافقة' : 'تأكيد الرفض'}
          </Button>
        </Modal.Footer>
      </Modal>

      {!isMobile && requests.length > 0 && (
        <Row className="mt-4">
          <Col md={3}>
            <Card className="text-center border-0 shadow-sm">
              <Card.Body>
                <Badge bg="warning" className="mb-2" style={{ fontSize: '2rem' }}>
                  {requests.filter((r) => r.status === 'pending').length}
                </Badge>
                <h6 className="mb-0">معلقة</h6>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center border-0 shadow-sm">
              <Card.Body>
                <Badge bg="success" className="mb-2" style={{ fontSize: '2rem' }}>
                  {requests.filter((r) => r.status === 'approved').length}
                </Badge>
                <h6 className="mb-0">معتمدة</h6>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center border-0 shadow-sm">
              <Card.Body>
                <Badge bg="danger" className="mb-2" style={{ fontSize: '2rem' }}>
                  {requests.filter((r) => r.status === 'rejected').length}
                </Badge>
                <h6 className="mb-0">مرفوضة</h6>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3}>
            <Card className="text-center border-0 shadow-sm">
              <Card.Body>
                <Badge bg="primary" className="mb-2" style={{ fontSize: '2rem' }}>
                  {requests.length}
                </Badge>
                <h6 className="mb-0">إجمالي الطلبات</h6>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @media (max-width: 768px) {
          .container-fluid {
            padding-left: 10px;
            padding-right: 10px;
          }
          .accordion-button {
            min-height: 70px;
            padding: 12px;
          }
          .btn-group-sm > .btn {
            padding: 0.25rem 0.5rem;
            font-size: 0.875rem;
          }
        }
        button, .btn, .accordion-button {
          min-height: 44px;
        }
        .table-responsive {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        @media (min-width: 769px) {
          .card {
            transition: transform 0.2s ease;
          }
          .card:hover {
            transform: translateY(-2px);
          }
          tr:hover {
            background-color: rgba(0, 0, 0, 0.02);
          }
        }
        @media (max-width: 576px) {
          .form-control, .form-select {
            font-size: 16px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default Approvals;

