import React, { useState, useEffect, useCallback } from 'react';
import axios from '../services/axiosConfig';
import { useTranslation } from 'react-i18next';
import {
    Sparkles, ArrowRight, ArrowLeft, History, Target,
    Users, User, Wallet, RefreshCw, CheckCircle2, Activity
} from 'lucide-react';
import ProductCard from '../components/ui/ProductCard';
import useAuth from '../context/auth/useAuth';
import DOMPurify from 'dompurify';

const Recommendations = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [animals, setAnimals] = useState([]);
    const [historyBasedRecs, setHistoryBasedRecs] = useState([]);
    const [historyAnalysisText, setHistoryAnalysisText] = useState('');
    const [wizardStep, setWizardStep] = useState(0);
    const [wizardAnswers, setWizardAnswers] = useState({
        purpose: '',
        familySize: '',
        budget: ''
    });
    const [wizardResults, setWizardResults] = useState([]);

    const analyzeHistory = useCallback((pastOrders, availableAnimals) => {
        if (!pastOrders || pastOrders.length === 0) return;

        const categoryCounts = {};
        let sharesCount = 0;
        let fullPurchaseCount = 0;

        pastOrders.forEach(order => {
            if (order.status !== 'canceled') {
                order.items?.forEach(item => {
                    const catName = item.animal?.category_name;
                    if (catName) {
                        categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
                    }
                    if (item.share_quantity > 0 && item.animal?.max_shares > 1 && item.share_quantity < item.animal?.max_shares) {
                        sharesCount++;
                    } else {
                        fullPurchaseCount++;
                    }
                });
            }
        });

        let favoriteCategory = '';
        let maxCount = 0;
        Object.entries(categoryCounts).forEach(([cat, count]) => {
            if (count > maxCount) {
                maxCount = count;
                favoriteCategory = cat;
            }
        });

        if (!favoriteCategory) return;

        const prefersShares = sharesCount > fullPurchaseCount;

        let text = `${t('recommendations.history_analysis1', 'بناءً على طلباتك السابقة، لاحظنا أنك تفضل شراء ')} `;
        text += `<strong class="text-primary">${favoriteCategory}</strong> `;
        text += prefersShares
            ? `${t('recommendations.history_analysis2', 'بنظام')} <strong class="text-primary">${t('recommendations.history_analysis_shares', 'أسهم التشارك')}</strong>.`
            : `${t('recommendations.history_analysis_full', 'بالكامل.')}`;

        setHistoryAnalysisText(text);

        let matchedAnimals = availableAnimals.filter(a => a.category_name === favoriteCategory);

        if (prefersShares) {
            matchedAnimals = matchedAnimals.filter(a => a.is_shareable || a.is_adahi_pool);
        }

        setHistoryBasedRecs(matchedAnimals.slice(0, 4));
    }, [t]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [animalsRes, ordersRes] = await Promise.all([
                    axios.get('/livestock/animals/?status=available&limit=100'),
                    axios.get('/orders/list/')
                ]);

                const fetchedAnimals = animalsRes.data?.results || animalsRes.data || [];
                setAnimals(fetchedAnimals);

                const fetchedOrders = ordersRes.data?.results || ordersRes.data || [];
                analyzeHistory(fetchedOrders, fetchedAnimals);
            } catch (error) {
                console.error("Failed to load recommendation data", error);
            } finally {
                setLoading(false);
            }
        };

        if (user) {
            fetchData();
        } else {
            setLoading(false);
        }
    }, [user, analyzeHistory]);

    const calculateWizardResults = () => {
        const { purpose, familySize, budget } = wizardAnswers;

        let scoredAnimals = animals.map(animal => {
            let score = 0;
            let matchReason = "";
            let recommendedContext = "general";

            const price = parseFloat(animal.price_after_discount || animal.price_egp);
            const isSheepOrGoat = animal.category?.logic_type === 'sheep' || animal.category?.logic_type === 'goat';
            const isCowOrCamel = animal.category?.logic_type === 'cow' || animal.category?.logic_type === 'camel';
            const hasDefect = animal.has_defect;
            const netMeatYield = (parseFloat(animal.current_weight || 0) * 0.5).toFixed(0);

            if (purpose === 'aqiqah') {
                if (!isSheepOrGoat) score -= 100;
                else { score += 50; matchReason = t('recommendations.match_aqiqah', "مثالي للعقيقة (خروف كامل)"); }
            } else if (purpose === 'udhiyah') {
                if (hasDefect) score -= 100;
                if (animal.is_sacrifice_valid_now) { score += 50; matchReason = t('recommendations.match_udhiyah', "مطابق للشروط الشرعية للأضحية"); }
            } else if (purpose === 'fridge') {
                if (animal.is_shareable) { score += 30; recommendedContext = "shares"; }
            }

            let priceToConsider = price;
            if (budget === 'economic' && animal.is_shareable && isCowOrCamel) {
                priceToConsider = price / 7;
                recommendedContext = "shares";
                matchReason = t('recommendations.match_economic_share', "سهم تشارك اقتصادي يوفر لك لحم ممتاز بسعر مناسب");
            } else if (budget === 'economic' && price > 15000) {
                score -= 50;
            }

            if (budget === 'economic' && priceToConsider < 10000) score += 40;
            if (budget === 'mid' && priceToConsider >= 10000 && priceToConsider <= 25000) score += 40;
            if (budget === 'open') score += 20;

            const familyFactor = familySize === 'small' ? 10 : familySize === 'medium' ? 20 : 40;
            let expectedMeatForUser = netMeatYield;
            if (recommendedContext === "shares" && isCowOrCamel) {
                expectedMeatForUser = (netMeatYield / 7).toFixed(0);
            }

            if (expectedMeatForUser >= familyFactor && expectedMeatForUser <= familyFactor * 2.5) {
                score += 30;
                if (!matchReason) matchReason = t('recommendations.match_yield', `سيوفر تقريباً {{amount}} كجم لحم صافي`, { amount: expectedMeatForUser });
            }

            return {
                ...animal,
                matchScore: score,
                matchReason: matchReason || t('recommendations.match_yield', `سيوفر تقريباً {{amount}} كجم لحم صافي`, { amount: expectedMeatForUser }),
                recommendedContext
            };
        });

        scoredAnimals = scoredAnimals.filter(a => a.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);
        setWizardResults(scoredAnimals.slice(0, 4));
        setWizardStep(4);
    };

    const handleNextStep = (answerKey, answerValue) => {
        setWizardAnswers(prev => ({ ...prev, [answerKey]: answerValue }));
        if (wizardStep === 3) {
            setWizardStep(3.5);
            setTimeout(() => {
                calculateWizardResults();
            }, 1500);
        } else {
            setWizardStep(prev => prev + 1);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    const purposeOptions = [
        { id: 'fridge', title: t('recommendations.purpose_fridge', 'تعبئة ثلاجة البيت'), icon: '🥩', desc: t('recommendations.purpose_fridge_desc', 'توفير لحم ممتاز للاستخدام اليومي') },
        { id: 'udhiyah', title: t('recommendations.purpose_udhiyah', 'أضحية العيد'), icon: '🐑', desc: t('recommendations.purpose_udhiyah_desc', 'مطابقة للشروط الشرعية') },
        { id: 'aqiqah', title: t('recommendations.purpose_aqiqah', 'عقيقة للمولود'), icon: '👶', desc: t('recommendations.purpose_aqiqah_desc', 'خراف وماعز كاملة فقط') },
        { id: 'charity', title: t('recommendations.purpose_charity', 'صدقة وتوزيع'), icon: '🤲', desc: t('recommendations.purpose_charity_desc', 'أفضل قيمة لتوزيع أكبر كمية') },
    ];

    const familySizeOptions = [
        { id: 'small', title: t('recommendations.family_small', 'أسرة صغيرة'), icon: <User size={24}/>, desc: t('recommendations.family_small_desc', 'حوالي 10 إلى 20 كجم لحم') },
        { id: 'medium', title: t('recommendations.family_medium', 'أسرة متوسطة'), icon: <Users size={24}/>, desc: t('recommendations.family_medium_desc', 'حوالي 30 إلى 50 كجم لحم') },
        { id: 'large', title: t('recommendations.family_large', 'أسرة كبيرة / عزومة'), icon: <Users size={32}/>, desc: t('recommendations.family_large_desc', 'أكثر من 50 كجم لحم') },
    ];

    const budgetOptions = [
        { id: 'economic', title: t('recommendations.budget_economic', 'اقتصادية'), icon: <Wallet size={24}/>, desc: t('recommendations.budget_economic_desc', 'أفضل قيمة مقابل سعر (ترشيح للأسهم)') },
        { id: 'mid', title: t('recommendations.budget_mid', 'متوسطة'), icon: <Wallet size={24}/>, desc: t('recommendations.budget_mid_desc', 'خيارات متوازنة') },
        { id: 'open', title: t('recommendations.budget_open', 'مفتوحة / جودة عالية'), icon: <Wallet size={24}/>, desc: t('recommendations.budget_open_desc', 'أوزان كبيرة وأصناف مميزة') },
    ];

    return (
        <div className="min-h-screen bg-secondary/20 pb-20">
            <div className="bg-dark text-white py-12 relative overflow-hidden">
                <div className={`absolute top-0 ${isRtl ? 'right-0' : 'left-0'} w-full h-full bg-primary/10`}></div>
                <div className="container mx-auto px-4 relative z-10 text-center">
                    <div className="bg-yellow-400/20 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-yellow-400/30">
                        <Sparkles size={32} className="text-yellow-400" />
                    </div>
                    <h1 className="text-2xl md:text-4xl font-black mb-2">{t('recommendations.title', 'المستشار الذكي والتوصيات')}</h1>
                    <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto">
                        {t('recommendations.desc', 'دعنا نساعدك في اختيار الماشية أو الأسهم الأنسب لاحتياجاتك وميزانيتك بكل سهولة.')}
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 max-w-5xl">
                {historyBasedRecs.length > 0 && wizardStep === 0 && (
                    <div className="mb-12 animate-fade-in-up">
                        <div className="flex items-center gap-2 mb-4">
                            <History className="text-primary" size={24} />
                            <h2 className="text-xl font-bold text-dark m-0">{t('recommendations.custom_for_you', 'مصممة خصيصاً لك')}</h2>
                        </div>

                        <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl mb-6 shadow-sm">
                            <p className="text-blue-900 m-0 leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(historyAnalysisText) }}></p>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                            {historyBasedRecs.map(animal => (
                                <ProductCard
                                    key={animal.id}
                                    animal={animal}
                                    context={animal.is_shareable ? 'shares' : 'general'}
                                />
                            ))}
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                    {wizardStep === 0 && (
                        <div className="p-8 md:p-12 text-center">
                            <div className="w-20 h-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                                <Target size={40} />
                            </div>
                            <h3 className="text-2xl font-black text-dark mb-4">{t('recommendations.wizard_start_title', 'محتار تشتري إيه؟')}</h3>
                            <p className="text-gray-500 mb-8 max-w-lg mx-auto leading-relaxed">
                                {t('recommendations.wizard_start_desc', 'أجب عن 3 أسئلة سريعة فقط، وسيقوم النظام الذكي لدينا بحساب كمية اللحم الصافي واقتراح أفضل الخيارات التي تناسب أسرتك وميزانيتك.')}
                            </p>
                            <button
                                onClick={() => setWizardStep(1)}
                                className="btn btn-primary px-8 py-3 rounded-xl shadow-lg hover:-translate-y-1 text-lg mx-auto"
                            >
                                {t('recommendations.start_test', 'ابدأ الاختبار الآن')}
                            </button>
                        </div>
                    )}

                    {wizardStep === 1 && (
                        <div className="p-6 md:p-10 animate-fade-in">
                            <div className="text-center mb-8">
                                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full mb-3 inline-block">{t('recommendations.step1_of_3', 'الخطوة 1 من 3')}</span>
                                <h3 className="text-xl md:text-2xl font-bold text-dark">{t('recommendations.question1', 'ما هو الهدف الرئيسي من الشراء؟')}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                                {purposeOptions.map(option => (
                                    <button key={option.id} onClick={() => handleNextStep('purpose', option.id)} className="text-start p-5 rounded-2xl border-2 border-gray-100 hover:border-primary hover:bg-primary/5 transition-all group">
                                        <div className="text-3xl mb-3">{option.icon}</div>
                                        <h4 className="font-bold text-dark group-hover:text-primary mb-1">{option.title}</h4>
                                        <p className="text-xs text-gray-500 m-0">{option.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {wizardStep === 2 && (
                        <div className="p-6 md:p-10 animate-fade-in">
                            <button onClick={() => setWizardStep(1)} className="text-gray-400 hover:text-dark mb-4 flex items-center gap-1 text-sm font-bold">
                                {isRtl ? <ArrowRight size={16}/> : <ArrowLeft size={16}/>} {t('recommendations.back', 'رجوع')}
                            </button>
                            <div className="text-center mb-8">
                                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full mb-3 inline-block">{t('recommendations.step2_of_3', 'الخطوة 2 من 3')}</span>
                                <h3 className="text-xl md:text-2xl font-bold text-dark">{t('recommendations.question2', 'كم كمية اللحم الصافي التي تستهدفها تقريباً؟')}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                                {familySizeOptions.map(option => (
                                    <button key={option.id} onClick={() => handleNextStep('familySize', option.id)} className="flex flex-col items-center text-center p-6 rounded-2xl border-2 border-gray-100 hover:border-primary hover:bg-primary/5 transition-all group">
                                        <div className="text-gray-400 group-hover:text-primary mb-3">{option.icon}</div>
                                        <h4 className="font-bold text-dark group-hover:text-primary mb-2">{option.title}</h4>
                                        <p className="text-xs text-gray-500 m-0">{option.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {wizardStep === 3 && (
                        <div className="p-6 md:p-10 animate-fade-in">
                             <button onClick={() => setWizardStep(2)} className="text-gray-400 hover:text-dark mb-4 flex items-center gap-1 text-sm font-bold">
                                {isRtl ? <ArrowRight size={16}/> : <ArrowLeft size={16}/>} {t('recommendations.back', 'رجوع')}
                            </button>
                            <div className="text-center mb-8">
                                <span className="text-xs font-bold text-primary bg-primary/10 px-3 py-1 rounded-full mb-3 inline-block">{t('recommendations.step3_of_3', 'الخطوة 3 من 3')}</span>
                                <h3 className="text-xl md:text-2xl font-bold text-dark">{t('recommendations.question3', 'ما هي الميزانية التقريبية التي تفضلها؟')}</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                                {budgetOptions.map(option => (
                                    <button key={option.id} onClick={() => handleNextStep('budget', option.id)} className="flex flex-col items-center text-center p-6 rounded-2xl border-2 border-gray-100 hover:border-primary hover:bg-primary/5 transition-all group">
                                        <div className="text-gray-400 group-hover:text-primary mb-3">{option.icon}</div>
                                        <h4 className="font-bold text-dark group-hover:text-primary mb-2">{option.title}</h4>
                                        <p className="text-xs text-gray-500 m-0">{option.desc}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {wizardStep === 3.5 && (
                        <div className="p-20 text-center animate-fade-in">
                            <div className="relative w-24 h-24 mx-auto mb-6">
                                <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                                <div className="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                                <Activity className="absolute inset-0 m-auto text-primary" size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-dark mb-2">{t('recommendations.searching_data', 'جاري البحث وتحليل البيانات...')}</h3>
                            <p className="text-gray-500">{t('recommendations.finding_best_options', 'نبحث لك عن أفضل الخيارات المطابقة لمواصفاتك')}</p>
                        </div>
                    )}

                    {wizardStep === 4 && (
                        <div className="p-4 md:p-8 bg-green-50/30 animate-fade-in-up pb-8 rounded-b-3xl">
                            {wizardResults.length > 0 ? (
                                <>
                                    <div className="text-center mb-6 pt-4 md:pt-0">
                                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-4 shadow-sm border border-green-200">
                                            <CheckCircle2 size={32} />
                                        </div>
                                        <h3 className="text-2xl md:text-3xl font-black text-dark mb-2">{t('recommendations.found_options_title', 'وجدنا لك هذه الخيارات!')}</h3>
                                        <p className="text-gray-600 text-sm md:text-base px-2">{t('recommendations.found_options_desc', 'بناءً على إجاباتك، قمنا بترشيح أفضل الخيارات التي تناسبك تماماً.')}</p>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-6 mt-4">
                                        {wizardResults.map((animal, index) => (
                                            <div key={animal.id} className="relative flex flex-col bg-white rounded-2xl p-1 shadow-sm border border-gray-100 hover:shadow-md transition-shadow h-full">
                                                {index === 0 && (
                                                    <div className="absolute -top-3 -right-2 bg-red-500 text-white text-[10px] md:text-xs font-bold px-3 py-1 rounded-full shadow-md z-20 animate-bounce-slow">
                                                        {t('recommendations.best_option_badge', 'الخيار الأنسب لك 🔥')}
                                                    </div>
                                                )}
                                                <div className="flex-grow">
                                                    <ProductCard animal={animal} context={animal.recommendedContext} />
                                                </div>
                                                <div className="mt-2 bg-green-50 border border-green-100 p-2 rounded-xl text-center mx-1 mb-1">
                                                    <p className="text-green-800 text-[9px] md:text-xs m-0 font-bold leading-tight">
                                                        ✨ {animal.matchReason}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12 px-4 bg-white rounded-3xl border border-dashed border-gray-300 shadow-sm mx-auto mt-6 max-w-md">
                                    <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Target size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-dark mb-2">{t('recommendations.no_exact_match_title', 'لم نجد نتائج مطابقة 100%')}</h3>
                                    <p className="text-gray-500 mb-6 text-sm leading-relaxed">
                                        {t('recommendations.no_exact_match_desc', 'عذراً، لا يوجد لدينا مواشي تتطابق بدقة مع اختياراتك الحالية للميزانية والهدف.')}
                                    </p>
                                    <div className="flex justify-center">
                                        <button
                                            onClick={() => setWizardStep(1)}
                                            className="btn btn-outline flex items-center justify-center gap-2 px-6 shadow-sm hover:shadow-md"
                                        >
                                            <RefreshCw size={18} /> {t('recommendations.edit_search_options', 'تعديل خيارات البحث')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {wizardResults.length > 0 && (
                                <div className="text-center mt-8 mb-2">
                                    <button
                                        onClick={() => {
                                            setWizardStep(0);
                                            setWizardAnswers({purpose: '', familySize: '', budget: ''});
                                        }}
                                        className="text-gray-500 hover:text-primary font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors p-2 bg-white rounded-full px-4 shadow-sm border border-gray-100"
                                    >
                                        <RefreshCw size={16} /> {t('recommendations.retake_test', 'إعادة الاختبار')}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
            `}</style>
        </div>
    );
};

export default Recommendations;
