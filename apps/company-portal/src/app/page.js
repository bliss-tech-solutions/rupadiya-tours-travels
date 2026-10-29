'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Bus, 
  CalendarClock, 
  Users,
  Target, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Wallet,
  Plus,
  RefreshCw,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { api, isOwnerSessionValid } from '../lib/api';
import { openRazorpayCheckout } from '../lib/razorpay';

export default function CompanyDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Add funds modal
  const [fundModalOpen, setFundModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState('10000');
  const [fundingLoading, setFundingLoading] = useState(false);
  const [fundSuccess, setFundSuccess] = useState('');

  // Payment methods
  const [paymentMethods, setPaymentMethods] = useState([
    { method: 'upi', label: 'UPI (GPay / PhonePe / Paytm)', enabled: true },
    { method: 'card', label: 'Credit / Debit Cards', enabled: true },
    { method: 'netbanking', label: 'Net Banking (All Major Banks)', enabled: true },
    { method: 'cash', label: 'Agent Counter Cash', enabled: true }
  ]);
  const [savingPayment, setSavingPayment] = useState(false);

  const loadDashboard = async () => {
    if (!isOwnerSessionValid()) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getDashboard();
      if (res?.success) {
        setData(res);
        if (res.company?.paymentMethods && res.company.paymentMethods.length > 0) {
          setPaymentMethods(prev => prev.map(p => {
            const match = res.company.paymentMethods.find(m => m.method === p.method);
            return match ? { ...p, enabled: match.enabled } : p;
          }));
        }
      } else {
        setError(res?.error || 'Failed to load company dashboard');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to company service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleDepositSubmit = async (e) => {
    e.preventDefault();
    const amt = Number(depositAmount);
    if (!amt || amt < 100) return;

    setFundingLoading(true);
    setFundSuccess('');
    try {
      const orderRes = await api.createPaymentOrder({
        amount: amt,
        purpose: 'COMPANY_WALLET_DEPOSIT',
        companyCode: code,
        metadata: {
          depositMethod: 'Razorpay Online'
        },
        notes: {
          companyCode: String(code),
          companyName
        }
      });

      if (!orderRes?.orderId) {
        throw new Error(orderRes?.error || 'Failed to initialize payment gateway order');
      }

      await openRazorpayCheckout({
        orderId: orderRes.orderId,
        amount: amt,
        currency: 'INR',
        keyId: orderRes.keyId,
        name: companyName,
        description: `Company Wallet Deposit (₹${amt.toLocaleString('en-IN')})`,
        prefill: {
          name: 'Company Owner',
          email: 'owner@rupadiya.test'
        },
        onSuccess: async (rzpResponse) => {
          try {
            const verifyRes = await api.verifyPayment({
              orderId: rzpResponse.razorpay_order_id,
              paymentId: rzpResponse.razorpay_payment_id,
              signature: rzpResponse.razorpay_signature
            });

            if (verifyRes?.success) {
              setFundSuccess(`₹${amt.toLocaleString('en-IN')} added to Company Wallet!`);
              window.dispatchEvent(new Event('company-wallet-updated'));
              setTimeout(() => {
                setFundModalOpen(false);
                setFundSuccess('');
                loadDashboard();
              }, 1200);
            } else {
              alert(verifyRes?.error || 'Payment verification failed');
            }
          } catch (vErr) {
            alert(vErr.message || 'Payment verification failed');
          } finally {
            setFundingLoading(false);
          }
        },
        onDismiss: () => {
          setFundingLoading(false);
        }
      });
    } catch (err) {
      alert(err.message || 'Deposit gateway error');
      setFundingLoading(false);
    }
  };

  const handleTogglePaymentMethod = async (methodKey) => {
    const updated = paymentMethods.map(p => p.method === methodKey ? { ...p, enabled: !p.enabled } : p);
    setPaymentMethods(updated);
    setSavingPayment(true);
    try {
      await api.updatePaymentMethods(updated.map(p => ({ method: p.method, enabled: p.enabled })));
    } catch (e) {
      console.error(e);
    } finally {
      setSavingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="text-xs font-semibold uppercase tracking-wider">Loading Company Franchise Ops...</span>
      </div>
    );
  }

  const code = data?.companyCode || 1;
  const companyName = data?.company?.name || `Rupadiya Franchise Carrier #${String(code).padStart(2, '0')}`;
  const stats = data?.stats || {};
  const wallet = data?.wallet || {};
  const targetPassengers = stats.targetPassengers || 10000;
  const totalPassengers = stats.totalPassengers || 0;
  const progressPercent = stats.targetProgressPercent || Math.min(100, Math.round((totalPassengers / targetPassengers) * 100));

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white border border-slate-200/80 p-5 sm:p-6 rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium uppercase tracking-wider mb-2 border border-blue-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Franchise Operations Center</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{companyName}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Company Code #{String(code).padStart(2, '0')} · Strictly scoped fleet, verified agents, and passenger operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => setFundModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Wallet Funds</span>
          </button>
          <Link
            href="/trips"
            className="px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition flex items-center gap-2"
          >
            <CalendarClock className="w-4 h-4" />
            <span>Dispatch Trip</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Company Wallet Balance */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Company Wallet</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-emerald-600 bg-emerald-50 border border-emerald-100">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            ₹{Number(wallet.availableBalance || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 font-medium pt-2 border-t border-slate-100 flex justify-between items-center">
            <span>Franchise Funds</span>
            <button onClick={() => setFundModalOpen(true)} className="text-emerald-700 font-medium hover:underline">
              + Top Up
            </button>
          </div>
        </div>

        {/* Total Active Buses */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Active Fleet</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-blue-600 bg-blue-50 border border-blue-100">
              <Bus className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats.busCount || 0} Buses
          </div>
          <div className="text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
            <Link href="/fleet" className="text-blue-700 font-semibold hover:underline">View bus inventory →</Link>
          </div>
        </div>

        {/* Authorized Agents */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Authorized Agents</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-purple-600 bg-purple-50 border border-purple-100">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats.agentCount || 0} Counters
          </div>
          <div className="text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
            <Link href="/agents" className="text-purple-700 font-medium hover:underline">Manage agents →</Link>
          </div>
        </div>

        {/* Pending Agent Withdrawals */}
        <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">Withdrawals Queue</span>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-amber-600 bg-amber-50 border border-amber-100">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {stats.pendingWithdrawalsCount || 0} Pending
          </div>
          <div className="text-xs text-slate-500 font-medium pt-2 border-t border-slate-100">
            <Link href="/withdrawals" className="text-amber-700 font-medium hover:underline">Review & payout →</Link>
          </div>
        </div>
      </div>

      {/* Annual Passenger Commitment Target Progress */}
      <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              <h2 className="text-xs font-medium uppercase tracking-wider text-slate-700">
                Annual Passenger Commitment Progress (FY 2026-2027)
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {totalPassengers.toLocaleString('en-IN')} of {targetPassengers.toLocaleString('en-IN')} passengers committed under Company Code #{String(code).padStart(2, '0')}
            </p>
          </div>
          <span className="text-2xl font-bold text-blue-700">{progressPercent}%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
          <div 
            className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full transition-all duration-700" 
            style={{ width: `${Math.max(2, progressPercent)}%` }} 
          />
        </div>
      </div>

      {/* Operations Shortcuts & Payment Switches */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Operations Shortcuts */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <h3 className="text-xs font-medium uppercase tracking-wider text-slate-700">Operations Shortcuts</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              href="/agents"
              className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-400 hover:bg-blue-50/30 transition block group shadow-2xs"
            >
              <div className="flex items-center justify-between text-blue-600 mb-2">
                <Users className="w-5 h-5" />
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
              <h4 className="text-xs font-semibold text-slate-900">Manage Agents</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Create agents with wallet amount, top up, or remove.</p>
            </Link>

            <Link
              href="/withdrawals"
              className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-amber-400 hover:bg-amber-50/30 transition block group shadow-2xs"
            >
              <div className="flex items-center justify-between text-amber-600 mb-2">
                <CreditCard className="w-5 h-5" />
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
              <h4 className="text-xs font-semibold text-slate-900">Withdrawal Approvals</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Approve agent payout requests or reject with refund.</p>
            </Link>

            <Link
              href="/fleet"
              className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-purple-400 hover:bg-purple-50/30 transition block group shadow-2xs"
            >
              <div className="flex items-center justify-between text-purple-600 mb-2">
                <Bus className="w-5 h-5" />
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
              <h4 className="text-xs font-semibold text-slate-900">Fleet Buses</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">View 2+2 & sleeper buses and driver contacts.</p>
            </Link>

            <Link
              href="/targets"
              className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-emerald-400 hover:bg-emerald-50/30 transition block group shadow-2xs"
            >
              <div className="flex items-center justify-between text-emerald-600 mb-2">
                <TrendingUp className="w-5 h-5" />
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </div>
              <h4 className="text-xs font-semibold text-slate-900">P&L & Quota Statement</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Export gross revenue and monthly quota progress.</p>
            </Link>
          </div>
        </div>

        {/* Franchise Payment Switches (Section 4.8 of Developer Spec) */}
        <div className="bg-white border border-slate-200/80 p-6 rounded-2xl shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-700">Franchise Payment Channels</h3>
              <p className="text-[11px] text-slate-500">Payment methods accepted for tickets issued under your company</p>
            </div>
            {savingPayment && <span className="text-[10px] text-blue-600 font-bold animate-pulse">Saving...</span>}
          </div>

          <div className="space-y-2.5">
            {paymentMethods.map((pm) => (
              <div key={pm.method} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/70">
                <span className="text-xs font-semibold text-slate-800">{pm.label}</span>
                <button
                  type="button"
                  onClick={() => handleTogglePaymentMethod(pm.method)}
                  className={`text-xl transition ${pm.enabled ? 'text-emerald-600' : 'text-slate-300'}`}
                >
                  {pm.enabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Funds Modal */}
      {fundModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-5 h-5 text-emerald-600" />
                <span>Add Funds to Company Wallet</span>
              </h3>
              <button onClick={() => setFundModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm">✕</button>
            </div>

            {fundSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{fundSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleDepositSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1.5">Deposit Amount (₹)</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    required
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 font-semibold text-lg focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {['5000', '10000', '25000', '50000'].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setDepositAmount(p)}
                        className={`py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${depositAmount === p ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}`}
                      >
                        ₹{Number(p).toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Online Payment via Razorpay
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      256-Bit SSL
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Razorpay manages all payment modes automatically: UPI (GPay, PhonePe, Paytm), Credit & Debit Cards, and NetBanking.
                  </p>
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setFundModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={fundingLoading}
                    className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {fundingLoading ? 'Connecting...' : `Pay ₹${Number(depositAmount || 0).toLocaleString('en-IN')} Online via Razorpay →`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
