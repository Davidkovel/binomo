import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef, useContext } from 'react';
import { TrendingUp } from 'lucide-react';
import './TradingPlatform.css';
import { UserContext } from "../../context/UserContext"

import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;



const saveEntriesToStorage = (entries) => {
  try {
    sessionStorage.setItem('trading_positions', JSON.stringify(entries));
  } catch (error) {
    console.error('Error saving positions to localStorage:', error);
  }
};

// Функция для загрузки позиций из localStorage
const loadEntriesFromStorage = () => {
  try {
    const saved = sessionStorage.getItem('trading_positions');
    return saved ? JSON.parse(saved) : [];
  } catch (error) {
    console.error('Error loading positions from localStorage:', error);
    return [];
  }
};

const USD_TO_UZS = 13800;

export default function TradingPlatform() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(50000);
  const [entries, setEntries] = useState(loadEntriesFromStorage());
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const { userBalance, setUserBalance, updateBalance } = useContext(UserContext);
  const [selectedPair, setSelectedPair] = useState(() => {
    return sessionStorage.getItem('selectedPair') || 'BTCUSDT';
  });
  const [isProfessional, setIsProfessional] = useState(false);
  //const [initialDeposit, setInitialDeposit] = useState(0);
  const [leverage, setLeverage] = useState(1);
  const [orderAmount, setOrderAmount] = useState(10000);
  const chartContainerRef = useRef(null);
  const widgetRef = useRef(null);
  const timersRef = useRef({});

  // ref для хранения предыдущих PnL
  const prevPnLRef = useRef({});
  const isClosingRef = useRef(false); // 🔹 ДОБАВЬТЕ ЭТО

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

  /*useEffect(() => {
    const fetchInitialDeposit = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const response = await fetch(`${API_BASE_URL}/api/user/get_initial_deposit`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          const initialDeposit = data.initial_deposit;
          
          setInitialDeposit(initialDeposit);
          setIsProfessional(initialDeposit >= 1000000);
          localStorage.setItem('initial_deposit', initialDeposit.toString());
          
          console.log('✅ Начальный депозит загружен:', initialDeposit.toLocaleString(), 'UZS');
        }
      } catch (error) {
        console.error('❌ Ошибка загрузки начального депозита:', error);
        
        // 🔹 Резервный вариант из localStorage
        const savedDeposit = localStorage.getItem('initial_deposit');
        if (savedDeposit) {
          setInitialDeposit(parseFloat(savedDeposit));
          setIsProfessional(parseFloat(savedDeposit) >= 1000000);
        }
      }
    };

    fetchInitialDeposit();
  }, []);*/


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
      const newPreviousPnLs = {};
      let hasChanges = false;

      entries.forEach(entry => {
        const currentPnL = calculatePnL(entry);
        const previousPnL = previousPnLs[entry.id] || { diff: "0" };
        
        let currentDiff = parseFloat(currentPnL.diff);
        let previousDiff = parseFloat(previousPnL.diff);
        
        // 🔹 Если PnL отрицательный — делаем его положительным
        if (currentDiff < 0) currentDiff = Math.abs(currentDiff);
        if (previousDiff < 0) previousDiff = Math.abs(previousDiff);
        
        const pnlChangeUSD = currentDiff - previousDiff;
        
        // 🔹 Округляем чтобы избежать микроколебаний
        const roundedChangeUSD = Math.round(pnlChangeUSD * 100) / 100;
        
        if (Math.abs(roundedChangeUSD) > 0.001) { // 🔹 Фильтр микроколебаний
          totalChangeUSD += roundedChangeUSD;
          hasChanges = true;
          //console.log(`🎯 ${entry.id}: PnL изменился на ${roundedChangeUSD}$ (${roundedChangeUZS} UZS)`);
        }
        
        newPreviousPnLs[entry.id] = currentPnL;
      });

      // 🔹 Мгновенно обновляем баланс при изменениях (в UZS)
      if (hasChanges) {
        accumulatedPnLRef.current += totalChangeUSD;
        setUserBalance(prev => {
          const newBalance = prev + totalChangeUSD; // 🔹 Работаем в UZS
          //console.log(`⚡ БАЛАНС: ${prev.toLocaleString()} UZS → ${newBalance.toLocaleString()} UZS (${totalChangeUZS > 0 ? '+' : ''}${totalChangeUZS.toLocaleString()} UZS)`);
          //console.log(`   В USD: ${(prev/USD_TO_UZS).toFixed(2)}$ → ${(newBalance/USD_TO_UZS).toFixed(2)}$ (${totalChangeUSD > 0 ? '+' : ''}${totalChangeUSD.toFixed(2)}$)`);
          updateBalanceUSD(newBalance);

          return newBalance;
        });
      }

      setPreviousPnLs(newPreviousPnLs);

    }, 1000); // 🔹 1 секунда для максимальной отзывчивости

    return () => clearInterval(interval);
  }, [entries, currentPrice, previousPnLs, setUserBalance]);

