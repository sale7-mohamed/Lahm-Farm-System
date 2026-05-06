import React, { useState, useMemo, useDeferredValue } from 'react';
import { Accordion } from 'react-bootstrap';
import { HelpCircle, Search, BookOpen, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet';

const normalizeText = (text) => {
    if (!text) return '';
    return text
        .toLowerCase()
        .replace(/[\u064B-\u065F]/g, '')
        .replace(/(أ|إ|آ)/g, 'ا')
        .replace(/(ة)/g, 'ه')
        .replace(/(ى)/g, 'ي')
        .replace(/[^\w\s\u0600-\u06FF]/g, '');
};

const TextWithHighlight = ({ text, highlight }) => {
    if (!highlight || !highlight.trim()) return <span>{text}</span>;

    try {
        const escapedHighlight = highlight
            .split(' ')
            .filter(w => w)
            .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');

        if (!escapedHighlight) return <span>{text}</span>;

        const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));

        return (
            <span>
                {parts.map((part, i) =>
                    normalizeText(part).match(new RegExp(normalizeText(escapedHighlight), 'i')) ?
                    (<mark key={i} className="bg-yellow-200 text-dark rounded px-0.5 font-semibold mx-0.5">{part}</mark>) : part
                )}
            </span>
        );
    } catch (error) {
        console.error('Highlight error:', error);
        return <span>{text}</span>;
    }
};

