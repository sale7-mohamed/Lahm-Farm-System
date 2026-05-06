import React, { useEffect, useState } from "react";
import axios from "../services/axiosConfig";
import { Users, UserPlus, ArrowRight, Share2, Info } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import ProductCard from "../components/ui/ProductCard";
import { Link } from "react-router-dom";

const EmptyState = ({ message, action }) => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    return (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                <Info size={32} aria-hidden="true" />
            </div>
            <p className="text-gray-500 font-bold mb-6">{message}</p>
            {action && (
                <button
                    onClick={action}
                    className="text-primary font-bold hover:underline flex items-center justify-center gap-1 mx-auto"
                    aria-label={t('shares_page.start_group')}
                >
                    {t('shares_page.start_group')}
                    {isRtl ? (
                        <ArrowRight size={16} className="rotate-180" aria-hidden="true" />
                    ) : (
                        <ArrowRight size={16} aria-hidden="true" />
                    )}
                </button>
            )}
        </div>
    );
};

const LivestockShares = () => {
    const { t } = useTranslation();
    const[newListings, setNewListings] = useState([]);
    const [existingListings, setExistingListings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('new');
    const [opSettings, setOpSettings] = useState(null);

    useEffect(() => {
        const fetchShareable = async () => {
            setLoading(true);
            try {
                const settingsRes = await axios.get("/core/public-operation-settings/");
                setOpSettings(settingsRes.data);

                const res = await axios.get("/livestock/shares/");

                if (res.data && Array.isArray(res.data.results)) {
                    const allListings = res.data.results;

                    const newListingsFiltered = allListings.filter(l =>
                        l.available_shares === l.total_shares
                    );
                    const existingListingsFiltered = allListings.filter(l =>
                        l.available_shares < l.total_shares &&
                        l.available_shares > 0
                    );

                    setNewListings(newListingsFiltered);
                    setExistingListings(existingListingsFiltered);
                } else {
                    setNewListings([]);
                    setExistingListings([]);
                }

            } catch (error) {
                console.error('Error fetching share listings:', error);
                toast.error(t('errors.generic'));
                setNewListings([]);
                setExistingListings([]);
            } finally {
                setLoading(false);
            }
        };
        fetchShareable();
    }, [t]);

    const handleTabClick = (tab) => {
        setActiveTab(tab);
    };

    if (opSettings && opSettings.enable_general_shares === false) {
        return (
            <div className="min-h-[70vh] bg-secondary/20 flex items-center justify-center p-4">
                <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl p-8 text-center border border-gray-100">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400">
                        <Users size={40} />
                    </div>
                    <h1 className="text-2xl font-black text-dark mb-4">
                        {t('shares_page.service_stopped_title', 'باب التشارك مغلق حالياً')}
                    </h1>
                    <p className="text-gray-500 mb-8">
                        {t('animal_details.shares_service_stopped', 'عذراً، خدمة التشارك العام متوقفة في الوقت الحالي، يمكنك متابعة متجرنا لشراء المواشي المتوفرة.')}
                    </p>
                    <Link to="/livestock" className="btn btn-primary px-8">
                        {t('home.start_shopping', 'تصفح المتجر')}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-secondary/20 min-h-screen pb-20">
            <div className="container mx-auto px-4 py-12">

                <div className="text-center mb-10 max-w-2xl mx-auto">
                    <div className="bg-primary/10 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 text-primary rotate-3">
                        <Users size={32} aria-hidden="true" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black text-dark mb-4">{t('shares_page.title')}</h1>
                    <p className="text-muted text-lg leading-relaxed">
                        {t('shares_page.desc')}
                    </p>
                </div>

                <div className="flex justify-center mb-10">
                    <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100 inline-flex" role="tablist">
                        <button
                            onClick={() => handleTabClick('new')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                activeTab === 'new'
                                ? 'bg-primary text-white shadow-md'
                                : 'text-gray-500 hover:text-dark hover:bg-gray-50'
                            }`}
                            role="tab"
                            aria-selected={activeTab === 'new'}
                            aria-controls="new-panel"
                            id="new-tab"
                        >
                            <Share2 size={18} aria-hidden="true" />
                            {t('shares_page.start_group')}
                        </button>
                        <button
                            onClick={() => handleTabClick('join')}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                                activeTab === 'join'
                                ? 'bg-primary text-white shadow-md'
                                : 'text-gray-500 hover:text-dark hover:bg-gray-50'
                            }`}
                            role="tab"
                            aria-selected={activeTab === 'join'}
                            aria-controls="join-panel"
                            id="join-tab"
                        >
                            <UserPlus size={18} aria-hidden="true" />
                            {t('shares_page.join_group')}
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent shadow-lg"
                             role="status"
                             aria-label={t('common.loading')}>
                        </div>
                    </div>
                ) : (
                    <div className="animate-fade-in-up">
                        {activeTab === 'new' ? (
                            <div role="tabpanel" id="new-panel" aria-labelledby="new-tab">
                                {newListings.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                                        {newListings.map(listing => (
                                            <ProductCard key={listing.id} listing={listing} context="shares" />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState message={t('shares_page.no_new')} />
                                )}
                            </div>
                        ) : (
                            <div role="tabpanel" id="join-panel" aria-labelledby="join-tab">
                                {existingListings.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                                        {existingListings.map(listing => (
                                            <ProductCard key={listing.id} listing={listing} context="shares" />
                                        ))}
                                    </div>
                                ) : (
                                    <EmptyState message={t('shares_page.no_existing')} action={() => handleTabClick('new')} />
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LivestockShares;
