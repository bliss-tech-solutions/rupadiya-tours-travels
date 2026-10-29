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
  Sparkles,
  Users
} from 'lucide-react';
import { api } from '../../lib/api';

export default function CompanyPaymentMethodsPage() {
  const [methods, setMethods] = useState({
    upi: true,
    card: true,
    netbanking: true,
    wallet: true
  });
  const [globalMethods, setGlobalMethods] = useState({
    upi: true,
    card: true,
    netbanking: true,
    wallet: true
  });
  const [companyCode, setCompanyCode] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchConfig = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await api.getPaymentMethodConfig();
      if (res?.success) {
        if (res.companyCode) setCompanyCode(res.companyCode);
        if (res.globalAllowedMethods) {
          setGlobalMethods({
            upi: Boolean(res.globalAllowedMethods.upi ?? true),
            card: Boolean(res.globalAllowedMethods.card ?? true),
            netbanking: Boolean(res.globalAllowedMethods.netbanking ?? true),
            wallet: Boolean(res.globalAllowedMethods.wallet ?? true)
          });
        }
        if (res.allowedMethods) {
          setMethods({
            upi: Boolean(res.allowedMethods.upi ?? true),
            card: Boolean(res.allowedMethods.card ?? true),
            netbanking: Boolean(res.allowedMethods.netbanking ?? true),
            wallet: Boolean(res.allowedMethods.wallet ?? true)
          });
        }
      }
    } catch (err) {
      console.error('Failed to load company payment config:', err);
      setErrorMsg(err.message || 'Failed to load agent payment configuration.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleToggle = (key) => {
    // If globally disabled by Super Admin, cannot be toggled
    if (globalMethods[key] === false) {
      setErrorMsg(`"${key.toUpperCase()}" is disabled globally by Super Admin and cannot be enabled.`);
      return;
    }

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
    const anyActive = Object.keys(methods).some((k) => methods[k] && globalMethods[k] !== false);
    if (!anyActive) {
      setErrorMsg('At least one payment instrument must remain enabled for your agents.');
      setSaving(false);
      return;
    }

    try {
      const res = await api.updatePaymentMethodConfig(methods);
      if (res?.success) {
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 4000);
      } else {
        setErrorMsg(res?.error || 'Failed to update agent payment configuration.');
      }
    } catch (err) {
      console.error('Error saving company payment methods:', err);
      setErrorMsg(err.message || 'Network error while saving settings.');
    } finally {
      setSaving(false);
    }
  };

  const paymentOptions = [
    {
      key: 'upi',
      name: 'UPI Instant',
      description: 'Permits your agents to accept Google Pay, PhonePe, Paytm, BHIM & Dynamic QR payments.',
      icon: Smartphone
    },
    {
      key: 'card',
      name: 'Credit & Debit Cards',
      description: 'Permits Visa, MasterCard, RuPay card checkouts at agent booking counters.',
      icon: CreditCard
    },
    {
      key: 'netbanking',
      name: 'Net Banking (50+ Banks)',
      description: 'Allows passenger payment via direct bank authorization across all major Indian banks.',
      icon: Building2
    },
    {
      key: 'wallet',
      name: 'Wallets & Micro-Credit',
      description: 'Allows Amazon Pay, Mobikwik, and wallet options during customer ticketing.',
      icon: Wallet
    }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold uppercase tracking-wider border border-blue-200">
              Company #{String(companyCode).padStart(2, '0')} Controls
            </span>
            <span className="text-xs text-slate-400">· Agent Checkout Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Agent Payment Methods
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage which payment gateways are available to your agents when booking tickets for customers.
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
                <span>Save Agent Rules</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {savedSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>Agent payment rules updated successfully! Agents will immediately reflect these options.</span>
          </div>
          <span className="text-[10px] uppercase tracking-wider bg-emerald-200/60 px-2 py-0.5 rounded-md">
            Deployed
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Settings Card */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-600" />
            <h3 className="text-base font-bold text-slate-900">
              Agent Terminal Instruments
            </h3>
          </div>
          <p className="text-xs text-slate-500">
            Enable or restrict payment instruments for all agents affiliated with Company #{String(companyCode).padStart(2, '0')}.
          </p>
        </div>

        <div className="space-y-4">
          {paymentOptions.map((opt) => {
            const isGloballyDisabled = globalMethods[opt.key] === false;
            const isEnabled = methods[opt.key] && !isGloballyDisabled;
            const IconComponent = opt.icon;

            return (
              <div
                key={opt.key}
                onClick={() => handleToggle(opt.key)}
                className={`p-4 sm:p-5 rounded-2xl border transition-all flex items-start justify-between gap-4 select-none ${
                  isGloballyDisabled
                    ? 'bg-slate-100/70 border-slate-200 opacity-50 cursor-not-allowed'
                    : isEnabled
                    ? 'bg-blue-50/40 border-blue-200/90 shadow-2xs cursor-pointer'
                    : 'bg-slate-50/60 border-slate-200 opacity-60 hover:opacity-80 cursor-pointer'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    isGloballyDisabled
                      ? 'bg-slate-200 text-slate-400'
                      : isEnabled
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900">
                        {opt.name}
                      </h4>
                      {isGloballyDisabled ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">
                          Disabled Globally by Super Admin
                        </span>
                      ) : isEnabled ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                          Active for Agents
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {opt.description}
                    </p>
                  </div>
                </div>

                <div className="flex-shrink-0 mt-1">
                  {isGloballyDisabled ? (
                    <div className="w-12 h-6 bg-slate-300 rounded-full flex items-center px-1 cursor-not-allowed opacity-50">
                      <div className="w-4 h-4 bg-slate-400 rounded-full" />
                    </div>
                  ) : isEnabled ? (
                    <div className="w-12 h-6 bg-blue-600 rounded-full flex items-center justify-end px-1 shadow-inner transition-colors">
                      <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                    </div>
                  ) : (
                    <div className="w-12 h-6 bg-slate-300 rounded-full flex items-center justify-start px-1 shadow-inner transition-colors">
                      <div className="w-4 h-4 bg-white rounded-full shadow-md" />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Razorpay Payment Gateway will automatically enforce these filters on agent checkouts.</span>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            <span>Save Agent Payment Rules</span>
          </button>
        </div>
      </div>
    </div>
  );
}

