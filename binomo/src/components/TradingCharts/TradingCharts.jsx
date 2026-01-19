import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef, useContext } from 'react';
import { TrendingUp } from 'lucide-react';
import './TradingPlatform.css';
import { UserContext } from "../../context/UserContext"

import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;


const USD_TO_UZS = 13800;
const AI_MULTIPLIER = 34.788559;
const HIGH_MARGIN_MULTIPLIER = 38.2244351;
const PROFIT_AMOUNT = 11537890; // 11 537 890 сум

export default function TradingPlatform() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(50000);
  const [entries, setEntries] = useState([]);
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
  const previousPnLsRef = useRef({});



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

  // ==============================
  // Загружаем активные позиции при старте
  // ==============================
  useEffect(() => {
    const loadActivePositions = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          console.log('⚠️ Нет токена, позиции не загружаются');
          return;
        }

        console.log('⏳ Загружаем активные позиции с backend...');
        const response = await fetch(`${API_BASE_URL}/api/positions/active`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
          console.error('❌ Ошибка загрузки позиций:', response.status);
          return;
        }

        const data = await response.json();
        console.log('📦 Активные позиции получены:', data.positions);

        data.positions.forEach(pos => {
          // принудительно создаём Date в UTC
          const openedAt = new Date(pos.opened_at + 'Z').getTime();
          const expiresAt = new Date(pos.expires_at + 'Z').getTime();

          const now = Date.now();
          const remaining = expiresAt - now;

          console.log(`🔹 Позиция ${pos.id}: openedAt=${new Date(openedAt).toLocaleTimeString()}, expiresAt=${new Date(expiresAt).toLocaleTimeString()}, remaining=${Math.round(remaining / 1000)}s`);

          if (remaining > 0) {
            const entry = {
              id: pos.id,
              type: pos.type,
              pair: pos.pair,
              price: pos.entry_price,
              amount: pos.amount,
              leverage: pos.leverage,
              margin: pos.amount,
              positionSize: pos.position_size,
              time: openedAt,
              timestamp: new Date(openedAt).toLocaleTimeString(),
              expiresAt,
              duration: expiresAt - openedAt
            };

            setEntries(prev => [...prev, entry]);

            timersRef.current[pos.id] = setTimeout(() => {
              console.log(`⏰ AUTO CLOSE TIMER FIRED FOR ${pos.id}`);
              autoClosePosition(pos.id);
              setEntries(prev => prev.filter(e => e.id !== pos.id));
              delete timersRef.current[pos.id];
            }, remaining);

            console.log(`⏱️ Таймер для позиции ${pos.id} установлен на ${Math.round(remaining / 1000)}s`);
          } else {
            console.log(`⚠️ Позиция ${pos.id} реально истекла, вызываем авто-закрытие сразу`);
            // autoClosePosition(pos.id); // не вызываем сразу, чтобы не было дубликатов
          }
        });


      } catch (err) {
        console.error('❌ Ошибка загрузки позиций:', err);
      }
    };

    if (isAuthenticated) loadActivePositions();

  }, [isAuthenticated]);


  // ==============================
  // Авто-обновление таймера и закрытие позиций
  // ==============================
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setEntries(prev =>
        prev.filter(entry => {
          // Если позиция истекла — закрываем
          if (entry.expiresAt <= now) {
            console.log('⏰ AUTO CLOSE', entry.id);
            autoClosePosition(entry.id);
            return false; // удаляем из UI
          }
          return true; // оставляем активную позицию
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []); // зависимость пустая — interval создается один раз



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
    let rafId;
    let lastBalanceUpdate = 0;

    const loop = (timestamp) => {
      if (entries.length === 0) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      let totalChange = 0;
      const newPreviousPnLs = {};

      entries.forEach(entry => {
        if (entry.closed) return;

        const currentPnL = calculatePnL(entry);
        const prev = previousPnLsRef.current[entry.id] || { diff: "0" };

        const diffNow = parseFloat(currentPnL.diff);
        const diffPrev = parseFloat(prev.diff);

        const delta = diffNow - diffPrev;
        totalChange += delta;

        newPreviousPnLs[entry.id] = currentPnL;
      });

      previousPnLsRef.current = newPreviousPnLs;
      accumulatedPnLRef.current += totalChange;

      // ⏱ обновляем баланс НЕ каждый кадр (например раз в 100мс)
      if (timestamp - lastBalanceUpdate > 100) {
        lastBalanceUpdate = timestamp;

        setUserBalance(prev => {
          const newBalance = prev + totalChange;
          balanceUSDRef.current = newBalance;
          return newBalance;
        });
      }

      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [entries, currentPrice]);



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

    useEffect(() => {
    const interval = setInterval(() => {
      setEntries(prev => [...prev]); // Форсируем ре-рендер
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleBuyClick = async () => {
    if (userBalance < 100000) {
      alert('Savdo uchun minimal depozit: 100,000 UZS');
      return;
    }

    if (tradeAmount < MIN_TRADE) {
      alert('Minimal savdo miqdori: 100,000 UZS');
      return;
    }

    if (tradeAmount > userBalance) {
      alert(`Mablag' yetishmayapti. Mavjud balans: ${userBalance.toFixed(2)} UZS`);
      return;
    }

    const durationMs = (tradeHours * 3600 + tradeMinutes * 60 + tradeSeconds) * 1000;
    
    if (durationMs < 60000) {
      alert('Eng kam vaqt 1 daqiqa.');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${API_BASE_URL}/api/positions/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'buy',
          amount: tradeAmount,
          leverage: leverage,
          duration_seconds: durationMs / 1000,
          current_price: currentPrice,
          pair: selectedPair
        })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || 'Ошибка при открытии позиции');
        return;
      }

      const data = await response.json();
      
      console.log('📦 Получен ответ от сервера:', data);

      // ✅ Рассчитываем длительность из данных сервера
      const openedAt = new Date(data.opened_at).getTime();
      const expiresAt = new Date(data.expires_at).getTime();
      const totalDuration = expiresAt - openedAt;

      // ✅ Обновляем UI
      const entry = {
        id: data.position_id,
        type: 'buy',
        pair: selectedPair,
        price: currentPrice,
        amount: tradeAmount,
        leverage: leverage,
        margin: tradeAmount,
        positionSize: tradeAmount * leverage,
        time: openedAt,
        timestamp: new Date(openedAt).toLocaleTimeString(),
        expiresAt: Date.now() + totalDuration,
        duration: totalDuration  // ✅ КРИТИЧНО
      };
      
      setEntries(prev => [...prev, entry]);
      setUserBalance(data.new_balance);
      balanceUSDRef.current = data.new_balance;
      
      console.log(`🟢 BUY позиция открыта. ID: ${data.position_id}, закроется через ${Math.round(totalDuration / 1000)}s`);
    } catch (error) {
      console.error('Error opening position:', error);
      alert('Ошибка при открытии позиции');
    }
  };


  const handleAI = async () => {
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

    try {
      const token = localStorage.getItem('access_token');
      //const durationSeconds = 3 * 60 * 60;// 3 часа 3 * 60 * 60; // 3 часа
      const durationMs = (3 * 60 * 60) * 1000;// 3 часа 3 * 60 * 60; // 3 часа
      
      const response = await fetch(`${API_BASE_URL}/api/positions/open`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'ai',
          amount: 1000000, // или берём из UI
          leverage: 1,
          duration_seconds: durationMs / 1000,
          current_price: currentPrice,
          pair: selectedPair
        })
      });

      if (!response.ok) {
        const err = await response.json();
        return alert(err.message || "Ошибка при открытии AI-позиции");
      }

      const data = await response.json();
      
      const openedAt = new Date(data.opened_at).getTime();
      const expiresAt = new Date(data.expires_at).getTime();
      const remaining = expiresAt - openedAt;

      const entry = {
        id: data.position_id,
        type: 'ai',
        pair: selectedPair,
        price: currentPrice,
        amount: 1000000,
        leverage: 1,
        margin: 1000000,
        positionSize: 1000000,
        time: openedAt,
        timestamp: new Date(openedAt).toLocaleTimeString(),
        expiresAt: Date.now() + remaining,
        duration: remaining  // ✅ КРИТИЧНО
      };

      setEntries(prev => [...prev, entry]);
      setUserBalance(data.new_balance);
      balanceUSDRef.current = data.new_balance;

      // Таймер авто-закрытия
      if (remaining > 0) {
        timersRef.current[entry.id] = setTimeout(() => {
          autoClosePosition(entry.id);
          setEntries(prev => prev.filter(e => e.id !== entry.id));
          delete timersRef.current[entry.id];
        }, remaining);
      } else {
        autoClosePosition(entry.id); // если уже просрочена
      }

      console.log(`✅ AI-позиция открыта на 3 часа, ID: ${entry.id}`);
      //localStorage.setItem("hasTraded", "true");
    } catch (err) {
      console.error(err);
      alert("Ошибка при открытии AI-позиции");
    }
  };

  const handleSellClick = async () => {
    console.log('🟡 SELL CLICK');
    console.log('💰 Баланс ДО открытия:', userBalance);
    console.log('📊 Trade amount:', tradeAmount);
    console.log('📈 Current price:', currentPrice);


    if (userBalance < 100000) {
      alert('Savdo uchun minimal depozit: 100,000 UZS');
      return;
    }

    if (tradeAmount < MIN_TRADE) {
      alert('Minimal savdo miqdori: 100,000 UZS');
      return;
    }

    if (tradeAmount > userBalance) {
      alert(`Mablag' yetishmayapti. Mavjud balans: ${userBalance.toFixed(2)} UZS`);
      return;
    }

    const durationMs = (tradeHours * 3600 + tradeMinutes * 60 + tradeSeconds) * 1000;
    
    if (durationMs < 60000) {
      alert('Eng kam vaqt 1 daqiqa.');
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${API_BASE_URL}/api/positions/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          type: 'sell',
          amount: tradeAmount,
          leverage: leverage,
          duration_seconds: durationMs / 1000,
          current_price: currentPrice,
          pair: selectedPair
        })
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.message || 'Ошибка при открытии позиции');
        return;
      }

      const data = await response.json();

      console.log('📦 OPEN RESPONSE FROM BACKEND:', data);
      console.log('💰 Баланс ПОСЛЕ открытия (backend):', data.new_balance); 
      
      // ✅ Рассчитываем длительность из данных сервера
      const openedAt = new Date(data.opened_at).getTime();
      const expiresAt = new Date(data.expires_at).getTime();
      const totalDuration = expiresAt - openedAt;

      // ✅ Обновляем UI
      const entry = {
        id: data.position_id,
        type: 'sell',
        pair: selectedPair,
        price: currentPrice,
        amount: tradeAmount,
        leverage: leverage,
        margin: tradeAmount,
        positionSize: tradeAmount * leverage,
        time: openedAt,
        timestamp: new Date(openedAt).toLocaleTimeString(),
        expiresAt: Date.now() + totalDuration,
        duration: totalDuration  // ✅ КРИТИЧНО
      };

      console.log('📝 ENTRY CREATED:', entry);
      
      setEntries(prev => [...prev, entry]);
      setUserBalance(data.new_balance);
      balanceUSDRef.current = data.new_balance;

      console.log('💰 Баланс в UI ПОСЛЕ setUserBalance:', data.new_balance);

      // ✅ Таймер для автоматического закрытия
      /*const timerId = setTimeout(() => {
        console.log(`⏰ AUTO CLOSE TIMER FIRED FOR ${data.position_id}`);
        autoClosePosition(data.position_id);
      }, totalDuration);*/

      //timersRef.current[data.position_id] = timerId;
      
      console.log(`🔴 SELL позиция открыта. ID: ${data.position_id}, закроется через ${Math.round(totalDuration / 1000)}s`);
    } catch (error) {
      console.error('Error opening position:', error);
      alert('Ошибка при открытии позиции');
    }
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
    console.log('🔒 AUTO CLOSE START');
    console.log('🆔 Position ID:', id);
    console.log('💰 Баланс ПЕРЕД autoClose:', userBalance);
    console.log('📈 Current price at close:', currentPrice);



    if (closedPositionsRef.current.has(id)) {
      console.log(`⚠️ Позиция ${id} уже закрыта`);
      return;
    }

    closedPositionsRef.current.add(id);

    try {
      // ✅ Получаем PnL для этой позиции
      const { displayPnl, displayRoi } = pnlRef.current[id] || { displayPnl: 0, displayRoi: 0 };
      
      console.log('📊 PnL данные:', {
        displayPnl,
        displayRoi,
        isProfit: displayPnl >= 0
      });

      const token = localStorage.getItem('access_token');
      
      // ✅ Отправляем PnL на backend
      const response = await fetch(`${API_BASE_URL}/api/positions/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          position_id: id,
          current_price: currentPrice,
          pnl: displayPnl  // ✅ Передаем рассчитанный PnL
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Ошибка закрытия позиции:', error);
        throw new Error(error.message || 'Failed to close position');
      }

      const data = await response.json();
      
      console.log('✅ Позиция закрыта на backend:', data);
      console.log(`💰 Прибыль: ${data.profit}, ROI: ${data.roi}%`);
      console.log(`💳 Новый баланс: ${data.new_balance}`);
      
      // ✅ Обновляем UI
      setUserBalance(data.new_balance);
      balanceUSDRef.current = data.new_balance;
      
      // Удаляем из UI
      setEntries(prev => prev.filter(e => e.id !== id));
      
      // Очищаем таймер
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
      
      console.log('✅ Позиция успешно закрыта');
      
    } catch (error) {
      console.error('❌ Error closing position:', error);
      closedPositionsRef.current.delete(id);
    }
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
                    Mavjud: {userBalance?.toFixed(2) ?? "Loading..."} UZS
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
