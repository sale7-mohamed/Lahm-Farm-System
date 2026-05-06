// src/pages/Cart.jsx
import React, { useEffect, useState, useCallback } from "react";
import { toast } from "react-toastify";
import { useNavigate, Link } from "react-router-dom";
import useAuth from '../context/auth/useAuth';
import { useApp } from '../context/app/useApp';
import axios from "../services/axiosConfig";
import ConfirmModal from "../components/ui/ConfirmModal";
import {
  Trash2,
  Edit3,
  ShoppingBag,
  ArrowRight,
  ArrowLeft,
  CreditCard,
  Users,
  Tag,
  AlertTriangle
} from "lucide-react";
import { useTranslation } from "react-i18next";

function Cart() {
  const { t, i18n } = useTranslation();
  const[cartData, setCartData] = useState({
    items: [],
    cart_totals: {}
  });
  const[loading, setLoading] = useState(true);
  const [itemToDelete, setItemToDelete] = useState(null);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { triggerRefetch } = useApp();
  const isRtl = i18n.language === 'ar';

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);

      if (user) {
        const response = await axios.get("/cart/");
        const serverData = response.data || { items:[], cart_totals: {} };

        let finalTotal = Number(serverData.cart_totals?.total_price) || 0;
        let calculatedDepositTotal = 0;

        if (serverData.items?.length > 0) {
          serverData.items.forEach(item => {
            if (item.animal?.status !== 'available') return;

            const itemFinalPrice = Number(item.calculated_details?.final_price) || Number(item.price_per_item) || 0;
            const paymentType = item.selected_services?.payment_type || item.payment_type;
            const userDeposit = Number(item.selected_services?.user_entered_deposit_amount) || Number(item.user_entered_deposit_amount) || 0;

            if (paymentType === 'deposit' && userDeposit > 0) {
              calculatedDepositTotal += userDeposit;
            } else {
              calculatedDepositTotal += itemFinalPrice;
            }
          });

          if (finalTotal === 0) {
            finalTotal = serverData.items.reduce((sum, item) => {
              if (item.animal?.status !== 'available') return sum;
              return sum + (Number(item.calculated_details?.final_price) || Number(item.price_per_item) || 0);
            }, 0);
          }
        }

        if (!serverData.cart_totals) serverData.cart_totals = {};
        serverData.cart_totals.total_price = finalTotal;
        serverData.deposit_total = Math.min(calculatedDepositTotal, finalTotal).toFixed(2);

        setCartData(serverData);
      } else {
        const rawGuestCart = localStorage.getItem('guestCart');
        const guestCart = rawGuestCart ? JSON.parse(rawGuestCart) :[];

        const enrichedItemsResults = await Promise.allSettled(
          guestCart.map(async (item) => {
            const identifier = item.animal_unique_id || item.animal_id;
            const animalRes = await axios.get(`/livestock/animals/${identifier}/`);

            const priceRes = await axios.post('/livestock/calculate-price-preview/', {
              animal_id: item.animal_id,
              services: item.selected_services || {},
              share_quantity: item.share_quantity || 1
            });

            return {
              ...item,
              id: item.animal_id,
              animal: animalRes.data,
              calculated_details: priceRes.data
            };
          })
        );

        const validItems = [];
        const validGuestCartForStorage =[];

        enrichedItemsResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            validItems.push(result.value);
            validGuestCartForStorage.push(guestCart[index]);
          }
        });

        if (validGuestCartForStorage.length !== guestCart.length) {
          localStorage.setItem('guestCart', JSON.stringify(validGuestCartForStorage));
          triggerRefetch();
        }

        const totalPrice = validItems.reduce((sum, item) => {
          if (item.animal?.status !== 'available') return sum;
          return sum + (Number(item.calculated_details?.final_price) || 0);
        }, 0);

        const depositTotal = validItems.reduce((sum, item) => {
          if (item.animal?.status !== 'available') return sum;

          const paymentType = item.selected_services?.payment_type || item.payment_type;
          const userDeposit = Number(item.selected_services?.user_entered_deposit_amount) || Number(item.user_entered_deposit_amount) || 0;

          if (paymentType === 'deposit' && userDeposit > 0) {
            return sum + userDeposit;
          }
          return sum + (Number(item.calculated_details?.final_price) || 0);
        }, 0);

        setCartData({
          items: validItems,
          total_items: validItems.length,
          cart_totals: {
            total_price: totalPrice.toFixed(2),
            items_count: validItems.length,
            breakdown: validItems.map(item => ({
              item_id: item.animal_id,
              final_price: item.calculated_details?.final_price || 0
            }))
          },
          deposit_total: depositTotal.toFixed(2)
        });
      }
    } catch (error) {
      console.error("Error fetching cart:", error);
      setCartData({ items:[], cart_totals: {} });
    } finally {
      setLoading(false);
    }
  }, [user, triggerRefetch]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const getOrderContextLabel = useCallback((context) => {
    const cleanContext = (context || '').trim();
    const contextMap = {
      'general': t('cart.general_purchase', 'شراء عام'),
      'adahi': t('cart.sacrifice', 'أضحية'),
      'adahi_pool': t('cart.adahi_share', 'مشاركة أضاحي'),
      'shares': t('cart.meat_share', 'مشاركة لحم'),
      'adahi_group': t('cart.private_group', 'مجموعة خاصة')
    };
    return contextMap[cleanContext] || cleanContext;
  }, [t]);

  const requestRemoveItem = (item) => {
    setItemToDelete(item);
  };

  const confirmRemoveItem = async () => {
    if (!itemToDelete) return;

    try {
      if (user) {
        await axios.delete(`/cart/items/${itemToDelete.id}/`);
      } else {
        const rawGuestCart = localStorage.getItem('guestCart');
        let guestCart = rawGuestCart ? JSON.parse(rawGuestCart) :[];
        const updatedGuestCart = guestCart.filter(item => item.animal_id !== itemToDelete.animal_id);
        localStorage.setItem('guestCart', JSON.stringify(updatedGuestCart));
      }

      await fetchCart();
      triggerRefetch();
      toast.success(t('cart.delete_success', 'تم الحذف بنجاح'));
    } catch (error) {
      console.error("Error removing item:", error);
      toast.error(t('cart.delete_failed', 'فشل الحذف'));
    } finally {
      setItemToDelete(null);
    }
  };

  const hasSoldOutItems = cartData?.items?.some(i => i.animal?.status !== 'available');

  const handleCheckout = () => {
    if (!cartData?.items?.length) {
      toast.warn(t('cart.empty', 'السلة فارغة.'));
      return;
    }

    if (hasSoldOutItems) {
      toast.error(t('cart.remove_sold_items', 'يرجى حذف المواشي المباعة من السلة أولاً لتتمكن من المتابعة.'));
      return;
    }

    if (!user) {
      toast.info(t('cart.login_required_first', 'يرجى تسجيل الدخول أولاً'));
      localStorage.setItem('guestCartToMerge', 'true');
      navigate("/account/login-check", { state: { from: "/cart" } });
    } else {
      navigate('/checkout');
    }
  };

  const totalRemaining = Math.max(0,
    Number(cartData?.cart_totals?.total_price || 0) - Number(cartData?.deposit_total || 0)
  );

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mb-4"></div>
        <p className="text-muted font-bold">{t('cart.loading_cart', 'جاري تحميل سلة المشتريات...')}</p>
      </div>
    );
  }

  if (!cartData?.items?.length) {
    return (
      <div className="container mx-auto px-4 py-20 flex flex-col items-center justify-center text-center animate-fade-in">
        <div className="bg-gray-50 p-8 rounded-full mb-6">
          <ShoppingBag size={64} className="text-gray-300" />
        </div>
        <h2 className="text-2xl font-bold text-dark mb-2">{t('cart.cart_empty_title', 'سلة المشتريات فارغة')}</h2>
        <p className="text-muted mb-8">{t('cart.no_animals_added', 'لم تقم بإضافة أي مواشي لسلتك بعد.')}</p>
        <Link to="/livestock" className="btn btn-primary px-8 py-3 rounded-full shadow-lg hover:-translate-y-1">
          {t('cart.browse_store', 'تصفح المتجر الآن')}
        </Link>
      </div>
    );
  }

  const activeItemsCount = cartData.items.filter(i => i.animal?.status === 'available').length;

  return (
    <div className="bg-secondary/20 min-h-screen pb-32 md:pb-20">
      <div className="container mx-auto px-3 md:px-4 py-6 md:py-8">
        <h1 className="text-xl lg:text-3xl font-black text-dark mb-6 md:mb-8 flex items-center gap-2">
          <ShoppingBag className="text-primary" /> {t('cart.shopping_cart', 'سلة المشتريات')}
          <span className="text-xs md:text-sm font-normal text-muted bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
            {activeItemsCount} {t('cart.animals_shares', 'مواشي/أسهم')}
          </span>
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-start">
          <div className="lg:col-span-8 space-y-4">
            {cartData.items.map((item) => {
              const isSoldOut = item.animal?.status !== 'available';
              const itemTotal = Number(item.calculated_details?.final_price) || Number(item.price_per_item) || 0;
              const animalPrice = Number(item.calculated_details?.animal_base_price) || 0;
              const serviceCost = Number(item.calculated_details?.service_cost) || 0;
              const depositRequired = Number(item.calculated_details?.deposit_amount) || 0;

              const context = item.selected_services?._order_context || item.context || 'general';
              const isShareMode = ['shares', 'adahi_pool', 'adahi_group'].includes(context);
              const maxShares = item.animal?.max_shares || 1;
              const isFullPurchase = item.share_quantity === maxShares;

              return (
                <div
                  key={item.id || item.animal_id}
                  className={`bg-white rounded-2xl p-3 md:p-4 shadow-sm border transition-shadow relative overflow-hidden ${isSoldOut ? 'border-red-300 bg-red-50/30' : 'border-gray-100 hover:shadow-md'}`}
                >
                  {isSoldOut && (
                     <div className="absolute top-4 left-[-35px] bg-red-500 text-white font-bold text-[10px] py-1 px-10 -rotate-45 z-10 shadow-sm">
                         {t('cart.out_of_stock', 'نفدت الكمية')}
                     </div>
                  )}

                  <div className="flex gap-3 md:gap-4">
                    <div className="shrink-0 w-24 h-24 md:w-32 md:h-32 rounded-xl overflow-hidden bg-gray-50 border border-gray-100 relative">
                        <img
                          src={item.animal?.image || "/default-image.png"}
                          alt={item.animal?.code}
                          className={`w-full h-full object-cover ${isSoldOut ? 'grayscale opacity-70' : ''}`}
                          onError={(e) => { e.target.src = "/default-image.png"; }}
                        />
                    </div>

                    <div className="flex-grow flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex justify-between items-start mb-1">
                          <Link
                            to={`/animal/${item.animal?.id}`}
                            state={{
                              itemToEdit: item,
                              context: item.selected_services?._order_context || 'general'
                            }}
                            className={`text-base md:text-lg font-bold transition-colors truncate ${isSoldOut ? 'text-gray-500 pointer-events-none' : 'text-dark hover:text-primary'}`}
                          >
                            {item.animal?.category_name || t('cart.livestock', 'ماشية')} <span className="text-gray-400 text-sm">#{item.animal?.code?.replace('#', '')}</span>
                          </Link>

                          <button
                            onClick={() => requestRemoveItem(item)}
                            className="shrink-0 text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 p-1.5 rounded-lg transition-colors ms-2"
                            title={t('cart.remove_from_cart', 'حذف من السلة')}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="mb-2">
                          <div className="flex flex-wrap gap-1.5">
                            <span className="px-2 py-0.5 text-[10px] md:text-xs font-bold bg-blue-50 text-blue-800 border border-blue-100 rounded-md">
                              {getOrderContextLabel(context)}
                            </span>
                            {isShareMode && (
                              <span className="px-2 py-0.5 text-[10px] md:text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-100 rounded-md">
                                {isFullPurchase ? t('cart.full_purchase', 'شراء كامل') : `${item.share_quantity || 1} ${t('common.share', 'سهم')}`}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSoldOut ? (
                           <div className="mt-2 text-xs md:text-sm text-red-600 font-bold flex items-center gap-1.5 bg-red-100/50 p-2 rounded-lg">
                               <AlertTriangle size={16} />
                               {t('cart.animal_sold_to_other', 'عفواً، لقد تم شراء هذه الماشية بواسطة عميل آخر. يرجى حذفها لاختيار بديل.')}
                           </div>
                        ) : (
                          <div className="mt-2 text-[10px] md:text-xs text-gray-700 bg-gray-50 p-2 md:p-3 rounded-xl border border-gray-100 space-y-1">

                            <div className="flex justify-between items-center text-gray-500"><span>{t("cart.animal_price", "سعر الماشية:")}</span><div className="text-end d-flex align-items-center gap-2">{item.calculated_details?.discount_amount > 0 && (<span className="text-[10px] text-red-400 line-through me-2">{animalPrice.toLocaleString()}</span>)}<span className="font-bold text-success">{(animalPrice - Number(item.calculated_details?.discount_amount || 0)).toLocaleString()} {t("common.currency")}</span></div></div>

                            {serviceCost > 0 && (() => {
                                const sc = item.selected_services?._service_costs || {};
                                let breakdowns =[];
                                if (item.selected_services?.slaughter && sc.slaughter) breakdowns.push(`${t('services.slaughter', 'ذبح')} ${sc.slaughter}${t('common.currency')}`);
                                if (item.selected_services?.cutting && sc.cutting) breakdowns.push(`${t('services.cutting', 'تقطيع')} ${sc.cutting}${t('common.currency')}`);
                                if (item.selected_services?.packaging && sc.packaging) breakdowns.push(`${t('services.packaging', 'تغليف')} ${sc.packaging}${t('common.currency')}`);

                                return (
                                    <div className="flex justify-between items-center text-primary mt-1">
                                        <span className="flex flex-col md:flex-row md:items-center md:gap-1">
                                            <span>{t('cart.added_services', 'الخدمات المضافة:')}</span>
                                            <span className="text-[9px] md:text-[10px] font-normal">({breakdowns.join(' + ')})</span>
                                        </span>
                                        <span className="font-bold">+{serviceCost.toLocaleString()} {t('common.currency')}</span>
                                    </div>
                                );
                            })()}

                            <div className="border-t border-gray-200 my-1.5"></div>

                            <div className="flex justify-between items-center">
                               <span className="font-bold text-dark text-xs">{t('cart.total_this_animal', 'إجمالي هذا الحيوان:')}</span>
                               <span className="font-black text-dark text-xs md:text-sm">{itemTotal.toLocaleString()} {t('common.currency')}</span>
                            </div>

                            <div className="flex flex-col mt-1.5 bg-blue-50 text-blue-800 px-2 py-1.5 rounded-md border border-blue-100">
                               <div className="flex justify-between items-center">
                                   <span className="font-bold">{t('cart.amount_to_pay_now', 'عربون مبدئي (يمكن الدفع كاملاً لاحقاً):')}</span>
                                   <span className="font-black">{depositRequired.toLocaleString()} {t('common.currency')}</span>
                               </div>
                               <div className="text-[9px] md:text-[10px] text-blue-600 mt-0.5">
                                   ({t('cart.animal_deposit', 'عربون الماشية:')} {Math.max(0, depositRequired - serviceCost).toLocaleString()} {t('common.currency')} + {t('cart.services', 'الخدمات:')} {serviceCost.toLocaleString()} {t('common.currency')})
                               </div>
                            </div>

                            {itemTotal - depositRequired > 0 && (
                                <div className="flex justify-between items-center text-xs mt-2 text-red-600 font-bold px-1">
                                    <span>{t('cart.remaining_on_delivery', 'المتبقي عند الاستلام:')}</span>
                                    <span className="font-black" dir="ltr">{(itemTotal - depositRequired).toLocaleString()} {t('common.currency')}</span>
                                </div>
                            )}
                          </div>
                        )}
                      </div>

                      {!isSoldOut && (
                        <div className="flex justify-start mt-2">
                          <Link
                            to={`/animal/${item.animal?.unique_id || item.animal?.id}`}
                            state={{
                              itemToEdit: item,
                              context: item.selected_services?._order_context || 'general'
                            }}
                            className="flex items-center gap-1 text-[10px] md:text-xs font-bold text-gray-500 hover:text-primary transition-colors bg-white border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-primary/5"
                          >
                            <Edit3 size={14} /> {t('cart.edit_options_or_pay', 'تعديل الخيارات أو الدفع')}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-24">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-xl font-bold text-dark mb-6 border-b border-gray-50 pb-4">{t('cart.cart_summary', 'ملخص السلة')}</h2>

              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-muted">
                  <span>{t('cart.animals_shares_count', 'عدد المواشي/الأسهم')}</span>
                  <span className="font-bold text-dark">{activeItemsCount}</span>
                </div>

                {(() => {
                    const voucherDiscount = parseFloat(cartData.cart_totals?.voucher_discount || 0);
                    if (voucherDiscount > 0) {
                        return (
                            <>
                                <div className="flex justify-between text-muted mt-2">
                                  <span>{t('cart.total_before_voucher', 'الإجمالي قبل القسيمة')}</span>
                                  <span className="font-bold text-dark" dir="ltr">
                                      {(Number(cartData.cart_totals?.total_price || 0) + voucherDiscount).toLocaleString()} {t('common.currency')}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center text-red-600 font-bold bg-red-50 p-2.5 rounded-xl border border-red-200 shadow-sm animate-fade-in-up mt-2">
                                    <span className="flex items-center gap-1.5">
                                        <Tag size={18}/> قسيمة خصم (Voucher):
                                    </span>
                                    <span dir="ltr" className="text-lg">
                                        -{voucherDiscount.toLocaleString(undefined, {maximumFractionDigits: 0})} {t('common.currency')}
                                    </span>
                                </div>
                            </>
                        );
                    }
                    return null;
                })()}

                <div className="h-px bg-gray-100 my-2"></div>

                <div className="flex justify-between items-center text-lg font-black text-dark">
                  <div>
                    <span className="block">{t('cart.grand_total', 'الإجمالي الكلي')}</span>
                    <span className="text-[10px] text-gray-400 font-normal block">{t('cart.includes_animal_services', 'شامل الماشية والخدمات')}</span>
                  </div>
                  <span dir="ltr" className="text-dark">
                    {Number(cartData.cart_totals?.total_price || 0).toLocaleString()} <span className="text-sm text-gray-500 font-bold">{t('common.currency')}</span>
                  </span>
                </div>
              </div>

              {cartData.deposit_total && Number(cartData.deposit_total) > 0 && (
                <div className="bg-blue-50 rounded-xl md:rounded-2xl p-4 mb-6 border border-blue-100">
                  <div className="flex justify-between mb-2 items-center">
                    <div>
                      <span className="text-sm font-bold text-blue-800 block">{t('cart.pay_now', 'عربون مبدئي (مقدر)')}</span>
                      {Number(cartData.deposit_total) < Number(cartData.cart_totals?.total_price || 0) && (
                        <span className="text-[10px] text-blue-600 block mt-1">{t('cart.deposit_to_confirm', 'عربون لتأكيد الحجز (يُخصم من الإجمالي)')}</span>
                      )}
                    </div>
                    <span className="font-black text-blue-800 text-xl" dir="ltr">
                      {Number(cartData.deposit_total).toLocaleString()} <span className="text-sm">{t('common.currency')}</span>
                    </span>
                  </div>

                  {totalRemaining > 0 && (
                    <div className="flex justify-between items-center text-xs text-blue-600/80 pt-3 border-t border-blue-200 mt-2">
                      <span className="font-bold">{t('cart.remaining_to_pay_delivery', 'المتبقي (يُدفع عند الاستلام)')}</span>
                      <span dir="ltr" className="font-bold">{totalRemaining.toLocaleString()} {t('common.currency')}</span>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleCheckout}
                className="w-full bg-primary hover:bg-primary-dark text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={activeItemsCount === 0 || hasSoldOutItems}
              >
                {user ? t('cart.continue_to_confirm', 'متابعة لتأكيد الطلب') : t('cart.login_to_continue', 'تسجيل الدخول للمتابعة')}
                {isRtl ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
              </button>

              {!user && (
                <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-xl p-3 text-xs text-yellow-800 text-center font-bold">
                  <p className="m-0">{t('cart.guest_cart_notice', 'أنت تستخدم سلة زائر. قم بتسجيل الدخول للحفاظ على طلباتك ومتابعتها.')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-[65px] left-0 right-0 bg-white border-t border-gray-200 px-3 py-2 z-40 shadow-[0_-10px_20px_rgba(0,0,0,0.08)] rounded-t-3xl pb-safe">
          <div className="flex justify-between items-center mb-2 px-1">
              <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500 font-bold mb-0.5">{t('cart.total', 'الإجمالي')}</span>
                  <span className="font-bold text-dark text-sm" dir="ltr">
                      {Number(cartData.cart_totals?.total_price || 0).toLocaleString()} {t('common.currency')}
                  </span>
              </div>
              <div className="flex flex-col text-center">
                  <span className="text-[10px] text-blue-600 font-bold mb-0.5">{t('cart.pay_now_mobile', 'العربون (مقدر)')}</span>
                  <span className="font-black text-blue-700 text-base" dir="ltr">
                      {Number(cartData.deposit_total || 0).toLocaleString()} {t('common.currency')}
                  </span>
              </div>
              <div className="flex flex-col text-end">
                  <span className="text-[10px] text-red-500 font-bold mb-0.5">{t('cart.remaining_mobile', 'الباقي استلام')}</span>
                  <span className="font-bold text-red-600 text-sm" dir="ltr">
                      {totalRemaining.toLocaleString()} {t('common.currency')}
                  </span>
              </div>
          </div>
          <div className="text-center text-[9px] text-gray-400 mb-2 mt-[-4px]">
              {t('cart.delivery_determined_next', '(التوصيل يُحدد في الخطوة القادمة)')}
          </div>
          <button
              onClick={handleCheckout}
              disabled={activeItemsCount === 0 || hasSoldOutItems}
              className="w-full bg-primary hover:bg-primary-dark text-white py-3.5 rounded-2xl font-bold text-base shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
              {user ? t('cart.complete_order', 'إتمام الطلب') : t('cart.login_to_continue', 'تسجيل الدخول للمتابعة')}
              {isRtl ? <ArrowLeft size={18} /> : <ArrowRight size={18} />}
          </button>
      </div>

      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmRemoveItem}
        title={t('cart.delete_animal', 'حذف الماشية')}
        message={t('cart.delete_animal_confirm', 'هل أنت متأكد من حذف هذا الحيوان من سلة مشترياتك؟')}
        confirmText={t('cart.yes_delete', 'نعم، احذف')}
        icon="trash"
      />
    </div>
  );
}

export default Cart;

