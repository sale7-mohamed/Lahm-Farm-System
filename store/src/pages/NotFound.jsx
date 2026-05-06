
import React from 'react';
import { Link } from 'react-router-dom';
import { MapPinOff, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const NotFound = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="bg-red-50 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 text-red-500 rotate-12 shadow-sm">
          <MapPinOff size={48} />
        </div>

        <h1 className="text-6xl font-black text-dark mb-2">404</h1>
        <h2 className="text-2xl font-bold text-dark mb-4">
          {t('not_found.title', 'عذراً، الصفحة غير موجودة')}
        </h2>

        <p className="text-muted mb-8 leading-relaxed">
          {t('not_found.desc', 'يبدو أنك سلكت طريقًا خاطئًا، الصفحة التي تحاول الوصول إليها غير موجودة أو تم نقلها.')}
        </p>

        <Link
          to="/"
          className="btn btn-primary w-full py-4 rounded-2xl font-bold text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <Home size={20} />
          {t('not_found.back_home', 'العودة للرئيسية')}
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
