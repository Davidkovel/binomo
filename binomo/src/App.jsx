import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import TradingPlatform from './components/TradingCharts';
import Header from './components/Header';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import ProtectedRoute from './components/ProtectedRoute';
import BalancePage from './components/BalancePage';
import { UserProvider } from './context/UserContext';

function App() {
  return (
    <UserProvider>
      <Router>
        <Routes>
          {/* Публичные маршруты */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Защищенные маршруты */}
          <Route 
            path="/trading" 
            element={
              <ProtectedRoute>
                <Header />
                <TradingPlatform />
              </ProtectedRoute>
            } 
          />

          <Route 
            path="/balance" 
            element={
              <ProtectedRoute>
                <BalancePage />
              </ProtectedRoute>
            } 
          />
          
          {/* Редирект с главной на trading */}
          <Route path="/" element={<Navigate to="/trading" replace />} />
          
          {/* 404 - перенаправление на главную */}
          <Route path="*" element={<Navigate to="/trading" replace />} />
        </Routes>
      </Router>
    </UserProvider>
  );
}

export default App;


// JASDNJKASDKASNDJA11@@
