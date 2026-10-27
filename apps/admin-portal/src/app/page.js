'use client';

import React from 'react';
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
  Receipt
} from 'lucide-react';

export default function AdminDashboardPage() {
  const stats = [
    { label: 'Active Franchises', value: '33 Companies', sub: 'Codes #01 to #33 fully registered', icon: Building2, color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Hub-and-Spoke Corridors', value: '12 Active Routes', sub: 'Rupadiya Hub ↔ 6 Spoke Cities', icon: Route, color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Curated Tour Packages', value: '4 Escapes', sub: 'Kutch, Udaipur, Goa, Manali', icon: Compass, color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Platform Gross Volume', value: '₹48,20,000', sub: '5% GST & 1% TCS compliance', icon: Receipt, color: 'text-amber-400 bg-amber-500/10' },
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
            Central governance across all 33 franchise companies, corridor routes, tour experiences, and tax compliance.
          </p>
        </div>

        <div className="flex gap-2">
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
          <div key={i} className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{s.label}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-white">{s.value}</div>
            <div className="text-xs text-slate-400 font-medium pt-2 border-t border-slate-800/80">
              {s.sub}
            </div>
          </div>
        ))}
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Link
          href="/routes"
          className="p-6 rounded-3xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition group space-y-2"
        >
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
            <Route className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition">
            Corridors & Base Fares
          </h3>
          <p className="text-xs text-slate-400">
            Configure base fares and timings for Ahmedabad, Surat, Vadodara, Bengaluru, Hyderabad, and Mumbai.
          </p>
        </Link>

        <Link
          href="/tours"
          className="p-6 rounded-3xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition group space-y-2"
        >
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
            <Compass className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition">
            Handpicked Tour Manager
          </h3>
          <p className="text-xs text-slate-400">
            Publish, edit itineraries, and manage inclusions for curated experiential travel packages.
          </p>
        </Link>

        <Link
          href="/tax"
          className="p-6 rounded-3xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition group space-y-2"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white group-hover:text-purple-400 transition">
            Tax & Compliance (GST / TCS)
          </h3>
          <p className="text-xs text-slate-400">
            Automated 5% GST and Section 194-O 1% TCS deduction summaries for state audits.
          </p>
        </Link>
      </div>
    </div>
  );
}

