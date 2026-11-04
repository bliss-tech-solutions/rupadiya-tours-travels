'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  RotateCcw, 
  Search, 
  Filter, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Building2, 
  ArrowRight, 
  RefreshCw,
  CreditCard,
  Banknote,
  DollarSign,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { api } from '../../lib/api';
import ConfirmationModal from '../../components/ConfirmationModal';

export default function RefundsDeskPage() {
  const [refunds, setRefunds] = useState([]);
  const [stats, setStats] = useState({
    pendingCount: 0,
    pendingAmount: 0,
    processedCount: 0,
    processedAmount: 0,
    retainedOperatorFees: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [companyFilter, setCompanyFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Processing Modal State
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [processMode, setProcessMode] = useState('GATEWAY'); // 'GATEWAY' | 'MANUAL'
  const [utrNumber, setUtrNumber] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  // Reject Modal State
  const [rejectingRefund, setRejectingRefund] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const fetchRefunds = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter;
      if (companyFilter) params.companyCode = companyFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.getRefunds(params);
      if (res?.success) {
        setRefunds(res.refunds || []);
        if (res.stats) setStats(res.stats);
      } else {
        setError(res?.error || 'Failed to load refund requests');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to refunds desk');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRefunds();
  }, [statusFilter, companyFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchRefunds();
  };

  const openProcessModal = (refund) => {
    setSelectedRefund(refund);
    setProcessMode('GATEWAY');
    setUtrNumber('');
    setAdminNotes('');
  };

  const handleConfirmProcess = async () => {
    if (!selectedRefund) return;
    if (processMode === 'MANUAL' && !utrNumber.trim()) {
      alert('Please enter a valid Bank UTR or Transaction Reference number.');
      return;
    }

    setProcessing(true);
    try {
      const res = await api.processRefund(selectedRefund._id, {
        mode: processMode,
        utrNumber: processMode === 'MANUAL' ? utrNumber.trim() : undefined,
        notes: adminNotes.trim() || undefined
      });

      if (res?.success) {
        setSuccessMsg(res.message || 'Refund successfully processed and disbursed!');
        setSelectedRefund(null);
        fetchRefunds();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(res?.error || 'Failed to process refund');
      }
    } catch (err) {
      alert(err.message || 'Error executing refund disbursement');
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingRefund) return;
    if (!rejectionReason.trim()) {
      alert('Please enter a valid reason for rejecting this refund request.');
      return;
    }

    setRejecting(true);
    try {
      const res = await api.rejectRefund(rejectingRefund._id, rejectionReason.trim());
      if (res?.success) {
        setSuccessMsg(res.message || 'Refund request rejected.');
        setRejectingRefund(null);
        setRejectionReason('');
        fetchRefunds();
        setTimeout(() => setSuccessMsg(''), 4000);
      } else {
        alert(res?.error || 'Failed to reject refund');
      }
    } catch (err) {
      alert(err.message || 'Error rejecting refund claim');
    } finally {
      setRejecting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200/90 p-6 sm:p-7 rounded-3xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-700 text-xs font-black uppercase tracking-wider mb-2 border border-rose-200/60">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Super Admin Refunds Command Desk</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Customer Ticket Refunds & Returns
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Exclusive super-admin authority for processing passenger ticket returns. Disburse directly to user source accounts via Razorpay API or record manual bank UTR settlements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchRefunds}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-rose-600' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Success Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-800 text-xs font-bold shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">Pending Approvals</span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{Number(stats.pendingAmount || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            <strong className="text-rose-600 font-bold">{stats.pendingCount || 0} claims</strong> awaiting admin disbursement
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Total Settled</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{Number(stats.processedAmount || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            <strong className="text-emerald-700 font-bold">{stats.processedCount || 0} claims</strong> disbursed to passengers
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-600">Operator Fees Retained</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{Number(stats.retainedOperatorFees || 0).toLocaleString('en-IN')}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Credited directly to 34 Company Owner wallets
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 p-4 sm:p-5 rounded-2xl shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold gap-1 self-start">
            {['PENDING', 'PROCESSED', 'REJECTED', 'ALL'].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  statusFilter === tab 
                    ? 'bg-white text-slate-900 shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab === 'PENDING' ? `Pending (${stats.pendingCount || 0})` : tab}
              </button>
            ))}
          </div>

          {/* Search and Company Selector */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2.5 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by PNR, Phone, Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-rose-500 focus:bg-white"
              />
            </div>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {/* Refunds Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-8 h-8 animate-spin text-rose-600" />
            <span className="text-xs font-medium">Loading refund requests queue...</span>
          </div>
        ) : refunds.length === 0 ? (
          <div className="py-20 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-slate-900">No refund requests found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {statusFilter === 'PENDING'
                ? 'All customer ticket cancellations have been processed and disbursed!'
                : 'No refund records match the specified filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Refund ID / PNR</th>
                  <th className="py-3 px-4">Customer Details</th>
                  <th className="py-3 px-4">Company Franchise</th>
                  <th className="py-3 px-4">Fare Breakdown</th>
                  <th className="py-3 px-4">Gateway Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Super Admin Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {refunds.map((r) => {
                  const isPending = r.status === 'PENDING';
                  const isProcessed = r.status === 'PROCESSED';
                  const isRejected = r.status === 'REJECTED';

                  return (
                    <tr key={r._id || r.refundId} className="hover:bg-slate-50/60 transition">
                      {/* PNR & ID */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {r.pnr}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {r.refundId}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          {r.requestedAt ? new Date(r.requestedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {r.customerName || 'Passenger'}
                        </div>
                        <div className="text-slate-500 text-[11px] font-mono mt-0.5">
                          {r.customerPhone || 'N/A'}
                        </div>
                        {r.customerEmail && (
                          <div className="text-slate-400 text-[10px]">
                            {r.customerEmail}
                          </div>
                        )}
                      </td>

                      {/* Franchise */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] border border-blue-100">
                          <Building2 className="w-3 h-3" />
                          #{r.companyCode} {r.companyName || 'Franchise'}
                        </span>
                      </td>

                      {/* Financials */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center justify-between text-[11px] w-36">
                            <span className="text-slate-400">Total Fare:</span>
                            <span className="font-medium text-slate-700">₹{r.totalFare}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] w-36 text-blue-600">
                            <span>Operator Fee:</span>
                            <span className="font-medium">₹{r.cancellationFee}</span>
                          </div>
                          <div className="flex items-center justify-between text-xs w-36 pt-1 border-t border-slate-100">
                            <span className="font-bold text-emerald-700">Refund Due:</span>
                            <span className="font-black text-emerald-700">₹{r.refundAmount}</span>
                          </div>
                        </div>
                      </td>

                      {/* Gateway Ref */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-[11px] text-slate-700 block">
                          {r.paymentId || r.orderId || 'Direct / PG'}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-bold">
                          {r.paymentMethod || 'RAZORPAY'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        {isPending && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 text-rose-700 border border-rose-200/80 animate-pulse">
                            <Clock className="w-3 h-3" />
                            Awaiting Payout
                          </span>
                        )}
                        {isProcessed && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                              <CheckCircle2 className="w-3 h-3" />
                              Disbursed
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono mt-1">
                              {r.gatewayRefundId ? `Ref: ${r.gatewayRefundId}` : r.utrNumber ? `UTR: ${r.utrNumber}` : 'Settled'}
                            </div>
                          </div>
                        )}
                        {isRejected && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <XCircle className="w-3 h-3 text-rose-500" />
                              Rejected
                            </span>
                            {r.rejectionReason && (
                              <div className="text-[10px] text-slate-400 mt-1 max-w-[140px] truncate" title={r.rejectionReason}>
                                {r.rejectionReason}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Super Admin Action */}
                      <td className="py-3.5 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openProcessModal(r)}
                              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                            >
                              <Banknote className="w-3.5 h-3.5" />
                              <span>Process</span>
                            </button>

                            <button
                              onClick={() => {
                                setRejectingRefund(r);
                                setRejectionReason('');
                              }}
                              className="px-2.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-500 hover:text-rose-600 font-bold text-xs rounded-xl transition cursor-pointer"
                              title="Reject Claim"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px] font-medium">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal for Processing Refund */}
      {selectedRefund && (
        <ConfirmationModal
          isOpen={Boolean(selectedRefund)}
          onClose={() => !processing && setSelectedRefund(null)}
          onConfirm={handleConfirmProcess}
          variant="success"
          icon={Banknote}
          title={`Disburse ₹${selectedRefund.refundAmount} to Passenger`}
          message="Confirm processing of this passenger refund. Funds will be returned to the passenger's original payment method."
          confirmText={`Disburse ₹${selectedRefund.refundAmount}`}
          cancelText="Cancel"
          loading={processing}
          details={[
            { label: 'Ticket PNR', value: selectedRefund.pnr, highlight: true },
            { label: 'Passenger Name', value: selectedRefund.customerName },
            { label: 'Passenger Phone', value: selectedRefund.customerPhone },
            { label: 'Company Franchise', value: `#${selectedRefund.companyCode} ${selectedRefund.companyName}` },
            { label: 'Operator Fee Retained', value: `₹${selectedRefund.cancellationFee}` },
            { label: 'Net Refund Payable', value: `₹${selectedRefund.refundAmount}`, variant: 'success', highlight: true }
          ]}
        >
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-slate-700 block">Select Refund Disbursement Mode:</span>
            
            <div className="grid grid-cols-2 gap-2.5">
              <label 
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  processMode === 'GATEWAY' 
                    ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 ring-1 ring-emerald-500' 
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="processMode"
                  value="GATEWAY"
                  checked={processMode === 'GATEWAY'}
                  onChange={() => setProcessMode('GATEWAY')}
                  className="mt-0.5 text-emerald-600"
                />
                <div>
                  <span className="text-xs font-bold block">Razorpay API Payout</span>
                  <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                    Instant refund to original source account (UPI / Card / Netbanking)
                  </span>
                </div>
              </label>

              <label 
                className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition ${
                  processMode === 'MANUAL' 
                    ? 'border-emerald-500 bg-emerald-50/50 text-slate-900 ring-1 ring-emerald-500' 
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="processMode"
                  value="MANUAL"
                  checked={processMode === 'MANUAL'}
                  onChange={() => setProcessMode('MANUAL')}
                  className="mt-0.5 text-emerald-600"
                />
                <div>
                  <span className="text-xs font-bold block">Direct Bank / UPI UTR</span>
                  <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                    Manual payout settlement with Bank UTR reference
                  </span>
                </div>
              </label>
            </div>

            {processMode === 'MANUAL' && (
              <div className="space-y-1 pt-1">
                <label className="text-[11px] font-bold text-slate-700">Bank UTR / Transaction Reference *</label>
                <input
                  type="text"
                  placeholder="e.g. UTR1234567890 / UPI Ref 402918237"
                  value={utrNumber}
                  onChange={(e) => setUtrNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono focus:outline-hidden focus:border-emerald-500 focus:bg-white"
                  required
                />
              </div>
            )}

            <div className="space-y-1 pt-1">
              <label className="text-[11px] font-bold text-slate-700">Internal Audit Notes (Optional)</label>
              <input
                type="text"
                placeholder="e.g. Verified by Super Admin - Passenger confirmed cancellation"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-emerald-500 focus:bg-white"
              />
            </div>
          </div>
        </ConfirmationModal>
      )}

      {/* Confirmation Modal for Rejecting Refund */}
      {rejectingRefund && (
        <ConfirmationModal
          isOpen={Boolean(rejectingRefund)}
          onClose={() => !rejecting && setRejectingRefund(null)}
          onConfirm={handleConfirmReject}
          variant="danger"
          icon={XCircle}
          title={`Reject Refund for #${rejectingRefund.pnr}`}
          message="Are you sure you want to reject this passenger refund request? Please state the justification below."
          confirmText="Reject Refund Claim"
          cancelText="Cancel"
          loading={rejecting}
          details={[
            { label: 'Ticket PNR', value: rejectingRefund.pnr, highlight: true },
            { label: 'Passenger', value: rejectingRefund.customerName },
            { label: 'Amount Claimed', value: `₹${rejectingRefund.refundAmount}`, variant: 'danger', highlight: true }
          ]}
        >
          <div className="space-y-1 pt-2">
            <label className="text-xs font-bold text-slate-700">Rejection Justification Reason *</label>
            <textarea
              rows={2}
              placeholder="e.g. Bus boarded by traveler, duplicate refund claim, or invalid chargeback"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-hidden focus:border-rose-500 focus:bg-white"
              required
            />
          </div>
        </ConfirmationModal>
      )}
    </div>
  );
}

