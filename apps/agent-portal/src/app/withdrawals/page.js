'use client';

import React, { useState } from 'react';
import { ArrowDownToLine, Wallet, CheckCircle2, AlertCircle, Building2 } from 'lucide-react';

export default function AgentWithdrawalsPage() {
  const [amount, setAmount] = useState('2000');
  const [bankAccount, setBankAccount] = useState('50100492819201');
  const [ifsc, setIfsc] = useState('HDFC0001245');
  const [accountHolder, setAccountHolder] = useState('Rupadiya Agency Owner');
  const [submitted, setSubmitted] = useState(false);

  const withdrawalsHistory = [
    { id: 'WTH-9941', amount: 3500, status: 'PROCESSED', date: '2026-10-24 14:20', utr: 'UTR884920194829' },
    { id: 'WTH-8820', amount: 5000, status: 'PROCESSED', date: '2026-10-18 11:15', utr: 'UTR773910294819' },
  ];

  const handleRequest = (e) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>Settlements & Payouts</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Bank Payout Requests</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Directly transfer your accrued booking commissions and override profits to your bank account.
        </p>
      </div>

      {submitted && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>Withdrawal request for ₹{amount} submitted! Settlement is processed via IMPS.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <form onSubmit={handleRequest} className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>Request Bank Transfer</span>
          </h2>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">Withdrawal Amount (₹) *</label>
            <input
              type="number"
              min="500"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">Bank Account Number *</label>
            <input
              type="text"
              required
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">IFSC Code *</label>
              <input
                type="text"
                required
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Account Holder *</label>
              <input
                type="text"
                required
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition shadow-lg shadow-emerald-500/20"
          >
            Submit Payout Request (₹{amount})
          </button>
        </form>

        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-3">
            Payout History
          </h2>

          <div className="space-y-3">
            {withdrawalsHistory.map((item) => (
              <div key={item.id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">{item.id}</div>
                  <div className="text-[10px] text-slate-400">{item.date} · UTR: {item.utr}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-black text-emerald-400">₹{item.amount}</div>
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400">
                    {item.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

