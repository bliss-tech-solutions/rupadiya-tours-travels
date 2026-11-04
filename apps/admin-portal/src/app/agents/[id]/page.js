'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, 
  ArrowLeft, 
  Wallet, 
  ShieldCheck, 
  FileText, 
  Clock, 
  Calendar, 
  Phone, 
  Mail, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  Eye, 
  Plus, 
  Minus,
  Check,
  X,
  Lock,
  Unlock,
  Ticket
} from 'lucide-react';
import { api } from '../../../lib/api';
import DocumentViewerModal from '../../../components/DocumentViewerModal';

export default function AdminAgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Wallet adjustment modal
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('5000');
  const [adjustType, setAdjustType] = useState('CREDIT'); // 'CREDIT' | 'DEBIT'
  const [adjustNote, setAdjustNote] = useState('Admin balance adjustment');
  const [walletLoading, setWalletLoading] = useState(false);

  // Document Viewer Modal
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docModalOpen, setDocModalOpen] = useState(false);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [docToReject, setDocToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('Document unreadable or invalid credentials');
  const [actionLoading, setActionLoading] = useState(false);

  const [actionSuccess, setActionSuccess] = useState('');

  const fetchAgentDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getAgentById(id);
      if (res?.success) {
        setAgentData(res);
      } else {
        setError(res?.error || 'Failed to load agent details');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentDetails();
  }, [id]);

  const handleWalletAdjust = async (e) => {
    e.preventDefault();
    const amount = Number(adjustAmount);
    if (!amount || amount <= 0) return;
    setWalletLoading(true);
    try {
      const res = await api.adjustAgentWallet(id, {
        amount,
        type: adjustType,
        note: adjustNote.trim()
      });
      if (res.success) {
        setActionSuccess(`Wallet successfully ${adjustType === 'CREDIT' ? 'credited' : 'debited'} by ₹${amount.toLocaleString('en-IN')}`);
        setTimeout(() => {
          setWalletModalOpen(false);
          setActionSuccess('');
          fetchAgentDetails();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to adjust wallet balance');
    } finally {
      setWalletLoading(false);
    }
  };

  const handleKycApprove = async (docId) => {
    if (!confirm('Are you sure you want to approve this KYC document and verify the agent?')) return;
    setActionLoading(true);
    try {
      const res = await api.approveKyc(docId, 'VERIFIED');
      if (res.success) {
        setDocModalOpen(false);
        fetchAgentDetails();
      }
    } catch (err) {
      alert(err.message || 'Failed to approve KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const handleKycRejectSubmit = async (e) => {
    e.preventDefault();
    if (!docToReject) return;
    setActionLoading(true);
    try {
      const res = await api.approveKyc(docToReject._id, 'REJECTED', rejectReason.trim());
      if (res.success) {
        setRejectModalOpen(false);
        setDocModalOpen(false);
        setDocToReject(null);
        fetchAgentDetails();
      }
    } catch (err) {
      alert(err.message || 'Failed to reject KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!agentData?.agent) return;
    const newStatus = !agentData.agent.isActive;
    const confirmMsg = newStatus 
      ? 'Re-activate this agent account?' 
      : 'Suspend this agent? They will no longer be able to log in or issue tickets.';
    if (!confirm(confirmMsg)) return;

    try {
      const res = await api.toggleAgentStatus(id, newStatus);
      if (res.success) {
        fetchAgentDetails();
      }
    } catch (err) {
      alert(err.message || 'Failed to update agent status');
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Loading Agent Profile...
        </p>
      </div>
    );
  }

  if (error || !agentData) {
    return (
      <div className="w-full space-y-4">
        <Link 
          href="/agents"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Global Agents</span>
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span className="text-sm font-bold">Agent Not Found</span>
          </div>
          <p>{error || 'The requested agent could not be found.'}</p>
        </div>
      </div>
    );
  }

  const { agent, wallet, ledger = [], kycDocuments = [], bookings = [], company, stats = {} } = agentData;

  return (
    <div className="w-full space-y-6">
      {/* Back button */}
      <div>
        <Link 
          href="/agents"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Global Agents</span>
        </Link>
      </div>

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-700 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-sky-600/20 shrink-0">
            {agent.name ? agent.name[0].toUpperCase() : 'A'}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {agent.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                agent.isActive
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {agent.isActive ? 'Active Account' : 'Suspended'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                agent.kycStatus === 'VERIFIED'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                KYC: {agent.kycStatus || 'PENDING'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Agency: <span className="font-bold text-slate-800">{agent.agencyName || 'Counter Agency'}</span> · Company: <span className="font-bold text-blue-700">{company?.name || `Company #${agent.companyCode}`}</span> · Referral Code: <span className="font-mono font-bold text-blue-700">{agent.referralCode || 'N/A'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <button
            onClick={handleToggleStatus}
            className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
              agent.isActive
                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {agent.isActive ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{agent.isActive ? 'Suspend Agent' : 'Activate Agent'}</span>
          </button>

          <button
            onClick={() => setWalletModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/20"
          >
            <Wallet className="w-4 h-4" />
            <span>Adjust Wallet</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Available Wallet</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{Number(wallet.availableBalance || 0).toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-500">Live booking balance</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Tickets Issued</span>
            <Ticket className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalTickets || bookings.length} Bookings</div>
          <p className="text-[11px] text-slate-500">Confirmed passenger seats</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Cumulative Volume</span>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{Number(stats.totalGMV || 0).toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-emerald-600 font-bold">Gross revenue generated</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Franchise Code</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">#{String(agent.companyCode).padStart(2, '0')}</div>
          <p className="text-[11px] text-slate-500">{company?.name || 'Assigned Franchise'}</p>
        </div>
      </div>

      {/* KYC Documents Section */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Government Identity & KYC Credentials
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {kycDocuments.length} document(s) on file
          </span>
        </div>

        {kycDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kycDocuments.map((doc) => (
              <div 
                key={doc._id}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {doc.documentType === 'NEPAL_CITIZENSHIP' ? 'Nepali Nagarikta (Citizenship)' : doc.documentType}
                    </span>
                    <div className="text-sm font-mono font-bold text-slate-900 pt-1">
                      ID: {doc.documentNumberMasked}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Submitted: {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                    </p>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    doc.status === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : doc.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {doc.status}
                  </span>
                </div>

                {doc.rejectionReason && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                    <span className="font-bold">Rejection Note:</span> {doc.rejectionReason}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoc(doc);
                      setDocModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-blue-700 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Document</span>
                  </button>

                  {doc.status === 'PENDING' && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setDocToReject(doc);
                          setRejectModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-xs transition cursor-pointer"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => handleKycApprove(doc._id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                      >
                        Approve
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No KYC documents submitted by this agent yet.</p>
          </div>
        )}
      </div>

      {/* Wallet Ledger & Transaction History */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Wallet Transaction Ledger (Last 30 Records)
            </h3>
          </div>
          <button
            onClick={() => setWalletModalOpen(true)}
            className="text-xs font-bold text-blue-700 hover:underline"
          >
            + Adjust Balance
          </button>
        </div>

        {ledger.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 text-slate-500 font-mono">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'Recent'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.entryType === 'CREDIT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {item.entryType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {item.description || item.transactionType || 'Transaction'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-bold ${
                      item.entryType === 'CREDIT' ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {item.entryType === 'CREDIT' ? '+' : '-'}₹{Number(item.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(item.balanceAfter || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No ledger transactions recorded yet.</p>
          </div>
        )}
      </div>

      {/* Bookings Issued Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Customer Tickets Issued ({bookings.length} Recent)
            </h3>
          </div>
        </div>

        {bookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">PNR</th>
                  <th className="py-2.5 px-3">Passenger</th>
                  <th className="py-2.5 px-3">Seats</th>
                  <th className="py-2.5 px-3 text-right">Fare Paid</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{b.pnr}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {b.passengerDetails?.[0]?.name || b.primaryPassengerName || 'Passenger'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {Array.isArray(b.seatNumbers) ? b.seatNumbers.join(', ') : '1 Seat'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      ₹{Number(b.fareBreakdown?.totalPayable || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Ticket className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No customer ticket bookings issued by this agent yet.</p>
          </div>
        )}
      </div>

      {/* Adjust Wallet Modal */}
      {walletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Adjust Agent Working Capital
              </h3>
              <button 
                onClick={() => setWalletModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            {actionSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{actionSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleWalletAdjust} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Adjustment Type</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustType('CREDIT')}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        adjustType === 'CREDIT'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      Credit (+ Add Funds)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustType('DEBIT')}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                        adjustType === 'DEBIT'
                          ? 'bg-rose-50 border-rose-500 text-rose-800'
                          : 'bg-slate-50 border-slate-200 text-slate-600'
                      }`}
                    >
                      Debit (- Deduct Funds)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Audit Note *</label>
                  <input
                    type="text"
                    required
                    value={adjustNote}
                    onChange={(e) => setAdjustNote(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setWalletModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={walletLoading}
                    className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition"
                  >
                    {walletLoading ? 'Processing...' : 'Confirm Adjustment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* KYC Rejection Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wider">
              Reject KYC Document
            </h3>
            <p className="text-xs text-slate-600">
              Provide a clear reason so the agent can re-upload valid government credentials.
            </p>
            <form onSubmit={handleKycRejectSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Document Viewer Modal */}
      {selectedDoc && (
        <DocumentViewerModal
          isOpen={docModalOpen}
          onClose={() => setDocModalOpen(false)}
          documentType={selectedDoc.documentType}
          documentNumber={selectedDoc.documentNumberMasked}
          status={selectedDoc.status}
          fileUrl={selectedDoc.fileUrl}
          fileUrlBack={selectedDoc.fileUrlBack}
          onApprove={() => handleKycApprove(selectedDoc._id)}
          onReject={() => {
            setDocToReject(selectedDoc);
            setRejectModalOpen(true);
          }}
        />
      )}

    </div>
  );
}

