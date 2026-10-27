'use client';

import React, { useState, useEffect } from 'react';
import { 
  History, 
  Search, 
  Download, 
  Filter, 
  RefreshCw, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowUpDown,
  Building2,
  QrCode,
  CreditCard
} from 'lucide-react';
import { api } from '../../lib/api';

export default function DepositHistoryPage() {
  const [deposits, setDeposits] = useState([]);
  const [totalAmount, setTotalAmount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [period, setPeriod] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDeposit, setSelectedDeposit] = useState(null);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        period,
        page,
        limit: 15,
        paymentMethod: paymentMethod || undefined,
        status: status || undefined,
        search: search.trim() || undefined,
        startDate: period === 'custom' && startDate ? startDate : undefined,
        endDate: period === 'custom' && endDate ? endDate : undefined
      };

      const res = await api.getDepositHistory(params);
      if (res.success && res.data) {
        setDeposits(res.data.deposits || []);
        setTotalAmount(res.data.totalAmount || 0);
        setTotalCount(res.data.totalCount || 0);
      } else {
        setError(res.error || 'Failed to fetch deposit history');
      }
    } catch (err) {
      setError(err.message || 'Error loading deposit records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [period, paymentMethod, status, page]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchHistory();
  };

  const exportCSV = () => {
    if (deposits.length === 0) return;
    const headers = ['Deposit ID', 'Date & Time', 'Method', 'UTR / Ref ID', 'Amount (INR)', 'Status'];
    const rows = deposits.map((d) => [
      d.depositId,
      new Date(d.createdAt).toISOString(),
      d.paymentMethod,
      d.referenceId,
      d.amount,
      d.status
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
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Deposit Ledger
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Deposit History</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit logs of all wallet reloads, transfers, and gateway settlements
          </p>
        </div>

        {/* Period Totals Summary Card */}
        <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 shrink-0">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Filtered Total
            </span>
            <div className="text-lg font-bold text-emerald-700">
              ₹{Number(totalAmount).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Entries
            </span>
            <div className="text-lg font-bold text-slate-900">{totalCount}</div>
          </div>
          <button
            onClick={exportCSV}
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg transition text-xs font-semibold flex items-center gap-1.5 shadow-xs"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        {/* Period Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-[11px] font-semibold text-slate-500 mr-2 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Period:
          </span>
          {[
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
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl font-semibold transition text-xs ${
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
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 text-xs font-medium"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800 text-xs font-medium"
              />
            </div>
            <button
              onClick={() => { setPage(1); fetchHistory(); }}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs"
            >
              Apply
            </button>
          </div>
        )}

        {/* Search & Select Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <form onSubmit={handleSearchSubmit} className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Deposit ID or UTR / Ref..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </form>

          <select
            value={paymentMethod}
            onChange={(e) => { setPaymentMethod(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Payment Modes</option>
            <option value="UPI">UPI</option>
            <option value="CARD">Credit / Debit Card</option>
            <option value="NETBANKING">Net Banking</option>
            <option value="UPI_QR">UPI Instant QR</option>
            <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS)</option>
          </select>

          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Success / Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-semibold">Loading Deposit Records...</span>
          </div>
        ) : deposits.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No deposit transactions found matching filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Deposit ID</th>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Reference / UTR</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {deposits.map((item) => {
                  const isSuccess = item.status === 'COMPLETED' || item.status === 'SUCCESS';
                  const isPending = item.status === 'PENDING';
                  return (
                    <tr key={item._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.depositId}</td>
                      <td className="py-3 px-4 text-slate-600">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 text-slate-700">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          {item.paymentMethod?.includes('CARD') ? (
                            <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                          ) : item.paymentMethod?.includes('BANK') ? (
                            <Building2 className="w-3.5 h-3.5 text-sky-600" />
                          ) : (
                            <QrCode className="w-3.5 h-3.5 text-emerald-600" />
                          )}
                          {item.paymentMethod || 'UPI'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{item.referenceId}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">
                        ₹{Number(item.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : isPending
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isSuccess && <CheckCircle2 className="w-3 h-3" />}
                          {isPending && <Clock className="w-3 h-3" />}
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedDeposit(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
                        >
                          Details
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
        {totalCount > 15 && (
          <div className="p-3.5 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/50">
            <span className="text-slate-500">
              Showing {(page - 1) * 15 + 1} to {Math.min(page * 15, totalCount)} of {totalCount} records
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 bg-white border border-slate-200 disabled:opacity-40 text-slate-700 rounded-lg font-semibold"
              >
                Previous
              </button>
              <button
                disabled={page * 15 >= totalCount}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 bg-white border border-slate-200 disabled:opacity-40 text-slate-700 rounded-lg font-semibold"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedDeposit && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Deposit Details</h3>
              <button
                onClick={() => setSelectedDeposit(null)}
                className="text-slate-400 hover:text-slate-700 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Deposit ID:</span>
                <span className="font-mono font-bold text-slate-800">{selectedDeposit.depositId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount:</span>
                <span className="font-bold text-emerald-700">₹{Number(selectedDeposit.amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Mode:</span>
                <span className="font-semibold text-slate-800">{selectedDeposit.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference:</span>
                <span className="font-mono font-medium text-slate-700">{selectedDeposit.referenceId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date:</span>
                <span className="text-slate-700">{new Date(selectedDeposit.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-700">{selectedDeposit.status}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedDeposit(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
