'use client';

import React, { useState } from 'react';
import { 
  Network, 
  Users, 
  Share2, 
  Copy, 
  Check, 
  TrendingUp, 
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

export default function AgentNetworkPage() {
  const [copied, setCopied] = useState(false);

  const tiers = [
    { tier: 1, label: 'Tier 1 (Direct Sub-agents)', rate: '5.0%', count: 6, volume: '₹1,24,000', earnings: '₹6,200', color: 'text-emerald-400 bg-emerald-500/10' },
    { tier: 2, label: 'Tier 2 (Level 2 Sub-agents)', rate: '3.0%', count: 5, volume: '₹82,000', earnings: '₹2,460', color: 'text-sky-400 bg-sky-500/10' },
    { tier: 3, label: 'Tier 3 (Level 3 Sub-agents)', rate: '2.0%', count: 2, volume: '₹34,000', earnings: '₹680', color: 'text-purple-400 bg-purple-500/10' },
    { tier: 4, label: 'Tier 4 (Level 4 Sub-agents)', rate: '1.0%', count: 1, volume: '₹12,000', earnings: '₹120', color: 'text-amber-400 bg-amber-500/10' },
    { tier: 5, label: 'Tier 5 (Level 5 Sub-agents)', rate: '0.5%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-slate-400 bg-slate-800' },
  ];

  const subAgents = [
    { name: 'Vijay Verma', city: 'Nanpara / Rupadiya', tier: 1, bookings: 32, totalEarned: '₹3,400', status: 'Active' },
    { name: 'Pooja Tiwari', city: 'Bahraich', tier: 1, bookings: 21, totalEarned: '₹2,100', status: 'Active' },
    { name: 'Kishan Patel', city: 'Ahmedabad (Spoke Agent)', tier: 1, bookings: 18, totalEarned: '₹1,800', status: 'Active' },
    { name: 'Anil Gupta', city: 'Barabanki', tier: 2, bookings: 14, totalEarned: '₹1,120', status: 'Active' },
    { name: 'Farhan Ali', city: 'Lucknow Junction', tier: 2, bookings: 12, totalEarned: '₹960', status: 'Active' },
  ];

  const refLink = 'http://localhost:3000?ref=RUP-AGT-7749';

  const copyRef = () => {
    navigator.clipboard.writeText(refLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Network className="w-3.5 h-3.5" />
            <span>Referral Network</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">5-Tier Commission Hierarchy</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Grow your agent downline. Earn recursive commission override down to 5 generations of tickets.
          </p>
        </div>

        <button
          onClick={copyRef}
          className="px-5 py-3 rounded-2xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-xs transition flex items-center gap-2 shadow-lg shadow-purple-500/20"
        >
          {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Link Copied!' : 'Copy Invite Link'}</span>
        </button>
      </div>

      {/* 5-Tier Breakdown Grid */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {tiers.map((t) => (
          <div key={t.tier} className="bg-slate-900 border border-slate-800 p-4 rounded-3xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Level {t.tier}</span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${t.color}`}>
                {t.rate}
              </span>
            </div>
            <div className="text-xl font-black text-white">{t.count} <span className="text-xs font-normal text-slate-400">Agents</span></div>
            <div className="pt-2 border-t border-slate-800 text-[10px] space-y-0.5">
              <div className="text-slate-400">Volume: <strong className="text-slate-200">{t.volume}</strong></div>
              <div className="text-emerald-400">Earned: <strong>{t.earnings}</strong></div>
            </div>
          </div>
        ))}
      </div>

      {/* Downline Sub-Agents Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          <Users className="w-4 h-4 text-purple-400" />
          <span>Active Downline Sub-Agents</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Sub-Agent Name</th>
                <th className="py-3 px-4">Operating Hub/Spoke</th>
                <th className="py-3 px-4">Tier</th>
                <th className="py-3 px-4">Bookings</th>
                <th className="py-3 px-4 text-right">Commission Generated</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {subAgents.map((ag, i) => (
                <tr key={i} className="hover:bg-slate-800/40 transition">
                  <td className="py-3 px-4 font-bold text-white">{ag.name}</td>
                  <td className="py-3 px-4 text-slate-400">{ag.city}</td>
                  <td className="py-3 px-4 font-bold text-purple-400">Tier {ag.tier}</td>
                  <td className="py-3 px-4 font-mono text-slate-200">{ag.bookings}</td>
                  <td className="py-3 px-4 text-right font-black text-emerald-400">{ag.totalEarned}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      {ag.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

