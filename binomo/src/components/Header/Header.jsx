import React, { useState, useEffect, useContext } from 'react';
import { Crown, Sparkles, Coins, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PaymentModal from '../UI/PaymentModal';
import './Header.css';
import { UserContext } from "../../context/UserContext"

import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;

const Header = () => {
  const navigate = useNavigate();
  const [userName, setUserName] = useState('Guest');
  const [userLevel, setUserLevel] = useState('Trader');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // Получаем баланс из Context
  const { userBalance, setUserBalance, isAuthenticated, setIsAuthenticated } = useContext(UserContext);


  // Загрузка позиций из localStorage
  const loadEntriesFromStorage = () => {
    try {
      const saved = sessionStorage.getItem('trading_positions');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading positions from localStorage:', error);
      return [];
    }
  };

   useEffect(() => {
    const fetchBalance = async () => {
      try {
        const token = localStorage.getItem("access_token");
        
        if (!token) {
          console.log('No token, skipping balance fetch');
          return;
        }

        const response = await fetch(`${API_BASE_URL}/api/user/get_balance`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Error receiving the balance");
        }

        const data = await response.json();
        const balance = parseFloat(data.balance);
        
        //console.log('✅ Баланс загружен с бэкенда:', balance);
        
        // Обновляем через Context (автоматически сохранится в sessionStorage)
        setUserBalance(balance);
        
      } catch (err) {
        console.error('❌ Error while was loading balance', err);
      }
    };


    fetchBalance();
  }, []); // Выполняется один раз при монтировании

  // Проверка токена
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      setIsAuthenticated(true);
      setUserName('John Doe'); // Замени на реальные данные с API
    }
  }, [setIsAuthenticated]);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    sessionStorage.removeItem('balance');
    localStorage.removeItem("typePosition");
    sessionStorage.removeItem("selectedPair");
    sessionStorage.removeItem("balance_usd");
    localStorage.removeItem("hasTraded");
    localStorage.removeItem("pendingWithdraw");
    localStorage.removeItem("initial_deposit");

    
    setIsAuthenticated(false);
    setUserBalance(0);
    navigate('/login');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleDepositClick = () => {
    navigate('/balance'); // Переход на страницу баланса
  };

  return (
      <>
      <header className="casino-header">
        {/* Логотип и навигация слева */}
          {/* Флаг UZ слева в конце */}
          <div>
            <span className="flag-text-green">F<span className="finova-i">i</span>nova</span>
          </div>

        {/* Информация пользователя и баланс справа */}
        <div className="header-right">
          {isAuthenticated ? (
            <>
              {/* Зеленый баланс в UZS с зеленым текстом */}
              <div className="balance-container">
                <div className="balance-amount green-text">
                  {userBalance.toLocaleString('ru-RU', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })} USD
                </div>
                <div className="balance-label green-text">BALANCE REAL</div>
              </div>

              {/* Желтая кнопка "Пополнить" */}
              <button 
                className="deposit-btn orange-btn"
                onClick={handleDepositClick}
              >
                <span>CUENTA PERSONAL</span>
              </button>

              {/* Кнопка выхода */}
              <button className="logout-btn" onClick={handleLogout}>
                <LogOut size={20} />
                <span>Cerrar sesión</span>
              </button>
            </>
          ) : (
            <>
              {/* Кнопка входа для неавторизованных */}
              <button className="login-btn" onClick={handleLogin}>
                Iniciar sesión
              </button>
              <button className="register-btn" onClick={() => navigate('/register')}>
                Registrarse
              </button>
            </>
          )}
        </div>
      </header>

      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />
      </>
  );
};

export default Header;