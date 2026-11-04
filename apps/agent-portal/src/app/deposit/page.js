'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  PlusCircle, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  RefreshCw,
  AlertCircle,
  Sparkles,
  Zap,
  Lock
} from 'lucide-react';
import { api } from '../../lib/api';
import { openRazorpayCheckout } from '../../lib/razorpay';

export default function MakeDepositPage() {
  const [balance, setBalance] = useState(null);
  const [amount, setAmount] = useState('2000');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [agentUser, setAgentUser] = useState(null);

  const presets = ['1000', '2000', '5000', '10000'];

  const fetchBalance = async () => {
    try {
      const rawUser = localStorage.getItem('agent_user');
      if (rawUser) setAgentUser(JSON.parse(rawUser));

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
      if (d?.agent) setAgentUser(d.agent);
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

  const handleCompletePayment = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount < 100) {
      setError('Minimum deposit amount is ₹100');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const uId = agentUser?._id || agentUser?.id;
      const cCode = agentUser?.companyCode || 1;

      // 1. Create Razorpay Payment Order on backend
      const orderRes = await api.createPaymentOrder({
        amount: numAmount,
        purpose: 'WALLET_DEPOSIT',
        userId: uId,
        companyCode: cCode,
        metadata: {
          userId: uId,
          companyCode: cCode,
          agencyName: agentUser?.agencyName || 'Agent Counter'
        },
        notes: {
          agentName: agentUser?.name || 'Agent',
          agentCode: agentUser?.referralCode || 'AGT'
        }
      });

      if (!orderRes?.orderId) {
        throw new Error(orderRes?.error || 'Failed to initialize payment gateway order');
      }

      // 2. Open Razorpay Checkout modal directly
      await openRazorpayCheckout({
        orderId: orderRes.orderId,
        amount: orderRes.amount || numAmount,
        currency: orderRes.currency || 'INR',
        keyId: orderRes.keyId,
        name: 'Rupadiya Partner Terminal',
        description: `Wallet Deposit (₹${numAmount.toLocaleString('en-IN')})`,
        prefill: {
          name: agentUser?.name || 'Authorized Agent',
          email: agentUser?.email || 'agent@rupadiya.test',
          phone: agentUser?.phone || '9876543210'
        },
        onSuccess: async (rzpResponse) => {
          try {
            // 3. Cryptographically verify signature and fulfill wallet deposit
            const verifyRes = await api.verifyPayment({
              orderId: rzpResponse.razorpay_order_id,
              paymentId: rzpResponse.razorpay_payment_id,
              signature: rzpResponse.razorpay_signature,
              userId: uId,
              paymentMethod: 'RAZORPAY'
            });

            if (verifyRes?.success) {
              const newBal = verifyRes.wallet?.availableBalance ?? (Number(balance || 0) + numAmount);
              setBalance(newBal);
              setResult({
                amount: numAmount,
                depositId: verifyRes.payment?.orderId || `DEP_${Date.now()}`,
                paymentId: rzpResponse.razorpay_payment_id,
                method: 'Razorpay Online',
                newBalance: newBal
              });
              window.dispatchEvent(new Event('wallet-updated'));
            } else {
              setError(verifyRes?.error || 'Payment signature verification failed.');
            }
          } catch (vErr) {
            setError(vErr.message || 'Error confirming payment with server');
          } finally {
            setSubmitting(false);
          }
        },
        onDismiss: () => {
          setSubmitting(false);
        }
      });
    } catch (err) {
      setError(err.message || 'Deposit gateway error');
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="max-w-md mx-auto py-8">
        <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 text-center shadow-xs space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Payment Verified & Credited
            </span>
            <h2 className="text-3xl font-black text-slate-900 mt-2">
              ₹{Number(result.amount || amount).toLocaleString('en-IN')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Added directly to your Rupadiya agent wallet
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Order Reference:</span>
              <span className="font-mono font-bold text-slate-800">{result.depositId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Razorpay Payment ID:</span>
              <span className="font-mono text-emerald-700 font-semibold">{result.paymentId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mode:</span>
              <span className="font-medium text-slate-800">Razorpay ({result.method})</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900">
              <span>Updated Wallet Balance:</span>
              <span className="text-emerald-700">₹{Number(result.newBalance || balance || 0).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={() => {
                setResult(null);
                setAmount('2000');
              }}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Deposit Again
            </button>
            <Link
              href="/deposit-history"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition text-center shadow-xs"
            >
              Deposit History →
            </Link>
            <Link
              href="/statement"
              className="flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition text-center shadow-xs"
            >
              View Statement →
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
          Wallet Reload
        </span>
        <h1 className="text-2xl font-black text-slate-900">Make Deposit</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Securely top-up funds into your agent booking wallet via Razorpay Payment Gateway.
        </p>
      </div>

      {/* Available Balance Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Current Available Balance
          </span>
          <div className="text-3xl font-black text-slate-900 mt-1">
            {balance !== null ? `₹${Number(balance).toLocaleString('en-IN')}` : '₹...'}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium flex items-center gap-1 mt-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Instant credit upon payment capture
          </span>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shadow-2xs">
          <Wallet className="w-6 h-6" />
        </div>
      </div>

      {/* Deposit Form */}
      <div className="bg-white p-6 sm:p-7 rounded-3xl border border-slate-200/80 shadow-xs space-y-5">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">
            Deposit Amount (₹)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-400">₹</span>
            <input
              type="number"
              min="100"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount (min ₹100)"
              className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition"
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Minimum deposit amount is ₹100. Standard deposit limits apply.</p>
        </div>

        {/* Preset Amount Pills */}
        <div>
          <span className="text-xs font-bold text-slate-600 block mb-2">Select Preset Amount</span>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition cursor-pointer ${
                  amount === preset
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                ₹{Number(preset).toLocaleString('en-IN')}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Online Payment via Razorpay Gateway */}
        <div className="pt-4 border-t border-slate-100 space-y-4">
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Online Payment via Razorpay Gateway
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                256-Bit SSL Secured
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 flex justify-between items-center text-xs">
            <span className="text-slate-700 font-semibold">Total Deposit Amount:</span>
            <span className="text-xl font-black text-emerald-700">₹{Number(amount || 0).toLocaleString('en-IN')}</span>
          </div>

          <button
            type="button"
            disabled={submitting || !Number(amount) || Number(amount) < 100}
            onClick={handleCompletePayment}
            className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl text-sm shadow-lg shadow-emerald-600/25 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span>Launching Razorpay Gateway...</span>
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                <span>Pay Online</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