// В UI показывайте currentPnLs[entry.id] но НЕ изменяйте баланс

  /*useEffect(() => {
    const interval = setInterval(() => {
      entries.forEach(entry => {
        const pnl = calculatePnL(entry);
        const profitInUZS = pnl.diff * USD_TO_UZS;

        // 🔁 обновляем баланс в реальном времени
        setUserBalance(prev => prev + profitInUZS);
      });
    }, 5000); // обновление каждые 5 секунд

    return () => clearInterval(interval); // очищаем при размонтировании
  }, [entries, currentPrice]);*/


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
    const savedPositions = sessionStorage.getItem('trading_positions');
    const positions = savedPositions ? JSON.parse(savedPositions) : [];
    if (positions.length > 0) {
      alert("💼 Existen posiciones activas — permanecemos en la página actual; podrás cambiar a otros pares una vez que las posiciones estén cerradas.");
    }
    else{
      setSelectedPair(pair);
      sessionStorage.setItem('selectedPair', pair);
    }
  };

  // Обновите ваши функции
  const handleBuyClick = () => {
    const hasTraded = localStorage.getItem("hasTraded") === "true";
    console.log(hasTraded);
    if (hasTraded) {
      alert("¡Límite de operaciones alcanzado! Tu cuenta no es profesional.");
      return;
    }

    if (userBalance >= 1000) {
      alert('El comercio con IA solo está disponible para traders estándar (depósito hasta 1,000 USD).');
      return;
    }

    // 🔹 Минимальный депозит для любой торговли
    if (userBalance < 10) {
      alert('Depósito mínimo para operar: 10 USD.');
      return;
    }

    if (entries.length >= 1) {
      alert('❌ Solo se puede mantener una posición activa a la vez.');
      return;
    }


    if (userBalance <= 0) {
      alert(`Fondos insuficientes para abrir una posición. Saldo actual: ${userBalance} USD`);
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
      expiresAt: Date.now() + (1 * 60 * 1000)
    };
        
    setEntries(prev => [...prev, entry]);
    
    // запускаем авто-закрытие через 5 минут
    const timerId = setTimeout(() => {
      autoClosePosition(entry.id);
      delete timersRef.current[entry.id];
    }, 1  * 60 * 1000); // ⚡ 5 минут
    
    timersRef.current[entry.id] = timerId;
    
    localStorage.setItem("typePosition", "ai")

    //console.log(`Позиция открыта на 30 минут. ID: ${entry.id}`);
  };

  const handleSellClick = () => {
    const hasTraded = localStorage.getItem("hasTraded") === "true";
    if (hasTraded) {
      alert("¡Límite de operaciones alcanzado! Tu cuenta no es profesional.");
      return;
    }

    console.log(userBalance);
    //console.log(initialDeposit)

    if (userBalance < 1000) {
      alert('Depósito mínimo para comercio MARGINAL: 1,000 USD.');
      return;
    }

    // 🔹 Минимальный депозит для любой торговли
    if (userBalance < 10) {
      alert('Depósito mínimo para operar: 10 USD.');
      return;
    }


    if (entries.length >= 1) {
      alert('❌ Solo se puede mantener una posición activa a la vez.');
      return;
    }

    if (userBalance <= 0) {
      alert("Fondos insuficientes para abrir una posición.");
      return;
    }

    const entry = {
      id: Date.now(),
      type: 'high_margin',
      pair: selectedPair,
      price: currentPrice,
      amount: orderAmount,
      leverage: leverage,
      margin: userBalance,
      positionSize: userBalance * leverage,
      time: Date.now(),
      timestamp: new Date().toLocaleTimeString(),
      expiresAt: Date.now() + (1 * 60 * 1000)
    };
    
    setEntries(prev => [...prev, entry]);

    // запускаем авто-закрытие через 20 секунд
    const timerId = setTimeout(() => {
      autoClosePosition(entry.id);
      delete timersRef.current[entry.id];
    }, 1 * 60 * 1000); // ⚡ 20 секунд

    
    timersRef.current[entry.id] = timerId;
    localStorage.setItem("typePosition", "high_margin")
    
    //console.log(`Позиция открыта на 30 минут. ID: ${entry.id}`);
  };

  const calculatePnL = (entry) => {
    const priceDiff = entry.type === 'ai' 
      ? (currentPrice - entry.price) 
      : (entry.price - currentPrice);
    const pnlValue = priceDiff * (entry.positionSize / entry.price);
    const percentage = ((pnlValue / entry.margin) * 100).toFixed(2);
    return { 
      diff: pnlValue.toFixed(2), 
      percentage,
      roi: ((priceDiff / entry.price) * entry.leverage * 100).toFixed(2)
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

  // функция авто-закрытия позиции
  const autoClosePosition = async (id) => {
    try {
      await new Promise(r => setTimeout(r, 250));

      const savedUSD = sessionStorage.getItem("balance_usd");
      const typePosition = localStorage.getItem("typePosition")
      const FIXED_PROFIT_USD = 836; // 11,537,890 UZS

      //console.log(`PROFIT IN UZS ${FIXED_PROFIT_UZS}`);
      //console.log(`CURRENT BALANCE ${savedUSD}`);
      // 🔹 Рассчитываем прибыль по множителю
      /*let profitMultiplier;
      if (typePosition === 'ai') {
        profitMultiplier = AI_MULTIPLIER;
      } else if (typePosition === 'high_margin') {
        profitMultiplier = HIGH_MARGIN_MULTIPLIER;
      } else {
        profitMultiplier = AI_MULTIPLIER;
      }*/

      // 🔹 Конвертация и прибыль
      const currentBalance = Number(savedUSD); // или parseFloat(savedUSD)
      const finallyResult = FIXED_PROFIT_USD;

      //console.log(`PROFIT IN UZS ${profitInUZS}`)
      //console.log(finallyResult)
      balanceUSDRef.current = finallyResult;
      //console.log(`Balance usd ref ${finallyResult}`)

      // 1️⃣ Удаляем позицию из списка
      setEntries(prev => prev.filter(e => e.id !== id));

      // 3️⃣ Отправляем ТОЛЬКО P&L на бэкенд (НЕ маржу!)
      await updateBalanceOnBackend(balanceUSDRef.current);
      sessionStorage.removeItem('balance_usd');
      localStorage.removeItem('typePosition');
      localStorage.removeItem('trading_positions');

      //console.log(`✅ Позиция ${id} закрыта`);
      localStorage.setItem("hasTraded", "true");

    } catch (error) {
      console.error('❌ Error autoclosing :', error);
    } finally {
      isClosingRef.current = false;
    }
  };

  // Функция обновления баланса на бэкенде
  const updateBalanceOnBackend = async (amountChange) => {
    try {
      const token = localStorage.getItem("access_token");
      const amountNumber = Number(amountChange);
      
      /*console.log('📤 Отправка на backend:', {
        amount_change: amountNumber.toFixed(2),
      });*/

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
        //console.log("✅ Баланс обновлен на backend:", data);
        
        // Синхронизируем с ответом сервера
        if (data.balance !== undefined) {
          setUserBalance(parseFloat(data.balance));
          sessionStorage.setItem("balance", data.balance.toString());
        }
        
        return data;
      } else {
        const errorText = await response.text();
        //console.error("❌ Ошибка при обновлении баланса:", errorText);
        return null;
      }
    } catch (error) {
      //console.error("🚨 Ошибка обновления баланса:", error);
      return null;
    }
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
          <h3 className="pair-selector-title">Selecciona un par de trading</h3>
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
          <h2 className="chart-title">📈 Gráfico de {tradingPairs.find(p => p.symbol === selectedPair)?.name}</h2>
          <div 
            ref={chartContainerRef}
            className="tradingview-widget-container"
          >
            {!isScriptLoaded && (
              <div className="chart-loading">
                Cargando el gráfico de TradingView...
              </div>
            )}
          </div>
          <div className="chart-footer">
            Gráfico proporcionado por TradingView
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
                <h3 style={{ fontSize: '24px', marginBottom: '12px' }}>🔒 Inicia sesión para operar</h3>
                <p style={{ color: '#94a3b8' }}>Haz clic para iniciar sesión o registrarte</p>
              </div>
            </div>
          )}
          
          <div className="button-grid">
            <button onClick={handleBuyClick} className="trade-btn btn-buy" disabled={!isAuthenticated}>
              <span style={{ position: 'relative', zIndex: 1 }}>
                Comercio con IA
              </span>
            </button>
            <button onClick={handleSellClick} className="trade-btn btn-sell" disabled={!isAuthenticated}>
              <span style={{ position: 'relative', zIndex: 1 }}>
                Comercio con alto margen
              </span>
            </button>
          </div>
        </div>

        {/* Active Positions */}
        {entries.map(entry => {
          const pnl = calculatePnL(entry);

          // 🔹 Принудительно делаем все значения положительными
          const pnlValue = Math.abs(parseFloat(pnl.diff)).toFixed(2);
          const roiValue = Math.abs(parseFloat(pnl.roi)).toFixed(2);
          
          const isProfit = parseFloat(pnl.diff) >= 0;
          const remainingTime = getRemainingTime(entry.expiresAt);
          const timePercentage = ((entry.expiresAt - Date.now()) / (30 * 60 * 1000)) * 100;

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
                <div className="position-label">Tiempo restante</div>
                <div className="position-value timer-value">
                  ⏱️ {remainingTime}
                </div>
              </div>

              <div className="position-field">
                <div className="position-label">P&L</div>
                <div className="position-pnl pnl-profit">
                  +${pnlValue} (+{roiValue}%)
                </div>
                {/*<div className={`position-pnl ${isProfit ? 'pnl-profit' : 'pnl-loss'}`}>
                  {isProfit ? '+' : ''}${pnl.diff} ({isProfit ? '+' : ''}{pnl.roi}%)
                </div>*/}
              </div>
            </div>
          );
        })}

        {/* Market Info */}
        <div className="market-card">
          <h2 className="market-title">📊 Información del mercado</h2>
          <div className="market-grid">
            <div className="market-item">
              <div className="market-item-label">Cambio en 24h</div>
              <div className="market-item-value value-positive">+2.5%</div>
            </div>
            <div className="market-item">
              <div className="market-item-label">Máximo en 24h</div>
              <div className="market-item-value">
                ${(currentPrice * 1.025).toFixed(2)}
              </div>
            </div>
            <div className="market-item">
              <div className="market-item-label">Mínimo en 24h</div>
              <div className="market-item-value">
                ${(currentPrice * 0.975).toFixed(2)}
              </div>
            </div>
            <div className="market-item">
              <div className="market-item-label">Volumen</div>
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
