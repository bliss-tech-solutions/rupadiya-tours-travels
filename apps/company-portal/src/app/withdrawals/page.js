'use client';

import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCw, 
  AlertCircle, 
  Building2, 
  Wallet, 
  ArrowRight, 
  ShieldCheck, 
  Search,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { api } from '../../lib/api';
import ConfirmationModal from '../../components/ConfirmationModal';

const ITEMS_PER_PAGE = 10;

export default function CompanyWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [approveModalData, setApproveModalData] = useState(null);

  // Reject modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState(null);
  const [rejectReason, setRejectReason] = useState('Account name mismatch or pending KYC review');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchWithdrawals = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getWithdrawals();
      if (res?.success) {
        setWithdrawals(res.withdrawals || []);
      } else {
        setError(res?.error || 'Failed to fetch withdrawal queue');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to payout service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, []);

  const handleOpenApproveModal = (w) => {
    setApproveModalData(w);
  };

  const handleExecuteApprove = async () => {
    if (!approveModalData) return;
    setActionLoading(true);
    setActionSuccess('');
    try {
      const res = await api.approveWithdrawal(approveModalData._id);
      if (res.success) {
        setActionSuccess(`Withdrawal of ₹${Number(approveModalData.amount).toLocaleString('en-IN')} successfully approved and settled.`);
        setApproveModalData(null);
        setTimeout(() => {
          setActionSuccess('');
          fetchWithdrawals();
        }, 1200);
      } else {
        alert(res?.error || 'Approval failed');
      }
    } catch (err) {
      alert(err.message || 'Approval failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!selectedReq) return;

    setActionLoading(true);
    try {
      const res = await api.rejectWithdrawal(selectedReq._id, rejectReason);
      if (res.success) {
        setActionSuccess(`Withdrawal request rejected. Held funds refunded back to agent.`);
        setTimeout(() => {
          setRejectModalOpen(false);
          setSelectedReq(null);
          setActionSuccess('');
          fetchWithdrawals();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Rejection failed');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = withdrawals.filter(w => {
    const q = searchTerm.toLowerCase();
    const agent = w.agentId || {};
    const matchesSearch = (
      agent.name?.toLowerCase().includes(q) ||
      agent.referralCode?.toLowerCase().includes(q) ||
      agent.phone?.includes(q) ||
      w._id?.includes(q)
    );
    const matchesStatus = statusFilter === 'ALL' || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filtered.length);
  const paginated = filtered.slice(startIndex, endIndex);

  const pendingCount = withdrawals.filter(w => w.status === 'PENDING').length;
  const approvedSum = withdrawals.filter(w => w.status === 'APPROVED').reduce((sum, w) => sum + w.amount, 0);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-200">
            <CreditCard className="w-3.5 h-3.5" />
            <span>Franchise Payout Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Agent Withdrawal Requests</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Maker-Checker workflow: Review and settle payout requests submitted by authorized franchise agents.
          </p>
        </div>

        <button
          onClick={fetchWithdrawals}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 self-start sm:self-auto shadow-xs transition cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Queue</span>
        </button>
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

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Pending Review</span>
          <div className="text-2xl font-bold text-amber-600">{pendingCount} Requests</div>
          <span className="text-[11px] text-slate-500 block">Requires franchise owner approval</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Settled Payouts</span>
          <div className="text-2xl font-bold text-emerald-600">₹{approvedSum.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-slate-500 block">Total paid out to franchise agents</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Security Standard</span>
          <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Maker-Checker Compliant</span>
          </div>
          <span className="text-[11px] text-slate-500 block">Withdrawals require verified KYC</span>
        </div>
      </div>

      {/* Queue Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(st => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  statusFilter === st
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search agent or ref..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-medium">Loading requests...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs space-y-2">
            <CreditCard className="w-8 h-8 mx-auto text-slate-300" />
            <p>No withdrawal requests found for selected filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4 rounded-l-xl">Request Date</th>
                  <th className="py-3 px-4">Agent Name & Code</th>
                  <th className="py-3 px-4">Destination Method</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((w) => {
                  const agent = w.agentId || {};
                  const bank = w.payoutDetails || agent.bankDetails || {};
                  const isUpi = (w.payoutDetails?.method || w.method || '').toLowerCase() === 'upi';
                  return (
                    <tr key={w._id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {new Date(w.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{agent.name || 'Agent'}</div>
                        <div className="font-mono text-[10px] text-blue-700">{agent.referralCode || 'AGT-N/A'} · {agent.phone}</div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600">
                        <div className="font-semibold text-slate-800">
                          {isUpi ? 'UPI Payout' : 'Bank Transfer (IMPS)'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {isUpi
                            ? (bank.upiId || 'Direct UPI')
                            : `${bank.bankName || 'Bank'} · A/C: ${bank.accountNumberMasked || '****'}`}
                        </div>
                        {bank.ifscCode && (
                          <div className="text-[10px] font-mono text-slate-400">
                            IFSC: {bank.ifscCode}
                          </div>
                        )}
                        {w.utrNumber && (
                          <div className="text-[10px] font-mono text-emerald-700 font-bold">
                            UTR: {w.utrNumber}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-slate-900 text-sm">
                        ₹{Number(w.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          w.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : w.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                        }`}>
                          {w.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {w.status === 'PENDING' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={actionLoading}
                              onClick={() => handleOpenApproveModal(w)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition cursor-pointer"
                            >
                              Approve
                            </button>
                            <button
                              disabled={actionLoading}
                              onClick={() => {
                                setSelectedReq(w);
                                setRejectModalOpen(true);
                              }}
                              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] transition cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            {w.status === 'APPROVED' ? 'Settled' : 'Refunded to Agent'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-800">{filtered.length}</span> requests
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

      {/* REJECT MODAL */}
      {rejectModalOpen && selectedReq && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200/80 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-rose-600" />
                  <span>Reject Withdrawal Request</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Amount: ₹{Number(selectedReq.amount).toLocaleString('en-IN')} · Held funds will be refunded back to agent.
                </p>
              </div>
              <button onClick={() => setRejectModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRejectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1.5">Rejection Reason *</label>
                <textarea
                  rows={3}
                  required
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50 shadow-md shadow-rose-600/20 transition cursor-pointer"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Reject & Refund'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Approve Payout Confirmation Modal */}
      {approveModalData && (
        <ConfirmationModal
          isOpen={Boolean(approveModalData)}
          onClose={() => !actionLoading && setApproveModalData(null)}
          onConfirm={handleExecuteApprove}
          variant="success"
          icon={CheckCircle2}
          title={`Settle Payout of ₹${Number(approveModalData.amount).toLocaleString('en-IN')}`}
          message="Confirm approval and disbursement of this agent withdrawal request. The payout will be settled and ledger status finalized."
          confirmText={`Approve & Settle ₹${Number(approveModalData.amount).toLocaleString('en-IN')}`}
          cancelText="Cancel"
          loading={actionLoading}
          details={[
            { label: 'Agent Name', value: approveModalData.agentId?.name || approveModalData.userId?.name || 'Agent', highlight: true },
            { label: 'Agency Reference', value: approveModalData.agentId?.agencyName || approveModalData.agentId?.referralCode || 'Direct Agent' },
            { label: 'Settlement Amount', value: `₹${Number(approveModalData.amount).toLocaleString('en-IN')}`, variant: 'success', highlight: true },
            { label: 'Beneficiary Bank', value: approveModalData.payoutDetails?.bankName || approveModalData.bankDetails?.bankName || approveModalData.agentId?.bankDetails?.bankName || 'Direct Payout' },
            { label: 'Account / UPI', value: approveModalData.payoutDetails?.accountNumberMasked || approveModalData.payoutDetails?.upiId || approveModalData.bankDetails?.accountNumber || approveModalData.bankDetails?.upiId || 'On Record' }
          ]}
        />
      )}
    </div>
  );
}
