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
        console.error('Ошибка при загрузке номера карты');
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
        alert('Chek muvaffaqiyatli yuborildi! Mablag‘ tushishini kuting.');
        onClose();
        // Очистка формы
        setAmount("");
        setFile(null);
      } else {
        alert(data.message || 'Chekni yuborishda xatolik');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Server bilan ulanishda xatolik');
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
            Balansni to‘ldirish
          </h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="payment-form">
          {/* Реквизиты */}
          <div className="payment-details-payment">
            <p className="details-label-payment">O‘tkazma rekvizitlari:</p>
            <div className="card-number">
              {cardLoading ? (
                "Rekvizitlar yuklanmoqda..."
              ) : (
                `💳 ${cardNumber}`
              )}
            </div>
          </div>

          {/* Выбор суммы */}
          <div className="amount-section">
            <label className="section-label">To‘ldirish summasini kiriting::</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="500 000 UZS dan kiriting"
              className="amount-input2"
              min="500000"
              step="1000"
              required
              disabled={loading}
            />
            <div className="min-amount-hint">
              💰 Minimal summa: <strong>500 000 UZS</strong>
            </div>
            
            {/* Валидация суммы */}
            {amount && Number(amount) < 500000 && (
              <div className="error-message">
                ❌ Summa kamida 500 000 UZS bo‘lishi kerak
              </div>
            )}
          </div>

          {/* Загрузка файла */}
          <div className="file-section">
            <p className="file-warning-payment">
              ⚠️ Pul o‘tkazilganidan so‘ng kvitansiyani (chekni) ALBATTA yuboring
            </p>
            <label className="file-upload">
              <Upload className="upload-icon-payment" />
              <span>{file ? file.name : "Kvitansiyani biriktiring"}</span>
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
              disabled={loading || Number(amount) < 500000}
            >
              {loading ? 'Yuborilmoqda...' : 'Men to‘ladim'}
            </button>
            <button 
              type="button" 
              onClick={onClose} 
              className="cancel-button"
              disabled={loading}
            >
              Bekor qilish
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}