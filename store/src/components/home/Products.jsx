import React, { useEffect, useState } from "react";
import axios from "../../services/axiosConfig";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

const Categories = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCategories = async () => {
        try {
            const res = await axios.get("/livestock/categories/");
            setCategories(res.data.results || res.data ||[]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };
    fetchCategories();
  },[]);

  if (loading) return <div className="py-20 text-center"><div className="spinner-border text-primary" role="status"></div></div>;

  return (
    <section className="py-12 bg-white">
        <div className="container mx-auto px-4">
            <div className="flex justify-between items-end mb-8">
                <div>
                    <h2 className="text-2xl md:text-3xl font-black text-dark mb-2">{t('home.browse_category')}</h2>
                    <p className="text-muted text-sm md:text-base">{t('home.choose_category')}</p>
                </div>
                <Link to="/livestock" className="hidden md:flex items-center gap-1 font-bold text-primary hover:gap-2 transition-all text-sm md:text-base">
                    {t('home.view_all_livestock')} {isRtl ? <ArrowLeft size={18}/> : <ArrowRight size={18}/>}
                </Link>
            </div>

            {/* Mobile: 2 cols, Desktop: 4 cols */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                {categories.map((cat) => (
                    <Link
                        key={cat.id}
                        to={`/livestock?category=${cat.slug}`}
                        className="group relative overflow-hidden rounded-3xl aspect-[4/5] bg-gray-100 shadow-sm hover:shadow-md transition-all block"
                    >
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 z-10"></div>

                        {}
                        <div className="absolute inset-0 bg-gray-200 overflow-hidden">
                            {cat.image ? (
                                <img
                                    src={cat.image}
                                    alt={cat.name}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    loading="lazy"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-4xl md:text-6xl opacity-20 font-black text-dark group-hover:scale-110 transition-transform duration-500">
                                        {cat.name.charAt(0)}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-4 z-20 text-white">
                            <h3 className="text-lg md:text-xl font-bold mb-1 group-hover:text-accent transition-colors">{cat.name}</h3>
                            <p className="text-[10px] md:text-xs opacity-90 font-light flex items-center gap-1">
                                {t('home.weights_types')}
                                {isRtl ? <ArrowLeft size={12}/> : <ArrowRight size={12}/>}
                            </p>
                        </div>
                    </Link>
                ))}
            </div>

            <div className="mt-6 md:hidden text-center">
                <Link to="/livestock" className="btn btn-outline w-full justify-center">
                    {t('home.view_all_livestock')}
                </Link>
            </div>
        </div>
    </section>
  );
};

export default Categories;