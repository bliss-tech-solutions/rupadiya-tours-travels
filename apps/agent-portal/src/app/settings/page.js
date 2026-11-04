'use client';

import React, { useState, useEffect } from 'react';
import { 
  Sliders, 
  Save, 
  RotateCcw, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle,
  Calculator,
  Coins,
  ShieldCheck
} from 'lucide-react';
import { api } from '../../lib/api';

export default function AgentSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fee state with user specified limits: max ₹200 booking charge, max ₹50 cancellation fee per seat
  const [bookingCharge, setBookingCharge] = useState(20);
  const [cancellationCharge, setCancellationCharge] = useState(50);

  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getSettings();
      const s = res.data?.serviceCharges || res.settings || {};
      setBookingCharge(Math.min(200, Number(s.bookingCharge ?? 20)));
      setCancellationCharge(Math.min(50, Number(s.cancellationCharge ?? 50)));
    } catch (err) {
      setError(err.message || 'Error loading settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleBookingChargeChange = (val) => {
    const num = Math.min(200, Math.max(0, Number(val || 0)));
    setBookingCharge(num);
  };

  const handleCancellationChargeChange = (val) => {
    const num = Math.min(50, Math.max(0, Number(val || 0)));
    setCancellationCharge(num);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        bookingCharge: Math.min(200, Math.max(0, Number(bookingCharge))),
        bookingChargeType: 'FIXED',
        cancellationCharge: Math.min(50, Math.max(0, Number(cancellationCharge))),
        cancellationChargeType: 'FIXED'
      };

      const res = await api.updateSettings(payload);
      if (res?.success) {
        setSuccess('Fee preferences saved successfully.');
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(res?.error || 'Failed to update settings');
      }
    } catch (err) {
      setError(err.message || 'Error updating settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setBookingCharge(20);
    setCancellationCharge(50);
  };

  // Sample ₹1,000 calculation
  const sampleBase = 1000;
  const sampleGst = 50; // 5%
  const sampleTotal = sampleBase + sampleGst + Number(bookingCharge);
  const sampleRefund = Math.max(0, sampleBase - 100 - Number(cancellationCharge)); // 10% operator deduction + agent cancellation fee

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-2">
        <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
        <span className="text-xs font-semibold uppercase tracking-wider">Loading Fee Settings...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Terminal Configuration
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Agent Settings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure passenger facilitation fee (Max ₹200) and cancellation fee (Max ₹50 per seat)
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Fee Form */}
        <div className="md:col-span-7 h-fit bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xs">
          <form onSubmit={handleSave} className="space-y-6">
            {/* Agent Booking Service Charge */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 block">
                  Agent Booking Service Charge
                </label>
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                  Max Limit: ₹200
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Added to passenger ticket fare as your agency facilitation fee.
              </p>

              <div className="relative mt-2">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  max="200"
                  value={bookingCharge}
                  onChange={(e) => handleBookingChargeChange(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Cancellation Fee Per Seat */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 block">
                  Cancellation Fee (Per Seat)
                </label>
                <span className="text-[10px] font-bold text-rose-800 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                  Max Limit: ₹50 / seat
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                Retained by your agency when processing passenger ticket cancellations.
              </p>

              <div className="relative mt-2">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">₹</span>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={cancellationCharge}
                  onChange={(e) => handleCancellationChargeChange(e.target.value)}
                  className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Defaults
              </button>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition active:scale-95 flex items-center gap-1.5 shadow-xs"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" /> Save Fees
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Calculation Preview Box */}
        <div className="md:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-xs flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900">Sample Ticket Simulation</h3>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Sample ₹1,000 Booking</span>
              <div className="flex justify-between text-slate-600">
                <span>Base Fare:</span>
                <span>₹1,000</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST (5%):</span>
                <span>₹{sampleGst}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Agent Service Fee:</span>
                <span>+₹{bookingCharge}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Customer Total:</span>
                <span className="text-emerald-700">₹{sampleTotal}</span>
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/60 space-y-2 text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase block">Sample Cancellation Refund</span>
              <div className="flex justify-between text-slate-600">
                <span>Operator Deduction (10%):</span>
                <span>-₹100</span>
              </div>
              <div className="flex justify-between text-rose-700 font-semibold">
                <span>Agent Fee Retained:</span>
                <span>-₹{cancellationCharge}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Customer Refund:</span>
                <span className="text-slate-800">₹{sampleRefund}</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-[11px] text-emerald-800 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>Fees strictly capped at ₹200 booking charge and ₹50 cancellation fee per seat.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
