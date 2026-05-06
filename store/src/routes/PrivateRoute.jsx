import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../context/auth/useAuth';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

function PrivateRoute({ children }) {
  const { t } = useTranslation();
  const { user, loading: authLoading, logout } = useAuth();

  if (authLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (user && user.is_suspended) {
    toast.error(user.custom_notification || t('errors.account_suspended'));
    logout();
    return <Navigate to="/account/login-check" />;
  }

  return user ? children : <Navigate to="/account/login-check" />;
}

export default PrivateRoute;
