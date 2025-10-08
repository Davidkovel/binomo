import React, { useState } from 'react';
import { Lock, Mail, User, TrendingUp, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Auth.css';
import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;

export default function Register() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
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

    // Basic validation
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
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
          password: formData.password
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
            setError('Ненадёжный пароль. Пример безопасного пароля: HardPa$$w0rd!iamthewinner');
          } else {
            setError(data[0].msg || 'Ошибка валидации данных.');
          }
        } else if (data.detail) {
          setError(data.detail);
        } else if (data.message) {
          setError(data.message);
        } else {
          setError('Ненадёжный пароль. Пример безопасного пароля: HardPa$$w0rd!iamthewinner');
        }
      }
    } catch (err) {
      setError('Failed to connect to server. Make sure backend is running on port 8080.');
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
          <h1 className="auth-title">Create Account</h1>
          <p className="auth-subtitle">
            Sign up to start trading crypto
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
              Full Name
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Mail size={18} />
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Enter your email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Lock size={18} />
              Password
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Create a password (min. 6 characters)"
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
              'Create Account'
            )}
          </button>
        </div>

        <div className="auth-toggle">
          <p>
            Already have an account?
            <a href="/login" className="toggle-link">
              Login
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}