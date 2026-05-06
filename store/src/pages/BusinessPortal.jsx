import React, { useState, useEffect } from 'react';
import useAuth from '../context/auth/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import { Building, Plus, Trash2, Send, Lock, DollarSign, Package, ClipboardList, ArrowLeft, Wallet, Truck, CheckCircle, Info, PlusCircle } from 'lucide-react';
import { Table, Badge } from 'react-bootstrap';
import Modal from '../components/ui/Modal';
import { useTranslation } from 'react-i18next';

const BusinessPortal = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { user } = useAuth();
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([{ category_id: '', weight_range: '', quantity: 1, services: {} }]);
  const [requestNotes, setRequestNotes] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [minQty, setMinQty] = useState(5);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedReqForDelivery, setSelectedReqForDelivery] = useState(null);
  const [deliveryData, setDeliveryData] = useState({
    delivery_type: 'pickup',
    delivery_date: '',
    delivery_address_id: '',
    notes: '',
    newAddress: { governorate: '', city: '', street: '' }
  });
  const [userAddresses, setUserAddresses] = useState([]);
  const [opSettings, setOpSettings] = useState(null);
  const [governorates, setGovernorates] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [catRes, reqRes, settingsRes, govRes] = await Promise.all([
          axios.get('/livestock/categories/'),
          axios.get('/orders/business-requests/'),
          axios.get('/core/public-operation-settings/'),
          axios.get('/core/governorates/')
        ]);
        setCategories(catRes.data.results || catRes.data || []);
        setRequests(reqRes.data.results || []);
        setOpSettings(settingsRes.data);
        setGovernorates(govRes.data || []);
        if (settingsRes.data?.min_business_order_quantity) {
          setMinQty(settingsRes.data.min_business_order_quantity);
        }
      } catch (err) {
        console.error(err);
        toast.error(t('business_portal.data_load_error'));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [t]);

  if (!user?.is_corporate) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4 bg-secondary/20">
        <div className="bg-white max-w-lg w-full rounded-[2rem] shadow-xl p-8 text-center border border-gray-100">
          <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-400 border-4 border-white shadow-sm">
            <Lock size={40} />
          </div>
          <h2 className="text-2xl font-black text-dark mb-4">{t('business_portal.corporate_services')}</h2>
          <p className="text-gray-500 mb-8 leading-relaxed">
            {t('business_portal.corporate_services_desc')}
          </p>
          <Link to="/partnerships?tab=business" className="btn btn-primary w-full py-4 rounded-xl text-lg flex items-center justify-center gap-2">
            {t('business_portal.apply_corporate_account')} {isRtl ? <ArrowLeft size={20} /> : <ArrowRight size={20} />}
          </Link>
        </div>
      </div>
    );
  }

  const handleAddItem = () => {
    setItems([...items, { category_id: '', weight_range: '', quantity: 1, services: {} }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const totalQuantity = items.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);
    if (totalQuantity < minQty) {
      toast.error(`${t('business_portal.min_order_qty_error')} ${minQty} ${t('business_portal.heads')}`);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.category_id || !item.weight_range || !item.quantity) {
        toast.warn(`${t('business_portal.complete_item_data')} ${i + 1}`);
        return;
      }
      if (parseInt(item.quantity) < 1) {
        toast.warn(`${t('business_portal.item_qty_min_1')} ${i + 1} ${t('business_portal.must_be_at_least_1')}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = { request_details: items };
      if (requestNotes.trim()) {
        payload.customer_notes = requestNotes.trim();
      }

      await axios.post('/orders/business-requests/', payload);
      toast.success(t('business_portal.supply_request_success'));
      const reqRes = await axios.get('/orders/business-requests/');
      setRequests(reqRes.data.results || []);
      setItems([{ category_id: '', weight_range: '', quantity: 1, services: {} }]);
      setRequestNotes('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      toast.error(err.response?.data?.detail || t('business_portal.request_send_failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    const map = {
      'pending': { bg: 'warning', text: t('business_portal.status_pending', 'قيد المراجعة'), textColor: 'text-dark' },
      'quoted': { bg: 'info', text: t('business_portal.status_quoted', 'بانتظار الدفع'), textColor: 'text-dark' },
      'paid': { bg: 'primary', text: t('business_portal.status_paid', 'مدفوع (تجهيز)'), textColor: 'text-white' },
      'fulfilled': { bg: 'success', text: t('business_portal.status_fulfilled', 'مكتمل ومُنفذ'), textColor: 'text-white' },
      'rejected': { bg: 'danger', text: t('business_portal.status_rejected', 'مرفوض'), textColor: 'text-white' },
    };
    const config = map[status] || { bg: 'secondary', text: status, textColor: 'text-white' };
    return <Badge bg={config.bg} className={config.textColor}>{config.text}</Badge>;
  };

  const openDeliveryModal = async (req) => {
    setSelectedReqForDelivery(req);
    setShowDeliveryModal(true);
    try {
      const res = await axios.get('/accounts/addresses/');
      setUserAddresses(res.data.results || []);
      const order = req.converted_order_details;
      if (order) {
        setDeliveryData({
          delivery_type: order.delivery_type || (opSettings?.pickup_active ? 'pickup' : 'delivery'),
          delivery_date: order.delivery_date || '',
          delivery_address_id: order.delivery_address?.id || '',
          notes: order.notes || '',
          newAddress: { governorate: '', city: '', street: '' }
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveDelivery = async () => {
    try {
      let finalAddressId = deliveryData.delivery_address_id;
      if (finalAddressId === 'new_address') {
        const addrRes = await axios.post('/accounts/addresses/', deliveryData.newAddress);
        finalAddressId = addrRes.data.id;
      }

      await axios.post(`/orders/business-requests/${selectedReqForDelivery.id}/update-delivery/`, {
        delivery_type: deliveryData.delivery_type,
        delivery_date: deliveryData.delivery_date,
        delivery_address_id: finalAddressId,
        newAddress: deliveryData.newAddress,
        notes: deliveryData.notes
      });

      toast.success(t('business_portal.receive_data_saved'));
      setShowDeliveryModal(false);
      const reqRes = await axios.get('/orders/business-requests/');
      setRequests(reqRes.data.results || []);
    } catch {
      toast.error(t('business_portal.save_failed_incomplete'));
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  const currentTotalQty = items.reduce((sum, item) => sum + parseInt(item.quantity || 0), 0);

  return (
    <div className="bg-secondary/20 min-h-screen pb-20">
      <div className="bg-dark text-white py-10 md:py-16 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-full h-full bg-primary/10"></div>
        <div className="container mx-auto px-4 relative z-10 text-center">
          <div className="bg-white/10 w-14 h-14 md:w-16 md:h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 md:mb-6 backdrop-blur-sm border border-white/20 shadow-lg">
            <Building size={28} className="text-white md:w-8 md:h-8" />
          </div>
          <h1 className="text-2xl md:text-4xl font-black mb-2">{t('business_portal.business_portal_title')} {user.business_name}</h1>
          <p className="text-gray-300 text-sm md:text-lg max-w-2xl mx-auto leading-relaxed">
            {t('business_portal.business_portal_welcome')}
          </p>
        </div>
      </div>

      <div className="container mx-auto px-3 md:px-4 -mt-6 md:-mt-8 relative z-20">
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 md:p-4 flex items-start md:items-center gap-2 md:gap-3 mb-6 md:mb-8 shadow-sm max-w-4xl mx-auto">
          <DollarSign size={20} className="text-blue-600 shrink-0 mt-0.5 md:mt-0 md:w-6 md:h-6" />
          <div className="text-blue-800 text-xs md:text-sm leading-relaxed">
            <strong className="block md:inline mb-1 md:mb-0">{t('business_portal.business_alert')} </strong>
            {t('business_portal.min_supply_order')} <span className="bg-blue-600 text-white px-2 py-0.5 rounded-md font-bold mx-1">{minQty}</span> {t('business_portal.heads')}
            <span className="text-blue-600/80 d-block md:d-inline ms-md-2 mt-1 md:mt-0">{t('business_portal.wholesale_prices_apply')}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-8">
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8">
              <h2 className="text-lg md:text-xl font-bold text-dark mb-4 md:mb-6 flex items-center gap-2 border-b border-gray-50 pb-3 md:pb-4">
                <Package className="text-primary w-5 h-5 md:w-6 md:h-6" /> {t('business_portal.new_supply_request')}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                {items.map((item, index) => (
                  <div key={index} className="bg-gray-50 p-3 md:p-5 rounded-2xl border border-gray-100 relative group transition-all hover:border-primary/30">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="absolute top-2 left-2 md:top-4 md:left-4 text-gray-400 hover:text-red-500 bg-white p-1.5 md:p-2 rounded-lg shadow-sm border border-gray-100 transition-colors z-10"
                        aria-label={t('business_portal.delete_item')}
                        title={t('business_portal.delete_item')}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}

                    <div className="mb-3">
                      <span className="bg-primary/10 text-primary text-[10px] md:text-xs font-bold px-2 py-1 rounded-md">{t('business_portal.item_num')}{index + 1}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                      <div>
                        <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5 md:mb-2">{t('business_portal.animal_category')}</label>
                        <select
                          className="w-full bg-white border border-gray-200 text-dark rounded-xl px-3 h-11 md:h-12 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                          value={item.category_id}
                          onChange={e => handleItemChange(index, 'category_id', e.target.value)}
                          required
                        >
                          <option value="">{t('business_portal.select_category')}</option>
                          {categories.map(c => (
                            <option key={c.id} value={c.id}>{c.name_ar}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5 md:mb-2">{t('business_portal.required_count')}</label>
                        <input
                          type="number"
                          className="w-full bg-white border border-gray-200 text-dark rounded-xl px-3 h-11 md:h-12 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                          min="1"
                          value={item.quantity}
                          onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5 md:mb-2">{t('business_portal.approx_avg_weight')}</label>
                        <input
                          type="text"
                          className="w-full bg-white border border-gray-200 text-dark rounded-xl px-3 h-11 md:h-12 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all text-sm"
                          placeholder={t('business_portal.weight_example')}
                          value={item.weight_range}
                          onChange={e => handleItemChange(index, 'weight_range', e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200">
                      <label className="flex items-center gap-2 cursor-pointer group w-fit">
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={item.services?.slaughter || false}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[index].services = { slaughter: e.target.checked };
                              setItems(newItems);
                            }}
                            className="peer h-4 w-4 md:h-5 md:w-5 cursor-pointer appearance-none rounded-md border-2 border-gray-300 transition-all checked:border-primary checked:bg-primary"
                          />
                          <div className="pointer-events-none absolute top-2/4 left-2/4 -translate-x-2/4 -translate-y-2/4 text-white opacity-0 transition-opacity peer-checked:opacity-100">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 md:h-3.5 md:w-3.5" viewBox="0 0 20 20" fill="currentColor" stroke="currentColor" strokeWidth="1">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <span className="text-xs md:text-sm font-bold text-gray-700 group-hover:text-primary transition-colors">{t('business_portal.includes_slaughter_prep')}</span>
                      </label>
                    </div>
                  </div>
                ))}

                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 md:p-4 border border-gray-200 rounded-2xl">
                  <button
                    type="button"
                    className="text-primary font-bold text-xs md:text-sm flex items-center gap-1.5 hover:bg-primary/5 px-3 py-2 rounded-xl transition-colors w-full sm:w-auto justify-center"
                    onClick={handleAddItem}
                  >
                    <PlusCircle size={16} /> {t('business_portal.add_another_item')}
                  </button>

                  <div className="text-xs md:text-sm font-bold w-full sm:w-auto text-center sm:text-end">
                    {t('business_portal.total_heads')}
                    <span className={`ms-2 px-2.5 py-1 rounded-lg ${currentTotalQty < minQty ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-green-50 text-green-600 border border-green-200'}`}>
                      {currentTotalQty}
                    </span>
                  </div>
                </div>

                <div className="bg-white p-3 md:p-4 border border-gray-200 rounded-2xl">
                  <label className="block text-xs md:text-sm font-bold text-gray-700 mb-2">{t('business_portal.any_additional_notes')}</label>
                  <textarea
                    className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-3 py-3 focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none text-sm"
                    rows="3"
                    placeholder={t('business_portal.write_notes_here')}
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                  ></textarea>
                </div>

                <button
                  type="submit"
                  className="w-full bg-dark hover:bg-black text-white py-3.5 md:py-4 rounded-xl font-bold text-base md:text-lg shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                  disabled={submitting || currentTotalQty < minQty}
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                  ) : (
                    <>
                      <Send size={18} className={`md:w-5 md:h-5 ${isRtl ? '-scale-x-100' : ''}`} /> {t('business_portal.send_pricing_request')}
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8 h-full">
              <h2 className="text-lg md:text-xl font-bold text-dark mb-4 md:mb-6 flex items-center gap-2 border-b border-gray-50 pb-3 md:pb-4">
                <ClipboardList className="text-primary w-5 h-5 md:w-6 md:h-6" /> {t('business_portal.history_past_orders')}
              </h2>

              {requests.length === 0 ? (
                <div className="text-center py-8 md:py-10 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <ClipboardList size={32} className="text-gray-300 mx-auto mb-2 md:mb-3 md:w-10 md:h-10" />
                  <p className="text-gray-500 text-xs md:text-sm font-medium">{t('business_portal.no_past_orders')}</p>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4 max-h-[500px] md:max-h-[700px] overflow-y-auto pr-1 md:pr-2 custom-scrollbar">
                  {requests.map(req => {
                    const orderDetails = req.converted_order_details;
                    return (
                      <div key={req.id} className="bg-white border border-gray-100 rounded-2xl p-3 md:p-5 hover:border-primary/50 transition-colors shadow-sm">
                        <div className="flex flex-wrap justify-between items-start mb-2 md:mb-3 border-b border-gray-50 pb-2 md:pb-3 gap-2">
                          <div>
                            <span className="text-[10px] md:text-xs text-muted block mb-0.5 md:mb-1">{t('business_portal.order_date_lbl')} {new Date(req.created_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</span>
                            <strong className="text-dark text-sm md:text-base">{t('business_portal.supply_order_num')}{req.id}</strong>
                          </div>
                          {getStatusBadge(req.status)}
                        </div>

                        <div className="mb-3 md:mb-4">
                          <p className="text-[10px] md:text-xs font-bold text-gray-500 mb-1.5 md:mb-2">{t('business_portal.requested_items')} ({req.total_quantity} {t('business_portal.head')}):</p>
                          <ul className="text-xs md:text-sm text-gray-700 space-y-1 list-disc list-inside">
                            {req.request_details.map((item, idx) => {
                              const cat = req.categories_details?.find(c => c.id == item.category_id);
                              const catName = cat ? (i18n.language === 'en' && cat.name_en ? cat.name_en : cat.name_ar) : `Category ${item.category_id}`;
                              return (
                                <li key={idx}>{item.quantity} {t('business_portal.head_bracket')} {catName} {t('business_portal.weight_lbl')} {item.weight_range}</li>
                              );
                            })}
                          </ul>
                        </div>

                        {(orderDetails || req.quoted_total_price) && (
                          <div className="bg-gray-50 border border-gray-100 p-2 md:p-3 rounded-xl mb-3 md:mb-4">
                            <div className="bg-amber-50 text-amber-800 p-2 rounded-lg mb-2 md:mb-3 border border-amber-200/50">
                              <p className="text-[10px] md:text-xs mb-0 font-bold flex items-start gap-1.5">
                                <Info size={14} className="flex-shrink-0 mt-0.5 text-amber-600" />
                                <span>{t('business_portal.estimated_values_alert')}</span>
                              </p>
                            </div>
                            <h6 className="font-bold text-dark text-xs md:text-sm mb-1.5 md:mb-2 border-b border-gray-200 pb-1.5 md:pb-2">{t('business_portal.financial_summary')}</h6>
                            <div className="flex justify-between text-xs md:text-sm mb-1">
                              <span className="text-gray-500">{t('business_portal.total_lbl')}</span>
                              <span className="font-bold" dir="ltr">{parseFloat(orderDetails?.total_price || req.quoted_total_price).toLocaleString()} {t('common.currency')}</span>
                            </div>
                            <div className="flex justify-between text-xs md:text-sm mb-1">
                              <span className="text-green-600">{t('business_portal.paid_lbl')}</span>
                              <span className="font-bold text-green-600" dir="ltr">{parseFloat(orderDetails?.deposit_total || 0).toLocaleString()} {t('common.currency')}</span>
                            </div>
                            <div className="flex justify-between text-xs md:text-sm">
                              <span className="text-red-500">{t('business_portal.remaining_lbl')}</span>
                              <span className="font-bold text-red-500" dir="ltr">{parseFloat(orderDetails?.remaining_amount || req.quoted_total_price).toLocaleString()} {t('common.currency')}</span>
                            </div>
                          </div>
                        )}

                        {['paid', 'fulfilled'].includes(req.status) && (
                          <>
                            {!orderDetails?.delivery_type ? (
                              <button
                                className="w-full py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm shadow-sm transition-all mt-2 md:mt-3 flex justify-center items-center gap-1.5 md:gap-2 bg-green-600 hover:bg-green-700 text-white animate-pulse"
                                onClick={() => openDeliveryModal(req)}
                              >
                                <Truck size={16} className="md:w-4 md:h-4" />
                                <span>{t('business_portal.final_step_delivery')}</span>
                              </button>
                            ) : (
                              <div className="bg-green-50 border border-green-200 rounded-xl md:rounded-2xl p-3 md:p-4 mt-3 md:mt-4 animate-fade-in-up">
                                <h6 className="font-bold text-green-800 mb-2 md:mb-3 flex items-center gap-1.5 border-b border-green-200 pb-1.5 md:pb-2 text-xs md:text-sm">
                                  <CheckCircle size={16} />
                                  {t('business_portal.receive_data_status')}
                                </h6>
                                <div className="text-[10px] md:text-sm text-green-900 space-y-2 md:space-y-3">
                                  <div className="flex justify-between items-center">
                                      <span className="text-gray-500 font-bold">{t('business_portal.prep_status')}</span>
                                      <span className={`px-2 py-1 rounded text-white font-bold text-[9px] md:text-xs ${orderDetails.status === 'ready_for_shipment' ? 'bg-primary' : orderDetails.status === 'out_for_delivery' ? 'bg-yellow-500' : 'bg-success'}`}>
                                          {orderDetails.status_display || orderDetails.status}
                                      </span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span className="text-gray-500 font-bold">{t('business_portal.receive_method')}</span>
                                      <span className="font-black">{!orderDetails.delivery_type ? t('business_portal.not_specified') : (orderDetails.delivery_type === 'delivery' ? t('business_portal.delivery_to_company') : t('business_portal.farm_pickup'))}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span className="text-gray-500 font-bold">{t('business_portal.scheduled_time')}</span>
                                      <span className="font-black">{orderDetails.delivery_date || t('business_portal.determined_later')}</span>
                                  </div>
                                  {orderDetails.delivery_type === 'delivery' && orderDetails.delivery_address && (
                                      <div className="flex flex-col pt-1 bg-white p-2 rounded-lg border border-green-100 mt-1 md:mt-2">
                                          <span className="text-gray-500 mb-0.5 font-bold">{t('business_portal.delivery_address_lbl')}</span>
                                          <span className="font-bold text-dark text-[10px] md:text-sm">{orderDetails.delivery_address.street} - {orderDetails.delivery_address.city} ({orderDetails.delivery_address.governorate})</span>
                                      </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </>
                        )}

                        {req.status === 'quoted' && orderDetails && req.status !== 'rejected' && orderDetails.status !== 'canceled' && (
                          <div className="mt-3">
                            <div className="bg-amber-50 text-amber-800 p-2 rounded-lg text-[10px] md:text-xs mb-2 text-center border border-amber-200/50">
                              {t('business_portal.please_pay_deposit')} <strong>48 {t('business_portal.hours')}</strong> {t('business_portal.to_avoid_auto_cancel')}
                            </div>
                            <button
                              className="w-full bg-primary hover:bg-primary-dark text-white py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm shadow-md transition-all flex justify-center items-center gap-2"
                              onClick={() => navigate(`/b2b-payment/${req.id}`)}
                            >
                              <Wallet size={16} className="md:w-4 md:h-4" /> {t('business_portal.pay_deposit')}{parseFloat(req.quoted_deposit).toLocaleString()} {t('common.currency')})
                            </button>
                          </div>
                        )}

                        {req.status !== 'quoted' && orderDetails && req.status !== 'rejected' && orderDetails.status !== 'canceled' && parseFloat(orderDetails.remaining_amount) > 0 && (
                          <button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 md:py-2.5 rounded-xl font-bold text-xs md:text-sm shadow-sm transition-all mt-2 flex justify-center items-center gap-2"
                            onClick={() => navigate(`/b2b-payment/${req.id}`)}
                          >
                            <Wallet size={14} className="md:w-4 md:h-4" /> {t('business_portal.pay_remaining_online')}
                          </button>
                        )}

                        {orderDetails?.payments && orderDetails.payments.length > 0 && (
                          <div className="mt-3 md:mt-4 border-t pt-2 md:pt-3">
                            <h6 className="font-bold text-dark text-[10px] md:text-xs mb-2">{t('business_portal.payments_history')}</h6>
                            <div className="overflow-x-auto">
                              <table className="w-full text-center text-[10px] md:text-xs border border-gray-100">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                  <tr>
                                    <th className="p-1.5 md:p-2">{t('business_portal.date')}</th>
                                    <th className="p-1.5 md:p-2">{t('business_portal.amount')}</th>
                                    <th className="p-1.5 md:p-2">{t('business_portal.status')}</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {orderDetails.payments.map(p => (
                                    <tr key={p.id}>
                                      <td dir="ltr" className="p-1.5 md:p-2">{new Date(p.created_at).toLocaleDateString(isRtl ? 'ar-EG' : 'en-US')}</td>
                                      <td className="text-green-600 font-bold p-1.5 md:p-2">{parseFloat(p.amount).toLocaleString()}</td>
                                      <td className="p-1.5 md:p-2">
                                        <span className={`px-2 py-0.5 rounded text-[9px] md:text-[10px] font-bold text-white ${p.status === 'completed' ? 'bg-green-500' : 'bg-yellow-500'}`}>
                                          {p.status === 'completed' ? t('business_portal.completed') : t('business_portal.pending')}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {req.admin_notes && (
                          <div className={`p-3 md:p-4 rounded-xl md:rounded-2xl text-xs md:text-sm mt-3 md:mt-4 shadow-sm animate-fade-in border ${
                              req.admin_notes.includes('48 hours')
                              ? 'bg-red-50 text-red-800 border-red-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}>
                            <strong className={`flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2 border-b pb-1.5 md:pb-2 ${
                                req.admin_notes.includes('48 hours') ? 'text-red-900 border-red-200' : 'text-blue-900 border-blue-200'
                            }`}>
                              <Info size={16} className="md:w-4 md:h-4" />
                              {req.admin_notes.includes('48 hours') ? t('business_portal.system_alert_cancel') : t('business_portal.admin_update_msg')}
                            </strong>
                            <div className="mb-0 leading-relaxed font-medium whitespace-pre-wrap">
                              {req.admin_notes.includes('48 hours')
                                ? t('business_portal.auto_cancel_48h_msg')
                                : req.admin_notes}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showDeliveryModal}
        onClose={() => setShowDeliveryModal(false)}
        title={t('business_portal.company_delivery_settings')}
        size="md"
        fullscreen="sm-down"
        footer={
          <div className="flex w-full gap-2">
            <button
              className="flex-1 py-2.5 md:py-3 rounded-xl font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors text-sm md:text-base"
              onClick={() => setShowDeliveryModal(false)}
            >
              {t('common.cancel')}
            </button>
            <button
              className="flex-[2] py-2.5 md:py-3 rounded-xl font-bold bg-primary text-white hover:bg-primary-dark transition-colors shadow-md text-sm md:text-base"
              onClick={handleSaveDelivery}
            >
              {t('business_portal.save_send_admin')}
            </button>
          </div>
        }
      >
        <div className="space-y-3 md:space-y-4 text-start">
          <div>
            <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5">{t('business_portal.receive_method')}</label>
            <select
              className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-3 h-11 md:h-12 outline-none text-sm"
              value={deliveryData.delivery_type}
              onChange={e => setDeliveryData({...deliveryData, delivery_type: e.target.value})}
            >
              {opSettings?.pickup_active && <option value="pickup">{t('business_portal.farm_pickup')}</option>}
              {opSettings?.delivery_active && <option value="delivery">{t('business_portal.delivery_to_company')}</option>}
            </select>
          </div>

          {deliveryData.delivery_type === 'delivery' && (
            <div className="bg-gray-50 p-3 md:p-4 rounded-xl md:rounded-2xl border border-gray-100">
              <label className="block text-xs md:text-sm font-bold text-primary mb-1.5">{t('business_portal.delivery_address_lbl').replace(':', '')}</label>
              <select
                className="w-full bg-white border border-gray-200 text-dark rounded-xl px-3 h-11 md:h-12 outline-none mb-2 md:mb-3 text-sm"
                value={deliveryData.delivery_address_id}
                onChange={e => setDeliveryData({...deliveryData, delivery_address_id: e.target.value})}
              >
                <option value="">{t('business_portal.select_saved_address')}</option>
                {userAddresses.map(addr => (
                  <option key={addr.id} value={addr.id}>{addr.city}, {addr.street} ({addr.governorate})</option>
                ))}
                <option value="new_address">{t('business_portal.add_new_address_plus')}</option>
              </select>

              {deliveryData.delivery_address_id === 'new_address' && (
                <div className="mt-2 space-y-2 animate-fade-in-up">
                  <select
                    className="w-full bg-white border border-gray-200 text-dark rounded-lg px-3 h-10 md:h-11 text-sm outline-none"
                    value={deliveryData.newAddress.governorate}
                    onChange={e => setDeliveryData({...deliveryData, newAddress: {...deliveryData.newAddress, governorate: e.target.value}})}
                  >
                    <option value="">{t('business_portal.select_gov')}</option>
                    {governorates.map(g => <option key={g.id} value={g.name_ar}>{g.name_ar}</option>)}
                  </select>
                  <input
                    type="text"
                    className="w-full bg-white border border-gray-200 text-dark rounded-lg px-3 h-10 md:h-11 text-sm outline-none"
                    placeholder={t('business_portal.city_region')}
                    value={deliveryData.newAddress.city}
                    onChange={e => setDeliveryData({...deliveryData, newAddress: {...deliveryData.newAddress, city: e.target.value}})}
                  />
                  <input
                    type="text"
                    className="w-full bg-white border border-gray-200 text-dark rounded-lg px-3 h-10 md:h-11 text-sm outline-none"
                    placeholder={t('business_portal.street_details')}
                    value={deliveryData.newAddress.street}
                    onChange={e => setDeliveryData({...deliveryData, newAddress: {...deliveryData.newAddress, street: e.target.value}})}
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5">{t('business_portal.delivery_pickup_date')}</label>
            <input
              type="date"
              className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-3 h-11 md:h-12 outline-none text-sm"
              value={deliveryData.delivery_date}
              onChange={e => setDeliveryData({...deliveryData, delivery_date: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-bold text-gray-700 mb-1.5">{t('business_portal.order_notes_driver_butcher')}</label>
            <textarea
              className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-3 py-2 md:py-3 outline-none resize-none text-sm"
              rows="3"
              value={deliveryData.notes}
              onChange={e => setDeliveryData({...deliveryData, notes: e.target.value})}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BusinessPortal;
