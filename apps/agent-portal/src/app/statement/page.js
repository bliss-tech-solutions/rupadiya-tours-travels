'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  ReceiptText, 
  Search, 
  Download, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Plus
} from 'lucide-react';
import { api } from '../../lib/api';

const ITEMS_PER_PAGE = 10;

export default function StatementPage() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState({
    openingBalance: 0,
    totalCredits: 0,
    totalDebits: 0,
    closingBalance: 0,
    transactionCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState(''); // 'CREDIT' | 'DEBIT' | ''
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchStatement = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      if (type && type !== 'ALL') params.type = type;
      if (search && search.trim()) params.search = search.trim();

      const res = await api.getStatement(params);
      const list = res?.statement || res?.transactions || res?.data?.statement || res?.data?.transactions || (Array.isArray(res?.data) ? res.data : []);
      setTransactions(Array.isArray(list) ? list : []);

      if (res?.summary) {
        setSummary(res.summary);
      } else {
        // Compute from current list if summary is not present
        const credits = (list || []).filter(t => t.entryType === 'CREDIT').reduce((s, t) => s + (t.amount || 0), 0);
        const debits = (list || []).filter(t => t.entryType === 'DEBIT').reduce((s, t) => s + (t.amount || 0), 0);
        const lastBal = (list && list.length > 0) ? (list[0].balanceAfter || 0) : 0;
        setSummary({
          openingBalance: Math.max(0, lastBal - credits + debits),
          totalCredits: credits,
          totalDebits: debits,
          closingBalance: lastBal,
          transactionCount: (list || []).length
        });
      }
    } catch (err) {
      console.warn('Failed to fetch statement:', err);
      setError(err.message || 'Could not load financial statement');
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [type]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchStatement();
  };

  const handlePrint = () => {
    window.print();
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(''), 2000);
  };

  // Client-side filtering
  const filtered = transactions.filter((tx) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (
      tx.transactionId?.toLowerCase().includes(q) ||
      tx.referenceId?.toLowerCase().includes(q) ||
      tx.description?.toLowerCase().includes(q) ||
      tx.idempotencyKey?.toLowerCase().includes(q)
    );
    const matchesType = !type || tx.entryType === type || tx.type === type;
    return matchesSearch && matchesType;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filtered.length);
  const paginatedTransactions = filtered.slice(startIndex, endIndex);

  const totalCredits = filtered
    .filter(t => t.type === 'CREDIT' || t.entryType === 'CREDIT')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const totalDebits = filtered
    .filter(t => t.type === 'DEBIT' || t.entryType === 'DEBIT')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const exportCSV = () => {
    if (filtered.length === 0) return;
    const headers = [
      'Date & Time',
      'Transaction ID',
      'Reference / PNR',
      'Description',
      'Type',
      'Credit (INR)',
      'Debit (INR)',
      'Running Balance (INR)'
    ];

    const rows = filtered.map((t) => [
      new Date(t.createdAt).toISOString(),
      t.transactionId || t._id,
      t.referenceId || '',
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.entryType || t.type,
      (t.entryType === 'CREDIT' || t.type === 'CREDIT') ? t.amount : 0,
      (t.entryType === 'DEBIT' || t.type === 'DEBIT') ? t.amount : 0,
      t.balanceAfter ?? t.runningBalance ?? 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rupadiya-Statement-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            General Wallet Ledger
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Financial Statement</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-grade double-entry ledger of deposits, ticket debits, commissions, and refunds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print</span>
          </button>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <Link
            href="/deposit"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Deposit</span>
          </Link>
        </div>
      </div>

      {/* Financial Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Opening Balance
          </span>
          <div className="text-lg sm:text-xl font-black text-slate-900">
            ₹{Number(summary.openingBalance || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Start of period</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Inflow (Credits)
          </span>
          <div className="text-lg sm:text-xl font-black text-emerald-600 flex items-center gap-1">
            <ArrowDownLeft className="w-4 h-4" />
            <span>+₹{Number(summary.totalCredits || totalCredits).toLocaleString('en-IN')}</span>
          </div>
          <span className="text-[10px] text-emerald-600/80 mt-0.5 block">Deposits & Commissions</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Outflow (Debits)
          </span>
          <div className="text-lg sm:text-xl font-black text-rose-600 flex items-center gap-1">
            <ArrowUpRight className="w-4 h-4" />
            <span>-₹{Number(summary.totalDebits || totalDebits).toLocaleString('en-IN')}</span>
          </div>
          <span className="text-[10px] text-rose-600/80 mt-0.5 block">Passenger Ticket Fares</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Closing Available Balance
          </span>
          <div className="text-lg sm:text-xl font-black text-sky-600">
            ₹{Number(summary.closingBalance || 0).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-sky-600/80 mt-0.5 block">Current Wallet Funds</span>
        </div>
      </div>

      {/* Filter Bar */}
      <form onSubmit={handleFilterSubmit} className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs space-y-3.5 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reference, PNR, description..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-500 cursor-pointer"
          >
            <option value="">All Transactions (Credits & Debits)</option>
            <option value="CREDIT">Credits Only (+ Inflows)</option>
            <option value="DEBIT">Debits Only (- Outflows)</option>
          </select>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs shrink-0">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs shrink-0">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-medium"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shrink-0 cursor-pointer shadow-xs"
            >
              Filter
            </button>
          </div>
        </div>
      </form>

      {/* Statement Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-semibold">Loading Financial Ledger...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ReceiptText className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Ledger Transactions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search || type || startDate
                ? 'No transactions matched your search criteria. Try clearing the filters.'
                : 'Your double-entry statement is completely fresh. Deposits, passenger bookings, commissions, and refunds will be recorded here.'}
            </p>
            {!search && !type && !startDate && (
              <div className="flex justify-center gap-3 pt-1">
                <Link
                  href="/deposit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Make a Deposit</span>
                </Link>
                <Link
                  href="/booking"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition"
                >
                  <span>Book Passenger Ticket</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-4">Date & Time</th>
                  <th className="py-3.5 px-4">Transaction / Ref ID</th>
                  <th className="py-3.5 px-4">Description</th>
                  <th className="py-3.5 px-4 text-center">Type</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                  <th className="py-3.5 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedTransactions.map((tx) => {
                  const isCredit = tx.entryType === 'CREDIT' || tx.type === 'CREDIT';
                  return (
                    <tr key={tx._id || tx.transactionId} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        <span className="block font-medium text-slate-900">
                          {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {new Date(tx.createdAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 truncate max-w-[150px]" title={tx.referenceId || tx.transactionId}>
                            {tx.referenceId || tx.transactionId || 'N/A'}
                          </span>
                          {(tx.referenceId || tx.transactionId) && (
                            <button
                              onClick={() => copyToClipboard(tx.referenceId || tx.transactionId)}
                              className="text-slate-400 hover:text-slate-700 transition p-0.5 rounded cursor-pointer"
                              title="Copy Reference"
                            >
                              {copiedId === (tx.referenceId || tx.transactionId) ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                        {tx.transactionType && (
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block mt-0.5">
                            {tx.transactionType.replace(/_/g, ' ')}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-700 max-w-sm">
                        <p className="font-medium text-slate-800 line-clamp-2">
                          {tx.description || tx.referenceType || 'Wallet Adjustment'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                          isCredit
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isCredit ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                          <span>{isCredit ? 'CREDIT' : 'DEBIT'}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <span className={`font-black text-sm ${isCredit ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {isCredit ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-800">
                        ₹{Number(tx.balanceAfter ?? tx.runningBalance ?? 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 print:hidden">
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
    </div>
  );
}
