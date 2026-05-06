
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import axios from "../services/axiosConfig";
import { toast } from "react-toastify";
import useAuth from '../context/auth/useAuth';
import { useApp } from '../context/app/useApp';
import {
    Home, CheckCircle, Users, AlertTriangle, ArrowRight, ArrowLeft, X,
    ZoomIn, Info, Activity, Scissors, ShoppingBag, Share2, PlayCircle, RefreshCw, ShieldCheck, Scale
} from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import { useTranslation } from 'react-i18next';
import Modal from '../components/ui/Modal';

const ImageModal = ({ imageUrl, onClose, onPrev, onNext, hasPrev, hasNext, isRtl, isVideo }) => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    return (
        <div className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-sm flex justify-center items-center p-4" onClick={onClose}>
            <button className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} text-white hover:text-gray-300 p-2 z-10`} onClick={onClose}>
                <X size={32} />
            </button>
            <div className="relative w-full max-w-4xl max-h-[90vh] flex justify-center items-center" onClick={(e) => e.stopPropagation()}>
                {hasPrev && (
                    <button className={`absolute ${isRtl ? 'right-2 md:-right-12' : 'left-2 md:-left-12'} p-2 text-white bg-black/50 hover:bg-black/80 rounded-full transition-all z-10`} onClick={onPrev}>
                        {isRtl ? <ArrowRight size={24} /> : <ArrowLeft size={24} />}
                    </button>
                )}
                {isVideo ? (
                    <video src={imageUrl} controls className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" autoPlay playsInline preload="metadata" />
                ) : (
                    <img src={imageUrl} alt="Zoomed" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" loading="lazy" />
                )}
                {hasNext && (
                    <button className={`absolute ${isRtl ? 'left-2 md:-left-12' : 'right-2 md:-right-12'} p-2 text-white bg-black/50 hover:bg-black/80 rounded-full transition-all z-10`} onClick={onNext}>
                        {isRtl ? <ArrowLeft size={24} /> : <ArrowRight size={24} />}
                    </button>
                )}
            </div>
        </div>
    );
};

const SmartDuplicateModal = ({ show, handleClose, onConfirmUpdate, oldData, newData, isUpdateMode }) => {
    const { t } = useTranslation();

    const formatValue = (key, val) => {
        if (val === true || val === 'yes') return <span className="text-green-600 font-bold">{t('common.yes')}</span>;
        if (val === false || val === 'no' || !val) return <span className="text-gray-400">{t('common.no')}</span>;
        if (key === 'payment_type') return val === 'full' ? t('product.full_payment') : t('product.deposit_payment');
        if (key === 'slaughter_option_type') return val === 'slaughtered' ? t('product.slaughtered') : t('product.live');
        return val;
    };

    const contextMap = {
        'general': t('animal_details.general_market'),
        'adahi': t('animal_details.full_sacrifice'),
        'adahi_pool': t('animal_details.public_pool'),
        'adahi_group': t('animal_details.private_group'),
        'shares': t('animal_details.regular_share')
    };

    const oldContextLabel = contextMap[oldData.context] || oldData.context;
    const newContextLabel = contextMap[newData.context] || newData.context;
    const isContextChanged = oldData.context && newData.context && oldData.context !== newData.context;

    const differences =[
        { label: t('services.slaughter') || 'خدمة الذبح', key: 'slaughter', old: oldData.services?.slaughter, new: newData.services?.slaughter },
        { label: t('services.cutting') || 'خدمة التقطيع', key: 'cutting', old: oldData.services?.cutting, new: newData.services?.cutting },
        { label: t('services.packaging') || 'خدمة التغليف', key: 'packaging', old: oldData.services?.packaging, new: newData.services?.packaging },
        { label: t('animal_details.shares'), key: 'share_quantity', old: oldData.share_quantity, new: newData.share_quantity },
        { label: t('product.payment_method') || 'نوع الدفع', key: 'payment_type', old: oldData.payment_type, new: newData.payment_type },
    ].filter(diff => String(diff.old) !== String(diff.new));

    const modalFooter = (
        <div className="flex w-full justify-between items-center gap-4">
            <button
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 transition-colors"
            >
                {t('animal_details.cancel_keep_old')}
            </button>
            <button
                onClick={onConfirmUpdate}
                className="px-6 py-2.5 rounded-xl font-bold text-white bg-primary hover:bg-primary-dark shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
                <RefreshCw size={18} />
                {t('animal_details.yes_update_cart')}
            </button>
        </div>
    );

    return (
        <Modal
            isOpen={show}
            onClose={handleClose}
            title={
                <div className="flex items-center gap-2 text-primary">
                    <RefreshCw size={24}/>
                    <span>{isUpdateMode ? t('animal_details.review_updates') : t('animal_details.update_options')}</span>
                </div>
            }
            footer={modalFooter}
            size="lg"
        >
            <div className="space-y-6">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-2xl text-sm border border-blue-100 flex items-start gap-3">
                    <Info className="shrink-0 mt-0.5" size={18} />
                    <div>
                        <strong>{t('common.note', 'تنبيه')}:</strong> {isUpdateMode ? t('animal_details.update_alert_edit') : t('animal_details.update_alert_exists')}
                    </div>
                </div>

                {isContextChanged && (
                    <div className="bg-orange-50 text-orange-800 p-4 rounded-2xl text-sm border border-orange-200 mb-4 animate-fade-in">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="shrink-0 mt-0.5 text-orange-600" size={20} />
                            <div>
                                <strong className="block mb-1 text-base">{t('animal_details.purchase_system_change')}</strong>
                                {t('animal_details.system_change_desc1')} <strong>({oldContextLabel})</strong>. {t('animal_details.system_change_desc2')} <strong>({newContextLabel})</strong>.
                            </div>
                        </div>
                    </div>
                )}

                {differences.length > 0 ? (
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <table className="w-full text-sm text-center border-collapse">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100">
                                    <th className="p-3 font-bold text-dark">{t('animal_details.modified_option')}</th>
                                    <th className="p-3 font-bold text-gray-500">{t('animal_details.in_cart_old')}</th>
                                    <th className="p-3 font-bold text-green-700 bg-green-50/30">{t('animal_details.current_new')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {differences.map((diff, idx) => (
                                    <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/30 transition-colors">
                                        <td className="p-3 font-bold text-dark">{diff.label}</td>
                                        <td className="p-3 text-gray-600 bg-gray-50/30">{formatValue(diff.key, diff.old)}</td>
                                        <td className="p-3 font-bold bg-green-50/20">{formatValue(diff.key, diff.new)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    !isContextChanged && (
                        <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                            {t('animal_details.no_major_changes')}
                        </div>
                    )
                )}
            </div>
        </Modal>
    );
};

function AnimalDetails() {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const { triggerRefetch, cartCount } = useApp();

    const locationState = location.state || {};
    const listing = locationState.listing || null;
    const itemToEdit = locationState.itemToEdit || null;

    const urlContext = searchParams.get('context');
    const urlCode = searchParams.get('code');
    const baseContext = itemToEdit?.selected_services?._order_context || locationState.context || urlContext || 'general';

    const isCreateGroupUrl = urlContext === 'create_adahi_group';
    const finalContext = isCreateGroupUrl ? 'adahi_group' : baseContext;

    const [context, setContext] = useState(finalContext);

    const initialIsPrivateGroup = locationState.isPrivateGroupJoin ||
        (finalContext === 'adahi_group' && urlCode) ||
        (finalContext === 'adahi_group' && itemToEdit && !itemToEdit.selected_services?.is_group_creator) ||
        false;

    const initialIsCreatingGroup = locationState.isCreatingGroup ||
        isCreateGroupUrl ||
        (finalContext === 'adahi_group' && itemToEdit && itemToEdit.selected_services?.is_group_creator) ||
        false;

    const isReadOnly = locationState.isReadOnly || false;

    const[isPrivateGroup, setIsPrivateGroup] = useState(initialIsPrivateGroup);
    const [isCreatingGroup, setIsCreatingGroup] = useState(initialIsCreatingGroup);

    const [opSettings, setOpSettings] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        params.set('context', isCreatingGroup ? 'create_adahi_group' : context);
        if (isPrivateGroup && (locationState.groupCode || urlCode)) {
            params.set('code', locationState.groupCode || urlCode);
        }
        window.history.replaceState(null, '', `?${params.toString()}`);
    }, [context, isCreatingGroup, isPrivateGroup, locationState.groupCode, urlCode, searchParams]);

    useEffect(() => {
        if (context === 'adahi_group' && !isCreatingGroup && !urlCode && !locationState.groupCode) {
            toast.warn(t('animal_details.cannot_enter_private_group_no_code'));
            navigate('/adahi', { replace: true });
        }
    },[context, isCreatingGroup, urlCode, locationState.groupCode, navigate, t]);

    const handleShare = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            toast.success(t('animal_details.link_copied_success'));
        } catch {
            toast.error(t('animal_details.link_copy_failed'));
        }
    };

    const isAdahiFull = context === 'adahi';
    const isAdahiPool = context === 'adahi_pool';
    const isShares = context === 'shares';

    const isAdahiContext = isAdahiFull || isAdahiPool || isPrivateGroup || isCreatingGroup || context === 'adahi_group';
    const treatAsShare = isAdahiPool || isShares || isPrivateGroup || isCreatingGroup || context === 'adahi_group';

    const[animal, setAnimal] = useState(listing?.animal_details || null);
    const [loading, setLoading] = useState(true);
    const [processingBooking, setProcessingBooking] = useState(false);
    const[slaughterOption, setSlaughterOption] = useState("");
    const [cutting, setCutting] = useState("");
    const [packaging, setPackaging] = useState("");
    const [butcherNotes, setButcherNotes] = useState("");
    const[selectedShares, setSelectedShares] = useState(() => {
        return itemToEdit?.share_quantity ? Number(itemToEdit.share_quantity) : 1;
    });
    const [groupCreatorShares, setGroupCreatorShares] = useState(() => {
        return itemToEdit?.share_quantity ? Number(itemToEdit.share_quantity) : 1;
    });
    const [clientServices, setClientServices] = useState([]);
    const[selectedClientServiceOptions, setSelectedClientServiceOptions] = useState({});
    const [paymentType, setPaymentType] = useState("");
    const [depositAmountInput, setDepositAmountInput] = useState("");
    const[minDepositRequired, setMinDepositRequired] = useState(0);
    const [adminMinDepositPercentage, setAdminMinDepositPercentage] = useState(0.20);
    const [deliverySettings, setDeliverySettings] = useState(null);
    const[validationErrors, setValidationErrors] = useState({});
    const [depositValidationError, setDepositValidationError] = useState("");
    const[suggestedAnimals, setSuggestedAnimals] = useState([]);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const[niyyahConfirmed, setNiyyahConfirmed] = useState(false);
    const [offalPreference, setOffalPreference] = useState('receive');
    const [priceDetails, setPriceDetails] = useState(null);
    const [servicePrices, setServicePrices] = useState({});
    const [existingCartItem, setExistingCartItem] = useState(null);
    const [showSmartModal, setShowSmartModal] = useState(false);
    const[pendingPayload, setPendingPayload] = useState(null);
    const [isUpdateMode, setIsUpdateMode] = useState(false);
    const [requestVideo, setRequestVideo] = useState(false);

    const[isContextValid, setIsContextValid] = useState(true);
    const [contextErrorMessage, setContextErrorMessage] = useState("");

    const pageMode = useMemo(() => {
        if (context === 'general' || isAdahiFull) return 'full_purchase';
        return 'share_purchase';
    },[context, isAdahiFull]);

    const showShareOptions = useMemo(() => {
        if (!animal) return false;
        if (pageMode === 'full_purchase') return false;
        return (animal.max_shares > 1) || (animal.category?.logic_type === 'cow' || animal.category?.logic_type === 'camel') || isPrivateGroup || isCreatingGroup;
    },[pageMode, animal, isPrivateGroup, isCreatingGroup]);

    const showNiyyah = isAdahiPool || isPrivateGroup || isCreatingGroup || context === 'adahi_group';

    const showShareSelector = useMemo(() => {
        if (isAdahiFull) return false;
        if (context === 'general') return false;
        return animal?.is_shareable || animal?.is_adahi_pool || isPrivateGroup || isCreatingGroup || context === 'adahi_group' || context === 'shares';
    },[context, animal, isPrivateGroup, isCreatingGroup, isAdahiFull]);

    const currentMaxShares = useMemo(() => {
        let relevantListing = listing;
        if (!relevantListing && animal?.listings && Array.isArray(animal.listings)) {
            let targetSection = 'full_sale';
            if (context === 'adahi_pool') targetSection = 'adahi_pool';
            if (context === 'adahi_group' || isPrivateGroup || isCreatingGroup) targetSection = 'adahi_group';
            if (context === 'shares') targetSection = 'shares';
            relevantListing = animal.listings.find(l => l.section === targetSection);
        }

        if (relevantListing && relevantListing.total_shares > 1) {
            return relevantListing.total_shares;
        }

        if (isAdahiPool || isPrivateGroup || isCreatingGroup || context === 'adahi_group') {
            if (animal?.category?.logic_type === 'cow' || animal?.category?.logic_type === 'camel') return 7;
            return 1;
        }

        return animal?.category?.default_max_shares || 1;
    },[animal, isAdahiPool, isPrivateGroup, isCreatingGroup, context, listing]);

    const displayRemaining = useMemo(() => {
        if (!animal) return 0;
        if (isCreatingGroup) return currentMaxShares;

        let shares = currentMaxShares;

        let relevantListing = listing;
        if (!relevantListing && animal.listings && Array.isArray(animal.listings)) {
            let targetSection = 'full_sale';
            if (context === 'adahi_pool') targetSection = 'adahi_pool';
            if (context === 'adahi_group' || isPrivateGroup) targetSection = 'adahi_group';
            if (context === 'shares') targetSection = 'shares';

            relevantListing = animal.listings.find(l => l.section === targetSection);
        }

        if (relevantListing && typeof relevantListing.available_shares === 'number') {
            shares = relevantListing.available_shares;
        } else if (!isPrivateGroup && context !== 'adahi_group' && typeof animal.remaining_shares === 'number') {
            shares = animal.remaining_shares;
        }

        return Math.max(0, Math.min(shares, currentMaxShares));
    }, [animal, listing, currentMaxShares, isCreatingGroup, isPrivateGroup, context]);

    const displaySold = useMemo(() => {
        return Math.max(0, currentMaxShares - displayRemaining);
    },[currentMaxShares, displayRemaining]);

    const populateFormWithItemData = useCallback((item, autoLoaded = false) => {
        if (!item) return;

        const isGuest = !item.id;

        const slaughterVal = item.slaughter_option_type || (item.selected_services?.slaughter ? 'slaughtered' : 'live');
        setSlaughterOption(slaughterVal);

        const isCutting = item.cutting_option === 'yes' || item.selected_services?.cutting === true || item.selected_services?.cutting === 'yes';
        const isPackaging = item.packaging_option === 'yes' || item.selected_services?.packaging === true || item.selected_services?.packaging === 'yes';
        setCutting(isCutting ? "yes" : "no");
        setPackaging(isPackaging ? "yes" : "no");

        setButcherNotes(item.butcher_notes || item.selected_services?.butcher_notes || "");

        let servicesObj = {};
        if (isGuest) {
            servicesObj = item.client_services || {};
        } else {
            const rawServices = item.selected_services || {};
            Object.keys(rawServices).forEach(key => {
                if (!key.startsWith('_') && !['slaughter', 'cutting', 'packaging', 'extra_parts_preference', 'is_group_creator', 'butcher_notes', 'payment_type', 'user_entered_deposit_amount', 'request_video'].includes(key)) {
                    servicesObj[key] = rawServices[key];
                }
            });
        }
        setSelectedClientServiceOptions(servicesObj);

        const pType = item.payment_type || item.selected_services?.payment_type || "";
        setPaymentType(pType);

        const dAmt = item.user_entered_deposit_amount || item.selected_services?.user_entered_deposit_amount;
        setDepositAmountInput(dAmt ? String(dAmt) : "");

        if (item.share_quantity) {
            setSelectedShares(Number(item.share_quantity));
            setGroupCreatorShares(Number(item.share_quantity));
        }

        if (item.extra_parts_preference || item.selected_services?.extra_parts_preference) {
            setOffalPreference(item.extra_parts_preference || item.selected_services?.extra_parts_preference);
        }

        const isGroupCreator = item.selected_services?.is_group_creator || false;
        setIsCreatingGroup(isGroupCreator);

        const ctx = item.selected_services?._order_context || 'general';
        setContext(ctx);
        setIsPrivateGroup(ctx === 'adahi_group' && !isGroupCreator);

        const reqVideo = item.selected_services?.request_video || item.request_video || false;
        setRequestVideo(reqVideo);

        setIsUpdateMode(true);
        setShowSmartModal(false);

        if (!autoLoaded) {
            toast.info(t('animal_details.cart_restored_edit'), { toastId: 'restore_cart_data_toast' });
        }
    }, [t]);

    const checkCartForAnimal = useCallback(async (currentAnimalId) => {
        let foundItem = null;

        if (user) {
            try {
                const res = await axios.get('/cart/');
                if (res.data?.items) {
                    foundItem = res.data.items.find(item => item.animal.id === currentAnimalId);
                }
            } catch (err) {
                console.error('Error fetching cart:', err);
            }
        } else {
            try {
                const guestCart = JSON.parse(localStorage.getItem('guestCart')) ||[];
                foundItem = guestCart.find(item => item.animal_id === currentAnimalId);
            } catch (err) {
                console.error('Error parsing guest cart:', err);
            }
        }

        if (foundItem) {
            setExistingCartItem(foundItem);
            const cartContext = foundItem.selected_services?._order_context || 'general';
            const currentRouteContext = locationState.context || 'general';
            if (!locationState.itemToEdit && cartContext === currentRouteContext) {
                populateFormWithItemData(foundItem, true);
                toast.info(t('animal_details.cart_options_restored'));
            }
        }
    },[user, locationState.itemToEdit, locationState.context, populateFormWithItemData, t]);

    useEffect(() => {
        if (loading || !animal || !opSettings || isReadOnly) return;

        let valid = true;
        let errMsg = "";

        if (context === 'shares' && opSettings.enable_general_shares === false) {
            valid = false; errMsg = t('animal_details.shares_service_stopped');
        } else if (context === 'adahi' && opSettings.enable_adahi_full === false) {
            valid = false; errMsg = t('animal_details.full_sacrifice_stopped');
        } else if (context === 'adahi_pool' && opSettings.enable_adahi_pool === false) {
            valid = false; errMsg = t('animal_details.pool_service_stopped');
        } else if ((context === 'adahi_group' || isCreatingGroup) && opSettings.enable_adahi_group === false) {
            valid = false; errMsg = t('animal_details.private_group_stopped');
        }

        if (valid && context !== 'general' && !isCreatingGroup) {
            let requiredSection = 'full_sale';
            if (context === 'adahi') requiredSection = 'adahi_full';
            else if (context === 'adahi_pool') requiredSection = 'adahi_pool';
            else if (context === 'adahi_group') requiredSection = 'adahi_group';
            else if (context === 'shares') requiredSection = 'shares';

            const hasActiveListing =
                (listing && listing.section === requiredSection && listing.is_active) ||
                animal.listings?.some(l => l.section === requiredSection && l.is_active);

            const hasGroupListing =
                (listing && listing.section === requiredSection) ||
                animal.listings?.some(l => l.section === requiredSection);

            if (context === 'adahi_group') {
                if (!hasGroupListing) {
                    valid = false; errMsg = t('animal_details.group_not_found_cancelled');
                }
            } else if (!hasActiveListing) {
                valid = false; errMsg = t('animal_details.animal_not_available_system');
            }
        }

        setIsContextValid(valid);
        setContextErrorMessage(errMsg);

    },[animal, listing, context, isCreatingGroup, opSettings, loading, isReadOnly, t]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);

                const promises =[
                    axios.get(`/livestock/animals/${id}/`),
                    axios.get(`/livestock/delivery-settings/`),
                    axios.get(`/livestock/client-services/`),
                    axios.get(`/livestock/service-prices/`),
                    axios.get(`/core/public-operation-settings/`)
                ];

                const results = await Promise.all(promises);

                const animalData = results[0].data;
                const settingsRes = results[1];
                const servicesRes = results[2];
                const pricesRes = results[3];
                const opRes = results[4];

                setAnimal(animalData);
                setDeliverySettings(settingsRes.data);
                if (settingsRes.data.min_deposit_percentage) {
                    setAdminMinDepositPercentage(Number(settingsRes.data.min_deposit_percentage));
                }

                setClientServices(servicesRes.data ||[]);

                const pricesMap = {};
                const pricesData = pricesRes.data.results || pricesRes.data ||[];
                pricesData.forEach(s => {
                    if (s.name && s.price) {
                        pricesMap[s.name] = parseFloat(s.price) || 0;
                    }
                });
                setServicePrices(pricesMap);

                setOpSettings(opRes.data);

                if (opRes.data?.allow_deposit_payment === false) {
                    setPaymentType('full');
                }

                if (itemToEdit) {
                    setExistingCartItem(itemToEdit);
                    populateFormWithItemData(itemToEdit, false);
                } else {
                    checkCartForAnimal(animalData.id);
                }

                const suggestedRes = await axios.get(`/livestock/animals/`, {
                    params: { limit: 4, has_discount: true, available: true }
                });
                const filteredSuggestions = (suggestedRes.data.results ||[]).filter(item => item.id !== animalData.id);
                setSuggestedAnimals(filteredSuggestions.slice(0, 4));

            } catch (err) {
                console.error("Error fetching animal data:", err);
                toast.error(t('errors.loading_error'));
                navigate('/livestock');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    },[id, itemToEdit, t, checkCartForAnimal, populateFormWithItemData, navigate]);

    useEffect(() => {
        if (!loading && animal && !isReadOnly) {
            if (isCreatingGroup) {
                const hasExistingGroup = animal.listings?.some(l => l.section === 'adahi_group' && l.is_active);
                if (animal.has_partial_sales || hasExistingGroup || animal.lock_type === 'private_group') {
                    toast.error(t('animal_details.cannot_create_group_sold'));
                    navigate('/adahi', { replace: true });
                }
            }
        }
    }, [loading, animal, isCreatingGroup, isReadOnly, navigate, t]);

    useEffect(() => {
        if (animal && treatAsShare) {
            setSlaughterOption('slaughtered');
        }
    }, [animal, treatAsShare]);

    useEffect(() => {
        if (!animal) return;

        const calculateLocalPrice = () => {
            if (isReadOnly && itemToEdit) {
                const historicServiceCost = parseFloat(itemToEdit.service_cost || 0);
                const historicPricePerItem = parseFloat(itemToEdit.price_per_item || 0);
                const historicDeposit = parseFloat(itemToEdit.deposit_per_item || 0);

                setPriceDetails({
                    final_price: historicPricePerItem + historicServiceCost,
                    service_cost: historicServiceCost,
                    animal_price: historicPricePerItem,
                    per_share: historicPricePerItem / (itemToEdit.share_quantity || 1)
                });
                setMinDepositRequired(historicDeposit);
                return;
            }

            let basePrice = listing ? parseFloat(listing.price) : 0;

            if (!basePrice || isNaN(basePrice)) {
                basePrice = parseFloat(animal.price_after_discount || animal.price_egp) || 0;
            }

            let currentShareCount = 1;
            let sharesToCalculate = selectedShares || 1;

            if (isCreatingGroup) {
                sharesToCalculate = groupCreatorShares || 1;
            }

            let perShare = basePrice;
            if (showShareOptions && currentMaxShares > 1) {
                const divisor = currentMaxShares > 0 ? currentMaxShares : 1;
                perShare = basePrice / divisor;
                currentShareCount = sharesToCalculate;
                basePrice = perShare * currentShareCount;
            }

            let servicesTotal = 0;
            const cat = animal?.category;

            if (slaughterOption === 'slaughtered' && cat?.enable_slaughter !== false) {
                servicesTotal += parseFloat(cat?.slaughter_price || 0);
            }
            if (cutting === 'yes' && cat?.enable_cutting !== false) {
                servicesTotal += parseFloat(cat?.cutting_price || 0);
            }
            if (packaging === 'yes' && cat?.enable_packaging !== false) {
                servicesTotal += parseFloat(cat?.packaging_price || 0);
            }

            const localPriceDetails = {
                final_price: basePrice + servicesTotal,
                service_cost: servicesTotal,
                animal_price: basePrice,
                per_share: perShare
            };

            const fixedAnimalDeposit = parseFloat(animal.deposit_egp || 0);
            let minDeposit = 0;

            if (fixedAnimalDeposit > 0) {
                let actualFixedDeposit = fixedAnimalDeposit;
                if (showShareOptions && currentMaxShares > 1) {
                    actualFixedDeposit = (fixedAnimalDeposit / currentMaxShares) * currentShareCount;
                }
                minDeposit = actualFixedDeposit + servicesTotal;
            } else {
                const depositPercent = (slaughterOption === 'slaughtered')
                    ? parseFloat(cat?.service_deposit_percentage || 0.5)
                    : parseFloat(cat?.min_deposit_percentage || 0.2);

                minDeposit = (basePrice * depositPercent) + servicesTotal;
            }

            setMinDepositRequired(parseFloat(minDeposit.toFixed(2)));
            setPriceDetails(localPriceDetails);
        };

        calculateLocalPrice();
    },[animal, listing, selectedShares, groupCreatorShares, slaughterOption, cutting, packaging, servicePrices, adminMinDepositPercentage, showShareOptions, deliverySettings, currentMaxShares, isCreatingGroup, isReadOnly, itemToEdit]);

    let isAvailable = false;
    let relevantListingForAvailability = listing;
    if (!relevantListingForAvailability && animal?.listings) {
        let targetSection = 'full_sale';
        if (context === 'adahi_pool') targetSection = 'adahi_pool';
        if (context === 'adahi_group' || isPrivateGroup || isCreatingGroup) targetSection = 'adahi_group';
        if (context === 'shares') targetSection = 'shares';
        relevantListingForAvailability = animal.listings.find(l => l.section === targetSection);
    }

    if (relevantListingForAvailability) {
        if (isPrivateGroup) {
            isAvailable = relevantListingForAvailability.available_shares > 0;
        } else {
            isAvailable = relevantListingForAvailability.is_active && relevantListingForAvailability.available_shares > 0;
        }
    } else {
        isAvailable = animal?.status === 'available';
    }

    const handleOptionChange = useCallback((type, value, serviceId = null) => {
        if (isReadOnly) return;

        setValidationErrors(prev => ({ ...prev, [type]: false }));
        setDepositValidationError("");

        const isForcedSlaughter = treatAsShare;

        if (isForcedSlaughter && type === 'slaughterOption' && value === 'live') {
            toast.warn(t('errors.cannot_cancel_slaughter') || t('animal_details.share_requires_slaughter'));
            return;
        }

        switch (type) {
            case 'slaughterOption': {
                setSlaughterOption(value);
                if (value === "live") {
                    setCutting("");
                    setPackaging("");
                    setButcherNotes("");
                }
                break;
            }
            case 'cutting': {
                setCutting(value);
                if (value === "no") setPackaging("no");
                break;
            }
            case 'packaging': {
                setPackaging(value);
                break;
            }
            case 'butcherNotes': {
                if (value.length <= 500) {
                    setButcherNotes(value);
                }
                break;
            }
            case 'paymentType': {
                setPaymentType(value);
                if (value === 'full') setDepositAmountInput("");
                break;
            }
            case 'depositAmountInput': {
                const sanitizedValue = value.replace(/[^\d.]/g, '');
                const dotsCount = (sanitizedValue.match(/\./g) ||[]).length;
                if (sanitizedValue.length <= 15 && dotsCount <= 1) {
                    setDepositAmountInput(sanitizedValue);
                }
                break;
            }
            case 'shareSelection': {
                const shares = Math.max(1, Math.min(displayRemaining, Number(value) || 1));
                setSelectedShares(shares);
                break;
            }
            case 'groupCreatorShares': {
                const maxAllowed = Math.max(1, currentMaxShares - 1);
                const shares = Math.max(1, Math.min(maxAllowed, Number(value) || 1));
                setGroupCreatorShares(shares);
                break;
            }
            case 'clientServiceOption': {
                setSelectedClientServiceOptions(prev => {
                    const newOptions = { ...prev };
                    if (newOptions[serviceId] === value) {
                        delete newOptions[serviceId];
                    } else {
                        newOptions[serviceId] = value;
                    }
                    return newOptions;
                });
                break;
            }
            case 'requestVideo': {
                setRequestVideo(value);
                break;
            }
            default:
                break;
        }
    },[treatAsShare, t, displayRemaining, currentMaxShares, isReadOnly]);

    const validateForm = () => {
        if (!animal) return false;

        if (animal.lock_type && animal.lock_type !== 'none' && animal.lock_type !== context) {
            toast.error(t('errors.animal_locked', { lock_type: animal.lock_type }));
            return false;
        }

        if (showNiyyah && !niyyahConfirmed) {
            toast.warn(t('errors.niyyah_confirmation_required'));
            return false;
        }

        let isValid = true;
        const errors = {};

        if (!slaughterOption) {
            errors.slaughterOption = true;
            isValid = false;
        }

        if (slaughterOption === "slaughtered" && opSettings?.cutting_active && !cutting) {
            errors.cutting = true;
            isValid = false;
        }
        if (cutting === "yes" && opSettings?.packaging_active && !packaging) {
            errors.packaging = true;
            isValid = false;
        }

        if (animal?.category?.allow_deposit !== false && !paymentType) {
            errors.paymentType = true;
            isValid = false;
        }

        if (paymentType === 'deposit' && animal?.category?.allow_deposit !== false) {
            const val = Number(depositAmountInput);
            const finalPrice = priceDetails?.final_price || 0;
            if (!val || val <= 0 || val < minDepositRequired || val > finalPrice) {
                isValid = false;
                setDepositValidationError(t('errors.invalid_deposit'));
            }
        }

        setValidationErrors(errors);
        if (!isValid) {
            toast.error(t('errors.complete_required_fields'));
            return false;
        }

        return true;
    };

    const preparePayload = () => {
        let sharesToSend = 1;

        if (isCreatingGroup) {
            sharesToSend = groupCreatorShares;
        } else if (showShareSelector) {
            sharesToSend = selectedShares;
        }

        let orderContext = context;
        if (isCreatingGroup) orderContext = 'adahi_group';
        else if (isAdahiFull && animal?.is_adahi_pool) orderContext = 'adahi_pool';

        const servicesPayload = {};
        Object.keys(selectedClientServiceOptions).forEach(serviceId => {
            const optionId = selectedClientServiceOptions[serviceId];
            servicesPayload[serviceId] = optionId;
        });

        let pipelineToUse = 'M';
        if (orderContext === 'shares') pipelineToUse = 'G';
        else if (['adahi_full', 'adahi_pool', 'adahi_group', 'adahi'].includes(orderContext)) pipelineToUse = 'S';
        else if (listing && listing.pipeline) pipelineToUse = listing.pipeline;

        return {
            share_quantity: sharesToSend,
            pipeline: pipelineToUse,
            selected_services: {
                ...servicesPayload,
                slaughter: slaughterOption === 'slaughtered',
                cutting: cutting === 'yes',
                packaging: packaging === 'yes',
                extra_parts_preference: offalPreference,
                butcher_notes: butcherNotes ? butcherNotes.slice(0, 500) : "",
                request_video: requestVideo,
                _order_context: orderContext,
                _page_mode: pageMode,
                _service_costs: {
                    slaughter: animal?.category?.slaughter_price || 0,
                    cutting: animal?.category?.cutting_price || 0,
                    packaging: animal?.category?.packaging_price || 0
                },
                is_group_creator: isCreatingGroup,
                payment_type: paymentType,
                user_entered_deposit_amount: Number(depositAmountInput) || 0,
            },
            slaughter_option_type: slaughterOption,
            cutting_option: cutting,
            packaging_option: packaging,
            butcher_notes: butcherNotes ? butcherNotes.slice(0, 500) : "",
            client_services: selectedClientServiceOptions,
            payment_type: paymentType,
            user_entered_deposit_amount: Number(depositAmountInput) || 0,
            extra_parts_preference: offalPreference,
            context: orderContext,
        };
    };

    const handleAddToCart = async () => {
        if (isReadOnly) return;

        if (!animal) {
            toast.error(t('errors.generic'));
            return;
        }

        if (!existingCartItem && cartCount >= 3) {
            toast.warn(t('animal_details.cart_full_limit_3'));
            return;
        }

        if (isCreatingGroup && !user) {
            toast.info(t('auth.login_required_group'));
            navigate("/login", {
                state: { from: location.pathname }
            });
            return;
        }

        if (!validateForm()) {
            return;
        }

        const newPayload = preparePayload();

        if (existingCartItem) {
            setPendingPayload(newPayload);
            setShowSmartModal(true);
        } else {
            await executeBooking(newPayload, false);
        }
    };

    const executeBooking = async (payloadData, isUpdate) => {
        setProcessingBooking(true);
        setShowSmartModal(false);

        try {
            if (user) {
                if (isUpdate && existingCartItem?.id) {
                    await axios.patch(`/cart/items/${existingCartItem.id}/`, {
                        share_quantity: payloadData.share_quantity,
                        selected_services: payloadData.selected_services,
                        pipeline: payloadData.pipeline
                    });
                    toast.success(t('animal_details.cart_options_updated'));
                } else {
                    await axios.post("/cart/items/", {
                        animal_id: animal.id,
                        pipeline: payloadData.pipeline,
                        share_quantity: payloadData.share_quantity,
                        selected_services: payloadData.selected_services
                    });
                    toast.success(t('cart.add_success'));
                }
            } else {
                let guestCart = JSON.parse(localStorage.getItem('guestCart')) ||[];

                const cartItemData = {
                    ...payloadData,
                    animal_id: animal.id,
                    pipeline: payloadData.pipeline,
                    animal_unique_id: animal.unique_id,
                    id: animal.id
                };

                if (isUpdate) {
                    const idx = guestCart.findIndex(item =>
                        item.animal_id === animal.id &&
                        item.pipeline === payloadData.pipeline
                    );
                    if (idx > -1) {
                        guestCart[idx] = cartItemData;
                        toast.success(t('animal_details.cart_updated'));
                    }
                } else {
                    if (guestCart.length >= 50) {
                        toast.error(t('cart.max_items_reached'));
                        setProcessingBooking(false);
                        return;
                    }
                    guestCart.push(cartItemData);
                    toast.success(t('cart.add_success'));
                }
                localStorage.setItem('guestCart', JSON.stringify(guestCart));
            }

            triggerRefetch();
            navigate('/cart');
        } catch (err) {
            console.error("Booking error:", err);
            if (err.response?.status === 409) {
                toast.error(t('errors.animal_already_in_cart'));
            } else {
                toast.error(err.response?.data?.detail || t('errors.operation_failed'));
            }
        } finally {
            setProcessingBooking(false);
        }
    };

    const isVideoFile = useCallback((url) => {
        if (!url) return false;
        const videoExtensions =['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];
        return videoExtensions.some(ext => url.toLowerCase().endsWith(ext));
    }, []);

    const allImages = useMemo(() => {
        if (!animal) return[];

        const main = {
            id: 'main',
            image: animal.image || '',
            is_video: false
        };

        const sortedGallery = (animal.images ||[]).sort((a, b) => (a.order || 0) - (b.order || 0));

        const gallery = sortedGallery.map(img => ({
            id: img.id,
            image: img.file || img.image || '',
            is_video: img.is_video || isVideoFile(img.file || img.image)
        }));

        return [main, ...gallery].filter(i => i.image);
    }, [animal, isVideoFile]);

    const activeImage = allImages[currentImageIndex];

    const handleImageError = useCallback((e) => {
        e.target.onerror = null;
        e.target.src = '/default-image.png';
    },[]);

    const displayPrice = useMemo(() => {
        if (!priceDetails) return '0';
        return priceDetails.final_price.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });
    }, [priceDetails]);

    const dropdownMaxShares = useMemo(() => {
        return Math.max(1, Math.floor(displayRemaining || 0), selectedShares);
    }, [displayRemaining, selectedShares]);

    const isButtonDisabled = processingBooking || (!isUpdateMode && !isAvailable) || isReadOnly;

    if (loading) return (
        <div className="flex justify-center items-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
        </div>
    );

    if (!animal) return (
        <div className="text-center py-20 text-xl font-bold text-muted">
            {t('product.not_available')}
        </div>
    );

    if (!isContextValid) {
        return (
            <div className="bg-secondary/20 min-h-screen pb-20 pt-10">
                <div className="container mx-auto px-4 max-w-lg mt-12">
                    <div className="bg-white rounded-3xl p-8 shadow-sm border border-red-100 text-center">
                        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4 text-red-500">
                            <AlertTriangle size={40} />
                        </div>
                        <h2 className="text-xl font-bold text-dark mb-2">{t('animal_details.cannot_view_animal')}</h2>
                        <p className="text-gray-500 mb-6 leading-relaxed">{contextErrorMessage}</p>
                        <button onClick={() => navigate('/livestock', { replace: true })} className="btn btn-primary px-8 mx-auto justify-center">
                            {t('animal_details.back_to_store')}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-secondary/20 min-h-screen pb-20">
            <div className="container mx-auto px-4 py-8">
                {isReadOnly && (
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-2xl mb-6 flex items-start gap-3 shadow-sm animate-fade-in-up">
                        <Info size={24} className="text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-blue-800 text-sm leading-relaxed">
                            <strong className="block text-base mb-1">{t('animal_details.readonly_mode')}</strong>
                            {t('animal_details.readonly_desc')}
                        </div>
                    </div>
                )}

                <div className="mb-6">
                    {context === 'adahi' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 items-start">
                            <CheckCircle className="text-emerald-600 flex-shrink-0 mt-1" size={20} />
                            <div className="text-sm text-emerald-800">
                                <strong>{t('animal_details.full_sacrifice_badge')}</strong> {t('animal_details.full_sacrifice_desc')}
                                <br/>
                                <span className="text-xs opacity-90">{t('animal_details.optional_slaughter_cutting')}</span>
                            </div>
                        </div>
                    )}

                    {(context === 'adahi_group' || isCreatingGroup || isPrivateGroup) && (
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 flex gap-3 items-start">
                            <Users className="text-purple-600 flex-shrink-0 mt-1" size={20} />
                            <div className="text-sm text-purple-800">
                                <strong>{t('animal_details.private_group_badge')}</strong> {t('animal_details.you_are')} {isCreatingGroup ? t('animal_details.creating') : t('animal_details.joining')} {t('animal_details.private_group_desc')}
                                <br/>
                                <strong>{t('animal_details.price_includes')}</strong> {t('animal_details.private_group_includes')}
                                {isPrivateGroup && <span className="d-block mt-1 fw-bold text-purple-900">{t('animal_details.joining_private_group_code')} {location.state?.groupCode})</span>}
                            </div>
                        </div>
                    )}

                    {context === 'adahi_pool' && !isCreatingGroup && !isPrivateGroup && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex gap-3 items-start">
                            <Users className="text-emerald-600 flex-shrink-0 mt-1" size={20} />
                            <div className="text-sm text-emerald-800">
                                <strong>{t('animal_details.adahi_pool_badge')}</strong> {t('animal_details.adahi_pool_desc')}
                                <br/>
                                <strong>{t('animal_details.price_includes')}</strong> {t('animal_details.adahi_pool_includes')}
                            </div>
                        </div>
                    )}

                    {context === 'shares' && (
                        <>
                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 items-start">
                                <Users className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                                <div className="text-sm text-blue-800">
                                    <strong>{t('animal_details.general_share_badge')}</strong> {t('animal_details.general_share_desc')}
                                    <br/>
                                    <strong>{t('animal_details.price_includes')}</strong> {t('animal_details.general_share_includes')}
                                </div>
                            </div>
                            {opSettings?.pricing_model === 'live_weight' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start mt-3 animate-pulse">
                                    <Scale className="text-amber-600 flex-shrink-0 mt-1" size={20} />
                                    <div className="text-sm text-amber-900">
                                        <strong>{t('animal_details.live_weight_alert')}</strong>
                                        {t('animal_details.live_weight_desc')}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Mobile Header (Above Images) */}
                <div className="block lg:hidden mb-4 animate-fade-in-up">
                    <div className="flex justify-between items-start">
                        <h1 className="text-2xl font-black text-dark mb-2 flex flex-wrap items-center gap-2">
                            {animal.category_name}
                            <span className="text-primary bg-primary/10 px-2 py-1 rounded-lg text-lg">
                                #{animal.code?.replace('#', '')}
                            </span>
                        </h1>
                        <button
                            onClick={handleShare}
                            className="bg-white hover:bg-gray-50 text-primary p-2 rounded-xl transition-colors shadow-sm border border-primary/20"
                            title={t('animal_details.copy_animal_link')}
                        >
                            <Share2 size={20} />
                        </button>
                    </div>

                    <div className="flex flex-wrap gap-2 text-sm text-dark mt-1">
                        {(animal.is_sacrifice_valid_now || animal.eid_prediction?.is_valid) && !animal.has_defect && (
                            <span className="bg-emerald-600 text-white text-xs font-bold px-2 py-1 rounded-lg shadow-sm flex items-center gap-1">
                                <ShieldCheck size={14} /> {t('animal_details.valid_sacrifice')}
                            </span>
                        )}
                        <span className={`flex items-center gap-1 px-2 py-1 rounded-lg border text-xs font-bold ${!animal.source_farm ? 'bg-green-50 border-green-200 text-green-700' : 'bg-blue-50 border-blue-200 text-blue-700'}`}>
                            {!animal.source_farm ? <Home size={14} /> : <CheckCircle size={14} />}
                            <span>{!animal.source_farm ? t('product.from_our_farms') : t('product.trusted_farms')}</span>
                        </span>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    <div className="lg:col-span-5 space-y-4">
                        <div className="relative group overflow-hidden rounded-3xl bg-white shadow-sm border border-gray-100 aspect-square">
                            {activeImage ? (
                                <>
                                    {activeImage.is_video ? (
                                        <video
                                            src={`${activeImage.image}#t=0.1`}
                                            controls
                                            className="w-full h-full object-cover"
                                            playsInline
                                            preload="metadata"
                                        >
                                            <source src={`${activeImage.image}#t=0.1`} type="video/mp4" />
                                            متصفحك لا يدعم الفيديو
                                        </video>
                                    ) : (
                                        <img
                                            src={activeImage.image}
                                            alt={animal.code}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 cursor-zoom-in"
                                            onClick={() => setIsModalOpen(true)}
                                            loading="lazy"
                                            onError={handleImageError}
                                        />
                                    )}
                                    {!activeImage.is_video && (
                                        <button
                                            onClick={() => setIsModalOpen(true)}
                                            className={`absolute bottom-4 ${isRtl ? 'right-4' : 'left-4'} bg-white/90 p-2 rounded-full shadow-md text-dark hover:text-primary transition-colors opacity-0 group-hover:opacity-100`}
                                            aria-label="Zoom image"
                                        >
                                            <ZoomIn size={20} />
                                        </button>
                                    )}
                                </>
                            ) : (
                                <div className="flex items-center justify-center h-full text-muted bg-gray-50">
                                    {t('common.no_image')}
                                </div>
                            )}

                            <div className={`absolute top-4 ${isRtl ? 'left-4' : 'right-4'} flex flex-col gap-2`}>
                                {animal.discount_percent > 0 && (
                                    <span className="bg-danger text-white px-3 py-1 rounded-full text-sm font-bold shadow-sm">
                                        {t('common.discount')} {Number(animal.discount_percent)}%
                                    </span>
                                )}

                                <span className={`backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold shadow-sm flex items-center gap-1 ${
                                    animal.source_farm
                                    ? "bg-white/90 text-blue-700"
                                    : "bg-green-100/90 text-green-800"
                                }`}>
                                    {animal.source_farm ? <CheckCircle size={14} /> : <Home size={14} />}
                                    {animal.source_farm ? t('product.trusted_farms') : t('product.from_our_farms')}
                                </span>
                            </div>
                        </div>

                        {allImages.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2">
                                {allImages.map((img, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentImageIndex(idx)}
                                        className={`flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${currentImageIndex === idx ? 'border-primary ring-2 ring-primary/20' : 'border-transparent opacity-70 hover:opacity-100'}`}
                                        aria-label={`View image ${idx + 1}`}
                                    >
                                        {img.is_video ? (
                                            <div className="w-full h-full relative">
                                                <video
                                                    src={`${img.image}#t=0.1`}
                                                    className="w-full h-full object-cover"
                                                    preload="metadata"
                                                    muted
                                                    playsInline
                                                />
                                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                                    <PlayCircle className="text-white w-8 h-8" />
                                                </div>
                                            </div>
                                        ) : (
                                            <img
                                                src={img.image}
                                                className="w-full h-full object-cover"
                                                alt={`thumbnail ${idx + 1}`}
                                                loading="lazy"
                                                onError={handleImageError}
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-7">
                        <div className="bg-white rounded-3xl p-5 lg:p-8 shadow-sm border border-gray-100 mb-6">

                            {/* Desktop Title - Hidden on Mobile */}
                            <div className="hidden lg:flex flex-row items-start justify-between gap-4 mb-4">
                                <div className="flex-1">
                                    <h1 className="text-3xl font-black text-dark mb-2 flex items-center gap-3">
                                        {animal.category_name}
                                        <span className="text-primary bg-primary/10 px-3 py-1 rounded-xl text-xl inline-block w-fit">
                                            #{animal.code?.replace('#', '')}
                                        </span>
                                        {(animal.is_sacrifice_valid_now || animal.eid_prediction?.is_valid) && !animal.has_defect && (
                                            <span className="bg-emerald-600 text-white text-sm font-bold px-3 py-1.5 rounded-xl shadow-sm flex items-center gap-1">
                                                <ShieldCheck size={18} />
                                                {t('animal_details.valid_sacrifice')}
                                            </span>
                                        )}
                                        <button
                                            onClick={handleShare}
                                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2 rounded-xl transition-colors flex items-center shadow-sm border border-primary/20 ms-2"
                                            title={t('animal_details.copy_animal_link')}
                                        >
                                            <Share2 size={20} />
                                        </button>
                                    </h1>
                                </div>
                            </div>

                            {/* Price Box & Badges */}
                            <div className="flex flex-col-reverse lg:flex-row justify-between items-start lg:items-center gap-6 mb-6 border-b border-gray-100 pb-6">

                                {/* Badges Grid */}
                                <div className="flex flex-wrap gap-2 text-sm text-dark w-full lg:w-auto">
                                    <span className={`hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-xl border font-bold ${!animal.source_farm ? 'bg-green-50 border-green-200 text-green-800' : 'bg-blue-50 border-blue-200 text-blue-800'}`}>
                                        {!animal.source_farm ? <Home size={16} /> : <CheckCircle size={16} />}
                                        <span>{!animal.source_farm ? t('product.from_our_farms') : t('product.trusted_farms')}</span>
                                    </span>

                                    {animal.current_weight && (
                                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                                            <span className="text-muted font-bold">{t('product.weight')}:</span>
                                            <span dir="ltr" className="font-bold text-dark">{animal.current_weight}</span> {t('common.kg')}
                                        </div>
                                    )}
                                    <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                                        <span className="text-muted font-bold">{t('product.age')}:</span>
                                        <span className="font-bold text-dark">{animal.age_months} {t('common.month')}</span>
                                    </span>
                                    {animal.sex && (
                                        <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                                            <span className="text-muted font-bold">{t('product.sex')}:</span>
                                            <span className="font-bold text-dark">{animal.sex === 'male' ? t('common.male') : t('common.female')}</span>
                                        </span>
                                    )}
                                    {animal.breed && (
                                        <span className="flex items-center gap-1.5 bg-gray-50 px-3 py-2 rounded-xl border border-gray-200">
                                            <span className="text-muted font-bold">{t('product.breed')}:</span>
                                            <span className="font-bold text-dark">{animal.breed}</span>
                                        </span>
                                    )}
                                    <span className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-bold ${animal.status === 'available' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                                        <Activity size={16} /> {t(`product.${animal.status}`)}
                                    </span>
                                </div>

                                {/* Price Display */}
                                <div className={`w-full lg:w-auto text-center lg:text-${isRtl ? 'left' : 'right'} bg-primary/5 p-4 rounded-2xl border border-primary/20 shadow-sm min-w-[200px]`}>
                                    <div className="text-primary font-bold mb-1 text-sm hidden lg:block">{t('animal_details.total_price')}</div>
                                    {animal.has_discount && (
                                        <div className="text-gray-400 line-through text-lg font-bold mb-1" dir="ltr">
                                            {Number(animal.price_egp).toLocaleString()}
                                        </div>
                                    )}
                                    <div className="text-3xl lg:text-4xl font-black text-primary flex items-baseline justify-center lg:justify-start gap-1" dir="ltr">
                                        {displayPrice}
                                        <span className="text-sm font-bold text-muted ms-1">
                                            {t('common.currency')}
                                        </span>
                                    </div>
                                    {showShareOptions && priceDetails?.per_share > 0 && (
                                        <div className="text-sm font-bold text-muted mt-2 bg-white px-2 py-1 rounded-lg inline-block border border-primary/10">
                                            ({priceDetails.per_share.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t('common.currency')} / {t('product.share')})
                                        </div>
                                    )}
                                </div>
                            </div>

                            {animal.description && (
                                <p className="mt-[-1rem] mb-6 text-gray-600 leading-relaxed text-sm md:text-base bg-gray-50 p-4 rounded-2xl border border-dashed border-gray-200">
                                    {animal.description}
                                </p>
                            )}

                            {animal.source_farm && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6 flex gap-3 items-start">
                                    <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-1" size={20} />
                                    <div className="text-sm text-yellow-800">
                                        <strong>{t('product.important_notice')}:</strong> {t('product.external_warning')}
                                    </div>
                                </div>
                            )}

                            {deliverySettings && opSettings?.pricing_model !== 'live_weight' && (
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex gap-3 items-start">
                                    <Info className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                                    <div className="text-sm text-blue-800">
                                        <strong>{t('animal_details.hotel_care_policy')}</strong> {t('animal_details.hotel_care_desc1')} <strong>({deliverySettings.free_care_days})</strong> {t('animal_details.hotel_care_desc2')} <strong>({animal.category?.daily_care_fee || 50} {t('common.currency')})</strong> {t('animal_details.hotel_care_desc3')}
                                    </div>
                                </div>
                            )}

                            {opSettings?.pricing_model === 'live_weight' && (
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start mb-6 animate-pulse">
                                    <Scale className="text-amber-600 flex-shrink-0 mt-1" size={20} />
                                    <div className="text-sm text-amber-900">
                                        <strong>{t('animal_details.live_weight_alert_title')}</strong><br/>
                                        <span className='mt-1 d-block'>{t('animal_details.live_weight_alert_desc')}</span>
                                    </div>
                                </div>
                            )}

                            {treatAsShare && !isCreatingGroup && (
                                <div className="mt-3 bg-gray-50 p-2 rounded-xl border border-gray-100">
                                    <div className="flex justify-between text-xs font-bold mb-1">
                                        <span className="text-gray-600">{t('adahi_page.group_status')}:</span>
                                        <span className="text-primary">
                                            {displaySold}/{currentMaxShares}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                        <div
                                            className={`h-2 rounded-full transition-all duration-500 ${isShares ? 'bg-blue-600' : 'bg-emerald-600'}`}
                                            style={{ width: `${Math.min(100, (displaySold / currentMaxShares) * 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            )}

                            {isCreatingGroup && animal.status === 'available' && (
                                <div className="bg-purple-50 border-2 border-purple-200 rounded-2xl p-5 mb-6">
                                    <div className="flex items-center gap-2 mb-3 text-purple-800">
                                        <Users size={24} />
                                        <h3 className="font-bold text-lg m-0">{t('animal_details.group_settings')}</h3>
                                    </div>

                                    <p className="text-sm text-purple-700 mb-4 leading-relaxed">
                                        {t('animal_details.group_settings_desc1')} <strong>{t('animal_details.group_settings_code')}</strong> {t('animal_details.group_settings_desc2')}
                                    </p>

                                    <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm">
                                        <label className="block text-sm font-bold text-dark mb-2">
                                            {t('animal_details.how_many_shares_yours')} {currentMaxShares})
                                        </label>

                                        <div className="flex items-center gap-3">
                                            <select
                                                className="form-select bg-gray-50 border-gray-200 rounded-xl px-4 py-2 font-bold text-dark focus:ring-2 focus:ring-purple-200 w-full md:w-1/2"
                                                value={groupCreatorShares}
                                                onChange={(e) => handleOptionChange('groupCreatorShares', e.target.value)}
                                                disabled={isReadOnly}
                                            >
                                                {[...Array(Math.max(0, currentMaxShares - 1)).keys()].map(i => (
                                                    <option key={i+1} value={i+1}>{i+1} {t('animal_details.shares')}</option>
                                                ))}
                                            </select>
                                            <div className="text-sm text-muted font-bold">
                                                {t('animal_details.remaining_for_invites')} <span className="text-purple-600">{currentMaxShares - groupCreatorShares} {t('animal_details.shares')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-start gap-2 text-xs text-purple-600 bg-purple-100/50 p-2 rounded-lg">
                                        <Info size={16} className="shrink-0 mt-0.5" />
                                        <span>
                                            {t('animal_details.deposit_deduction_note')} ({groupCreatorShares}).
                                        </span>
                                    </div>
                                </div>
                            )}

                            {(isAvailable || isUpdateMode || isReadOnly) ? (
                                <div className={`space-y-6 ${isReadOnly ? 'opacity-90' : ''}`}>
                                    {showShareSelector && !isCreatingGroup && (
                                        <div className="bg-primary/5 p-5 rounded-2xl border border-primary/20">
                                            <label className="text-primary font-bold mb-3 flex items-center gap-2">
                                                <Users size={18} /> {t('product.shares_requested')}
                                            </label>
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                <select
                                                    className="form-select bg-white border-primary/30 rounded-xl px-4 py-2 font-bold text-dark focus:ring-2 focus:ring-primary/20"
                                                    value={selectedShares}
                                                    onChange={(e) => handleOptionChange('shareSelection', e.target.value)}
                                                    disabled={isReadOnly}
                                                >
                                                    {[...Array(dropdownMaxShares).keys()].map(i => (
                                                        <option key={i+1} value={i+1}>{i+1} {t('product.share')}</option>
                                                    ))}
                                                </select>
                                                <span className="text-xs text-muted font-medium bg-white px-3 py-1 rounded-full border border-primary/10 w-fit">
                                                    {t('product.remaining')}: {displayRemaining} / {currentMaxShares}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {!treatAsShare ? (
                                        <div>
                                            <h3 className="text-base font-bold text-dark mb-3">{t('animal_details.select_animal_status', 'حالة الماشية المطلوبة')}</h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => handleOptionChange('slaughterOption', 'live')}
                                                    className={`py-3 rounded-xl border font-bold transition-all ${slaughterOption === 'live' ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                                    disabled={isReadOnly}
                                                >
                                                    {t('animal_details.receive_live')}
                                                </button>
                                                {animal?.category?.enable_slaughter !== false && (
                                                <button
                                                    onClick={() => handleOptionChange('slaughterOption', 'slaughtered')}
                                                    className={`py-3 rounded-xl border font-bold transition-all ${slaughterOption === 'single_slaughter' || slaughterOption === 'slaughtered' ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                                                    disabled={isReadOnly}
                                                >
                                                    {t('animal_details.slaughter_meat')}
                                                </button>
                                            )}
                                        </div>
                                        {validationErrors.slaughterOption && (
                                            <p className="text-red-500 text-xs mt-2 font-bold">{t('animal_details.select_animal_status')}</p>
                                        )}
                                    </div>
                                ) : (
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <h3 className="text-base font-bold text-dark mb-2 flex items-center gap-2">
                                            <Scissors size={18} /> {t('product.receiving_status')}
                                        </h3>
                                        <div className="flex items-center gap-2 text-emerald-600 font-bold mb-2">
                                            <CheckCircle size={16} />
                                            <span>{t('animal_details.mandatory_slaughter_share')} {animal?.category?.slaughter_price ? `(+${animal.category.slaughter_price} ${t('common.currency')})` : ''}</span>
                                        </div>
                                    </div>
                                )}

                                {slaughterOption === 'slaughtered' && (
                                    <div className="space-y-4 bg-gray-50 p-4 rounded-2xl border border-gray-100 mt-4">
                                        {animal?.category?.enable_cutting !== false && (
                                            <div>
                                                <h4 className="text-sm font-bold mb-2 text-dark">{t('services.cutting')}</h4>
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <button
                                                        onClick={() => handleOptionChange('cutting', 'no')}
                                                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${cutting === 'no' ? 'border-primary bg-white text-primary shadow-sm ring-1 ring-primary' : 'bg-transparent border-gray-300 text-gray-500'}`}
                                                        disabled={isReadOnly}
                                                    >
                                                        {t('product.slaughter_only')} {animal?.category?.slaughter_price ? `(+${parseFloat(animal.category.slaughter_price)} ${t('common.currency_symbol')})` : ''}
                                                    </button>
                                                    <button
                                                        onClick={() => handleOptionChange('cutting', 'yes')}
                                                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${cutting === 'yes' ? 'border-primary bg-white text-primary shadow-sm ring-1 ring-primary' : 'bg-transparent border-gray-300 text-gray-500'}`}
                                                        disabled={isReadOnly}
                                                    >
                                                        {t('product.slaughter_and_cutting')} {(parseFloat(animal?.category?.cutting_price || 0) + parseFloat(animal?.category?.slaughter_price || 0)) > 0 ? `(+${parseFloat(animal.category.cutting_price || 0) + parseFloat(animal.category.slaughter_price || 0)} ${t('common.currency_symbol')})` : ''}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {cutting === 'yes' && animal?.category?.enable_packaging !== false && (
                                            <div className="mt-4">
                                                <h4 className="text-sm font-bold mb-2 text-dark">{t('services.packaging')}</h4>
                                                <div className="flex flex-col sm:flex-row gap-3">
                                                    <button
                                                        onClick={() => handleOptionChange('packaging', 'no')}
                                                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${packaging === 'no' ? 'border-primary bg-white text-primary shadow-sm ring-1 ring-primary' : 'bg-transparent border-gray-300 text-gray-500'}`}
                                                        disabled={isReadOnly}
                                                    >
                                                        {t('common.no')}
                                                    </button>
                                                    <button
                                                        onClick={() => handleOptionChange('packaging', 'yes')}
                                                        className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${packaging === 'yes' ? 'border-primary bg-white text-primary shadow-sm ring-1 ring-primary' : 'bg-transparent border-gray-300 text-gray-500'}`}
                                                        disabled={isReadOnly}
                                                    >
                                                        {t('common.yes')} {parseFloat(animal?.category?.packaging_price || 0) > 0 ? `(+${parseFloat(animal.category.packaging_price)} ${t('common.currency_symbol')})` : ''}
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {opSettings?.enable_slaughter_video_request !== false && (
                                            <div className="pt-3 border-t border-gray-200 mt-3">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            id="request-video"
                                                            checked={requestVideo}
                                                            onChange={(e) => handleOptionChange('requestVideo', e.target.checked)}
                                                            disabled={isReadOnly}
                                                            className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                                                        />
                                                        <label htmlFor="request-video" className="text-sm font-bold text-dark flex items-center gap-2 cursor-pointer">
                                                            <span className="text-danger">🎥</span>
                                                            {t('animal_details.request_video')}
                                                        </label>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {clientServices.length > 0 && (
                                        <div className="border-t border-gray-100 pt-4">
                                            <h3 className="text-base font-bold text-dark mb-3">{t('product.additional_services')}</h3>
                                            <div className="space-y-3">
                                                {clientServices.slice(0, 5).map(service => (
                                                    <div key={service.id}>
                                                        <label className="text-sm text-muted mb-2 block">{service.question_text || service.name}</label>
                                                        <div className="flex flex-wrap gap-2">
                                                            {service.options.filter(o => o.is_active).slice(0, 4).map(option => (
                                                                <button
                                                                    key={option.id}
                                                                    onClick={() => handleOptionChange('clientServiceOption', option.id, service.id)}
                                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                                                                        selectedClientServiceOptions[service.id] === option.id
                                                                        ? 'border-accent bg-accent/10 text-dark ring-1 ring-accent'
                                                                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                                                    }`}
                                                                    disabled={isReadOnly}
                                                                >
                                                                    {option.option_text} {parseFloat(option.price) > 0 ? `(+${parseFloat(option.price)} ${t('common.currency')})` : ''}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {animal?.category?.allow_deposit !== false ? (
                                        <div className={`p-4 rounded-2xl border transition-all ${validationErrors.paymentType ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
                                            <h3 className="text-base font-bold text-dark mb-3">{t('product.payment_method')}</h3>
                                            <div className="space-y-3">
                                                <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-100">
                                                    <input
                                                        type="radio"
                                                        name="paymentType"
                                                        value="full"
                                                        checked={paymentType === "full"}
                                                        onChange={(e) => handleOptionChange('paymentType', e.target.value)}
                                                        className="accent-primary w-5 h-5"
                                                        disabled={isReadOnly}
                                                    />
                                                    <span className="font-bold text-dark">{t('product.full_payment')}</span>
                                                </label>

                                                <div>
                                                    <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-100">
                                                        <input
                                                            type="radio"
                                                            name="paymentType"
                                                            value="deposit"
                                                            checked={paymentType === "deposit"}
                                                            onChange={(e) => handleOptionChange('paymentType', e.target.value)}
                                                            className="accent-primary w-5 h-5"
                                                            disabled={isReadOnly}
                                                        />
                                                        <span className="font-bold text-dark">{t('product.deposit_payment')}</span>
                                                    </label>

                                                    {paymentType === "deposit" && (
                                                        <div className={`${isRtl ? 'mr-8' : 'ml-8'} mt-2`}>
                                                            <input
                                                                type="number"
                                                                className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                                placeholder={t('product.enter_deposit_amount')}
                                                                value={depositAmountInput}
                                                                onChange={(e) => handleOptionChange('depositAmountInput', e.target.value)}
                                                                min={minDepositRequired}
                                                                max={priceDetails?.final_price || 0}
                                                                step="0.01"
                                                                disabled={isReadOnly}
                                                            />
                                                            {minDepositRequired > 0 && (
                                                                <small className="text-xs text-muted mt-1 block">
                                                                    {t('product.min_deposit')}: {minDepositRequired.toFixed(2)} {t('common.currency_symbol')}
                                                                </small>
                                                            )}
                                                            <div className="bg-blue-50 text-blue-800 p-2 rounded-lg mt-2 text-[10px] md:text-xs flex items-start gap-1.5 border border-blue-100 animate-fade-in">
                                                                <Info size={14} className="shrink-0 mt-0.5" />
                                                                <span>
                                                                    <strong>توضيح مالي:</strong> الحد الأدنى للعربون يمثل (عربون الماشية + 100% من تكلفة الخدمات الإضافية).
                                                                    رسوم التجهيز تدفع مقدماً لضمان جدية التنفيذ.
                                                                </span>
                                                            </div>
                                                            {depositValidationError && (
                                                                <div className="text-xs text-red-500 mt-1 font-bold">
                                                                    {depositValidationError}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100">
                                            <div className="font-bold">{t('product.payment_method')}</div>
                                            <p className="text-sm mt-2">{t('animal_details.deposit_suspended')}</p>
                                        </div>
                                    )}

                                    {treatAsShare && (
                                        <div className="border rounded-xl p-4 bg-orange-50 border-orange-200">
                                            <h3 className="text-sm font-bold text-orange-900 mb-2 flex items-center gap-2">
                                                <Info size={16}/> {t('animal_details.extra_parts_fate')}
                                            </h3>

                                            {isAdahiContext ? (
                                                <div className="mb-3 text-xs text-orange-800">
                                                    <strong>{t('animal_details.important_note')}</strong> {t('animal_details.adahi_parts_dist')} <strong>{t('animal_details.sharia_lottery')}</strong> {t('animal_details.among_participants')} {currentMaxShares}{t('animal_details.cannot_sell_deduct')}
                                                </div>
                                            ) : (
                                                <div className="mb-3 text-xs text-blue-800">
                                                    <strong>{t('animal_details.general_share_badge').replace(':', '')}</strong> {t('animal_details.general_share_desc')}
                                                </div>
                                            )}

                                            <div className="space-y-2">
                                                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border hover:border-primary transition-all">
                                                    <input
                                                        type="radio"
                                                        name="offalPreference"
                                                        value="receive"
                                                        checked={offalPreference === 'receive'}
                                                        onChange={(e) => setOffalPreference(e.target.value)}
                                                        className="accent-primary"
                                                        disabled={isReadOnly}
                                                    />
                                                    <span className="text-sm font-bold">{t('animal_details.send_with_meat')}</span>
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border hover:border-primary transition-all">
                                                    <input
                                                        type="radio"
                                                        name="offalPreference"
                                                        value="donate"
                                                        checked={offalPreference === 'donate'}
                                                        onChange={(e) => setOffalPreference(e.target.value)}
                                                        className="accent-primary"
                                                        disabled={isReadOnly}
                                                    />
                                                    <span className="text-sm font-bold">{t('animal_details.donate_on_behalf')}</span>
                                                </label>

                                                {isShares && (
                                                    <label className="flex items-center gap-2 cursor-pointer bg-white p-2 rounded border border-green-200 hover:border-green-400 transition-all">
                                                        <input
                                                            type="radio"
                                                            name="offalPreference"
                                                            value="sell"
                                                            checked={offalPreference === 'sell'}
                                                            onChange={(e) => setOffalPreference(e.target.value)}
                                                            className="accent-green-600"
                                                            disabled={isReadOnly}
                                                        />
                                                        <span className="text-sm font-bold text-green-700">{t('animal_details.sell_my_share')}</span>
                                                    </label>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {showNiyyah && (
                                        <div className="mt-4">
                                            {isPrivateGroup && (
                                                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                                                    <h5 className="font-bold text-blue-800 text-sm mb-2 flex items-center gap-2">
                                                        <Info size={16}/> {t('animal_details.private_group_conditions')}
                                                    </h5>
                                                    <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                                                        <li>{t('animal_details.private_group_quota')} <strong>7 {t('animal_details.shares')}</strong> {t('animal_details.shares_count')}</li>
                                                        <li>{t('animal_details.private_group_booking_note')}</li>
                                                        <li>{t('animal_details.private_group_validity')} <strong>24 {t('animal_details.hours_to_complete')}</strong> {t('animal_details.to_complete_participants')}</li>
                                                        <li><strong>{t('animal_details.important_note')}</strong> {t('animal_details.private_group_timeout_note')}</li>
                                                    </ul>
                                                </div>
                                            )}

                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                                                <label className="flex items-start gap-3 cursor-pointer group">
                                                    <div className="relative flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={niyyahConfirmed}
                                                            onChange={(e) => setNiyyahConfirmed(e.target.checked)}
                                                            className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-emerald-400 transition-all checked:border-emerald-600 checked:bg-emerald-600"
                                                            disabled={isReadOnly}
                                                        />
                                                        <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                                                            <CheckCircle size={14} strokeWidth={4} />
                                                        </div>
                                                    </div>
                                                    <div className="text-sm text-emerald-900 leading-relaxed select-none">
                                                        <strong>{t('animal_details.niyyah_declaration')}</strong><br/>
                                                        {t('animal_details.niyyah_text')} <strong>{t('animal_details.niyyah_sacrifice')}</strong> {t('animal_details.niyyah_authorization')}
                                                        {isPrivateGroup && <span className="block mt-1 text-xs opacity-80">{t('animal_details.niyyah_timeout_agree')}</span>}
                                                    </div>
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    {isReadOnly ? (
                                        <div className="sticky bottom-0 bg-white/95 backdrop-blur-md p-4 -mx-5 lg:-mx-8 border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30 mt-8 text-center lg:rounded-b-3xl">
                                            <div className="bg-gray-100 text-gray-500 font-bold p-4 rounded-2xl border border-gray-200">
                                                {t('animal_details.readonly_cart_note')}
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 mt-6 mx-2 lg:mx-0 flex gap-3 items-start animate-fade-in">
                                                <Info className="text-blue-600 flex-shrink-0 mt-1" size={20} />
                                                <div className="text-sm text-blue-800 leading-relaxed">
                                                    <strong>{t('animal_details.purchase_policy_title')}</strong> {t('animal_details.purchase_policy_desc')}
                                                </div>
                                            </div>
                                            <div className="sticky bottom-0 bg-white/95 backdrop-blur-md p-4 -mx-5 lg:-mx-8 border-t border-gray-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30 mt-8 flex items-center justify-between gap-3 md:gap-4 lg:rounded-b-3xl">
                                                <div className="flex flex-col flex-shrink-0 ps-2 lg:ps-4">
                                                    <span className="text-xs text-gray-500 font-bold mb-0.5">{t('product.total')}</span>
                                                    <span className="text-lg md:text-xl font-black text-primary flex items-baseline gap-1" dir="ltr">
                                                        {displayPrice} <span className="text-[10px] md:text-xs font-bold text-gray-500">{t('common.currency')}</span>
                                                    </span>
                                                </div>
                                                <button
                                                    onClick={handleAddToCart}
                                                    disabled={isButtonDisabled}
                                                    className={`flex-grow py-3 px-4 rounded-2xl font-bold text-sm md:text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 ${
                                                        isUpdateMode ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-primary hover:bg-primary-dark text-white'
                                                    }`}
                                                >
                                                    {processingBooking ? (
                                                        <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                    ) : isUpdateMode ? (
                                                        <>
                                                            <RefreshCw size={20} /> {t('animal_details.update_in_cart')}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <ShoppingBag size={20} /> {t('product.add_to_cart')}
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center font-bold border border-red-100">
                                    {t('product.not_available_for_sale')}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {suggestedAnimals.length > 0 && (
                    <div className="mt-16 border-t border-gray-200 pt-10">
                        <h2 className="text-2xl font-bold text-dark mb-6 text-center">{t('product.you_may_also_like')}</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {suggestedAnimals.map(item => (
                                <ProductCard key={item.id} animal={item} />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {isModalOpen && activeImage && (
                <ImageModal
                    imageUrl={activeImage.image}
                    onClose={() => setIsModalOpen(false)}
                    onPrev={() => setCurrentImageIndex(i => (i - 1 + allImages.length) % allImages.length)}
                    onNext={() => setCurrentImageIndex(i => (i + 1) % allImages.length)}
                    hasPrev={allImages.length > 1}
                    hasNext={allImages.length > 1}
                    isRtl={isRtl}
                    isVideo={activeImage.is_video}
                />
            )}

            {existingCartItem && pendingPayload && (
                <SmartDuplicateModal
                    show={showSmartModal}
                    handleClose={() => setShowSmartModal(false)}
                    onConfirmUpdate={() => executeBooking(pendingPayload, true)}
                    isUpdateMode={isUpdateMode}
                    oldData={{
                        services: {
                            slaughter: existingCartItem.slaughter_option_type === 'slaughtered' || existingCartItem.selected_services?.slaughter,
                            cutting: existingCartItem.cutting_option === 'yes' || existingCartItem.selected_services?.cutting,
                            packaging: existingCartItem.packaging_option === 'yes' || existingCartItem.selected_services?.packaging
                        },
                        share_quantity: existingCartItem.share_quantity,
                        payment_type: existingCartItem.payment_type || existingCartItem.selected_services?.payment_type,
                        user_entered_deposit_amount: existingCartItem.user_entered_deposit_amount || existingCartItem.selected_services?.user_entered_deposit_amount,
                        context: existingCartItem.selected_services?._order_context
                    }}
                    newData={{
                        services: {
                            slaughter: pendingPayload.selected_services.slaughter,
                            cutting: pendingPayload.selected_services.cutting,
                            packaging: pendingPayload.selected_services.packaging
                        },
                        share_quantity: pendingPayload.share_quantity,
                        payment_type: pendingPayload.selected_services.payment_type,
                        user_entered_deposit_amount: pendingPayload.selected_services.user_entered_deposit_amount,
                        context: pendingPayload.selected_services._order_context
                    }}
                />
            )}
        </div>
    );
}

export default AnimalDetails;

