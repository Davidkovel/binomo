import React, { useState } from 'react';
import { Lock, Mail, TrendingUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Auth.css';

import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    try {
      const response = await fetch(`${API_BASE_URL}/api/user/auth/sign-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('access_token', data.token);
        // Redirect to trading platform
        navigate('/trading');
      } else {
        setError(data.message || 'Kirish amalga oshmadi. Iltimos, kiritilgan maʼlumotlarni tekshiring.');
      }
    } catch (err) {
      setError('Server bilan ulana olmadi. Backend 8080-portda ishlayotganiga ishonch hosil qiling.');
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
          <h1 className="auth-title">Qaytganingiz bilan tabriklaymiz</h1>
          <p className="auth-subtitle">
            Savdo hisobingizga kirish uchun tizimga kiring
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
              <Mail size={18} />
              Email manzil
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
              <Lock size={18} />
              Parol
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Parolingizni kiriting"
              required
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
              'Kirish'
            )}
          </button>
        </div>

        <div className="auth-toggle">
          <p>
            Hisobingiz yo‘qmi?
            <a href="/register" className="toggle-link">
              Ro‘yxatdan o‘tish
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}