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
  AlertCircle,
  AlertTriangle,
  X
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/dateUtils';
import { useWallet } from '../../context/WalletContext';

export default function AgentNetworkPage() {
  const { updateUser } = useWallet();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Refresh Code State
  const [refreshModalOpen, setRefreshModalOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState('');

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

  const referralCode = data?.referralCode || 'AGT01L1T0001';
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

  const handleConfirmRefreshCode = async () => {
    setRefreshing(true);
    try {
      const res = await api.refreshReferralCode();
      if (res?.success && res.referralCode) {
        setRefreshModalOpen(false);
        setRefreshSuccess(`New 12-character code ${res.referralCode} generated. Old code is now permanently invalid.`);
        // Update global context so topbar/sidebar show new code
        updateUser({ referralCode: res.referralCode, agentCode: res.referralCode });
        await fetchReferrals();
        setTimeout(() => setRefreshSuccess(''), 5000);
      } else {
        alert(res?.error || 'Failed to refresh referral code');
      }
    } catch (err) {
      alert(err.message || 'Error refreshing referral code');
    } finally {
      setRefreshing(false);
    }
  };

  const tiers = data?.tiers || [
    { tier: 1, label: 'Tier 1 (Direct Sub-agents)', rate: '5.0%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
    { tier: 2, label: 'Tier 2 (Level 2 Sub-agents)', rate: '3.0%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-sky-700 bg-sky-50 border-sky-200' },
    { tier: 3, label: 'Tier 3 (Level 3 Sub-agents)', rate: '2.0%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-purple-700 bg-purple-50 border-purple-200' },
    { tier: 4, label: 'Tier 4 (Level 4 Sub-agents)', rate: '1.0%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { tier: 5, label: 'Tier 5 (Level 5 Sub-agents)', rate: '0.5%', count: 0, volume: '₹0', earnings: '₹0', color: 'text-slate-600 bg-slate-50 border-slate-200' },
  ];

  const subAgents = data?.referrals || [];

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
          {/* 12-Character Referral Code Pill */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-purple-50/70 border border-purple-200">
            <span className="text-[10px] font-bold text-purple-600 uppercase">My 12-Char Code:</span>
            <span className="font-mono font-black text-sm text-purple-800 tracking-wider">{referralCode}</span>
            <button
              type="button"
              onClick={copyCode}
              className="p-1 rounded-lg hover:bg-purple-100 text-purple-600 transition cursor-pointer"
              title="Copy Code"
            >
              {copiedCode ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>

          {/* Refresh Code Button */}
          <button
            type="button"
            onClick={() => setRefreshModalOpen(true)}
            className="px-3.5 py-2.5 rounded-xl border border-purple-200 bg-white hover:bg-purple-50 text-purple-700 font-bold text-xs shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
            title="Refresh your referral code (invalidates previous code)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Code</span>
          </button>

          {/* Copy Link Button */}
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

      {refreshSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{refreshSuccess}</span>
        </div>
      )}

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
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-600' : ''}`} />
          </button>
        </div>

        {subAgents.length === 0 ? (
          <div className="py-12 px-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
              <Users className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-800">No Sub-Agents Enrolled Yet</h4>
            <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
              Share your 12-character referral code or invite link with local counters to build your Level 1 downline.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4 rounded-l-xl">Sub-Agent / Counter</th>
                  <th className="py-3 px-4">Operating Hub/Spoke</th>
                  <th className="py-3 px-4 text-center">Hierarchy Tier</th>
                  <th className="py-3 px-4 text-center">Enrolled Date</th>
                  <th className="py-3 px-4 text-center rounded-r-xl">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subAgents.map((ag, i) => (
                  <tr key={ag.id || i} className="hover:bg-slate-50/80 transition">
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
                    <td className="py-3.5 px-4 text-center text-slate-500 font-medium">{formatDate(ag.joinedDate)}</td>
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
        )}
      </div>

      {/* Confirmation Modal for Referral Code Refresh */}
      {refreshModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-200">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Refresh Referral Code?</h3>
                <p className="text-xs text-slate-500">Important security & invalidation notice</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 space-y-2">
              <p className="font-semibold">
                Your current code <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">{referralCode}</code> will become <strong className="text-rose-700">permanently invalid</strong> immediately upon refresh.
              </p>
              <p className="text-[11px] text-amber-800">
                Anyone who attempts to register or book using the old code will be rejected by the system. A fresh unique 12-character code will be generated for your counter.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setRefreshModalOpen(false)}
                disabled={refreshing}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRefreshCode}
                disabled={refreshing}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                <span>{refreshing ? 'Generating...' : 'Yes, Refresh My Code'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
