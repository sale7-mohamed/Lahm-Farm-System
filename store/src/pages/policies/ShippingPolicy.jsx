// src/pages/policies/ShippingPolicy.jsx
import React, { useState, useEffect } from 'react';
import axios from '../../services/axiosConfig';
import { Truck, MapPin, Calendar, CheckCircle, Info } from 'lucide-react';
import PolicyLayout from '../../components/layout/PolicyLayout';
import Spinner from '../../components/ui/Spinner';
import { useTranslation } from 'react-i18next';

const DAY_NAMES_AR = {
  Saturday: 'السبت', Sunday: 'الأحد', Monday: 'الإثنين',
  Tuesday: 'الثلاثاء', Wednesday: 'الأربعاء', Thursday: 'الخميس', Friday: 'الجمعة',
};
const DAY_NAMES_EN = {
  Saturday: 'Saturday', Sunday: 'Sunday', Monday: 'Monday',
  Tuesday: 'Tuesday', Wednesday: 'Wednesday', Thursday: 'Thursday', Friday: 'Friday',
};

const ShippingPolicy = () => {
  const { t, i18n } = useTranslation();
  const [settings, setSettings] = useState(null);
  const[areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchShippingData = async () => {
      try {
        const [settingsRes, areasRes] = await Promise.all([
          axios.get('/livestock/delivery-settings/'),
          axios.get('/livestock/delivery-areas/'),
        ]);
        setSettings(settingsRes.data);
        setAreas(areasRes.data.results || areasRes.data ||[]);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchShippingData();
  },[]);

  if (loading) {
    return (
      <PolicyLayout title={t('policies.shipping_title')} icon={Truck}>
        <div className="flex justify-center py-10"><Spinner size="lg" /></div>
      </PolicyLayout>
    );
  }

  const prepDaysLive = settings?.preparation_days ?? 0;
  const prepDaysSlaughtered = settings?.slaughter_preparation_days ?? 0;

  const deliveryDays = (settings?.delivery_days ||[]).map((d) =>
    i18n.language === 'ar' ? (DAY_NAMES_AR[d] || d) : (DAY_NAMES_EN[d] || d)
  );

  return (
    <PolicyLayout
      title={t('policies.shipping_title')}
      icon={Truck}
      intro={t('policies.shipping_content.intro')}
    >
      <section>
        <h3 className="text-lg md:text-xl font-bold text-dark mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-blue-500 rounded-full inline-block" />
          {t('policies.shipping_content.sections.0.title')}
        </h3>
        <p className="text-gray-600 mb-4 text-sm md:text-base leading-relaxed whitespace-pre-line">
          {t('policies.shipping_content.sections.0.content')}
        </p>

        <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl mb-4 text-blue-800 text-sm leading-relaxed">
            <strong>{t('policies.important_delivery_note')}</strong>
            <br/>{t('policies.delivery_note_1')}
            <br/>{t('policies.delivery_note_2')}
        </div>

        {areas.length > 0 ? (
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
            <table className="w-full text-start text-sm md:text-base">
              <thead className="bg-blue-50 border-b border-blue-100">
                <tr>
                  <th className="p-4 font-bold text-blue-900 text-start">{t('policies.shipping_labels.supported_areas', 'Supported Governorate')}</th>
                  <th className="p-4 font-bold text-blue-900 text-start">{t('policies.shipping_labels.delivery_fees', 'Base Delivery Fees')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {areas.map((area) => (
                  <tr key={area.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-bold text-dark flex items-center gap-2">
                      <MapPin size={18} className="text-blue-500" />
                      {area.governorate_name}
                    </td>
                    <td className="p-4 font-bold text-primary">
                      {parseFloat(area.delivery_price) > 0 ? `${parseFloat(area.delivery_price).toFixed(2)} ${t('common.currency')}` : t('checkout.free')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-yellow-50 text-yellow-800 p-4 rounded-xl border border-yellow-200">
            {t('policies.shipping_labels.no_areas', 'Delivery service is currently unavailable. Orders are limited to farm pickup.')}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h3 className="text-lg md:text-xl font-bold text-dark mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-green-500 rounded-full inline-block" />
          {t('policies.shipping_content.sections.1.title')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm text-green-600">
              <Calendar size={24} />
            </div>
            <h4 className="font-bold text-dark mb-3">{t('policies.shipping_labels.prep_time_title', 'Preparation Days')}</h4>
            <div className="space-y-3 text-sm text-gray-600 whitespace-pre-line">
              {t('policies.shipping_content.sections.1.content')}
              <div className="bg-white p-3 rounded-xl border mt-4 font-bold">
                <div className="mb-2 flex items-center gap-1.5"><CheckCircle size={16} className="text-primary"/> {t('policies.shipping_labels.live_orders', 'Live Orders')}: <span className="text-primary">{prepDaysLive} {t('common.days', 'Days')}</span></div>
                <div className="flex items-center gap-1.5"><CheckCircle size={16} className="text-primary"/> {t('policies.shipping_labels.slaughtered_orders', 'Slaughtered Orders')}: <span className="text-primary">{prepDaysSlaughtered} {t('common.days', 'Days')}</span></div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center mb-4 shadow-sm text-blue-600">
              <Truck size={24} />
            </div>
            <h4 className="font-bold text-dark mb-3">{t('policies.shipping_labels.fleet_days_title', 'Fleet Working Days')}</h4>
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">
              {t('policies.shipping_labels.fleet_days_desc', 'Our delivery vehicles are dispatched on specific days each week')}
            </p>
            <div className="flex flex-wrap gap-2">
              {deliveryDays.length > 0 ? (
                deliveryDays.map((day, idx) => (
                  <span key={idx} className="bg-white text-dark px-4 py-1.5 rounded-lg text-sm font-bold border border-gray-200 shadow-sm">
                    {day}
                  </span>
                ))
              ) : (
                <span className="text-gray-500 text-sm">{t('policies.shipping_labels.every_day', 'Every day of the week')}</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h3 className="text-lg md:text-xl font-bold text-dark mb-4 flex items-center gap-2">
          <span className="w-1.5 h-6 bg-purple-500 rounded-full inline-block" />
          {t('policies.shipping_content.sections.2.title')}
        </h3>
        <div className="bg-purple-50 p-5 rounded-2xl border border-purple-100 text-purple-900 text-sm md:text-base leading-relaxed flex gap-3 items-start whitespace-pre-line">
            <Info className="shrink-0 mt-1" size={24} />
            <p className="m-0">
                {t('policies.shipping_content.sections.2.content')}
            </p>
        </div>
      </section>
    </PolicyLayout>
  );
};

export default ShippingPolicy;
