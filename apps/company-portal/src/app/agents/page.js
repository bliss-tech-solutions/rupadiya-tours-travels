'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Users, 
  Phone, 
  Mail, 
  Wallet, 
  Plus, 
  Search, 
  Trash2, 
  ShieldCheck, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  ExternalLink,
  X
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, formatDateTime } from '../../lib/dateUtils';
import FileUploadProgress from '../../components/FileUploadProgress';

const ITEMS_PER_PAGE = 10;

export default function CompanyAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [kycPreviewModalOpen, setKycPreviewModalOpen] = useState(false);
  const [previewAgent, setPreviewAgent] = useState(null);

  // Create form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'Password123!',
    agencyName: '',
    initialWalletAmount: '10000',
    address: '',
    city: 'Rupadiya',
    state: 'Uttar Pradesh',
    nationality: 'INDIA', // 'INDIA' | 'NEPAL'
    aadharNumber: '',
    aadharFileUrl: '',
    panNumber: '',
    panFileUrl: '',
    nepalIdNumber: '',
    nepalIdFileUrl: '',
    nepalIdFileUrlBack: '',
    bankAccountName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    bankUpiId: '',
    bankName: 'State Bank of India'
  });
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Topup form state
  const [topupAmount, setTopupAmount] = useState('5000');
  const [topupNote, setTopupNote] = useState('Counter balance replenishment');
  const [topupSubmitting, setTopupSubmitting] = useState(false);

  const fetchAgents = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getAgents();
      if (res?.success) {
        setAgents(res.agents || []);
      } else {
        setError(res?.error || 'Failed to fetch franchise agents');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to agency database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreateAgent = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setActionSuccess('');

    try {
      const payload = {
        ...formData,
        initialWalletAmount: Number(formData.initialWalletAmount) || 0,
        nationality: formData.nationality,
        aadharNumber: formData.aadharNumber?.trim() || '',
        aadharFileUrl: formData.aadharFileUrl || null,
        panNumber: formData.panNumber?.trim()?.toUpperCase() || '',
        panFileUrl: formData.panFileUrl || null,
        nepalIdNumber: formData.nepalIdNumber?.trim() || '',
        nepalIdFileUrl: formData.nepalIdFileUrl || null,
        nepalIdFileUrlBack: formData.nepalIdFileUrlBack || null,
        bankDetails: {
          accountName: formData.bankAccountName || formData.name,
          accountNumber: formData.bankAccountNumber,
          ifscCode: formData.bankIfsc?.toUpperCase() || '',
          upiId: formData.bankUpiId || '',
          bankName: formData.bankName || 'State Bank of India'
        }
      };
      const res = await api.createAgent(payload);
      if (res.success) {
        setActionSuccess(res.message || 'Agent created successfully!');
        setFormData({
          name: '',
          email: '',
          phone: '',
          password: 'Password123!',
          agencyName: '',
          initialWalletAmount: '10000',
          address: '',
          city: 'Rupadiya',
          state: 'Uttar Pradesh',
          nationality: 'INDIA',
          aadharNumber: '',
          aadharFileUrl: '',
          panNumber: '',
          panFileUrl: '',
          nepalIdNumber: '',
          nepalIdFileUrl: '',
          nepalIdFileUrlBack: '',
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

  const handleTopupSubmit = async (e) => {
    e.preventDefault();
    if (!selectedAgent) return;
    const amt = Number(topupAmount);
    if (!amt || amt <= 0) return;

    setTopupSubmitting(true);
    try {
      const res = await api.addAgentWallet(selectedAgent._id, amt, topupNote);
      if (res.success) {
        setActionSuccess(`₹${amt.toLocaleString('en-IN')} added to ${selectedAgent.name}'s wallet!`);
        setTimeout(() => {
          setTopupModalOpen(false);
          setSelectedAgent(null);
          setActionSuccess('');
          fetchAgents();
        }, 1000);
      }
    } catch (err) {
      alert(err.message || 'Top-up failed');
    } finally {
      setTopupSubmitting(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgent) return;
    try {
      const res = await api.deleteAgent(selectedAgent._id);
      if (res.success) {
        setActionSuccess(res.message || 'Agent deleted/deactivated.');
        setTimeout(() => {
          setDeleteModalOpen(false);
          setSelectedAgent(null);
          setActionSuccess('');
          fetchAgents();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Delete operation failed');
    }
  };

  const handleToggleStatus = async (agent) => {
    const newStatus = !agent.isActive;
    try {
      await api.toggleAgentStatus(agent._id, newStatus);
      fetchAgents();
    } catch (err) {
      alert(err.message || 'Failed to toggle status');
    }
  };

  const filteredAgents = agents.filter(a => {
    const q = searchTerm.toLowerCase();
    return (
      a.name?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.phone?.includes(q) ||
      a.referralCode?.toLowerCase().includes(q) ||
      a.agencyName?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredAgents.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredAgents.length);
  const paginatedAgents = filteredAgents.slice(startIndex, endIndex);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-100">
            <Users className="w-3.5 h-3.5" />
            <span>Franchise Agency Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Authorized Agent Counters</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Create, fund, manage, and monitor booking counters and affiliates under your company franchise.
          </p>
        </div>

        <Link
          href="/agents/add"
          className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Add New Agent</span>
        </Link>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Agents Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Franchise Agents ({filteredAgents.length})
            </h2>
            <p className="text-xs text-slate-500">Live directory of authorized counters and wallet allocations</p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, phone, code..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-medium">Loading authorized agents...</span>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-3">
            <Users className="w-8 h-8 mx-auto text-slate-400" />
            <p>No agents found matching your query.</p>
            <Link
              href="/agents/add"
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs"
            >
              + Create First Agent
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4 rounded-l-xl">Agent & Agency</th>
                  <th className="py-3 px-4">Agent Code</th>
                  <th className="py-3 px-4">Contact Details</th>
                  <th className="py-3 px-4 text-right">Wallet Balance</th>
                  <th className="py-3 px-4 text-center">KYC Status</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedAgents.map((ag) => (
                  <tr key={ag._id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{ag.name}</span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-700">
                          {ag.nationality === 'NEPAL' ? '🇳🇵 Nepal' : '🇮🇳 India'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        <span>{ag.agencyName || 'Agency Counter'}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      {ag.referralCode || 'AGT-N/A'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium text-slate-800">{ag.phone}</div>
                      <div className="text-[11px] text-slate-400">{ag.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-emerald-600 text-sm">
                      ₹{Number(ag.availableBalance || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        ag.kycStatus === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {ag.kycStatus || 'NOT_SUBMITTED'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleStatus(ag)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                          ag.isActive !== false
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                            : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                        }`}
                        title="Click to toggle Active / Suspended"
                      >
                        {ag.isActive !== false ? '● Active' : '✕ Suspended'}
                      </button>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setPreviewAgent(ag);
                            setKycPreviewModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 flex items-center gap-1 transition cursor-pointer"
                          title="Inspect KYC Documents"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>KYC Docs</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedAgent(ag);
                            setTopupAmount('5000');
                            setTopupModalOpen(true);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 flex items-center gap-1 transition cursor-pointer"
                        >
                          <Wallet className="w-3.5 h-3.5" />
                          <span>+ Add Wallet</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedAgent(ag);
                            setDeleteModalOpen(true);
                          }}
                          className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition cursor-pointer"
                          title="Delete / Deactivate Agent"
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

        {/* Pagination Controls */}
        {filteredAgents.length > ITEMS_PER_PAGE && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-800">{filteredAgents.length}</span> agents
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl font-bold transition ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE AGENT MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200/80 w-full max-w-lg rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span>Create Authorized Agent</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  The agent will be able to log in to the Agent Terminal and issue tickets immediately.
                </p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {actionSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
                <span>{actionSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleCreateAgent} className="space-y-4 text-xs">
                {error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">Agent Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div>
                    <label className="text-slate-700 font-bold block mb-1">Agency / Counter Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rupadiya Border Desk"
                      value={formData.agencyName}
                      onChange={(e) => setFormData({ ...formData, agencyName: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Initial Password *</label>
                  <input
                    type="text"
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
                  />
                </div>

                {/* Statutory KYC Details Section with India & Nepal Dual-Country Support */}
                <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-amber-700" />
                      Statutory KYC Verification (Mandatory for Agency Compliance)
                    </span>
                    <span className="text-[10px] font-bold bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded-full">
                      Section 4.3
                    </span>
                  </div>

                  {/* Nationality Toggle */}
                  <div>
                    <label className="text-[11px] font-bold text-amber-950 block mb-1.5">
                      Agent Nationality / Jurisdiction *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, nationality: 'INDIA' })}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                          formData.nationality === 'INDIA'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        <span>🇮🇳 Indian Resident Agent</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, nationality: 'NEPAL' })}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                          formData.nationality === 'NEPAL'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-50'
                        }`}
                      >
                        <span>🇳🇵 Nepal Border Agent</span>
                      </button>
                    </div>
                  </div>

                  {/* Indian KYC Fields */}
                  {formData.nationality === 'INDIA' ? (
                    <div className="space-y-3 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-amber-950 block mb-1">
                            Aadhaar Card Number (12 Digits) *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={12}
                            placeholder="12-digit Aadhaar number"
                            value={formData.aadharNumber}
                            onChange={(e) => setFormData({ ...formData, aadharNumber: e.target.value.replace(/\D/g, '') })}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-amber-500 font-bold"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-amber-950 block mb-1">
                            PAN Card Number (10 Chars) *
                          </label>
                          <input
                            type="text"
                            required
                            maxLength={10}
                            placeholder="ABCDE1234F"
                            value={formData.panNumber}
                            onChange={(e) => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })}
                            className="w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-slate-900 font-mono text-xs uppercase focus:outline-none focus:border-amber-500 font-bold"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <FileUploadProgress
                          label="Aadhaar Card Document"
                          folder="kyc-documents"
                          fileUrl={formData.aadharFileUrl}
                          onUploadComplete={(url) => setFormData({ ...formData, aadharFileUrl: url })}
                          onRemove={() => setFormData({ ...formData, aadharFileUrl: '' })}
                        />
                        <FileUploadProgress
                          label="PAN Card Document"
                          folder="kyc-documents"
                          fileUrl={formData.panFileUrl}
                          onUploadComplete={(url) => setFormData({ ...formData, panFileUrl: url })}
                          onRemove={() => setFormData({ ...formData, panFileUrl: '' })}
                        />
                      </div>
                    </div>
                  ) : (
                    /* Nepal KYC Fields */
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="text-[11px] font-bold text-amber-950 block mb-1">
                          Nepal National ID / Nagarikta (Citizenship) Number *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 05-01-78-01928"
                          value={formData.nepalIdNumber}
                          onChange={(e) => setFormData({ ...formData, nepalIdNumber: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-amber-200 text-slate-900 font-mono text-xs focus:outline-none focus:border-amber-500 font-bold"
                        />
                        <span className="text-[10px] text-amber-900/70 mt-0.5 block">
                          Official citizenship number issued by District Administration Office
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <FileUploadProgress
                          label="Citizenship Front Document"
                          folder="kyc-documents"
                          fileUrl={formData.nepalIdFileUrl}
                          onUploadComplete={(url) => setFormData({ ...formData, nepalIdFileUrl: url })}
                          onRemove={() => setFormData({ ...formData, nepalIdFileUrl: '' })}
                        />
                        <FileUploadProgress
                          label="Citizenship Back Document"
                          folder="kyc-documents"
                          fileUrl={formData.nepalIdFileUrlBack}
                          onUploadComplete={(url) => setFormData({ ...formData, nepalIdFileUrlBack: url })}
                          onRemove={() => setFormData({ ...formData, nepalIdFileUrlBack: '' })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Settlement Bank Account Details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                    Commission Payout & Settlement Bank Account
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Bank Name</label>
                      <input
                        type="text"
                        placeholder="e.g. State Bank of India, HDFC"
                        value={formData.bankName}
                        onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">Account Number</label>
                      <input
                        type="text"
                        placeholder="Bank account number"
                        value={formData.bankAccountNumber}
                        onChange={(e) => setFormData({ ...formData, bankAccountNumber: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">IFSC Code</label>
                      <input
                        type="text"
                        maxLength={11}
                        placeholder="SBIN0002145"
                        value={formData.bankIfsc}
                        onChange={(e) => setFormData({ ...formData, bankIfsc: e.target.value.toUpperCase() })}
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-mono uppercase text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 block mb-1">UPI ID for instant settlement</label>
                      <input
                        type="text"
                        placeholder="user@okhdfcbank"
                        value={formData.bankUpiId}
                        onChange={(e) => setFormData({ ...formData, bankUpiId: e.target.value })}
                        className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Initial Wallet Balance Allocation */}
                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-blue-900 font-bold block">
                      Given Opening Wallet Amount (₹) *
                    </label>
                    <span className="text-[10px] text-blue-700 font-semibold bg-blue-100 px-2 py-0.5 rounded-full">Credited upon creation</span>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={formData.initialWalletAmount}
                    onChange={(e) => setFormData({ ...formData, initialWalletAmount: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-blue-300 text-emerald-600 font-bold text-xl focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  />
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {['2000', '5000', '10000', '20000'].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setFormData({ ...formData, initialWalletAmount: preset })}
                        className={`py-1.5 rounded-xl text-[11px] font-bold border transition cursor-pointer ${
                          formData.initialWalletAmount === preset
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        ₹{Number(preset).toLocaleString('en-IN')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-3 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setCreateModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs disabled:opacity-50 shadow-md shadow-blue-500/20 transition cursor-pointer"
                  >
                    {submitting ? 'Creating...' : 'Create & Allocate Funds →'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* TOP-UP AGENT WALLET MODAL */}
      {topupModalOpen && selectedAgent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200/80 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  <span>Add Funds to Agent Wallet</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">{selectedAgent.name} ({selectedAgent.referralCode})</p>
              </div>
              <button onClick={() => setTopupModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTopupSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Amount to Add (₹)</label>
                <input
                  type="number"
                  min="100"
                  step="100"
                  required
                  value={topupAmount}
                  onChange={(e) => setTopupAmount(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-emerald-600 font-bold text-xl focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {['2000', '5000', '10000', '25000'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTopupAmount(p)}
                      className={`py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        topupAmount === p ? 'bg-blue-600 text-white border-blue-600 shadow-xs' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      ₹{Number(p).toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Reason / Reference Note</label>
                <input
                  type="text"
                  value={topupNote}
                  onChange={(e) => setTopupNote(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setTopupModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={topupSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 shadow-md shadow-emerald-600/20 transition cursor-pointer"
                >
                  {topupSubmitting ? 'Crediting...' : `Add ₹${Number(topupAmount || 0).toLocaleString('en-IN')}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE / DEACTIVATE MODAL */}
      {deleteModalOpen && selectedAgent && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200/80 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-2xl bg-rose-50 border border-rose-200">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Agent</h3>
                <p className="text-xs text-slate-500">{selectedAgent.name} ({selectedAgent.referralCode})</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-2">
              <p className="font-semibold text-slate-800">
                Are you sure you want to remove this agent counter?
              </p>
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-relaxed">
                • If the agent has historical passenger bookings, their account will be safely deactivated (login disabled and wallet locked) to preserve audited transaction records.
              </p>
            </div>

            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAgent}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md shadow-rose-600/20 transition cursor-pointer"
              >
                Confirm Removal
              </button>
            </div>
          </div>
        </div>
      )}
      {/* KYC PREVIEW MODAL */}
      {kycPreviewModalOpen && previewAgent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200/90 w-full max-w-xl rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-700">
                      KYC Compliance Dossier
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                      {previewAgent.nationality === 'NEPAL' ? '🇳🇵 Nepal Citizen' : '🇮🇳 Indian Resident'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    {previewAgent.name} ({previewAgent.referralCode})
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setKycPreviewModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* KYC Status Badge */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-600 font-semibold">Verification Audit Status</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                previewAgent.kycStatus === 'VERIFIED'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {previewAgent.kycStatus || 'PENDING'}
              </span>
            </div>

            {/* Document Cards */}
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-900 uppercase block">
                Submitted Identity Documents ({previewAgent.kycDocuments?.length || 0})
              </span>

              {(!previewAgent.kycDocuments || previewAgent.kycDocuments.length === 0) ? (
                <div className="p-6 rounded-2xl bg-slate-50 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                  No scanned document files attached to this agent profile.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {previewAgent.kycDocuments.map((doc, idx) => {
                    const isPdf = doc.fileUrl?.toLowerCase().endsWith('.pdf');
                    return (
                      <div key={idx} className="p-3 rounded-2xl border border-slate-200 bg-white space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-900 truncate">
                            {doc.documentType?.replace(/_/g, ' ')}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            doc.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {doc.status}
                          </span>
                        </div>

                        {doc.documentNumber && (
                          <div className="text-[11px] font-mono font-bold text-blue-700">
                            #{doc.documentNumber}
                          </div>
                        )}

                        {doc.fileUrl ? (
                          <div className="space-y-1.5">
                            {isPdf ? (
                              <div className="h-24 rounded-xl bg-slate-50 flex items-center justify-center text-rose-600 border border-slate-100">
                                <FileText className="w-8 h-8" />
                              </div>
                            ) : (
                              <div className="h-24 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                                <img
                                  src={doc.fileUrl}
                                  alt={doc.documentType}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <a
                              href={doc.fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>View Full Document</span>
                            </a>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">No file image attached</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setKycPreviewModalOpen(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
