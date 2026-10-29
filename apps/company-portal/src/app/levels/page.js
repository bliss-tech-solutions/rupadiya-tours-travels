'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Award, 
  ShieldCheck, 
  Users, 
  Sparkles, 
  TrendingUp, 
  Building2, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Edit3, 
  X,
  Check,
  Star,
  Zap,
  Percent
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/dateUtils';

export default function CompanyLevelsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevelFilter, setSelectedLevelFilter] = useState('ALL');

  // Edit Agent Level Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState(null);
  const [selectedLevel, setSelectedLevel] = useState('SILVER');
  const [customCashback, setCustomCashback] = useState('5.0');
  const [updating, setUpdating] = useState(false);

  const fetchLevels = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getLevels();
      if (res?.success) {
        setData(res);
      } else {
        setError(res?.error || 'Failed to fetch level hierarchies');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to levels service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLevels();
  }, []);

  const openEditModal = (agent) => {
    setEditingAgent(agent);
    setSelectedLevel(agent.agentLevel || 'SILVER');
    setCustomCashback(String(agent.customCashbackPercent || '5.0'));
    setEditModalOpen(true);
  };

  const handleLevelSelect = (lvl) => {
    setSelectedLevel(lvl);
    if (lvl === 'BRONZE') setCustomCashback('3.0');
    if (lvl === 'SILVER') setCustomCashback('5.0');
    if (lvl === 'GOLD') setCustomCashback('7.0');
    if (lvl === 'PLATINUM') setCustomCashback('10.0');
  };

  const handleSaveLevel = async (e) => {
    e.preventDefault();
    if (!editingAgent) return;

    setUpdating(true);
    try {
      const res = await api.updateAgentLevel(editingAgent._id, {
        agentLevel: selectedLevel,
        customCashbackPercent: Number(customCashback)
      });
      if (res?.success) {
        setActionSuccess(res.message || `Level updated for ${editingAgent.name}!`);
        setEditModalOpen(false);
        fetchLevels();
        setTimeout(() => setActionSuccess(''), 3000);
      } else {
        alert(res?.error || 'Failed to update level');
      }
    } catch (err) {
      alert(err.message || 'Error saving level update');
    } finally {
      setUpdating(false);
    }
  };

  const companyLevel = data?.companyLevel || {
    tier: 'GOLD_PARTNER',
    badge: 'Gold Fleet Partner',
    companyCode: 1,
    activeFleetCount: 4,
    totalAgentsCount: 8,
    onTimeDepartureRating: '98.4%',
    safetyScore: '4.9/5',
    carrierDiscountRate: '1.2% Platform Waiver',
    perks: [
      'Direct Corridor Slot Dispatch Privileges',
      'Instant Settlement Payout Approvals',
      'Free Multi-Axle Fleet Tracking Integration',
      'Zero Surcharge on Razorpay Gateway Collections'
    ]
  };

  const tierDefinitions = data?.tierDefinitions || [
    {
      id: 'BRONZE',
      name: 'Bronze Starter Counter',
      minBookings: 0,
      commissionPercent: 3.0,
      creditLimit: 15000,
      color: 'amber',
      badge: 'Entry Counter',
      perks: ['Standard Corridor Access', 'Manual Topup Support', 'Standard Reports']
    },
    {
      id: 'SILVER',
      name: 'Silver Active Franchise',
      minBookings: 50,
      commissionPercent: 5.0,
      creditLimit: 50000,
      color: 'slate',
      badge: 'Franchise Partner',
      perks: ['Priority Seat Locking', '1.0% Downline Referral Override', 'Instant Balance Topup']
    },
    {
      id: 'GOLD',
      name: 'Gold Premier Partner',
      minBookings: 200,
      commissionPercent: 7.0,
      creditLimit: 125000,
      color: 'yellow',
      badge: 'Premier Agent',
      perks: ['Preferential Berth Allocation', '2.0% Downline Override', 'Zero Cancellation Processing Fees']
    },
    {
      id: 'PLATINUM',
      name: 'Platinum Elite Master',
      minBookings: 500,
      commissionPercent: 10.0,
      creditLimit: 250000,
      color: 'purple',
      badge: 'Elite Master',
      perks: ['VIP Support Desk', '3.0% Downline Override', 'Flexible Credit Settlement Terms', 'Dedicated Account Executive']
    }
  ];

  const agents = data?.agents || [];
  const filteredAgents = agents.filter(ag => {
    const matchesSearch = !searchTerm || 
      ag.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ag.agencyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ag.referralCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ag.city?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesLevel = selectedLevelFilter === 'ALL' || ag.agentLevel === selectedLevelFilter;

    return matchesSearch && matchesLevel;
  });

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
              Carrier Governance & Growth
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Performance Tiers & Hierarchy
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor company carrier standing, explore agent performance tiers, and manage commission overrides across your network.
          </p>
        </div>

        <button
          onClick={fetchLevels}
          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer self-start sm:self-auto"
          title="Refresh Levels"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* 1. COMPANY CARRIER TIER CARD */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-white/10 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1 shadow-xs">
                <Star className="w-3.5 h-3.5 fill-current" />
                <span>{companyLevel.badge}</span>
              </span>
              <span className="text-xs font-bold text-blue-200 font-mono">
                Company #{String(companyLevel.companyCode).padStart(2, '0')}
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Rupadiya Premier Fleet Carrier
            </h2>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed">
              Your company maintains verified tier status with {companyLevel.activeFleetCount} active long-haul coaches across high-demand corridors. Enjoy instant withdrawal settlements and priority scheduling slots.
            </p>

            <div className="pt-2 flex flex-wrap gap-2">
              {(companyLevel.perks || []).map((perk, idx) => (
                <div key={idx} className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 backdrop-blur-xs text-[11px] font-semibold text-blue-100 border border-white/15">
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>{perk}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-3 shrink-0">
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Fleet Coaches</span>
              <span className="text-xl font-bold text-white">{companyLevel.activeFleetCount}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">On-Time Score</span>
              <span className="text-xl font-bold text-emerald-300">{companyLevel.onTimeDepartureRating}</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-center">
              <span className="text-[10px] uppercase font-bold text-blue-200 block">Safety Rating</span>
              <span className="text-xl font-bold text-amber-300">{companyLevel.safetyScore}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. AGENT TIER BLUEPRINTS (BRONZE, SILVER, GOLD, PLATINUM) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-blue-600" />
              <span>Franchise Agent Performance Hierarchy</span>
            </h2>
            <p className="text-xs text-slate-500">
              Standardized agent progression levels based on verified booking thresholds and commissions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {tierDefinitions.map((tier) => {
            const countInTier = agents.filter(a => (a.agentLevel || 'SILVER') === tier.id).length;
            const isPlatinum = tier.id === 'PLATINUM';
            const isGold = tier.id === 'GOLD';

            return (
              <div 
                key={tier.id}
                className={`bg-white rounded-2xl border p-5 space-y-4 shadow-xs transition hover:shadow-md ${
                  isPlatinum 
                    ? 'border-purple-200 bg-purple-50/20' 
                    : isGold 
                      ? 'border-amber-200 bg-amber-50/20' 
                      : 'border-slate-200/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                    isPlatinum 
                      ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                      : isGold 
                        ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                        : 'bg-slate-100 text-slate-700'
                  }`}>
                    {tier.badge}
                  </span>
                  <span className="text-xs font-bold text-slate-400">
                    {countInTier} {countInTier === 1 ? 'Agent' : 'Agents'}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-slate-900">{tier.name}</h3>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold text-blue-700">{tier.commissionPercent}%</span>
                    <span className="text-xs text-slate-500 font-medium">Commission Override</span>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Min Monthly Bookings:</span>
                    <strong className="text-slate-900">{tier.minBookings}+</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Float Credit Limit:</span>
                    <strong className="text-slate-900">₹{tier.creditLimit.toLocaleString('en-IN')}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Level Perks</span>
                  {(tier.perks || []).map((p, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-600">
                      <Zap className="w-3 h-3 text-blue-600 shrink-0" />
                      <span className="truncate">{p}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. AGENT ROSTER BY LEVEL */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Agents Tier Directory ({filteredAgents.length})</span>
            </h2>
            <p className="text-xs text-slate-500">Manage agent commission overrides and upgrade counters</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            {/* Filter by Tier */}
            <select
              value={selectedLevelFilter}
              onChange={(e) => setSelectedLevelFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 w-full sm:w-auto"
            >
              <option value="ALL">All Levels ({agents.length})</option>
              <option value="PLATINUM">Platinum Star ({agents.filter(a => a.agentLevel === 'PLATINUM').length})</option>
              <option value="GOLD">Gold Premier ({agents.filter(a => a.agentLevel === 'GOLD').length})</option>
              <option value="SILVER">Silver Active ({agents.filter(a => a.agentLevel === 'SILVER').length})</option>
              <option value="BRONZE">Bronze Starter ({agents.filter(a => a.agentLevel === 'BRONZE').length})</option>
            </select>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search agent or referral code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {filteredAgents.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-300" />
            <p>No agents found matching the selected filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4 rounded-l-xl">Agent & Agency</th>
                  <th className="py-3 px-4">Referral Code</th>
                  <th className="py-3 px-4">City / State</th>
                  <th className="py-3 px-4 text-center">Current Level</th>
                  <th className="py-3 px-4 text-center">Commission %</th>
                  <th className="py-3 px-4 text-center">Monthly Volume</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAgents.map((ag) => {
                  const lvl = ag.agentLevel || 'SILVER';
                  const isPlat = lvl === 'PLATINUM';
                  const isGld = lvl === 'GOLD';

                  return (
                    <tr key={ag._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{ag.name}</div>
                        <div className="text-[11px] text-slate-500">{ag.agencyName || 'Counter Agent'}</div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        {ag.referralCode}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600">
                        {ag.city}, {ag.state}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isPlat 
                            ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                            : isGld 
                              ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                              : 'bg-slate-100 text-slate-700'
                        }`}>
                          {lvl}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-bold text-slate-900">
                        {ag.customCashbackPercent || 5.0}%
                      </td>

                      <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                        {ag.monthlyBookings || 0} tickets
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => openEditModal(ag)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] border border-slate-200 hover:border-blue-200 transition flex items-center gap-1.5 ml-auto cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Change Level</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* EDIT AGENT LEVEL MODAL */}
      {editModalOpen && editingAgent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-7 max-w-md w-full space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Adjust Agent Performance Level</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update tier for {editingAgent.name} ({editingAgent.agencyName})
                </p>
              </div>
              <button 
                onClick={() => setEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLevel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Select Hierarchy Tier</label>
                <div className="grid grid-cols-2 gap-2">
                  {tierDefinitions.map((td) => (
                    <button
                      key={td.id}
                      type="button"
                      onClick={() => handleLevelSelect(td.id)}
                      className={`p-3 rounded-xl border text-left transition ${
                        selectedLevel === td.id
                          ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-500/20'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <div className="font-bold text-xs">{td.name.split(' ')[0]}</div>
                      <div className="text-[11px] text-slate-500">{td.commissionPercent}% Override</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Custom Commission Percentage (%)
                </label>
                <div className="relative">
                  <Percent className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="25"
                    required
                    value={customCashback}
                    onChange={(e) => setCustomCashback(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Agent earns this commission override on every confirmed passenger seat booking.
                </span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updating}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {updating ? (
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>Save Level</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

