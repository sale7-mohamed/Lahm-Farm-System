import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Card, Table, Button, Spinner, Badge, Row, Col } from 'react-bootstrap';
import { RefreshCw, CheckCircle, Package, Scissors, Box, AlertTriangle } from 'lucide-react';

const ButcherScreen = () => {
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState({});

    const fetchTasks = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get('/management/orders/?status=processing&has_slaughter_service=true');
            const allItems = (res.data.results || []).flatMap(order =>
                order.items.map(item => ({
                    ...item,
                    orderId: order.id,
                    orderNumber: order.order_number,
                    customerName: order.customer_name || order.user?.full_name || 'غير معروف',
                    notes: order.notes,
                    itemsCount: order.items_count || order.items?.length || 0
                }))
            );
            allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            setTasks(allItems);
        } catch {
            toast.error("فشل تحميل المهام");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTasks();
        const interval = setInterval(fetchTasks, 60000);
        return () => clearInterval(interval);
    }, [fetchTasks]);

    const markAsReady = async (orderId, orderNumber) => {
        if (!window.confirm(`هل انتهيت من ذبح وتجهيز الطلب #${orderNumber} بالكامل؟`)) {
            return;
        }

        setProcessing(prev => ({ ...prev, [orderId]: true }));

        try {
            //   endpoint        
            await axios.post(`/management/orders/${orderId}/`);
            toast.success(`تم إرسال الطلب #${orderNumber} إلى الثلاجة/الشحن`);
            setTasks(prev => prev.filter(item => item.orderId !== orderId));
        } catch (error) {
            toast.error(error.response?.data?.detail || "حدث خطأ أثناء تحديث حالة الطلب");
        } finally {
            setProcessing(prev => ({ ...prev, [orderId]: false }));
        }
    };

    const groupedTasks = tasks.reduce((acc, item) => {
        if (!acc[item.orderId]) {
            acc[item.orderId] = {
                orderId: item.orderId,
                orderNumber: item.orderNumber,
                customerName: item.customerName,
                notes: item.notes,
                items: []
            };
        }
        acc[item.orderId].items.push(item);
        return acc;
    }, {});

    const groupedTasksArray = Object.values(groupedTasks);

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <h2 className="text-danger fw-bold d-flex align-items-center gap-2">
                    <Scissors /> شاشة الجزار
                </h2>
                <Button
                    variant="outline-danger"
                    onClick={fetchTasks}
                    disabled={loading}
                    className="d-flex align-items-center gap-2"
                >
                    <RefreshCw size={20} className={loading ? 'spin' : ''} /> تحديث
                </Button>
            </div>

            {loading ? (
                <div className="text-center py-5">
                    <Spinner animation="border" variant="danger" />
                    <p className="mt-2">جاري تحميل المهام...</p>
                </div>
            ) : groupedTasksArray.length === 0 ? (
                <div className="text-center py-5 bg-white rounded shadow-sm">
                    <CheckCircle size={64} className="text-success mb-3" />
                    <h4 className="text-success">لا توجد مهام حالياً</h4>
                    <p className="text-muted">جميع الطلبات تم تجهيزها</p>
                </div>
            ) : (
                <Row className="g-3">
                    {groupedTasksArray.map((orderGroup, idx) => (
                        <Col key={idx} xs={12} md={6} lg={4}>
                            <Card className="h-100 shadow-sm border-start border-danger border-4">
                                <Card.Header className="bg-danger text-white d-flex justify-content-between align-items-center py-3">
                                    <div>
                                        <Badge bg="light" text="dark" className="fs-6 me-2">
                                            #{orderGroup.orderNumber}
                                        </Badge>
                                        <Badge bg="warning" text="dark">
                                            {orderGroup.items.length} صنف
                                        </Badge>
                                    </div>
                                    <span className="small">
                                        {new Date(orderGroup.items[0]?.created_at).toLocaleTimeString('ar-EG', {
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </span>
                                </Card.Header>

                                <Card.Body>
                                    <div className="mb-3">
                                        <strong className="d-block text-muted small mb-1">العميل:</strong>
                                        <div className="fw-bold">{orderGroup.customerName}</div>
                                    </div>

                                    <div className="mb-3">
                                        <strong className="d-block text-muted small mb-2">الأصناف:</strong>
                                        <div className="table-responsive">
                                            <Table size="sm" className="mb-0">
                                                <tbody>
                                                    {orderGroup.items.map((item, itemIdx) => (
                                                        <tr key={itemIdx}>
                                                            <td className="border-0 py-2">
                                                                <Badge bg="primary" className="fs-6 me-2">
                                                                    {item.animal_code}
                                                                </Badge>
                                                                <span className="text-muted small fw-bold">
                                                                    {item.animal_category || 'غير معروف'}
                                                                    {item.share_quantity > 1 && ` (${item.share_quantity} أسهم)`}
                                                                </span>
                                                            </td>
                                                            <td className="border-0 py-2 text-end">
                                                                <div className="d-flex gap-1 justify-content-end">
                                                                    {item.selected_services?.['تقطيع'] && (
                                                                        <Badge bg="info" className="d-flex align-items-center">
                                                                            <Scissors size={12} className="me-1" />
                                                                            تقطيع
                                                                        </Badge>
                                                                    )}
                                                                    {item.selected_services?.['تعبئة'] && (
                                                                        <Badge bg="success" className="d-flex align-items-center">
                                                                            <Box size={12} className="me-1" />
                                                                            تعبئة
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </Table>
                                        </div>
                                    </div>

                                    {orderGroup.notes && (
                                        <div className="alert alert-warning p-3 small mb-3">
                                            <div className="d-flex align-items-start gap-2">
                                                <AlertTriangle size={16} className="mt-1" />
                                                <div>
                                                    <strong>ملاحظات:</strong>
                                                    <div className="mt-1">{orderGroup.notes}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    <Button
                                        variant="success"
                                        size="lg"
                                        className="w-100 fw-bold py-2"
                                        onClick={() => markAsReady(orderGroup.orderId, orderGroup.orderNumber)}
                                        disabled={processing[orderGroup.orderId]}
                                    >
                                        {processing[orderGroup.orderId] ? (
                                            <>
                                                <Spinner animation="border" size="sm" className="me-2" />
                                                جاري الإرسال...
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle size={20} className="me-2" />
                                                تم الذبح والتجهيز
                                            </>
                                        )}
                                    </Button>
                                </Card.Body>
                            </Card>
                        </Col>
                    ))}
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
                .card {
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.1) !important;
                }
                @media (max-width: 768px) {
                    .container-fluid {
                        padding-left: 10px;
                        padding-right: 10px;
                    }
                    .card {
                        margin-bottom: 15px;
                    }
                    .btn {
                        min-height: 44px;
                    }
                }
            `}</style>
        </div>
    );
};

export default ButcherScreen;