const FAQ = () => {
    const { t } = useTranslation();
    const [searchQuery, setSearchQuery] = useState('');
    const deferredSearchQuery = useDeferredValue(searchQuery);
    const [activeCategory, setActiveCategory] = useState('all');

    const allQuestions = useMemo(() => {
        const questions = t('faq_page.questions', { returnObjects: true });
        return Array.isArray(questions) ? questions : [];
    }, [t]);

    const categories = useMemo(() =>[
        { id: 'all', label: t('faq_page.categories.all') },
        { id: 'eid', label: t('faq_page.categories.eid') },
        { id: 'conditions', label: t('faq_page.categories.conditions') },
        { id: 'sheep_goat', label: t('faq_page.categories.sheep_goat') },
        { id: 'fattening', label: t('faq_page.categories.fattening') },
        { id: 'age', label: t('faq_page.categories.age') },
        { id: 'sukuk', label: t('faq_page.categories.sukuk') },
        { id: 'buying', label: t('faq_page.categories.buying') },
        { id: 'general', label: t('faq_page.categories.general') },
        { id: 'horse_meat', label: t('faq_page.categories.horse_meat') },
        { id: 'halal_haram', label: t('faq_page.categories.halal_haram') },
        { id: 'philosophy', label: t('faq_page.categories.philosophy') },
    ], [t]);

    const filteredQuestions = useMemo(() => {
        const normalizedQuery = normalizeText(deferredSearchQuery);
        const searchTerms = normalizedQuery.split(' ').filter(term => term.length > 0);

        return allQuestions.filter(q => {
            const matchesCategory = activeCategory === 'all' || q.category === activeCategory;
            if (searchTerms.length === 0) return matchesCategory;

            const normalizedQ = normalizeText(q.q);
            const normalizedA = normalizeText(q.a);
            const normalizedK = normalizeText(q.keywords || '');

            const matchesSearch = searchTerms.every(term =>
                normalizedQ.includes(term) || normalizedA.includes(term) || normalizedK.includes(term)
            );
            return matchesCategory && matchesSearch;
        });
    }, [allQuestions, activeCategory, deferredSearchQuery]);

    const faqSchema = useMemo(() => ({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": allQuestions.slice(0, 50).map(q => ({
            "@type": "Question",
            "name": q.q,
            "acceptedAnswer": {
                "@type": "Answer",
                "text": q.a
            }
        }))
    }), [allQuestions]);

    return (
        <div className="bg-secondary/20 min-h-screen pb-20">
            <Helmet>
                <title>{t('faq_page.title')} | Lahm Farm</title>
                <meta name="description" content={t('faq_page.desc')} />
                <script type="application/ld+json">
                    {JSON.stringify(faqSchema)}
                </script>
            </Helmet>

            <div className="bg-white border-b border-gray-100 py-12 md:py-16 text-center relative overflow-hidden">
                <div className="container mx-auto px-4 relative z-10">
                    <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 text-primary rotate-3">
                        <BookOpen size={40} />
                    </div>
                    <h1 className="text-3xl md:text-5xl font-black text-dark mb-4">{t('faq_page.title')}</h1>
                    <p className="text-gray-500 text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
                        {t('faq_page.desc')}
                    </p>

                    <div className="max-w-2xl mx-auto relative group">
                        <div className="absolute inset-y-0 start-0 flex items-center ps-4 pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                            <Search size={22} />
                        </div>
                        <input
                            type="text"
                            className="block w-full p-4 ps-12 text-base text-gray-900 border border-gray-200 rounded-2xl bg-gray-50 focus:ring-4 focus:ring-primary/10 focus:border-primary focus:bg-white outline-none transition-all shadow-sm"
                            placeholder={t('faq_page.search_placeholder')}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                             <button
                                onClick={() => setSearchQuery('')}
                                className="absolute inset-y-0 end-0 flex items-center pe-4 text-gray-400 hover:text-red-500 transition-colors"
                             >
                                <X size={18} />
                             </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="flex gap-2 overflow-x-auto pb-4 mb-6 hide-scrollbar py-2 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:justify-center">
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => { setActiveCategory(cat.id); }}
                            className={`flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm border whitespace-nowrap ${
                                activeCategory === cat.id
                                ? 'bg-primary text-white border-primary transform scale-105'
                                : 'bg-white text-gray-600 border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                            }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>

                {filteredQuestions.length > 0 ? (
                    <Accordion defaultActiveKey="0" flush className="faq-accordion space-y-4">
                        {filteredQuestions.map((item, idx) => (
                            <Accordion.Item
                                eventKey={idx.toString()}
                                key={idx}
                                className="border-0 rounded-2xl overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow duration-300"
                            >
                                <Accordion.Header className="py-2 px-1">
                                    <div className="flex items-center gap-3 w-full">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                            <HelpCircle size={18} />
                                        </div>
                                        <span className="font-bold text-dark text-base md:text-lg flex-grow text-start leading-snug">
                                            <TextWithHighlight text={item.q} highlight={deferredSearchQuery} />
                                        </span>
                                    </div>
                                </Accordion.Header>
                                <Accordion.Body className="bg-gray-50/50 text-gray-600 leading-relaxed px-5 pb-5 pt-0 text-base border-t border-gray-50">
                                    <div className="pt-3">
                                        <TextWithHighlight text={item.a} highlight={deferredSearchQuery} />
                                    </div>
                                </Accordion.Body>
                            </Accordion.Item>
                        ))}
                    </Accordion>
                ) : (
                    <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-200 mt-6">
                        <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                            <Search size={32} />
                        </div>
                        <h3 className="text-lg font-bold text-dark mb-2">{t('livestock_page.no_results')}</h3>
                        <p className="text-muted mb-6 max-w-xs mx-auto text-sm">{t('livestock_page.no_results_desc')}</p>
                        <button
                            onClick={() => { setSearchQuery(''); setActiveCategory('all'); }}
                            className="text-primary font-bold hover:underline"
                        >
                            {t('livestock_page.reset_filters')}
                        </button>
                    </div>
                )}
            </div>

             <style>{`
                .faq-accordion .accordion-button {
                    background-color: white;
                    box-shadow: none;
                    padding: 1.25rem;
                    -webkit-tap-highlight-color: transparent !important;
                }
                .faq-accordion .accordion-button:focus,
                .faq-accordion .accordion-button:active {
                    box-shadow: none !important;
                    background-color: white !important;
                    border-color: rgba(0,0,0,0.05);
                    color: inherit;
                }
                .faq-accordion .accordion-button:not(.collapsed) {
                    background-color: white !important;
                    color: var(--bs-primary);
                    box-shadow: none !important;
                }
                .faq-accordion .accordion-button::after {
                    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='%23198754'%3e%3cpath fill-rule='evenodd' d='M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z'/%3e%3c/svg%3e");
                    transition: transform 0.3s ease;
                }
                .faq-accordion .accordion-button:not(.collapsed)::after {
                    transform: rotate(-180deg);
                }
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

export default FAQ;
