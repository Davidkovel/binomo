import React, { useState, useEffect } from 'react';
import { ArrowLeft, TrendingUp, TrendingDown, Activity, Calendar, DollarSign, Percent } from 'lucide-react';
import { DateTime } from 'luxon';
import { useNavigate } from 'react-router-dom';
import './PositionsHistory.css';

import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL; // Замените на ваш URL

export default function PositionHistory() {
  const Navigate = useNavigate();
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all, buy, sell, ai
  const [stats, setStats] = useState({
    totalTrades: 0,
    totalProfit: 0,
    winRate: 0,
    bestTrade: 0
  });

  useEffect(() => {
    fetchPositions();
  }, []);

  useEffect(() => {
    calculateStats();
  }, [positions]);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${API_BASE_URL}/api/user/get_positions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });


      if (response.status === 401) {
        // Токен недействителен или истёк
        localStorage.removeItem('access_token');
        Navigate('/login');
        return;
      }


      if (!response.ok) {
        throw new Error('Error fetching positions');
      }

      const data = await response.json();
      setPositions(data);
    } catch (error) {
      console.error('Error loading position history:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    if (positions.length === 0) return;

    const totalProfit = positions.reduce((sum, pos) => sum + parseFloat(pos.profit || 0), 0);
    const profitableTrades = positions.filter(pos => parseFloat(pos.profit || 0) > 0).length;
    const winRate = (profitableTrades / positions.length) * 100;
    const bestTrade = Math.max(...positions.map(pos => parseFloat(pos.profit || 0)));

    setStats({
      totalTrades: positions.length,
      totalProfit,
      winRate,
      bestTrade
    });
  };

  const filteredPositions = positions.filter(pos => {
    if (filter === 'all') return true;
    return pos.type === filter;
  });

  const getTypeIcon = (type) => {
    if (type === 'buy') return '';
    if (type === 'sell') return '';
    return '🤖';
  };

  const getTypeLabel = (type) => {
    if (type === 'buy') return 'Sotib oling';
    if (type === 'sell') return 'Sotish';
    return 'AI';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '—';
    console.log('Formatting timestamp:', timestamp);

    const time = DateTime.fromISO(timestamp) // <-- убрали { zone: 'utc' }
                        .setZone('Asia/Tashkent')
                        .toFormat('dd/LL/yyyy, HH:mm');

    console.log('Formatted time:', time);
    return time;
  };


  const formatDateUzs = (timestamp) => {
    if (!timestamp) return '—';

    const date = new Date(timestamp);

    // ⏰ вручную +5 часов для UZ
    date.setHours(date.getHours() + 5);

    return date.toLocaleString('uz-UZ', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };



  const formatMoney = (value) =>
    value.toLocaleString('uz-UZ', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
  });


  if (loading) {
    return (
      <div className="history-container">
        <div className="loading-spinner">
          <Activity size={48} className="spinner-icon" />
          <p>Tarix yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="history-container">
      {/* Header */}
      <div className="history-header">
        <button className="back-btn" onClick={() => window.history.back()}>
          <ArrowLeft size={20} />
          Orqaga
        </button>
        <h1 className="history-title">
          <Activity size={32} />
          Pozitsiyalar tarixi
        </h1>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Operatsiyalar soni</div>
            <div className="stat-value">{stats.totalTrades}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className={`stat-icon ${stats.totalProfit >= 0 ? 'green' : 'red'}`}>
            <DollarSign size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Umumiy foyda</div>
            <div className={`stat-value ${stats.totalProfit >= 0 ? 'profit' : 'loss'}`}>
              {stats.totalProfit >= 0 ? '+' : ''}UZS {formatMoney(stats.totalProfit)}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <Percent size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Muvaffaqiyat darajasi</div>
            <div className="stat-value">{stats.winRate.toFixed(1)}%</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-label">Eng yaxshi operatsiya</div>
            <div className="stat-value profit">+UZS {formatMoney(stats.bestTrade)}</div>
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="filter-bar">
        <button 
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Barchasi
        </button>
        <button 
          className={`filter-btn ${filter === 'buy' ? 'active' : ''}`}
          onClick={() => setFilter('buy')}
        >
          Sotib oling
        </button>
        <button 
          className={`filter-btn ${filter === 'sell' ? 'active' : ''}`}
          onClick={() => setFilter('sell')}
        >
          Sotish
        </button>
        <button 
          className={`filter-btn ${filter === 'ai' ? 'active' : ''}`}
          onClick={() => setFilter('ai')}
        >
          AI Trading
        </button>
      </div>

      {/* Positions List */}
      <div className="positions-list">
        {filteredPositions.length === 0 ? (
          <div className="empty-state">
            <Activity size={64} className="empty-icon" />
            <h3>Operatsiyalar mavjud emas</h3>
            <p>Siz hali hech qanday operatsiya bajarmagansiz</p>
          </div>
        ) : (
          filteredPositions.map((position, index) => {
            const profit = parseFloat(position.profit || 0);
            const roi = parseFloat(position.roi || 0);
            const isProfit = profit >= 0;
            console.log('RAW created_at:', position.created_at);
            console.log('Date parsed:', new Date(position.created_at).toString());
            return (
              <div key={index} className="position-card">
                <div className="position-header">
                  <div className="position-type">
                    <span className="type-icon">{getTypeIcon(position.type)}</span>
                    <span className="type-label">{getTypeLabel(position.type)}</span>
                  </div>
                  <div className={`position-profit ${isProfit ? 'profit' : 'loss'}`}>
                    {isProfit ? '+' : ''}UZS {formatMoney(profit)}
                  </div>
                </div>

                <div className="position-details">
                  <div className="detail-row">
                    <span className="detail-label">Miqdor:</span>
                    <span className="detail-value">UZS {parseFloat(position.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">ROI:</span>
                    <span className={`detail-value ${isProfit ? 'profit' : 'loss'}`}>
                      {isProfit ? '+' : ''}{roi.toFixed(2)}%
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">
                      <Calendar size={14} />
                      Sana:
                    </span>
                    <span className="detail-value">{formatDate(position.created_at)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style jsx>{`
        
      `}</style>
    </div>
  );
}