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
      setError('La contraseña debe tener al menos 6 caracteres.');
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
            setError('Contraseña insegura. Ejemplo de una segura: qwerty12');
          } else {
            setError(data[0].msg || 'Error al verificar los datos.');
          }
        } else if (data.detail) {
          setError(data.detail);
        } else if (data.message) {
          setError(data.message);
        } else {
          setError('Contraseña insegura. Ejemplo de una segura: qwerty12');
        }
      }
    } catch (err) {
      setError('No se pudo conectar con el servidor. Asegúrate de que el backend esté funcionando en el puerto 8080.');
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
          <h1 className="auth-title">Crear cuenta</h1>
          <p className="auth-subtitle">
            Regístrate para comenzar a operar con criptomonedas
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
              Nombre completo
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Introduce tu nombre completo"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Mail size={18} />
              Dirección de correo electrónico
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Introduce tu dirección de correo electrónico"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">
              <Lock size={18} />
              Contraseña
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Crea una contraseña (mínimo 6 caracteres)"
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
              'Crear cuenta'
            )}
          </button>
        </div>

        <div className="auth-toggle">
          <p>
            ¿Ya tienes una cuenta?
            <a href="/login" className="toggle-link">
              Iniciar sesión
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}