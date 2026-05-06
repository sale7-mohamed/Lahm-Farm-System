import React from "react";
import { Navigate, useLocation } from 'react-router-dom';

const Login = () => {
  const location = useLocation();

  //   state (     )    
  return <Navigate to="/account/login-check" state={{ from: location.state?.from }} replace />;
};

export default Login;
