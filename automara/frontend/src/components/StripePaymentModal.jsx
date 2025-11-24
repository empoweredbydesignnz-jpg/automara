import React, { useState } from 'react';

function StripePaymentModal({ isOpen, onClose, onSuccess, paymentType, planDetails, automationDetails }) {
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    return parts.length ? parts.join(' ') : v;
  };

  const formatExpiry = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setProcessing(true);

    // Simulate Stripe payment processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Basic validation
    if (cardNumber.replace(/\s/g, '').length !== 16) {
      setError('Please enter a valid card number');
      setProcessing(false);
      return;
    }

    if (expiry.length !== 5) {
      setError('Please enter a valid expiry date');
      setProcessing(false);
      return;
    }

    if (cvc.length < 3) {
      setError('Please enter a valid CVC');
      setProcessing(false);
      return;
    }

    // Simulate successful payment
    setProcessing(false);
    onSuccess();
  };

  const getTitle = () => {
    if (paymentType === 'plan') {
      return `Subscribe to ${planDetails?.name}`;
    }
    return `Purchase Additional Automation`;
  };

  const getAmount = () => {
    if (paymentType === 'plan') {
      return planDetails?.price || 0;
    }
    return 10; // Additional automation price
  };

  const getDescription = () => {
    if (paymentType === 'plan') {
      return `${planDetails?.name} - Monthly subscription`;
    }
    return `${automationDetails?.name || 'Automation'} - Additional automation`;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="glass-card rounded-2xl premium-shadow max-w-md w-full overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="relative p-6 border-b border-slate-800">
          <div className="absolute inset-0 bg-gradient-to-r from-theme-primary-dark/10 to-theme-secondary-dark/10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-theme-primary to-theme-secondary rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white">{getTitle()}</h2>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Payment Summary */}
        <div className="p-6 bg-slate-900/50 border-b border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">{getDescription()}</span>
            <span className="text-2xl font-bold text-white">${getAmount()}<span className="text-sm text-slate-400">/mo</span></span>
          </div>
        </div>

        {/* Payment Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Cardholder Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Card Number</label>
            <div className="relative">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                placeholder="4242 4242 4242 4242"
                maxLength={19}
                required
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                <svg className="w-8 h-5" viewBox="0 0 32 20">
                  <rect fill="#1434CB" width="32" height="20" rx="2"/>
                  <path fill="#fff" d="M13 14.5l.8-4.9H12l.8 4.9h.2zm3.4-4.9l-1.3 3.4-.2-.8-.5-2.6h-1.5l2 4.9h1.2l2-4.9h-1.7zm4.8 3.3c0-.5-.3-.9-.9-1.2l-.4-.2c-.3-.1-.4-.2-.4-.4 0-.2.2-.3.5-.3.3 0 .6.1.8.2l.1-1.1c-.3-.1-.6-.2-1-.2-.9 0-1.6.5-1.6 1.3 0 .6.4 1 1 1.3l.4.2c.3.1.5.3.5.5 0 .2-.2.4-.6.4-.4 0-.8-.2-1-.3l-.1 1.1c.3.1.7.2 1.2.2 1 0 1.7-.5 1.7-1.3 0-.6-.4-1-1.2-1.3zM25 9.6h-1.2l.1.5.6 3 .1.4h1.3l-.9-4zm-1.2.5z"/>
                </svg>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Expiry</label>
              <input
                type="text"
                value={expiry}
                onChange={(e) => setExpiry(formatExpiry(e.target.value))}
                placeholder="MM/YY"
                maxLength={5}
                required
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">CVC</label>
              <input
                type="text"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                maxLength={4}
                required
                className="w-full px-4 py-3 bg-slate-900/50 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-theme-primary/50 focus:ring-2 focus:ring-theme-primary/20 transition-all"
              />
            </div>
          </div>

          <div className="pt-4 space-y-3">
            <button
              type="submit"
              disabled={processing}
              className="w-full bg-gradient-to-r from-theme-primary-dark to-theme-secondary-dark text-white font-semibold py-3.5 px-6 rounded-xl hover:from-theme-primary hover:to-theme-secondary transition-all btn-premium shadow-lg shadow-theme-primary/30 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <span>Pay ${getAmount()}/month</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-3 px-6 rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>

          <p className="text-xs text-slate-500 text-center pt-2">
            Secured by Stripe. Your payment information is encrypted.
          </p>
        </form>
      </div>
    </div>
  );
}

export default StripePaymentModal;
