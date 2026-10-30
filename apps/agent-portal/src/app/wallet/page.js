'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  ArrowDownToLine, 
  History, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { api } from '../../lib/api';

export default function AgentWalletLedgerPage() {
  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('5000');
  const [message, setMessage] = useState('');

  const loadData = async () => {
    try {
      const [wRes, lRes] = await Promise.allSettled([
        api.getMyWallet(),
        api.getLedger()
      ]);
      if (wRes.status === 'fulfilled') {
        const val = wRes.value;
        const wData = val?.data || val?.wallet || { availableBalance: val?.balance || 0, balance: val?.balance || 0 };
        setWallet(wData);
      }
      if (lRes.status === 'fulfilled') {
        const val = lRes.value;
        setLedger(val?.ledger || val?.data || []);
      }
    } catch (e) {} finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTopup = async (e) => {
    e.preventDefault();
    const amt = parseFloat(topupAmount);
    if (!amt || amt <= 0) return;

    try {
      await api.requestTopup(amt);
      setMessage(`Successfully credited ₹${amt} to your agent wallet!`);
      setTopupModalOpen(false);
      loadData();
    } catch (err) {
      setMessage(err.message || 'Top-up failed');
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Wallet className="w-3.5 h-3.5" />
            <span>Financial Accounts</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Wallet & Double-Entry Ledger</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time balance, automated commission logs, and immutable accounting transactions.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setTopupModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Top-up Wallet</span>
          </button>
          <Link
            href="/withdrawals"
            className="px-5 py-3 rounded-2xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-2"
          >
            <ArrowDownToLine className="w-4 h-4 text-slate-400" />
            <span>Withdraw</span>
          </Link>
        </div>
      </div>

      {message && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
          {message}
        </div>
      )}

      {/* Balance & Financial Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Balance</span>
          <div className="text-3xl font-black text-emerald-400">
            ₹{(wallet?.availableBalance ?? wallet?.balance ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Available for passenger booking deductions</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Commissions Earned</span>
          <div className="text-3xl font-black text-white">
            ₹{(wallet?.totalEarnings ?? 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-sky-400 font-medium">Credited automatically per confirmed ticket</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Withdrawable Profits</span>
          <div className="text-3xl font-black text-purple-400">
            ₹{Math.max(0, wallet?.withdrawableBalance ?? (wallet?.totalEarnings ?? 0)).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">Eligible for instant bank NEFT/IMPS transfer</span>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-black text-white flex items-center gap-2">
            <History className="w-4 h-4 text-emerald-400" />
            <span>Immutable Double-Entry Ledger</span>
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            {ledger.length} record{ledger.length === 1 ? '' : 's'}
          </span>
        </div>

        {ledger.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-500">
            No ledger entries found. Perform a customer booking to generate instant entries.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {ledger.map((entry, i) => (
                  <tr key={i} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(entry.createdAt || Date.now()).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        entry.entryType === 'CREDIT'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {entry.entryType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-white">
                      {entry.description || entry.referenceType}
                    </td>
                    <td className="py-3 px-4 text-right font-black">
                      <span className={entry.entryType === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400'}>
                        {entry.entryType === 'CREDIT' ? '+' : '-'}₹{entry.amount}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-300">
                      ₹{entry.balanceAfter}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Topup Modal */}
      {topupModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white">Top-up Agent Wallet</h3>
            <p className="text-xs text-slate-400">
              Add operational balance to issue tickets for walk-in passengers.
            </p>

            <form onSubmit={handleTopup} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-base font-bold text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2">
                {[2000, 5000, 10000].map(v => (
                  <button
                    type="button"
                    key={v}
                    onClick={() => setTopupAmount(String(v))}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 text-[11px] font-bold text-slate-300 hover:text-white"
                  >
                    +₹{v}
                  </button>
                ))}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTopupModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs"
                >
                  Confirm Top-up
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

