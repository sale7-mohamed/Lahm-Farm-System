import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import {
    Form, Button, Card, Row, Col, Table, Tab, Nav, Spinner, Modal, Badge
} from 'react-bootstrap';
import {
    Truck, DollarSign, Folder, Building, UserCheck, Percent,
    Activity, PlusCircle, Edit, Trash2, Info, X, Users, Briefcase, Moon, Sun, CheckCircle, AlertTriangle
} from 'lucide-react';

const MobileResponsiveNav = ({ children, variant = 'pills', className = '', ...props }) => {
    return (
        <Nav
            variant={variant}
            className={`flex-nowrap flex-md-wrap overflow-auto ${className}`}
            style={{
                msOverflowStyle: 'none',
                scrollbarWidth: 'none',
                WebkitOverflowScrolling: 'touch'
            }}
            {...props}
        >
            {children}
        </Nav>
    );
};

const LiveProviderStatus = ({ providerName }) => {
    const [info, setInfo] = useState(null);
    const [operators, setOperators] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingOps, setLoadingOps] = useState(false);

    useEffect(() => {
        if (!providerName) return;
        setLoading(true);
        axios.get(`/messaging/provider-info/?provider=${providerName}`)
            .then(res => setInfo(res.data))
            .catch(() => setInfo({ type: 'error', message: 'فشل الاتصال بالمزود' }))
            .finally(() => setLoading(false));
    }, [providerName]);

    const fetchOperators = async () => {
        setLoadingOps(true);
        try {
            const res = await axios.get(`/messaging/provider-operators/?provider=${providerName}`);
            setOperators(res.data);
        } catch  {
            toast.error("فشل جلب شبكات التشغيل أو المزود لا يدعمها");
        } finally {
            setLoadingOps(false);
        }
    };

    if (loading) return <div className="text-center p-2"><Spinner size="sm" variant="primary" /> <span className="small text-muted">جاري فحص السيرفر...</span></div>;
    if (!info) return null;

    if (info.type === 'error') {
        return (
            <div className="bg-danger bg-opacity-10 p-3 mt-2 rounded border border-danger d-flex align-items-center gap-2">
                <AlertTriangle size={20} className="text-danger" />
                <span className="text-danger fw-bold">{info.message}</span>
            </div>
        );
    }

    if (info.type?.includes('Arpu') || info.type?.includes('WE')) {
        return (
            <div className="bg-white p-3 mt-2 rounded border border-success shadow-sm">
                <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-success fw-bold d-flex align-items-center gap-1"><CheckCircle size={16}/> متصل بـ {info.type}</span>
                    {info.account_type && <Badge bg={info.account_type === 'Prepaid' ? 'primary' : 'warning'}>{info.account_type}</Badge>}
                </div>
                <div className="bg-light p-2 rounded text-center mb-2">
                    <small className="text-muted d-block">الرصيد المتاح حالياً</small>
                    <h4 className="text-dark mb-0 fw-black" dir="ltr">{info.credit || 0} <span className="fs-6 text-muted">{info.currency || 'رسالة'}</span></h4>
                </div>
                <Button variant="outline-success" size="sm" className="w-100 mt-2 fw-bold" onClick={fetchOperators} disabled={loadingOps}>
                    {loadingOps ? <Spinner size="sm" /> : "عرض قائمة مشغلي الشبكات المدعومة"}
                </Button>
                {operators && Array.isArray(operators) && (
                    <div className="mt-3 bg-white border rounded shadow-sm overflow-hidden">
                        <div className="bg-light p-2 border-bottom fw-bold text-center text-muted small">
                            الشبكات المدعومة من قبل المزود
                        </div>
                        <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            <Table hover size="sm" className="mb-0 text-center align-middle" style={{ fontSize: '11px' }}>
                                <thead className="table-light sticky-top">
                                    <tr>
                                        <th>الشبكة (Operator)</th>
                                        <th>الدولة</th>
                                        <th>كود الشبكة (MNC)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {operators.map((op, idx) => {
                                        const isEgypt = op.country_name === 'Egypt' || op.country_name === 'مصر';
                                        return (
                                            <tr key={idx} className={isEgypt ? 'table-success fw-bold' : ''}>
                                                <td>{op.operator_name}</td>
                                                <td>{op.country_name} {isEgypt && '🇪🇬'}</td>
                                                <td><Badge bg={isEgypt ? "success" : "secondary"}>{op.mnc}</Badge></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (info.type?.includes('WhySMS')) {
        return (
            <div className="bg-white p-3 mt-2 rounded border border-info shadow-sm">
                <span className="text-info fw-bold d-flex align-items-center gap-1"><CheckCircle size={16}/> متصل بـ {info.type}</span>
                <p className="small text-muted mt-2 mb-0 bg-light p-2 rounded">
                    لا يدعم الاستعلام عن الرصيد، ولكن تم جلب <strong>{info.logs?.length || 0}</strong> سجل رسالة بنجاح. يمكن متابعة سجلاته من شاشة "مدير الـ SMS".
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white p-3 mt-2 rounded border border-secondary shadow-sm">
            <span className="text-secondary fw-bold d-flex align-items-center gap-1"><CheckCircle size={16}/> {info.type}</span>
            <p className="small text-muted mt-2 mb-0 bg-light p-2 rounded">{info.message}</p>
        </div>
    );
};

const ServicesControl = ({ settings, handleChange, loading, handleSubmit, deliveryAreas, governorates, refreshAreas }) => {
    const [newGov, setNewGov] = useState('');
    const [newPrice, setNewPrice] = useState('');
    const [actionLoading, setActionLoading] = useState(false);

    const handleAddArea = async () => {
        if (!newGov || !newPrice) { toast.warn("اختر المحافظة وحدد سعر التوصيل"); return; }
        setActionLoading(true);
        try {
            await axios.post('/management/delivery-areas/', { governorate: newGov, delivery_price: newPrice, is_active: true });
            toast.success("تم إضافة المحافظة بنجاح");
            setNewGov(''); setNewPrice('');
            refreshAreas();
        } catch { toast.error("فشل إضافة المحافظة، قد تكون مضافة مسبقاً"); }
        finally { setActionLoading(false); }
    };

    const toggleArea = async (id, status) => {
        try {
            await axios.patch(`/management/delivery-areas/${id}/`, { is_active: !status });
            refreshAreas();
        } catch { toast.error("فشل تحديث الحالة"); }
    };

    const updatePrice = async (id, price) => {
        if (!price || price < 0) return;
        try {
            await axios.patch(`/management/delivery-areas/${id}/`, { delivery_price: price });
            toast.success("تم تحديث السعر");
        } catch { toast.error("فشل تحديث السعر"); }
    };

    const deleteArea = async (id) => {
        if (!window.confirm("هل أنت متأكد من حذف هذه المحافظة من قائمة التوصيل؟")) return;
        try {
            await axios.delete(`/management/delivery-areas/${id}/`);
            refreshAreas();
        } catch { toast.error("فشل الحذف"); }
    };

    return (
        <Card className="border-0 shadow-sm h-100">
            <Card.Body>
                <h6 className="mb-3 text-primary fw-bold">التحكم في الخدمات</h6>
                <Form onSubmit={handleSubmit} className="mb-4">

                    <div className="bg-primary bg-opacity-10 p-3 rounded mb-3 border border-primary">
                        <h6 className="small fw-bold text-primary mb-3">مزودي خدمة الرسائل (SMS)</h6>
                        <Row className="g-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="small fw-bold text-dark">رسائل التوثيق (OTP)</Form.Label>
                                    <Form.Select
                                        name="otp_provider"
                                        value={settings.otp_provider || 'whysms'}
                                        onChange={handleChange}
                                        className="fw-bold"
                                    >
                                        <option value="arpuplus">ArpuPlus (الرصيد الحي)</option>
                                        <option value="whysms">WhySMS</option>
                                        <option value="wesms">WE Business</option>
                                        <option value="mock">وهمي (بدون رصيد)</option>
                                    </Form.Select>
                                </Form.Group>
                                <LiveProviderStatus providerName={settings.otp_provider} />
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="small fw-bold text-dark">تحديثات الطلبات والإعلانات</Form.Label>
                                    <Form.Select
                                        name="general_sms_provider"
                                        value={settings.general_sms_provider || 'whysms'}
                                        onChange={handleChange}
                                        className="fw-bold"
                                    >
                                        <option value="arpuplus">ArpuPlus (الرصيد الحي)</option>
                                        <option value="whysms">WhySMS</option>
                                        <option value="wesms">WE Business</option>
                                        <option value="mock">وهمي (بدون رصيد)</option>
                                    </Form.Select>
                                </Form.Group>
                                <LiveProviderStatus providerName={settings.general_sms_provider} />
                            </Col>
                        </Row>
                    </div>

                    <div className="bg-light p-3 rounded mb-3 border">
                        <h6 className="small fw-bold text-muted mb-3">طرق الاستلام</h6>
                        <Form.Check type="switch" id="delivery-service" label="تفعيل خدمة التوصيل للمنزل" name="enable_delivery_service" checked={settings.enable_delivery_service ?? true} onChange={handleChange} className="mb-2 fw-bold" />
                        <Form.Check type="switch" id="pickup-service" label="تفعيل الاستلام من المزرعة" name="enable_farm_pickup" checked={settings.enable_farm_pickup ?? true} onChange={handleChange} className="fw-bold" />
                    </div>

                    <div className="bg-light p-3 rounded mb-3 border">
                        <h6 className="small fw-bold text-muted mb-3">المرافق التشغيلية</h6>
                        <Form.Check
                            type="switch"
                            id="internal-slaughter"
                            label={settings.enable_internal_slaughter ? "لدينا مجزر داخلي (سيظهر كـ شاشة الجزار)" : "نعتمد على مجزر آلي/خارجي (سيظهر كـ متابعة المجزر)"}
                            name="enable_internal_slaughter"
                            checked={settings.enable_internal_slaughter ?? true}
                            onChange={handleChange}
                            className="mb-2"
                        />
                        <Form.Check
                            type="switch"
                            id="fridge-manager"
                            label="تفعيل مرحلة الثلاجة والتغليف بعد الذبح"
                            name="enable_fridge_manager"
                            checked={settings.enable_fridge_manager ?? true}
                            onChange={handleChange}
                            className="mb-2 text-info fw-bold"
                        />
                        <Form.Check type="switch" id="vid-req" label="تفعيل طلب فيديو الذبح للعملاء" name="enable_slaughter_video_request" checked={settings.enable_slaughter_video_request ?? true} onChange={handleChange} className="mb-2 fw-bold text-danger" />
                    </div>
                    <div className="bg-primary bg-opacity-10 p-3 rounded mb-3 border border-primary">
                        <h6 className="small fw-bold text-primary mb-3">سياسة تسعير المزرعة الحالية</h6>
                        <Form.Select
                            name="pricing_model"
                            value={settings.pricing_model || 'care_fee'}
                            onChange={handleChange}
                            className="fw-bold"
                        >
                            <option value="care_fee">نظام الرعاية (سعر ثابت + رسوم أرضية للعميل المتأخر)</option>
                            <option value="live_weight">نظام الميزان الفعلي (السعر يتغير حسب ميزان يوم التسليم)</option>
                        </Form.Select>
                        <Form.Text className="text-muted small mt-2 d-block">
                            * نظام الميزان سيظهر تحذيراً للعميل في المتجر بأن السعر تقديري.
                        </Form.Text>
                    </div>
                    <div className="bg-warning bg-opacity-10 p-3 rounded mb-3 border border-warning">
                        <h6 className="small fw-bold text-warning-emphasis mb-3">حدود وسعة التوصيل</h6>
                        <Form.Group>
                            <Form.Label className="fw-bold">سماحية تجاوز الحد اليومي (رؤوس)</Form.Label>
                            <Form.Control type="number" name="delivery_limit_tolerance" value={settings.delivery_limit_tolerance || 2} onChange={handleChange} />
                            <Form.Text className="text-muted small">
                                إذا كان المتبقي في اليوم 3 خراف، والعميل طلب 5 (في طلب واحد)، سيتم السماح بالطلب لعدم تجزئته بناءً على هذه السماحية.
                            </Form.Text>
                        </Form.Group>
                    </div>
                    <Button type="submit" disabled={loading} variant="primary" size="sm">حفظ إعدادات الخدمات</Button>
                </Form>

                <hr className="my-4"/>

                <h6 className="mb-3 text-primary fw-bold d-flex align-items-center gap-2">
                    <Truck size={18}/> المحافظات المدعومة للتوصيل
                </h6>
                <div className="d-flex gap-2 mb-3">
                    <Form.Select value={newGov} onChange={e=>setNewGov(e.target.value)} size="sm">
                        <option value="">اختر محافظة...</option>
                        {governorates.map(g => (
                            <option key={g.id} value={g.id} disabled={deliveryAreas.some(d => d.governorate === g.id)}>
                                {g.name_ar}
                            </option>
                        ))}
                    </Form.Select>
                    <Form.Control type="number" placeholder="سعر التوصيل" value={newPrice} onChange={e=>setNewPrice(e.target.value)} size="sm" />
                    <Button variant="success" size="sm" onClick={handleAddArea} disabled={actionLoading}>إضافة</Button>
                </div>

                <div className="table-responsive" style={{ maxHeight: '250px' }}>
                    <Table size="sm" hover className="mb-0 border">
                        <thead className="table-light sticky-top">
                            <tr>
                                <th>المحافظة (تفعيل/إيقاف)</th>
                                <th>تكلفة التوصيل</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {deliveryAreas.map(area => (
                                <tr key={area.id}>
                                    <td className="align-middle">
                                        <Form.Check type="switch" id={`area-${area.id}`} checked={area.is_active} onChange={() => toggleArea(area.id, area.is_active)} label={area.governorate_name} className="fw-bold" />
                                    </td>
                                    <td className="align-middle">
                                        <div className="d-flex align-items-center gap-1">
                                            <Form.Control type="number" size="sm" defaultValue={area.delivery_price} onBlur={(e) => {if(e.target.value != area.delivery_price) updatePrice(area.id, e.target.value)}} style={{width: '80px'}} />
                                            <small className="text-muted">ج</small>
                                        </div>
                                    </td>
                                    <td className="align-middle text-end">
                                        <Button variant="link" className="text-danger p-0" onClick={() => deleteArea(area.id)}>
                                            <Trash2 size={16}/>
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {deliveryAreas.length === 0 && (
                                <tr>
                                    <td colSpan="3" className="text-center text-muted small py-3">لم يتم تحديد أي محافظات للتوصيل بعد</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
};

const SacrificeSettings = ({ settings, handleChange, loading, handleSubmit }) => (
    <Card className="border-0 shadow-sm h-100">
        <Card.Body>
            <h6 className="mb-3 text-primary fw-bold">إدارة المواسم والتشارك</h6>
            <Form onSubmit={handleSubmit}>
                <div className="bg-info bg-opacity-10 p-3 rounded mb-3 border border-info">
                    <h6 className="fw-bold text-info mb-3 d-flex align-items-center gap-2">
                        <Users size={18} /> التشارك العام
                    </h6>
                    <Form.Check
                        type="switch"
                        id="general-shares-switch"
                        name="enable_general_shares"
                        label={settings.enable_general_shares !== false ? "مفتوح ومتاح للعملاء" : "مغلق"}
                        checked={settings.enable_general_shares !== false}
                        onChange={handleChange}
                        className="mb-2 fw-bold"
                    />
                </div>

                <div className="bg-success bg-opacity-10 p-3 rounded mb-3 border border-success">
                    <h6 className="fw-bold text-success mb-3 d-flex align-items-center gap-2">
                        <Activity size={18} /> موسم الأضاحي
                    </h6>
                    <Form.Check
                        type="switch"
                        id="adahi-season-switch"
                        name="is_adahi_season_active"
                        label={settings.is_adahi_season_active ? "الموسم مفتوح (يظهر في الموقع)" : "الموسم مغلق تماماً"}
                        checked={settings.is_adahi_season_active || false}
                        onChange={handleChange}
                        className="mb-3 fw-bold text-success"
                    />

                    {settings.is_adahi_season_active && (
                        <div className="ps-3 border-start border-2 border-success">
                            <Form.Check
                                type="switch"
                                id="adahi-full-switch"
                                name="enable_adahi_full"
                                label="تبويب: أضحية كاملة"
                                checked={settings.enable_adahi_full !== false}
                                onChange={handleChange}
                                className="mb-2"
                            />
                            <Form.Check
                                type="switch"
                                id="adahi-pool-switch"
                                name="enable_adahi_pool"
                                label="تبويب: مسبح الأضاحي (مشاركة)"
                                checked={settings.enable_adahi_pool !== false}
                                onChange={handleChange}
                                className="mb-2"
                            />
                            <Form.Check
                                type="switch"
                                id="adahi-group-switch"
                                name="enable_adahi_group"
                                label="تبويب: المجموعات الخاصة"
                                checked={settings.enable_adahi_group !== false}
                                onChange={handleChange}
                                className="mb-2"
                            />
                        </div>
                    )}
                </div>

                <div className="bg-primary bg-opacity-10 p-3 rounded mb-3 border border-primary">
                    <h6 className="fw-bold text-primary mb-3 d-flex align-items-center gap-2">
                        <Moon size={18} /> رمضان
                    </h6>
                    <Form.Check
                        type="switch"
                        id="ramadan-switch"
                        name="enable_ramadan_celebration"
                        label="تفعيل زينة رمضان"
                        checked={settings.enable_ramadan_celebration || false}
                        onChange={handleChange}
                        className="mb-2 fw-bold"
                    />
                    <Form.Group className="mb-2">
                        <Form.Label className="small">بداية رمضان</Form.Label>
                        <Form.Control
                            type="datetime-local"
                            value={settings.ramadan_start_date ? settings.ramadan_start_date.slice(0, 16) : ''}
                            onChange={(e) => handleChange({ target: { name: 'ramadan_start_date', value: e.target.value } })}
                            size="sm"
                        />
                    </Form.Group>
                </div>
                <div className="bg-warning bg-opacity-10 p-3 rounded mb-3 border border-warning">
                    <h6 className="fw-bold text-warning-dark mb-3 d-flex align-items-center gap-2">
                        <Sun size={18} /> عيد الفطر
                    </h6>
                    <Form.Check
                        type="switch"
                        id="fitr-switch"
                        name="enable_eid_fitr_celebration"
                        label="تفعيل احتفال عيد الفطر"
                        checked={settings.enable_eid_fitr_celebration || false}
                        onChange={handleChange}
                        className="mb-2 fw-bold"
                    />
                    <Form.Group className="mb-2">
                        <Form.Label className="small">تاريخ العيد</Form.Label>
                        <Form.Control
                            type="datetime-local"
                            value={settings.eid_fitr_start_date ? settings.eid_fitr_start_date.slice(0, 16) : ''}
                            onChange={(e) => handleChange({ target: { name: 'eid_fitr_start_date', value: e.target.value } })}
                            size="sm"
                        />
                    </Form.Group>
                </div>
                <div className="bg-light p-3 rounded mb-3 border">
                    <h6 className="fw-bold text-dark mb-3">عيد الأضحى</h6>
                    <Form.Group className="mb-3">
                        <Form.Label className="small">تاريخ عيد الأضحى</Form.Label>
                        <Form.Control
                            type="datetime-local"
                            value={settings.eid_adha_date ? settings.eid_adha_date.slice(0, 16) : ''}
                            onChange={(e) => handleChange({ target: { name: 'eid_adha_date', value: e.target.value } })}
                            size="sm"
                        />
                    </Form.Group>
                    <Form.Check
                        type="switch"
                        id="celebration-switch"
                        name="enable_eid_celebration"
                        label="تفعيل احتفال الأضحى"
                        checked={settings.enable_eid_celebration || false}
                        onChange={handleChange}
                        className="mb-2"
                    />
                    <Form.Check
                        type="switch"
                        id="timer-switch"
                        name="show_eid_timer"
                        label="إظهار عداد تنازلي"
                        checked={settings.show_eid_timer || false}
                        onChange={handleChange}
                        className="mb-2"
                    />
                    <Form.Check
                        type="switch"
                        id="eid-receive-btn"
                        name="enable_eid_receive_button"
                        label="إظهار زر 'استلام أيام العيد' في الطلبات"
                        checked={settings.enable_eid_receive_button || false}
                        onChange={handleChange}
                        className="mb-2 fw-bold text-primary"
                    />
                    <Form.Text className="text-muted small d-block mb-3">يجب تحديد تاريخ العيد أولاً ليتمكن النظام من جلب التاريخ تلقائياً.</Form.Text>
                </div>
                <Button type="submit" disabled={loading} variant="primary" size="sm">حفظ إعدادات المواسم</Button>
            </Form>
        </Card.Body>
    </Card>
);

const BusinessSettingsControl = ({ settings, handleChange, loading, handleSubmit }) => (
    <Card className="border-0 shadow-sm h-100">
        <Card.Body>
            <h6 className="mb-3 text-primary fw-bold">إعدادات قطاع الأعمال (B2B)</h6>
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">الحد الأدنى لعدد الرؤوس</Form.Label>
                    <Form.Control
                        type="number"
                        min="1"
                        name="min_business_order_quantity"
                        value={settings.min_business_order_quantity || 5}
                        onChange={handleChange}
                    />
                    <Form.Text className="text-muted">لن يتمكن عميل الشركة من طلب أقل من هذا العدد.</Form.Text>
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label className="fw-bold">هامش تفاوت الوزن (كجم)</Form.Label>
                    <Form.Control
                        type="number"
                        step="0.1"
                        name="business_weight_margin"
                        value={settings.business_weight_margin || 5.0}
                        onChange={handleChange}
                    />
                </Form.Group>
                <Button type="submit" disabled={loading} variant="primary" size="sm">حفظ إعدادات B2B</Button>
            </Form>
        </Card.Body>
    </Card>
);

const CategoryForm = ({ show, handleClose, onSave, itemToEdit }) => {
    const [formData, setFormData] = useState({});
    const [growthRates, setGrowthRates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    useEffect(() => {
        if (show) {
            setFormData(itemToEdit || {
                name_ar: '',
                name_en: '',
                standard_birth_cost: '0.00',
                default_max_shares: 1,
                weight_variance_limit: 0,
                daily_care_fee: '50.00',
                logic_type: 'other',
                extra_delivery_fee: '0.00',
                daily_delivery_limit: 0,
                allow_deposit: true,
                min_deposit_percentage: 0.20,
                service_deposit_percentage: 0.50,
                enable_slaughter: true,
                slaughter_price: '0.00',
                enable_cutting: true,
                cutting_price: '0.00',
                enable_packaging: true,
                packaging_price: '0.00',
                free_care_days: 4
            });
            setGrowthRates(itemToEdit?.growth_rates || []);
            setImagePreview(itemToEdit?.image || null);
            setImageFile(null);
        }
    }, [show, itemToEdit]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const addRateRow = () => {
        setGrowthRates([...growthRates, { min_weight: 0, max_weight: 0, daily_increase: 0 }]);
    };

    const removeRateRow = (index) => {
        setGrowthRates(growthRates.filter((_, i) => i !== index));
    };

    const handleRateChange = (index, field, value) => {
        const updated = [...growthRates];
        updated[index][field] = parseFloat(value) || 0;
        setGrowthRates(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const method = itemToEdit ? 'patch' : 'post';
        const url = itemToEdit ? `/livestock/categories/${itemToEdit.id}/` : '/livestock/categories/';

        try {
            const submissionData = new FormData();
            Object.keys(formData).forEach(key => {
                if (key !== 'image' && key !== 'growth_rates' && formData[key] !== null && formData[key] !== undefined) {
                    submissionData.append(key, formData[key]);
                }
            });
            if (imageFile) submissionData.append('image', imageFile);
            const res = await axios({ method, url, data: submissionData, headers: { 'Content-Type': 'multipart/form-data' } });
            const categoryId = res.data.id;
            if (categoryId) await axios.post(`/livestock/categories/${categoryId}/update-rates/`, { rates: growthRates });
            toast.success(itemToEdit ? "تم تحديث الفئة" : "تم إنشاء الفئة");
            onSave();
            handleClose();
        } catch (error) {
            const errorMsg = error.response?.data?.image ? "خطأ في الصورة" : "فشل حفظ الفئة";
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton className="border-bottom-0 pb-0">
                <Modal.Title className="fs-5">{itemToEdit ? 'تعديل فئة' : 'إضافة فئة جديدة'}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                <Form onSubmit={handleSubmit}>
                    <Row className="g-3">
                        <Col xs={12}>
                            <div className="p-3 border rounded bg-light text-center">
                                {imagePreview ? (
                                    <div className="mb-3">
                                        <img src={imagePreview} alt="Preview" style={{ maxHeight: '150px', borderRadius: '10px', objectFit: 'cover' }} />
                                    </div>
                                ) : <div className="mb-3 text-muted">لا توجد صورة</div>}
                                <Form.Group>
                                    <Form.Label className="btn btn-outline-primary btn-sm mb-0">
                                        {itemToEdit ? 'تغيير الصورة' : 'رفع صورة'}
                                        <Form.Control type="file" onChange={handleImageChange} accept="image/*" style={{ display: 'none' }} />
                                    </Form.Label>
                                </Form.Group>
                            </div>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>الاسم (عربي)</Form.Label>
                                <Form.Control name="name_ar" value={formData.name_ar || ''} onChange={handleChange} required />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>الاسم (إنجليزي)</Form.Label>
                                <Form.Control name="name_en" value={formData.name_en || ''} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>نوع المنطق الشرعي</Form.Label>
                                <Form.Select name="logic_type" value={formData.logic_type || 'other'} onChange={handleChange}>
                                    <option value="other">أخرى</option>
                                    <option value="sheep">ضأن</option>
                                    <option value="goat">ماعز</option>
                                    <option value="cow">بقر/جاموس</option>
                                    <option value="camel">إبل</option>
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>عدد الأسهم الافتراضي</Form.Label>
                                <Form.Control type="number" name="default_max_shares" value={formData.default_max_shares || 1} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>تكلفة الرعاية اليومية</Form.Label>
                                <Form.Control type="number" step="0.01" name="daily_care_fee" value={formData.daily_care_fee || 0} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>أيام الرعاية المجانية</Form.Label>
                                <Form.Control type="number" name="free_care_days" value={formData.free_care_days || 4} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>تكلفة الولادة القياسية</Form.Label>
                                <Form.Control type="number" step="0.01" name="standard_birth_cost" value={formData.standard_birth_cost || '0.00'} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label>تفاوت الوزن (كجم)</Form.Label>
                                <Form.Control type="number" step="0.1" name="weight_variance_limit" value={formData.weight_variance_limit || 0} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label className="text-primary fw-bold">توصيل إضافية للرأس</Form.Label>
                                <Form.Control type="number" step="0.01" name="extra_delivery_fee" value={formData.extra_delivery_fee || '0.00'} onChange={handleChange} />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group>
                                <Form.Label className="text-primary fw-bold">الحد اليومي للتوصيل</Form.Label>
                                <Form.Control type="number" name="daily_delivery_limit" value={formData.daily_delivery_limit || 0} onChange={handleChange} />
                            </Form.Group>
                        </Col>

                        <Col xs={12}>
                            <hr className="my-2" />
                            <h6 className="fw-bold text-primary">إعدادات العربون والخدمات (مخصصة لهذه الفئة)</h6>
                        </Col>

                        <Col md={12}>
                            <Form.Check type="switch" name="allow_deposit" label="السماح بدفع العربون (بدلاً من الدفع الكامل)" checked={formData.allow_deposit ?? true} onChange={handleChange} className="fw-bold text-success mb-2" />
                        </Col>

                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>نسبة العربون (حي) %</Form.Label>
                                <Form.Control type="number" step="1" min="0" max="100" name="min_deposit_percentage" value={Math.round((formData.min_deposit_percentage || 0.20) * 100)} onChange={(e) => handleChange({target: {name: 'min_deposit_percentage', value: e.target.value / 100}})} />
                            </Form.Group>
                        </Col>
                        <Col md={6}>
                            <Form.Group>
                                <Form.Label>نسبة العربون (مذبوح) %</Form.Label>
                                <Form.Control type="number" step="1" min="0" max="100" name="service_deposit_percentage" value={Math.round((formData.service_deposit_percentage || 0.50) * 100)} onChange={(e) => handleChange({target: {name: 'service_deposit_percentage', value: e.target.value / 100}})} />
                            </Form.Group>
                        </Col>

                        <Col md={4} className="mt-3">
                            <div className="bg-light p-2 rounded border h-100">
                                <Form.Check type="switch" name="enable_slaughter" label="تفعيل الذبح" checked={formData.enable_slaughter ?? true} onChange={handleChange} className="fw-bold mb-2" />
                                <Form.Control type="number" placeholder="سعر الذبح" name="slaughter_price" value={formData.slaughter_price || 0} onChange={handleChange} size="sm" disabled={!formData.enable_slaughter} />
                            </div>
                        </Col>
                        <Col md={4} className="mt-3">
                            <div className="bg-light p-2 rounded border h-100">
                                <Form.Check type="switch" name="enable_cutting" label="تفعيل التقطيع" checked={formData.enable_cutting ?? true} onChange={handleChange} className="fw-bold mb-2" />
                                <Form.Control type="number" placeholder="سعر التقطيع" name="cutting_price" value={formData.cutting_price || 0} onChange={handleChange} size="sm" disabled={!formData.enable_cutting} />
                            </div>
                        </Col>
                        <Col md={4} className="mt-3">
                            <div className="bg-light p-2 rounded border h-100">
                                <Form.Check type="switch" name="enable_packaging" label="تفعيل التغليف" checked={formData.enable_packaging ?? true} onChange={handleChange} className="fw-bold mb-2" />
                                <Form.Control type="number" placeholder="سعر التغليف" name="packaging_price" value={formData.packaging_price || 0} onChange={handleChange} size="sm" disabled={!formData.enable_packaging} />
                            </div>
                        </Col>
                    </Row>
                    <hr className="my-4" />
                    <div className="mb-3 d-flex justify-content-between align-items-center">
                        <h6 className="fw-bold mb-0 text-primary">معدلات الزيادة اليومية</h6>
                        <Button variant="outline-primary" size="sm" onClick={addRateRow}><PlusCircle size={16} className="me-1"/>إضافة</Button>
                    </div>
                    <div className="bg-light p-3 rounded">
                        {growthRates.map((rate, idx) => (
                            <Row key={idx} className="g-2 mb-2 align-items-end">
                                <Col xs={4}>
                                    <Form.Label className="small mb-1">من وزن</Form.Label>
                                    <Form.Control type="number" size="sm" step="0.01" value={rate.min_weight} onChange={e => handleRateChange(idx, 'min_weight', e.target.value)} />
                                </Col>
                                <Col xs={4}>
                                    <Form.Label className="small mb-1">إلى وزن</Form.Label>
                                    <Form.Control type="number" size="sm" step="0.01" value={rate.max_weight} onChange={e => handleRateChange(idx, 'max_weight', e.target.value)} />
                                </Col>
                                <Col xs={3}>
                                    <Form.Label className="small mb-1">الزيادة (كجم/يوم)</Form.Label>
                                    <Form.Control type="number" size="sm" step="0.001" value={rate.daily_increase} onChange={e => handleRateChange(idx, 'daily_increase', e.target.value)} />
                                </Col>
                                <Col xs={1}>
                                    <Button variant="link" className="text-danger p-0 mt-3" onClick={() => removeRateRow(idx)}><X size={18} /></Button>
                                </Col>
                            </Row>
                        ))}
                        {growthRates.length === 0 && <p className="text-muted text-center small mb-0">لم تضف أي معدلات بعد.</p>}
                    </div>
                    <div className="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                        <Button variant="outline-secondary" onClick={handleClose} size="sm">إلغاء</Button>
                        <Button variant="primary" type="submit" disabled={loading} size="sm">{loading ? 'جاري...' : 'حفظ'}</Button>
                    </div>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

const DepartmentForm = ({ show, handleClose, onSave, itemToEdit }) => {
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) setFormData(itemToEdit ? { name: itemToEdit.name, description: itemToEdit.description } : { name: '', description: '' });
    }, [show, itemToEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const method = itemToEdit ? 'patch' : 'post';
        const url = itemToEdit ? `/management/departments/${itemToEdit.id}/` : '/management/departments/';
        try {
            await axios[method](url, formData);
            toast.success(itemToEdit ? "تم تحديث القسم" : "تم إنشاء القسم");
            onSave();
            handleClose();
        } catch {
            toast.error("فشل حفظ القسم");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton className="border-bottom-0 pb-0">
                <Modal.Title className="fs-5">{itemToEdit ? 'تعديل قسم' : 'إضافة قسم جديد'}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-medium">اسم القسم</Form.Label>
                        <Form.Control type="text" name="name" value={formData.name || ''} onChange={handleChange} required autoFocus size="sm" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-medium">الوصف</Form.Label>
                        <Form.Control as="textarea" rows={3} name="description" value={formData.description || ''} onChange={handleChange} size="sm" />
                    </Form.Group>
                    <div className="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                        <Button variant="outline-secondary" onClick={handleClose} size="sm">إلغاء</Button>
                        <Button variant="primary" type="submit" disabled={loading} size="sm">{loading ? 'جاري...' : 'حفظ'}</Button>
                    </div>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

const DepartmentsPanel = ({ departments, onSave }) => {
    const [showModal, setShowModal] = useState(false);
    const [selectedDept, setSelectedDept] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const handleEdit = (dept) => { setSelectedDept(dept); setShowModal(true); };
    const handleAdd = () => { setSelectedDept(null); setShowModal(true); };
    const handleDelete = async (id) => {
        if (window.confirm("هل أنت متأكد من الحذف؟")) {
            try { await axios.delete(`/management/departments/${id}/`); toast.success("تم الحذف"); onSave(); } catch { toast.error("فشل الحذف"); }
        }
    };

    const filtered = departments.filter(d => d.name?.toLowerCase().includes(searchTerm.toLowerCase()) || d.description?.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <>
            <Row className="mb-3 g-2">
                <Col xs={6} md={4}>
                    <Card className="border-start border-primary border-3 h-100">
                        <Card.Body className="p-2">
                            <div className="d-flex justify-content-between align-items-center">
                                <div><small className="text-muted d-block">إجمالي الأقسام</small><h5 className="mb-0">{departments.length}</h5></div>
                                <Building size={20} className="text-primary" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={4}>
                    <Card className="border-start border-success border-3 h-100">
                        <Card.Body className="p-2">
                            <div className="d-flex justify-content-between align-items-center">
                                <div><small className="text-muted d-block">إجمالي الموظفين</small><h5 className="mb-0">{departments.reduce((sum, dept) => sum + (dept.employee_count || 0), 0)}</h5></div>
                                <Users size={20} className="text-success" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
                <Col xs={6} md={4}>
                    <Card className="border-start border-info border-3 h-100">
                        <Card.Body className="p-2">
                            <div className="d-flex justify-content-between align-items-center">
                                <div><small className="text-muted d-block">أقسام فارغة</small><h5 className="mb-0">{departments.filter(dept => !dept.employee_count).length}</h5></div>
                                <Info size={20} className="text-info" />
                            </div>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
            <Card className="shadow-sm border-0">
                <Card.Header className="bg-white border-bottom py-3">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                        <div className="d-flex align-items-center gap-2">
                            <h5 className="mb-0 fs-5 fw-semibold">الأقسام</h5>
                            <Button size="sm" onClick={handleAdd} className="d-flex align-items-center gap-1"><PlusCircle size={16} /><span className="d-none d-md-inline">إضافة قسم</span></Button>
                        </div>
                        <Form.Control type="text" placeholder="بحث..." size="sm" className="w-auto" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </Card.Header>
                <Card.Body className="p-0">
                    {filtered.length === 0 ? (
                        <div className="text-center py-5 text-muted">لا توجد أقسام</div>
                    ) : (
                        <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                            <Table hover className="mb-0">
                                <thead className="table-light sticky-top">
                                    <tr>
                                        <th className="border-bottom-0">اسم القسم</th>
                                        <th className="border-bottom-0 d-none d-md-table-cell">الوصف</th>
                                        <th className="border-bottom-0">عدد الموظفين</th>
                                        <th className="border-bottom-0 text-center">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(dept => (
                                        <tr key={dept.id}>
                                            <td className="align-middle"><div className="fw-medium">{dept.name}</div></td>
                                            <td className="align-middle d-none d-md-table-cell"><div className="text-truncate" style={{ maxWidth: '200px' }}>{dept.description || '-'}</div></td>
                                            <td className="align-middle"><Badge bg="info" className="fs-6">{dept.employee_count || 0}</Badge></td>
                                            <td className="align-middle"><div className="d-flex justify-content-center gap-2">
                                                <Button variant="outline-primary" size="sm" onClick={() => handleEdit(dept)}><Edit size={14} /></Button>
                                                <Button variant="outline-danger" size="sm" onClick={() => handleDelete(dept.id)}><Trash2 size={14} /></Button>
                                            </div></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </Card.Body>
            </Card>
            <DepartmentForm show={showModal} handleClose={() => setShowModal(false)} onSave={onSave} itemToEdit={selectedDept} />
        </>
    );
};

const RoleForm = ({ show, handleClose, onSave, itemToEdit, departments }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) setFormData(itemToEdit || { name: '', description: '', department: '' });
    }, [show, itemToEdit]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name?.trim() || !formData.department) { toast.warn("أكمل الحقول المطلوبة"); return; }
        setLoading(true);
        const method = itemToEdit ? 'patch' : 'post';
        const url = itemToEdit ? `/management/roles/${itemToEdit.id}/` : '/management/roles/';
        try {
            await axios[method](url, { name: formData.name, description: formData.description || '', department: parseInt(formData.department) });
            toast.success(itemToEdit ? "تم تحديث الدور" : "تم إنشاء الدور");
            onSave();
            handleClose();
        } catch  {
            toast.error("فشل حفظ الدور");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered>
            <Modal.Header closeButton className="border-bottom-0 pb-0">
                <Modal.Title className="fs-5">{itemToEdit ? 'تعديل دور وظيفي' : 'إضافة دور جديد'}</Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                {departments.length === 0 && <div className="alert alert-warning py-2 mb-3 small">يجب إضافة قسم أولاً</div>}
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-medium">اسم الدور <span className="text-danger">*</span></Form.Label>
                        <Form.Control type="text" name="name" value={formData.name || ''} onChange={handleChange} required autoFocus size="sm" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-medium">القسم <span className="text-danger">*</span></Form.Label>
                        <Form.Select name="department" value={formData.department || ''} onChange={handleChange} required size="sm">
                            <option value="">اختر القسم...</option>
                            {departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className="fw-medium">الوصف</Form.Label>
                        <Form.Control as="textarea" rows={3} name="description" value={formData.description || ''} onChange={handleChange} size="sm" />
                    </Form.Group>
                    <div className="d-flex justify-content-end gap-2 mt-4 pt-2 border-top">
                        <Button variant="outline-secondary" onClick={handleClose} size="sm">إلغاء</Button>
                        <Button variant="primary" type="submit" disabled={loading || departments.length === 0} size="sm">{loading ? 'جاري...' : 'حفظ'}</Button>
                    </div>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

const RolesPanel = ({ roles, departments, onSave }) => {
    const [showModal, setShowModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState(null);
    const [expandedDepartments, setExpandedDepartments] = useState({});

    const handleEdit = (role) => { setSelectedRole(role); setShowModal(true); };
    const handleAdd = () => { setSelectedRole(null); setShowModal(true); };
    const handleDelete = async (id) => {
        if (window.confirm("هل أنت متأكد من الحذف؟")) {
            try { await axios.delete(`/management/roles/${id}/`); toast.success("تم الحذف"); onSave(); } catch { toast.error("فشل الحذف"); }
        }
    };
    const toggleDepartment = (deptId) => setExpandedDepartments(prev => ({ ...prev, [deptId]: !prev[deptId] }));

    const allDepartments = departments.map(dept => ({
        ...dept,
        roles: roles.filter(role => role.department === dept.id),
        totalEmployees: roles.filter(role => role.department === dept.id).reduce((sum, role) => sum + (role.employee_count || 0), 0),
        totalRoles: roles.filter(role => role.department === dept.id).length
    })).sort((a, b) => b.totalEmployees - a.totalEmployees);

    const stats = {
        totalDepartments: departments.length,
        totalRoles: roles.length,
        totalEmployees: roles.reduce((sum, role) => sum + (role.employee_count || 0), 0),
        departmentsWithRoles: allDepartments.filter(dept => dept.totalRoles > 0).length,
        emptyDepartments: allDepartments.filter(dept => dept.totalRoles === 0).length
    };

    return (
        <>
            <Row className="mb-3 g-2">
                <Col xs={6} md={4} lg={2}><Card className="border-start border-primary border-3 h-100"><Card.Body className="p-2"><div className="d-flex justify-content-between align-items-center"><div><small className="text-muted d-block">إجمالي الأقسام</small><h5 className="mb-0">{stats.totalDepartments}</h5></div><Building size={18} className="text-primary" /></div></Card.Body></Card></Col>
                <Col xs={6} md={4} lg={2}><Card className="border-start border-success border-3 h-100"><Card.Body className="p-2"><div className="d-flex justify-content-between align-items-center"><div><small className="text-muted d-block">إجمالي الأدوار</small><h5 className="mb-0">{stats.totalRoles}</h5></div><Briefcase size={18} className="text-success" /></div></Card.Body></Card></Col>
                <Col xs={6} md={4} lg={2}><Card className="border-start border-info border-3 h-100"><Card.Body className="p-2"><div className="d-flex justify-content-between align-items-center"><div><small className="text-muted d-block">إجمالي الموظفين</small><h5 className="mb-0">{stats.totalEmployees}</h5></div><Users size={18} className="text-info" /></div></Card.Body></Card></Col>
                <Col xs={6} md={4} lg={2}><Card className="border-start border-warning border-3 h-100"><Card.Body className="p-2"><div className="d-flex justify-content-between align-items-center"><div><small className="text-muted d-block">أقسام بها أدوار</small><h5 className="mb-0">{stats.departmentsWithRoles}</h5></div><Folder size={18} className="text-warning" /></div></Card.Body></Card></Col>
                <Col xs={6} md={4} lg={2}><Card className="border-start border-danger border-3 h-100"><Card.Body className="p-2"><div className="d-flex justify-content-between align-items-center"><div><small className="text-muted d-block">أقسام فارغة</small><h5 className="mb-0">{stats.emptyDepartments}</h5></div><Info size={18} className="text-danger" /></div></Card.Body></Card></Col>
                <Col xs={6} md={4} lg={2}><Card className="border-start border-secondary border-3 h-100"><Card.Body className="p-2"><div className="d-flex justify-content-between align-items-center"><div><small className="text-muted d-block">متوسط أدوار/قسم</small><h5 className="mb-0">{(stats.totalDepartments ? (stats.totalRoles / stats.totalDepartments).toFixed(1) : 0)}</h5></div><UserCheck size={18} className="text-secondary" /></div></Card.Body></Card></Col>
            </Row>
            <Card className="shadow-sm border-0">
                <Card.Header className="bg-white border-bottom py-3">
                    <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                        <div className="d-flex align-items-center gap-2">
                            <h5 className="mb-0 fs-5 fw-semibold">الأدوار الوظيفية</h5>
                            <Button size="sm" onClick={handleAdd} className="d-flex align-items-center gap-1"><PlusCircle size={16} /><span className="d-none d-md-inline">إضافة دور</span></Button>
                        </div>
                    </div>
                </Card.Header>
                <Card.Body className="p-0">
                    {allDepartments.length === 0 ? (
                        <div className="text-center py-5 text-muted">لا توجد أقسام</div>
                    ) : (
                        <div className="list-group list-group-flush">
                            {allDepartments.map(dept => (
                                <div key={dept.id} className="list-group-item p-0 border-bottom">
                                    <div className="p-3 bg-light-hover cursor-pointer" onClick={() => toggleDepartment(dept.id)} style={{ cursor: 'pointer' }}>
                                        <div className="d-flex justify-content-between align-items-center">
                                            <div className="d-flex align-items-center gap-2">
                                                <Building size={20} className="text-primary" />
                                                <h6 className="mb-0 fw-semibold">{dept.name}</h6>
                                                <Badge bg="secondary" pill className="fs-6">{dept.totalRoles} دور</Badge>
                                                <Badge bg="info" pill className="fs-6">{dept.totalEmployees} موظف</Badge>
                                            </div>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="small text-muted">{expandedDepartments[dept.id] ? 'إخفاء' : 'عرض'}</div>
                                                <span className={`transition-all ${expandedDepartments[dept.id] ? 'rotate-180' : ''}`}>▼</span>
                                            </div>
                                        </div>
                                        {dept.description && <div className="text-muted small mt-1 ps-4">{dept.description}</div>}
                                    </div>
                                    {expandedDepartments[dept.id] && (
                                        <div className="p-3 bg-white">
                                            {dept.roles.length === 0 ? (
                                                <div className="text-center py-3 text-muted small">لا توجد أدوار</div>
                                            ) : (
                                                <div className="table-responsive">
                                                    <Table hover size="sm" className="mb-0">
                                                        <thead className="table-light">
                                                            <tr><th>اسم الدور</th><th>الوصف</th><th className="text-center">عدد الموظفين</th><th className="text-center">الإجراءات</th></tr>
                                                        </thead>
                                                        <tbody>
                                                            {dept.roles.map(role => (
                                                                <tr key={role.id}>
                                                                    <td className="align-middle fw-medium">{role.name}</td>
                                                                    <td className="align-middle"><div className="text-truncate" style={{ maxWidth: '250px' }}>{role.description || '-'}</div></td>
                                                                    <td className="align-middle text-center"><Badge bg={role.employee_count > 0 ? "success" : "secondary"} className="fs-6">{role.employee_count || 0}</Badge></td>
                                                                    <td className="align-middle text-center">
                                                                        <div className="d-flex justify-content-center gap-1">
                                                                            <Button variant="outline-primary" size="sm" onClick={() => handleEdit(role)}><Edit size={14} /></Button>
                                                                            <Button variant="outline-danger" size="sm" onClick={() => handleDelete(role.id)}><Trash2 size={14} /></Button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </Table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </Card.Body>
            </Card>
            <RoleForm show={showModal} handleClose={() => setShowModal(false)} onSave={onSave} itemToEdit={selectedRole} departments={departments} />
            <style>{`.rotate-180{transform:rotate(180deg)}.transition-all{transition:all .3s ease}.bg-light-hover:hover{background-color:rgba(0,0,0,0.02)}.cursor-pointer{cursor:pointer}`}</style>
        </>
    );
};

const GlobalDiscountForm = () => {
    const [settings, setSettings] = useState({});
    const [loading, setLoading] = useState(false);

    const fetchSettings = async () => {
        try { const res = await axios.get('/management/global-discounts/'); setSettings(res.data); } catch { toast.error("فشل تحميل إعدادات الخصم"); } };
    useEffect(() => { fetchSettings(); }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try { await axios.post('/management/global-discounts/', settings); toast.success("تم حفظ الإعدادات"); } catch { toast.error("فشل الحفظ"); } finally { setLoading(false); }
    };

    return (
        <Card className="shadow-sm h-100 border-0">
            <Card.Header className="bg-primary text-white border-0 d-flex align-items-center py-3"><Building size={20} className="me-2" /><span className="fs-5 fw-semibold">الخصم العام</span></Card.Header>
            <Card.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Check type="switch" label={<span className="fw-bold text-success">تفعيل الخصم العام</span>} name="is_active" checked={settings.is_active || false} onChange={handleChange} className="mb-3" id="discount-switch" />
                    <Row className="g-3">
                        <Col xs={12} md={6}><Form.Group><Form.Label className="fw-medium">نسبة الخصم (%)</Form.Label><Form.Control type="number" name="percentage" value={settings.percentage || ''} onChange={handleChange} size="sm" /></Form.Group></Col>
                        <Col xs={12} md={6}><Form.Group><Form.Label className="fw-medium">رسالة الشريط</Form.Label><Form.Control as="textarea" rows={2} name="ticker_message" value={settings.ticker_message || ''} onChange={handleChange} size="sm" /></Form.Group></Col>
                    </Row>
                    <Row className="g-3 mt-2">
                        <Col xs={12} md={4}><Form.Group><Form.Label className="fw-medium">أقصى عدد مواشي للعميل الواحد</Form.Label><Form.Control type="number" name="max_animals_per_user" value={settings.max_animals_per_user || 0} onChange={handleChange} size="sm" title="اكتب 0 ليصبح بلا حدود" /></Form.Group></Col>
                        <Col xs={12} md={4}><Form.Group><Form.Label className="fw-medium">تاريخ البدء</Form.Label><Form.Control type="datetime-local" name="start_date" value={settings.start_date ? settings.start_date.slice(0, 16) : ''} onChange={handleChange} size="sm" /></Form.Group></Col>
                        <Col xs={12} md={4}><Form.Group><Form.Label className="fw-medium">تاريخ الانتهاء</Form.Label><Form.Control type="datetime-local" name="end_date" value={settings.end_date ? settings.end_date.slice(0, 16) : ''} onChange={handleChange} size="sm" /></Form.Group></Col>
                    </Row>
                    <Form.Check type="checkbox" label="يشمل الخدمات (ذبح/توصيل)" name="applies_to_services" checked={settings.applies_to_services || false} onChange={handleChange} className="my-3" id="services-checkbox" />
                    <Button type="submit" disabled={loading} className="w-100 mt-2" size="sm">{loading ? 'جاري...' : 'حفظ الإعدادات'}</Button>
                </Form>
            </Card.Body>
        </Card>
    );
};

const DiscountLogsTable = () => {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('/management/discount-logs/').then(res => {
            const globalLogs = (res.data.results || []).filter(log => log.target_type === 'global');
            setLogs(globalLogs);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    if (loading) return <div className="d-flex justify-content-center p-5"><Spinner animation="border" variant="primary" /></div>;

    return (
        <Card className="shadow-sm h-100 border-0">
            <Card.Header className="bg-white border-bottom py-3"><h5 className="mb-0 fs-5 fw-semibold">سجل تغييرات الخصومات العامة</h5></Card.Header>
            <Card.Body className="p-0">
                <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    <Table striped hover className="mb-0">
                        <thead className="table-light sticky-top">
                            <tr><th className="border-bottom-0 text-nowrap">التاريخ</th><th className="border-bottom-0 text-nowrap d-none d-md-table-cell">النوع</th><th className="border-bottom-0 text-nowrap">المستخدم</th><th className="border-bottom-0 text-nowrap d-none d-lg-table-cell">القسم</th><th className="border-bottom-0 text-nowrap">القديمة</th><th className="border-bottom-0 text-nowrap">الجديدة</th><th className="border-bottom-0 text-nowrap d-none d-xl-table-cell">ملاحظات</th></tr>
                        </thead>
                        <tbody>
                            {logs.length === 0 ? <tr><td colSpan="7" className="text-center text-muted py-4">لا توجد سجلات</td></tr> : logs.map(log => (
                                <tr key={log.id}>
                                    <td><div className="fw-medium">{new Date(log.timestamp).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' })}</div><div className="text-muted small">{new Date(log.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div></td>
                                    <td className="d-none d-md-table-cell"><Badge bg="primary" className="fs-6">عام</Badge></td>
                                    <td><div className="text-truncate" style={{ maxWidth: '120px' }}>{log.changed_by_name}</div></td>
                                    <td className="d-none d-lg-table-cell"><div className="text-truncate" style={{ maxWidth: '120px' }}>{log.department_snapshot}</div></td>
                                    <td><Badge bg="secondary" className="fs-6">{log.old_percentage}%</Badge></td>
                                    <td><Badge bg="success" className="fs-6">{log.new_percentage}%</Badge></td>
                                    <td className="d-none d-xl-table-cell"><div className="text-truncate" style={{ maxWidth: '150px' }}>{log.notes || '-'}</div></td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
};

const GlobalDiscountPanel = () => (
    <Row className="g-3">
        <Col xs={12} lg={5}><GlobalDiscountForm /></Col>
        <Col xs={12} lg={7}><DiscountLogsTable /></Col>
    </Row>
);

function Settings() {
    const [settings, setSettings] = useState({ delivery_days: [], pickup_days: [] });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [servicePrices, setServicePrices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [roles, setRoles] = useState([]);
    const [opSettings, setOpSettings] = useState({});
    const [deliveryAreas, setDeliveryAreas] = useState([]);
    const [governorates, setGovernorates] = useState([]);
    const [opLoadingServices, setOpLoadingServices] = useState(false);
    const [opLoadingSacrifice, setOpLoadingSacrifice] = useState(false);
    const [opLoadingBusiness, setOpLoadingBusiness] = useState(false);
    const [showCatModal, setShowCatModal] = useState(false);
    const [categoryToEdit, setCategoryToEdit] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [settingsRes, servicesRes, categoriesRes, departmentsRes, rolesRes, opSettingsRes, delAreasRes, govRes] = await Promise.all([
                axios.get('/management/delivery-settings/'),
                axios.get('/management/service-prices/?page_size=100'),
                axios.get('/livestock/categories/?page_size=100'),
                axios.get('/management/departments/?page_size=100'),
                axios.get('/management/roles/?page_size=1000'),
                axios.get('/management/operation-settings/'),
                axios.get('/management/delivery-areas/'),
                axios.get('/core/governorates/')
            ]);

            setSettings(settingsRes.data);
            setServicePrices((servicesRes.data.results || []).filter(s => s.name !== "رسوم مدة حجز إضافية"));
            const categoriesData = categoriesRes.data.results || categoriesRes.data || [];
            const categoriesWithRates = await Promise.all(
                categoriesData.map(async (category) => {
                    try {
                        return { ...category, growth_rates: category.growth_rates || [] };
                    } catch {
                        return { ...category, growth_rates: [] };
                    }
                })
            );
            setCategories(categoriesWithRates);
            setDepartments(departmentsRes.data.results || departmentsRes.data || []);
            setRoles(rolesRes.data.results || rolesRes.data || []);
            const opData = opSettingsRes.data || {};
            setOpSettings({
                ...opData,
                allow_deposit_payment: opData.allow_deposit_payment ?? true,
                enable_eid_receive_button: opData.enable_eid_receive_button ?? false,
                enable_slaughter_video_request: opData.enable_slaughter_video_request ?? true,
                pricing_model: opData.pricing_model || 'care_fee',
                delivery_limit_tolerance: opData.delivery_limit_tolerance ?? 2,
                otp_provider: opData.otp_provider || 'whysms',
                general_sms_provider: opData.general_sms_provider || 'whysms',
            });
            setDeliveryAreas(delAreasRes.data || []);
            setGovernorates(govRes.data || []);
        } catch {
            toast.error("فشل تحميل الإعدادات.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchAreasOnly = async () => {
        try {
            const res = await axios.get('/management/delivery-areas/');
            setDeliveryAreas(res.data || []);
        } catch {
            toast.error("فشل تحديث قائمة المحافظات");
        }
    };

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpChange = (e) => {
        const { name, value, type, checked } = e.target;
        setOpSettings(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSaveServices = async (e) => {
        e.preventDefault();
        setOpLoadingServices(true);
        try {
            await axios.post('/management/operation-settings/', {
                enable_delivery_service: opSettings.enable_delivery_service,
                enable_farm_pickup: opSettings.enable_farm_pickup,

                enable_internal_slaughter: opSettings.enable_internal_slaughter,
                enable_fridge_manager: opSettings.enable_fridge_manager,

                enable_slaughter_video_request: opSettings.enable_slaughter_video_request,
                pricing_model: opSettings.pricing_model,
                delivery_limit_tolerance: opSettings.delivery_limit_tolerance,
                otp_provider: opSettings.otp_provider,
                general_sms_provider: opSettings.general_sms_provider
            });
            toast.success("تم حفظ إعدادات الخدمات");
        } catch { toast.error("فشل الحفظ"); } finally { setOpLoadingServices(false); }
    };

    const handleSaveSacrifice = async (e) => {
        e.preventDefault();
        setOpLoadingSacrifice(true);
        try {
            await axios.post('/management/operation-settings/', {
                is_adahi_season_active: opSettings.is_adahi_season_active,
                enable_general_shares: opSettings.enable_general_shares,
                enable_adahi_full: opSettings.enable_adahi_full,
                enable_adahi_pool: opSettings.enable_adahi_pool,
                enable_adahi_group: opSettings.enable_adahi_group,
                enable_ramadan_celebration: opSettings.enable_ramadan_celebration,
                ramadan_start_date: opSettings.ramadan_start_date,
                enable_eid_fitr_celebration: opSettings.enable_eid_fitr_celebration,
                eid_fitr_start_date: opSettings.eid_fitr_start_date,
                eid_adha_date: opSettings.eid_adha_date,
                enable_eid_celebration: opSettings.enable_eid_celebration,
                show_eid_timer: opSettings.show_eid_timer,
                enable_eid_receive_button: opSettings.enable_eid_receive_button,
            });
            toast.success("تم حفظ إعدادات المواسم");
        } catch { toast.error("فشل الحفظ"); } finally { setOpLoadingSacrifice(false); }
    };

    const handleSaveBusiness = async (e) => {
        e.preventDefault();
        setOpLoadingBusiness(true);
        try {
            await axios.post('/management/operation-settings/', {
                min_business_order_quantity: opSettings.min_business_order_quantity,
                business_weight_margin: opSettings.business_weight_margin,
            });
            toast.success("تم حفظ إعدادات قطاع الأعمال");
        } catch { toast.error("فشل الحفظ"); } finally { setOpLoadingBusiness(false); }
    };

    const handleSaveDeliverySettings = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                delivery_days: settings.delivery_days,
                pickup_days: settings.pickup_days,
                preparation_days: parseInt(settings.preparation_days, 10) || 0,
                slaughter_preparation_days: parseInt(settings.slaughter_preparation_days, 10) || 0,
                delivery_days_ahead: parseInt(settings.delivery_days_ahead, 10) || 7,
                pickup_days_ahead: parseInt(settings.pickup_days_ahead, 10) || 7,
            };
            await axios.patch('/management/delivery-settings/', payload);
            toast.success("تم حفظ إعدادات التوصيل");
            fetchData();
        } catch (error) {
            const errorData = error.response?.data;
            const errorMessages = errorData ? Object.values(errorData).flat().join(' ') : "فشل الحفظ";
            toast.error(errorMessages);
        } finally { setSaving(false); }
    };

    const handleChange = (e) => setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleDayChange = (field, day) => {
        setSettings(prev => {
            const currentDays = prev[field] || [];
            const newDays = currentDays.includes(day) ? currentDays.filter(d => d !== day) : [...currentDays, day];
            return { ...prev, [field]: newDays };
        });
    };

    const handleServicePriceChange = (id, price) => setServicePrices(prev => prev.map(s => s.id === id ? { ...s, price } : s));
    const handleSaveServicePrice = async (service) => {
        try { await axios.patch(`/management/service-prices/${service.id}/`, { price: service.price }); toast.success(`تم تحديث سعر "${service.name}"`); } catch { toast.error("فشل تحديث السعر"); }
    };
    const handleCategoryFeeChange = (id, fee) => setCategories(prev => prev.map(c => c.id === id ? { ...c, daily_care_fee: fee } : c));
    const handleSaveCategoryFee = async (category) => {
        try { await axios.patch(`/livestock/categories/${category.id}/`, { daily_care_fee: category.daily_care_fee }); toast.success(`تم تحديث تكلفة "${category.name_ar}"`); } catch { toast.error("فشل تحديث التكلفة"); }
    };
    const handleEditCategory = (cat) => { setCategoryToEdit(cat); setShowCatModal(true); };
    const handleAddCategory = () => { setCategoryToEdit(null); setShowCatModal(true); };
    const handleDeleteCategory = async (id) => {
        if (window.confirm("هل أنت متأكد من الحذف؟")) {
            try { await axios.delete(`/livestock/categories/${id}/`); toast.success("تم الحذف"); fetchData(); } catch { toast.error("فشل الحذف"); }
        }
    };

    const daysOfWeek = [
        { value: "Saturday", label: "السبت" }, { value: "Sunday", label: "الأحد" }, { value: "Monday", label: "الاثنين" },
        { value: "Tuesday", label: "الثلاثاء" }, { value: "Wednesday", label: "الأربعاء" }, { value: "Thursday", label: "الخميس" },
        { value: "Friday", label: "الجمعة" }
    ];

    const tabs =[
        { key: 'delivery', title: 'التوصيل والحجز', icon: <Truck size={18} /> },
        { key: 'categories', title: 'الفئات والنمو', icon: <Folder size={18} /> },
        { key: 'departments', title: 'الأقسام', icon: <Building size={18} /> },
        { key: 'roles', title: 'الأدوار', icon: <UserCheck size={18} /> },
        { key: 'discounts', title: 'الخصومات العامة', icon: <Percent size={18} /> },
        { key: 'operations', title: 'التحكم في العمليات', icon: <Activity size={18} /> },
    ];

    return (
        <div className="container-fluid px-2 px-sm-3 py-3">
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h1 className="h3 mb-0 fw-bold">الإعدادات العامة</h1>
            </div>
            <Tab.Container defaultActiveKey="categories">
                <MobileResponsiveNav className="mb-3 bg-light rounded p-2">
                    {tabs.map(tab => (
                        <Nav.Item key={tab.key}>
                            <Nav.Link eventKey={tab.key} className="text-nowrap px-3 py-2 rounded d-flex align-items-center gap-1">
                                {tab.icon}<span className="d-none d-sm-inline">{tab.title}</span><span className="d-inline d-sm-none">{tab.title.split(' ')[0]}</span>
                            </Nav.Link>
                        </Nav.Item>
                    ))}
                </MobileResponsiveNav>
                <Tab.Content>
                    <Tab.Pane eventKey="delivery">
                        <Card className="shadow-sm border-0">
                            <Card.Header className="bg-white border-bottom py-3"><h5 className="mb-0 fs-5 fw-semibold">إعدادات التوصيل والحجز</h5></Card.Header>
                            <Card.Body className="p-3">
                                {loading ? (
                                    <div className="text-center py-5"><Spinner animation="border" variant="primary" /><p className="text-muted mt-2">جاري التحميل...</p></div>
                                ) : (
                                    <Form onSubmit={handleSaveDeliverySettings}>
                                        <Row className="g-3">
                                            <Col xs={12} md={6}>
                                                <Form.Group><Form.Label className="fw-bold mb-2">أيام التوصيل المتاحة</Form.Label>
                                                    <div className="border rounded p-3 bg-light"><Row className="g-2">{daysOfWeek.map(day => (
                                                        <Col xs={6} sm={4} key={`delivery-${day.value}`}>
                                                            <Form.Check type="switch" id={`delivery-${day.value}`} label={day.label} checked={(settings.delivery_days || []).includes(day.value)} onChange={() => handleDayChange('delivery_days', day.value)} className="mb-2" />
                                                        </Col>
                                                    ))}</Row></div>
                                                </Form.Group>
                                            </Col>
                                            <Col xs={12} md={6}>
                                                <Form.Group><Form.Label className="fw-bold mb-2">أيام الاستلام من المزرعة</Form.Label>
                                                    <div className="border rounded p-3 bg-light"><Row className="g-2">{daysOfWeek.map(day => (
                                                        <Col xs={6} sm={4} key={`pickup-${day.value}`}>
                                                            <Form.Check type="switch" id={`pickup-${day.value}`} label={day.label} checked={(settings.pickup_days || []).includes(day.value)} onChange={() => handleDayChange('pickup_days', day.value)} className="mb-2" />
                                                        </Col>
                                                    ))}</Row></div>
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <Row className="g-3 mt-4">
                                            <Col xs={12} sm={6} md={3}>
                                                <Form.Group>
                                                    <Form.Label className="fw-medium">أيام التحضير (حي)</Form.Label>
                                                    <Form.Control type="number" name="preparation_days" value={settings.preparation_days || ''} onChange={handleChange} size="sm" min="0" />
                                                </Form.Group>
                                            </Col>
                                            <Col xs={12} sm={6} md={3}>
                                                <Form.Group>
                                                    <Form.Label className="fw-medium">أيام التحضير (مذبوح)</Form.Label>
                                                    <Form.Control type="number" name="slaughter_preparation_days" value={settings.slaughter_preparation_days || ''} onChange={handleChange} size="sm" min="0" />
                                                </Form.Group>
                                            </Col>
                                            <Col xs={12} sm={6} md={3}>
                                                <Form.Group>
                                                    <Form.Label className="fw-medium">أيام العرض للأمام (للتوصيل)</Form.Label>
                                                    <Form.Control type="number" name="delivery_days_ahead" value={settings.delivery_days_ahead || ''} onChange={handleChange} size="sm" min="1" />
                                                    <Form.Text className="text-muted small">كم يوم يظهر للعميل لاختياره</Form.Text>
                                                </Form.Group>
                                            </Col>
                                            <Col xs={12} sm={6} md={3}>
                                                <Form.Group>
                                                    <Form.Label className="fw-medium">أيام العرض للأمام (للاستلام)</Form.Label>
                                                    <Form.Control type="number" name="pickup_days_ahead" value={settings.pickup_days_ahead || ''} onChange={handleChange} size="sm" min="1" />
                                                </Form.Group>
                                            </Col>
                                        </Row>
                                        <div className="mt-4 pt-3 border-top"><Button type="submit" disabled={saving} className="px-4" size="sm">{saving ? <><Spinner as="span" animation="border" size="sm" className="me-2" />جاري...</> : 'حفظ إعدادات التوصيل'}</Button></div>
                                    </Form>
                                )}
                            </Card.Body>
                        </Card>
                    </Tab.Pane>
                    <Tab.Pane eventKey="categories">
                        <Card className="shadow-sm border-0">
                            <Card.Header className="bg-white border-bottom d-flex justify-content-between align-items-center py-3">
                                <h5 className="mb-0 fs-5 fw-semibold">إدارة الفئات ومعدلات النمو</h5>
                                <Button size="sm" onClick={handleAddCategory} className="d-flex align-items-center gap-1"><PlusCircle size={16} /><span className="d-none d-md-inline">إضافة فئة</span><span className="d-inline d-md-none">إضافة</span></Button>
                            </Card.Header>
                            <Card.Body className="p-0">
                                {loading ? <div className="text-center py-5"><Spinner animation="border" variant="primary" /></div> : (
                                    <div className="table-responsive">
                                        <Table hover className="mb-0">
                                            <thead className="table-light">
                                                <tr><th className="border-bottom-0">الفئة</th><th className="border-bottom-0">المنطق الشرعي</th><th className="border-bottom-0">معدلات النمو</th><th className="border-bottom-0">تكلفة الرعاية اليومية</th><th className="border-bottom-0 d-none d-md-table-cell">العدد الافتراضي</th><th className="border-bottom-0 d-none d-lg-table-cell">تفاوت الوزن</th><th className="border-bottom-0 text-center">الإجراءات</th></tr>
                                            </thead>
                                            <tbody>{categories.map(c => (
                                                <tr key={c.id}>
                                                    <td className="align-middle"><div className="fw-medium">{c.name_ar}</div></td>
                                                    <td className="align-middle"><Badge bg={{ sheep: 'success', goat: 'warning', cow: 'info', camel: 'dark' }[c.logic_type] || 'secondary'}>{ { sheep: 'ضأن', goat: 'ماعز', cow: 'بقر', camel: 'إبل' }[c.logic_type] || 'أخرى' }</Badge></td>
                                                    <td className="align-middle"><Badge bg="primary" className="fs-6">{c.growth_rates?.length || 0} شريحة</Badge></td>
                                                    <td className="align-middle"><div className="d-flex align-items-center gap-2"><Form.Control type="number" step="0.01" value={c.daily_care_fee} onChange={(e) => handleCategoryFeeChange(c.id, e.target.value)} className="w-auto" size="sm" min="0" /><span className="text-muted">جنية</span><Button size="sm" variant="outline-success" onClick={() => handleSaveCategoryFee(c)} className="px-2">حفظ</Button></div></td>
                                                    <td className="align-middle d-none d-md-table-cell"><Badge bg="info" className="fs-6">{c.default_max_shares}</Badge></td>
                                                    <td className="align-middle d-none d-lg-table-cell"><Badge bg="warning" className="fs-6">{c.weight_variance_limit || 0} كجم</Badge></td>
                                                    <td className="align-middle"><div className="d-flex justify-content-center gap-2"><Button variant="outline-primary" size="sm" onClick={() => handleEditCategory(c)}><Edit size={14} /></Button><Button variant="outline-danger" size="sm" onClick={() => handleDeleteCategory(c.id)}><Trash2 size={14} /></Button></div></td>
                                                </tr>
                                            ))}</tbody>
                                        </Table>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    </Tab.Pane>
                    <Tab.Pane eventKey="departments"><DepartmentsPanel departments={departments} onSave={fetchData} /></Tab.Pane>
                    <Tab.Pane eventKey="roles"><RolesPanel roles={roles} departments={departments} onSave={fetchData} /></Tab.Pane>
                    <Tab.Pane eventKey="discounts"><GlobalDiscountPanel /></Tab.Pane>
                    <Tab.Pane eventKey="operations">
                        <Row className="g-4">
                            <Col md={6}>
                                <ServicesControl
                                    settings={opSettings}
                                    handleChange={handleOpChange}
                                    loading={opLoadingServices}
                                    handleSubmit={handleSaveServices}
                                    deliveryAreas={deliveryAreas}
                                    governorates={governorates}
                                    refreshAreas={fetchAreasOnly}
                                />
                            </Col>
                            <Col md={6}><SacrificeSettings settings={opSettings} handleChange={handleOpChange} loading={opLoadingSacrifice} handleSubmit={handleSaveSacrifice} /></Col>
                            <Col md={6}><BusinessSettingsControl settings={opSettings} handleChange={handleOpChange} loading={opLoadingBusiness} handleSubmit={handleSaveBusiness} /></Col>
                        </Row>
                    </Tab.Pane>
                </Tab.Content>
            </Tab.Container>
            <CategoryForm show={showCatModal} handleClose={() => setShowCatModal(false)} onSave={fetchData} itemToEdit={categoryToEdit} />
        </div>
    );
}

export default Settings;
