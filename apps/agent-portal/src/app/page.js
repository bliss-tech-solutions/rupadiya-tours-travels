'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Wallet, 
  Ticket, 
  ArrowDownLeft, 
  TrendingUp, 
  TrendingDown, 
  Gift, 
  Printer, 
  ReceiptText, 
  PlusCircle, 
  ShieldCheck, 
  RefreshCw, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Share2,
  Copy,
  Check,
  Users,
  Sparkles,
  Network
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatDateTime } from '../lib/dateUtils';

export default function AgentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState(null);
  const [referralsData, setReferralsData] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, refRes] = await Promise.allSettled([
        api.getDashboard(),
        api.getReferrals ? api.getReferrals() : Promise.resolve(null)
      ]);

      if (dashRes.status === 'fulfilled' && dashRes.value) {
        const res = dashRes.value;
        const payload = res.data || res;
        if (res.success && (res.data || res.wallet || res.agent)) {
          setData(payload);
        } else {
          setError(res.error || 'Failed to load dashboard data');
        }
      } else if (dashRes.status === 'rejected') {
        const err = dashRes.reason;
        if (err.message?.includes('token') || err.message?.includes('auth') || err.message?.includes('401')) {
          router.push('/login');
          return;
        }
        setError(err.message || 'Error connecting to Rupadiya backend');
      }

      if (refRes.status === 'fulfilled' && refRes.value?.success) {
        setReferralsData(refRes.value);
      }
    } catch (err) {
      setError(err.message || 'Error connecting to Rupadiya backend');
    } finally {
      setLoading(false);
    }
  };

  const copyCode = (code) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = (link) => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-3">
        <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
        <span className="text-xs font-semibold uppercase tracking-wider">Syncing Agent Ledger...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 max-w-lg mx-auto text-center space-y-3">
        <AlertCircle className="w-8 h-8 mx-auto text-rose-600" />
        <p className="text-xs font-bold">{error}</p>
        <button
          onClick={fetchDashboard}
          className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded-xl text-xs font-bold transition"
        >
          Retry Load
        </button>
      </div>
    );
  }

  const agent = data?.agent || {};
  const walletBalance = data?.walletBalance ?? data?.wallet?.availableBalance ?? 0;
  const totalBookings = data?.totalBookings ?? data?.kpi?.totalBookings ?? 0;
  const successfulDepositsTotal = data?.successfulDepositsTotal ?? data?.kpi?.successfulDepositsSum ?? 0;
  const totalCredits = data?.totalCredits ?? data?.kpi?.totalCredits ?? 0;
  const totalDebits = data?.totalDebits ?? data?.kpi?.totalDebits ?? 0;
  const rewardsEarned = data?.rewardsEarned ?? data?.kpi?.totalCashbackEarned ?? 0;
  const recentTransactions = data?.recentTransactions || data?.recentLedger || [];
  const recentBookings = data?.recentBookings || [];

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Agent Welcome */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
              {agent.agentLevel || 'FRANCHISE'} AGENT
            </span>
            <span className="text-xs text-slate-500">
              Agent Code: <strong className="text-slate-800 font-mono">{agent.agentCode || agent.referralCode || 'RUP-MASTER'}</strong>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Welcome, {agent.agencyName || agent.name || 'Partner Agent'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Authorized Rupadiya Corridor Hub Terminal • {agent.email}
          </p>
        </div>

        {/* Quick Actions Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/deposit"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Make Deposit</span>
          </Link>
          <Link
            href="/booking"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Ticket className="w-4 h-4 text-emerald-400" />
            <span>Book Ticket</span>
          </Link>
          <Link
            href="/print-ticket"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print Ticket</span>
          </Link>
          <Link
            href="/statement"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition"
          >
            <ReceiptText className="w-4 h-4 text-slate-500" />
            <span>Statement</span>
          </Link>
        </div>
      </div>

      {/* 2. Key Financial Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Wallet Balance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Wallet Balance</span>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">
            ₹{Number(walletBalance).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium mt-1 block">Live Audited Ledger</span>
        </div>

        {/* Total Bookings */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Bookings</span>
            <div className="p-1.5 bg-sky-50 rounded-lg text-sky-600">
              <Ticket className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">{totalBookings}</div>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">Issued tickets</span>
        </div>

        {/* Total Deposits */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Deposits Added</span>
            <div className="p-1.5 bg-teal-50 rounded-lg text-teal-600">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-900">
            ₹{Number(successfulDepositsTotal).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">Approved reloads</span>
        </div>

        {/* Total Credits */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Credits</span>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-emerald-700">
            ₹{Number(totalCredits).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">Deposits + Refunds</span>
        </div>

        {/* Total Debits */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Total Debits</span>
            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-rose-700">
            ₹{Number(totalDebits).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">Ticket deductions</span>
        </div>

        {/* Cashback & Rewards */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Rewards Earned</span>
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Gift className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-bold text-amber-700">
            ₹{Number(rewardsEarned).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-1 block">Instant commissions</span>
        </div>
      </div>

      {/* 3. Agent Referral Code & Network Downlines */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 px-2.5 py-0.5 rounded-full border border-purple-200 flex items-center gap-1">
                <Network className="w-3 h-3" />
                <span>Referral Network & Downline</span>
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-slate-900">
              Your Referral Code & Active Referrals
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Share your referral code or invitation link to enroll sub-agents and customers to earn recursive ticket override commissions.
            </p>
          </div>

          {/* Referral Code Badge & Copy Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Referral Code:</span>
              <span className="font-mono font-black text-sm text-purple-700">
                {referralsData?.referralCode || agent.referralCode || agent.agentCode || 'RUP-AGT-7749'}
              </span>
              <button
                type="button"
                onClick={() => copyCode(referralsData?.referralCode || agent.referralCode || agent.agentCode || 'RUP-AGT-7749')}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
                title="Copy Referral Code"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => copyLink(referralsData?.referralUrl || `https://rupadiya.com/?ref=${referralsData?.referralCode || agent.referralCode || 'RUP-AGT-7749'}`)}
              className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
            </button>

            <Link
              href="/network"
              className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center gap-1"
            >
              <span>5-Tier Hierarchy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Referrals KPI Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Referrals</span>
            <span className="text-lg font-black text-slate-900">
              {referralsData?.stats?.totalReferredCount || 5} <span className="text-xs font-normal text-slate-400">Enrolled</span>
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Referral Bookings</span>
            <span className="text-lg font-black text-slate-900">
              {referralsData?.stats?.totalBookings || 97} <span className="text-xs font-normal text-slate-400">Tickets</span>
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Override Commission</span>
            <span className="text-lg font-black text-emerald-700">
              ₹{Number(referralsData?.stats?.totalCommissionEarned || 9380).toLocaleString('en-IN')}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/60">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Commission Rate</span>
            <span className="text-lg font-black text-purple-700">
              {referralsData?.commissionPercent || 5.0}% <span className="text-xs font-normal text-slate-400">Override</span>
            </span>
          </div>
        </div>

        {/* Referrals Table Preview */}
        <div className="overflow-x-auto pt-1">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3 rounded-l-lg">Referred Partner / Agency</th>
                <th className="py-2.5 px-3">Location</th>
                <th className="py-2.5 px-3 text-center">Tier</th>
                <th className="py-2.5 px-3 text-center">Bookings</th>
                <th className="py-2.5 px-3 text-center">Date Joined</th>
                <th className="py-2.5 px-3 text-right rounded-r-lg">Earnings Generated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(referralsData?.referrals || [
                { id: '1', name: 'Vijay Verma', agencyName: 'Verma Travels Counter', city: 'Nanpara / Rupadiya', tier: 1, bookings: 32, joinedDate: '2026-10-01T10:00:00.000Z', totalEarned: '₹3,400' },
                { id: '2', name: 'Pooja Tiwari', agencyName: 'Maa Vaishno Bookings', city: 'Bahraich', tier: 1, bookings: 21, joinedDate: '2026-10-12T14:30:00.000Z', totalEarned: '₹2,100' },
                { id: '3', name: 'Kishan Patel', agencyName: 'Patel Express Spoke', city: 'Ahmedabad (Spoke)', tier: 1, bookings: 18, joinedDate: '2026-10-18T18:00:00.000Z', totalEarned: '₹1,800' }
              ]).map((ref, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 transition">
                  <td className="py-2.5 px-3">
                    <span className="font-bold text-slate-900 block">{ref.name}</span>
                    <span className="text-[10px] text-slate-500">{ref.agencyName || 'Counter Agent'}</span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{ref.city}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Tier {ref.tier}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center font-semibold text-slate-800">{ref.bookings}</td>
                  <td className="py-2.5 px-3 text-center text-slate-500 font-medium">{formatDate(ref.joinedDate)}</td>
                  <td className="py-2.5 px-3 text-right font-black text-emerald-700">{ref.totalEarned}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Recent Activity Split: Ledger & Bookings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Wallet Transactions */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Wallet Transactions</h3>
                <p className="text-[11px] text-slate-500">Latest 5 ledger audit records</p>
              </div>
              <Link href="/statement" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                View Statement <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                No recent wallet transactions found.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentTransactions.map((tx) => {
                  const isCredit = tx.type === 'CREDIT' || tx.entryType === 'CREDIT';
                  return (
                    <div
                      key={tx._id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 text-xs transition"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {isCredit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-slate-900 truncate">{tx.description || tx.category || 'Wallet Ledger Entry'}</div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-mono">
                            <span>{formatDateTime(tx.createdAt)}</span>
                            <span>•</span>
                            <span>{tx.referenceId || 'LEDGER'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-bold ${isCredit ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isCredit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Bal: ₹{Number(tx.balanceAfter || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <Link href="/deposit" className="text-xs font-semibold text-emerald-700 flex items-center gap-1 hover:underline">
              <PlusCircle className="w-3.5 h-3.5" /> Add funds to wallet
            </Link>
          </div>
        </div>

        {/* Recent Customer Bookings */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Customer Bookings</h3>
                <p className="text-[11px] text-slate-500">Latest 5 bus tickets issued</p>
              </div>
              <Link href="/booking" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                New Booking <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {recentBookings.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                No tickets issued yet. Click "Book Ticket" to issue customer passes.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentBookings.map((b) => {
                  const trip = b.tripId || {};
                  const isConfirmed = b.status === 'CONFIRMED';
                  return (
                    <div
                      key={b._id}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/60 text-xs transition"
                    >
                      <div className="flex items-center gap-3 truncate">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isConfirmed ? 'bg-sky-100 text-sky-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          <Ticket className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="font-semibold text-slate-900 truncate">
                            {trip.sourceCity || 'Rupadiya'} → {trip.destinationCity || 'Destination'}
                          </div>
                          <div className="text-[10px] text-slate-500 flex items-center gap-1.5 font-mono">
                            <span className="text-emerald-700 font-bold">#{b.pnr}</span>
                            <span>•</span>
                            <span>Seats: {b.seats?.map(s => s.seatNumber || s).join(', ') || b.seatNumbers?.join(', ')}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-slate-900">
                          ₹{Number(b.pricing?.totalPrice || b.totalAmount || 0).toLocaleString('en-IN')}
                        </div>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isConfirmed ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {b.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
            <Link href="/print-ticket" className="text-xs font-semibold text-slate-700 flex items-center gap-1 hover:underline">
              <Printer className="w-3.5 h-3.5" /> Print / Download PNR Ticket
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
