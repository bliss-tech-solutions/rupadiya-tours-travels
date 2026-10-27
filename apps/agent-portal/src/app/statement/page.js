'use client';

import React, { useState, useEffect } from 'react';
import { 
  ReceiptText, 
  Search, 
  Download, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw
} from 'lucide-react';
import { api } from '../../lib/api';

export default function StatementPage() {
  const [statementData, setStatementData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState(''); // 'CREDIT' | 'DEBIT' | ''
  const [search, setSearch] = useState('');

  const fetchStatement = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        type: type || undefined,
        search: search.trim() || undefined,
      };

      const res = await api.getStatement(params);
      if (res.success && res.data) {
        setStatementData(res.data);
      } else {
        setError(res.error || 'Failed to load statement ledger');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to statement engine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatement();
  }, [type]);

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchStatement();
  };

  const handlePrint = () => {
    window.print();
  };

  const exportCSV = () => {
    if (!statementData || !statementData.transactions || statementData.transactions.length === 0) return;
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

    const rows = statementData.transactions.map((t) => [
      new Date(t.createdAt).toISOString(),
      t.transactionId,
      t.referenceId || '',
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.type,
      t.type === 'CREDIT' ? t.amount : 0,
      t.type === 'DEBIT' ? t.amount : 0,
      t.runningBalance
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

  const openingBalance = statementData?.openingBalance ?? 0;
  const totalCredits = statementData?.totalCredits ?? 0;
  const totalDebits = statementData?.totalDebits ?? 0;
  const closingBalance = statementData?.closingBalance ?? 0;
  const transactions = statementData?.transactions || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            General Wallet Ledger
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Financial Statement</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-grade record of deposits, ticket debits, commissions, and refunds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-xs"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print</span>
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Opening Balance
          </span>
          <div className="text-lg font-bold text-slate-900">
            ₹{Number(openingBalance).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">Period Start</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Total Credits (+)
          </span>
          <div className="text-lg font-bold text-emerald-700">
            +₹{Number(totalCredits).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-600">Deposits & Commissions</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Total Debits (-)
          </span>
          <div className="text-lg font-bold text-rose-700">
            -₹{Number(totalDebits).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-rose-600">Ticket Deductions</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
            Closing Balance
          </span>
          <div className="text-lg font-bold text-slate-900">
            ₹{Number(closingBalance).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">Current Ledger</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form onSubmit={handleFilterSubmit} className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Tx ID, PNR or Ref..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">From:</span>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 whitespace-nowrap">To:</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700"
          >
            <option value="">All Types (Credit & Debit)</option>
            <option value="CREDIT">Credits Only (+)</option>
            <option value="DEBIT">Debits Only (-)</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 transition shadow-xs"
          >
            Filter
          </button>
        </div>
      </form>

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-semibold">Calculating Ledger...</span>
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            No ledger transactions found for selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-4">Tx ID</th>
                  <th className="py-3 px-4">Ref / PNR</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-center">Type</th>
                  <th className="py-3 px-4 text-right">Credit (+)</th>
                  <th className="py-3 px-4 text-right">Debit (-)</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {transactions.map((tx) => {
                  const isCredit = tx.type === 'CREDIT' || tx.entryType === 'CREDIT';
                  return (
                    <tr key={tx._id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {new Date(tx.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {tx.transactionId}
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-700 font-bold whitespace-nowrap">
                        {tx.referenceId || '-'}
                      </td>
                      <td className="py-3 px-4 text-slate-800 min-w-[180px]">
                        {tx.description || tx.category}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isCredit
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isCredit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {tx.type || tx.entryType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700 whitespace-nowrap">
                        {isCredit ? `+₹${Number(tx.amount).toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-rose-700 whitespace-nowrap">
                        {!isCredit ? `-₹${Number(tx.amount).toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900 whitespace-nowrap font-mono">
                        ₹{Number(tx.runningBalance || tx.balanceAfter || 0).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
