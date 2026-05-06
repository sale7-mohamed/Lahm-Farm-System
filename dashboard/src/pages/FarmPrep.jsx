import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Card, Button, Spinner, Badge, Row, Col } from 'react-bootstrap';
import { RefreshCw, CheckCircle, Package, Truck } from 'lucide-react';

const FarmPrep = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState({});

    const fetchTasks = useCallback(async (showToast = false) => {
        setLoading(true);
        try {
            const res = await axios.get('/management/farm-prep/');
            setTasks(res.data || []);
            if (showToast) toast.success("تم تحديث المهام");
        } catch {
            toast.error("فشل تحميل مهام التحضير");
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
            await axios.patch(`/management/orders/${orderId}/`, { status: 'processing' });
            toast.success(`تم تحديث حالة الطلب #${orderId}`);
            fetchTasks();
        } catch {
            toast.error("فشل تحديث حالة الطلب.");
        } finally {
            setProcessing(prev => ({ ...prev, [orderId]: false }));
        }
    };

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="h4 fw-bold d-flex align-items-center gap-2">
                    <Package /> التنظيم والتحضير
                </h2>
                <Button variant="outline-primary" onClick={() => fetchTasks(true)} disabled={loading}>
                    <RefreshCw size={16} className={loading ? 'spin' : ''} /> تحديث
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-5"><Spinner animation="border" /></div>
            ) : tasks.length === 0 ? (
                <div className="text-center py-5 bg-white rounded shadow-sm">
                    <CheckCircle size={48} className="text-success mb-3" />
                    <h5 className="text-success">لا توجد مهام تحضير حالياً</h5>
                </div>
            ) : (
                <Row className="g-3">
                    {tasks.map(order => (
                        <Col key={order.id} xs={12} md={6} lg={4}>
                            <Card className="h-100 shadow-sm border-start border-primary border-4">
                                <Card.Header className="d-flex justify-content-between align-items-center">
                                    <h6 className="mb-0 fw-bold">طلب #{order.id}</h6>
                                    <Badge bg="primary">{order.status_display}</Badge>
                                </Card.Header>
                                <Card.Body>
                                    <p className="mb-2"><strong>العميل:</strong> {order.user.full_name}</p>
                                    <p className="mb-3"><strong>الوجهة:</strong> {order.has_slaughter_service ? 'المجزر الداخلي' : 'منطقة التحميل'}</p>
                                    <ul className="list-unstyled">
                                        {order.items.map(item => (
                                            <li key={item.id} className="d-flex align-items-center gap-2 mb-2 bg-light p-2 rounded">
                                                <Truck size={18} className="text-muted"/>
                                                <span>
                                                    <strong>{item.animal_code}</strong> ({item.animal_category || 'غير معروف'})
                                                    {item.share_quantity > 1 && <Badge bg="purple" className="ms-2">{item.share_quantity} أسهم</Badge>}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </Card.Body>
                                <Card.Footer className="bg-transparent border-top-0">
                                    <Button
                                        variant="success"
                                        className="w-100"
                                        onClick={() => handleTaskComplete(order.id)}
                                        disabled={processing[order.id]}
                                    >
                                        {processing[order.id] ? <Spinner size="sm" /> : 'تم استلام الماشية وتسليمها للمجزر/للعميل'}
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

export default FarmPrep;
