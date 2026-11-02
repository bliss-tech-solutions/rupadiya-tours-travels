'use client';

import Link from 'next/link';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Wallet, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';

const ITEMS_PER_PAGE = 10;

export default function AdminGlobalAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [companiesList, setCompaniesList] = useState([]);

  // Create form
  const [formData, setFormData] = useState({
    companyCode: '1',
    name: '',
    email: '',
    phone: '',
    password: 'Password123!',
    agencyName: '',
    initialWalletAmount: '0',
sponsorReferralCode: '',
    aadharNumber: '',
    panNumber: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankUpiId: '',
    bankName: 'State Bank of India'
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Wallet adjust form
  const [adjustAmount, setAdjustAmount] = useState('5000');
  const [adjustType, setAdjustType] = useState('CREDIT'); // 'CREDIT' | 'DEBIT'
  const [adjustNote, setAdjustNote] = useState('Admin balance adjustment');
  const [adjustLoading, setAdjustLoading] = useState(false);

  const fetchAgents = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (companyFilter !== 'ALL') params.companyCode = companyFilter;
      const res = await api.getGlobalAgents(params);
      if (res?.success) {
        setAgents(res.agents || []);
      } else {
        setError(res?.error || 'Failed to fetch global agents');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, [companyFilter]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setActionSuccess('');

    try {
      const res = await api.createAgent({
        ...formData,
        companyCode: Number(formData.companyCode),
sponsorReferralCode: formData.sponsorReferralCode?.trim() || '',
        initialWalletAmount: Number(formData.initialWalletAmount) || 0,
        aadharNumber: formData.aadharNumber?.trim() || '',
        panNumber: formData.panNumber?.trim()?.toUpperCase() || '',
        bankDetails: {
          accountName: formData.bankAccountName || formData.name,
          accountNumber: formData.bankAccountNumber,
          ifscCode: formData.bankIfsc?.toUpperCase() || '',
          upiId: formData.bankUpiId || '',
          bankName: formData.bankName || 'State Bank of India'
        }
      });
      if (res.success) {
        setActionSuccess(res.message || 'Agent created successfully!');
        setFormData({
          companyCode: '1',
          name: '',
          email: '',
          phone: '',
          password: 'Password123!',
          agencyName: '',
          initialWalletAmount: '0',
sponsorReferralCode: '',
          aadharNumber: '',
          panNumber: '',
          bankAccountName: '',
          bankAccountNumber: '',
          bankIfsc: '',
          bankUpiId: '',
          bankName: 'State Bank of India'
        });
        setTimeout(() => {
          setCreateModalOpen(false);
          setActionSuccess('');
          fetchAgents();
        }, 1200);
      } else {
        setError(res.error || 'Failed to create agent');
      }
    } catch (err) {
      setError(err.message || 'Network error creating agent');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdjustWallet = async (e) => {
    e.preventDefault();
    if (!selectedAgent) return;
    const amt = Number(adjustAmount);
    if (!amt || amt <= 0) return;

    setAdjustLoading(true);
    try {
      const res = await api.adjustAgentWallet(selectedAgent._id, {
        amount: amt,
        type: adjustType,
        note: adjustNote
      });
      if (res.success) {
        setActionSuccess(res.message || 'Wallet adjusted successfully!');
        setTimeout(() => {
          setWalletModalOpen(false);
          setSelectedAgent(null);
          setActionSuccess('');
          fetchAgents();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Adjustment failed');
    } finally {
      setAdjustLoading(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgent) return;
    try {
      const res = await api.deleteAgent(selectedAgent._id);
      if (res.success) {
        setActionSuccess(res.message || 'Agent removed.');
        setTimeout(() => {
          setDeleteModalOpen(false);
          setSelectedAgent(null);
          setActionSuccess('');
          fetchAgents();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete agent');
    }
  };

  const filtered = agents.filter(a => {
    const q = searchTerm.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.phone?.includes(q) ||
      a.referralCode?.toLowerCase().includes(q) ||
      a.agencyName?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, companyFilter]);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Master Agency Directory</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Global Agents Management</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Search, inspect, fund, and govern all agents across all 33 franchise companies.
          </p>
        </div>

        <button
          onClick={() => {
            setError('');
            setActionSuccess('');
            setCreateModalOpen(true);
          }}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Create Agent</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/60 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Agents ({filtered.length})
            </h2>

            {/* Filter by Company */}
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/90 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
            >
              <option value="ALL">All 33 Companies</option>
              {Array.from({ length: 33 }).map((_, i) => (
                <option key={i + 1} value={i + 1}>Company Code #{String(i + 1).padStart(2, '0')}</option>
              ))}
            </select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, phone, code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs">Loading agents...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-2">
            <Users className="w-8 h-8 mx-auto text-slate-400" />
            <p>No agents found for this filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/90 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Agent Name & Agency</th>
                  <th className="py-3 px-4">Agent Code</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Phone & Email</th>
                  <th className="py-3 px-4 text-right">Wallet Balance</th>
                  <th className="py-3 px-4 text-center">KYC</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((ag) => (
                  <tr key={ag._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm">{ag.name}</div>
                      <div className="text-[11px] text-slate-500">{ag.agencyName || 'Agency Counter'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {ag.referralCode || 'AGT-N/A'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                        Code #{String(ag.companyCode || 1).padStart(2, '0')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div>{ag.phone}</div>
                      <div className="text-[10px] text-slate-500">{ag.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-sm">
                      ₹{Number(ag.availableBalance || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ag.kycStatus === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {ag.kycStatus || 'NOT_SUBMITTED'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ag.isActive !== false
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {ag.isActive !== false ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/agents/${ag._id || ag.id}`}
                          className="px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 flex items-center gap-1 transition"
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>View Profile</span>
                        </Link>
                        <button
                          onClick={() => {
                            setSelectedAgent(ag);
                            setAdjustAmount('5000');
                            setAdjustType('CREDIT');
                            setWalletModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 flex items-center gap-1 cursor-pointer"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>Adjust</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedAgent(ag);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg bg-rose-50 border border-rose-200/60 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30"
                          title="Remove Agent"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 10-Item Pagination */}
        {filtered.length > 0 && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{filtered.length}</strong> agents
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl font-bold transition ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE AGENT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200/90 w-full max-w-lg rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-200/90 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-700" />
                  <span>Super Admin Create Agent</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Allocate an agent to any of the 33 franchise companies with initial wallet balance.
                </p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-500 hover:text-slate-900 text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Select Franchise Company *</label>
                <select
                  required
                  value={formData.companyCode}
                  onChange={(e) => setFormData({ ...formData, companyCode: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
                >
                  {companiesList.length > 0 ? (
                    companiesList.map(c => (
                      <option key={c.companyCode} value={c.companyCode}>
                        Code #{String(c.companyCode).padStart(2, '0')} - {c.name}
                      </option>
                    ))
                  ) : (
                    Array.from({ length: 33 }).map((_, i) => (
                      <option key={i + 1} value={i + 1}>Company Code #{String(i + 1).padStart(2, '0')}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Agent Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Anand Varma"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Agency Name</label>
                  <input
                    type="text"
                    placeholder="e.g. City Travel Desk"
                    value={formData.agencyName}
                    onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Email ID (Login Username) *</label>
                  <input
                    type="email"
                    required
                    placeholder="agent@rupadiya.test"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Password *</label>
                <input
                  type="text"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-900 font-mono"
                />
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-2">
                <label className="text-blue-900 font-bold block">
                  Opening Wallet Allocation (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  required
                  value={formData.initialWalletAmount}
                  onChange={(e) => setFormData({ ...formData, initialWalletAmount: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200/90 text-emerald-700 font-black text-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {submitting ? 'Creating...' : 'Create Agent & Grant Balance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST WALLET MODAL */}
      {walletModalOpen && selectedAgent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200/90 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200/90 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-700" />
                  <span>Adjust Agent Wallet</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {selectedAgent.name} (Current: ₹{Number(selectedAgent.availableBalance || 0).toLocaleString('en-IN')})
                </p>
              </div>
              <button onClick={() => setWalletModalOpen(false)} className="text-slate-500 hover:text-slate-900 text-sm">✕</button>
            </div>

            <form onSubmit={handleAdjustWallet} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Adjustment Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('CREDIT')}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      adjustType === 'CREDIT' ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    + Credit Funds
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('DEBIT')}
                    className={`py-2 rounded-xl font-bold border transition cursor-pointer ${
                      adjustType === 'DEBIT' ? 'bg-rose-600 text-white border-rose-600 shadow-xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    - Debit Funds
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Amount (₹)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200/90 text-slate-900 font-bold text-lg focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Audit Reason</label>
                <input
                  type="text"
                  required
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200/90 text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setWalletModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustLoading}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-white disabled:opacity-50 cursor-pointer shadow-md ${
                    adjustType === 'CREDIT' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/20'
                  }`}
                >
                  {adjustLoading ? 'Executing...' : `Apply ${adjustType}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / DEACTIVATE MODAL */}
      {deleteModalOpen && selectedAgent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200/90 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Agent</h3>
                <p className="text-xs text-slate-500">{selectedAgent.name} (Code #{selectedAgent.companyCode})</p>
              </div>
            </div>

            <p className="text-xs text-slate-700">
              Are you sure? If the agent has passenger bookings on record, they will be deactivated to preserve financial auditability.
            </p>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAgent}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-md shadow-rose-500/20"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

