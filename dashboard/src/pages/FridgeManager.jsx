import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Card, Button, Spinner, Badge, Row, Col, Table } from 'react-bootstrap';
import { RefreshCw, CheckCircle, Package, Truck, ArrowRight } from 'lucide-react';

const FridgeManager = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState({});

    const fetchTasks = useCallback(async (showToast = false) => {
        setLoading(true);
        try {
            const res = await axios.get('/management/fridge-manager/');
            setTasks(res.data || []);
            if (showToast) toast.success("تم تحديث المهام");
        } catch  {
            toast.error("فشل تحميل مهام الثلاجة");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 60000);
        return () => clearInterval(interval);
    }, [fetchTasks]);

    const handleTaskComplete = async (orderId) => {
        setProcessing(prev => ({ ...prev, [orderId]: true }));
        try {

            await axios.patch(`/management/orders/${orderId}/`, { status: 'ready_for_shipment' });
            toast.success(`تم تجهيز الطلب #${orderId} للشحن`);
            fetchTasks();
        } catch  {
            toast.error("فشل تحديث حالة الطلب.");
        } finally {
            setProcessing(prev => ({ ...prev, [orderId]: false }));
        }
    };

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="h4 fw-bold d-flex align-items-center gap-2 text-info">
                    <Package /> إدارة الثلاجة والتغليف
                </h2>
                <Button variant="outline-info" onClick={() => fetchTasks(true)} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> تحديث
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-5"><Spinner animation="border" variant="info"/></div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-5 bg-white rounded shadow-sm">
                    <CheckCircle size={48} className="text-success mb-3" />
                    <h5 className="text-success">لا توجد مهام حالياً</h5>
                    <p className="text-muted">في انتظار استلام طلبات من الجزار</p>
                </div>
            ) : (
                <Row className="g-3">
                    {tasks.map(order => (
                        <Col key={order.id} xs={12} md={6} lg={4}>
                            <Card className="h-100 shadow-sm border-start border-info border-4">
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <h6 className="mb-0 fw-bold">طلب #{order.id}</h6>
                                    <Badge bg="info">{order.status_display}</Badge>
                                </Card.Header>
                                <Card.Body>
                                    <p className="mb-2"><strong>العميل:</strong> {order.user.full_name}</p>
                                    <Table striped bordered size="sm">
                                        <thead><tr><th>الحيوان</th><th>الخدمات</th></tr></thead>
                                        <tbody>
                                            {order.items.map(item => (
                                                <tr key={item.id}>
                                                    <td>{item.animal_code}</td>
                                                    <td>
                                                        {item.selected_services?.cutting && <Badge bg="secondary" className="me-1">تقطيع</Badge>}
                                                        {item.selected_services?.packaging && <Badge bg="secondary">تغليف</Badge>}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </Table>
                                    {order.notes && (
                                        <div className="alert alert-light p-2 small mt-2">
                                            <strong>ملاحظات:</strong> {order.notes}
                                        </div>
                                    )}
                                </Card.Body>
                                <Card.Footer className="bg-transparent border-top-0">
                                    <Button
                                        variant="info"
                                        className="w-100 text-white"
                                        onClick={() => handleTaskComplete(order.id)}
                                        disabled={processing[order.id]}
                                    >
                                        {processing[order.id] ? <Spinner size="sm" /> :
                                            <><ArrowRight size={16} className="me-1"/> إرسال للشحن</>
                                        }
                                    </Button>
                                </Card.Footer>
                            </Card>
                        </Col>
                    ))}
                </Row>
            )}
        </div>
    );
};

export default FridgeManager;
