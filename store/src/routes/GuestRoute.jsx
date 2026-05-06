import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuth from '../context/auth/useAuth';

function GuestRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  //        ()   
  if (user) {
    return <Navigate to="/account-dashboard" replace />;
  }

  //         (  / )
  return children;
}

export default GuestRoute;
