import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import useAuth from "../../context/auth/useAuth";
import axios from '../../services/axiosConfig';
import { AppContext } from "./AppContext";
import { toast } from 'react-toastify';
import { safeLocalStorage } from '../../utils/storageHelper';

export const AppProvider = ({ children }) => {
  const { user } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  const [pendingOrder, setPendingOrder] = useState(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);

  const triggerRefetch = useCallback(() => {
    setRefetchTrigger(prev => prev + 1);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchNavbarData = useCallback(async () => {
    if (!user) {
      try {
        const guestCart = JSON.parse(safeLocalStorage.getItem('guestCart')) ||[];
        const count = guestCart.reduce((sum, item) => sum + (Number(item.share_quantity) || 1), 0);
        setCartCount(count);
        setNotificationCount(0);
        setPendingOrder(null);
      } catch {
        setCartCount(0);
      }
      return;
    }

    setIsLoading(true);
    try {
      const[cartRes, notifRes, ordersRes] = await Promise.allSettled([
        axios.get("/cart/"),
        axios.get("/notifications/"),
        axios.get("/orders/list/?status=pending")
      ]);

      if (cartRes.status === 'fulfilled' && cartRes.value?.data) {
        const cartData = cartRes.value.data;
        let count = 0;
        if (Array.isArray(cartData.items)) {
          count = cartData.items.reduce((sum, item) => sum + (Number(item.share_quantity) || 1), 0);
        } else {
          count = cartData.total_items || cartData.cart_totals?.items_count || 0;
        }
        setCartCount(Number(count) || 0);
      }

      if (notifRes.status === 'fulfilled' && notifRes.value?.data) {
        const notifications = notifRes.value.data.results || [];
        const unread = notifications.filter(n => !n.is_read).length;
        setNotificationCount(unread);
      }

      if (ordersRes.status === 'fulfilled' && ordersRes.value?.data) {
        const allOrders = ordersRes.value.data.results || ordersRes.value.data || [];
        const actualPending = allOrders.filter(o => o.status === 'pending' && o.source !== 'b2b');
        setPendingOrder(actualPending.length > 0 ? actualPending[0] : null);
      }
    } catch (err) {
      console.error("AppProvider fetch error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      if (wsRef.current) {
        const ws = wsRef.current;
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.addEventListener('open', () => ws.close());
        } else {
          ws.close();
        }
        wsRef.current = null;
      }
      return;
    }

    const token = safeLocalStorage.getItem("access");
    if (!token) return;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.host}/ws/notifications/?token=${token}`;

    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'send_notification' || data.type === 'general_notification') {
          const payload = data.payload || {};
          setNotificationCount(prev => prev + 1);
          toast.info(
            <div>
              <strong className="d-block">{payload.title || "إشعار جديد"}</strong>
              <span style={{ fontSize: '13px' }}>{payload.message}</span>
            </div>,
            { position: "top-right", icon: "🔔", autoClose: 6000 }
          );
        }
      } catch (e) {
        console.error("WebSocket message error:", e);
      }
    };

    return () => {
      if (wsRef.current) {
        const ws = wsRef.current;
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.addEventListener('open', () => ws.close());
        } else {
          ws.close();
        }
        wsRef.current = null;
      }
    };
  }, [user]);

  useEffect(() => {
    fetchNavbarData();
  }, [fetchNavbarData, refetchTrigger]);

  useEffect(() => {
    const handleLoginSuccess = () => setTimeout(fetchNavbarData, 500);
    const handleCartUpdate = () => fetchNavbarData();

    window.addEventListener('auth-login-success', handleLoginSuccess);
    window.addEventListener('cart-updated', handleCartUpdate);

    return () => {
      window.removeEventListener('auth-login-success', handleLoginSuccess);
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, [fetchNavbarData]);

  const value = useMemo(() => ({
    cartCount,
    notificationCount,
    pendingOrder,
    isLoading,
    error,
    triggerRefetch,
    clearError
  }), [cartCount, notificationCount, pendingOrder, isLoading, error, triggerRefetch, clearError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

