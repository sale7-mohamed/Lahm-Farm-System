import { useState, useEffect, useCallback, useRef } from 'react';
import axios from '../api/axiosConfig';

export const useSidebarStats = () => {
    const [stats, setStats] = useState({
        pendingOrders: 0,
        pendingApprovals: 0,
        lowStockItems: 0,
    });

    const timeoutRef = useRef(null);

    const fetchStats = useCallback(async () => {
        try {
            const res = await axios.get('/management/dashboard/');
            const data = res.data;

            setStats({
                pendingOrders: data.orders_summary?.pending_orders || 0,
                lowStockItems: data.inventory_forecast?.filter(i => i.status === 'low' || i.status === 'critical').length || 0,
            });

            const approvalsRes = await axios.get('/management/approvals/');
            const pendingApprovalsCount = approvalsRes.data.results?.filter(r => r.status === 'pending').length || 0;

            setStats(prev => ({ ...prev, pendingApprovals: pendingApprovalsCount }));
        } catch (error) {
            if (error.response?.status !== 403) {
                console.error("Failed to fetch sidebar stats:", error);
            }
        }
    }, []);

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 60000);

        const handleWsNotification = () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            timeoutRef.current = setTimeout(() => {
                fetchStats();
                timeoutRef.current = null;
            }, 800);
        };

        window.addEventListener('chat-updated', handleWsNotification);
        window.addEventListener('app-notification-received', handleWsNotification);

        return () => {
            clearInterval(interval);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
            window.removeEventListener('chat-updated', handleWsNotification);
            window.removeEventListener('app-notification-received', handleWsNotification);
        };
    }, [fetchStats]);

    return stats;
};

