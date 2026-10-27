'use client';

import React, { useState } from 'react';
import { FileCheck2, ShieldCheck, Upload, AlertCircle, Check } from 'lucide-react';

export default function AgentKycPage() {
  const [shopName, setShopName] = useState('Rupadiya Express Travel Services');
  const [panNumber, setPanNumber] = useState('ABCDE1234F');
  const [aadhaarNumber, setAadhaarNumber] = useState('9876 5432 1098');
  const [saved, setSaved] = useState(false);

  const handleSave = (e) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Verification & Compliance</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">KYC & Agency Profile</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Complete mandatory government compliance to unlock unlimited wallet payouts and sub-agent recruiting.
        </p>
      </div>

      {/* Verified Status Banner */}
      <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-3xl flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">KYC Verification Status: VERIFIED</h3>
            <p className="text-xs text-emerald-400">Your documents have been verified and approved by Platform Compliance.</p>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs">
          Tier 1 Active
        </span>
      </div>

      {saved && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>Agency details updated successfully.</span>
        </div>
      )}

      {/* KYC Form */}
      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
          Business & Identity Records
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">Travel Agency / Shop Name *</label>
            <input
              type="text"
              required
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">PAN Card Number *</label>
            <input
              type="text"
              required
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">Aadhaar Card Number *</label>
            <input
              type="text"
              required
              value={aadhaarNumber}
              onChange={(e) => setAadhaarNumber(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">Operating Hub Location</label>
            <input
              type="text"
              disabled
              value="Rupadiya Main Border Terminal"
              className="w-full p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs font-bold text-slate-400 cursor-not-allowed"
            />
          </div>
        </div>

        <button
          type="submit"
          className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition"
        >
          Update KYC Information
        </button>
      </form>
    </div>
  );
}

