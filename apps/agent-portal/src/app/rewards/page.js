'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Gift, 
  Award, 
  TrendingUp, 
  CheckCircle2, 
  RefreshCw, 
  AlertCircle,
  Sparkles,
  Ticket,
  Wallet,
  ArrowRight
} from 'lucide-react';
import { api } from '../../lib/api';

export default function MyRewardsPage() {
  const [data, setData] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchRewards = async () => {
    setLoading(true);
    setError('');
    try {
      const [rewardsRes, walletRes] = await Promise.allSettled([
        api.getRewards(),
        typeof api.getMyWallet === 'function' ? api.getMyWallet() : Promise.resolve(null)
      ]);

      let rewardsPayload = null;
      if (rewardsRes.status === 'fulfilled' && rewardsRes.value) {
        const val = rewardsRes.value;
        if (val.success || val.data) {
          rewardsPayload = val.data || val;
          setData(rewardsPayload);
          if (rewardsPayload.walletBalance != null) {
            setWalletBalance(rewardsPayload.walletBalance);
          } else if (rewardsPayload.wallet?.availableBalance != null) {
            setWalletBalance(rewardsPayload.wallet.availableBalance);
          }
        } else {
          setError(val.error || 'Failed to load rewards program details');
        }
      } else if (rewardsRes.status === 'rejected') {
        setError(rewardsRes.reason?.message || 'Failed to load rewards program details');
      }

      if (walletRes.status === 'fulfilled' && walletRes.value) {
        const wVal = walletRes.value;
        const bal = wVal?.data?.balance ?? wVal?.wallet?.availableBalance ?? wVal?.data?.availableBalance ?? wVal?.balance;
        if (bal != null) {
          setWalletBalance(bal);
        }
      }

      // If walletBalance is still null, fallback to dashboard
      try {
        const dash = await api.getDashboard();
        const d = dash?.data || dash;
        const bal = d?.walletBalance ?? d?.wallet?.availableBalance;
        if (bal != null) setWalletBalance((prev) => prev !== null ? prev : bal);
      } catch (e) {}

    } catch (err) {
      setError(err.message || 'Error connecting to rewards service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRewards();
    const handleWalletUpdate = () => fetchRewards();
    window.addEventListener('wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-2">
        <RefreshCw className="w-7 h-7 animate-spin text-amber-500" />
        <span className="text-xs font-semibold uppercase tracking-wider">Loading Rewards Ledger...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 max-w-lg mx-auto text-center space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto text-rose-600" />
        <p className="text-xs font-bold">{error}</p>
        <button
          onClick={fetchRewards}
          className="px-4 py-2 bg-rose-100 text-rose-800 rounded-xl text-xs font-bold"
        >
          Retry
        </button>
      </div>
    );
  }

  const agentLevel = data?.agentLevel || data?.currentTier || 'SILVER';
  const cashbackPercent = data?.cashbackPercent || data?.cashbackRate || 2;
  const totalRewardsEarned = data?.totalRewardsEarned || data?.totalCashbackEarned || data?.totalCashback || 0;
  const rewardsHistory = data?.rewardsHistory || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 block mb-1">
            Agent Growth Program
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">My Rewards & Commissions</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Instant cashback credited to your wallet balance on every passenger ticket issued
          </p>
        </div>

        <Link
          href="/booking"
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs shadow-xs transition active:scale-95 shrink-0 self-start sm:self-auto"
        >
          <Ticket className="w-4 h-4" />
          <span>Book to Earn Commission</span>
        </Link>
      </div>

      {/* Top 3 Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Earned Commission */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Commission Earned</span>
            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
              <Gift className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-700">
            ₹{Number(totalRewardsEarned).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-500 font-medium mt-1 block">
            Accumulated from ticket sales
          </span>
        </div>

        {/* Current Wallet Balance */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Available Wallet Balance</span>
            <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            ₹{walletBalance !== null ? Number(walletBalance).toLocaleString('en-IN') : '...'}
          </div>
          <span className="text-[11px] text-emerald-700 font-medium mt-1 block">
            Ready for instant bookings
          </span>
        </div>

        {/* Active Commission Rate */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Partner Tier & Incentive</span>
            <div className="p-2 bg-sky-50 rounded-xl text-sky-600">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {cashbackPercent}% <span className="text-xs font-semibold text-slate-500">Per Ticket</span>
          </div>
          <span className="text-[11px] text-sky-700 font-semibold mt-1 block">
            {agentLevel} Level Partner
          </span>
        </div>
      </div>

      {/* Rewards History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Commission & Reward History</h3>
            <p className="text-[11px] text-slate-500">Earnings automatically deposited into your wallet ledger</p>
          </div>
          <Link href="/statement" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
            View Statement <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {rewardsHistory.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            No commission transactions yet. Start issuing tickets from the Booking tab to earn instant incentives!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Booking Ref / PNR</th>
                  <th className="py-3 px-4 text-right">Commission Credited</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rewardsHistory.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                      {new Date(item.createdAt).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {item.description || 'Ticket Booking Commission'}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-700">
                      #{item.referenceId || (item.bookingId?.pnr || item.bookingId?._id || 'REWARD')}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-amber-700">
                      +₹{Number(item.netCommission ?? item.amount ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> Credited
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
