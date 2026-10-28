'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Route, 
  Compass, 
  FileSpreadsheet, 
  TrendingUp, 
  Users, 
  ShieldCheck, 
  ArrowRight,
  Sparkles,
  Receipt,
  Bus,
  UserCheck,
  RefreshCw,
  Wallet
} from 'lucide-react';
import { api } from '../lib/api';

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.getDashboard();
      if (res?.success) {
        setData(res.stats || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const stats = [
    { label: 'Authorized Franchises', value: '33 Companies', sub: 'Codes #01 to #33 Registry', icon: Building2, color: 'text-purple-400 bg-purple-500/10', href: '/companies' },
    { label: 'Global Agents', value: `${data?.totalAgents || 0} Registered`, sub: 'Across 33 Franchise Codes', icon: Users, color: 'text-blue-400 bg-blue-500/10', href: '/agents' },
    { label: 'Active Fleet Buses', value: `${data?.totalBuses || 0} Active`, sub: 'Sleeper & 2+2 Luxury Fleet', icon: Bus, color: 'text-emerald-400 bg-emerald-500/10', href: '/fleet' },
    { label: 'Platform Gross Volume', value: `₹${Number(data?.totalGMV || 0).toLocaleString('en-IN')}`, sub: `${data?.totalSeatsBooked || 0} Seats Booked`, icon: Receipt, color: 'text-amber-400 bg-amber-500/10', href: '/bookings' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Welcome Banner */}
      <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Master Super Admin Control HQ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Rupadiya Platform Command Center</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Central governance across all 33 franchise companies, global agent lifecycle, fleet papers compliance, and tax reconciliation.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchDashboard}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            <span>Refresh Stats</span>
          </button>
          <Link
            href="/companies"
            className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-600/25 transition"
          >
            Manage 33 Companies →
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Link 
            key={i} 
            href={s.href}
            className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-3 block hover:border-purple-500/40 transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{s.label}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-white group-hover:text-purple-300 transition">{s.value}</div>
            <div className="text-xs text-slate-400 font-medium pt-2 border-t border-slate-800/80 flex items-center justify-between">
              <span>{s.sub}</span>
              <ArrowRight className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition -translate-x-1 group-hover:translate-x-0" />
            </div>
          </Link>
        ))}
      </div>

      {/* Financial & Tax Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">GST Collected (5%)</span>
          <div className="text-2xl font-black text-emerald-400">
            ₹{Number(data?.totalGSTCollected || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-500 block">Statutory GST 5% on ticket sales</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending KYC Queue</span>
          <div className="text-2xl font-black text-amber-400">
            {data?.pendingKycCount || 0} Documents
          </div>
          <span className="text-[11px] text-slate-500 block">
            <Link href="/kyc" className="text-amber-400 font-bold hover:underline">Review pending Aadhaar & PAN →</Link>
          </span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Master Trips Dispatched</span>
          <div className="text-2xl font-black text-blue-400">
            {data?.totalTrips || 0} Scheduled Trips
          </div>
          <span className="text-[11px] text-slate-500 block">Corridor intercity routes active</span>
        </div>
      </div>

      {/* System Integrity & Strict Policy Banner */}
      <div className="bg-gradient-to-r from-slate-950 via-purple-950/20 to-slate-950 border border-purple-900/40 p-6 rounded-3xl space-y-3">
        <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
          <ShieldCheck className="w-5 h-5 text-emerald-400" />
          <span>Strict Hub-and-Spoke Corridor Integrity Enforced</span>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          The booking engine and corridor routing algorithms strictly enforce that trips only originate or terminate at Rupadiya Central Hub. Spoke-to-spoke direct routing is permanently blocked across all passenger search, agent terminal, and company dispatch endpoints.
        </p>
      </div>

      {/* Quick Navigation Panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/agents"
          className="p-5 rounded-3xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 transition block group"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition">Global Agents Directory</h3>
          <p className="text-xs text-slate-400 mt-1">Manage agents across all 33 companies, inspect wallets, and adjust balances.</p>
        </Link>

        <Link
          href="/fleet"
          className="p-5 rounded-3xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 transition block group"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
            <Bus className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition">Fleet & Paper Compliance</h3>
          <p className="text-xs text-slate-400 mt-1">RC, Insurance, Permit, and Fitness 30-day expiry monitoring.</p>
        </Link>

        <Link
          href="/tax"
          className="p-5 rounded-3xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 transition block group"
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-3">
            <Receipt className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition">GST & TCS Tax Reports</h3>
          <p className="text-xs text-slate-400 mt-1">Audit-ready statutory tax breakdowns and 5-level commission ledger.</p>
        </Link>
      </div>
    </div>
  );
}
