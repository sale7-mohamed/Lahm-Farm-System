import React from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck } from 'lucide-react';

const PolicyLayout = ({ title, icon: Icon, intro, children }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-gray-50 min-h-screen pb-20">

      {/* Header -        */}
      <div className="bg-white shadow-sm sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 md:py-5">
             <h1 className="text-lg md:text-2xl font-black text-dark m-0 text-center">
               {title}
             </h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 md:py-10 max-w-4xl animate-fade-in-up">
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Intro Section -   */}
          <div className="bg-primary/5 p-6 md:p-10 text-center border-b border-gray-100">
             <div className="w-16 h-16 bg-white text-primary rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 shadow-sm border border-gray-50">
                {Icon ? <Icon size={32} /> : <ShieldCheck size={32} />}
             </div>

             {intro && (
               <p className="text-gray-600 max-w-3xl mx-auto leading-loose text-sm md:text-base font-medium">
                 {intro}
               </p>
             )}

             <div className="mt-4 inline-block px-4 py-1.5 bg-white rounded-full text-[10px] md:text-xs font-bold text-gray-400 border border-gray-200 shadow-sm">
                {t('policies.last_updated')}
             </div>
          </div>

          {/* Content Body */}
          <div className="p-5 md:p-10 space-y-8 md:space-y-10">
             {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PolicyLayout;