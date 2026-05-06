import React, { useState } from 'react';
import { OnFarmSaleContext } from './OnFarmSaleContext';

export const OnFarmSaleProvider = ({ children }) => {
    const initialFormData = {
        payment_method: 'cash',
        delivery_type: 'pickup',
        delivery_date: '',
        delivery_address_id: '',
        payment_type: 'full',
        deposit_amount: '',
        notes: ''
    };

    const [selectedAnimals, setSelectedAnimals] = useState([]);
    const [customerInfo, setCustomerInfo] = useState({
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        is_corporate: false,
        business_name: ''
    });
    const [formData, setFormData] = useState(initialFormData);
    const [services, setServices] = useState({});
    const [customerLocked, setCustomerLocked] = useState(false);

    const resetSaleState = () => {
        setSelectedAnimals([]);
        setCustomerInfo({
            customer_name: '',
            customer_phone: '',
            customer_email: '',
            is_corporate: false,
            business_name: ''
        });
        setFormData(initialFormData);
        setServices({});
        setCustomerLocked(false);
    };

    const value = {
        selectedAnimals,
        setSelectedAnimals,
        customerInfo,
        setCustomerInfo,
        formData,
        setFormData,
        services,
        setServices,
        customerLocked,
        setCustomerLocked,
        resetSaleState
    };

    return (
        <OnFarmSaleContext.Provider value={value}>
            {children}
        </OnFarmSaleContext.Provider>
    );
};

