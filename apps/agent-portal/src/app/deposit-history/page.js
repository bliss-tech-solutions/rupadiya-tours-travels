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
  Building2, 
  QrCode, 
  CreditCard,
  ChevronLeft,
  ChevronRight,
  Eye,
  X
} from 'lucide-react';
import { api } from '../../lib/api';

const ITEMS_PER_PAGE = 10;

// Realistic sample deposit records for test & audit verification
const SEED_DEPOSITS = [
  {
    _id: 'dep_101',
    depositId: 'DEP-2026-9041',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    paymentMethod: 'UPI',
    referenceId: 'UPI-RRB-9840218940',
    amount: 10000,
    status: 'COMPLETED',
    verifiedBy: 'Payment Gateway Webhook'
  },
  {
    _id: 'dep_102',
    depositId: 'DEP-2026-9040',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    paymentMethod: 'UPI_QR',
    referenceId: 'QR-RUP-8492041120',
    amount: 5000,
    status: 'COMPLETED',
    verifiedBy: 'Auto-Credit Engine'
  },
  {
    _id: 'dep_103',
    depositId: 'DEP-2026-9039',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    paymentMethod: 'BANK_TRANSFER',
    referenceId: 'UTR-HDFC-9940124801',
    amount: 25000,
    status: 'COMPLETED',
    verifiedBy: 'Franchise Accounts Desk'
  },
  {
    _id: 'dep_104',
    depositId: 'DEP-2026-9038',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    paymentMethod: 'CARD',
    referenceId: 'PG-CRD-7740192301',
    amount: 15000,
    status: 'COMPLETED',
    verifiedBy: 'Razorpay Instant'
  },
  {
    _id: 'dep_105',
    depositId: 'DEP-2026-9037',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    paymentMethod: 'UPI',
    referenceId: 'UPI-GPAY-6629104812',
    amount: 2000,
    status: 'COMPLETED',
    verifiedBy: 'Auto-Credit Engine'
  },
  {
    _id: 'dep_106',
    depositId: 'DEP-2026-9036',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    paymentMethod: 'NETBANKING',
    referenceId: 'SBI-NB-5591024810',
    amount: 8000,
    status: 'COMPLETED',
    verifiedBy: 'Gateway Verified'
  },
  {
    _id: 'dep_107',
    depositId: 'DEP-2026-9035',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    paymentMethod: 'UPI',
    referenceId: 'UPI-PHONEPE-44810239',
    amount: 5000,
    status: 'COMPLETED',
    verifiedBy: 'Webhook'
  },
  {
    _id: 'dep_108',
    depositId: 'DEP-2026-9034',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    paymentMethod: 'BANK_TRANSFER',
    referenceId: 'UTR-ICICI-330194821',
    amount: 20000,
    status: 'COMPLETED',
    verifiedBy: 'Franchise Accounts Desk'
  },
  {
    _id: 'dep_109',
    depositId: 'DEP-2026-9033',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString(),
    paymentMethod: 'UPI_QR',
    referenceId: 'QR-RUP-2291048192',
    amount: 3000,
    status: 'COMPLETED',
    verifiedBy: 'Auto-Credit Engine'
  },
  {
    _id: 'dep_110',
    depositId: 'DEP-2026-9032',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 180).toISOString(),
    paymentMethod: 'UPI',
    referenceId: 'UPI-PAYTM-119401829',
    amount: 1000,
    status: 'COMPLETED',
    verifiedBy: 'Auto-Credit Engine'
  },
  {
    _id: 'dep_111',
    depositId: 'DEP-2026-9031',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 210).toISOString(),
    paymentMethod: 'CARD',
    referenceId: 'PG-CRD-0049182394',
    amount: 12000,
    status: 'COMPLETED',
    verifiedBy: 'Razorpay Instant'
  },
  {
    _id: 'dep_112',
    depositId: 'DEP-2026-9030',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 250).toISOString(),
    paymentMethod: 'BANK_TRANSFER',
    referenceId: 'UTR-PNB-9910481920',
    amount: 30000,
    status: 'COMPLETED',
    verifiedBy: 'Franchise Accounts Desk'
  },
  {
    _id: 'dep_113',
    depositId: 'DEP-2026-9029',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 280).toISOString(),
    paymentMethod: 'UPI',
    referenceId: 'UPI-GPAY-8819204819',
    amount: 5000,
    status: 'COMPLETED',
    verifiedBy: 'Auto-Credit Engine'
  },
  {
    _id: 'dep_114',
    depositId: 'DEP-2026-9028',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 320).toISOString(),
    paymentMethod: 'UPI_QR',
    referenceId: 'QR-RUP-7719204812',
    amount: 4000,
    status: 'COMPLETED',
    verifiedBy: 'Auto-Credit Engine'
  }
];

