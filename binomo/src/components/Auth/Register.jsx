import React, { useState } from 'react';
import { TrendingUp, User, Mail, Lock, AlertCircle, Gift, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Auth.css';
import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    promo_code: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [promoMessage, setPromoMessage] = useState('');

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Basic validation
    if (formData.password.length < 6) {
      setError('Parol kamida 6 ta belgidan iborat bo‘lishi kerak');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/user/auth/sign-up`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          promo_code: formData.promo_code || null
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('access_token', data.token);
        // Redirect to trading platform
        navigate('/trading');
      } else {
        // 👇 Проверяем формат ошибки
        if (Array.isArray(data) && data.length > 0) {
          // Если ошибка связана с паролем
          if (data[0].loc && data[0].loc.includes('password')) {
            setError('Ishonchsiz parol. Xavfsiz parol misoli: qwerty12');
          } else {
            setError(data[0].msg || 'Maʼlumotlarni tekshirishda xatolik');
          }
        } else if (data.detail) {
          setError(data.detail);
        } else if (data.message) {
          setError(data.message);
        } else {
          setError('Ishonchsiz parol. Xavfsiz parol misoli: qwerty12');
        }
      }
    } catch (err) {
      setError('Iltimos, yana bir bor Registratsiya tugmasini bosing.');
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-container">
            <TrendingUp size={40} className="logo-icon" />
          </div>
          <h1 className="auth-title">Hisob yaratish</h1>
          <p className="auth-subtitle">
            Kripto savdosini boshlash uchun ro‘yxatdan o‘ting
          </p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        <div className="auth-form">
          <div className="form-group">
            <label className="form-label">
              <User size={18} />
              To‘liq ism
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="form-input"
              placeholder="To‘liq ismingizni kiriting"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Mail size={18} />
              Email manzili
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Email manzilingizni kiriting"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Gift size={18} />
              Código Promocional (Opcional)
            </label>
            <input
              type="text"
              name="promo_code"
              value={formData.promo_code}
              onChange={(e) => setFormData({...formData, promo_code: e.target.value.toUpperCase()})}
              className="form-input"
              placeholder="FINOVA30"
              maxLength={20}
            />
            <p style={{color: '#a78bfa', fontSize: '12px', marginTop: '4px'}}>
              💡 Usa un código para recibir hasta +40% en tu primer depósito
            </p>
          </div>

          <div className="form-group">
            <label className="form-label">
              <Lock size={18} />
              Parol
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Parol yarating (kamida 6 ta belgi)"
              required
              minLength={6}
            />
          </div>

          <button 
            onClick={handleSubmit}
            className="submit-btn"
            disabled={loading}
          >
            {loading ? (
              <span className="loading-spinner"></span>
            ) : (
              'Hisob yaratish'
            )}
          </button>
        </div>

        <div className="auth-toggle">
          <p>
            Allaqachon hisobingiz bormi?
            <a href="/login" className="toggle-link">
              Kirish
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}