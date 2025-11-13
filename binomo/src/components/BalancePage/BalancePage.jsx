import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, CreditCard, LogOut, MessageCircle } from 'lucide-react';
import './BalancePage.css';
import PaymentModal from '../UI/PaymentModal';
import WithdrawModal from '../UI/WithdrawModal';
import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;

export default function BalancePage() {
    const navigate = useNavigate();
    const [userName, setUserName] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [userBalance, setUserBalance] = useState(0);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false); 
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('deposit'); // deposit or withdraw
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const fetchUserData = async () => {
            // Проверка авторизации
            const token = localStorage.getItem('access_token');
            if (!token) {
                navigate('/login');
                return;
            }

            try {
                const profileResponse = await fetch(`${API_BASE_URL}/api/user/profile/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (profileResponse.ok) {
                    const profileData = await profileResponse.json();
                    setUserEmail(profileData.email);
                    // Используем email как имя пользователя или первую часть email
                    setUserName(profileData.email.split('@')[0]);
                } else {
                    // Fallback если не удалось получить профиль
                    setUserName('User');
                }

                // Получение баланса
                const balanceResponse = await fetch(`${API_BASE_URL}/api/user/get_balance`, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                });

                if (balanceResponse.ok) {
                    const balanceData = await balanceResponse.json();
                    setUserBalance(balanceData.balance);
                }

            } catch (error) {
                console.error('Error fetching user data:', error);
                setUserName('User');
            }
        };
        fetchUserData();
        
        // Обновление времени каждую секунду
        const timer = setInterval(() => {
        setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(timer);
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('access_token');
        navigate('/login');
    };

    const formatTime = (date) => {
        return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        second: '2-digit',
        hour12: false 
        });
    };

    const getUTCTime = () => {
        const utcHours = currentTime.getUTCHours().toString().padStart(2, '0');
        const utcMinutes = currentTime.getUTCMinutes().toString().padStart(2, '0');
        const utcSeconds = currentTime.getUTCSeconds().toString().padStart(2, '0');
        return `${utcHours}:${utcMinutes}:${utcSeconds}`;
    };

    return (
        <div className="balance-page">
        {/* Header */}
        <header className="balance-header">
            <button className="back-btn" onClick={() => navigate('/trading')}>
            <ArrowLeft size={24} />
            </button>
            <h1 className="balance-title">Saldo</h1>
        </header>

        {/* User Info Section */}
        <div className="user-info-section">
        <div className="user-avatar-name">
            <div className="user-avatar">
                {userName.charAt(0).toUpperCase()}
            </div>
            <div className="user-details">
                <div className="user-name-display">{userName}</div>
                {userEmail && <div className="user-email">{userEmail}</div>}
            </div>
        </div>
        
        <div className="info-row">
            <div className="account-type-container">
            <div className="account-type-label">Tipo de cuenta</div>
            <div className="account-type-badge">Estándar</div>
            </div>

            <div className="time-container">
            <Clock size={16} className="clock-icon" />
            <span className="time-label">UTC:</span>
            <span className="time-value">{getUTCTime()}</span>
            </div>
        </div>
        </div>

        {/* Action Buttons */}
        <div className="action-buttons">
            <button 
                className={`action-btn deposit-action ${activeTab === 'deposit' ? 'active' : ''}`}
                onClick={() => {
                    setActiveTab('deposit');
                    setIsPaymentModalOpen(true); // Открываем PaymentModal
                }}
            >
                Recargar cuenta
            </button>
            <button 
                className={`action-btn withdraw-action ${activeTab === 'withdraw' ? 'active' : ''}`}
                onClick={() => {
                    const positions = JSON.parse(sessionStorage.getItem('trading_positions')) || [];
                    if (positions.length > 0) {
                        alert('❌ No se puede retirar mientras haya posiciones abiertas');
                        return;
                    }
                    setActiveTab('withdraw');
                    setIsWithdrawModalOpen(true); // Открываем WithdrawModal
                }}
            >
                Retirar fondos
            </button>
        </div>


        {/* Footer */}
        <footer className="balance-footer">
            <button className="footer-btn support-btn">
            <MessageCircle size={20} />
            <span>Soporte 24/7</span>
            </button>
            <button className="footer-btn logout-footer-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Cerrar sesión</span>
            </button>
        </footer>

        {/* Payment Modal - для пополнения */}
        <PaymentModal 
            isOpen={isPaymentModalOpen}
            onClose={() => setIsPaymentModalOpen(false)}
        />

        {/* Withdraw Modal - для вывода */}
        <WithdrawModal 
            isOpen={isWithdrawModalOpen}
            onClose={() => setIsWithdrawModalOpen(false)}
        />
        </div>
  );
}