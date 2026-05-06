import React, { useState, useEffect, useCallback, useMemo } from "react";
import AuthContext from "./AuthContext";
import axios from '../../services/axiosConfig';
import { safeLocalStorage, safeSessionStorage } from '../../utils/storageHelper';

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const storedUser = safeLocalStorage.getItem("user_info");
      return storedUser ? JSON.parse(storedUser) : null;
    } catch {
      return null;
    }
  });

  const [accessToken, setAccessToken] = useState(() => safeLocalStorage.getItem("access"));
  const [refreshToken, setRefreshToken] = useState(() => safeLocalStorage.getItem("refresh"));
  const [loading, setLoading] = useState(true);
  const [globalDiscount, setGlobalDiscount] = useState(null);

  const logout = useCallback(() => {
    safeLocalStorage.removeItem("user_info");
    safeLocalStorage.removeItem("access");
    safeLocalStorage.removeItem("refresh");
    safeLocalStorage.removeItem('guestCart');

    safeSessionStorage.removeItem("pendingIdentifier");
    safeSessionStorage.removeItem("otp_cooldown_end");
    safeSessionStorage.removeItem("returnUrl");
    safeSessionStorage.removeItem("auth_temp_data");

    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
  }, []);

  const fetchGlobalDiscount = useCallback(async () => {
    try {
      const res = await axios.get('/core/public-discount-settings/');
      setGlobalDiscount(res.data);
    } catch (error) {
      console.error("Global discount fetch error", error);
      setGlobalDiscount(null);
    }
  }, []);

  const refreshUserProfile = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await axios.get('/accounts/me/');
      const updatedUser = response.data;
      setUser(updatedUser);
      safeLocalStorage.setItem("user_info", JSON.stringify(updatedUser));
      return updatedUser;
    } catch (error) {
      if (error.response?.status === 401) {
        logout();
      }
      console.error("Failed to refresh user profile:", error);
      throw error;
    }
  }, [accessToken, logout]);

  const mergeGuestCart = useCallback(async () => {
    try {
      const guestCartJson = safeLocalStorage.getItem('guestCart');
      if (!guestCartJson) return;

      const guestCartToMerge = JSON.parse(guestCartJson);

      if (Array.isArray(guestCartToMerge) && guestCartToMerge.length > 0) {
        await axios.post('/cart/merge-guest-cart/', {
          guest_cart_items: guestCartToMerge.map(item => ({
            animal_id: item.animal_id,
            share_quantity: item.share_quantity || 1,
            selected_services: item.selected_services || {},
            pipeline: item.pipeline || 'M'
          }))
        });
        safeLocalStorage.removeItem('guestCart');
      }
    } catch (error) {
      console.error("Failed to merge guest cart:", error);
      throw error;
    }
  }, []);

  const login = useCallback(async (userInfo, newAccessToken, newRefreshToken) => {
    safeLocalStorage.setItem("access", newAccessToken);
    safeLocalStorage.setItem("refresh", newRefreshToken);
    setAccessToken(newAccessToken);
    setRefreshToken(newRefreshToken);

    safeLocalStorage.setItem("user_info", JSON.stringify(userInfo));
    setUser(userInfo);

    try {
      await mergeGuestCart();
    } catch (error) {
      console.error("Cart merge error", error);
    }

    try {
      await refreshUserProfile();
    } catch (error) {
      console.error(error);
    }

    window.dispatchEvent(new CustomEvent('auth-login-success'));

    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('cart-updated'));
    }, 500);

    safeSessionStorage.removeItem("pendingIdentifier");
    safeSessionStorage.removeItem("otp_cooldown_end");
    safeSessionStorage.removeItem("returnUrl");
  }, [mergeGuestCart, refreshUserProfile]);

  const updateUserContext = useCallback((newUserInfo) => {
    setUser(currentUser => {
      if (!currentUser) return newUserInfo;
      const updatedUser = { ...currentUser, ...newUserInfo };
      safeLocalStorage.setItem("user_info", JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  const forceRefreshProfile = useCallback(async () => {
    return await refreshUserProfile();
  }, [refreshUserProfile]);

  useEffect(() => {
    const initAuth = async () => {
      await fetchGlobalDiscount();

      const storedAccessToken = safeLocalStorage.getItem("access");
      const storedRefreshToken = safeLocalStorage.getItem("refresh");
      const storedUserInfo = safeLocalStorage.getItem("user_info");

      if (storedAccessToken && storedRefreshToken) {
        setAccessToken(storedAccessToken);
        setRefreshToken(storedRefreshToken);

        if (storedUserInfo) {
          try {
            setUser(JSON.parse(storedUserInfo));
          } catch (error) {
            console.error("Failed to parse user info:", error);
            safeLocalStorage.removeItem("user_info");
          }
        }

        try {
            await refreshUserProfile();
        } catch (error) {
            console.error("Profile refresh failed during init, continuing anyway...", error);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, [refreshUserProfile, fetchGlobalDiscount]);

  const contextValue = useMemo(() => ({
    user,
    accessToken,
    refreshToken,
    login,
    logout,
    updateUserContext,
    refreshUserProfile: forceRefreshProfile,
    loading,
    globalDiscount,
    fetchGlobalDiscount
  }), [user, accessToken, refreshToken, login, logout, updateUserContext, forceRefreshProfile, loading, globalDiscount, fetchGlobalDiscount]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;
