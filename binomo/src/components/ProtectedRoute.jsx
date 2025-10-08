import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('access_token');
  
  if (!token) {
    // Перенаправляем на страницу входа если нет токена
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

export default ProtectedRoute;