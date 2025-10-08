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
        setError(data.message || 'Login failed. Please check your credentials.');
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
          <h1 className="auth-title">Welcome Back</h1>
          <p className="auth-subtitle">
            Login to access your trading account
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
              placeholder="Enter your password"
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
              'Login'
            )}
          </button>
        </div>

        <div className="auth-toggle">
          <p>
            Don't have an account?
            <a href="/register" className="toggle-link">
              Sign Up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}