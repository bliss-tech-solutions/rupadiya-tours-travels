'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Smartphone, 
  Building2, 
  Wallet, 
  ShieldCheck, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { api } from '../../lib/api';

export default function AdminPaymentMethodsPage() {
  const [methods, setMethods] = useState({
    upi: true,
    card: true,
    netbanking: true,
    wallet: true
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchConfig = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.getPaymentMethodConfig();
      if (res?.success && res.allowedMethods) {
        setMethods({
          upi: Boolean(res.allowedMethods.upi ?? true),
          card: Boolean(res.allowedMethods.card ?? true),
          netbanking: Boolean(res.allowedMethods.netbanking ?? true),
          wallet: Boolean(res.allowedMethods.wallet ?? true)
        });
      }
    } catch (err) {
      console.error('Failed to load payment config:', err);
      setErrorMsg(err.message || 'Failed to load platform payment configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleToggle = (key) => {
    setMethods((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
    setSavedSuccess(false);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setSavedSuccess(false);

    // Validate: at least one method must be enabled
    const anyActive = Object.values(methods).some(Boolean);
    if (!anyActive) {
      setErrorMsg('At least one payment instrument must remain enabled for customer checkouts.');
      setSaving(false);
      return;
    }

    try {
      const res = await api.updatePaymentMethodConfig(methods);
      if (res?.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      } else {
        setErrorMsg(res?.error || 'Failed to update payment configuration.');
      }
    } catch (err) {
      console.error('Error saving payment methods:', err);
      setErrorMsg(err.message || 'Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  const paymentOptions = [
    {
      key: 'upi',
      name: 'UPI Instant',
      description: 'Google Pay, PhonePe, Paytm, BHIM, UPI Intent & Dynamic QR code',
      badge: '0% Platform Fee · Recommended',
      icon: Smartphone,
      color: 'emerald'
    },
    {
      key: 'card',
      name: 'Credit & Debit Cards',
      description: 'Visa, MasterCard, RuPay, Maestro & Domestic Corporate Cards with 3D Secure OTP',
      badge: 'Global Standard · 100% Secure',
      icon: CreditCard,
      color: 'blue'
    },
    {
      key: 'netbanking',
      name: 'Net Banking (50+ Banks)',
      description: 'Direct internet banking gateway with HDFC, SBI, ICICI, Axis, Kotak, PNB & major banks',
      badge: 'High-Ticket Settlements',
      icon: Building2,
      color: 'indigo'
    },
    {
      key: 'wallet',
      name: 'Wallets & Pay Later',
      description: 'Amazon Pay, MobiKwik, Airtel Money, FreeCharge, and consumer micro-credit instruments',
      badge: '1-Click Instant Express',
      icon: Wallet,
      color: 'amber'
    }
  ];

  const activeCount = Object.values(methods).filter(Boolean).length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider border border-blue-200">
              Super Admin Platform Controls
            </span>
            <span className="text-xs text-slate-400">· Global Payment Routing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Payment Gateway Governance
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Control which payment methods are unlocked inside Razorpay Checkout across all 33 franchise companies, agents, and passengers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={fetchConfig}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer"
            title="Refresh from server"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Deploy Rules</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alerts & Notifications */}
      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Platform payment gateway configuration deployed successfully to Razorpay!</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider bg-emerald-200/60 px-2 py-0.5 rounded-md">
            Active Now
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Grid: Settings & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Toggles (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Allowed Payment Methods
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Toggle on or off to grant or restrict specific checkout instruments.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {activeCount} of 4 Active
              </span>
            </div>

            <div className="space-y-4">
              {paymentOptions.map((opt) => {
                const isEnabled = methods[opt.key];
                const IconComponent = opt.icon;

                return (
                  <div
                    key={opt.key}
                    onClick={() => handleToggle(opt.key)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-4 select-none ${
                      isEnabled
                        ? 'bg-blue-50/40 border-blue-200/90 shadow-2xs'
                        : 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        isEnabled ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-200 text-slate-400'
                      }`}>
                        <IconComponent className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900">
                            {opt.name}
                          </h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            isEnabled
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {opt.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          {opt.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label={`Toggle ${opt.name}`}
                      className="flex-shrink-0 mt-1 cursor-pointer focus:outline-none"
                    >
                      {isEnabled ? (
                        <div className="w-12 h-6 bg-blue-600 rounded-full flex items-center justify-end px-1 shadow-inner transition-colors">
                          <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                        </div>
                      ) : (
                        <div className="w-12 h-6 bg-slate-300 rounded-full flex items-center justify-start px-1 shadow-inner transition-colors">
                          <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">
                Changes apply instantly across all checkout pages upon saving.
              </span>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                <span>Save Platform Rules</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Visualizer / Razorpay Simulation (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Live Checkout Preview
                </h3>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Razorpay v1 API
              </span>
            </div>

            <p className="text-xs text-slate-500 mb-4">
              This preview reflects the available instruments a customer will see when opening the payment modal:
            </p>

            {/* Simulated Razorpay Checkout Modal Window */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3.5 shadow-inner">
              <div className="bg-white rounded-xl p-3 border border-slate-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Rupadiya Platform</span>
                  <span className="text-sm font-bold text-slate-900">Pay ₹1,733 via Razorpay</span>
                </div>
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                  <Lock className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Available Instruments ({activeCount} enabled):
                </span>

                {paymentOptions.map((opt) => {
                  const isEnabled = methods[opt.key];
                  if (!isEnabled) {
                    return (
                      <div
                        key={opt.key}
                        className="p-2.5 rounded-xl border border-dashed border-slate-200 bg-slate-100/60 text-slate-400 text-xs flex items-center justify-between line-through"
                      >
                        <span className="font-semibold">{opt.name}</span>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Disabled</span>
                      </div>
                    );
                  }

                  const IconComp = opt.icon;
                  return (
                    <div
                      key={opt.key}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-bold flex items-center justify-between shadow-2xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <IconComp className="w-4 h-4 text-blue-600" />
                        <span>{opt.name}</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
                        Enabled
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 p-3.5 rounded-2xl bg-blue-50/60 border border-blue-200/80 text-xs text-blue-900">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Franchise Hierarchy Notice</span>
              </div>
              <p className="text-[11px] text-blue-800 leading-relaxed">
                When a method is disabled globally here, no franchise company or agent can bypass it. Company owners can only restrict methods within the subset you permit.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

