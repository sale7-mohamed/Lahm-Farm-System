import React from 'react';
import { Shield, Lock, Eye, Database } from 'lucide-react';
import PolicyLayout from '../../components/layout/PolicyLayout';
import { useTranslation } from 'react-i18next';

const PrivacyPolicy = () => {
  const { t } = useTranslation();

  return (
    <PolicyLayout
      title={t('policies.privacy_title')}
      icon={Shield}
      intro={t('policies.privacy_content.intro')}
    >
        <section>
            <h3 className="text-lg md:text-xl font-bold text-dark mb-3 flex items-center gap-2">
              <Database className="text-primary" size={24} />
              {t('policies.privacy_content.sections.0.title')}
            </h3>
            <p className="text-gray-600 leading-loose text-sm md:text-base text-justify bg-gray-50 p-5 rounded-2xl border border-gray-100 whitespace-pre-line">
              {t('policies.privacy_content.sections.0.content')}
            </p>
        </section>

        <section className="mt-8">
            <h3 className="text-lg md:text-xl font-bold text-dark mb-3 flex items-center gap-2">
              <Lock className="text-primary" size={24} />
              {t('policies.privacy_content.sections.1.title')}
            </h3>
            <div className="text-gray-600 leading-loose text-sm md:text-base text-justify bg-gray-50 p-5 rounded-2xl border border-gray-100 whitespace-pre-line">
              {t('policies.privacy_content.sections.1.content')}
            </div>
        </section>

        <section className="mt-8">
            <h3 className="text-lg md:text-xl font-bold text-dark mb-3 flex items-center gap-2">
              <Eye className="text-primary" size={24} />
              {t('policies.privacy_content.sections.2.title')}
            </h3>
            <div className="text-gray-600 leading-loose text-sm md:text-base text-justify bg-gray-50 p-5 rounded-2xl border border-gray-100 whitespace-pre-line">
              {t('policies.privacy_content.sections.2.content')}
            </div>
        </section>
    </PolicyLayout>
  );
};

export default PrivacyPolicy;
