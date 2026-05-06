
import React, { useState, useEffect, useCallback } from 'react';
import axios from '../services/axiosConfig';
import { toast } from 'react-toastify';
import { Plus, MapPin, Edit3, Trash2, Home, Building, Star, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import ConfirmModal from "../components/ui/ConfirmModal";

const Addresses = () => {
    const { t, i18n } = useTranslation();
    const isRtl = i18n.language === 'ar';
    const [addresses, setAddresses] = useState([]);
    const[governorates, setGovernorates] = useState([]);
    const [loading, setLoading] = useState(true);
    const[isFormVisible, setIsFormVisible] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const[addressToDelete, setAddressToDelete] = useState(null);

    const initialFormData = {
        governorate: '', city: '', street: '',
        building_number: '', apartment_number: '',
        notes: '', is_default: false,
    };
    const [formData, setFormData] = useState(initialFormData);

    const fetchAddressesAndGovernorates = useCallback(async () => {
        setLoading(true);
        try {
            const[addrRes, govRes] = await Promise.all([
                axios.get('/accounts/addresses/'),
                axios.get('/core/governorates/')
            ]);
            setAddresses(addrRes.data.results || []);
            setGovernorates(govRes.data ||[]);
        } catch (error) {
            console.error("Fetch error:", error);
            toast.error(t('errors.generic'));
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        fetchAddressesAndGovernorates();
    }, [fetchAddressesAndGovernorates, i18n.language]);

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleEdit = (address) => {
        setEditingAddress(address);
        setFormData({
            governorate: address.governorate, city: address.city,
            street: address.street, building_number: address.building_number || '',
            apartment_number: address.apartment_number || '', notes: address.notes || '',
            is_default: address.is_default,
        });
        setIsFormVisible(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const requestDelete = (id) => {
        setAddressToDelete(id);
    };

    const confirmDelete = async () => {
        try {
            await axios.delete(`/accounts/addresses/${addressToDelete}/`);
            toast.success(t('addresses_page.delete_success'));
            fetchAddressesAndGovernorates();
        } catch {
            toast.error(t('addresses_page.delete_error'));
        } finally {
            setAddressToDelete(null);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        const url = editingAddress ? `/accounts/addresses/${editingAddress.id}/` : '/accounts/addresses/';
        const method = editingAddress ? 'patch' : 'post';

        try {
            await axios[method](url, formData);
            toast.success(editingAddress ? t('addresses_page.update_success') : t('addresses_page.create_success'));
            setIsFormVisible(false);
            setEditingAddress(null);
            setFormData(initialFormData);
            fetchAddressesAndGovernorates();
        } catch (error) {
            toast.error(t('addresses_page.submit_error'));
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-[60vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="bg-secondary/20 min-h-screen pb-20">
            <div className="container mx-auto px-4 py-8 max-w-4xl">
                <div className="flex justify-between items-center mb-8">
                    <h2 className="text-2xl font-black text-dark flex items-center gap-2">
                        <MapPin className="text-primary" /> {t('addresses_page.title')}
                    </h2>
                    {!isFormVisible && (
                        <button
                            className="bg-primary hover:bg-primary-dark text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                            onClick={() => { setEditingAddress(null); setFormData(initialFormData); setIsFormVisible(true); }}
                        >
                            <Plus size={18} /> {t('addresses_page.new_address')}
                        </button>
                    )}
                </div>

                {isFormVisible && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 mb-8 animate-fade-in-up">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className={`text-lg font-bold text-dark ${isRtl ? 'border-e-4 pe-3' : 'border-s-4 ps-3'} border-primary`}>
                                {editingAddress ? t('addresses_page.edit_address') : t('addresses_page.add_address')}
                            </h3>
                            <button onClick={() => setIsFormVisible(false)} className="text-gray-400 hover:text-red-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('auth.governorate')}</label>
                                    <select
                                        name="governorate"
                                        value={formData.governorate}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        required
                                    >
                                        <option value="">{t('auth.select_governorate')}</option>
                                        {governorates.map(gov => (
                                            <option key={gov.id} value={gov.name_ar}>
                                                {gov.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('auth.city')}</label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                        required
                                        placeholder={t('auth.city')}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('auth.street')}</label>
                                <input
                                    type="text"
                                    name="street"
                                    value={formData.street}
                                    onChange={handleInputChange}
                                    className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    required
                                    placeholder={t('auth.street')}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('addresses_page.building')}</label>
                                    <input
                                        type="text"
                                        name="building_number"
                                        value={formData.building_number}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-1">{t('addresses_page.apartment')}</label>
                                    <input
                                        type="text"
                                        name="apartment_number"
                                        value={formData.apartment_number}
                                        onChange={handleInputChange}
                                        className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-1">{t('addresses_page.notes')}</label>
                                <textarea
                                    name="notes"
                                    value={formData.notes}
                                    onChange={handleInputChange}
                                    className="w-full bg-gray-50 border border-gray-200 text-dark rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all h-24 resize-none text-sm"
                                    placeholder={t('addresses_page.additional_notes_placeholder', 'أدخل أي ملاحظات إضافية (مثل: رقم هاتف بديل للتواصل، أو علامة مميزة للمنزل...)')}
                                ></textarea>
                            </div>

                            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100 cursor-pointer" onClick={() => setFormData(prev => ({...prev, is_default: !prev.is_default}))}>
                                <input
                                    type="checkbox"
                                    name="is_default"
                                    checked={formData.is_default}
                                    onChange={handleInputChange}
                                    className="w-5 h-5 accent-primary cursor-pointer"
                                    id="is_default_check"
                                />
                                <label className="text-sm font-bold text-dark cursor-pointer select-none" htmlFor="is_default_check">
                                    {t('addresses_page.set_default')}
                                </label>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={submitting} className="flex-1 bg-primary hover:bg-primary-dark text-white py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-70">
                                    {submitting ? t('common.loading') : (editingAddress ? t('addresses_page.save_btn_edit') : t('addresses_page.save_btn_add'))}
                                </button>
                                <button type="button" className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors" onClick={() => setIsFormVisible(false)}>
                                    {t('common.cancel')}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.length > 0 ? addresses.map(address => (
                        <div key={address.id} className={`relative bg-white rounded-3xl p-4 md:p-6 border-2 transition-all duration-300 group ${address.is_default ? 'border-primary shadow-md' : 'border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md'}`}>

                            {address.is_default && (
                                <div className={`absolute top-0 ${isRtl ? 'right-0 rounded-bl-2xl rounded-tr-[1.3rem]' : 'left-0 rounded-br-2xl rounded-tl-[1.3rem]'} bg-primary text-white text-[10px] md:text-xs font-bold px-3 py-1.5 flex items-center gap-1.5 shadow-sm`}>
                                    <Star size={12} fill="currentColor" className="animate-pulse" />
                                    {t('addresses_page.default_badge', 'العنوان الافتراضي')}
                                </div>
                            )}

                            <div className={`flex items-start gap-3 md:gap-4 mb-4 ${address.is_default ? 'mt-4' : ''}`}>
                                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${address.is_default ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-400'}`}>
                                    <Home size={20} className="md:w-6 md:h-6" />
                                </div>
                                <div className="flex-grow">
                                    <h5 className="font-black text-dark text-base md:text-lg leading-tight mb-1">{address.city}</h5>
                                    <p className="text-gray-500 text-xs md:text-sm font-medium m-0 leading-relaxed">{address.street}</p>
                                </div>
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-3 md:p-4 text-xs md:text-sm text-gray-600 space-y-2 mb-4 border border-gray-100">
                                <div className="flex items-center gap-2 font-bold text-dark">
                                    <MapPin size={16} className="text-primary" />
                                    <span>{t('auth.governorate')} {address.governorate}</span>
                                </div>
                                {(address.building_number || address.apartment_number) && (
                                    <div className="flex items-center gap-2 font-medium">
                                        <Building size={16} className="text-gray-400" />
                                        <span>
                                            {address.building_number ? `${t('addresses_page.building')}: ${address.building_number}` : ''}
                                            {address.building_number && address.apartment_number ? ' | ' : ''}
                                            {address.apartment_number ? `${t('addresses_page.apartment')}: ${address.apartment_number}` : ''}
                                        </span>
                                    </div>
                                )}
                                {address.notes && (
                                    <div className="mt-2 pt-2 border-t border-gray-200/60 text-xs font-medium text-gray-500">
                                        <strong>{t('addresses_page.notes')}:</strong> {address.notes}
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(address)}
                                    className="flex-1 py-2.5 md:py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-50 hover:bg-primary/10 hover:text-primary border border-gray-100 hover:border-primary/20 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Edit3 size={16} /> {t('common.edit')}
                                </button>
                                <button
                                    onClick={() => requestDelete(address.id)}
                                    className="flex-1 py-2.5 md:py-2 rounded-xl text-sm font-bold text-gray-600 bg-gray-50 hover:bg-red-50 hover:text-red-600 border border-gray-100 hover:border-red-200 transition-all flex items-center justify-center gap-1.5"
                                >
                                    <Trash2 size={16} /> {t('common.delete')}
                                </button>
                            </div>
                        </div>
                    )) : (
                        !isFormVisible && (
                            <div className="col-span-full py-16 text-center bg-white rounded-3xl border border-dashed border-gray-200 shadow-sm">
                                <div className="bg-primary/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                    <MapPin size={32} />
                                </div>
                                <h3 className="text-lg font-bold text-dark mb-2">{t('addresses_page.no_addresses', 'لا توجد عناوين مسجلة')}</h3>
                                <p className="text-gray-500 font-medium mb-6 text-sm">{t('addresses_page.add_first_address_desc', 'قم بإضافة عنوانك لتسهيل عملية التوصيل في طلباتك القادمة.')}</p>
                                <button
                                    onClick={() => setIsFormVisible(true)}
                                    className="btn btn-primary px-8 py-3 rounded-xl shadow-md flex items-center gap-2 mx-auto"
                                >
                                    <Plus size={20} /> {t('addresses_page.add_first_address', 'إضافة عنوان جديد')}
                                </button>
                            </div>
                        )
                    )}
                </div>
            </div>

            <ConfirmModal
                isOpen={!!addressToDelete}
                onClose={() => setAddressToDelete(null)}
                onConfirm={confirmDelete}
                title={t('addresses_page.delete_confirm_title')}
                message={t('addresses_page.delete_confirm_message')}
                confirmText={t('common.confirm')}
                icon="trash"
            />
        </div>
    );
};

export default Addresses;
