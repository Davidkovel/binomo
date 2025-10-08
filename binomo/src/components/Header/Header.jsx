import React, { useState, useEffect } from 'react';
import { Crown, Sparkles, Coins, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PaymentModal from '../UI/PaymentModal';
import './Header.css';
import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;

const Header = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState('Guest');
  const [userLevel, setUserLevel] = useState('Trader');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [entries, setEntries] = useState([]);

  // Загрузка позиций из localStorage
  const loadEntriesFromStorage = () => {
    try {
      const saved = localStorage.getItem('trading_positions');
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Error loading positions from localStorage:', error);
      return [];
    }
  };

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        const token = localStorage.getItem("access_token"); // если хранишь токен
        const response = await fetch(`${API_BASE_URL}/api/user/get_balance`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Ошибка при получении баланса");
        }

        const data = await response.json();

        setUserBalance(parseFloat(data.balance));
        localStorage.setItem("balance", data.balance)
      } catch (err) {
        console.error(err);
      }
    };

    // Загружаем сохраненные позиции
    const savedEntries = loadEntriesFromStorage();
    if (savedEntries.length > 0) {
      setEntries(savedEntries);
    }

    fetchBalance();
  }, []);

  useEffect(() => {
    // Проверяем токен при загрузке
    const token = localStorage.getItem('access_token');
    if (token) {
      setIsAuthenticated(true);
      // Здесь можно получить данные пользователя с бэкенда
      // Пока используем моковые данные
      setUserName('John Doe');
      setUserBalance(10000);
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setIsAuthenticated(false);
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
            <span className="flag-text">UZ</span>
          </div>

        {/* Информация пользователя и баланс справа */}
        <div className="header-right">
          {isAuthenticated ? (
            <>
              {/* Зеленый баланс в UZS с зеленым текстом */}
              <div className="balance-container">
                <div className="balance-amount green-text">
                  {userBalance.toLocaleString()} UZS
                </div>
                <div className="balance-label green-text">РЕАЛЬНЫЙ БАЛАНС</div>
              </div>

              {/* Желтая кнопка "Пополнить" */}
              <button 
                className="deposit-btn orange-btn"
                onClick={handleDepositClick}
              >
                <span>Пополнить</span>
              </button>

              {/* Кнопка выхода */}
              <button className="logout-btn" onClick={handleLogout}>
                <LogOut size={20} />
                <span>Выйти</span>
              </button>
            </>
          ) : (
            <>
              {/* Кнопка входа для неавторизованных */}
              <button className="login-btn" onClick={handleLogin}>
                Войти
              </button>
              <button className="register-btn" onClick={() => navigate('/register')}>
                Регистрация
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