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
  Clock,
  ShieldAlert
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
    { label: '34 Companies Registry', value: '34 Franchises', sub: 'Fixed Ranks #01 to #34 (Ntt to Ott)', icon: Building2, color: 'text-blue-700 bg-blue-50', href: '/companies' },
    { label: 'Global Agents', value: `${data?.totalAgents || 0} Registered`, sub: 'Across 34 Franchise Codes', icon: Users, color: 'text-sky-700 bg-sky-50', href: '/agents' },
    { label: 'Active Fleet Buses', value: `${data?.totalBuses || 0} Coaches`, sub: '36 Sleeper & 40 Seater Fleet', icon: Bus, color: 'text-emerald-700 bg-emerald-50', href: '/fleet' },
    { label: 'Platform Gross Volume', value: `₹${Number(data?.totalGMV || 0).toLocaleString('en-IN')}`, sub: `${data?.totalSeatsBooked || 0} Seats Booked`, icon: Receipt, color: 'text-amber-700 bg-amber-50', href: '/bookings' },
  ];

  return (
    <div className="w-full space-y-6">
      {/* Top Welcome Banner */}
      <div className="bg-white border border-slate-200/90 p-6 sm:p-7 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-wider mb-2 border border-blue-200/60">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Master Super Admin Control HQ</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Rupadiya Platform Command Center</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Universal oversight across all 34 franchise companies (Passenger Ranking), global agent lifecycle, standardized 36/40 fleet, and tax reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchDashboard}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/companies"
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition"
          >
            Manage 34 Companies →
          </Link>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s, i) => (
          <Link 
            key={i} 
            href={s.href}
            className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-3 block hover:border-blue-300 transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{s.label}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 group-hover:text-blue-700 transition">{s.value}</div>
            <div className="text-xs text-slate-500 font-medium pt-2 border-t border-slate-100 flex items-center justify-between">
              <span>{s.sub}</span>
              <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-600 transition" />
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Governance Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/fleet"
          className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs hover:border-blue-300 transition space-y-2 block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Bus className="w-4 h-4 text-blue-600" />
              Fleet & Bus Management
            </span>
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">36 & 40</span>
          </div>
          <p className="text-xs text-slate-500">Induct, configure, and manage sleepers (36 berths) and seaters (40 seats) with driver details.</p>
        </Link>

        <Link
          href="/bookings"
          className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs hover:border-blue-300 transition space-y-2 block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Master Bookings & Insurance
            </span>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">₹5/pax</span>
          </div>
          <p className="text-xs text-slate-500">Audit intercity bookings, insurance premium collections, and passenger manifests.</p>
        </Link>

        <Link
          href="/kyc"
          className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs hover:border-blue-300 transition space-y-2 block"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-sky-600" />
              KYC Approvals Queue
            </span>
            {data?.pendingKycCount > 0 && (
              <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                {data.pendingKycCount} Pending
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">Review Aadhaar and PAN documents submitted for agency authorization.</p>
        </Link>
      </div>
    </div>
  );
}
