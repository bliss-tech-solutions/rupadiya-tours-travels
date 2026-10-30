'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  History, 
  Search, 
  Download, 
  Filter, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Building2, 
  QrCode, 
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Wallet,
  Zap,
  Copy,
  Check,
  Plus
} from 'lucide-react';
import { api } from '../../lib/api';

const ITEMS_PER_PAGE = 10;

export default function DepositHistoryPage() {
  const [deposits, setDeposits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  // Filters
  const [period, setPeriod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDeposit, setSelectedDeposit] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (period && period !== 'all') params.period = period;
      if (paymentMethod && paymentMethod !== 'ALL') params.paymentMethod = paymentMethod;
      if (status && status !== 'ALL') params.status = status;
      if (search && search.trim()) params.search = search.trim();
      if (period === 'custom') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      const res = await api.getDepositHistory(params);
      const list = res?.deposits || res?.data?.deposits || (Array.isArray(res?.data) ? res.data : []);
      setDeposits(Array.isArray(list) ? list : []);
    } catch (err) {
      console.warn('Failed to fetch deposit history:', err);
      setError(err.message || 'Could not load deposit history from server');
      setDeposits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [period, paymentMethod, status]);

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // Client-side search and filtering across fetched records
  const filtered = deposits.filter((d) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (
      d.depositId?.toLowerCase().includes(q) ||
      d.referenceId?.toLowerCase().includes(q) ||
      d.paymentMethod?.toLowerCase().includes(q) ||
      d.bankDetails?.bankName?.toLowerCase().includes(q) ||
      d.bankDetails?.notes?.toLowerCase().includes(q)
    );
    const matchesMethod = !paymentMethod || d.paymentMethod === paymentMethod;
    const matchesStatus = !status || d.status === status;
    return matchesSearch && matchesMethod && matchesStatus;
  });

  const totalFilteredAmount = filtered
    .filter(d => d.status === 'COMPLETED' || d.status === 'SUCCESS')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filtered.length);
  const paginatedDeposits = filtered.slice(startIndex, endIndex);

  const getMethodBadge = (method = '') => {
    const m = (method || '').toUpperCase();
    if (m === 'UPI' || m === 'UPI_QR') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
          <QrCode className="w-3.5 h-3.5 text-purple-600 shrink-0" />
          <span>Razorpay UPI</span>
        </span>
      );
    }
    if (m === 'CARD') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
          <CreditCard className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Razorpay Card</span>
        </span>
      );
    }
    if (m === 'NETBANKING') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          <Building2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Net Banking</span>
        </span>
      );
    }
    if (m === 'WALLET') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
          <Wallet className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span>Wallet Pay</span>
        </span>
      );
    }
    if (m === 'BANK_TRANSFER') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
          <Building2 className="w-3.5 h-3.5 text-slate-600 shrink-0" />
          <span>Bank Transfer</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Razorpay Online</span>
      </span>
    );
  };

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Deposit ID', 'Date & Time', 'Payment Mode', 'Reference ID', 'Amount (INR)', 'Status', 'Verified By'];
    const rows = filtered.map((d) => [
      d.depositId,
      new Date(d.createdAt).toISOString(),
      d.paymentMethod,
      d.referenceId,
      d.amount,
      d.status,
      d.verifiedBy || 'Razorpay Gateway'
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rupadiya-Deposit-History-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Real Wallet Ledgers
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Deposit History</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit logs of all verified Razorpay wallet top-ups, gateway orders, and banking credits.
          </p>
        </div>

        {/* Period Totals Summary Card */}
        <div className="flex items-center gap-3 sm:gap-4 bg-slate-50 p-3 sm:p-3.5 rounded-2xl border border-slate-200/80 shrink-0 flex-wrap">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Credited
            </span>
            <div className="text-lg font-bold text-emerald-700">
              ₹{Number(totalFilteredAmount).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="border-l border-slate-200 pl-3 sm:pl-4">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Records
            </span>
            <div className="text-lg font-bold text-slate-900">{filtered.length}</div>
          </div>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="p-2 bg-white hover:bg-slate-100 disabled:opacity-40 border border-slate-200 text-slate-700 rounded-xl transition text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
          <Link
            href="/deposit"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Make Deposit</span>
          </Link>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3.5">
        {/* Period Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-semibold text-slate-500 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Period:
          </span>
          {[
            { label: 'All Deposits', value: 'all' },
            { label: 'Today', value: 'today' },
            { label: 'Yesterday', value: 'yesterday' },
            { label: 'Last 7 Days', value: '7d' },
            { label: 'Last 30 Days', value: '30d' },
            { label: 'This Month', value: 'this_month' },
            { label: 'Custom Range', value: 'custom' },
          ].map((item) => (
            <button
              key={item.value}
              onClick={() => {
                setPeriod(item.value);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition text-xs cursor-pointer ${
                period === item.value
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs */}
        {period === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-800 text-xs font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-800 text-xs font-medium"
              />
            </div>
            <button
              onClick={() => { setCurrentPage(1); fetchHistory(); }}
              className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs cursor-pointer shadow-xs"
            >
              Apply Filter
            </button>
          </div>
        )}

        {/* Search & Select Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search Deposit ID or Razorpay Payment ID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={paymentMethod}
            onChange={(e) => { setPaymentMethod(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">All Payment Modes</option>
            <option value="UPI">Razorpay UPI</option>
            <option value="CARD">Razorpay Card</option>
            <option value="NETBANKING">Net Banking</option>
            <option value="WALLET">Wallet</option>
            <option value="RAZORPAY">Razorpay Gateway</option>
            <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
          </select>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Completed / Success</option>
            <option value="PENDING">Pending Verification</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-semibold">Loading live deposit records...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <History className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Deposit Transactions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search || paymentMethod || status
                ? 'No transactions matched the selected filters. Try clearing filters or changing search keywords.'
                : 'You have not made any wallet deposits yet. Top up your balance via Razorpay to start booking tickets.'}
            </p>
            {!search && !paymentMethod && !status && (
              <Link
                href="/deposit"
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>Make First Deposit</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Deposit ID</th>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Payment Mode</th>
                  <th className="py-3.5 px-4">Gateway Reference / Payment ID</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedDeposits.map((item) => {
                  const isSuccess = item.status === 'COMPLETED' || item.status === 'SUCCESS';
                  return (
                    <tr key={item._id || item.depositId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-slate-900 block">{item.depositId}</span>
                        {item.bankDetails?.bankName && (
                          <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                            {item.bankDetails.bankName}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        <span className="block font-medium text-slate-800">
                          {new Date(item.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(item.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {getMethodBadge(item.paymentMethod)}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-800 font-bold truncate max-w-[170px]" title={item.referenceId}>
                            {item.referenceId || 'N/A'}
                          </span>
                          {item.referenceId && (
                            <button
                              onClick={() => copyToClipboard(item.referenceId)}
                              className="text-slate-400 hover:text-slate-700 transition p-1 rounded cursor-pointer"
                              title="Copy Payment ID"
                            >
                              {copiedId === item.referenceId ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-black text-sm text-emerald-700">
                          +₹{Number(item.amount).toLocaleString('en-IN')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : item.status === 'PENDING'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : item.status === 'PENDING' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          <span>{item.status || 'COMPLETED'}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedDeposit(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>Audit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {startIndex + 1} to {endIndex} of {filtered.length} entries
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Audit Detail Modal */}
      {selectedDeposit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Razorpay Audit Record
                </span>
                <h3 className="text-base font-bold text-slate-900">{selectedDeposit.depositId}</h3>
              </div>
              <button
                onClick={() => setSelectedDeposit(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Credited Amount:</span>
                <span className="font-black text-sm text-emerald-700">₹{Number(selectedDeposit.amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Payment Mode:</span>
                <span className="font-bold text-slate-800">{selectedDeposit.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Gateway Ref / Payment ID:</span>
                <span className="font-mono font-bold text-slate-800">{selectedDeposit.referenceId}</span>
              </div>
              {selectedDeposit.bankDetails?.bankName && (
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Bank / Source:</span>
                  <span className="font-bold text-slate-800">{selectedDeposit.bankDetails.bankName}</span>
                </div>
              )}
              {selectedDeposit.bankDetails?.notes && (
                <div className="flex justify-between py-1.5 border-b border-slate-50">
                  <span className="text-slate-400 font-medium">Order Reference:</span>
                  <span className="font-mono text-slate-700">{selectedDeposit.bankDetails.notes}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Verification Method:</span>
                <span className="font-semibold text-slate-800">{selectedDeposit.verifiedBy || 'Razorpay Gateway'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-400 font-medium">Timestamp (ISO):</span>
                <span className="font-mono text-[11px] text-slate-600">{new Date(selectedDeposit.createdAt).toISOString()}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400 font-medium">Fulfillment Status:</span>
                <span className="font-bold text-emerald-700">✓ {selectedDeposit.status || 'COMPLETED'}</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setSelectedDeposit(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
