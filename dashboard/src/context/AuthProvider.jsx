import React, { useState, useEffect, useCallback } from 'react';
import axiosInstance from '../api/axiosConfig';
import AuthContext from './AuthContext';
import { toast } from 'react-toastify';

const STORAGE_KEYS = {
  USER_INFO: 'staff_user_info',
  ACCESS_TOKEN: 'staff_access_token',
  REFRESH_TOKEN: 'staff_refresh_token',
  PERMISSIONS: 'staff_permissions',
  MODULE_ACCESS: 'module_access',
  IS_SUPERUSER: 'is_superuser',
  SESSION_EXPIRY: 'staff_session_expiry',
};

const DEFAULT_SESSION_HOURS = 8;
const REQUEST_TIMEOUT = 5000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem(STORAGE_KEYS.USER_INFO);
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [loading, setLoading] = useState(true);

  const logout = useCallback((reason = null) => {
    setUser(null);
    localStorage.clear();
    sessionStorage.clear();
    delete axiosInstance.defaults.headers.common['Authorization'];

    window.dispatchEvent(new CustomEvent('force-logout'));

    if (reason) {
      toast.error(reason);
    }

    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, []);

  const checkTokenValidity = useCallback(async () => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return false;

    try {
      await axiosInstance.get('/management/chat/rooms/', {
        timeout: REQUEST_TIMEOUT,
        _suppressErrorLog: true,
      });
      return true;
    } catch (error) {
      if (error.response?.status === 403) {
        return true;
      }
      return false;
    }
  }, []);

  const refreshUserProfile = useCallback(async () => {
    if (!user) return;

    const accessToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!accessToken) return;

    try {
      const response = await axiosInstance.get('/management/employees/me/', {
        timeout: REQUEST_TIMEOUT,
        _suppressErrorLog: true,
      });

      const { user_info, module_access, permissions, is_superuser } = response.data;

      setUser(user_info);
      localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user_info));
      localStorage.setItem(STORAGE_KEYS.MODULE_ACCESS, JSON.stringify(module_access || {}));
      localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(permissions || []));
      localStorage.setItem(STORAGE_KEYS.IS_SUPERUSER, JSON.stringify(is_superuser || false));

      window.dispatchEvent(new CustomEvent('permissions-updated'));
    } catch (error) {
      if (error.response?.status === 401) {
        console.warn('Session expired during profile refresh');
      }
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const checkSessionRealTime = () => {
      const expiryTime = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);
      if (expiryTime && new Date().getTime() > parseInt(expiryTime, 10)) {
        logout('انتهت مدة الجلسة المسموحة، يرجى تسجيل الدخول مجدداً.');
      }
    };

    const sessionInterval = setInterval(checkSessionRealTime, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkSessionRealTime();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(sessionInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user, logout]);

  useEffect(() => {
    const handleNeedsRefresh = () => {
      refreshUserProfile();
    };
    window.addEventListener('needs-profile-refresh', handleNeedsRefresh);

    return () => {
      window.removeEventListener('needs-profile-refresh', handleNeedsRefresh);
    };
  }, [refreshUserProfile]);

  useEffect(() => {
    const initializeAuth = async () => {
      const expiryTime = localStorage.getItem(STORAGE_KEYS.SESSION_EXPIRY);

      if (expiryTime && new Date().getTime() > parseInt(expiryTime, 10)) {
        logout('انتهت صلاحية الجلسة.');
        setLoading(false);
        return;
      }

      const storedUser = localStorage.getItem(STORAGE_KEYS.USER_INFO);
      const storedToken = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

      if (storedUser && storedToken) {
        const isValid = await checkTokenValidity();
        if (isValid) {
          setUser(JSON.parse(storedUser));
          axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        } else {
          logout('تم تسجيل خروجك لأسباب أمنية.');
        }
      }

      setLoading(false);
    };

    initializeAuth();

    const handleAuthLogout = () => logout();
    window.addEventListener('auth-logout', handleAuthLogout);

    return () => {
      window.removeEventListener('auth-logout', handleAuthLogout);
    };
  }, [logout, checkTokenValidity]);

  useEffect(() => {
    const handleTokenRefresh = () => {
      setTimeout(refreshUserProfile, 1000);
    };

    window.addEventListener('auth-token-refreshed', handleTokenRefresh);

    return () => {
      window.removeEventListener('auth-token-refreshed', handleTokenRefresh);
    };
  }, [refreshUserProfile]);

  const login = async (username, password) => {
    try {
      const response = await axiosInstance.post(
        '/management/auth/login/',
        { username, password },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept-Language': 'ar',
          },
        }
      );

      const {
        access,
        refresh,
        user_info,
        permissions,
        session_duration,
        module_access,
        is_superuser,
      } = response.data;

      if (!access || !user_info) {
        throw new Error('Invalid login response');
      }

      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, access);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, refresh);
      localStorage.setItem(STORAGE_KEYS.USER_INFO, JSON.stringify(user_info));
      localStorage.setItem(STORAGE_KEYS.PERMISSIONS, JSON.stringify(permissions || []));
      localStorage.setItem(STORAGE_KEYS.MODULE_ACCESS, JSON.stringify(module_access || {}));
      localStorage.setItem(STORAGE_KEYS.IS_SUPERUSER, JSON.stringify(is_superuser || false));

      localStorage.setItem('login_time_tracker', new Date().toISOString());

      if (window.dispatchEvent) {
        window.dispatchEvent(new CustomEvent('auth-token-refreshed', {
          detail: access
        }));
      }

      const sessionDurationMs =
        session_duration && session_duration > 0
          ? session_duration * 60 * 1000
          : DEFAULT_SESSION_HOURS * 60 * 60 * 1000;
      const expiryTime = new Date().getTime() + sessionDurationMs;
      localStorage.setItem(STORAGE_KEYS.SESSION_EXPIRY, expiryTime);

      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${access}`;
      setUser(user_info);

      toast.success('✅ تم تسجيل الدخول بنجاح!');

      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        toast.error('اسم المستخدم أو كلمة المرور غير صحيحة');
      } else if (error.response?.status === 400) {
        toast.error('بيانات الدخول غير صالحة');
      } else if (error.message === 'Connection timeout') {
        toast.error('انتهت مهلة الاتصال بالخادم');
      } else {
        toast.error('حدث خطأ أثناء تسجيل الدخول');
      }

      throw error;
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
    checkTokenValidity,
    refreshUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
