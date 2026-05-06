import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import axios from '../api/axiosConfig';
import { toast } from 'react-toastify';
import { Form, Button, Row, Col, Card, InputGroup, Spinner, Image, ListGroup, Badge, Alert, Modal, Container, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { User, Phone, Mail, PlusCircle, Search, DollarSign, Truck, Home, CreditCard, Trash2, AlertCircle, MapPin, Globe, BookOpen, Package, Lock, Unlock, Briefcase, Info, CheckCircle } from 'lucide-react';
import { useOnFarmSale } from '../hooks/useOnFarmSale';
import { format, addDays } from 'date-fns';
import useDebounce from '../hooks/useDebounce';
import PrintModal from '../components/ui/PrintModal';

const ShiftSummaryModal = ({ show, handleClose, summaryData, loading, isMobile }) => {
    return (
        <Modal show={show} onHide={handleClose} centered size={isMobile ? "md" : "lg"}>
            <Modal.Header closeButton className="border-bottom-0 pb-1">
                <Modal.Title className={isMobile ? "h6" : ""}>ملخص الوردية لليوم</Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                {loading ? (
                    <div className="text-center py-4">
                        <Spinner animation="border" size={isMobile ? "sm" : ""} />
                        <div className="mt-2 small">جاري تحميل الملخص...</div>
                    </div>
                ) : !summaryData ? (
                    <p className="text-center text-muted">لا توجد بيانات.</p>
                ) : (
                    <ListGroup variant="flush">
                        <ListGroup.Item className="d-flex justify-content-between align-items-center py-3">
                            <div>
                                <strong>إجمالي المبيعات</strong>
                                <div className="small text-muted">جميع المبيعات اليوم</div>
                            </div>
                            <span className="fw-bold text-primary h5 mb-0">
                                {(summaryData.total || 0).toFixed(2)} ج
                            </span>
                        </ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between align-items-center py-3">
                            <div>
                                <span className="text-success">المقبوضات النقدية</span>
                                <div className="small text-muted">كاش</div>
                            </div>
                            <span className="fw-bold">{(summaryData.cash || 0).toFixed(2)} ج</span>
                        </ListGroup.Item>
                        <ListGroup.Item className="d-flex justify-content-between align-items-center py-3">
                            <div>
                                <span className="text-primary">المقبوضات الإلكترونية</span>
                                <div className="small text-muted">فيزا/أونلاين</div>
                            </div>
                            <span className="fw-bold">{(summaryData.card || 0).toFixed(2)} ج</span>
                        </ListGroup.Item>
                    </ListGroup>
                )}
            </Modal.Body>
            <Modal.Footer className="border-top-0 pt-1">
                <Button variant="secondary" onClick={handleClose} size={isMobile ? "sm" : ""} className="w-100">
                    إغلاق
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const AddAddressModal = ({ show, handleClose, onSave, customerId, isMobile }) => {
    const [formData, setFormData] = useState({ governorate: '', city: '', street: '' });
    const [governorates, setGovernorates] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            axios.get('/core/governorates/')
                .then(res => {
                    if (res.data && Array.isArray(res.data)) {
                        setGovernorates(res.data);
                    }
                })
                .catch(() => toast.error('فشل تحميل المحافظات.'));
        }
    }, [show]);

    const handleChange = (e) => setFormData(p => ({ ...p, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (customerId) {
                const payload = { ...formData, user: customerId };
                const response = await axios.post('/management/customer-address/', payload);
                toast.success('تم إضافة العنوان بنجاح.');
                onSave(response.data);
            } else {
                onSave(formData);
                toast.info('تم حفظ العنوان مؤقتًا وسيتم إنشاؤه مع الطلب.');
            }
            handleClose();
        } catch (error) {
            console.error('Error adding address:', error.response?.data);
            toast.error(error.response?.data?.detail || 'فشل إضافة العنوان.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size={isMobile ? "md" : "lg"} fullscreen={isMobile ? "sm-down" : undefined}>
            <Modal.Header closeButton className="border-bottom-0 pb-1">
                <Modal.Title className={isMobile ? "h6" : ""}>إضافة عنوان جديد</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleSubmit}>
                <Modal.Body className="pt-0">
                    <Form.Group className="mb-3">
                        <Form.Label className={isMobile ? "small mb-1" : ""}>المحافظة</Form.Label>
                        <Form.Select name="governorate" value={formData.governorate} onChange={handleChange} required size={isMobile ? "sm" : ""}>
                            <option value="">اختر المحافظة...</option>
                            {governorates.map(g => (
                                <option key={g.id} value={g.name_ar}>{g.name_ar}</option>
                            ))}
                        </Form.Select>
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className={isMobile ? "small mb-1" : ""}>المدينة/المركز</Form.Label>
                        <Form.Control type="text" name="city" value={formData.city} onChange={handleChange} required size={isMobile ? "sm" : ""} placeholder="أدخل المدينة أو المركز" />
                    </Form.Group>
                    <Form.Group className="mb-3">
                        <Form.Label className={isMobile ? "small mb-1" : ""}>الشارع ورقم المنزل</Form.Label>
                        <Form.Control type="text" name="street" value={formData.street} onChange={handleChange} required size={isMobile ? "sm" : ""} placeholder="شارع، مبنى، شقة" />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="border-top-0 pt-1">
                    <Button variant="outline-secondary" onClick={handleClose} size={isMobile ? "sm" : ""} className="flex-fill">إلغاء</Button>
                    <Button variant="primary" type="submit" disabled={loading} size={isMobile ? "sm" : ""} className="flex-fill">
                        {loading ? (
                            <>
                                <Spinner size="sm" animation="border" className="me-2" />
                                جاري الحفظ...
                            </>
                        ) : 'حفظ'}
                    </Button>
                </Modal.Footer>
            </Form>
        </Modal>
    );
};

const SpecialRequestModal = ({ show, handleClose, onSave, customerInfo, initialSearch, isMobile }) => {
    const [specs, setSpecs] = useState({ category: '', weight: '', price: '' });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (show) {
            const isNumber = !isNaN(parseFloat(initialSearch)) && isFinite(initialSearch);
            setSpecs({
                category: '',
                weight: isNumber ? initialSearch : '',
                price: isNumber ? initialSearch : ''
            });
        }
    }, [show, initialSearch]);

    const handleChange = (e) => setSpecs(prev => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async () => {
        if (!specs.category && !specs.weight && !specs.price) {
            toast.warn('يرجى إدخال مواصفة واحدة على الأقل.');
            return;
        }
        setLoading(true);
        try {
            const payload = {
                customer_phone: customerInfo.customer_phone,
                customer_name: customerInfo.customer_name,
                requested_specs: {
                    "الفئة": specs.category,
                    "الوزن التقريبي": specs.weight,
                    "السعر التقريبي": specs.price
                }
            };
            const response = await axios.post('/management/special-requests/', payload);
            toast.success("تم إنشاء الطلب الخاص بنجاح.");
            onSave(response.data);
            handleClose();
        } catch (error) {
            toast.error(error.response?.data?.detail || "فشل إنشاء الطلب الخاص.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size={isMobile ? "md" : "lg"}>
            <Modal.Header closeButton className="border-bottom-0 pb-1">
                <Modal.Title className={isMobile ? "h6" : ""}>طلب ماشية غير متوفرة</Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0">
                <div className="mb-3">
                    <p className="mb-0">الطلب باسم العميل:</p>
                    <div className="d-flex align-items-center gap-2">
                        <User size={16} className="text-primary" />
                        <strong>{customerInfo.customer_name}</strong>
                    </div>
                </div>
                <Form.Group className="mb-3">
                    <Form.Label>الفئة المطلوبة</Form.Label>
                    <Form.Control type="text" name="category" value={specs.category} onChange={handleChange} placeholder="مثال: عجل بقري" />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>الوزن التقريبي (كجم)</Form.Label>
                    <Form.Control type="number" name="weight" value={specs.weight} onChange={handleChange} />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>السعر التقريبي (جنيه)</Form.Label>
                    <Form.Control type="number" name="price" value={specs.price} onChange={handleChange} />
                </Form.Group>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="outline-secondary" onClick={handleClose}>إلغاء</Button>
                <Button variant="primary" onClick={handleSubmit} disabled={loading}>
                    {loading ? 'جاري الإنشاء...' : 'إنشاء الطلب'}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

const PaymentLinkModal = ({ show, handleClose, paymentUrl, isMobile }) => {
    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(paymentUrl);
            toast.success("تم نسخ الرابط");
        } catch {
            toast.error("فشل نسخ الرابط");
        }
    };

    return (
        <Modal show={show} onHide={handleClose} centered size={isMobile ? "md" : "lg"}>
            <Modal.Header closeButton className="border-bottom-0 pb-1">
                <Modal.Title className={isMobile ? "h6" : ""}>رابط الدفع الإلكتروني</Modal.Title>
            </Modal.Header>
            <Modal.Body className="pt-0 text-center">
                <Alert variant="info">
                    <strong>تم إنشاء الطلب بنجاح</strong>
                    <p className="small mb-0 mt-1">الطلب معلق، يرجى إرسال هذا الرابط للعميل أو فتحه للدفع الآن</p>
                </Alert>
                <div className="d-grid gap-2">
                    <Button variant="primary" href={paymentUrl} target="_blank" rel="noopener noreferrer">
                        <Globe size={18} className="me-2" /> فتح صفحة الدفع
                    </Button>
                    <Button variant="outline-secondary" onClick={copyToClipboard}>
                        نسخ الرابط
                    </Button>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={handleClose} className="w-100">إغلاق</Button>
            </Modal.Footer>
        </Modal>
    );
};

const MobileAnimalCard = ({ animal, services, servicePrices, onRemove, onServiceChange, opSettings }) => {
    return (
        <Card className="mb-2 border shadow-sm">
            <Card.Body className="p-3">
                <div className="d-flex justify-content-between align-items-start mb-2">
                    <div className="d-flex align-items-center gap-2">
                        {animal.image && <Image src={animal.image} thumbnail style={{ width: '50px', height: '50px', objectFit: 'cover' }} />}
                        <div>
                            <h6 className="mb-0 fw-bold">{animal.code}</h6>
                            <div className="small">
                                <span className="me-2">الوزن: {animal.current_weight} كجم</span>
                                <span className="text-primary fw-bold">{animal.price_after_discount} ج</span>
                            </div>
                        </div>
                    </div>
                    <Button variant="link" className="text-danger p-0" onClick={() => onRemove(animal.id)}><Trash2 size={18} /></Button>
                </div>
                <div className="border-top pt-2">
                    <div className="d-flex flex-wrap gap-2 mb-2">
                        {animal?.category?.enable_slaughter !== false && (
                            <Form.Check type="switch" id={`s-${animal.id}`} name="slaughter" label={`ذبح (+${animal.category?.slaughter_price || 0} ج)`} checked={services[animal.id]?.slaughter || false} onChange={(e) => onServiceChange(animal.id, e)} className="flex-fill" />
                        )}
                        {animal?.category?.enable_cutting !== false && (
                            <Form.Check type="switch" id={`c-${animal.id}`} name="cutting" label={`تقطيع (+${animal.category?.cutting_price || 0} ج)`} checked={services[animal.id]?.cutting || false} onChange={(e) => onServiceChange(animal.id, e)} disabled={!services[animal.id]?.slaughter} className="flex-fill" />
                        )}
                        {animal?.category?.enable_packaging !== false && (
                            <Form.Check type="switch" id={`p-${animal.id}`} name="packaging" label={`تغليف (+${animal.category?.packaging_price || 0} ج)`} checked={services[animal.id]?.packaging || false} onChange={(e) => onServiceChange(animal.id, e)} disabled={!services[animal.id]?.cutting} className="flex-fill" />
                        )}
                    </div>
                </div>
            </Card.Body>
        </Card>
    );
};

function OnFarmSale() {
    const {
        selectedAnimals, setSelectedAnimals,
        customerInfo, setCustomerInfo,
        formData, setFormData,
        services, setServices,
        customerLocked, setCustomerLocked,
        resetSaleState
    } = useOnFarmSale();

    const [saleMode, setSaleMode] = useState('individual');
    const [b2bItems, setB2bItems] = useState([{ category_id: '', weight_range: '', quantity: 1, services: {} }]);
    const [categories, setCategories] = useState([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [onlyDiscounted, setOnlyDiscounted] = useState(false);
    const [onlyAdahi, setOnlyAdahi] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 992);
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    const [showSpecialRequestModal, setShowSpecialRequestModal] = useState(false);
    const [showPaymentLinkModal, setShowPaymentLinkModal] = useState(false);
    const [generatedPaymentUrl, setGeneratedPaymentUrl] = useState('');
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summaryData, setSummaryData] = useState(null);
    const [summaryLoading, setSummaryLoading] = useState(false);

    const [currentCustomer, setCurrentCustomer] = useState(null);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [customerNotes, setCustomerNotes] = useState(null);
    const [customerSuspended, setCustomerSuspended] = useState(null);

    const [showAddAddressModal, setShowAddAddressModal] = useState(false);
    const [isInstantPickup, setIsInstantPickup] = useState(true);
    const [newAddress, setNewAddress] = useState(null);
    const customerLookupTimeout = useRef(null);
    const searchDropdownRef = useRef(null);

    const [servicePrices, setServicePrices] = useState({});
    const [deliverySettings, setDeliverySettings] = useState(null);
    const [deliveryAreas, setDeliveryAreas] = useState([]);
    const [opSettings, setOpSettings] = useState({});
    const [submitting, setSubmitting] = useState(false);

    const [isNewCustomer, setIsNewCustomer] = useState(false);
    const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

    const [printConfig, setPrintConfig] = useState({ show: false, title: '', endpoint: '' });

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 992);
        window.addEventListener('resize', handleResize);

        const handleClickOutside = (event) => {
            if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target)) {
                setIsSearchFocused(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const getPhoneValidationMessage = (phone) => {
        if (!phone) return null;
        const digitsOnly = phone.replace(/\D/g, '');
        if (digitsOnly.startsWith('20')) {
            if (digitsOnly.length < 12) return `الرقم ناقص ${12 - digitsOnly.length} أرقام`;
            if (digitsOnly.length > 12) return `الرقم زائد ${digitsOnly.length - 12} أرقام`;
        } else if (digitsOnly.startsWith('01')) {
            if (digitsOnly.length < 11) return `الرقم ناقص ${11 - digitsOnly.length} أرقام`;
            if (digitsOnly.length > 11) return `الرقم زائد ${digitsOnly.length - 11} أرقام`;
        } else if (digitsOnly.length > 0) {
            return "يجب أن يبدأ الرقم بـ 01 أو مفتاح مصر 201";
        }
        return null;
    };
    const phoneValidationMsg = getPhoneValidationMessage(customerInfo.customer_phone);

    const totals = useMemo(() => {
        if (saleMode === 'b2b') {
            const b2bTotal = parseFloat(formData.quoted_total_price || 0);
            const b2bDeposit = parseFloat(formData.deposit_amount || 0);
            return {
                price: b2bTotal,
                minDeposit: b2bDeposit,
                remaining: b2bTotal - b2bDeposit,
                animalPriceSubtotal: b2bTotal,
                servicePriceSubtotal: 0,
                deliveryFee: 0,
                hasSlaughterService: false,
                selectedGov: '',
                isDeliverySupported: true
            };
        }

        let animalPriceSubtotal = 0;
        let servicePriceSubtotal = 0;
        let deliveryFee = 0;
        let baseFee = 0;
        let outExtraFee = 0;
                    let extraFee = outExtraFee;
        let hasSlaughterService = false;
        let selectedGov = '';
        let isDeliverySupported = true;

        const srvDepositPercent = parseFloat(deliverySettings?.service_deposit_percentage || 0.5);
        const minDepositPercent = parseFloat(deliverySettings?.min_deposit_percentage || 0.2);
        let totalMinDeposit = 0;

        if (formData.delivery_type === 'delivery') {
            if (formData.delivery_address_id === 'new_address' && newAddress) {
                selectedGov = newAddress.governorate;
            } else if (formData.delivery_address_id) {
                const addr = customerAddresses.find(a => String(a.id) === String(formData.delivery_address_id));
                if (addr) selectedGov = addr.governorate;
            }

            if (selectedGov) {
                const area = deliveryAreas.find(a => (a.governorate_name === selectedGov || a.governorate?.name_ar === selectedGov) && a.is_active);
                if (area) {
                    baseFee = parseFloat(area.delivery_price || 0);
                    extraFee = 0;

                    selectedAnimals.forEach(animal => {
                        const catExtraFee = parseFloat(animal.extra_delivery_fee || animal.category?.extra_delivery_fee || 0);
                        const animalServices = services[animal.id] || {};
                        const context = animalServices._order_context || 'general';
                        const isFullSale =['general', 'adahi', 'adahi_full'].includes(context);

                        if (isFullSale) {
                            extraFee += catExtraFee;
                        } else {
                            const maxShares = parseFloat(animal.default_max_shares || animal.category?.default_max_shares || animal.max_shares || 1);
                            extraFee += catExtraFee * (1 / maxShares);
                        }
                    });

                    deliveryFee = baseFee + extraFee;
                    isDeliverySupported = true;
                } else {
                    isDeliverySupported = false;
                }
            }
        }

        selectedAnimals.forEach(animal => {
            let animalPrice = parseFloat(animal.price_after_discount) || 0;
            animalPriceSubtotal += animalPrice;

            const animalServices = services[animal.id] || {};
            let itemServiceCost = 0;

            if (animalServices.slaughter && animal.category?.enable_slaughter !== false) {
                itemServiceCost += parseFloat(animal.category?.slaughter_price || 0);
                hasSlaughterService = true;
            }
            if (animalServices.cutting && animal.category?.enable_cutting !== false) {
                itemServiceCost += parseFloat(animal.category?.cutting_price || 0);
            }
            if (animalServices.packaging && animal.category?.enable_packaging !== false) {
                itemServiceCost += parseFloat(animal.category?.packaging_price || 0);
            }

            servicePriceSubtotal += itemServiceCost;

            const fixedDeposit = parseFloat(animal.deposit_egp || 0);
            let animalDepositAmount = 0;

            if (fixedDeposit > 0) {
                const context = animalServices._order_context || 'general';
                const isFullSale = ['general', 'adahi', 'adahi_full'].includes(context);

                if (isFullSale) {
                    animalDepositAmount = fixedDeposit;
                } else {
                    const maxShares = parseFloat(animal.category?.default_max_shares || 1);
                    animalDepositAmount = (fixedDeposit / maxShares) * 1;
                }
            } else {
                const cat = animal.category || animal;
                const srvPct = cat.service_deposit_percentage !== undefined && cat.service_deposit_percentage !== null
                    ? parseFloat(cat.service_deposit_percentage)
                    : srvDepositPercent;
                const minPct = cat.min_deposit_percentage !== undefined && cat.min_deposit_percentage !== null
                    ? parseFloat(cat.min_deposit_percentage)
                    : minDepositPercent;
                const pct = animalServices.slaughter ? srvPct : minPct;
                animalDepositAmount = animalPrice * pct;
            }

            totalMinDeposit += animalDepositAmount + itemServiceCost;
        });

        servicePriceSubtotal += deliveryFee;
        totalMinDeposit += deliveryFee;

        const totalPrice = animalPriceSubtotal + servicePriceSubtotal;
        const paidAmount = formData.payment_type === 'deposit' ? parseFloat(formData.deposit_amount || 0) : totalPrice;
        const remaining = parseFloat((totalPrice - paidAmount).toFixed(2));

        return {
            price: totalPrice,
            minDeposit: parseFloat(totalMinDeposit.toFixed(2)),
            remaining,
            animalPriceSubtotal,
            servicePriceSubtotal,
            deliveryFee,
            deliveryBaseFee: baseFee,
            deliveryExtraFee: extraFee,
            hasSlaughterService,
            selectedGov,
            isDeliverySupported
        };
    }, [selectedAnimals, services, servicePrices, deliverySettings, formData.payment_type, formData.deposit_amount, saleMode, formData.quoted_total_price, formData.delivery_type, formData.delivery_address_id, newAddress, customerAddresses, deliveryAreas]);

    const fetchSettings = useCallback(async () => {
        try {
            const [servicesRes, settingsRes, opSettingsRes, catRes, delAreasRes] = await Promise.all([
                axios.get('/management/service-prices/'),
                axios.get('/management/delivery-settings/'),
                axios.get('/management/operation-settings/'),
                axios.get('/livestock/categories/'),
                axios.get('/management/delivery-areas/')
            ]);

            const prices = {};
            if (servicesRes.data && Array.isArray(servicesRes.data.results)) {
                servicesRes.data.results.forEach(s => {
                    if (s.name && s.price) prices[s.name] = parseFloat(s.price);
                });
            }
            setServicePrices(prices);
            if (settingsRes.data) setDeliverySettings(settingsRes.data);
            if (opSettingsRes.data) {
                setOpSettings(opSettingsRes.data);

                if (opSettingsRes.data.enable_farm_pickup === false && opSettingsRes.data.enable_delivery_service !== false) {
                    setFormData(prev => ({ ...prev, delivery_type: 'delivery' }));
                } else if (opSettingsRes.data.enable_farm_pickup === false && opSettingsRes.data.enable_delivery_service === false) {
                    setFormData(prev => ({ ...prev, delivery_type: '' }));
                }
            }
            if (catRes.data) setCategories(catRes.data.results || catRes.data || []);
            if (delAreasRes.data) setDeliveryAreas(delAreasRes.data);
        } catch {
            toast.error("فشل تحميل الإعدادات الأساسية.");
        }
    }, [setFormData]);

    useEffect(() => {
        fetchSettings();
    }, [fetchSettings]);

    useEffect(() => {
        if (
            formData.delivery_type === 'delivery' ||
            totals.hasSlaughterService ||
            formData.payment_type === 'deposit' ||
            formData.payment_method === 'paymob'
        ) {
            setIsInstantPickup(false);
        }
    }, [formData.delivery_type, totals.hasSlaughterService, formData.payment_type, formData.payment_method]);

    useEffect(() => {
        const performSearch = async () => {
            if (!isSearchFocused) return;
            setSearchLoading(true);
            try {
                const params = { limit: 5, status: 'available' };
                if (debouncedSearchQuery.trim()) {
                    params.search = debouncedSearchQuery.trim();
                }
                if (onlyDiscounted) params.has_discount = 'true';

                let endpoint = `/livestock/market/`;
                if (onlyAdahi) {
                    endpoint = `/livestock/sacrifices/`;
                    params.section = 'adahi_full';
                }

                const res = await axios.get(endpoint, { params });
                if (res.data && Array.isArray(res.data.results)) {
                    setSearchResults(res.data.results || []);
                } else {
                    setSearchResults([]);
                }
            } catch (error) {
                console.error('Search error:', error);
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        };
        performSearch();
    }, [debouncedSearchQuery, onlyDiscounted, onlyAdahi, isSearchFocused]);

    const addAnimal = (listing) => {
        const animalToAdd = listing.animal_details;
        if (!animalToAdd || !animalToAdd.id) {
            toast.error("بيانات الحيوان غير متوفرة");
            return;
        }

        if (selectedAnimals.some(a => a.id === animalToAdd.id)) {
            toast.warn("هذا الحيوان موجود بالفعل في الطلب.");
            return;
        }

        const animalWithCorrectPrice = {
            ...animalToAdd,
            price_after_discount: listing.price || animalToAdd.price_after_discount,
        };

        setSelectedAnimals(prev => [...prev, animalWithCorrectPrice]);
        setServices(prev => ({
            ...prev,
            [animalToAdd.id]: { slaughter: false, cutting: false, packaging: false, butcher_notes: '' }
        }));

        setSearchQuery('');
        setIsSearchFocused(false);
        setSearchResults([]);
    };

    const removeAnimal = (animalId) => {
        setSelectedAnimals(prev => prev.filter(a => a.id !== animalId));
        setServices(prev => {
            const newServices = { ...prev };
            delete newServices[animalId];
            return newServices;
        });
    };

    const lookupCustomer = useCallback(async (phone, showToast = true) => {
        try {
            const response = await axios.get(`/management/customer-lookup/?phone=${phone}`);
            const customer = response.data;
            if (customer && customer.user_details) {
                setIsNewCustomer(false);
                setCurrentCustomer(customer.user_details);
                setCustomerInfo({
                    customer_name: customer.user_details.full_name,
                    customer_phone: phone,
                    customer_email: customer.user_details.email || '',
                    is_corporate: customer.user_details.is_corporate || false,
                    business_name: customer.user_details.business_name || ''
                });

                setSaleMode(prev => (prev === 'b2b' && customer.user_details.is_corporate) ? 'b2b' : 'individual');

                setCustomerAddresses(customer.addresses || []);
                setCustomerNotes(customer.user_details.notes);
                if (customer.user_details.is_suspended) {
                    setCustomerSuspended(customer.user_details.suspension_reason || 'الحساب موقوف لأسباب إدارية.');
                }
                if (showToast) toast.success(`عميل مسجل: ${customer.user_details.full_name}`);
            }
        } catch (err) {
            if (err.response?.status === 404 || err.response?.status === 400) {
                setIsNewCustomer(true);
                setCustomerInfo(prev => ({
                    ...prev,
                    customer_name: '',
                    customer_email: '',
                    is_corporate: false,
                    business_name: ''
                }));
                setSaleMode('individual');
                if (showToast) toast.info("رقم جديد، يرجى كتابة اسم العميل ليتم إنشاء حسابه.");
            }
            setCustomerNotes(null);
            setCustomerSuspended(null);
            setCustomerAddresses([]);
            setCurrentCustomer(null);
        }
    }, [setCustomerInfo, setCurrentCustomer, setCustomerAddresses, setCustomerNotes, setCustomerSuspended, setIsNewCustomer, setSaleMode]);

    const handleCustomerChange = (e) => {
        let { name, value } = e.target;

        if (name === 'customer_phone') {
            value = value.replace(/[^\d+]/g, '');

            if (currentCustomer) {
                setCustomerInfo(prev => ({
                    ...prev,
                    customer_phone: value,
                    customer_name: '',
                    customer_email: '',
                    is_corporate: false,
                    business_name: ''
                }));
                setSaleMode('individual');
            } else {
                setCustomerInfo(prev => ({ ...prev, [name]: value }));
            }

            clearTimeout(customerLookupTimeout.current);
            setCustomerNotes(null);
            setCustomerSuspended(null);
            setCustomerAddresses([]);
            setCurrentCustomer(null);
            setNewAddress(null);
            setIsNewCustomer(false);

            const digits = value.replace(/\D/g, '');
            const isComplete = (digits.startsWith('20') && digits.length === 12) || (!digits.startsWith('20') && digits.length === 11);

            if (isComplete) {
                customerLookupTimeout.current = setTimeout(() => {
                    lookupCustomer(value);
                }, 800);
            }
        } else {
            setCustomerInfo(prev => ({ ...prev, [name]: value }));
        }
    };

    useEffect(() => {
        if (customerLocked && customerInfo.customer_phone && !currentCustomer) {
            lookupCustomer(customerInfo.customer_phone, false);
        }
    },[customerLocked, customerInfo.customer_phone, currentCustomer, lookupCustomer]);

    const lockCustomer = async () => {
        if (!customerInfo.customer_phone || !customerInfo.customer_name) {
            toast.warn("يرجى إدخال اسم ورقم هاتف العميل للمتابعة.");
            return;
        }

        if (phoneValidationMsg) {
            toast.warn("يرجى التأكد من صحة واكتمال رقم الهاتف قبل المتابعة.");
            return;
        }

        if (isNewCustomer) {
            setIsCreatingCustomer(true);
            try {
                await axios.post('/management/customer-lookup/', {
                    phone: customerInfo.customer_phone,
                    full_name: customerInfo.customer_name,
                    email: customerInfo.customer_email || undefined,
                    is_corporate: false,
                    business_name: ''
                });
                toast.success("تم إنشاء حساب للعميل بنجاح.");
                setIsNewCustomer(false);
                await lookupCustomer(customerInfo.customer_phone, false);
                setCustomerLocked(true);
            } catch (err) {
                toast.error(err.response?.data?.detail || "فشل إنشاء حساب العميل.");
            } finally {
                setIsCreatingCustomer(false);
            }
        } else {
            setCustomerLocked(true);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'delivery_date' && value) {
            setIsInstantPickup(false);
        }
    };

    const handleServiceChange = (animalId, e) => {
        const { name, value, checked, type } = e.target;
        setServices(prev => {
            const animalServices = { ...prev[animalId], [name]: type === 'checkbox' ? checked : value };
            if (name === 'slaughter' && !checked) {
                animalServices.cutting = false;
                animalServices.packaging = false;
                animalServices.butcher_notes = '';
            }
            if (name === 'cutting' && !checked) {
                animalServices.packaging = false;
            }
            return { ...prev, [animalId]: animalServices };
        });
    };

    const handleAddressAdded = (addressData) => {
        if (addressData.id) {
            setCustomerAddresses(prev => [...prev, addressData]);
            setFormData(prev => ({ ...prev, delivery_address_id: addressData.id }));
        } else {
            setNewAddress(addressData);
            setFormData(prev => ({ ...prev, delivery_address_id: 'new_address' }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (saleMode === 'individual' && formData.delivery_type === 'delivery') {
            if (!formData.delivery_address_id && !newAddress) {
                toast.error("يرجى اختيار أو إضافة عنوان توصيل.");
                return;
            }

            let selectedGov = '';
            if (formData.delivery_address_id === 'new_address' && newAddress) {
                selectedGov = newAddress.governorate;
            } else {
                const addr = customerAddresses.find(a => String(a.id) === String(formData.delivery_address_id));
                if (addr) selectedGov = addr.governorate;
            }

            if (selectedGov && deliveryAreas.length > 0) {
                const isSupported = deliveryAreas.some(area =>
                    (area.governorate_name === selectedGov || area.governorate?.name_ar === selectedGov) && area.is_active
                );
                if (!isSupported) {
                    const supportedNames = deliveryAreas.filter(a => a.is_active).map(a => a.governorate_name || a.governorate?.name_ar).join('، ');
                    toast.error(`عذراً، خدمة التوصيل غير متاحة لمحافظة (${selectedGov}). المحافظات المدعومة: ${supportedNames}`);
                    return;
                }
            }
        }

        if (saleMode === 'b2b') {
            const totalQuantity = b2bItems.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
            if (totalQuantity < opSettings.min_business_order_quantity) {
                toast.error(`عفواً، الحد الأدنى لطلبات الشركات هو ${opSettings.min_business_order_quantity} رأس.`);
                return;
            }
            setSubmitting(true);
            try {
                const payload = {
                    request_details: b2bItems,
                    user_phone: customerInfo.customer_phone,
                    status: 'pending'
                };

                await axios.post('/orders/business-requests/', payload);
                toast.success("تم تسجيل طلب الشركات بنجاح! تم التوجيه لقائمة الانتظار.");
                resetSaleState();
                setB2bItems([{ category_id: '', weight_range: '', quantity: 1, services: {} }]);
            } catch (error) {
                toast.error(error.response?.data?.detail || "فشل تسجيل طلب الشركات.");
            } finally {
                setSubmitting(false);
            }
            return;
        }

        if (selectedAnimals.length === 0) {
            toast.error("يرجى اختيار حيوان واحد على الأقل.");
            return;
        }

        if (formData.delivery_type !== 'pickup' && !formData.delivery_date) {
            toast.error("يجب تحديد تاريخ التوصيل.");
            return;
        }
        if (formData.delivery_type === 'pickup' && !isInstantPickup && !formData.delivery_date) {
            toast.error("يجب تحديد تاريخ للاستلام أو اختيار 'استلام الآن'.");
            return;
        }
        if (!isInstantPickup && formData.delivery_date && formData.delivery_date < minDate) {
            toast.error(`تاريخ الاستلام/التوصيل يجب أن يكون ${minDate} أو بعده بناءً على أيام التحضير المطلوبة.`);
            return;
        }
        if (formData.payment_type === 'deposit') {
            const depositAmount = parseFloat(formData.deposit_amount || 0);
            if (depositAmount < totals.minDeposit) {
                toast.error(`المبلغ المدفوع كعربون أقل من الحد الأدنى المطلوب وهو ${totals.minDeposit.toFixed(2)} جنيه.`);
                return;
            }
        }

        setSubmitting(true);
        try {
            const payload = {
                ...customerInfo,
                ...formData,
                animal_items: selectedAnimals.map(animal => ({
                    animal_id: animal.id,
                    services: services[animal.id] || {},
                    share_quantity: 1
                }))
            };

            if (formData.delivery_address_id === 'new_address' && newAddress) {
                payload.new_address = newAddress;
                delete payload.delivery_address_id;
            } else {
                delete payload.new_address;
            }

            const response = await axios.post('/management/on-farm-sale/', payload);
            toast.success(response.data.detail || "تم تسجيل الطلب بنجاح");

            if (response.data.payment_url) {
                setGeneratedPaymentUrl(response.data.payment_url);
                setShowPaymentLinkModal(true);
            }

            const orderId = response.data.order_id;
            if (orderId) {
                const isPaidInFull = formData.payment_type === 'full';
                const isReceivingNow = formData.delivery_type === 'pickup' && isInstantPickup;

                if (isReceivingNow) {
                    setPrintConfig({ show: true, title: `فاتورة الطلب #${orderId}`, endpoint: `/orders/invoice/${orderId}/` });
                } else {
                    if (!isPaidInFull) {
                        setPrintConfig({ show: true, title: `إيصال عربون #${orderId}`, endpoint: `/orders/receipt/${orderId}/` });
                    } else {
                        setPrintConfig({ show: true, title: `فاتورة الطلب #${orderId}`, endpoint: `/orders/invoice/${orderId}/` });
                    }
                }
            }

            resetSaleState();
        } catch (error) {
            toast.error(error.response?.data?.detail || "فشل تسجيل الطلب.");
        } finally {
            setSubmitting(false);
        }
    };

    const prepDays = totals.hasSlaughterService
        ? (deliverySettings?.slaughter_preparation_days || deliverySettings?.preparation_days || 0)
        : (deliverySettings?.preparation_days || 0);

    const minDate = deliverySettings ? format(addDays(new Date(), prepDays), 'yyyy-MM-dd') : '';

    return (
        <Container fluid className={`on-farm-sale ${isMobile ? 'px-2' : 'px-3'}`}>
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2 mb-3">
                <div className="d-flex align-items-center">
                    <div className="bg-primary bg-opacity-10 p-2 rounded me-2">
                        <DollarSign size={isMobile ? 20 : 24} className="text-primary" />
                    </div>
                    <div>
                        <h1 className={`${isMobile ? 'h5' : 'h4'} mb-0 fw-bold`}>نقطة بيع مباشرة</h1>
                        <small className="text-muted">بيع مباشر من المزرعة</small>
                    </div>
                </div>

                <Button
                    variant="outline-info"
                    onClick={() => {
                        setShowSummaryModal(true);
                        setSummaryLoading(true);
                        axios.get('/management/shift-summary/')
                            .then(res => setSummaryData(res.data))
                            .catch(() => toast.error("فشل تحميل الملخص"))
                            .finally(() => setSummaryLoading(false));
                    }}
                    size={isMobile ? "sm" : ""}
                    className="d-flex align-items-center gap-2"
                >
                    <BookOpen size={16} />
                    {!isMobile && <span>ملخص الوردية</span>}
                </Button>
            </div>

            <Form onSubmit={handleSubmit}>
                <Row>
                    <Col lg={8} className="mb-4">
                        <Card className="shadow-sm border-0 mb-3">
                            <Card.Body className="p-2 p-md-3">
                                <h6 className="mb-3 d-flex align-items-center gap-2">
                                    <User size={18} />
                                    <span>1. بيانات العميل</span>
                                </h6>

                                <fieldset disabled={customerLocked}>
                                    <Row className="g-2">
                                        <Col xs={12} md={6}>
                                            <Form.Group className="mb-2">
                                                <Form.Label className={isMobile ? "small mb-1" : ""}>رقم الهاتف *</Form.Label>
                                                <InputGroup size={isMobile ? "sm" : ""}>
                                                    <InputGroup.Text className="bg-light"><Phone size={16} /></InputGroup.Text>
                                                    <Form.Control
                                                        type="tel" name="customer_phone" value={customerInfo.customer_phone}
                                                        onChange={handleCustomerChange} required placeholder="مثال: 01012345678" dir="ltr" className="text-end"
                                                    />
                                                </InputGroup>
                                                {phoneValidationMsg && !customerLocked && (
                                                    <Form.Text className="text-danger small fw-bold d-block mt-1">
                                                        {phoneValidationMsg}
                                                    </Form.Text>
                                                )}
                                            </Form.Group>
                                        </Col>
                                        <Col xs={12} md={6}>
                                            <Form.Group className="mb-2">
                                                <Form.Label className={isMobile ? "small mb-1" : ""}>اسم العميل *</Form.Label>
                                                <InputGroup size={isMobile ? "sm" : ""}>
                                                    <InputGroup.Text className="bg-light"><User size={16} /></InputGroup.Text>
                                                    <Form.Control
                                                        type="text" name="customer_name" value={customerInfo.customer_name}
                                                        onChange={handleCustomerChange} required placeholder="الاسم بالكامل"
                                                    />
                                                </InputGroup>
                                            </Form.Group>
                                        </Col>
                                    </Row>

                                    {isNewCustomer && (
                                        <Alert variant="warning" className="small p-2 mt-2 d-flex align-items-center gap-2">
                                            <AlertCircle size={16} className="flex-shrink-0" />
                                            <div>هذا الرقم غير مسجل. سيتم إنشاء حساب فردي جديد له عند التأكيد.</div>
                                        </Alert>
                                    )}

                                    {currentCustomer?.is_corporate && (
                                        <div className="mt-3 p-3 bg-primary bg-opacity-10 border border-primary rounded animate-fade-in">
                                            <h6 className="fw-bold text-primary mb-2">هذا العميل مسجل كشركة/نشاط تجاري ({currentCustomer.business_name})</h6>
                                            <p className="small text-muted mb-2">كيف تود معالجة هذا الطلب؟</p>
                                            <div className="d-flex gap-2">
                                                <Button
                                                    variant={saleMode === 'individual' ? 'primary' : 'outline-primary'}
                                                    size="sm"
                                                    onClick={() => setSaleMode('individual')}
                                                >
                                                    كعميل أفراد (شراء حيوانات محددة)
                                                </Button>
                                                <Button
                                                    variant={saleMode === 'b2b' ? 'primary' : 'outline-primary'}
                                                    size="sm"
                                                    onClick={() => setSaleMode('b2b')}
                                                >
                                                    كعميل أعمال (طلب كميات وأوزان - B2B)
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {customerSuspended && (
                                        <Alert variant="danger" className="small p-2 mt-2 d-flex align-items-start gap-2">
                                            <AlertCircle size={16} className="flex-shrink-0" />
                                            <div><strong>حساب موقوف:</strong> {customerSuspended}</div>
                                        </Alert>
                                    )}
                                    {customerNotes && (
                                        <Alert variant="info" className="small p-2 mt-2">
                                            <strong>ملاحظات:</strong> {customerNotes}
                                        </Alert>
                                    )}
                                </fieldset>

                                <div className="d-flex justify-content-center mt-3">
                                    {customerLocked ? (
                                        <Button variant="outline-danger" onClick={() => { setCustomerLocked(false); setSaleMode('individual'); }} size={isMobile ? "sm" : ""} className="d-flex align-items-center gap-2">
                                            <Unlock size={16} /> تغيير العميل
                                        </Button>
                                    ) : (
                                        <Button variant="success" onClick={lockCustomer} size={isMobile ? "sm" : ""} disabled={isCreatingCustomer} className="d-flex align-items-center gap-2">
                                            {isCreatingCustomer ? <Spinner size="sm" className="me-1" /> : <Lock size={16} />} تأكيد العميل والمتابعة
                                        </Button>
                                    )}
                                </div>
                            </Card.Body>
                        </Card>

                        <fieldset disabled={!customerLocked}>
                            {saleMode === 'b2b' ? (
                                <Card className="shadow-sm border-0 mb-3 animate-fade-in">
                                    <Card.Body className="p-2 p-md-3">
                                        <h6 className="mb-3 d-flex align-items-center gap-2 text-primary">
                                            <Briefcase size={18} />
                                            <span>2. طلب شركة (B2B) - اختيار الفئات والأوزان</span>
                                        </h6>

                                        {b2bItems.map((item, index) => (
                                            <div key={index} className="bg-light p-3 rounded mb-3 border position-relative">
                                                <Row className="g-2">
                                                    <Col md={4}>
                                                        <Form.Label className="small">الفئة</Form.Label>
                                                        <Form.Select size="sm" value={item.category_id} onChange={e => {
                                                            const newItems = [...b2bItems]; newItems[index].category_id = e.target.value; setB2bItems(newItems);
                                                        }} required>
                                                            <option value="">اختر الفئة...</option>
                                                            {categories.map(c => <option key={c.id} value={c.id}>{c.name_ar}</option>)}
                                                        </Form.Select>
                                                    </Col>
                                                    <Col md={4}>
                                                        <Form.Label className="small">الوزن (متوسط)</Form.Label>
                                                        <Form.Control size="sm" type="text" placeholder="مثال: 350-400 كجم" value={item.weight_range} onChange={e => {
                                                            const newItems = [...b2bItems]; newItems[index].weight_range = e.target.value; setB2bItems(newItems);
                                                        }} required />
                                                    </Col>
                                                    <Col md={4}>
                                                        <Form.Label className="small">العدد</Form.Label>
                                                        <Form.Control size="sm" type="number" min="1" value={item.quantity} onChange={e => {
                                                            const newItems = [...b2bItems]; newItems[index].quantity = e.target.value; setB2bItems(newItems);
                                                        }} required />
                                                    </Col>
                                                </Row>
                                                {b2bItems.length > 1 && (
                                                    <Button variant="link" className="text-danger position-absolute top-0 start-0 p-2" onClick={() => setB2bItems(b2bItems.filter((_, i) => i !== index))}>
                                                        <Trash2 size={16} />
                                                    </Button>
                                                )}
                                            </div>
                                        ))}

                                        <Button variant="outline-primary" size="sm" onClick={() => setB2bItems([...b2bItems, { category_id: '', weight_range: '', quantity: 1, services: {} }])}>
                                            <PlusCircle size={16} className="me-1" /> إضافة صنف آخر
                                        </Button>

                                        <div className="d-grid mt-4">
                                            <Button
                                                type="submit"
                                                disabled={submitting || !customerLocked}
                                                size={isMobile ? "lg" : ""}
                                                className="d-flex align-items-center justify-content-center gap-2 py-3"
                                            >
                                                {submitting ? <Spinner as="span" animation="border" size="sm" /> : <><PlusCircle size={20} /><span>تسجيل طلب الشركات (B2B)</span></>}
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            ) : (
                                <>
                                    <Card className="shadow-sm border-0 mb-3 animate-fade-in">
                                        <Card.Body className="p-2 p-md-3">
                                            <h6 className="mb-3 d-flex align-items-center gap-2">
                                                <Search size={18} />
                                                <span>2. إضافة حيوانات للطلب</span>
                                            </h6>

                                            <div className="mb-3" ref={searchDropdownRef}>
                                                <InputGroup>
                                                    <Form.Control
                                                        type="text"
                                                        value={searchQuery}
                                                        onChange={(e) => { setSearchQuery(e.target.value); setIsSearchFocused(true); }}
                                                        placeholder="ابحث بالكود، الفئة، الوزن (انقر لعرض المتاح)..."
                                                        size={isMobile ? "sm" : ""}
                                                        onFocus={() => setIsSearchFocused(true)}
                                                    />
                                                    {searchLoading && <InputGroup.Text><Spinner size="sm" /></InputGroup.Text>}
                                                </InputGroup>
                                                <div className="mt-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
                                                    <Form.Check
                                                        type="switch"
                                                        id="discounted-switch"
                                                        label="الحيوانات المخفضة فقط"
                                                        checked={onlyDiscounted}
                                                        onChange={(e) => setOnlyDiscounted(e.target.checked)}
                                                        className="small fw-bold"
                                                    />
                                                    <Form.Check
                                                        type="switch"
                                                        id="adahi-switch"
                                                        label="تصلح أضحية فقط"
                                                        checked={onlyAdahi}
                                                        onChange={(e) => setOnlyAdahi(e.target.checked)}
                                                        className="small fw-bold text-success"
                                                    />
                                                </div>
                                                {isSearchFocused && searchResults.length > 0 && (
                                                    <div className="position-relative">
                                                        <ListGroup className="position-absolute w-100 shadow" style={{ zIndex: 1000, maxHeight: '300px', overflowY: 'auto' }}>
                                                            {searchResults.map(listing => (
                                                                <ListGroup.Item action key={listing.id} onClick={() => addAnimal(listing)} className="d-flex justify-content-between align-items-center">
                                                                    <div>
                                                                        <strong>{listing.animal_details?.code || 'غير معروف'}</strong>
                                                                        <div className="small text-muted">{listing.animal_details?.category_name} - {listing.animal_details?.current_weight || 0} كجم</div>
                                                                    </div>
                                                                    <Badge bg="primary">{listing.price || 0} ج</Badge>
                                                                </ListGroup.Item>
                                                            ))}
                                                        </ListGroup>
                                                    </div>
                                                )}
                                                {isSearchFocused && searchQuery.length > 1 && !searchLoading && searchResults.length === 0 && (
                                                    <div className="text-center mt-3 p-3 border rounded bg-light">
                                                        <Search size={32} className="text-muted mb-2" />
                                                        <p className="mb-2">لم يتم العثور على نتائج</p>
                                                        <Button variant="link" onClick={() => setShowSpecialRequestModal(true)} className="small">هل تريد طلب ماشية غير متوفرة؟</Button>
                                                    </div>
                                                )}
                                            </div>
                                        </Card.Body>
                                    </Card>

                                    {selectedAnimals.length > 0 && (
                                        <Card className="shadow-sm border-0 animate-fade-in">
                                            <Card.Body className="p-2 p-md-3">
                                                <h6 className="mb-3 d-flex align-items-center gap-2">
                                                    <Package size={18} />
                                                    <span>3. الحيوانات والخدمات المختارة ({selectedAnimals.length})</span>
                                                </h6>

                                                {isMobile ? (
                                                    <div className="mobile-animals-list" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                                                        {selectedAnimals.map(animal => (
                                                            <MobileAnimalCard key={animal.id} animal={animal} services={services} servicePrices={servicePrices} onRemove={removeAnimal} onServiceChange={handleServiceChange} opSettings={opSettings} />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="desktop-animals-list">
                                                        {selectedAnimals.map(animal => (
                                                            <Card key={animal.id} className="mb-3 border bg-light">
                                                                <Card.Body>
                                                                    <Row className="align-items-center">
                                                                        <Col xs={2}>
                                                                            {animal.image && <Image src={animal.image} thumbnail fluid alt={animal.code} />}
                                                                        </Col>
                                                                        <Col>
                                                                            <div className="d-flex justify-content-between align-items-start">
                                                                                <div>
                                                                                    <strong>{animal.code} - {animal.category_name} {animal.has_discount && <Badge bg="danger" className="ms-2">خصم {Number(animal.discount_percent || 0)}%</Badge>}</strong>
                                                                                    <div className="text-muted small">الوزن: {animal.current_weight} كجم | السعر: {animal.has_discount ? <><span className="text-decoration-line-through me-1">{animal.price_egp}</span> <span className="text-success fw-bold">{animal.price_after_discount}</span></> : animal.price_egp} ج</div>
                                                                                </div>
                                                                                <Button variant="link" className="text-danger p-0" onClick={() => removeAnimal(animal.id)}>
                                                                                    <Trash2 size={18} />
                                                                                </Button>
                                                                            </div>
                                                                            <hr className="my-2" />
                                                                            <div className="row">
                                                                                {animal?.category?.enable_slaughter !== false && (
                                                                                    <div className="col-md-4">
                                                                                        <Form.Check type="switch" id={`s-${animal.id}`} name="slaughter" label={`ذبح (+${animal.category?.slaughter_price || 0} ج)`} checked={services[animal.id]?.slaughter || false} onChange={(e) => handleServiceChange(animal.id, e)} className="mb-2" />
                                                                                    </div>
                                                                                )}
                                                                                {animal?.category?.enable_cutting !== false && (
                                                                                    <div className="col-md-4">
                                                                                        <Form.Check type="switch" id={`c-${animal.id}`} name="cutting" label={`تقطيع (+${animal.category?.cutting_price || 0} ج)`} checked={services[animal.id]?.cutting || false} onChange={(e) => handleServiceChange(animal.id, e)} disabled={!services[animal.id]?.slaughter} className="mb-2" />
                                                                                    </div>
                                                                                )}
                                                                                {animal?.category?.enable_packaging !== false && (
                                                                                    <div className="col-md-4">
                                                                                        <Form.Check type="switch" id={`p-${animal.id}`} name="packaging" label={`تغليف (+${animal.category?.packaging_price || 0} ج)`} checked={services[animal.id]?.packaging || false} onChange={(e) => handleServiceChange(animal.id, e)} disabled={!services[animal.id]?.cutting} className="mb-2" />
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </Col>
                                                                    </Row>
                                                                </Card.Body>
                                                            </Card>
                                                        ))}
                                                    </div>
                                                )}
                                            </Card.Body>
                                        </Card>
                                    )}
                                </>
                            )}
                        </fieldset>
                    </Col>

                    {saleMode === 'individual' && (
                        <Col lg={4}>
                            <div className={isMobile ? "" : "sticky-top"} style={{ top: '20px' }}>
                                <Card className="shadow-sm border-0">
                                    <Card.Body className="p-2 p-md-3">
                                        <h6 className="mb-3 d-flex align-items-center gap-2">
                                            <CreditCard size={18} />
                                            <span>4. تفاصيل الدفع</span>
                                        </h6>

                                        <fieldset disabled={!customerLocked}>
                                            <Form.Group className="mb-3">
                                                <Form.Label className={isMobile ? "small mb-1" : ""}>البريد الإلكتروني</Form.Label>
                                                <InputGroup size={isMobile ? "sm" : ""}>
                                                    <InputGroup.Text className="bg-light"><Mail size={16} /></InputGroup.Text>
                                                    <Form.Control type="email" name="customer_email" value={customerInfo.customer_email} onChange={handleCustomerChange} placeholder="example@domain.com" />
                                                </InputGroup>
                                            </Form.Group>

                                            <Form.Group className="mb-3">
                                                <Form.Label className={isMobile ? "small mb-1" : ""}>طريقة الاستلام</Form.Label>
                                                <div className="d-flex gap-2 mb-2">
                                                    {opSettings?.enable_farm_pickup !== false && (
                                                        <Button
                                                            size={isMobile ? "sm" : "sm"}
                                                            variant={formData.delivery_type === 'pickup' ? 'primary' : 'outline-primary'}
                                                            onClick={() => handleChange({ target: { name: 'delivery_type', value: 'pickup' } })}
                                                            className="flex-fill d-flex align-items-center justify-content-center gap-1"
                                                        >
                                                            <Home size={14} /> استلام
                                                        </Button>
                                                    )}

                                                    {opSettings?.enable_delivery_service !== false && (
                                                        <Button
                                                            size={isMobile ? "sm" : "sm"}
                                                            variant={formData.delivery_type === 'delivery' ? 'primary' : 'outline-primary'}
                                                            onClick={() => handleChange({ target: { name: 'delivery_type', value: 'delivery' } })}
                                                            className="flex-fill d-flex align-items-center justify-content-center gap-1"
                                                        >
                                                            <Truck size={14} /> توصيل
                                                        </Button>
                                                    )}
                                                </div>

                                                {opSettings?.enable_farm_pickup === false && opSettings?.enable_delivery_service === false && (
                                                    <div className="text-danger small fw-bold mt-1 bg-danger bg-opacity-10 p-2 rounded">
                                                        ⚠️ جميع طرق الاستلام والتوصيل متوقفة حالياً من الإعدادات العامة.
                                                    </div>
                                                )}
                                            </Form.Group>

                                            {formData.delivery_type === 'delivery' && (
                                                <Form.Group className="mb-3">
                                                    <Form.Label className={isMobile ? "small mb-1" : ""}>عنوان التوصيل</Form.Label>
                                                    <InputGroup size={isMobile ? "sm" : ""}>
                                                        <InputGroup.Text className="bg-light"><MapPin size={16} /></InputGroup.Text>
                                                        <Form.Select name="delivery_address_id" value={formData.delivery_address_id || ''} onChange={handleChange} required>
                                                            <option value="">-- اختر أو أضف عنوان --</option>
                                                            {customerAddresses.map(addr => <option key={addr.id} value={addr.id}>{addr.street}، {addr.city} ({addr.governorate})</option>)}
                                                            {newAddress && <option value="new_address">{newAddress.street}، {newAddress.city} ({newAddress.governorate}) (جديد)</option>}
                                                        </Form.Select>
                                                        <Button variant="outline-secondary" onClick={() => setShowAddAddressModal(true)} disabled={!customerLocked}><PlusCircle size={16} /></Button>
                                                    </InputGroup>

                                                    {formData.delivery_address_id && !totals.isDeliverySupported && (
                                                        <div className="mt-2 p-2 bg-danger bg-opacity-10 border border-danger rounded text-danger small fw-bold d-flex align-items-center gap-2 animate-fade-in">
                                                            <AlertCircle size={16} className="flex-shrink-0" />
                                                            <span>لا يمكن التوصيل لمحافظة ({totals.selectedGov}) حالياً.</span>

                                                            <OverlayTrigger
                                                                placement="top"
                                                                trigger={['hover', 'focus', 'click']}
                                                                overlay={
                                                                    <Tooltip id="tooltip-supported-govs" className="font-sans">
                                                                        <strong>المحافظات المتاح التوصيل لها:</strong><br />
                                                                        {deliveryAreas.filter(a => a.is_active).map(a => a.governorate_name || a.governorate?.name_ar).join('، ')}
                                                                    </Tooltip>
                                                                }
                                                            >
                                                                <span style={{ cursor: 'pointer' }} className="d-flex align-items-center justify-content-center bg-white rounded-circle p-1 ms-auto shadow-sm">
                                                                    <Info size={16} className="text-info" />
                                                                </span>
                                                            </OverlayTrigger>
                                                        </div>
                                                    )}
                                                </Form.Group>
                                            )}

                                            <Form.Group className="mb-3">
                                                <Form.Label className={isMobile ? "small mb-1" : ""}>تاريخ الاستلام/التوصيل</Form.Label>
                                                {opSettings?.enable_eid_receive_button && opSettings?.eid_adha_date && (() => {
                                                    const eidDate = opSettings.eid_adha_date.substring(0, 10);
                                                    const isEidSelected = formData.delivery_date === eidDate;
                                                    return (
                                                        <Button
                                                            type="button"
                                                            variant={isEidSelected ? "success" : "outline-success"}
                                                            size="sm"
                                                            className="mb-2 w-100 d-flex align-items-center justify-content-center gap-2 fw-bold"
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                setFormData(prev => ({ ...prev, delivery_date: eidDate }));
                                                                setIsInstantPickup(false);
                                                            }}
                                                        >
                                                            🐑 استلام أيام عيد الأضحى المبارك
                                                            {isEidSelected && <CheckCircle size={16} />}
                                                        </Button>
                                                    );
                                                })()}
                                                <div className="d-flex flex-column gap-2">
                                                    <div className="d-flex gap-2 align-items-center">
                                                        <Form.Control
                                                            size={isMobile ? "sm" : "sm"}
                                                            type="date"
                                                            name="delivery_date"
                                                            value={formData.delivery_date || ''}
                                                            onChange={handleChange}
                                                            min={minDate}
                                                            required={!isInstantPickup}
                                                            disabled={isInstantPickup && formData.delivery_type === 'pickup'}
                                                        />
                                                        {formData.delivery_type === 'pickup' && (
                                                            <Form.Check
                                                                type="switch"
                                                                id="instant-pickup-switch"
                                                                label="استلام الآن"
                                                                checked={isInstantPickup}
                                                                onChange={(e) => {
                                                                    setIsInstantPickup(e.target.checked);
                                                                    if(e.target.checked) setFormData(prev => ({...prev, delivery_date: ''}));
                                                                }}
                                                                disabled={totals.hasSlaughterService || formData.payment_type === 'deposit' || formData.payment_method === 'paymob'}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            </Form.Group>

                                            <Form.Group className="mb-3">
                                                <Form.Label className={isMobile ? "small mb-1" : ""}>نوع الدفع</Form.Label>
                                                <div className="d-flex gap-2">
                                                    <Button size={isMobile ? "sm" : "sm"} variant={formData.payment_type === 'full' ? 'info' : 'outline-info'} onClick={() => handleChange({ target: { name: 'payment_type', value: 'full' } })} className="flex-fill">دفع كامل</Button>
                                                    {totals.minDeposit > 0 && (
                                                        <Button size={isMobile ? "sm" : "sm"} variant={formData.payment_type === 'deposit' ? 'info' : 'outline-info'} onClick={() => handleChange({ target: { name: 'payment_type', value: 'deposit' } })} className="flex-fill">عربون</Button>
                                                    )}
                                                </div>
                                            </Form.Group>

                                            {formData.payment_type === 'deposit' && (
                                                <Form.Group className="mb-3">
                                                    <Form.Label className={isMobile ? "small mb-1" : ""}>مبلغ العربون</Form.Label>
                                                    <Form.Control type="number" step="0.01" name="deposit_amount" value={formData.deposit_amount} onChange={handleChange} required size={isMobile ? "sm" : ""} min={totals.minDeposit} />
                                                    <Form.Text className="text-muted small">أقل عربون مطلوب: {totals.minDeposit.toFixed(2)}</Form.Text>
                                                </Form.Group>
                                            )}

                                            <Form.Group className="mb-3">
                                                <Form.Label className={isMobile ? "small mb-1" : ""}>طريقة الدفع</Form.Label>
                                                <div className="d-flex flex-wrap gap-2">
                                                    <Button size={isMobile ? "sm" : "sm"} variant={formData.payment_method === 'cash' ? 'success' : 'outline-success'} onClick={() => handleChange({ target: { name: 'payment_method', value: 'cash' } })} className="flex-fill d-flex align-items-center justify-content-center gap-1"><DollarSign size={14} /> كاش</Button>
                                                    <Button size={isMobile ? "sm" : "sm"} variant={formData.payment_method === 'card' ? 'success' : 'outline-success'} onClick={() => handleChange({ target: { name: 'payment_method', value: 'card' } })} className="flex-fill d-flex align-items-center justify-content-center gap-1"><CreditCard size={14} /> فيزا</Button>
                                                    <Button size={isMobile ? "sm" : "sm"} variant={formData.payment_method === 'paymob' ? 'success' : 'outline-success'} onClick={() => handleChange({ target: { name: 'payment_method', value: 'paymob' } })} className="flex-fill d-flex align-items-center justify-content-center gap-1"><Globe size={14} /> أونلاين</Button>
                                                </div>
                                            </Form.Group>
                                        </fieldset>

                                        <div className="bg-light border p-3 rounded mt-3">
                                            <h6 className="mb-2">الملخص المالي</h6>
                                            <div className="d-flex justify-content-between small mb-1"><span>سعر الماشية</span><span>{totals.animalPriceSubtotal.toFixed(2)} ج</span></div>
                                            <div className="d-flex justify-content-between small mb-1"><span>الخدمات (ذبح/تقطيع/تغليف)</span><span>{(totals.servicePriceSubtotal - totals.deliveryFee).toFixed(2)} ج</span></div>
                                            {formData.delivery_type === 'delivery' && totals.isDeliverySupported && (
                                                <div className="d-flex flex-column small mb-1 text-primary fw-bold">
                                                    <div className="d-flex justify-content-between">
                                                        <span>تكلفة التوصيل ({totals.selectedGov})</span>
                                                        <span>{totals.deliveryFee > 0 ? `${totals.deliveryFee.toFixed(2)} ج` : "مجانًا"}</span>
                                                    </div>
                                                    {totals.deliveryExtraFee > 0 && (
                                                        <span className="text-muted mt-1" style={{fontSize: "10px", fontWeight: "normal"}}>
                                                            (رسوم المحافظة: {totals.deliveryBaseFee.toFixed(2)} ج + رسوم الرؤوس: {totals.deliveryExtraFee.toFixed(2)} ج)
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <hr className="my-2" />
                                            <div className="d-flex justify-content-between fw-bold mb-2">
                                                <span>الإجمالي الكلي</span>
                                                <span>{totals.price.toFixed(2)} ج</span>
                                            </div>
                                            <hr className="my-2" />
                                            <div className="d-flex justify-content-between text-success mb-1">
                                                <span>المبلغ المدفوع الآن</span>
                                                <span>
                                                    {(formData.payment_method === 'paymob' ? 0.00 :
                                                        (formData.payment_type === 'full' ? totals.price :
                                                            parseFloat(formData.deposit_amount || 0))).toFixed(2)} ج
                                                </span>
                                            </div>
                                            <div className="d-flex justify-content-between text-danger">
                                                <span>المبلغ المتبقي</span>
                                                <span>{totals.remaining < 0 ? '0.00' : totals.remaining.toFixed(2)} ج</span>
                                            </div>
                                        </div>

                                        <div className="d-grid mt-3">
                                            <Button
                                                type="submit"
                                                disabled={
                                                    submitting ||
                                                    selectedAnimals.length === 0 ||
                                                    !customerLocked ||
                                                    (formData.delivery_type === 'delivery' && !totals.isDeliverySupported)
                                                }
                                                size={isMobile ? "lg" : ""}
                                                className="d-flex align-items-center justify-content-center gap-2 py-3"
                                            >
                                                {submitting ? <Spinner as="span" animation="border" size="sm" /> : <><PlusCircle size={20} /><span>تسجيل البيع</span></>}
                                            </Button>
                                        </div>
                                    </Card.Body>
                                </Card>
                            </div>
                        </Col>
                    )}
                </Row>
            </Form>

            <AddAddressModal show={showAddAddressModal} handleClose={() => setShowAddAddressModal(false)} onSave={handleAddressAdded} customerId={currentCustomer?.id} isMobile={isMobile} />
            <SpecialRequestModal show={showSpecialRequestModal} handleClose={() => setShowSpecialRequestModal(false)} onSave={() => { }} customerInfo={customerInfo} initialSearch={searchQuery} isMobile={isMobile} />
            <PaymentLinkModal show={showPaymentLinkModal} handleClose={() => setShowPaymentLinkModal(false)} paymentUrl={generatedPaymentUrl} isMobile={isMobile} />
            <ShiftSummaryModal show={showSummaryModal} handleClose={() => setShowSummaryModal(false)} summaryData={summaryData} loading={summaryLoading} isMobile={isMobile} />

            <PrintModal
                show={printConfig.show}
                handleClose={() => setPrintConfig({ show: false, title: '', endpoint: '' })}
                title={printConfig.title}
                endpoint={printConfig.endpoint}
            />

            <style>{`
                .on-farm-sale { max-width: 100%; overflow-x: hidden; }
                @media (max-width: 992px) {
                    .sticky-top { position: static !important; }
                }
            `}</style>
        </Container>
    );
}

export default OnFarmSale;

