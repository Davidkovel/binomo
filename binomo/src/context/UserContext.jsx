import React, { createContext, useState, useEffect } from "react";
import { CONFIG_API_BASE_URL } from '../components/config/constants'

const API_BASE_URL = CONFIG_API_BASE_URL;

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [userBalance, setUserBalance] = useState(() => {
    // Инициализация из sessionStorage
    const saved = sessionStorage.getItem("balance");
    return saved ? parseFloat(saved) : 0;
  });
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  // Функция для обновления баланса с сохранением в sessionStorage
  const updateBalance = (newBalance) => {
    const balance = typeof newBalance === 'function' ? newBalance(userBalance) : newBalance;
    
    // Обновляем локально
    setUserBalance(balance);
    sessionStorage.setItem("balance", balance.toString());
    //console.log('💰 Context: Баланс обновлен локально:', balance.toFixed(2));
  };

  /*const updateBalance = async (newBalance) => {
    const balance =
      typeof newBalance === "function" ? newBalance(userBalance) : newBalance;

    const amount_change = balance - userBalance; // Это правильное изменение
    // 🔹 1. Обновляем локально
    setUserBalance(balance);
    sessionStorage.setItem("balance", balance.toString());
    console.log("💰 Context: Баланс обновлен локально:", balance);

    // 🔹 2. Обновляем на backend
    try {
      const token = localStorage.getItem("access_token");
      const response = await fetch(`${API_BASE_URL}/api/user/update_balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_change: amount_change,
        }),
      });

      if (response.ok) {
        console.log("✅ Баланс успешно обновлен на backend");
      } else {
        console.error("❌ Ошибка при обновлении баланса на backend");
      }
    } catch (error) {
      console.error("🚨 Ошибка обновления баланса:", error);
    }
  };*/

  return (
    <UserContext.Provider 
      value={{ 
        userBalance, 
        setUserBalance, // 🔹 Оставляем setUserBalance для прямого использования
        updateBalance,  // 🔹 Добавляем updateBalance в контекст
        isAuthenticated, 
        setIsAuthenticated
      }}
    >
      {children}
    </UserContext.Provider>
  );
};