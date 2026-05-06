import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Container, Card, Button, Table, Badge, Spinner, Nav, Tab, Modal, ListGroup, Alert } from 'react-bootstrap';
import { Globe, PlusCircle, Trash2, RefreshCw, CheckCircle, Search, Users, Lock, Crown, Eye } from 'lucide-react';

const AddToPoolModal = ({ show, handleClose, onAdd }) => {
    const [candidates, setCandidates] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!show) return;

        const fetchCandidates = async () => {
            setLoading(true);
            try {
                const response = await axios.get('/management/animals/adahi-pool-candidates/');
                const data = response.data?.results || response.data || [];

                const filteredCandidates = Array.isArray(data) ? data.filter(animal => {
                    const isCowCamel = animal.category?.logic_type && ['cow', 'camel'].includes(animal.category.logic_type);
                    const isAlreadyInPool = animal.is_adahi_pool || (animal.listings && animal.listings.some(l => l.section === 'adahi_pool' && l.is_active));

                    return isCowCamel && animal.is_sacrifice_valid_now && !isAlreadyInPool && animal.status === 'available';
                }) : [];

                setCandidates(filteredCandidates);
            } catch (error) {
                console.error('Failed to load candidates:', error);
                toast.error("فشل تحميل المرشحين");
                setCandidates([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCandidates();
    }, [show]);

    const handleAddClick = async (animalId) => {
        if (!animalId) {
            toast.error("معرف الحيوان غير صالح");
            return;
        }

        try {
            await onAdd(animalId);
            handleClose();
        } catch (error) {
            console.error('Error in AddToPoolModal:', error);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} size="lg" centered>
            <Modal.Header closeButton>
                <Modal.Title>إضافة أضاحي للمشاركة العامة</Modal.Title>
            </Modal.Header>
            <Modal.Body style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <Alert variant="info" className="mb-3">
                    <small>
                        <strong>ملاحظة:</strong> فقط البقر والجمال الصالحة للأضحية حالياً يمكن إضافتها للمسبح.
                        سيتم تقسيمها إلى 7 أسهم تلقائياً.
                    </small>
                </Alert>

                {loading ? (
                    <div className="text-center py-4">
                        <Spinner animation="border" role="status">
                            <span className="visually-hidden">جاري التحميل...</span>
                        </Spinner>
                    </div>
                ) : !candidates.length ? (
                    <div className="text-center py-5 text-muted">
                        <p>لا توجد حيوانات متاحة حالياً للإضافة للمسبح.</p>
                        <small>يجب أن تكون متاحة وصالحة للذبح الآن ومن فئة البقر أو الجمال.</small>
                    </div>
                ) : (
                    <ListGroup variant="flush">
                        {candidates.map(animal => {
                            const animalKey = animal.id || animal.unique_id || Math.random().toString();
                            const sharePrice = animal.price_egp ? (animal.price_egp / 7).toFixed(2) : 0;

                            return (
                                <ListGroup.Item key={animalKey} className="d-flex justify-content-between align-items-center py-3">
                                    <div>
                                        <h6 className="mb-1 fw-bold">{animal.category_name || 'غير محدد'} #{animal.code || 'N/A'}</h6>
                                        <div className="small text-muted">
                                            الوزن: {animal.current_weight || 0} كجم | السعر الكامل: {animal.price_egp || 0} ج.م
                                        </div>
                                        <div className="mt-1 small">
                                            <Badge bg="info" className="me-2">سعر السهم: {sharePrice} ج.م</Badge>
                                            <Badge bg="success">صالح للأضحية</Badge>
                                        </div>
                                    </div>
                                    <Button
                                        variant="success"
                                        size="sm"
                                        onClick={() => handleAddClick(animal.unique_id || animal.id)}
                                        className="d-flex align-items-center gap-2"
                                        aria-label={`إضافة ${animal.category_name} للمسبح`}
                                    >
                                        <PlusCircle size={16} aria-hidden="true" /> إضافة للمسبح
                                    </Button>
                                </ListGroup.Item>
                            );
                        })}
                    </ListGroup>
                )}
            </Modal.Body>
        </Modal>
    );
};

const GroupDetailsModal = ({ show, handleClose, group }) => {
    const [buyers, setBuyers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!show || !group?.animal_details?.code) return;

        const fetchGroupBuyers = async () => {
            setLoading(true);
            try {
                const response = await axios.get('/management/orders/', {
                    params: {
                        search: group.animal_details.code
                    }
                });

                const allOrders = response.data?.results || response.data || [];
                const allowedStatuses = ['pending', 'confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed'];
                const groupBuyers = [];

                allOrders.forEach(order => {
                    if (allowedStatuses.includes(order.status) && order.items) {
                        order.items.forEach(item => {
                            if (item.animal_code === group.animal_details.code && item.listing_section === 'adahi_group') {
                                groupBuyers.push({
                                    orderId: order.id,
                                    customer: order.user?.full_name || 'غير معروف',
                                    phone: order.user?.phone || 'غير متوفر',
                                    shares: Number(item.share_quantity) || 1,
                                    date: order.created_at,
                                    status: order.status
                                });
                            }
                        });
                    }
                });

                setBuyers(groupBuyers);
            } catch (error) {
                console.error('Failed to load buyers:', error);
                toast.error("فشل في تحميل بيانات المشترين");
                setBuyers([]);
            } finally {
                setLoading(false);
            }
        };

        fetchGroupBuyers();
    }, [show, group?.animal_details?.code]);

    if (!group) return null;

    const maxShares = group.listing_details?.total_shares || 7;
    const sold = group.sold_shares || 0;
    const progress = Math.min(100, Math.round((sold / maxShares) * 100));
    const sharePrice = group.listing_details?.price_per_share || 0;

    const getStatusBadge = (status) => {
        const statusMap = {
            'completed': { bg: 'success', text: 'مكتمل' },
            'confirmed': { bg: 'primary', text: 'مؤكد' },
            'processing': { bg: 'warning', text: 'قيد التجهيز' },
            'ready_for_shipment': { bg: 'info', text: 'جاهز للشحن' },
            'shipped': { bg: 'secondary', text: 'تم الشحن' },
            'delivered': { bg: 'success', text: 'تم التسليم' },
            'pending': { bg: 'light', text: 'قيد الانتظار' }
        };
        const statusInfo = statusMap[status] || { bg: 'secondary', text: status || 'غير معروف' };
        return <Badge bg={statusInfo.bg}>{statusInfo.text}</Badge>;
    };

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title>تفاصيل مجموعة المشاركة</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="mb-4">
                    <div className="row">
                        <div className="col-md-6">
                            <h6 className="text-muted mb-1">الحيوان</h6>
                            <p className="fw-bold h5">#{group.animal_details?.code} - {group.animal_details?.category_name}</p>
                        </div>
                        <div className="col-md-6">
                            <h6 className="text-muted mb-1">سعر السهم</h6>
                            <p className="fw-bold h5 text-primary">
                                {Number(sharePrice).toFixed(2)} ج.م
                            </p>
                        </div>
                    </div>

                    <div className="mb-3 mt-3">
                        <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">التقدم:</span>
                            <strong className="text-success">{sold} / {maxShares} سهم ({progress}%)</strong>
                        </div>
                        <div className="progress" style={{ height: '10px' }}>
                            <div
                                className="progress-bar bg-success"
                                style={{ width: `${progress}%` }}
                                role="progressbar"
                                aria-valuenow={progress}
                                aria-valuemin="0"
                                aria-valuemax="100"
                            />
                        </div>
                    </div>
                </div>

                <h6 className="mb-3">سجل المشترين:</h6>
                {loading ? (
                    <div className="text-center py-4">
                        <Spinner animation="border" size="sm" role="status">
                            <span className="visually-hidden">جار التحميل...</span>
                        </Spinner>
                        <p className="mt-2 text-muted small">جاري تحميل بيانات المشترين...</p>
                    </div>
                ) : !buyers.length ? (
                    <Alert variant="light" className="text-center py-4">
                        <p className="mb-0 text-muted">لا يوجد مشترين لهذه المجموعة حتى الآن.</p>
                    </Alert>
                ) : (
                    <div className="table-responsive">
                        <Table size="sm" hover className="mb-0">
                            <thead className="bg-light">
                                <tr>
                                    <th>العميل</th>
                                    <th>الهاتف</th>
                                    <th>عدد الأسهم</th>
                                    <th>رقم الطلب</th>
                                    <th>الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {buyers.map((buyer, index) => (
                                    <tr key={`${buyer.orderId}-${index}`}>
                                        <td className="fw-medium">{buyer.customer}</td>
                                        <td dir="ltr" className="text-start">{buyer.phone}</td>
                                        <td><Badge bg="info" pill>{buyer.shares}</Badge></td>
                                        <td>#{buyer.orderId}</td>
                                        <td>{getStatusBadge(buyer.status)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>إغلاق</Button>
            </Modal.Footer>
        </Modal>
    );
};

const AdahiManager = () => {
    const [activeTab, setActiveTab] = useState('full_sacrifice');
    const [fullAnimals, setFullAnimals] = useState([]);
    const [poolAnimals, setPoolAnimals] = useState([]);
    const [privateGroups, setPrivateGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState({});
    const [showAddPoolModal, setShowAddPoolModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);

    const handleConvertToPool = async (groupId) => {
        if (!window.confirm("هل أنت متأكد من تحويل هذه المجموعة إلى مسبح أضاحي عام؟ لا يمكن التراجع عن هذا.")) return;
        try {
            await axios.post(`/livestock/adahi-groups/${groupId}/convert-to-pool/`);
            toast.success("تم تحويل المجموعة بنجاح");
            fetchData();
        } catch  {
            toast.error("فشل التحويل");
        }
    };

    const calculateTimeLeft = (expiresAt) => {
        if (!expiresAt) return 'غير محدد';
        const difference = new Date(expiresAt) - new Date();
        if (difference <= 0) return <span className="text-danger fw-bold">انتهى الوقت</span>;
        const h = Math.floor((difference / (1000 * 60 * 60)) % 24);
        const m = Math.floor((difference / 1000 / 60) % 60);
        return <span className="text-warning fw-bold">{h} ساعة و {m} دقيقة</span>;
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [fullRes, poolRes, groupsRes] = await Promise.allSettled([
                axios.get('/livestock/sacrifices/adahi-full/'),
                axios.get('/livestock/sacrifices/adahi-pool/'),
                axios.get('/livestock/adahi-groups/')
            ]);

            if (fullRes.status === 'fulfilled') {
                const rawData = fullRes.value.data?.results || fullRes.value.data || [];
                setFullAnimals(Array.isArray(rawData) ? rawData.map(item => ({
                    ...item.animal_details,
                    listings: [{
                        section: item.section,
                        price: item.price,
                        is_active: true
                    }],
                    price_after_discount: item.price
                })) : []);
            }

            if (poolRes.status === 'fulfilled') {
                const rawData = poolRes.value.data?.results || poolRes.value.data || [];
                setPoolAnimals(Array.isArray(rawData) ? rawData.map(item => ({
                    ...item.animal_details,
                    listings: [{
                        section: 'adahi_pool',
                        total_shares: item.total_shares,
                        available_shares: item.available_shares,
                        is_active: item.is_active,
                        price: item.price
                    }],
                    price_egp: item.price
                })) : []);
            }

            if (groupsRes.status === 'fulfilled') {
                const groupsData = groupsRes.value.data?.results || groupsRes.value.data || [];
                setPrivateGroups(Array.isArray(groupsData) ? groupsData : []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
            toast.error("حدث خطأ في تحميل البيانات");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleAddToPool = async (animalId) => {
        if (!animalId) return;

        setProcessing(prev => ({ ...prev, [animalId]: true }));
        try {
            await axios.post(`/management/animals/${animalId}/toggle-adahi-pool/`);
            toast.success("تمت الإضافة للمسبح بنجاح");
            await fetchData();
        } catch (error) {
            const errorMsg = error.response?.data?.detail || error.response?.data?.message || "خطأ أثناء الإضافة";
            toast.error(errorMsg);
        } finally {
            setProcessing(prev => ({ ...prev, [animalId]: false }));
        }
    };

    const handleRemoveFromPool = async (animalId) => {
        const animal = poolAnimals.find(a => a.unique_id === animalId);
        const poolListing = animal?.listings?.find(l => l.section === 'adahi_pool');
        const soldShares = poolListing ? (poolListing.total_shares - poolListing.available_shares) : 0;

        if (soldShares > 0) {
            toast.warn(`لا يمكن الإزالة: تم بيع ${soldShares} سهم`);
            return;
        }

        if (!window.confirm("هل أنت متأكد من إزالة هذا الحيوان من المسبح العام؟")) return;

        setProcessing(prev => ({ ...prev, [animalId]: true }));
        try {
            await axios.post(`/management/animals/${animalId}/toggle-adahi-pool/`);
            toast.success("تمت الإزالة من المسبح");
            await fetchData();
        } catch (error) {
            const errorMsg = error.response?.data?.detail || error.response?.data?.message || "خطأ أثناء الإزالة";
            toast.error(errorMsg);
        } finally {
            setProcessing(prev => ({ ...prev, [animalId]: false }));
        }
    };

    const renderFullSacrificeTab = () => {
        if (loading) {
            return (
                <div className="text-center py-5">
                    <Spinner animation="border" variant="success" />
                    <p className="mt-2 text-muted">جاري تحميل البيانات...</p>
                </div>
            );
        }

        if (!fullAnimals.length) {
            return (
                <div className="text-center py-5 text-muted">
                    <Search size={48} className="mb-3 opacity-50" />
                    <h5>لا توجد أضاحي كاملة متاحة</h5>
                </div>
            );
        }

        return (
            <div className="table-responsive">
                <Table hover className="mb-0 align-middle">
                    <thead className="bg-light">
                        <tr>
                            <th>الكود</th>
                            <th>النوع</th>
                            <th>الوزن</th>
                            <th>العمر</th>
                            <th>السعر</th>
                            <th>الحالة</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fullAnimals.map(animal => (
                            <tr key={animal.id}>
                                <td className="fw-bold text-primary">#{animal.code}</td>
                                <td>{animal.category_name}</td>
                                <td>{animal.current_weight || 0} كجم</td>
                                <td>{animal.age_months || 0} شهر</td>
                                <td className="fw-bold">{animal.price_after_discount || animal.price_egp} ج.م</td>
                                <td>
                                    {animal.is_sacrifice_valid_now ?
                                        <Badge bg="success">صالح الآن</Badge> :
                                        <Badge bg="info">صالح في العيد</Badge>
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </Table>
            </div>
        );
    };

    const renderPoolTab = () => (
        <>
            <div className="p-3 border-bottom d-flex justify-content-between align-items-center bg-light">
                <small className="text-muted">حيوانات تم تخصيصها لبيعها بالأسهم للعامة</small>
                <Button variant="success" size="sm" onClick={() => setShowAddPoolModal(true)}>
                    <PlusCircle size={16} className="me-1" /> إضافة للمسبح
                </Button>
            </div>

            {!poolAnimals.length ? (
                <div className="text-center py-5 text-muted">
                    <Globe size={48} className="mb-3 opacity-50" />
                    <h5>المسبح العام فارغ</h5>
                </div>
            ) : (
                <div className="table-responsive">
                    <Table hover className="mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th>الكود</th>
                                <th>النوع</th>
                                <th>الوزن</th>
                                <th>سعر السهم</th>
                                <th>التقدم</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {poolAnimals.map(animal => {
                                const poolListing = animal.listings?.find(l => l.section === 'adahi_pool');
                                if (!poolListing) return null;

                                const maxShares = poolListing.total_shares || 7;
                                const remaining = poolListing.available_shares || 0;
                                const sold = Math.max(0, maxShares - remaining);
                                const percent = Math.min(100, Math.round((sold / maxShares) * 100));
                                const sharePrice = (animal.price_egp / maxShares).toFixed(2);
                                const canRemove = sold === 0;

                                return (
                                    <tr key={animal.id}>
                                        <td className="fw-bold text-success">#{animal.code}</td>
                                        <td>{animal.category_name}</td>
                                        <td>{animal.current_weight || 0} كجم</td>
                                        <td className="fw-bold">{sharePrice} ج.م</td>
                                        <td style={{ minWidth: '150px' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="progress flex-grow-1" style={{ height: '8px' }}>
                                                    <div className="progress-bar bg-success" style={{ width: `${percent}%` }} />
                                                </div>
                                                <small className="fw-bold">{sold}/{maxShares}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <Button
                                                variant={canRemove ? "outline-danger" : "outline-secondary"}
                                                size="sm"
                                                onClick={() => handleRemoveFromPool(animal.unique_id)}
                                                disabled={processing[animal.id] || !canRemove}
                                                title={canRemove ? "إزالة من المسبح" : "لا يمكن الإزالة بعد بيع الأسهم"}
                                            >
                                                {processing[animal.id] ? (
                                                    <Spinner size="sm" animation="border" />
                                                ) : (
                                                    <Trash2 size={14} />
                                                )}
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            )}
        </>
    );

    const renderPrivateGroupsTab = () => (
        <>
            <div className="p-3 border-bottom bg-light">
                <small className="text-muted">مجموعات أنشأها العملاء لدعوة معارفهم</small>
            </div>

            {!privateGroups.length ? (
                <div className="text-center py-5 text-muted">
                    <Users size={48} className="mb-3 opacity-50" />
                    <h5>لا توجد مجموعات خاصة نشطة</h5>
                </div>
            ) : (
                <div className="table-responsive">
                    <Table hover className="mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th>كود المجموعة</th>
                                <th>الحيوان</th>
                                <th>منشئ المجموعة</th>
                                <th>تاريخ الإنشاء / الوقت المتبقي</th>
                                <th>التقدم</th>
                                <th>الحالة</th>
                                <th>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {privateGroups.map(group => {
                                const animal = group.animal_details || {};
                                const maxShares = group.listing_details?.total_shares || 7;
                                const sold = group.sold_shares || 0;
                                const percent = Math.min(100, Math.round((sold / maxShares) * 100));

                                return (
                                    <tr key={group.id}>
                                        <td>
                                            <Badge bg="purple" className="fs-6 px-3 py-2" style={{ backgroundColor: '#6f42c1' }}>
                                                {group.code || 'N/A'}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="fw-bold">{animal.category_name || 'غير محدد'}</div>
                                            <small className="text-muted">#{animal.code || 'N/A'}</small>
                                        </td>
                                        <td>
                                            <div className="d-flex align-items-center gap-2">
                                                <Crown size={14} className="text-warning" />
                                                <span>{group.creator_name || 'غير معروف'}</span>
                                            </div>
                                            <small className="text-muted d-block ms-4">{group.creator_phone || ''}</small>
                                        </td>
                                        <td>
                                            <div>{group.created_at ? new Date(group.created_at).toLocaleDateString('ar-EG', { numberingSystem: 'latn', day: 'numeric', month: 'long', year: 'numeric' }) : 'غير معروف'}</div>
                                            <div className="small mt-1">
                                                متبقي: {calculateTimeLeft(group.expires_at)}
                                            </div>
                                        </td>
                                        <td style={{ minWidth: '150px' }}>
                                            <div className="d-flex align-items-center gap-2">
                                                <div className="progress flex-grow-1" style={{ height: '8px' }}>
                                                    <div className="progress-bar bg-info" style={{ width: `${percent}%` }} />
                                                </div>
                                                <small className="fw-bold">{sold}/{maxShares}</small>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge bg={group.is_active ? "success" : "secondary"}>
                                                {group.is_active ? "نشطة" : "غير نشطة"}
                                            </Badge>
                                        </td>
                                        <td>
                                            <div className="d-flex gap-2">
                                                <Button
                                                    variant="outline-primary"
                                                    size="sm"
                                                    onClick={() => handleConvertToPool(group.id)}
                                                    title="تحويل لمسبح عام"
                                                >
                                                    تحويل لمسبح
                                                </Button>
                                                <Button
                                                    variant="light"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedGroup(group);
                                                        setShowDetailsModal(true);
                                                    }}
                                                    title="عرض التفاصيل"
                                                >
                                                    <Eye size={16} className="text-primary" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </Table>
                </div>
            )}
        </>
    );

    return (
        <Container fluid className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 fw-bold text-dark mb-1">
                        <Globe className="me-2 text-success" size={28} />
                        إدارة موسم الأضاحي
                    </h1>
                </div>
                <Button variant="outline-primary" onClick={fetchData} disabled={loading}>
                    <RefreshCw size={18} className={loading ? 'spin' : ''} /> تحديث
                </Button>
            </div>

            <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
                <Card className="border-0 shadow-sm">
                    <Card.Header className="bg-white border-bottom-0 p-0">
                        <Nav variant="tabs" className="px-3 pt-3">
                            <Nav.Item>
                                <Nav.Link eventKey="full_sacrifice" className="fw-bold px-4 py-3 border-bottom-0">
                                    <CheckCircle size={18} className="me-2" />
                                    أضاحي كاملة
                                    <Badge bg="secondary" className="ms-2">{fullAnimals.length}</Badge>
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="pool" className="fw-bold px-4 py-3 border-bottom-0">
                                    <Users size={18} className="me-2" />
                                    مشاركة عامة
                                    <Badge bg="success" className="ms-2">{poolAnimals.length}</Badge>
                                </Nav.Link>
                            </Nav.Item>
                            <Nav.Item>
                                <Nav.Link eventKey="private_groups" className="fw-bold px-4 py-3 border-bottom-0">
                                    <Lock size={18} className="me-2" />
                                    مجموعات خاصة
                                    <Badge bg="info" className="ms-2">{privateGroups.length}</Badge>
                                </Nav.Link>
                            </Nav.Item>
                        </Nav>
                    </Card.Header>

                    <Card.Body className="p-0">
                        <Tab.Content>
                            <Tab.Pane eventKey="full_sacrifice">
                                {renderFullSacrificeTab()}
                            </Tab.Pane>
                            <Tab.Pane eventKey="pool">
                                {renderPoolTab()}
                            </Tab.Pane>
                            <Tab.Pane eventKey="private_groups">
                                {renderPrivateGroupsTab()}
                            </Tab.Pane>
                        </Tab.Content>
                    </Card.Body>
                </Card>
            </Tab.Container>

            <AddToPoolModal
                show={showAddPoolModal}
                handleClose={() => setShowAddPoolModal(false)}
                onAdd={handleAddToPool}
            />

            <GroupDetailsModal
                show={showDetailsModal}
                handleClose={() => {
                    setShowDetailsModal(false);
                    setSelectedGroup(null);
                }}
                group={selectedGroup}
            />

            <style>{`
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .nav-tabs .nav-link.active {
                    color: #198754;
                    border-bottom-color: white;
                    border-top: 3px solid #198754;
                }
                .nav-tabs .nav-link { color: #6c757d; }
            `}</style>
        </Container>
    );
};

export default AdahiManager;

