// src/pages/Livestock.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "../services/axiosConfig";
import { useSearchParams } from "react-router-dom";
import { toast } from "react-toastify";
import { useTranslation } from "react-i18next";
import { SlidersHorizontal, SearchX, Target } from "lucide-react";
import ProductCard from "../components/ui/ProductCard";
import FilterSidebar from "../components/ui/FilterSidebar";
import useDebounce from "../hooks/useDebounce";

function Livestock() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  const[listings, setListings] = useState([]);
  const [closestListings, setClosestListings] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const[page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showFallback, setShowFallback] = useState({
    active: false,
    originalSearch: "",
    targetWeight: null,
    targetPrice: null,
  });

  const [filters, setFilters] = useState({
    category: searchParams.get("category") || "",
    sex: searchParams.get("sex") || "",
    price_min: searchParams.get("price_min") || "",
    price_max: searchParams.get("price_max") || "",
    weight_min: searchParams.get("weight_min") || "",
    weight_max: searchParams.get("weight_max") || "",
    search: searchParams.get("search") || "",
    ordering: searchParams.get("ordering") || "-created_at",
  });

  const debouncedSearch = useDebounce(filters.search, 500);
  const isFirstMount = useRef(true);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get("/livestock/categories/");
        const fetchedCats = response?.data?.results || response?.data ||[];
        setCategories(fetchedCats);

        const inferred = searchParams.get("inferred_cats");
        if (inferred && fetchedCats.length > 0) {
          const inferredArray = inferred.split(",");
          const matchedSlugs = fetchedCats
            .filter((cat) =>
              inferredArray.some((inf) => cat.name_ar.includes(inf))
            )
            .map((cat) => cat.slug);

          if (matchedSlugs.length > 0) {
            setFilters((prev) => ({ ...prev, category: matchedSlugs.join(",") }));
          }

          const newParams = new URLSearchParams(searchParams);
          newParams.delete("inferred_cats");
          setSearchParams(newParams, { replace: true });
        }
      } catch (error) {
        console.error("Error fetching categories:", error);
      }
    };
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  useEffect(() => {
    if (isFirstMount.current) return;
    const urlSearch = searchParams.get("search") || "";
    setFilters((prev) =>
      prev.search !== urlSearch ? { ...prev, search: urlSearch } : prev
    );
  }, [searchParams]);

  const fetchClosestMatches = async (currentFilters, targetWeight, targetPrice) => {
    try {
      const params = new URLSearchParams();
      if (currentFilters.category) params.append("category", currentFilters.category);
      params.append("status", "available");

      const response = await axios.get("/livestock/market/", { params });
      const allAnimals = response.data.results ||[];

      allAnimals.sort((a, b) => {
        if (targetPrice) {
          const pA = parseFloat(a.price_after_discount || a.price_egp || 0);
          const pB = parseFloat(b.price_after_discount || b.price_egp || 0);
          return Math.abs(pA - targetPrice) - Math.abs(pB - targetPrice);
        } else if (targetWeight) {
          const wA = parseFloat(a.animal_details?.current_weight || 0);
          const wB = parseFloat(b.animal_details?.current_weight || 0);
          return Math.abs(wA - targetWeight) - Math.abs(wB - targetWeight);
        }
        return 0;
      });

      setClosestListings(allAnimals.slice(0, 4));
      setShowFallback({
        active: true,
        originalSearch: currentFilters.search,
        targetWeight,
        targetPrice,
      });
    } catch (error) {
      console.error("Failed to fetch closest matches", error);
    } finally {
      setLoading(false);
    }
  };

  const targetWeightStr = searchParams.get("target_weight");
  const targetPriceStr = searchParams.get("target_price");

  const fetchListings = useCallback(
    async (currentFilters, pageNum = 1) => {
      if (pageNum === 1) {
        setLoading(true);
        setClosestListings([]);
      } else {
        setLoadingMore(true);
      }
      setShowFallback({
        active: false,
        originalSearch: "",
        targetWeight: null,
        targetPrice: null,
      });

      try {
        const params = new URLSearchParams();
        params.append("page", pageNum);

        Object.entries(currentFilters).forEach(([key, value]) => {
          if (key === "search" && value) {
            let cleanSearch = value
              .replace(/\d+(\.\d+)?/g, "")
              .replace(/وزن|كيلو|كجم|kg|سعر|بسعر|بـ/gi, "")
              .trim();
            if (cleanSearch) params.append("search", cleanSearch);
          } else if (value && value.toString().trim() !== "") {
            params.append(key, value.toString());
          }
        });

        const response = await axios.get("/livestock/market/", { params });
        const results = response.data.results ||[];

        if (results.length > 0) {
          if (pageNum === 1) {
            setListings(results);
          } else {
            setListings((prev) => [...prev, ...results]);
          }
          setHasMore(!!response.data.next);
        } else {
          if (pageNum === 1) setListings([]);
          setHasMore(false);

          if (pageNum === 1) {
            const tWeightStr = targetWeightStr;
            const tPriceStr = targetPriceStr;
            const tWeight = tWeightStr ? parseFloat(tWeightStr) : null;
            const tPrice = tPriceStr ? parseFloat(tPriceStr) : null;

            if ((tWeight || tPrice) && currentFilters.search) {
              await fetchClosestMatches(currentFilters, tWeight, tPrice);
            }
          }
        }
      } catch {
        if (pageNum === 1) setListings([]);
        toast.error(t("errors.generic"));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [targetWeightStr, targetPriceStr, t]
  );

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchListings({ ...filters, search: debouncedSearch }, nextPage);
  };

  const { search: _search, ...otherFilters } = filters;
  const otherFiltersString = JSON.stringify(otherFilters);

  useEffect(() => {
    const currentOtherFilters = JSON.parse(otherFiltersString);
    const activeFilters = { ...currentOtherFilters, search: debouncedSearch };

    setPage(1);
    fetchListings(activeFilters, 1);
  }, [otherFiltersString, debouncedSearch, fetchListings]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    const newParams = new URLSearchParams(searchParams);
    if (value) newParams.set(name, value);
    else newParams.delete(name);
    setSearchParams(newParams, { replace: true });
  };

  const resetFilters = () => {
    setFilters({
      category: "",
      sex: "",
      price_min: "",
      price_max: "",
      weight_min: "",
      weight_max: "",
      search: "",
      ordering: "-created_at",
    });
    setSearchParams({}, { replace: true });
    setShowFallback({
      active: false,
      originalSearch: "",
      targetWeight: null,
      targetPrice: null,
    });
    setPage(1);
    setHasMore(false);
  };

  return (
    <div className="bg-secondary/20 min-h-screen pb-20">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-dark flex items-center gap-2 mb-2">
              <span>🐮 {t("livestock_page.title")}</span>
            </h1>
            {!showFallback.active && (
              <p className="text-sm text-muted font-medium bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100 inline-block">
                {loading ? "..." : listings.length}{" "}
                {t("livestock_page.available")}
              </p>
            )}
          </div>

          <button
            className="lg:hidden w-full md:w-auto flex items-center justify-center gap-2 bg-white border border-gray-200 text-dark px-4 py-3 rounded-xl shadow-sm font-bold text-sm hover:bg-gray-50 active:scale-95 transition-all"
            onClick={() => setIsFilterOpen(true)}
          >
            <SlidersHorizontal size={18} />
            {t("livestock_page.filter")}
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-8 items-start relative">
          <div className="lg:w-80 flex-shrink-0">
            <FilterSidebar
              filters={filters}
              categories={categories}
              onFilterChange={handleFilterChange}
              onReset={resetFilters}
              isOpen={isFilterOpen}
              onClose={() => setIsFilterOpen(false)}
            />
          </div>

          <div className="flex-grow w-full">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent shadow-lg mb-4"></div>
                <p className="text-muted font-medium">
                  {t("livestock_page.loading")}
                </p>
              </div>
            ) : showFallback.active ? (
              <div className="animate-fade-in-up">
                <div className="bg-white rounded-3xl border border-orange-100 shadow-sm p-6 text-center mb-8">
                  <div className="bg-orange-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target size={40} className="text-orange-500" />
                  </div>
                  <h3 className="text-xl font-bold text-dark mb-2">
                    {t('livestock_page.fallback_not_exact', 'عذراً، "{{search}}" غير متاح حالياً بالظبط!', { search: showFallback.originalSearch })}
                  </h3>
                  <p className="text-muted max-w-md mx-auto">
                    {t('livestock_page.fallback_dont_worry', 'لكن لا تقلق، بحثنا في مزارعنا وجلبنا لك أقرب المواشي {{type}} لفئة طلبك.', { type: showFallback.targetPrice ? t('common.price', 'سعراً') : t('common.weight', 'وزناً') })}
                  </p>
                  <button
                    onClick={resetFilters}
                    className="mt-4 text-primary font-bold hover:underline"
                  >
                    {t('livestock_page.clear_filters_show_all', 'مسح الفلاتر وعرض كل المتاح')}
                  </button>
                </div>

                <h4 className="font-bold text-dark mb-4 flex items-center gap-2">
                  <Target className="text-primary" size={20} />
                  {t('livestock_page.closest_matches', 'أقرب الخيارات لطلبك ({{value}}):', {
                    value: showFallback.targetPrice
                      ? `${showFallback.targetPrice} ${t('common.currency_symbol')}`
                      : `${showFallback.targetWeight} ${t('common.kg')}`
                  })}
                </h4>

                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
                  {closestListings.map((listing) => (
                    <ProductCard key={listing.id} listing={listing} />
                  ))}
                </div>
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm text-center px-4 animate-fade-in">
                <div className="bg-gray-50 p-6 rounded-full mb-4">
                  <SearchX size={48} className="text-gray-300" />
                </div>
                <h3 className="text-xl font-bold text-dark mb-2">
                  {t("livestock_page.no_results")}
                </h3>
                <p className="text-muted max-w-xs mx-auto mb-6">
                  {t("livestock_page.no_results_desc")}
                </p>
                <button onClick={resetFilters} className="btn btn-outline px-6">
                  {t("livestock_page.reset_filters")}
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-6">
                  {listings.map((listing) => (
                    <ProductCard key={listing.id} listing={listing} />
                  ))}
                </div>

                {hasMore && (
                  <div className="text-center mt-8">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="btn btn-primary px-8 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                    >
                      {loadingMore ? t('common.loading') : t('livestock_page.load_more', 'عرض المزيد من المواشي')}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Livestock;
