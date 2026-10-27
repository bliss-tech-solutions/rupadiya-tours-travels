'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  PlusCircle, 
  QrCode, 
  CreditCard, 
  Building2, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  RefreshCw,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { api } from '../../lib/api';

export default function MakeDepositPage() {
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState('2000');
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState('UPI'); // 'UPI' | 'CARD' | 'NETBANKING'
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  const presets = ['1000', '2000', '5000', '10000'];

  const fetchBalance = async () => {
    try {
      if (typeof api.getMyWallet === 'function') {
        const res = await api.getMyWallet();
        const bal = res?.data?.balance ?? res?.wallet?.availableBalance ?? res?.data?.availableBalance ?? res?.balance;
        if (bal != null) {
          setBalance(bal);
          return;
        }
      }
    } catch (e) {
      console.warn('api.getMyWallet failed, trying dashboard:', e);
    }

    try {
      const dash = await api.getDashboard();
      const d = dash?.data || dash;
      const bal = d?.walletBalance ?? d?.wallet?.availableBalance;
      if (bal != null) {
        setBalance(bal);
      }
    } catch (err) {
      console.error('Failed to fetch balance from dashboard:', err);
    }
  };

  useEffect(() => {
    fetchBalance();
    const handleWalletUpdate = () => fetchBalance();
    window.addEventListener('wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
  }, []);

  const handleProceedClick = (e) => {
    e.preventDefault();
    const num = Number(amount);
    if (!num || num < 100) {
      setError('Please enter a valid deposit amount (minimum ₹100).');
      return;
    }
    setError('');
    setShowPaymentOptions(true);
  };

  const handleCompletePayment = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      setError('Minimum deposit amount is ₹100');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const utrRef = `DEMO_${selectedMethod}_${Date.now()}`;
      const payload = {
        amount: numAmount,
        paymentMethod: selectedMethod === 'UPI' ? 'UPI_QR' : selectedMethod === 'CARD' ? 'CARD' : 'BANK_TRANSFER',
        referenceId: utrRef,
        bankDetails: {
          depositorName: 'Agent Deposit',
          bankName: selectedMethod === 'CARD' ? 'Card Payment (Demo)' : selectedMethod === 'UPI' ? 'UPI Instant' : 'Net Banking'
        },
        simulateInstant: true
      };

      const res = await api.makeDeposit(payload);
      if (res.success) {
        setResult(res.data || res);
        if (res.newBalance != null) {
          setBalance(res.newBalance);
        }
        window.dispatchEvent(new Event('wallet-updated'));
        fetchBalance();
      } else {
        setError(res.error || 'Failed to complete deposit');
      }
    } catch (err) {
      setError(err.message || 'Deposit transaction error');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 text-center shadow-xs space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Payment Successful
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">
              ₹{Number(result.amount || amount).toLocaleString('en-IN')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Added directly to your Rupadiya agent wallet
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Deposit ID:</span>
              <span className="font-mono font-bold text-slate-800">{result.depositId || 'DEP_SUCCESS'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Mode:</span>
              <span className="font-semibold text-slate-800">{selectedMethod} (Instant Test)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Updated Balance:</span>
              <span className="font-bold text-emerald-700">₹{balance != null ? Number(balance).toLocaleString('en-IN') : '...'}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <Link
              href="/statement"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition text-center shadow-xs"
            >
              View Statement
            </Link>
            <button
              onClick={() => {
                setResult(null);
                setShowPaymentOptions(false);
                setAmount('2000');
              }}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition text-center"
            >
              Add More Funds
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Wallet Reload
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Make Deposit</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add funds instantly to issue passenger tickets with zero checkout delays
          </p>
        </div>

        {/* Current Balance */}
        <div className="bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200/80 shrink-0">
          <span className="text-[10px] text-slate-500 font-medium block">Available Balance</span>
          <div className="text-lg font-bold text-slate-900">
            {balance !== null ? `₹${Number(balance).toLocaleString('en-IN')}` : '₹...'}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Deposit Form Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-6">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-2">
            Enter Deposit Amount (₹)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">₹</span>
            <input
              type="number"
              min="100"
              step="100"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setShowPaymentOptions(false);
              }}
              placeholder="2000"
              className="w-full pl-9 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xl font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 shadow-xs"
            />
          </div>

          {/* Preset Buttons (1000, 2000, 5000, 10000) */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  setAmount(preset);
                  setShowPaymentOptions(false);
                }}
                className={`py-2 rounded-xl text-xs font-semibold transition border ${
                  amount === preset
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                ₹{Number(preset).toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        {/* Step 1: Add Money Button */}
        {!showPaymentOptions && (
          <button
            type="button"
            onClick={handleProceedClick}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition active:scale-98 flex items-center justify-center gap-2 shadow-xs"
          >
            <span>Proceed to Add ₹{Number(amount || 0).toLocaleString('en-IN')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {/* Step 2: Payment Mode Selection (Revealed on Add) */}
        {showPaymentOptions && (
          <div className="pt-4 border-t border-slate-100 space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-2">
                Select Payment Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* UPI */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('UPI')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    selectedMethod === 'UPI'
                      ? 'bg-emerald-50/80 border-emerald-500 text-slate-900 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedMethod === 'UPI' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">UPI</div>
                    <div className="text-[10px] text-slate-500">GPay, PhonePe, Paytm</div>
                  </div>
                </button>

                {/* Credit / Debit Card */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('CARD')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    selectedMethod === 'CARD'
                      ? 'bg-emerald-50/80 border-emerald-500 text-slate-900 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedMethod === 'CARD' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Credit / Debit Card</div>
                    <div className="text-[10px] text-slate-500">Visa, MasterCard, RuPay</div>
                  </div>
                </button>

                {/* Net Banking */}
                <button
                  type="button"
                  onClick={() => setSelectedMethod('NETBANKING')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-center gap-3 ${
                    selectedMethod === 'NETBANKING'
                      ? 'bg-emerald-50/80 border-emerald-500 text-slate-900 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${selectedMethod === 'NETBANKING' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Net Banking</div>
                    <div className="text-[10px] text-slate-500">All Major Banks</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Demo / Gateway Note */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-800">Test Mode Simulation:</strong> Clicking below simulates immediate verification via {selectedMethod} and credits your wallet. Razorpay live gateway will be connected seamlessly.
              </div>
            </div>

            {/* Pay Button */}
            <button
              type="button"
              disabled={submitting}
              onClick={handleCompletePayment}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-sm transition active:scale-98 flex items-center justify-center gap-2 shadow-xs"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Processing Payment...
                </>
              ) : (
                <>Pay ₹{Number(amount || 0).toLocaleString('en-IN')} via {selectedMethod} →</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
