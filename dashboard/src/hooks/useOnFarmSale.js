import { useContext } from 'react';
import { OnFarmSaleContext } from '../context/OnFarmSaleContext.js';

export const useOnFarmSale = () => {
    const context = useContext(OnFarmSaleContext);
    if (context === undefined) {
        throw new Error('useOnFarmSale must be used within an OnFarmSaleProvider');
    }
    return context;
};
