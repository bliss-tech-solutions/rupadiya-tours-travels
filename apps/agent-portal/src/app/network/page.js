'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Network, 
  Users, 
  Share2, 
  Copy, 
  Check, 
  TrendingUp, 
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/dateUtils';

export default function AgentNetworkPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchReferrals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getReferrals();
      if (res?.success) {
        setData(res);
      } else {
        setError(res?.error || 'Failed to load referral network data');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to referral service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  const referralCode = data?.referralCode || 'RUP-AGT-7749';
  const referralUrl = data?.referralUrl || `https://rupadiya.com/?ref=${referralCode}`;

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyRefLink = () => {
    navigator.clipboard.writeText(referralUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const tiers = data?.tiers || [
    { tier: 1, label: 'Tier 1 (Direct Sub-agents)', rate: '5.0%', count: 6, volume: '₹1,24,000', earnings: '₹6,200', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { tier: 2, label: 'Tier 2 (Level 2 Sub-agents)', rate: '3.0%', count: 5, volume: '₹82,000', earnings: '₹2,460', color: 'text-sky-700 bg-sky-50 border-sky-200' },
    { tier: 3, label: 'Tier 3 (Level 3 Sub-agents)', rate: '2.0%', count: 2, volume: '₹34,000', earnings: '₹680', color: 'text-purple-700 bg-purple-50 border-purple-200' },
    { tier: 4, label: 'Tier 4 (Level 4 Sub-agents)', rate: '1.0%', count: 1, volume: '₹12,000', earnings: '₹120', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { tier: 5, label: 'Tier 5 (Level 5 Sub-agents)', rate: '0.5%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  ];

  const subAgents = data?.referrals || [
    { id: '1', name: 'Vijay Verma', agencyName: 'Verma Travels Counter', city: 'Nanpara / Rupadiya', tier: 1, bookings: 32, totalEarned: '₹3,400', status: 'Active', joinedDate: '2026-10-01' },
    { id: '2', name: 'Pooja Tiwari', agencyName: 'Maa Vaishno Bookings', city: 'Bahraich', tier: 1, bookings: 21, totalEarned: '₹2,100', status: 'Active', joinedDate: '2026-10-12' },
    { id: '3', name: 'Kishan Patel', agencyName: 'Patel Express Spoke', city: 'Ahmedabad (Spoke)', tier: 1, bookings: 18, totalEarned: '₹1,800', status: 'Active', joinedDate: '2026-10-18' },
    { id: '4', name: 'Anil Gupta', agencyName: 'Gupta Counter Agency', city: 'Barabanki', tier: 2, bookings: 14, totalEarned: '₹1,120', status: 'Active', joinedDate: '2026-10-22' },
    { id: '5', name: 'Farhan Ali', agencyName: 'Awadh Travels Station', city: 'Lucknow Junction', tier: 2, bookings: 12, totalEarned: '₹960', status: 'Active', joinedDate: '2026-10-26' },
  ];

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-700 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Agent Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 text-purple-700 text-xs font-bold uppercase tracking-wider border border-purple-200">
              <Network className="w-3.5 h-3.5" />
              <span>Multi-Tier Downline Network</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            5-Tier Commission Hierarchy & Referrals
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Expand your partner network across Rupadiya Hub and connecting destination corridors to earn recursive commissions.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[10px] font-bold text-slate-400 uppercase">My Code:</span>
            <span className="font-mono font-black text-sm text-purple-700">{referralCode}</span>
            <button
              type="button"
              onClick={copyCode}
              className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
              title="Copy Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={copyRefLink}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-2 cursor-pointer active:scale-95"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Invite Link'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 5-Tier Breakdown Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {tiers.map((t) => (
          <div key={t.tier} className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Level {t.tier}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${t.color}`}>
                {t.rate}
              </span>
            </div>
            <div className="text-xl font-black text-slate-900">
              {t.count} <span className="text-xs font-normal text-slate-400">Agents</span>
            </div>
            <div className="pt-2 border-t border-slate-100 text-[11px] space-y-0.5">
              <div className="text-slate-500">Volume: <strong className="text-slate-800">{t.volume}</strong></div>
              <div className="text-emerald-700 font-semibold">Earned: <strong>{t.earnings}</strong></div>
            </div>
          </div>
        ))}
      </div>

      {/* Downline Sub-Agents Table */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" />
              <span>Active Downline Partners ({subAgents.length})</span>
            </h2>
            <p className="text-xs text-slate-500">Sub-agents registered under your referral network tree</p>
          </div>
          <button
            onClick={fetchReferrals}
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-3 px-4 rounded-l-xl">Sub-Agent / Counter</th>
                <th className="py-3 px-4">Operating Hub/Spoke</th>
                <th className="py-3 px-4 text-center">Hierarchy Tier</th>
                <th className="py-3 px-4 text-center">Tickets Issued</th>
                <th className="py-3 px-4 text-center">Enrolled Date</th>
                <th className="py-3 px-4 text-right">Commission Earned</th>
                <th className="py-3 px-4 text-center rounded-r-xl">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {subAgents.map((ag, i) => (
                <tr key={i} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-4">
                    <span className="font-bold text-slate-900 block">{ag.name}</span>
                    <span className="text-[10px] text-slate-500">{ag.agencyName || 'Counter Agent'}</span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">{ag.city}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                      Tier {ag.tier}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center font-bold text-slate-800">{ag.bookings}</td>
                  <td className="py-3.5 px-4 text-center text-slate-500 font-medium">{formatDate(ag.joinedDate)}</td>
                  <td className="py-3.5 px-4 text-right font-black text-emerald-700">{ag.totalEarned}</td>
                  <td className="py-3.5 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                      {ag.status || 'Active'}
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
