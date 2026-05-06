import React, { useState, useEffect } from 'react';
import axios from '../../services/axiosConfig';
import { RefreshCw, AlertTriangle, ShieldAlert, CreditCard, Clock } from 'lucide-react';
import PolicyLayout from '../../components/layout/PolicyLayout';
import Spinner from '../../components/ui/Spinner';
import { useTranslation } from 'react-i18next';

const RefundPolicy = () => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get('/livestock/delivery-settings/')
            .then(res => setSettings(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    },[]);

    if (loading) {
        return (
            <PolicyLayout title={t('policies.refund_title')} icon={RefreshCw}>
                <div className="flex justify-center py-10"><Spinner size="lg" /></div>
            </PolicyLayout>
        );
    }

    const minDeposit = settings?.min_deposit_percentage ? parseFloat(settings.min_deposit_percentage) * 100 : 20;
    const serviceDeposit = settings?.service_deposit_percentage ? parseFloat(settings.service_deposit_percentage) * 100 : 50;

    return (
        <PolicyLayout
            title={t('policies.refund_title')}
            icon={RefreshCw}
            intro={t('policies.refund_content.intro')}
        >
            <div className="bg-red-50 border border-red-100 rounded-2xl p-5 flex flex-col md:flex-row items-center md:items-start gap-4 shadow-sm mb-8">
                <AlertTriangle className="text-red-500 shrink-0" size={36} />
                <div>
                    <h4 className="text-red-800 font-black mb-2">{t('policies.refund_content.alert_title')}</h4>
                    <p className="text-red-700 text-sm md:text-base font-medium m-0 leading-relaxed whitespace-pre-line">
                        {t('policies.refund_content.alert_desc')}
                    </p>
                </div>
            </div>

            <section className="mb-8">
                <h3 className="text-lg md:text-xl font-bold text-dark mb-4 flex items-center gap-2">
                    <CreditCard size={24} className="text-primary" />
                    {t('policies.refund_content.sections.0.title')}
                </h3>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-gray-700 leading-relaxed">
                    <div className="whitespace-pre-line mb-4">
                        {t('policies.refund_content.sections.0.content')}
                    </div>
                    <div className="bg-white p-3 rounded-xl border border-gray-200 mt-4 font-bold text-sm">
                        <div>{t('product.min_deposit')} - {t('policies.refund_labels.live_orders', 'Live Orders')}: <span className="text-primary">{minDeposit}%</span></div>
                        <div className="mt-2">{t('product.min_deposit')} - {t('policies.refund_labels.slaughtered_orders', 'Slaughter Orders')}: <span className="text-primary">{serviceDeposit}%</span></div>
                    </div>
                </div>
            </section>

            <section className="mb-8">
                <h3 className="text-lg md:text-xl font-bold text-dark mb-4 flex items-center gap-2">
                    <Clock size={24} className="text-orange-500" />
                    {t('policies.refund_content.sections.1.title')}
                </h3>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-gray-700 leading-relaxed whitespace-pre-line">
                    {t('policies.refund_content.sections.1.content')}
                </div>
            </section>

            <section>
                <h3 className="text-lg md:text-xl font-bold text-dark mb-4 flex items-center gap-2">
                    <ShieldAlert size={24} className="text-green-500" />
                    {t('policies.refund_content.sections.2.title')}
                </h3>
                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-gray-700 leading-relaxed whitespace-pre-line">
                    {t('policies.refund_content.sections.2.content')}
                </div>
            </section>
        </PolicyLayout>
    );
};

export default RefundPolicy;
