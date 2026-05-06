// src/pages/policies/Terms.jsx
import React from 'react';
import { FileText } from 'lucide-react';
import PolicyLayout from '../../components/layout/PolicyLayout';
import { useTranslation } from 'react-i18next';

const Terms = () => {
  const { t } = useTranslation();

  return (
    <PolicyLayout
      title={t('policies.terms_title')}
      icon={FileText}
      intro={t('policies.terms_content.intro')}
    >
        <div className="space-y-8 text-gray-700 leading-loose text-sm md:text-base text-justify">

            <section>
                <h3 className="text-lg font-bold text-dark mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full inline-block"></span>
                    {t('policies.terms_content.sections.0.title')}
                </h3>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 whitespace-pre-line">
                    {t('policies.terms_content.sections.0.content')}
                </div>
            </section>

            <section>
                <h3 className="text-lg font-bold text-dark mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full inline-block"></span>
                    {t('policies.terms_content.sections.1.title')}
                </h3>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 whitespace-pre-line">
                    {t('policies.terms_content.sections.1.content')}
                </div>
            </section>

            <section>
                <h3 className="text-lg font-bold text-dark mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full inline-block"></span>
                    {t('policies.terms_content.sections.2.title')}
                </h3>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 whitespace-pre-line">
                    {t('policies.terms_content.sections.2.content')}
                </div>
            </section>

            <section>
                <h3 className="text-lg font-bold text-dark mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full inline-block"></span>
                    {t('policies.terms_content.sections.3.title')}
                </h3>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 whitespace-pre-line">
                    {t('policies.terms_content.sections.3.content')}
                </div>
            </section>

            <section>
                <h3 className="text-lg font-bold text-dark mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-primary rounded-full inline-block"></span>
                    {t('policies.terms_content.sections.4.title')}
                </h3>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 whitespace-pre-line">
                    {t('policies.terms_content.sections.4.content')}
                </div>
            </section>
        </div>
    </PolicyLayout>
  );
};

export default Terms;
