import React from 'react';
import { Search, Settings2, Truck } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const HowItWorks = () => {
    const { t } = useTranslation();

    const steps =[
        {
            icon: Search,
            title: t('how_it_works.step1_title'),
            desc: t('how_it_works.step1_desc')
        },
        {
            icon: Settings2, //     (/)
            title: t('how_it_works.step2_title'),
            desc: t('how_it_works.step2_desc')
        },
        {
            icon: Truck,
            title: t('how_it_works.step3_title'),
            desc: t('how_it_works.step3_desc')
        }
    ];

    return (
        <section className="py-8 md:py-16 bg-dark text-white relative overflow-hidden">
            <div className="container mx-auto px-4 relative z-10">
                {}
                <div className="text-center mb-8 md:mb-12">
                    <h2 className="text-xl md:text-3xl font-black mb-2">{t('how_it_works.title')}</h2>
                    <p className="text-gray-400 text-xs md:text-base">{t('how_it_works.subtitle')}</p>
                </div>

                {/*
                   Grid System:
                   - grid-cols-3:    3
                   - gap-2:
                */}
                <div className="grid grid-cols-3 gap-2 md:gap-8 relative">

                    {/*   (Connector Line) */}
                    {}
                    <div className="absolute top-6 md:top-10 left-4 right-4 h-0.5 bg-gray-700 -z-10 transform -translate-y-1/2"></div>

                    {steps.map((step, idx) => (
                        <div key={idx} className="flex flex-col items-center text-center group">

                            {}
                            <div className="relative mb-3 md:mb-6">
                                <div className="w-12 h-12 md:w-20 md:h-20 bg-gray-800 rounded-full flex items-center justify-center border-2 md:border-4 border-dark shadow-lg group-hover:bg-gray-700 transition-colors">
                                    <step.icon size={20} className="text-primary md:w-8 md:h-8" />
                                </div>

                                {}
                                <div className={`absolute -top-1 -right-1 md:-top-2 md:-right-2 w-5 h-5 md:w-8 md:h-8 bg-primary rounded-full flex items-center justify-center font-bold text-white text-[10px] md:text-sm border-2 md:border-4 border-dark`}>
                                    {idx + 1}
                                </div>
                            </div>

                            {}
                            <div className="px-1">
                                <h3 className="text-[11px] md:text-xl font-bold mb-1 md:mb-2 text-white leading-tight">
                                    {step.title}
                                </h3>
                                <p className="text-[9px] md:text-sm text-gray-400 leading-tight md:leading-relaxed hidden sm:block">
                                    {step.desc}
                                </p>
                                {}
                                <p className="text-[9px] text-gray-500 leading-tight sm:hidden">
                                    {idx === 0 && t('how_it_works.mobile_desc1')}
                                    {idx === 1 && t('how_it_works.mobile_desc2')}
                                    {idx === 2 && t('how_it_works.mobile_desc3')}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default HowItWorks;