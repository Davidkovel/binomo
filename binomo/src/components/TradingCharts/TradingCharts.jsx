import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef, useContext } from 'react';
import { TrendingUp } from 'lucide-react';
import './TradingPlatform.css';
import { UserContext } from "../../context/UserContext"

import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;



const saveEntriesToStorage = (entries) => {
  try {
    localStorage.setItem('trading_positions', JSON.stringify(entries));
  } catch (error) {
    console.error('Error saving positions to localStorage:', error);
  }
};

// Функция для загрузки позиций из localStorage
const loadEntriesFromStorage = () => {
  try {
    const saved = localStorage.getItem('trading_positions');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error loading positions from localStorage:', error);
    return [];
  }
};

const USD_TO_UZS = 13800;
const AI_MULTIPLIER = 34.788559;
const HIGH_MARGIN_MULTIPLIER = 38.2244351;
const PROFIT_AMOUNT = 11537890; // 11 537 890 сум

export default function TradingPlatform() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(50000);
  const [entries, setEntries] = useState(loadEntriesFromStorage());
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const { userBalance, setUserBalance, updateBalance } = useContext(UserContext);
  const [selectedPair, setSelectedPair] = useState(() => {
    return sessionStorage.getItem('selectedPair') || 'BTCUSDT';
  });
  const [tradeAmount, setTradeAmount] = useState(100000); // Amount для Buy/Sell
  const [tradeHours, setTradeHours] = useState(0);
  const [tradeMinutes, setTradeMinutes] = useState(30);
  const [tradeSeconds, setTradeSeconds] = useState(0);
  //const [initialDeposit, setInitialDeposit] = useState(0);
  const [leverage, setLeverage] = useState(1);
  const [orderAmount, setOrderAmount] = useState(10000);
  const chartContainerRef = useRef(null);
  const widgetRef = useRef(null);
  const timersRef = useRef({});

  const pnlRef = useRef({});
  const isClosingRef = useRef(false);
  const balanceLockRef = useRef(Promise.resolve());
  const closedPositionsRef  = useRef(new Set());


  const MIN_TRADE = 100000;


  const tradingPairs = [
    { symbol: 'BTCUSDT', name: 'BTC/USDT', binanceSymbol: 'BTCUSDT' },
    { symbol: 'ETHUSDT', name: 'ETH/USDT', binanceSymbol: 'ETHUSDT' },
    { symbol: 'BNBUSDT', name: 'BNB/USDT', binanceSymbol: 'BNBUSDT' },
    { symbol: 'SOLUSDT', name: 'SOL/USDT', binanceSymbol: 'SOLUSDT' },
    { symbol: 'XRPUSDT', name: 'XRP/USDT', binanceSymbol: 'XRPUSDT' },
    { symbol: 'ADAUSDT', name: 'ADA/USDT', binanceSymbol: 'ADAUSDT' },
  ];

  useEffect(() => {
    // Проверка авторизации при загрузке
    const token = localStorage.getItem('access_token');
    setIsAuthenticated(!!token);
  }, []);

  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const token = localStorage.getItem("access_token");
        const response = await fetch(`${API_BASE_URL}/api/user/is_admin`, {
          headers: {
            "Authorization": `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(data.is_admin);
          console.log("👤 Admin status:", data.is_admin);
        }
      } catch (error) {
        console.error("Error checking admin status:", error);
      }
    };
    
    if (isAuthenticated) {
      checkAdminStatus();
    }
  }, [isAuthenticated]);

  // Load TradingView script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${selectedPair}`,
      interval: '5',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: false,
      container_id: 'tradingview_chart',
      support_host: 'https://www.tradingview.com'
    });

    script.onload = () => setIsScriptLoaded(true);
    document.head.appendChild(script);

    return () => {
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [selectedPair]);

  useEffect(() => {
    const now = Date.now();

    entries.forEach(entry => {
      const remaining = entry.expiresAt - now;

      if (remaining > 0) {
        // если время ещё не вышло — ставим новый таймер
        const timerId = setTimeout(() => {
          autoClosePosition(entry.id);
          delete timersRef.current[entry.id];
        }, remaining);

        timersRef.current[entry.id] = timerId;
        //console.log(`⏳ Восстановлен таймер для позиции ${entry.id} (${Math.round(remaining / 1000)} сек осталось)`);
      } else {
        // если срок уже истёк — сразу закрываем
        //console.log(`💀 Время истекло — позиция ${entry.id} закрывается`);
        autoClosePosition(entry.id);
      }
    });
  }, []); // ⚠️ выполняется один раз при монтировании

  const [previousPnLs, setPreviousPnLs] = useState({});
  const accumulatedPnLRef = useRef(0);
  const balanceUSDRef = useRef(0);

  const updateBalanceUSD = (newBalanceUZS) => {
    const newBalanceUSD = (newBalanceUZS / USD_TO_UZS).toFixed(2);
    balanceUSDRef.current = parseFloat(newBalanceUZS);
    sessionStorage.setItem("balance_usd", newBalanceUZS);
    //console.log("💾 Обновлен баланс в USD:", newBalanceUZS);
  };


  useEffect(() => {
    const interval = setInterval(() => {
      if (entries.length === 0) return;

      let totalChangeUSD = 0;
      let totalChangeUZS = 0;
      const newPreviousPnLs = {};
      let hasChanges = false;

      entries.forEach(entry => {
        if (entry.closed) return;
        const currentPnL = calculatePnL(entry);
        const previousPnL = previousPnLs[entry.id] || { diff: "0" };
        
        let currentDiff = parseFloat(currentPnL.diff);
        let previousDiff = parseFloat(previousPnL.diff);
        
        // 🔹 Для AI делаем положительным, для Buy/Sell оставляем как есть
        /*if (entry.type === 'ai') {
          if (currentDiff < 0) currentDiff = Math.abs(currentDiff);
          if (previousDiff < 0) previousDiff = Math.abs(previousDiff);
        }*/
        
        const pnlChangeUSD = currentDiff - previousDiff;
        const roundedChangeUSD = Math.round(pnlChangeUSD * 100) / 100;
        
        if (Math.abs(roundedChangeUSD) > 0.001) {
          totalChangeUSD += roundedChangeUSD;
          hasChanges = true;
        }
        
        newPreviousPnLs[entry.id] = currentPnL;
      });

      if (hasChanges) {
        accumulatedPnLRef.current += totalChangeUSD;
        setUserBalance(prev => {
          const newBalance = prev + totalChangeUSD;
          updateBalanceUSD(newBalance);
          return newBalance;
        });
      }

      setPreviousPnLs(newPreviousPnLs);

    }, 1000);

    return () => clearInterval(interval);
  }, [entries, currentPrice, previousPnLs, setUserBalance]);

  // Initialize TradingView widget
  useEffect(() => {
    if (!isScriptLoaded || !chartContainerRef.current) return;

    if (widgetRef.current) {
      widgetRef.current.remove();
    }

    const widget = document.createElement('div');
    widget.id = 'tradingview_chart';
    widget.style.width = '100%';
    widget.style.height = '400px';
    
    chartContainerRef.current.appendChild(widget);
    widgetRef.current = widget;

    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${selectedPair}`,
      interval: '5',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '3',
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: false,
      container_id: 'tradingview_chart',
      hide_volume: true,
      support_host: 'https://www.tradingview.com'
    });

    widget.appendChild(script);
  }, [isScriptLoaded, selectedPair]);

  // Fetch real crypto price
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${selectedPair}`);
        const data = await response.json();
        setCurrentPrice(parseFloat(data.price));
      } catch (error) {
        //console.error('Error fetching price:', error);
        const simulatedPrice = 50000 + (Math.random() - 0.5) * 1000;
        setCurrentPrice(simulatedPrice);
      }
    };

    fetchPrice();
    const interval = setInterval(fetchPrice, 5000);

    return () => clearInterval(interval);
  }, [selectedPair]);

  useEffect(() => {
    saveEntriesToStorage(entries);
  }, [entries]);
  
  // Handle pair change
  const handlePairChange = (pair) => {
    const savedPositions = localStorage.getItem('trading_positions');
    const positions = savedPositions ? JSON.parse(savedPositions) : [];
    if (positions.length > 0) {
      alert("💼 Faol pozitsiyalar mavjud — biz hozirgi sahifada qolamiz, pozitsiyalar yopilgach boshqa juftliklarga o‘tishingiz mumkin");
    }
    else{
      setSelectedPair(pair);
      sessionStorage.setItem('selectedPair', pair);
    }
  };

  const handleBuyClick = () => {
    if (userBalance < 100000) {
      alert('Savdo uchun minimal depozit: 100,000 UZS');
      return;
    }

    if (tradeAmount < MIN_TRADE) {
      alert('Minimal savdo miqdori: 100,000 UZS');
      return;
    }

    if (tradeAmount > userBalance) {
      alert("Mablag' yetishmayapti. Mavjud balans: £{userBalance.toFixed(2)} UZS");
      return;
    }

    const durationMs = (tradeHours * 3600 + tradeMinutes * 60 + tradeSeconds) * 1000;
    
    if (durationMs < 60000) {
      alert('Eng kam vaqt 1 daqiqa.');
      return;
    }

    const entry = {
      id: Date.now(),
      type: 'buy',
      pair: selectedPair,
      price: currentPrice,
      amount: tradeAmount,
      leverage: leverage,
      margin: tradeAmount,
      positionSize: tradeAmount * leverage,
      time: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      expiresAt: Date.now() + durationMs,
      duration: durationMs
    };
    
    setEntries(prev => [...prev, entry]);

    const newBalance = userBalance - tradeAmount;

    balanceUSDRef.current = newBalance;
    setUserBalance(newBalance);
    updateBalanceOnBackend(newBalance);

    const timerId = setTimeout(() => {
      autoClosePosition(entry.id);
      delete timersRef.current[entry.id];
    }, durationMs);

    timersRef.current[entry.id] = timerId;
    localStorage.setItem("typePosition", "buy");
    
    console.log(`🟢 BUY позиция открыта. ID: ${entry.id}`);
  };


  const handleAI = () => {
    const hasTraded = localStorage.getItem("hasTraded") === "true";
    
    if (userBalance < 1000000) {
      alert('Savdo qilish uchun minimal depozit: 1 000 000 UZS.');
      return;
    }

    if (tradeAmount < MIN_TRADE) {
      alert('Minimal savdo miqdori: 100,000 UZS');
      return;
    }

    if (hasTraded) {
      alert("Savdo limiti to'ldi! Sizning hisobingiz professional hisob emas.");
      return;
    }

    if (entries.length >= 1) {
      alert("❌ Bir vaqtning o'zida faqat bitta faol pozitsiya ushlab turilishi mumkin.");
      return;
    }


    if (userBalance <= 0) {
      alert(`Pozitsiya ochish uchun mablag‘ yetarli emas. ${userBalance}`);
      return;
    }

    const entry = {
      id: Date.now(),
      type: 'ai',
      pair: selectedPair,
      price: currentPrice,
      amount: orderAmount,
      leverage: leverage,
      margin: userBalance,
      positionSize: userBalance * leverage,
      time: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      expiresAt: Date.now() + (3 * 60 * 60 * 1000)
    };
        
    setEntries(prev => [...prev, entry]);
    
    const timerId = setTimeout(() => {
      autoClosePosition(entry.id);
      delete timersRef.current[entry.id];
    }, 3 * 60 * 60 * 1000);
    
    timersRef.current[entry.id] = timerId;
    
    localStorage.setItem("typePosition", "ai")

    //console.log(`Позиция открыта на 30 минут. ID: ${entry.id}`);
  };

  const handleSellClick = () => {
    if (userBalance < 100000) {
      alert('Savdo uchun minimal depozit: 100,000 UZS');
      return;
    }

    if (tradeAmount > userBalance) {
      alert("Mablag' yetishmayapti. Mavjud balans: £{userBalance.toFixed(2)} UZS");
      return;
    }

    const durationMs = (tradeHours * 3600 + tradeMinutes * 60 + tradeSeconds) * 1000;
    
    if (durationMs < 60000) {
      alert('Eng kam vaqt 1 daqiqa.');
      return;
    }

    const entry = {
      id: Date.now(),
      type: 'sell',
      pair: selectedPair,
      price: currentPrice,
      amount: tradeAmount,
      leverage: leverage,
      margin: tradeAmount,
      positionSize: tradeAmount * leverage,
      time: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      expiresAt: Date.now() + durationMs,
      duration: durationMs
    };
    
    setEntries(prev => [...prev, entry]);

    const newBalance = userBalance - tradeAmount;

    balanceUSDRef.current = newBalance;
    setUserBalance(newBalance);
    updateBalanceOnBackend(newBalance);

    const timerId = setTimeout(() => {
      autoClosePosition(entry.id);
      delete timersRef.current[entry.id];
    }, durationMs);

    timersRef.current[entry.id] = timerId;
    localStorage.setItem("typePosition", "sell");
    
    console.log(`🔴 SELL позиция открыта. ID: ${entry.id}`);
  };

  const formatDuration = (ms) => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const calculatePnL = (entry) => {
    if (!currentPrice || !entry) return { diff: "0", percentage: "0", roi: "0" };

    const entryPrice = entry.price;
    const priceChange = currentPrice - entryPrice;
    
    let pnlMultiplier = 1;
    
    // 🔹 BUY: прибыль при росте (+), убыток при падении (-)
    // 🔹 SELL: прибыль при падении (-), убыток при росте (+)
    // 🔹 AI: всегда показывает прибыль (abs)
    
    if (entry.type === 'buy') {
      pnlMultiplier = 1; // Нормальное направление
    } else if (entry.type === 'sell') {
      pnlMultiplier = -1; // Обратное направление
    } else if (entry.type === 'ai') {
      // AI всегда в плюс
      const percentageChange = Math.abs((priceChange / entryPrice) * 100);
      const pnlUSD = Math.abs(entry.positionSize * (percentageChange / 100));
      const roiPercent = Math.abs(percentageChange * entry.leverage);
      
      return {
        diff: pnlUSD.toFixed(2),
        percentage: percentageChange.toFixed(2),
        roi: roiPercent.toFixed(2)
      };
    }

    const percentageChange = (priceChange / entryPrice) * 100;
    const pnlUSD = (entry.positionSize * (percentageChange / 100)) * pnlMultiplier;
    const roiPercent = (percentageChange * entry.leverage) * pnlMultiplier;

    return {
      diff: pnlUSD.toFixed(2),
      percentage: (percentageChange * pnlMultiplier).toFixed(2),
      roi: roiPercent.toFixed(2)
    };
  };


  // Функция для расчета оставшегося времени
  const getRemainingTime = (expiresAt) => {
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return '00:00';
    
    const minutes = Math.floor(remaining / 60000);
    const seconds = Math.floor((remaining % 60000) / 1000);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Функция-обертка для атомарных операций с балансом
  const withBalanceLock = async (callback) => {
    const previousOperation = balanceLockRef.current;
    
    let releaseNext;
    const currentOperation = new Promise(resolve => {
      releaseNext = resolve;
    });
    
    balanceLockRef.current = currentOperation;
    
    try {
      await previousOperation; // ⚠️ Критично: ждем предыдущую
      const result = await callback();
      return result;
    } finally {
      releaseNext(); // Разрешаем следующую
    }
  };

    // В начале компонента
  const round2 = (value) => {
    return Math.round(value * 100) / 100;
  };


  // функция авто-закрытия позиции
  const autoClosePosition = async (id) => {
    if (closedPositionsRef.current.has(id)) {
      console.log(`⚠️ Позиция ${id} уже закрыта, пропускаем`);
      return;
    }

    closedPositionsRef.current.add(id);
    await withBalanceLock(async () => {
      try {
        await new Promise(r => setTimeout(r, 250));

        const { displayPnl, displayRoi } = pnlRef.current[id] || { displayPnl: 0, displayRoi: 0 };

        let entry = entries.find(e => String(e.id) === String(id));
        if (!entry) {
          const storedEntries = JSON.parse(localStorage.getItem('trading_positions')) || [];
          entry = storedEntries.find(e => String(e.id) === String(id));
        }

        console.log(`⏰ Авто-закрытие позиции ID: ${id}`);

        if (entry.type === 'ai') {
          const profit = 10837890; // 🔥 фикс

          const newBalance = profit;

          balanceUSDRef.current = newBalance;
          setUserBalance(newBalance);

          await savePositionHistory(entry, {
            diff: profit,
            roi: ((profit / entry.amount) * 100).toFixed(2)
          });

          await updateBalanceOnBackend(newBalance);

          setEntries(prev => prev.filter(e => e.id !== id));
          localStorage.setItem("hasTraded", "true");
          return;
        }

        const currentBalance = balanceUSDRef.current;
        let profit;
        let roiPercent;

        // 🔹 Для админов - ВСЕГДА прибыль
        if (isAdmin) {
          profit = entry.amount * 0.8; // +80%
          roiPercent = 80;
          console.log("👑 ADMIN MODE: Всегда прибыль");
        } 
        // 🔹 Для обычных - обычная логика
        else {
          // Здесь ваша логика для обычных пользователей
          // Например, проверка displayPnl
          if (displayPnl < 0) {
            // ❌ Убыток
            console.log("❌ LOSS — ликвидация");
            
            const lossAmount = entry.amount;
            const newBalance = currentBalance - lossAmount;

            balanceUSDRef.current = newBalance;
            setUserBalance(newBalance);

            await updateBalanceOnBackend(newBalance);

            setEntries(prev => prev.filter(e => e.id !== id));
            if (timersRef.current[id]) {
              clearTimeout(timersRef.current[id]);
              delete timersRef.current[id];
            }

            console.log("✅ Убыточная позиция закрыта.");
            return;
          }
          
          // ✅ Прибыль
          profit = entry.amount * 0.8;
          roiPercent = 80;
        }

        const returnedMargin = entry.amount;
        const newBalance = currentBalance + returnedMargin + profit;

        // Обновляем баланс
        balanceUSDRef.current = newBalance;
        setUserBalance(newBalance);

        // Сохраняем историю выигрыша
        await savePositionHistory(entry, { diff: profit, roi: 80 });

        // Удаляем позицию
        setEntries(prev => prev.filter(e => e.id !== id));

        // Обновление баланса на сервере
        await updateBalanceOnBackend(newBalance);

        sessionStorage.removeItem('balance_usd');
        console.log("✅ Позиция успешно закрыта.");

        console.group(`🔒 CLOSE POSITION ${id}`);
        console.log("Balance before:", currentBalance);
        console.log("Entry amount:", entry.amount);
        console.log("Profit:", profit);
        console.log("Returned margin:", returnedMargin);
        console.log("Balance after:", newBalance);
        console.groupEnd();


      } catch (error) {
        console.error('❌ Error autoclosing :', error);
        closedPositionsRef.current.delete(id);
      } finally {
        isClosingRef.current = false;
      }
    });
  };

  const updateBalanceOnBackend = async (amountChange) => {
    try {
      const token = localStorage.getItem("access_token");
      const amountNumber = Number(amountChange);
      
      const response = await fetch(`${API_BASE_URL}/api/user/update_balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_change: amountNumber
        }),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.balance !== undefined) {
          setUserBalance(parseFloat(data.balance));
          sessionStorage.setItem("balance", data.balance.toString());
        }
        
        return data;
      } else {
        const errorText = await response.text();
        return null;
      }
    } catch (error) {
      return null;
    }
  };

  const savePositionHistory = async (entry, pnl) => {
    try {
      const token = localStorage.getItem("access_token");

      const payload = {
        type: entry.type,
        amount: entry.amount,
        profit: pnl.diff,
        roi: pnl.roi
      };

      await fetch(`${API_BASE_URL}/api/user/save_position_history`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const history = JSON.parse(localStorage.getItem("position_history")) || [];

      history.push({
        id: entry.id,
        type: entry.type,
        pair: entry.pair,
        openedAt: entry.time,
        closedAt: Date.now(),
        amount: entry.amount,
        entryPrice: entry.price,
        exitPrice: entry.exitPrice || 0,
        pnl: pnl.diff
      });

      localStorage.setItem("position_history", JSON.stringify(history));

    } catch (err) {
      console.error("❌ Error saving history:", err);
    }
  };


  const clampTradeAmount = (value) => {
    if (!userBalance) return MIN_TRADE;

    return Math.max(
      MIN_TRADE,
      Math.min(userBalance, value || MIN_TRADE)
    );
  };
        
  
  return (
    <div className="trading-platform">
      <div className="container">
        {/* Header */}
        {/*<div className="header-card">
          <div className="header-content">
            <div className="header-left">
              <h1>
                <TrendingUp size={32} />
                Finova
              </h1>
              {/*<p>{tradingPairs.find(p => p.symbol === selectedPair)?.name} • Binance • Real-time</p>
            </div>
            <div className="price-display">
                <div className="black-text">
                  {userBalance.toLocaleString('ru-RU', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })} UZS
                </div>
              {/*<div className="current-price">${currentPrice.toFixed(2)}</div>*
              <div className="black-text">РЕАЛЬНЫЙ БАЛАНС</div>
            </div>
          </div>*/}
        </div>

        {/* Pair Selector */}
        <div className="pair-selector-card">
          <h3 className="pair-selector-title">Savdo juftligini tanlang</h3>
          <div className="pair-buttons">
            {tradingPairs.map(pair => (
              <button
                key={pair.symbol}
                onClick={() => handlePairChange(pair.symbol)}
                className={`pair-btn ${selectedPair === pair.symbol ? 'active' : ''}`}
              >
                {pair.name}
              </button>
            ))}
          </div>
        </div>

        {/* TradingView Chart */}
        <div className="chart-card">
          <h2 className="chart-title">📈 {tradingPairs.find(p => p.symbol === selectedPair)?.name} Grafigi</h2>
          <div 
            ref={chartContainerRef}
            className="tradingview-widget-container"
          >
            {!isScriptLoaded && (
              <div className="chart-loading">
                TradingView grafigi yuklanmoqda...
              </div>
            )}
          </div>
          <div className="chart-footer">
            Grafik TradingView tomonidan ta’minlangan
          </div>
        </div>

        {/* Trading Controls с overlay */}
        <div className="trading-controls-card" style={{ position: 'relative' }}>
          {!isAuthenticated && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(5px)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10,
              cursor: 'pointer'
            }}
            onClick={() => navigate('/login')}
            >
              <div style={{
                textAlign: 'center',
                color: '#fff'
              }}>
                <h3 style={{ fontSize: '24px', marginBottom: '12px' }}>🔒 Savdo qilish uchun kiring</h3>
                <p style={{ color: '#94a3b8' }}>Kirish yoki ro‘yxatdan o‘tish uchun bosing</p>
              </div>
            </div>
          )}
          
          {/* Settings для Buy/Sell */}
          <div className="trade-settings">
            <div className="settings-row">
              <div className="setting-box">
                <label className="setting-label">Miqdor (UZS)</label>
                <div className="amount-input-wrapper">
                  <input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(clampTradeAmount(parseFloat(e.target.value)))}
                    className="amount-input-control"
                    min={MIN_TRADE}
                    max={userBalance}
                    step="1000"
                    disabled={!isAuthenticated || userBalance < MIN_TRADE}
                  />
                  <div className="balance-info">
                    Mavjud: {userBalance.toFixed(2)} UZS
                  </div>
                  <input
                    type="range"
                    value={tradeAmount}
                    onChange={(e) => setTradeAmount(parseFloat(e.target.value))}
                    className="amount-slider"
                    min="100000"
                    max={userBalance}
                    disabled={!isAuthenticated}
                  />
                </div>
              </div>

              <div className="setting-box">
                <label className="setting-label">Davomiyligi</label>
                <div className="time-inputs">
                  <div className="time-input-group">
                    <input
                      type="number"
                      value={tradeHours}
                      onChange={(e) => setTradeHours(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))}
                      className="time-input"
                      min="0"
                      max="23"
                      disabled={!isAuthenticated}
                    />
                    <span className="time-label">H</span>
                  </div>
                  <span className="time-separator">:</span>
                  <div className="time-input-group">
                    <input
                      type="number"
                      value={tradeMinutes}
                      onChange={(e) => setTradeMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="time-input"
                      min="0"
                      max="59"
                      disabled={!isAuthenticated}
                    />
                    <span className="time-label">M</span>
                  </div>
                  <span className="time-separator">:</span>
                  <div className="time-input-group">
                    <input
                      type="number"
                      value={tradeSeconds}
                      onChange={(e) => setTradeSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))}
                      className="time-input"
                      min="0"
                      max="59"
                      disabled={!isAuthenticated}
                    />
                    <span className="time-label">S</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="button-grid">
            <button 
              onClick={handleBuyClick} 
              className="trade-btn btn-buy" 
              disabled={!isAuthenticated || tradeAmount < MIN_TRADE}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                Sotib oling
              </span>
            </button>

            <button 
              onClick={handleAI} 
              className="trade-btn btn-ai" 
              disabled={!isAuthenticated || tradeAmount < MIN_TRADE}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                AI Trading
              </span>
            </button>

            <button 
              onClick={handleSellClick} 
              className="trade-btn btn-sell" 
              disabled={!isAuthenticated}
            >
              <span style={{ position: 'relative', zIndex: 1 }}>
                Sotish
              </span>
            </button>
          </div>
        </div>

        {/* Active Positions */}
        {entries.map(entry => {
          const pnl = calculatePnL(entry);

          const rawPnl = parseFloat(pnl.diff);
          const rawRoi = parseFloat(pnl.roi);

          // 👑 Админы и AI — всегда плюс
          const displayPnl = (isAdmin || entry.type === 'ai')
            ? Math.abs(rawPnl)
            : rawPnl;

          const displayRoi = (isAdmin || entry.type === 'ai')
            ? Math.abs(rawRoi)
            : rawRoi;

          // ✅ Определяем профит ТОЛЬКО для обычных
          const isProfit = (isAdmin || entry.type === 'ai')
            ? true
            : displayPnl >= 0;

          // сохраняем для autoClosePosition
          pnlRef.current[entry.id] = {
            displayPnl,
            displayRoi
          };

          const remainingTime = getRemainingTime(entry.expiresAt);
          
          // 🔹 Рассчитываем процент времени от начальной длительности
          const totalDuration = entry.duration || (3 * 60 * 60 * 1000);
          const timePercentage = ((entry.expiresAt - Date.now()) / totalDuration) * 100;

          return (
            <div key={entry.id} className="position-item">
              <div className="position-timer-bar">
                <div
                  className="timer-progress"
                  style={{
                    width: `${Math.max(0, timePercentage)}%`,
                    background: timePercentage > 50 ? '#10b981' : timePercentage > 20 ? '#f59e0b' : '#ef4444'
                  }}
                />
              </div>

              <div className="position-field">
                <div className="position-label">Turi</div>
                <div className="position-value">
                  {entry.type === 'buy' && 'Sotib oling'}
                  {entry.type === 'sell' && 'Sotish'}
                  {entry.type === 'ai' && 'AI'}
                </div>
              </div>

              <div className="position-field">
                <div className="position-label">Qolgan vaqt</div>
                <div className="position-value timer-value">
                  ⏱️ {remainingTime}
                </div>
              </div>

              <div className="position-field">
                <div className="position-label">P&L</div>
                <div className={`position-pnl ${isProfit ? 'pnl-profit' : 'pnl-loss'}`}>
                  {isProfit ? '+' : ''}UZS {displayPnl.toFixed(2)} ({isProfit ? '+' : ''}{displayRoi.toFixed(2)}%)
                </div>
              </div>
            </div>
          );
        })}

        {/* Market Info */}
        <div className="market-card">
          <h2 className="market-title">📊 Bozor Ma’lumotlari</h2>
          <div className="market-grid">
            <div className="market-item">
              <div className="market-item-label">24 soat o‘zgarish</div>
              <div className="market-item-value value-positive">+2.5%</div>
            </div>
            <div className="market-item">
              <div className="market-item-label">24 soat yuqori</div>
              <div className="market-item-value">
                UZS{(currentPrice * 1.025).toFixed(2)}
              </div>
            </div>
            <div className="market-item">
              <div className="market-item-label">24 soat past</div>
              <div className="market-item-value">
                UZS{(currentPrice * 0.975).toFixed(2)}
              </div>
            </div>
            <div className="market-item">
              <div className="market-item-label">Hajm</div>
              <div className="market-item-value">$25.8B</div>
            </div>
          </div>
        </div>
      </div>
  );
}

// GET get_balance
// GET get_positions
// POST create_position
// DELETE close_position