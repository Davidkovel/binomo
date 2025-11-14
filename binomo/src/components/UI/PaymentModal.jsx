// src/components/ui/PaymentModal.jsx
import React, { useState, useEffect } from 'react'; // Добавьте useEffect
import { X, Upload, CreditCard } from "lucide-react";
import "./PaymentModal.css";
import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;

export default function PaymentModal({ isOpen, onClose }) {
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cardNumber, setCardNumber] = useState(""); 
  const [cardLoading, setCardLoading] = useState(true);
  const [provider, setProvider] = useState('');


  const fetchCardNumber = async () => {
    try {
      setCardLoading(true);
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/user/card_number`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCardNumber(data.card_number);
      } else {
        setCardNumber("8600 **** **** 1234"); // Fallback
      }
    } catch (error) {
      console.error('Error fetching card number:', error);
      setCardNumber("8600 **** **** 1234"); // Fallback
    } finally {
      setCardLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCardNumber();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      
      formData.append('amount', amount);
      if (file) {
        formData.append('invoice_file', file);
      }

      const response = await fetch(`${API_BASE_URL}/api/user/send_invoice_to_tg`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        alert('¡Comprobante enviado con éxito! Espere la acreditación de los fondos.');
        onClose();
        // Очистка формы
        setAmount("");
        setFile(null);
      } else {
        alert(data.message || 'Error al enviar el comprobante');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-modal-overlay" onClick={onClose}>
      <div className="payment-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="payment-modal-header">
          <h2 className="payment-modal-title">
            <CreditCard className="modal-icon" />
            Recargar saldo
          </h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          {/* Реквизиты */}
          <div className="payment-details-payment">
            <p className="details-label-payment">Datos para la transferencia:</p>
            <div className="card-number">
              {cardLoading ? (
                "Cargando los datos de la transferencia..."
              ) : (
                `💳 ${cardNumber}`
              )}
            </div>
          </div>

          {/* Выбор суммы */}
          <div className="amount-section">
            <label className="section-label">Ingrese el monto de recarga:</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Desde 50 USD"
              className="amount-input2"
              min="50"
              step="50"
              required
              disabled={loading}
            />
            <div className="min-amount-hint">
              💰 Monto mínimo: <strong>50 USD</strong>
            </div>
            
            {/* Валидация суммы */}
            {amount && Number(amount) < 50  && (
              <div className="error-message">
                ❌ El monto debe ser al menos 50 USD
              </div>
            )}
          </div>

          {/* Загрузка файла */}
          <div className="file-section">
            <p className="file-warning-payment">
              ⚠️ Después de realizar la transferencia, asegúrate de enviar el comprobante (recibo)
            </p>
            <label className="file-upload">
              <Upload className="upload-icon-payment" />
              <span>{file ? file.name : "Adjunta el comprobante"}</span>
              <input 
                type="file" 
                onChange={(e) => setFile(e.target.files[0])}
                accept="image/*,.pdf"
                className="file-input"
                required
                disabled={loading}
              />
            </label>
          </div>

          {/* Кнопки */}
          <div className="payment-buttons">
            <button 
              type="submit" 
              className="submit-button-payment"
              disabled={loading || Number(amount) < 50}
            >
              {loading ? 'Enviando...' : 'He realizado el pago'}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="cancel-button"
              disabled={loading}
            >
             Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}