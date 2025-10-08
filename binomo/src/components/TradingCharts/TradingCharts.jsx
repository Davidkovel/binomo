import { useNavigate } from 'react-router-dom';
import React, { useState, useEffect, useRef } from 'react';
import { TrendingUp } from 'lucide-react';
import './TradingPlatform.css';
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

export default function TradingPlatform() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentPrice, setCurrentPrice] = useState(50000);
  const [entries, setEntries] = useState(loadEntriesFromStorage());
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [userBalance, setUserBalance] = useState(0);
  const [selectedPair, setSelectedPair] = useState(() => {
    return localStorage.getItem('selectedPair') || 'BTCUSDT';
  });
  const [leverage, setLeverage] = useState(1);
  const [orderAmount, setOrderAmount] = useState(10000);
  const chartContainerRef = useRef(null);
  const widgetRef = useRef(null);

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
        console.error('Error fetching price:', error);
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
    setSelectedPair(pair);
    localStorage.setItem('selectedPair', pair);
  };

  // Обновите ваши функции
  const handleBuyClick = () => {
    const userBalance = parseFloat(localStorage.getItem("balance"));
    if (userBalance <= 0) {
      alert(`Недостаточно средств для открытия позиции. ${userBalance}`);
      return;
    }

    console.log(`${userBalance} sadasdasd`)

    const entry = {
      id: Date.now(),
      type: 'buy',
      pair: selectedPair,
      price: currentPrice,
      amount: userBalance,
      leverage: leverage,
      margin: userBalance,
      positionSize: userBalance * leverage,
      time: Date.now(),
      timestamp: new Date().toLocaleTimeString()
    };
    const newEntries = [...entries, entry];
    setEntries(newEntries);
    saveEntriesToStorage(newEntries);
  };

  const handleSellClick = () => {
    const userBalance = parseFloat(localStorage.getItem("balance"));
    if (userBalance <= 0) {
      alert("Недостаточно средств для открытия позиции.");
      return;
    }
    
    const entry = {
      id: Date.now(),
      type: 'sell',
      pair: selectedPair,
      price: currentPrice,
      amount: userBalance,
      leverage: leverage,
      margin: userBalance,
      positionSize: userBalance * leverage,
      time: Date.now(),
      timestamp: new Date().toLocaleTimeString()
    };
    const newEntries = [...entries, entry];
    setEntries(newEntries);
    saveEntriesToStorage(newEntries);
  };

  const calculatePnL = (entry) => {
    const priceDiff = entry.type === 'buy' 
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

  const closePosition = async (id) => {
    try {
      const positionToClose = entries.find(entry => entry.id === id);
      if (!positionToClose) return;

      const pnl = calculatePnL(positionToClose);
      const profitLossAmount = parseFloat(pnl.diff);

      console.log('Closing position:', {
        position: positionToClose,
        pnl: pnl,
        profitLossAmount: profitLossAmount
      });

      const token = localStorage.getItem("access_token");

      const response = await fetch(`${API_BASE_URL}/api/user/update_balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_change: profitLossAmount
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}, response: ${responseText}`);
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: ${responseText}`);
      }

      console.log('Response data:', data);

      // Обновляем баланс из ответа сервера
      if (data && data.balance !== undefined) {
        const newBalance = parseFloat(data.balance);
        setUserBalance(newBalance);
        localStorage.setItem("balance", newBalance.toString());
        
        // Удаляем позицию из списка и сохраняем
        const newEntries = entries.filter(entry => entry.id !== id);
        setEntries(newEntries);
        saveEntriesToStorage(newEntries);

        alert(`Position closed! ${profitLossAmount >= 0 ? 'Profit' : 'Loss'}: $${Math.abs(profitLossAmount).toFixed(2)}\nNew Balance: $${newBalance.toFixed(2)}`);

      } else {
        throw new Error('Invalid response format: balance missing');
      }

    } catch (error) {
      console.error("Error closing position:", error);
      alert(`Error closing position: ${error.message}`);
    }
  };
  return (
    <div className="trading-platform">
      <div className="container">
        {/* Header */}
        <div className="header-card">
          <div className="header-content">
            <div className="header-left">
              <h1>
                <TrendingUp size={32} />
                Crypto Trading Platform
              </h1>
              <p>{tradingPairs.find(p => p.symbol === selectedPair)?.name} • Binance • Real-time</p>
            </div>
            <div className="price-display">
              <div className="current-price">${currentPrice.toFixed(2)}</div>
              <div className="price-label">● Live Price</div>
            </div>
          </div>
        </div>

        {/* Pair Selector */}
        <div className="pair-selector-card">
          <h3 className="pair-selector-title">Select Trading Pair</h3>
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
          <h2 className="chart-title">📈 {tradingPairs.find(p => p.symbol === selectedPair)?.name} Chart</h2>
          <div 
            ref={chartContainerRef}
            className="tradingview-widget-container"
          >
            {!isScriptLoaded && (
              <div className="chart-loading">
                Loading TradingView chart...
              </div>
            )}
          </div>
          <div className="chart-footer">
            Chart powered by TradingView
          </div>
        </div>

        {/* Set position 
        <div className='margin-settings-card'>
          <h3 className="margin-title">⚙️ Position Settings</h3>
          <div className="margin-controls">
            <div className="control-group">
              <label className="control-label">
                Margin Amount (USDT)
                <span className="control-hint">Your investment</span>
              </label>
              <input
                type="number"
                value={orderAmount}
                onChange={(e) => setOrderAmount(Math.max(1, parseFloat(e.target.value) || 1))}
                className="control-input"
                min="1"
                step="10"
              />
            </div>
            
            <div className="control-group">
              <label className="control-label">
                Leverage (x{leverage})
                <span className="control-hint">Position multiplier</span>
              </label>
              <div className="leverage-display">
                <input
                  type="range"
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="leverage-slider"
                  min="1"
                  max="125"
                  step="1"
                />
              </div>
            </div>

            <div className="position-summary">
              <div className="summary-item">
                <span className="summary-label">Margin:</span>
                <span className="summary-value">${orderAmount.toFixed(2)}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Position Size:</span>
                <span className="summary-value">${(orderAmount * leverage).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>*/}

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
                <h3 style={{ fontSize: '24px', marginBottom: '12px' }}>🔒 Войдите для торговли</h3>
                <p style={{ color: '#94a3b8' }}>Нажмите, чтобы войти или зарегистрироваться</p>
              </div>
            </div>
          )}
          
          <div className="button-grid">
            <button onClick={handleBuyClick} className="trade-btn btn-buy" disabled={!isAuthenticated}>
              <span style={{ position: 'relative', zIndex: 1 }}>
                AI торговля (92%+)
              </span>
            </button>
            <button onClick={handleSellClick} className="trade-btn btn-sell" disabled={!isAuthenticated}>
              <span style={{ position: 'relative', zIndex: 1 }}>
                Высокая Маржинальна торговля 378%+
              </span>
            </button>
          </div>
        </div>

        {/* Active Positions */}
        {entries.length > 0 && (
          <div className="positions-card slide-in">
            <h2 className="positions-title">💼 Active Positions</h2>
            <div className="positions-list">
              {entries.map(entry => {
                const pnl = calculatePnL(entry);
                const isProfit = parseFloat(pnl.diff) >= 0;
                
                return (
                  <div key={entry.id} className="position-item">
                    <div className="position-field">
                      <div className="position-label">Pair</div>
                      <div className="position-value">
                        {tradingPairs.find(p => p.symbol === entry.pair)?.name}
                      </div>
                    </div>
                    <div className="position-field">
                      <div className="position-label">Margin</div>
                      <div className="position-value">${entry.margin}</div>
                    </div>
                    <div className="position-field">
                      <div className="position-label">Position Size</div>
                      <div className="position-value">${entry.positionSize.toFixed(2)}</div>
                    </div>
                    <div className="position-field">
                      <div className="position-label">Entry Price</div>
                      <div className="position-value">${entry.price.toFixed(2)}</div>
                    </div>
                    <div className="position-field">
                      <div className="position-label">Current Price</div>
                      <div className="position-value">${currentPrice.toFixed(2)}</div>
                    </div>
                    <div className="position-field">
                      <div className="position-label">P&L</div>
                      <div className={`position-pnl ${isProfit ? 'pnl-profit' : 'pnl-loss'}`}>
                        {isProfit ? '+' : ''}${pnl.diff} ({isProfit ? '+' : ''}{pnl.roi}%)
                      </div>
                    </div>
                    <div className="position-field">
                      <button 
                        onClick={() => closePosition(entry.id)} 
                        className="close-btn"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Market Info */}
        <div className="market-card">
          <h2 className="market-title">📊 Market Information</h2>
          <div className="market-grid">
            <div className="market-item">
              <div className="market-item-label">24h Change</div>
              <div className="market-item-value value-positive">+2.5%</div>
            </div>
            <div className="market-item">
              <div className="market-item-label">24h High</div>
              <div className="market-item-value">
                ${(currentPrice * 1.025).toFixed(2)}
              </div>
            </div>
            <div className="market-item">
              <div className="market-item-label">24h Low</div>
              <div className="market-item-value">
                ${(currentPrice * 0.975).toFixed(2)}
              </div>
            </div>
            <div className="market-item">
              <div className="market-item-label">Volume</div>
              <div className="market-item-value">$25.8B</div>
            </div>
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
