import React, { useEffect, useState } from "react";
import { X, Search, Filter, ChevronDown, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

const FilterSidebar = ({ filters, categories, onFilterChange, onReset, isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';

  const [isCategoryExpanded, setIsCategoryExpanded] = useState(true);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  const handleChange = (name, value) => {
    onFilterChange({ target: { name, value } });
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] lg:hidden transition-opacity duration-300 ${
            isOpen ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
        onClick={onClose}
        aria-hidden="true"
      ></div>

      <aside className={`
        fixed inset-y-0 z-[101] w-[85vw] max-w-[340px] bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-in-out
        lg:static lg:z-0 lg:w-full lg:max-w-none lg:bg-transparent lg:shadow-none lg:transform-none lg:h-auto lg:flex-none
        ${isRtl ? 'right-0' : 'left-0'}
        ${isOpen ? "translate-x-0" : (isRtl ? "translate-x-full" : "-translate-x-full")}
        lg:translate-x-0
      `}>

        <div className="flex items-center justify-between p-5 border-b border-gray-100 lg:hidden bg-white">
          <h3 className="text-xl font-bold text-dark flex items-center gap-2">
            <Filter size={20} className="text-primary" />
            {t('livestock_page.filter')}
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-gray-50 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            {isRtl ? <ArrowRight size={20} /> : <ArrowLeft size={20} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar lg:p-0 lg:overflow-visible">

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">
                {t('common.search')}
              </label>
              <div className="relative">
                <input
                  type="text"
                  name="search"
                  value={filters.search}
                  onChange={(e) => handleChange('search', e.target.value)}
                  placeholder={t('filters.search_placeholder')}
                  className={`w-full h-11 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm font-medium ${isRtl ? 'pr-10' : 'pl-10'}`}
                />
                <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-400 ${isRtl ? 'right-3' : 'left-3'}`} size={18} />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-500 uppercase mb-2 block tracking-wider">
                {t('filters.sort_by')}
              </label>
              <div className="relative">
                <select
                  name="ordering"
                  value={filters.ordering}
                  onChange={(e) => handleChange('ordering', e.target.value)}
                  className="w-full h-11 px-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm font-medium appearance-none cursor-pointer"
                >
                  <option value="-created_at">{t('filters.newest')}</option>
                  <option value="annotated_price_after_discount">{t('filters.price_low_high')}</option>
                  <option value="-annotated_price_after_discount">{t('filters.price_high_low')}</option>
                  <option value="annotated_current_weight">{t('filters.weight_low_high')}</option>
                  <option value="-annotated_current_weight">{t('filters.weight_high_low')}</option>
                </select>
                <ChevronDown className={`absolute top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none ${isRtl ? 'left-3' : 'right-3'}`} size={18} />
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <button
                onClick={() => setIsCategoryExpanded(!isCategoryExpanded)}
                className="flex items-center justify-between w-full mb-3 group"
            >
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider cursor-pointer group-hover:text-primary transition-colors">
                    {t('filters.category')}
                </label>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${isCategoryExpanded ? 'rotate-180' : ''}`} />
            </button>

            {isCategoryExpanded && (
                <div className="flex flex-wrap gap-2 animate-fade-in">
                    <button
                        onClick={() => handleChange('category', '')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 ${
                            !filters.category
                            ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                        }`}
                    >
                        {t('filters.all')}
                    </button>

                    {categories.map((cat) => {
                        const currentCats = filters.category ? filters.category.split(',') :[];
                        const isSelected = currentCats.includes(cat.slug);

                        const handleCatToggle = () => {
                            let newCats;
                            if (isSelected) {
                                newCats = currentCats.filter(c => c !== cat.slug);
                            } else {
                                newCats = [...currentCats, cat.slug];
                            }
                            handleChange('category', newCats.join(','));
                        };

                        return (
                            <button
                                key={cat.id}
                                onClick={handleCatToggle}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all duration-200 flex items-center gap-1 ${
                                    isSelected
                                    ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-100"
                                }`}
                            >
                                {isSelected && <Check size={12} strokeWidth={3} />}
                                {cat.name}
                            </button>
                        );
                    })}
                </div>
            )}
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                {t('filters.price_range')}
            </label>
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <input
                        type="number"
                        name="price_min"
                        value={filters.price_min}
                        onChange={(e) => handleChange('price_min', e.target.value)}
                        className={`w-full h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none ${isRtl ? 'pr-2 pl-9' : 'pl-2 pr-9'}`}
                        placeholder="0"
                        min="0"
                    />
                    <span className={`absolute top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium ${isRtl ? 'left-3' : 'right-3'}`}>
                        {t('common.currency')}
                    </span>
                </div>

                <span className="text-gray-300 font-bold">-</span>

                <div className="relative flex-1">
                    <input
                        type="number"
                        name="price_max"
                        value={filters.price_max}
                        onChange={(e) => handleChange('price_max', e.target.value)}
                        className={`w-full h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none ${isRtl ? 'pr-2 pl-9' : 'pl-2 pr-9'}`}
                        placeholder="MAX"
                        min="0"
                    />
                    <span className={`absolute top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium ${isRtl ? 'left-3' : 'right-3'}`}>
                        {t('common.currency')}
                    </span>
                </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                {t('filters.weight_range')}
            </label>
            <div className="flex items-center gap-2">
                <div className="relative flex-1">
                    <input
                        type="number"
                        name="weight_min"
                        value={filters.weight_min}
                        onChange={(e) => handleChange('weight_min', e.target.value)}
                        className={`w-full h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none ${isRtl ? 'pr-2 pl-9' : 'pl-2 pr-9'}`}
                        placeholder="0"
                        min="0"
                    />
                    <span className={`absolute top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium ${isRtl ? 'left-3' : 'right-3'}`}>
                        {t('common.kg')}
                    </span>
                </div>

                <span className="text-gray-300 font-bold">-</span>

                <div className="relative flex-1">
                    <input
                        type="number"
                        name="weight_max"
                        value={filters.weight_max}
                        onChange={(e) => handleChange('weight_max', e.target.value)}
                        className={`w-full h-10 bg-gray-50 border border-gray-200 rounded-lg text-sm font-bold focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none ${isRtl ? 'pr-2 pl-9' : 'pl-2 pr-9'}`}
                        placeholder="MAX"
                        min="0"
                    />
                    <span className={`absolute top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-medium ${isRtl ? 'left-3' : 'right-3'}`}>
                        {t('common.kg')}
                    </span>
                </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <label className="text-xs font-bold text-gray-500 uppercase mb-3 block tracking-wider">
                {t('filters.gender')}
            </label>
            <div className="flex bg-gray-50 p-1 rounded-xl">
              {['', 'male', 'female'].map((gender) => (
                <button
                  key={gender}
                  type="button"
                  onClick={() => handleChange('sex', gender)}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                    filters.sex === gender
                      ? 'bg-white text-primary shadow-sm border border-gray-100'
                      : 'text-gray-400 hover:text-dark'
                  }`}
                >
                  {gender === '' ? t('filters.all') : gender === 'male' ? t('filters.male') : t('filters.female')}
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="p-4 border-t border-gray-100 bg-white lg:bg-transparent lg:border-0 lg:p-0 mt-auto lg:mt-6">
            <div className="flex gap-3">
                <button
                    onClick={onReset}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 hover:text-red-500 transition-colors text-sm"
                >
                    {t('common.reset')}
                </button>
                <button
                    onClick={onClose}
                    className="flex-[2] bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all text-sm lg:hidden"
                >
                    {t('filters.show_results')}
                </button>
            </div>
        </div>

      </aside>
    </>
  );
};

export default FilterSidebar;
