import React from 'react';
import { Link } from 'react-router-dom';
import { User, Utensils, Store, HeartHandshake, ArrowRight, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const TargetCard = ({ icon, title, desc, link, linkText, color, isRtl }) => {
    const Icon = icon;

    return (
        <Link to={link} className="block group h-full">
            {/*   padding   (p-3)       */}
            <div className={`h-full bg-${color}-50/50 hover:bg-${color}-50 border border-${color}-100 rounded-3xl p-3 md:p-6 transition-all duration-300 hover:shadow-md hover:-translate-y-1 flex flex-col items-center text-center`}>

                {}
                <div className={`w-10 h-10 md:w-14 md:h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-3 md:mb-4 text-${color}-600 group-hover:scale-110 transition-transform`}>
                    <Icon size={20} className="md:w-7 md:h-7" strokeWidth={1.5} />
                </div>

                <h3 className="text-sm md:text-lg font-bold text-dark mb-1 md:mb-2 line-clamp-1">{title}</h3>

                <p className="text-[10px] md:text-sm text-gray-500 mb-3 md:mb-4 flex-grow leading-relaxed line-clamp-2 md:line-clamp-none">
                    {desc}
                </p>

                <div className={`text-[10px] md:text-sm font-bold text-${color}-600 flex items-center gap-1 group-hover:gap-2 transition-all`}>
                    {linkText}
                    {isRtl ? <ArrowLeft size={14} className="md:w-4 md:h-4" /> : <ArrowRight size={14} className="md:w-4 md:h-4" />}
                </div>
            </div>
        </Link>
    );
};

const TargetCustomers = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';

    const targets =[
        {
            icon: User,
            title: t('targets.individuals_title'),
            desc: t('targets.individuals_desc'),
            link: "/livestock",
            linkText: t('targets.individuals_btn'),
            color: "green"
        },
        {
            icon: HeartHandshake,
            title: t('targets.adahi_title'),
            desc: t('targets.adahi_desc'),
            link: "/adahi",
            linkText: t('targets.adahi_btn'),
            color: "yellow"
        },
        {
            icon: Utensils,
            title: t('targets.restaurants_title'),
            desc: t('targets.restaurants_desc'),

            link: "/partnerships?tab=business",
            linkText: t('targets.restaurants_btn'),
            color: "blue"
        },
        {
            icon: Store,
            title: t('targets.shops_title'),
            desc: t('targets.shops_desc'),

            link: "/partnerships?tab=business",
            linkText: t('targets.shops_btn'),
            color: "purple"
        }
    ];

    return (
        <section className="py-8 md:py-12 bg-white">
            <div className="container mx-auto px-4">
                <div className="text-center mb-6 md:mb-10">
                    <h2 className="text-xl md:text-3xl font-black text-dark mb-1 md:mb-2">
                        {t('home.target_title')}
                    </h2>
                    <p className="text-muted text-sm md:text-base">{t('home.target_subtitle')}</p>
                </div>

                {/*   Grid: grid-cols-2  */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                    {targets.map((item, idx) => (
                        <TargetCard
                            key={idx}
                            {...item}
                            isRtl={isRtl}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default TargetCustomers;