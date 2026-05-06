import React from 'react';
import { ShieldCheck, Truck, Scale, Clock, Award, HandCoins } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Features() {
  const { t } = useTranslation();

  const features =[
    { icon: ShieldCheck, title: t('features.halal_title'), desc: t('features.halal_desc') },
    { icon: Truck, title: t('features.delivery_title'), desc: t('features.delivery_desc') },
    { icon: Award, title: t('features.farms_title'), desc: t('features.farms_desc') },
    { icon: Scale, title: t('features.scale_title'), desc: t('features.scale_desc') },
    { icon: HandCoins, title: t('features.price_title'), desc: t('features.price_desc') },
    { icon: Clock, title: t('features.time_title'), desc: t('features.time_desc') }
  ];

  return (
    <section className="py-8 md:py-12 bg-secondary/30">
      <div className="container mx-auto px-2 md:px-4">
        <div className="text-center mb-6 md:mb-10">
            <h2 className="text-xl md:text-3xl font-black text-dark mb-1 md:mb-2">{t('home.why_us')}</h2>
        </div>

        {/*
             :
            1. grid-cols-3 :  (3 )
            2. gap-2 :
        */}
        <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-6">
          {features.map((feature, index) => (
            <div
              key={index}
              //    padding (p-2)     
              className="flex flex-col items-center text-center p-2 md:p-4 rounded-xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 h-full"
            >
              {}
              <div className="mb-2 md:mb-3 p-2 md:p-3 bg-primary/5 text-primary rounded-lg md:rounded-xl">
                {}
                <feature.icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>

              {}
              <h3 className="text-xs md:text-sm font-bold text-dark mb-1 leading-tight">
                {feature.title}
              </h3>

              <p className="text-[9px] md:text-xs text-muted leading-tight md:leading-relaxed line-clamp-2 md:line-clamp-none">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}