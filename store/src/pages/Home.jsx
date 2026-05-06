import React from "react";
import Hero from "../components/home/Hero";
import TargetCustomers from "../components/home/TargetCustomers";
import Features from "../components/home/Features";
import Categories from "../components/home/Products";
import HowItWorks from "../components/home/HowItWorks";
import { Link } from "react-router-dom";
import { Phone, ArrowLeft, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

function Home({ operationSettings }) {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const getEidYear = () => {
        if (operationSettings?.eid_adha_date) {
            return new Date(operationSettings.eid_adha_date).getFullYear();
        }
        return new Date().getFullYear(); // Fallback  
    };

    //    : ( )  ( )
    const showAdahiSection = operationSettings?.show_eid_timer || operationSettings?.enable_eid_celebration;

    return (
        <div className="home-page min-h-screen">

            {/* 1. Hero Section */}
            <Hero eidSettings={operationSettings} />

            {/* 2. Target Customers */}
            <TargetCustomers />

            {/* 3. Categories (Products) */}
            <Categories />

            {/* 4. Eid Section (Adahi) -     */}
            {showAdahiSection && (
                <section
                    id="eid-season-section"
                    className="bg-gradient-to-r from-emerald-900 to-green-900 py-12 text-white scroll-mt-24"
                >
                    <div className="container mx-auto px-4 text-center">
                        <span className="bg-white/10 text-emerald-300 px-4 py-1 rounded-full text-xs font-bold mb-4 inline-block backdrop-blur-sm border border-white/10">
                            {}
                            {t('eid.season_badge')} {getEidYear()}
                        </span>
                        <h2 className="text-3xl md:text-4xl font-black mb-4">{t('eid.season_title')}</h2>
                        <p className="text-emerald-100 max-w-2xl mx-auto mb-8 text-lg leading-relaxed">
                            {t('eid.season_desc')}
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link
                                to="/adahi"
                                className="btn bg-accent hover:bg-accent-hover text-dark px-8 py-3 rounded-full text-lg shadow-lg"
                            >
                                {t('eid.book_sacrifice')}
                            </Link>
                            <Link
                                to="/shares"
                                className="btn bg-white/10 hover:bg-white/20 text-white px-8 py-3 rounded-full text-lg backdrop-blur-sm border border-white/20"
                            >
                                {t('eid.shares_sukuk')}
                            </Link>
                        </div>
                    </div>
                </section>
            )}

            {/* 5. Features */}
            <Features />

            {/* 6. How it Works */}
            <HowItWorks />

            {/* 7. Trust & Final CTA */}
            <section className="py-20 bg-primary/5">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl font-black text-dark mb-4">{t('home.ready_to_order')}</h2>
                    <p className="text-muted mb-8 max-w-lg mx-auto text-base">
                        {t('home.ready_desc')}
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Link
                            to="/livestock"
                            className="btn btn-primary h-14 px-8 rounded-2xl text-lg shadow-lg flex items-center justify-center gap-2"
                        >
                            {t('home.start_shopping')}
                            {isRtl ? <ArrowLeft size={20}/> : <ArrowRight size={20}/>}
                        </Link>
                        <Link
                            to="/contact"
                            className="btn bg-white text-dark border-2 border-gray-200 h-14 px-8 rounded-2xl text-lg hover:border-primary hover:text-primary flex items-center justify-center gap-2"
                        >
                            <Phone size={20}/>
                            {t('home.contact_us')}
                        </Link>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default Home;