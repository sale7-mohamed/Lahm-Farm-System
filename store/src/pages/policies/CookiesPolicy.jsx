import React from 'react';
import { Cookie, Settings, ShieldCheck } from 'lucide-react';
import PolicyLayout from '../../components/layout/PolicyLayout';
import { useTranslation } from 'react-i18next';

const CookiesPolicy = () => {
  const { t } = useTranslation();

  return (
    <PolicyLayout
      title={t('policies.cookies_title')}
      icon={Cookie}
      intro={t('policies.cookies_content.intro')}
    >
        <section>
             <h3 className="text-lg md:text-xl font-bold text-dark mb-3 flex items-center gap-2">
               <ShieldCheck className="text-amber-500" size={24} />
               {t('policies.cookies_content.sections.0.title')}
             </h3>
             <p className="text-gray-600 leading-loose text-sm md:text-base text-justify bg-gray-50 p-5 rounded-2xl border border-gray-100 whitespace-pre-line">
               {t('policies.cookies_content.sections.0.content')}
             </p>
        </section>

        <section className="mt-8">
             <h3 className="text-lg md:text-xl font-bold text-dark mb-3 flex items-center gap-2">
               <Settings className="text-amber-500" size={24} />
               {t('policies.cookies_content.sections.1.title')}
             </h3>
             <p className="text-gray-600 leading-loose text-sm md:text-base text-justify bg-gray-50 p-5 rounded-2xl border border-gray-100 whitespace-pre-line">
               {t('policies.cookies_content.sections.1.content')}
             </p>
        </section>

        <section className="mt-8">
             <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-sm text-amber-900 font-medium">
               <strong>{t('policies.cookies_content.sections.2.title')}</strong> {t('policies.cookies_content.sections.2.content')}
             </div>
        </section>
    </PolicyLayout>
  );
};

export default CookiesPolicy;