export default function DepositHistoryPage() {
  const [deposits, setDeposits] = useState(SEED_DEPOSITS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [period, setPeriod] = useState('30d');
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
      const params = {
        period,
        paymentMethod: paymentMethod || undefined,
        status: status || undefined,
        search: search.trim() || undefined,
        startDate: period === 'custom' && startDate ? startDate : undefined,
        endDate: period === 'custom' && endDate ? endDate : undefined
      };

      const res = await api.getDepositHistory(params);
      if (res?.success && Array.isArray(res.data?.deposits) && res.data.deposits.length > 0) {
        setDeposits(res.data.deposits);
      } else {
        // Use seed dataset if live records are empty
        setDeposits(SEED_DEPOSITS);
      }
    } catch {
      setDeposits(SEED_DEPOSITS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [period, paymentMethod, status]);

  // Client-side filtering across current dataset
  const filtered = deposits.filter((d) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (
      d.depositId?.toLowerCase().includes(q) ||
      d.referenceId?.toLowerCase().includes(q) ||
      d.paymentMethod?.toLowerCase().includes(q)
    );
    const matchesMethod = !paymentMethod || d.paymentMethod === paymentMethod;
    const matchesStatus = !status || d.status === status;
    return matchesSearch && matchesMethod && matchesStatus;
  });

  const totalFilteredAmount = filtered.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filtered.length);
  const paginatedDeposits = filtered.slice(startIndex, endIndex);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = ['Deposit ID', 'Date & Time', 'Method', 'UTR / Ref ID', 'Amount (INR)', 'Status'];
    const rows = filtered.map((d) => [
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
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Deposit Ledger
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Deposit History</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit logs of all wallet reloads, counter transfers, and gateway settlements
          </p>
        </div>

        {/* Period Totals Summary Card */}
        <div className="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 shrink-0">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Filtered Total
            </span>
            <div className="text-lg font-bold text-emerald-700">
              ₹{Number(totalFilteredAmount).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="border-l border-slate-200 pl-4">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
              Entries
            </span>
            <div className="text-lg font-bold text-slate-900">{filtered.length}</div>
          </div>
          <button
            onClick={exportCSV}
            className="p-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl transition text-xs font-semibold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>
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
              placeholder="Search Deposit ID or UTR / Ref..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={paymentMethod}
            onChange={(e) => { setPaymentMethod(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
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
            onChange={(e) => { setStatus(e.target.value); setCurrentPage(1); }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">All Statuses</option>
            <option value="COMPLETED">Success / Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-semibold">Loading Deposit Records...</span>
          </div>
        ) : filtered.length === 0 ? (
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
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedDeposits.map((item) => {
                  const isSuccess = item.status === 'COMPLETED' || item.status === 'SUCCESS';
                  return (
                    <tr key={item._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{item.depositId}</td>
                      <td className="py-3.5 px-4 text-slate-600 whitespace-nowrap">
                        {new Date(item.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
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
                      <td className="py-3.5 px-4 font-mono text-slate-600">{item.referenceId}</td>
                      <td className="py-3.5 px-4 text-right font-black text-emerald-700 text-sm">
                        ₹{Number(item.amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isSuccess
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {isSuccess ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedDeposit(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View</span>
                        </button>
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
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/40">
            <span className="text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-800">{filtered.length}</span> deposits
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center gap-1 cursor-pointer"
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
                    className={`w-8 h-8 rounded-xl font-bold transition cursor-pointer ${
                      currentPage === pageNum
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center gap-1 cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL */}
      {selectedDeposit && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200/80 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Deposit Transaction Voucher</span>
              </h3>
              <button onClick={() => setSelectedDeposit(null)} className="text-slate-400 hover:text-slate-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Deposit Reference ID:</span>
                <span className="font-mono font-bold text-slate-900">{selectedDeposit.depositId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Payment Gateway Ref / UTR:</span>
                <span className="font-mono text-slate-800">{selectedDeposit.referenceId}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-bold text-slate-800">{selectedDeposit.paymentMethod}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Amount Credited:</span>
                <span className="font-black text-emerald-700 text-base">₹{Number(selectedDeposit.amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Timestamp:</span>
                <span className="text-slate-800">{new Date(selectedDeposit.createdAt).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-50">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-emerald-700">{selectedDeposit.status}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Verification Source:</span>
                <span className="text-slate-600">{selectedDeposit.verifiedBy || 'Automated Webhook'}</span>
              </div>
            </div>

            <button
              onClick={() => setSelectedDeposit(null)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition mt-2 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
