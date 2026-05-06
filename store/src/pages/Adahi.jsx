import React, { useState, useEffect, useCallback } from 'react';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import {
    CheckCircle, ShieldCheck, HelpCircle, Users, Lock,
    Search, Filter, X, Info, Copy, CalendarOff, Beef, Share2
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import useAuth from '../context/auth/useAuth';
import ProductCard from '../components/ui/ProductCard';

const Adahi = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const { user } = useAuth();
    const navigate = useNavigate();

    const[isSeasonActive, setIsSeasonActive] = useState(true);
    const [settingsLoading, setSettingsLoading] = useState(true);
    const [opSettings, setOpSettings] = useState(null);
    const [activeTab, setActiveTab] = useState('full');
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showFilters, setShowFilters] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState('');
    const [fullListings, setFullListings] = useState([]);
    const [poolListings, setPoolListings] = useState([]);
    const[privateCandidates, setPrivateCandidates] = useState([]);
    const [categories, setCategories] = useState([]);
    const[groupCode, setGroupCode] = useState('');
    const [joiningGroup, setJoiningGroup] = useState(false);
    const [myActiveGroup, setMyActiveGroup] = useState(null);
    const[invitePhone, setInvitePhone] = useState('');
    const [inviting, setInviting] = useState(false);
    const [copyingCode, setCopyingCode] = useState(false);

    useEffect(() => {
        const checkSettings = async () => {
            try {
                const res = await axios.get("/core/public-operation-settings/");
                const settings = res.data;
                setIsSeasonActive(settings.is_adahi_season_active || false);
                setOpSettings(settings);

                if (settings.enable_adahi_full !== false) {
                    setActiveTab('full');
                } else if (settings.enable_adahi_pool !== false) {
                    setActiveTab('pool');
                } else if (settings.enable_adahi_group !== false) {
                    setActiveTab('private');
                }
            } catch (error) {
                console.error('Failed to load settings:', error);
                toast.error(t('errors.loading_error'));
            } finally {
                setSettingsLoading(false);
            }
        };
        checkSettings();
    }, [t]);

    const fetchAdahiData = useCallback(async () => {
        if (!isSeasonActive) return;
        setLoading(true);
        try {
            const [sacrificesRes, privateRes, categoriesRes] = await Promise.all([
                axios.get('/livestock/sacrifices/'),
                axios.get('/livestock/animals/available-for-private-groups/'),
                axios.get("/livestock/categories/")
            ]);

            const allListings = sacrificesRes.data.results ||[];

            setFullListings(allListings.filter(l => l.section === 'adahi_full'));
            setPoolListings(allListings.filter(l => l.section === 'adahi_pool'));
            setPrivateCandidates(privateRes.data.results || []);
            setCategories(categoriesRes.data ||[]);

        } catch (error) {
            console.error('Failed to load adahi data:', error);
            toast.error(t('errors.loading_error'));
        } finally {
            setLoading(false);
        }
    }, [isSeasonActive, t]);

    const fetchMyGroup = useCallback(async () => {
        if (!user) return;
        try {
            const res = await axios.get('/livestock/adahi-groups/my-active-group/');
            if (res.data?.id) {
                setMyActiveGroup(res.data);
            } else {
                setMyActiveGroup(null);
            }
        } catch (error) {
            console.error('Failed to load active group:', error);
            setMyActiveGroup(null);
        }
    }, [user]);

    useEffect(() => {
        if (!settingsLoading) {
            fetchAdahiData();
            fetchMyGroup();
        }
    }, [fetchAdahiData, fetchMyGroup, settingsLoading]);

    const handleJoinGroup = async (e) => {
        e.preventDefault();
        const trimmedCode = groupCode.trim().toUpperCase();
        if (!trimmedCode) {
            toast.error(t('adahi_page.enter_code_placeholder'));
            return;
        }
        setJoiningGroup(true);
        try {
            const res = await axios.post('/livestock/adahi-groups/join/', { code: trimmedCode });
            const { status, animal_data, detail, group_listing } = res.data;

            if (status === 'converted_to_pool') {
                toast.info(detail || t('adahi_page.group_converted_to_pool', "هذه المجموعة تحولت لمسبح عام. جاري توجيهك للمشاركة..."), { autoClose: 6000 });
                const poolListing = group_listing || animal_data.listings?.find(l => l.section === 'adahi_pool');
                navigate(`/animal/${animal_data.unique_id}`, {
                    state: {
                        listing: poolListing ? { ...poolListing, animal_details: animal_data } : { animal_details: animal_data },
                        context: 'adahi_pool'
                    }
                });
            } else {
                toast.success(t('adahi_page.group_found_success'));
                const actualListing = group_listing || animal_data.listings?.find(l => l.section === 'adahi_group');

                navigate(`/animal/${animal_data.unique_id}`, {
                    state: {
                        listing: actualListing ? { ...actualListing, animal_details: animal_data } : {
                            animal_details: animal_data,
                            pipeline: 'S',
                            section: 'adahi_group',
                            total_shares: 7,
                            available_shares: animal_data.remaining_shares || 7
                        },
                        context: 'adahi_group',
                        isPrivateGroupJoin: true,
                        groupCode: trimmedCode
                    }
                });
            }
        } catch (error) {
            const errorData = error.response?.data;
            if (errorData?.status === 'sold_out') {
                toast.error(errorData.detail || t('adahi_page.group_completed_sold_out', "عذراً، هذه المجموعة اكتملت وتم بيعها بالكامل."));
            } else {
                toast.error(errorData?.detail || t('adahi_page.invalid_group_code'));
            }
        } finally {
            setJoiningGroup(false);
        }
    };

    const handleCopyCode = async () => {
        if (!myActiveGroup?.code) return;
        setCopyingCode(true);
        try {
            await navigator.clipboard.writeText(myActiveGroup.code);
            toast.success(t('adahi_page.code_copied'));
        } catch (error) {
            console.error('Failed to copy code:', error);
            toast.error(t('adahi_page.copy_failed'));
        } finally {
            setCopyingCode(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        const cleanPhone = invitePhone.trim();

        if (!cleanPhone) {
            toast.error(t('adahi_page.phone_required'));
            return;
        }

        if (!phoneRegex.test(cleanPhone)) {
            toast.error(t('adahi_page.invalid_phone'));
            return;
        }

        if (!myActiveGroup?.id) {
            toast.error(t('adahi_page.no_active_group'));
            return;
        }

        setInviting(true);
        try {
            await axios.post(`/livestock/adahi-groups/${myActiveGroup.id}/invite/`, {
                phone: cleanPhone
            });
            toast.success(t('adahi_page.invite_sent'));
            setInvitePhone('');
        } catch (error) {
            const errorMessage = error.response?.data?.detail ||
                error.response?.data?.message ||
                t('adahi_page.invite_failed');
            toast.error(errorMessage);
        } finally {
            setInviting(false);
        }
    };

    const filterListings = (listings) => {
        const selectedCatName = categories.find(c => c.id.toString() === selectedCategory)?.name_ar;

        return listings.filter(listing => {
            const animal = listing.animal_details || {};
            const matchesSearch = searchQuery === '' ||
                (animal.code && animal.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (animal.category_name && animal.category_name.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesCategory = !selectedCategory || animal.category_name === selectedCatName;

            return matchesSearch && matchesCategory;
        });
    };

    const EmptyState = ({ message }) => (
        <div className="text-center py-10">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                <HelpCircle size={32} />
            </div>
            <p className="text-gray-500 font-medium">{message}</p>
        </div>
    );

    function MyActiveGroupPanel() {
        if (!myActiveGroup) return null;

        const animal = myActiveGroup.animal_details || {};
        const maxShares = animal.max_shares || 7;
        const remainingShares = animal.remaining_shares || maxShares;
        const completedShares = maxShares - remainingShares;
        const completionPercentage = Math.max(0, Math.min(100, (completedShares / maxShares) * 100));

        return (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-100 rounded-2xl p-6 mb-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-purple-100 px-4 py-2 rounded-bl-2xl text-purple-700 font-bold text-sm">
                    {t('adahi_page.active_group_title')}
                </div>

                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600 shadow-sm border border-purple-100">
                    <Lock size={32} />
                </div>

                <h3 className="text-2xl font-black text-dark mb-2">
                    {t('adahi_page.group_code_label')}
                    <span className="ms-2 text-purple-600 bg-white px-4 py-1 rounded-lg border border-purple-200 select-all font-mono">
                        {myActiveGroup.code}
                    </span>
                    <button
                        onClick={handleCopyCode}
                        disabled={copyingCode}
                        className="inline-flex items-center gap-1 text-sm text-purple-700 hover:text-purple-900 disabled:opacity-50 ms-2"
                    >
                        <Copy size={16} />
                        {copyingCode ? t('adahi_page.copying') : t('adahi_page.copy')}
                    </button>
                </h3>

                <p className="text-gray-500 mb-6 text-sm">
                    {t('adahi_page.animal_label')} {animal.category_name || t('common.unknown', 'غير معروف')} (#{animal.code || 'N/A'})
                </p>

                <div className="max-w-md mx-auto mb-6">
                    <div className="d-flex justify-content-between text-xs font-bold mb-2 px-1">
                        <span>{t('adahi_page.completion_label')}</span>
                        <span className="text-purple-600">
                            {completedShares} / {maxShares}
                        </span>
                    </div>
                    <div className="w-full bg-purple-200 rounded-full h-2.5">
                        <div
                            className="bg-purple-600 h-2.5 rounded-full transition-all duration-1000"
                            style={{ width: `${completionPercentage}%` }}
                        ></div>
                    </div>
                </div>

                <div className="max-w-md mx-auto bg-white p-4 rounded-xl border border-purple-100 shadow-sm">
                    <h5 className="font-bold text-purple-800 mb-3 text-sm flex items-center gap-2 justify-center">
                        <Users size={16} /> {t('adahi_page.invite_friend_title')}
                    </h5>
                    <form onSubmit={handleInvite} className="flex gap-2">
                        <input
                            type="tel"
                            placeholder={t('adahi_page.invite_placeholder')}
                            value={invitePhone}
                            onChange={(e) => setInvitePhone(e.target.value.slice(0, 15))}
                            className="flex-grow px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 focus:outline-none focus:border-purple-500 text-sm"
                            required
                        />
                        <button
                            type="submit"
                            disabled={inviting}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                        >
                            {inviting ? '...' : t('adahi_page.invite_btn')}
                        </button>
                    </form>
                </div>
            </div>
        );
    };

    const filteredFullListings = filterListings(fullListings);
    const filteredPoolListings = filterListings(poolListings);
    const filteredPrivateCandidates = filterListings(privateCandidates.map(animal => ({
        id: `private-${animal.id}`,
        animal_details: animal,
        pipeline: 'S',
        section: 'private_group',
        price: animal.price_after_discount,
        price_per_share: (animal.price_after_discount / 7).toFixed(2),
        total_shares: 7,
        available_shares: 7,
        is_active: true
    })));

    if (settingsLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen bg-secondary/20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    if (!isSeasonActive) {
        return (
            <div className="min-h-screen bg-secondary/20 flex items-center justify-center p-4">
                <div className="bg-white max-w-2xl w-full rounded-3xl shadow-xl p-8 md:p-12 text-center border border-gray-100">
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
                        <CalendarOff size={48} />
                    </div>

                    <h1 className="text-2xl md:text-4xl font-black text-dark mb-4">
                        {t('adahi_page.closed_title')}
                    </h1>

                    <p className="text-gray-500 text-lg leading-relaxed mb-8">
                        {t('adahi_page.closed_msg')}
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link
                            to="/livestock"
                            className="btn bg-primary hover:bg-primary-dark text-white py-3 px-6 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-primary/20 transition-all hover:-translate-y-1"
                        >
                            <Beef size={20} />
                            {t('adahi_page.go_to_livestock')}
                        </Link>

                        <Link
                            to="/shares"
                            className="btn bg-white text-dark border-2 border-gray-200 hover:border-primary hover:text-primary py-3 px-6 rounded-xl flex items-center justify-center gap-2 font-bold transition-all"
                        >
                            <Share2 size={20} />
                            {t('adahi_page.go_to_shares')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const anyTabEnabled = opSettings?.enable_adahi_full !== false ||
                         opSettings?.enable_adahi_pool !== false ||
                         opSettings?.enable_adahi_group !== false;

    return (
        <div className="bg-secondary/20 min-h-screen pb-20">
            <div className="bg-dark text-white py-16 relative overflow-hidden">
                <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} w-full h-full bg-primary/10`}></div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-md rounded-3xl mb-6 text-yellow-400 shadow-lg border border-white/20">
                        <ShieldCheck size={40} />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black mb-4">
                        {t('adahi_page.season_title', { year: new Date().getFullYear() })}
                    </h1>
                    <p className="text-gray-300 text-lg max-w-2xl mx-auto leading-relaxed">
                        {t('adahi_page.season_description')}
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 -mt-10 relative z-20">
                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                    {!anyTabEnabled ? (
                        <div className="text-center py-12">
                            <h3 className="text-xl font-bold text-dark mb-2">{t('adahi_page.preparing_adahi_sections', 'جاري تجهيز أقسام الأضاحي')}</h3>
                            <p className="text-gray-500">{t('adahi_page.please_return_later_adahi', 'يرجى العودة لاحقاً لاستعراض الأضاحي المتاحة.')}</p>
                        </div>
                    ) : (
                        <>
                            <div className="flex border-b border-gray-100 bg-white overflow-x-auto">
                                {opSettings?.enable_adahi_full !== false && (
                                    <button
                                        onClick={() => setActiveTab('full')}
                                        className={`flex-1 min-w-[120px] py-5 flex flex-col md:flex-row items-center justify-center gap-2 transition-all duration-300 ${
                                            activeTab === 'full'
                                                ? 'bg-white text-primary border-b-4 border-primary'
                                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                        }`}
                                    >
                                        <CheckCircle size={20} className={activeTab === 'full' ? 'text-primary' : 'text-gray-400'} />
                                        <span className="font-bold text-sm md:text-base">{t('adahi_page.full_sacrifice')}</span>
                                    </button>
                                )}

                                {opSettings?.enable_adahi_pool !== false && (
                                    <button
                                        onClick={() => setActiveTab('pool')}
                                        className={`flex-1 min-w-[120px] py-5 flex flex-col md:flex-row items-center justify-center gap-2 transition-all duration-300 ${
                                            activeTab === 'pool'
                                                ? 'bg-white text-primary border-b-4 border-primary'
                                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                        }`}
                                    >
                                        <Users size={20} className={activeTab === 'pool' ? 'text-primary' : 'text-gray-400'} />
                                        <span className="font-bold text-sm md:text-base">{t('adahi_page.public_share')}</span>
                                    </button>
                                )}

                                {opSettings?.enable_adahi_group !== false && (
                                    <button
                                        onClick={() => setActiveTab('private')}
                                        className={`flex-1 min-w-[120px] py-5 flex flex-col md:flex-row items-center justify-center gap-2 transition-all duration-300 ${
                                            activeTab === 'private'
                                                ? 'bg-white text-primary border-b-4 border-primary'
                                                : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
                                        }`}
                                    >
                                        <Lock size={20} className={activeTab === 'private' ? 'text-primary' : 'text-gray-400'} />
                                        <span className="font-bold text-sm md:text-base">{t('adahi_page.private_group')}</span>
                                    </button>
                                )}
                            </div>

                            <div className="p-3 md:p-4 border-b border-gray-100 bg-gray-50 sticky top-0 z-30">
                                <div className="flex flex-col sm:flex-row gap-2 md:gap-3">
                                    <div className="flex-grow relative">
                                        <Search className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`} size={18} />
                                        <input
                                            type="text"
                                            placeholder={t('common.search', 'ابحث برقم الكود أو الفئة...')}
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value.slice(0, 100))}
                                            className={`w-full h-12 ${
                                                isRtl ? 'pr-10' : 'pl-10'
                                            } rounded-xl bg-white border border-gray-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-bold shadow-sm`}
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowFilters(!showFilters)}
                                            className={`flex-1 sm:flex-none flex justify-center items-center gap-2 px-4 h-12 rounded-xl font-bold text-sm transition-all shadow-sm ${showFilters ? 'bg-primary text-white border-primary' : 'bg-white border border-gray-200 text-dark hover:bg-gray-50'}`}
                                        >
                                            <Filter size={16} />
                                            {t('common.filter', 'تصفية')}
                                        </button>

                                        {(searchQuery || selectedCategory) && (
                                            <button
                                                onClick={() => {
                                                    setSearchQuery('');
                                                    setSelectedCategory('');
                                                    setShowFilters(false);
                                                }}
                                                className="flex justify-center items-center gap-2 px-4 h-12 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 font-bold text-sm transition-colors"
                                                title={t('common.clear', 'مسح التصفية')}
                                            >
                                                <X size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {showFilters && (
                                    <div className="mt-3 pt-3 border-t border-gray-200 animate-fade-in">
                                        <h4 className="font-bold text-xs text-gray-500 uppercase mb-2">{t('adahi_page.filter_by_category', 'تصفية حسب الفئة')}</h4>
                                        <div className="flex flex-wrap gap-2">
                                            <button
                                                onClick={() => setSelectedCategory('')}
                                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                                                    !selectedCategory ? 'bg-primary text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                                }`}
                                            >
                                                {t('common.all', 'الكل')}
                                            </button>
                                            {categories.map(cat => (
                                                <button
                                                    key={cat.id}
                                                    onClick={() => setSelectedCategory(cat.id.toString())}
                                                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm ${
                                                        selectedCategory === cat.id.toString()
                                                            ? 'bg-primary text-white'
                                                            : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {cat.name_ar || cat.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 md:p-6 min-h-[400px]">
                                {loading ? (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
                                        <p className="text-gray-500 font-medium">{t('adahi_page.loading_herd')}</p>
                                    </div>
                                ) : (
                                    <>
                                        {activeTab === 'full' && (
                                            <div className="animate-fadeIn">
                                                <div className="text-center mb-6">
                                                    <h3 className="text-xl font-black text-dark mb-2">{t('adahi_page.full_sacrifice')}</h3>
                                                    <p className="text-gray-500 text-sm">{t('adahi_page.full_sacrifice_desc')}</p>
                                                </div>

                                                {filteredFullListings.length > 0 ? (
                                                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                                                        {filteredFullListings.map(listing => (
                                                            <ProductCard
                                                                key={listing.id}
                                                                listing={listing}
                                                                context="adahi"
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <EmptyState message={t('adahi_page.no_full_sacrifice')} />
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'pool' && (
                                            <div className="animate-fadeIn">
                                                <div className="text-center mb-6">
                                                    <h3 className="text-xl font-black text-dark mb-2">{t('adahi_page.public_share')}</h3>
                                                    <p className="text-gray-500 text-sm">{t('adahi_page.public_share_desc')}</p>
                                                </div>

                                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6 flex items-start gap-3">
                                                    <Info size={20} className="text-blue-500 flex-shrink-0 mt-0.5" />
                                                    <div className="text-sm text-blue-700">
                                                        <strong>{t('adahi_page.how_it_works')}</strong> {t('adahi_page.how_it_works_desc')}
                                                    </div>
                                                </div>

                                                {filteredPoolListings.length > 0 ? (
                                                    <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                                                        {filteredPoolListings.map(listing => (
                                                            <ProductCard
                                                                key={listing.id}
                                                                listing={listing}
                                                                context="adahi_pool"
                                                            />
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <EmptyState message={t('adahi_page.no_public_groups')} />
                                                )}
                                            </div>
                                        )}

                                        {activeTab === 'private' && (
                                            <div className="animate-fadeIn">
                                                {myActiveGroup ? (
                                                    <MyActiveGroupPanel />
                                                ) : (
                                                    <>
                                                        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8 mb-8">
                                                            <div className="text-center mb-5 md:mb-6">
                                                                <div className="inline-flex items-center justify-center w-12 h-12 md:w-14 md:h-14 bg-primary/10 text-primary rounded-2xl mb-3 shadow-sm">
                                                                    <Info size={24} />
                                                                </div>
                                                                <h4 className="text-lg md:text-xl font-black text-dark">{t('adahi_page.how_private_groups_work')}</h4>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-6">
                                                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center hover:-translate-y-1 transition-transform">
                                                                    <div className="w-10 h-10 mx-auto bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg mb-3 shadow-sm">1</div>
                                                                    <h5 className="font-bold text-dark mb-2 text-sm">{t('adahi_page.step1_title')}</h5>
                                                                    <p className="text-xs text-gray-500 m-0 leading-relaxed">{t('adahi_page.step1_desc')}</p>
                                                                </div>
                                                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center hover:-translate-y-1 transition-transform">
                                                                    <div className="w-10 h-10 mx-auto bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg mb-3 shadow-sm">2</div>
                                                                    <h5 className="font-bold text-dark mb-2 text-sm">{t('adahi_page.step2_title')}</h5>
                                                                    <p className="text-xs text-gray-500 m-0 leading-relaxed">{t('adahi_page.step2_desc')}</p>
                                                                </div>
                                                                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center hover:-translate-y-1 transition-transform">
                                                                    <div className="w-10 h-10 mx-auto bg-primary text-white rounded-full flex items-center justify-center font-bold text-lg mb-3 shadow-sm">3</div>
                                                                    <h5 className="font-bold text-dark mb-2 text-sm">{t('adahi_page.step3_title')}</h5>
                                                                    <p className="text-xs text-gray-500 m-0 leading-relaxed">{t('adahi_page.step3_desc')}</p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="mb-8">
                                                            <div className="bg-gradient-to-br from-gray-50 to-white rounded-3xl border border-gray-200 shadow-sm p-5 md:p-8 text-center max-w-2xl mx-auto">
                                                                <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mx-auto mb-4 text-primary">
                                                                    <Users size={32} />
                                                                </div>
                                                                <h4 className="font-black text-dark text-lg md:text-xl mb-2">{t('adahi_page.have_group_code')}</h4>
                                                                <p className="text-gray-500 text-xs md:text-sm mb-6 px-2 md:px-4">{t('adahi_page.enter_group_code')}</p>

                                                                <form onSubmit={handleJoinGroup} className="w-full px-1 md:px-4">
                                                                    <div className="flex flex-col md:flex-row gap-3">
                                                                        <input
                                                                            type="text"
                                                                            placeholder={t('adahi_page.enter_code_placeholder')}
                                                                            value={groupCode}
                                                                            onChange={(e) => setGroupCode(e.target.value.toUpperCase().slice(0, 20))}
                                                                            className="w-full md:flex-grow px-4 py-3 rounded-2xl bg-white border-2 border-gray-200 focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none transition-all text-center font-bold tracking-[0.2em] text-base md:text-lg shadow-sm"
                                                                        />
                                                                        <button
                                                                            type="submit"
                                                                            disabled={joiningGroup || !groupCode.trim()}
                                                                            className="w-full md:w-auto bg-primary text-white px-8 py-3 rounded-2xl font-bold text-base hover:bg-primary-dark disabled:opacity-50 transition-colors shadow-sm hover:shadow-md flex items-center justify-center shrink-0"
                                                                        >
                                                                            {joiningGroup ? (
                                                                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                                                            ) : (
                                                                                t('adahi_page.join')
                                                                            )}
                                                                        </button>
                                                                    </div>
                                                                </form>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center mb-6">
                                                            <div className="flex-grow border-t border-gray-200"></div>
                                                            <span className="px-4 text-gray-400 font-bold text-sm">{t('adahi_page.or_create_new')}</span>
                                                            <div className="flex-grow border-t border-gray-200"></div>
                                                        </div>

                                                        <div className="text-center mb-6">
                                                            <h3 className="text-xl font-black text-dark mb-2">{t('adahi_page.create_private_group')}</h3>
                                                            <p className="text-gray-500 text-sm">{t('adahi_page.create_private_group_desc')}</p>
                                                        </div>

                                                        {filteredPrivateCandidates.length > 0 ? (
                                                            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                                                                {filteredPrivateCandidates.map(listing => (
                                                                    <ProductCard
                                                                        key={listing.id}
                                                                        listing={listing}
                                                                        context="adahi_group"
                                                                        extraState={{ isCreatingGroup: true }}
                                                                    />
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <EmptyState message={t('adahi_page.no_animals_for_groups')} />
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default Adahi;
