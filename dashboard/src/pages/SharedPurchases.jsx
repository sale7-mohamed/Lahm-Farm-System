import React, { useState, useEffect, useCallback } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Container, Card, Button, Table, Badge, Spinner, Modal } from 'react-bootstrap';
import { Users, PlusCircle, Trash2, RefreshCw, Eye, DollarSign } from 'lucide-react';

const AddToSharesModal = ({ show, handleClose, onSave }) => {
    const [candidates, setCandidates] = useState([]);
    const [selectedAnimal, setSelectedAnimal] = useState(null);
    const [sharesCount, setSharesCount] = useState(5);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchCandidates = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/management/animals/', {
                params: {
                    status: 'available',
                    is_hidden_from_store: false,
                    has_defect: false
                }
            });
            const allAnimals = response.data?.results || response.data || [];
            const sharesResponse = await axios.get('/livestock/shares/');
            const activeShares = sharesResponse.data?.results || sharesResponse.data || [];
            const activeAnimalIds = activeShares.map(item => item.animal_details?.id).filter(Boolean);

            const candidates = allAnimals.filter(animal => {
                const isInAdahi = animal.listings?.some(l =>
                    (l.section === 'adahi_group' || l.section === 'adahi_pool') && l.is_active
                ) || false;

                return (
                    !activeAnimalIds.includes(animal.id) &&
                    !animal.is_hidden_from_store &&
                    !animal.has_defect &&
                    animal.status === 'available' &&
                    animal.has_partial_sales !== true &&
                    !isInAdahi
                );
            });

            setCandidates(candidates);
        } catch (error) {
            console.error('Error fetching candidates:', error);
            toast.error('فشل في تحميل الحيوانات المتاحة');
            setCandidates([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (show) {
            fetchCandidates();
            setSelectedAnimal(null);
            setSharesCount(5);
            setSearchTerm('');
        }
    }, [show, fetchCandidates]);

    useEffect(() => {
        if (!show) {
            const timer = setTimeout(() => {
                setSelectedAnimal(null);
                setSharesCount(5);
                setSearchTerm('');
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [show]);

    const handleSelectAnimal = (animal) => {
        setSelectedAnimal(animal);
        setSharesCount(animal.category?.default_max_shares || 5);
    };

    const handleSubmit = async () => {
        if (!selectedAnimal) {
            toast.warn('اختر حيواناً');
            return;
        }

        if (sharesCount < 2) {
            toast.warn('عدد الأسهم يجب أن يكون 2 على الأقل');
            return;
        }

        if (sharesCount > 100) {
            toast.warn('عدد الأسهم يجب ألا يتجاوز 100');
            return;
        }

        setCreating(true);
        try {
            await axios.post(`/management/animals/${selectedAnimal.unique_id}/toggle-share-listing/`, {
                action: 'enable',
                max_shares: sharesCount
            });
            toast.success('تم إنشاء مجموعة المشاركة بنجاح');
            onSave();
            handleClose();
        } catch (error) {
            const errorMsg = error.response?.data?.detail || error.response?.data?.message || 'فشل إنشاء المجموعة';
            toast.error(errorMsg);
        } finally {
            setCreating(false);
        }
    };

    const filtered = candidates.filter(a =>
        a.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.category_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Modal show={show} onHide={handleClose} centered size="lg" onExited={() => {
            setSelectedAnimal(null);
            setSharesCount(5);
            setSearchTerm('');
        }}>
            <Modal.Header closeButton>
                <Modal.Title>بدء مجموعة مشاركة جديدة</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="mb-3">
                    <label className="form-label">ابحث عن حيوان:</label>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="اكتب كود الحيوان أو النوع..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="mb-3">
                    <h6 className="text-muted small fw-bold">اختر حيوان من المخزون:</h6>
                    {loading ? (
                        <div className="text-center py-3">
                            <Spinner size="sm" animation="border" />
                        </div>
                    ) : (
                        <div style={{ maxHeight: '250px', overflowY: 'auto' }} className="border rounded bg-light">
                            <Table hover size="sm" className="mb-0">
                                <thead className="table-light sticky-top">
                                    <tr>
                                        <th style={{ width: '50px' }}>اختيار</th>
                                        <th>الكود</th>
                                        <th>الفئة</th>
                                        <th>الوزن</th>
                                        <th>السعر الكامل</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.map(a => (
                                        <tr
                                            key={a.id}
                                            onClick={() => handleSelectAnimal(a)}
                                            className={selectedAnimal?.id === a.id ? 'table-primary' : ''}
                                            style={{ cursor: 'pointer' }}
                                        >
                                            <td className="text-center">
                                                <input
                                                    type="radio"
                                                    checked={selectedAnimal?.id === a.id}
                                                    onChange={() => {}}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelectAnimal(a);
                                                    }}
                                                    className="form-check-input"
                                                />
                                            </td>
                                            <td className="fw-bold">#{a.code}</td>
                                            <td>{a.category_name}</td>
                                            <td>{a.current_weight || 0} كجم</td>
                                            <td>{a.price_after_discount || a.price_egp} ج.م</td>
                                        </tr>
                                    ))}
                                    {filtered.length === 0 && (
                                        <tr>
                                            <td colSpan="5" className="text-center py-3 text-muted">
                                                لا توجد حيوانات متاحة للتشارك العام.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </Table>
                        </div>
                    )}
                </div>

                {selectedAnimal && (
                    <div className="mb-3 p-3 border rounded bg-white">
                        <h6 className="text-muted small fw-bold">إعدادات المجموعة:</h6>
                        <div className="row">
                            <div className="col-md-6">
                                <div className="mb-3">
                                    <label className="form-label">عدد الأسهم الكلي</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        min="2"
                                        max="100"
                                        value={sharesCount}
                                        onChange={(e) => setSharesCount(parseInt(e.target.value) || 5)}
                                    />
                                    <small className="text-muted">
                                        الافتراضي لهذه الفئة: <strong>{selectedAnimal.category?.default_max_shares || 5}</strong>
                                    </small>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="p-2 bg-info bg-opacity-10 rounded">
                                    <small className="d-block text-muted">سعر السهم الواحد:</small>
                                    <strong className="text-primary fs-5">
                                        {((selectedAnimal.price_after_discount || selectedAnimal.price_egp) / sharesCount).toFixed(2)} ج.م
                                    </strong>
                                    <br />
                                    <small className="text-muted">
                                        السعر الكامل: {selectedAnimal.price_after_discount || selectedAnimal.price_egp} ج.م
                                    </small>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose}>إلغاء</Button>
                <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={creating || !selectedAnimal}
                >
                    {creating ? (
                        <>
                            <Spinner size="sm" animation="border" className="me-2" />
                            جاري الإنشاء...
                        </>
                    ) : (
                        <>
                            <PlusCircle size={16} className="me-2" />
                            إنشاء وعرض في المتجر
                        </>
                    )}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const GroupDetailsModal = ({ show, handleClose, group }) => {
    const [buyers, setBuyers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show && group) {
            setLoading(true);
            const statuses = ['pending', 'confirmed', 'processing', 'ready_for_shipment', 'shipped', 'delivered', 'completed'];

            axios.get('/management/orders/', {
                params: { search: group.code }
            }).then(res => {
                const allOrders = res.data.results || res.data || [];
                const groupBuyers = [];

                allOrders.forEach(order => {
                    if (statuses.includes(order.status) && order.items) {
                        order.items.forEach(item => {
                            if (item.animal_code === group.code && item.listing_section === 'shares') {
                                groupBuyers.push({
                                    orderId: order.id,
                                    customer: order.user?.full_name || 'غير معروف',
                                    phone: order.user?.phone || 'غير متوفر',
                                    shares: item.share_quantity || 1,
                                    date: order.created_at,
                                    status: order.status
                                });
                            }
                        });
                    }
                });

                setBuyers(groupBuyers);
            }).catch(() => {
                toast.error('فشل في تحميل بيانات المشترين');
                setBuyers([]);
            }).finally(() => setLoading(false));
        }
    }, [show, group]);

    if (!group) return null;

    const maxShares = group.max_shares || 1;
    const remaining = group.remaining_shares || 0;
    const sold = maxShares - remaining;
    const progress = Math.round((sold / maxShares) * 100);
    const sharePrice = (group.price_egp / maxShares).toFixed(2);

    return (
        <Modal show={show} onHide={handleClose} centered size="lg">
            <Modal.Header closeButton>
                <Modal.Title>تفاصيل مجموعة المشاركة</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="mb-4">
                    <div className="row">
                        <div className="col-md-6">
                            <h6>الحيوان</h6>
                            <p className="fw-bold">#{group.code} - {group.category_name}</p>
                        </div>
                        <div className="col-md-6">
                            <h6>سعر السهم</h6>
                            <p className="fw-bold text-primary">{sharePrice} ج.م</p>
                        </div>
                    </div>

                    <div className="mb-3">
                        <div className="d-flex justify-content-between mb-2">
                            <span>التقدم:</span>
                            <strong>{sold} / {maxShares} سهم ({progress}%)</strong>
                        </div>
                        <div className="progress" style={{ height: '10px' }}>
                            <div
                                className="progress-bar bg-success"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                    </div>
                </div>

                <h6>سجل المشترين:</h6>
                {loading ? (
                    <div className="text-center py-3">
                        <Spinner size="sm" animation="border" />
                    </div>
                ) : buyers.length === 0 ? (
                    <div className="text-muted text-center py-3 border rounded bg-light">
                        <DollarSign size={32} className="mb-2 opacity-50" />
                        <p>لا يوجد مشترين حتى الآن.</p>
                    </div>
                ) : (
                    <div className="table-responsive">
                        <Table size="sm" hover responsive>
                            <thead>
                                <tr>
                                    <th>العميل</th>
                                    <th>الهاتف</th>
                                    <th>عدد الأسهم</th>
                                    <th>رقم الطلب</th>
                                    <th>الحالة</th>
                                </tr>
                            </thead>
                            <tbody>
                                {buyers.map((b, idx) => (
                                    <tr key={idx}>
                                        <td>{b.customer}</td>
                                        <td>{b.phone}</td>
                                        <td><Badge bg="info">{b.shares}</Badge></td>
                                        <td>#{b.orderId}</td>
                                        <td>
                                            <Badge bg={
                                                b.status === 'completed' ? 'success' :
                                                b.status === 'confirmed' ? 'primary' :
                                                b.status === 'pending' ? 'secondary' : 'warning'
                                            }>
                                                {b.status === 'completed' ? 'مكتمل' :
                                                 b.status === 'confirmed' ? 'مؤكد' :
                                                 b.status === 'pending' ? 'معلق' : 'قيد التجهيز'}
                                            </Badge>
                                        </td>
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

const SharedPurchases = () => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [processing, setProcessing] = useState({});

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const sharesRes = await axios.get('/livestock/shares/');
            const sharesData = sharesRes.data?.results || sharesRes.data || [];

            const shareGroupsData = Array.isArray(sharesData) ? sharesData.map(listing => {
                const animal = listing.animal_details || {};
                return {
                    id: listing.id,
                    listing_id: listing.id,
                    code: animal.code || 'N/A',
                    category_name: animal.category_name || 'غير محدد',
                    current_weight: animal.current_weight || 0,
                    price_egp: animal.price_egp || 0,
                    max_shares: listing.total_shares || 0,
                    remaining_shares: listing.available_shares || 0,
                    price_per_share: listing.price_per_share || 0,
                    is_active: listing.is_active,
                    animal_details: animal
                };
            }) : [];

            setGroups(shareGroupsData);
        } catch (error) {
            console.error('Error fetching share groups:', error);
            toast.error('حدث خطأ في تحميل مجموعات المشاركة');
            setGroups([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleRemoveFromShares = async (listingId) => {
        if (!listingId) return;

        const group = groups.find(g => g.id === listingId);
        if (!group) return;

        const sold = group.max_shares - group.remaining_shares;
        if (sold > 0) {
            toast.warn(`لا يمكن الإزالة: تم بيع ${sold} سهم من أصل ${group.max_shares}`);
            return;
        }

        if (!window.confirm('هل أنت متأكد من إزالة هذه المجموعة من التشارك العام؟')) return;

        setProcessing(prev => ({ ...prev, [`share_${listingId}`]: true }));
        try {
            const listingRes = await axios.get(`/livestock/shares/${listingId}/`);
            const animalId = listingRes.data?.animal_details?.unique_id;

            if (animalId) {
                await axios.post(`/management/animals/${animalId}/toggle-share-listing/`, {
                    action: 'disable'
                });
                toast.success('تمت إزالة المجموعة من التشارك العام');
                fetchData();
            }
        } catch (error) {
            const errorMsg = error.response?.data?.detail || 'فشل إزالة المجموعة';
            toast.error(errorMsg);
        } finally {
            setProcessing(prev => ({ ...prev, [`share_${listingId}`]: false }));
        }
    };

    const handleViewDetails = (group) => {
        setSelectedGroup(group);
        setShowDetailsModal(true);
    };

    return (
        <Container fluid className="py-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h1 className="h3 fw-bold mb-1">
                        <Users className="me-2 text-primary" size={28} />
                        إدارة مجموعات المشاركة
                    </h1>
                    <p className="text-muted mb-0">للعقيقة، الولائم، والشراء الجماعي</p>
                </div>
                <div className="d-flex gap-2">
                    <Button
                        variant="outline-primary"
                        onClick={fetchData}
                        disabled={loading}
                    >
                        <RefreshCw size={18} />
                    </Button>
                    <Button onClick={() => setShowCreateModal(true)}>
                        <PlusCircle size={18} className="me-2" /> مجموعة جديدة
                    </Button>
                </div>
            </div>

            <Card className="shadow-sm border-0">
                <Card.Body className="p-0">
                    <Table hover responsive className="mb-0 align-middle">
                        <thead className="bg-light">
                            <tr>
                                <th>الحيوان / الكود</th>
                                <th>الفئة</th>
                                <th>الوزن</th>
                                <th>حالة الأسهم</th>
                                <th>المباع / الكلي</th>
                                <th>سعر السهم</th>
                                <th>إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5">
                                        <Spinner animation="border" />
                                    </td>
                                </tr>
                            ) : groups.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-5 text-muted">
                                        لا توجد مجموعات نشطة في المتجر حالياً
                                    </td>
                                </tr>
                            ) : groups.map(group => {
                                const sold = group.max_shares - group.remaining_shares;
                                const progress = Math.round((sold / group.max_shares) * 100);
                                const pricePerShare = (group.price_egp / group.max_shares).toFixed(2);

                                return (
                                    <tr key={group.id}>
                                        <td className="fw-bold text-primary">
                                            #{group.code}
                                            <Button
                                                variant="link"
                                                size="sm"
                                                onClick={() => handleViewDetails(group)}
                                                className="p-0 ms-2"
                                            >
                                                <Eye size={14} className="text-info" />
                                            </Button>
                                        </td>
                                        <td>{group.category_name}</td>
                                        <td>{group.current_weight} كجم</td>
                                        <td style={{ width: '200px' }}>
                                            <div className="d-flex align-items-center">
                                                <div className="progress flex-grow-1 me-2" style={{ height: '8px' }}>
                                                    <div
                                                        className="progress-bar bg-success"
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                </div>
                                                <small className="text-muted">{progress}%</small>
                                            </div>
                                        </td>
                                        <td>
                                            <Badge bg={sold > 0 ? 'info' : 'secondary'}>
                                                {sold} / {group.max_shares}
                                            </Badge>
                                        </td>
                                        <td className="fw-bold">
                                            {pricePerShare} ج.م
                                        </td>
                                        <td>
                                            <Button
                                                variant="outline-danger"
                                                size="sm"
                                                onClick={() => handleRemoveFromShares(group.id)}
                                                disabled={processing[`share_${group.id}`] || sold > 0}
                                            >
                                                {processing[`share_${group.id}`] ? (
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
                </Card.Body>
            </Card>

            <AddToSharesModal
                show={showCreateModal}
                handleClose={() => setShowCreateModal(false)}
                onSave={fetchData}
            />

            {selectedGroup && (
                <GroupDetailsModal
                    show={showDetailsModal}
                    handleClose={() => setShowDetailsModal(false)}
                    group={selectedGroup}
                />
            )}
        </Container>
    );
};

export default SharedPurchases;
