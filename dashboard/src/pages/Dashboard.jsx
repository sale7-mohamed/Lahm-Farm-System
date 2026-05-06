import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from '../api/axiosConfig';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
    Package, AlertTriangle, DollarSign, ShoppingCart, Truck,
    CheckCircle, Activity, BarChart3, PieChart as PieChartIcon, Users, Beef
} from 'lucide-react';
import { Card, Row, Col, Badge, Table } from 'react-bootstrap';

const COLORS = {
    primary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6'
};

const StatCard = ({ title, value, icon, color, subTitle }) => (
    <Card className={`border-start border-${color} border-3 h-100 shadow-sm`}>
        <Card.Body className="p-3">
            <div className="d-flex justify-content-between align-items-start">
                <div className="flex-grow-1">
                    <h6 className="text-muted mb-1">{title}</h6>
                    <h3 className="fw-bold mb-1">{value}</h3>
                    {subTitle && <small className="text-muted">{subTitle}</small>}
                </div>
                <div className={`p-3 rounded-circle bg-light-${color}`}>
                    {icon}
                </div>
            </div>
        </Card.Body>
    </Card>
);

const QuickAction = ({ icon, title, description, onClick, color }) => (
    <Card className="h-100 shadow-sm cursor-pointer" onClick={onClick} role="button" tabIndex={0}>
        <Card.Body className="p-3 text-center">
            <div className={`mb-3 p-3 rounded-circle bg-light-${color} d-inline-flex`}>
                {icon}
            </div>
            <h6 className="mb-2">{title}</h6>
            <p className="text-muted small mb-0">{description}</p>
        </Card.Body>
    </Card>
);

function Dashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState('month');
    const navigate = useNavigate();

    const fetchDashboardData = useCallback(async () => {
        try {
            const response = await axios.get('/management/dashboard/');
            setData(response.data);
        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 60000);
        return () => clearInterval(interval);
    }, [fetchDashboardData]);

    if (loading) {
        return (
            <div className="container-fluid py-4">
                <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status" style={{ width: '3rem', height: '3rem' }}>
                        <span className="visually-hidden">جاري التحميل...</span>
                    </div>
                    <p className="mt-3">جاري تحميل بيانات لوحة التحكم...</p>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="container-fluid py-4">
                <div className="alert alert-danger">
                    فشل تحميل بيانات لوحة التحكم. يرجى المحاولة مرة أخرى.
                </div>
            </div>
        );
    }

    const chartData = data.sales_chart_data || [];
    const inventoryStatus = data.inventory_forecast || [];

    const inventoryPieData = [
        { name: 'آمن', value: inventoryStatus.filter(i => i.status === 'safe').length, color: COLORS.success },
        { name: 'منخفض', value: inventoryStatus.filter(i => i.status === 'low').length, color: COLORS.warning },
        { name: 'ناقص', value: inventoryStatus.filter(i => i.status === 'critical').length, color: COLORS.danger }
    ];

    const quickStats = {
        totalRevenue: data.orders_summary?.total_revenue || 0,
        totalOrders: data.orders_summary?.orders_today || 0,
        pendingOrders: data.orders_summary?.pending_orders || 0,
        deliveredOrders: data.orders_summary?.delivered_orders || 0
    };

    const quickActions = [
        { icon: <Package size={24} color={COLORS.primary} />, title: 'إدارة المخزون', description: 'تتبع وتحديث المخزون', color: 'primary', path: '/inventory' },
        { icon: <ShoppingCart size={24} color={COLORS.success} />, title: 'الطلبات الجديدة', description: 'عرض ومعالجة الطلبات', color: 'success', path: '/orders' },
        { icon: <Truck size={24} color={COLORS.warning} />, title: 'قائمة التوصيل', description: 'إدارة عمليات التوصيل', color: 'warning', path: '/delivery-sheet' },
        { icon: <Users size={24} color={COLORS.info} />, title: 'إدارة الموظفين', description: 'عرض وتعديل الموظفين', color: 'info', path: '/employees' }
    ];

    return (
        <div className="container-fluid py-3">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 mb-1">لوحة التحكم الرئيسية</h1>
                    <p className="text-muted mb-0">نظرة عامة على أداء النظام</p>
                </div>
                <div className="btn-group">
                    {['day', 'week', 'month'].map(range => (
                        <button
                            key={range}
                            className={`btn btn-sm ${timeRange === range ? 'btn-primary' : 'btn-outline-primary'}`}
                            onClick={() => setTimeRange(range)}
                        >
                            {range === 'day' ? 'اليوم' : range === 'week' ? 'الأسبوع' : 'الشهر'}
                        </button>
                    ))}
                </div>
            </div>

            <Row className="mb-4 g-2">
                <Col xs={6} md={3}>
                    <StatCard
                        title="إجمالي الحيوانات"
                        value={data.livestock_summary?.total_animals || 0}
                        icon={<Beef size={24} color={COLORS.primary} />}
                        color="primary"
                        subTitle={`${data.livestock_summary?.available || 0} متاحة`}
                    />
                </Col>
                <Col xs={6} md={3}>
                    <StatCard
                        title="مبيعات اليوم"
                        value={`${quickStats.totalRevenue.toLocaleString()} ج.م`}
                        icon={<DollarSign size={24} color={COLORS.success} />}
                        color="success"
                        subTitle={`${quickStats.totalOrders} طلب`}
                    />
                </Col>
                <Col xs={6} md={3}>
                    <StatCard
                        title="طلبات اليوم"
                        value={quickStats.totalOrders}
                        icon={<ShoppingCart size={24} color={COLORS.warning} />}
                        color="warning"
                        subTitle={`${quickStats.deliveredOrders} مكتملة`}
                    />
                </Col>
                <Col xs={6} md={3}>
                    <StatCard
                        title="مخزون منخفض"
                        value={inventoryStatus.length}
                        icon={<AlertTriangle size={24} color={COLORS.danger} />}
                        color="danger"
                        subTitle="يتطلب اهتمام"
                    />
                </Col>
            </Row>

            <Row className="mb-4 g-3">
                <Col xs={12} lg={8}>
                    <Card className="shadow-sm h-100">
                        <Card.Header className="bg-light">
                            <div className="d-flex justify-content-between align-items-center">
                                <h5 className="mb-0 d-flex align-items-center">
                                    <BarChart3 size={20} className="me-2 text-primary" />
                                    مبيعات آخر 4 شهور
                                </h5>
                                <Badge bg="light" text="dark">
                                    {timeRange === 'month' ? 'شهري' : timeRange === 'week' ? 'أسبوعي' : 'يومي'}
                                </Badge>
                            </div>
                        </Card.Header>
                        <Card.Body>
                            {chartData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                    <BarChart data={chartData} style={{ direction: 'ltr' }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                        <XAxis dataKey="name" tick={{ fill: '#6b7280' }} />
                                        <YAxis tick={{ fill: '#6b7280' }} tickFormatter={(v) => v.toLocaleString()} />
                                        <Tooltip formatter={(v) => `${v.toLocaleString()} جنيه`} contentStyle={{ direction: 'rtl' }} />
                                        <Legend wrapperStyle={{ direction: 'rtl' }} />
                                        <Bar dataKey="sales" name="المبيعات" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <div className="text-center py-5">
                                    <BarChart3 size={48} className="text-muted mb-3" />
                                    <p className="text-muted">لا توجد بيانات مبيعات لعرضها</p>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>

                <Col xs={12} lg={4}>
                    <Card className="shadow-sm h-100">
                        <Card.Header className="bg-light">
                            <h5 className="mb-0 d-flex align-items-center">
                                <PieChartIcon size={20} className="me-2 text-primary" />
                                حالة المخزون
                            </h5>
                        </Card.Header>
                        <Card.Body>
                            <div className="text-center">
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={inventoryPieData}
                                            cx="50%"
                                            cy="50%"
                                            labelLine={false}
                                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                            outerRadius={80}
                                            dataKey="value"
                                        >
                                            {inventoryPieData.map((entry, idx) => (
                                                <Cell key={`cell-${idx}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(v) => [v, 'عنصر']} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-3 d-flex justify-content-center gap-3">
                                    {inventoryPieData.map((item, idx) => (
                                        <div key={idx} className="d-flex align-items-center">
                                            <div className="me-2 rounded-circle" style={{ width: 12, height: 12, backgroundColor: item.color }} />
                                            <small>{item.name}</small>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row className="mb-4">
                <Col xs={12}>
                    <Card className="shadow-sm">
                        <Card.Header className="bg-light">
                            <h5 className="mb-0 d-flex align-items-center">
                                <Activity size={20} className="me-2 text-primary" />
                                إجراءات سريعة
                            </h5>
                        </Card.Header>
                        <Card.Body>
                            <Row className="g-3">
                                {quickActions.map((action, idx) => (
                                    <Col xs={6} md={3} key={idx}>
                                        <QuickAction
                                            {...action}
                                            onClick={() => navigate(action.path)}
                                        />
                                    </Col>
                                ))}
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <Row className="g-3">
                <Col xs={12}>
                    <Card className="shadow-sm h-100">
                        <Card.Header className="bg-light">
                            <h5 className="mb-0 d-flex align-items-center">
                                <CheckCircle size={20} className="me-2 text-primary" />
                                أحدث الطلبات
                            </h5>
                        </Card.Header>
                        <Card.Body className="p-0">
                            <div className="table-responsive">
                                <Table hover className="mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th>رقم الطلب</th>
                                            <th>العميل</th>
                                            <th>المبلغ</th>
                                            <th>الحالة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.recent_orders?.length > 0 ? (
                                            data.recent_orders.slice(0, 5).map(order => (
                                                <tr key={order.id}>
                                                    <td><small className="text-muted">#{order.order_number}</small></td>
                                                    <td><div className="text-truncate" style={{ maxWidth: 120 }}>{order.customer_name}</div></td>
                                                    <td className="fw-bold text-success">{order.total_amount} ج.م</td>
                                                    <td>
                                                        <Badge bg={
                                                            order.status === 'delivered' ? 'success' :
                                                            order.status === 'pending' ? 'warning' :
                                                            order.status === 'cancelled' ? 'danger' : 'info'
                                                        }>
                                                            {order.status === 'delivered' ? 'مكتمل' :
                                                             order.status === 'pending' ? 'معلق' :
                                                             order.status === 'cancelled' ? 'ملغي' : 'جاري'}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan="4" className="text-center py-4">
                                                    <p className="text-muted mb-0">لا توجد طلبات حديثة</p>
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </Table>
                            </div>
                        </Card.Body>
                        <Card.Footer className="bg-light border-top-0 text-center">
                            <a href="/orders" className="text-decoration-none" onClick={(e) => { e.preventDefault(); navigate('/orders'); }}>
                                عرض جميع الطلبات →
                            </a>
                        </Card.Footer>
                    </Card>
                </Col>
            </Row>

            <Row className="mt-4 g-2">
                <Col xs={12} md={6}>
                    <Card className="shadow-sm">
                        <Card.Body>
                            <h6 className="mb-3">نشاط النظام</h6>
                            <div className="d-flex justify-content-between mb-2">
                                <small>المستخدمين النشطين</small>
                                <strong>{data.active_users || 0}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                                <small>الطلبات النشطة</small>
                                <strong>{quickStats.pendingOrders}</strong>
                            </div>
                            <div className="d-flex justify-content-between mb-2">
                                <small>المخزون المنخفض</small>
                                <strong className="text-danger">{inventoryStatus.length}</strong>
                            </div>
                            <div className="d-flex justify-content-between">
                                <small>الحيوانات المتاحة</small>
                                <strong className="text-success">{data.livestock_summary?.available || 0}</strong>
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                <Col xs={12} md={6}>
                    <Card className="shadow-sm">
                        <Card.Body>
                            <h6 className="mb-3">إشعارات سريعة</h6>
                            <div className="alert alert-warning p-2 mb-2">
                                <small><strong>تنبيه:</strong> {inventoryStatus.length} عنصر في المخزون يحتاج لإعادة طلب</small>
                            </div>
                            {quickStats.pendingOrders > 0 && (
                                <div className="alert alert-info p-2 mb-2">
                                    <small><strong>ملاحظة:</strong> {quickStats.pendingOrders} طلب بحاجة للمعالجة</small>
                                </div>
                            )}
                            {(data.livestock_summary?.available || 0) > 0 && (
                                <div className="alert alert-success p-2">
                                    <small><strong>معلومة:</strong> {data.livestock_summary.available} حيوان متاح للبيع</small>
                                </div>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </div>
    );
}

export default Dashboard;
