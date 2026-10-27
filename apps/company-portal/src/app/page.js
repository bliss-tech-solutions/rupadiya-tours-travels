'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Building2, 
  Bus, 
  CalendarClock, 
  Users, 
  Target, 
  TrendingUp, 
  ShieldCheck, 
  ArrowRight,
  Sparkles
} from 'lucide-react';

export default function CompanyDashboardPage() {
  const stats = [
    { label: 'Assigned Company Code', value: 'Code #01', sub: 'Rupadiya Royal Travels', icon: Building2, color: 'text-blue-400 bg-blue-500/10' },
    { label: 'Total Fleet Size', value: '4 Buses', sub: 'All 40-Seat 2+2 Luxury Layout', icon: Bus, color: 'text-emerald-400 bg-emerald-500/10' },
    { label: 'Active Scheduled Trips', value: '14 Days', sub: 'Across 6 Intercity Corridors', icon: CalendarClock, color: 'text-purple-400 bg-purple-500/10' },
    { label: 'Annual Target Quota', value: '1,420 / 12,000', sub: '11.8% completed (2026-27)', icon: Target, color: 'text-amber-400 bg-amber-500/10' },
  ];

  const recentCorridors = [
    { name: 'Rupadiya ↔ Ahmedabad', bus: 'UP-40-BT-1001 (BharatBenz AC)', fare: '₹1,650', occupancy: '85%' },
    { name: 'Rupadiya ↔ Surat', bus: 'UP-40-BT-1002 (BharatBenz AC)', fare: '₹1,750', occupancy: '92%' },
    { name: 'Rupadiya ↔ Vadodara', bus: 'UP-40-BT-1003 (Volvo 9600 Multi-Axle)', fare: '₹1,550', occupancy: '78%' },
    { name: 'Rupadiya ↔ Bengaluru', bus: 'UP-40-BT-1004 (Setra s517 HD)', fare: '₹2,400', occupancy: '88%' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Top Banner */}
      <div className="bg-[#0D131F] border border-slate-800 p-6 rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Franchise Operations Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Rupadiya Royal Travels — Company #01</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Strictly scoped franchise operations for Bus Fleet, Driver Assignments, and Corridor Scheduling.
          </p>
        </div>

        <Link
          href="/trips"
          className="px-6 py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition flex items-center gap-2 self-start sm:self-auto"
        >
          <CalendarClock className="w-4 h-4" />
          <span>Dispatch New Trip</span>
        </Link>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item, idx) => (
          <div key={idx} className="bg-[#0D131F] border border-slate-800 p-5 rounded-3xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{item.label}</span>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${item.color}`}>
                <item.icon className="w-5 h-5" />
              </div>
            </div>
            <div className="text-2xl font-black text-white">{item.value}</div>
            <div className="text-xs text-slate-400 font-medium pt-2 border-t border-slate-800/80">
              {item.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Annual Target Progress Bar */}
      <div className="bg-[#0D131F] border border-slate-800 p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-white">
              Annual Passenger Commitment Progress
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              1,420 of 12,000 passenger target fulfilled for Financial Year 2026-2027
            </p>
          </div>
          <span className="text-xl font-black text-blue-400">11.8%</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-900 h-3.5 rounded-full overflow-hidden border border-slate-800">
          <div className="bg-gradient-to-r from-blue-600 to-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: '11.8%' }} />
        </div>
      </div>

      {/* Live Dispatched Corridors */}
      <div className="bg-[#0D131F] border border-slate-800 p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-base font-black text-white">Active Corridor Dispatches</h2>
          <Link href="/fleet" className="text-xs font-bold text-blue-400 hover:underline">
            Manage Fleet Buses →
          </Link>
        </div>

        <div className="space-y-3">
          {recentCorridors.map((c, i) => (
            <div key={i} className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">{c.name}</h4>
                <p className="text-[10px] text-slate-400">{c.bus} · Base Fare: {c.fare}</p>
              </div>

              <div className="text-right">
                <span className="text-xs font-black text-emerald-400">{c.occupancy} Occupancy</span>
                <span className="text-[10px] text-slate-500 block">Live Seating</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

