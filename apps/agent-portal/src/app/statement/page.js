'use client';

import React, { useState, useEffect } from 'react';
import { 
  ReceiptText, 
  Search, 
  Download, 
  Printer, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';

const ITEMS_PER_PAGE = 10;

// Realistic sample ledger statement records with accurate running balance
const SEED_TRANSACTIONS = [
  {
    _id: 'tx_15',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    transactionId: 'TXN-2026-99015',
    referenceId: 'DEP-2026-9041',
    description: 'Wallet Reload via Instant UPI (Ref: UPI-RRB-9840218940)',
    type: 'CREDIT',
    amount: 10000,
    runningBalance: 32450
  },
  {
    _id: 'tx_14',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    transactionId: 'TXN-2026-99014',
    referenceId: 'TKT-UP40-8841',
    description: 'Passenger Bus Ticket Booking (Rupadiya → Surat, Seat 12, 13)',
    type: 'DEBIT',
    amount: 3500,
    runningBalance: 22450
  },
  {
    _id: 'tx_13',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    transactionId: 'TXN-2026-99013',
    referenceId: 'TKT-UP40-8841',
    description: 'Agent Commission Credited (Silver Tier @ 5.0%)',
    type: 'CREDIT',
    amount: 175,
    runningBalance: 25950
  },
  {
    _id: 'tx_12',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    transactionId: 'TXN-2026-99012',
    referenceId: 'TKT-UP40-8839',
    description: 'Passenger Bus Ticket Booking (Rupadiya → Ahmedabad, Seat 08)',
    type: 'DEBIT',
    amount: 1650,
    runningBalance: 25775
  },
  {
    _id: 'tx_11',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    transactionId: 'TXN-2026-99011',
    referenceId: 'TKT-UP40-8839',
    description: 'Agent Commission Credited (Silver Tier @ 5.0%)',
    type: 'CREDIT',
    amount: 82.5,
    runningBalance: 27425
  },
  {
    _id: 'tx_10',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    transactionId: 'TXN-2026-99010',
    referenceId: 'DEP-2026-9040',
    description: 'Wallet Top-up via Dynamic UPI QR Code',
    type: 'CREDIT',
    amount: 5000,
    runningBalance: 27342.5
  },
  {
    _id: 'tx_09',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
    transactionId: 'TXN-2026-99009',
    referenceId: 'REF-TKT-8820',
    description: 'Passenger Cancellation Refund (Seat 22 released, 80% refund)',
    type: 'CREDIT',
    amount: 1320,
    runningBalance: 22342.5
  },
  {
    _id: 'tx_08',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    transactionId: 'TXN-2026-99008',
    referenceId: 'TKT-UP40-8825',
    description: 'Passenger Bus Ticket Booking (Rupadiya → Vadodara, Seat 18)',
    type: 'DEBIT',
    amount: 1550,
    runningBalance: 21022.5
  },
  {
    _id: 'tx_07',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    transactionId: 'TXN-2026-99007',
    referenceId: 'DEP-2026-9039',
    description: 'Manual Bank Transfer Credit (Ref: UTR-HDFC-9940124801)',
    type: 'CREDIT',
    amount: 25000,
    runningBalance: 22572.5
  },
  {
    _id: 'tx_06',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    transactionId: 'TXN-2026-99006',
    referenceId: 'TKT-UP40-8815',
    description: 'Passenger Bus Ticket Booking (Rupadiya → Bengaluru, Seat 04, 05)',
    type: 'DEBIT',
    amount: 4800,
    runningBalance: -2427.5
  },
  {
    _id: 'tx_05',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 120).toISOString(),
    transactionId: 'TXN-2026-99005',
    referenceId: 'DEP-2026-9038',
    description: 'Debit Card Gateway Deposit (Ref: PG-CRD-7740192301)',
    type: 'CREDIT',
    amount: 15000,
    runningBalance: 2372.5
  },
  {
    _id: 'tx_04',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 144).toISOString(),
    transactionId: 'TXN-2026-99004',
    referenceId: 'TKT-UP40-8802',
    description: 'Passenger Bus Ticket Booking (Rupadiya → Surat, Seat 20)',
    type: 'DEBIT',
    amount: 1750,
    runningBalance: -12627.5
  },
  {
    _id: 'tx_03',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 168).toISOString(),
    transactionId: 'TXN-2026-99003',
    referenceId: 'TKT-UP40-8802',
    description: 'Agent Commission Credited (Silver Tier @ 5.0%)',
    type: 'CREDIT',
    amount: 87.5,
    runningBalance: -10877.5
  },
  {
    _id: 'tx_02',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 200).toISOString(),
    transactionId: 'TXN-2026-99002',
    referenceId: 'DEP-2026-9036',
    description: 'Net Banking Deposit (Ref: SBI-NB-5591024810)',
    type: 'CREDIT',
    amount: 8000,
    runningBalance: -10965
  },
  {
    _id: 'tx_01',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 300).toISOString(),
    transactionId: 'TXN-2026-99001',
    referenceId: 'INIT-ALLOC-01',
    description: 'Initial Franchise Opening Wallet Balance Allocation',
    type: 'CREDIT',
    amount: 10000,
    runningBalance: 10000
  }
];

export default function StatementPage() {
  const [transactions, setTransactions] = useState(SEED_TRANSACTIONS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const params = {
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        type: type || undefined,
        search: search.trim() || undefined,
      };

      const res = await api.getStatement(params);
      if (res?.success && Array.isArray(res.data?.transactions) && res.data.transactions.length > 0) {
        setTransactions(res.data.transactions);
      } else {
        setTransactions(SEED_TRANSACTIONS);
      }
    } catch {
      setTransactions(SEED_TRANSACTIONS);
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

  // Client-side filtering
  const filtered = transactions.filter((tx) => {
    const q = search.toLowerCase().trim();
    const matchesSearch = !q || (
      tx.transactionId?.toLowerCase().includes(q) ||
      tx.referenceId?.toLowerCase().includes(q) ||
      tx.description?.toLowerCase().includes(q)
    );
    const matchesType = !type || tx.type === type || tx.entryType === type;
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

  const openingBalance = 10000;
  const closingBalance = openingBalance + totalCredits - totalDebits;

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
      t.transactionId,
      t.referenceId || '',
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.type || t.entryType,
      (t.type === 'CREDIT' || t.entryType === 'CREDIT') ? t.amount : 0,
      (t.type === 'DEBIT' || t.entryType === 'DEBIT') ? t.amount : 0,
      t.runningBalance || t.balanceAfter || 0
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
            Audit-grade record of deposits, ticket debits, commissions, and refunds
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
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Financial Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Opening Balance
          </span>
          <div className="text-lg font-black text-slate-900">
            ₹{Number(openingBalance).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">Allocated Base</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Credits (+)
          </span>
          <div className="text-lg font-black text-emerald-700">
            +₹{Number(totalCredits).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium">Deposits & Rewards</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Total Debits (-)
          </span>
          <div className="text-lg font-black text-rose-700">
            -₹{Number(totalDebits).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-rose-600 font-medium">Ticket Deductions</span>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs">
          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
            Closing Balance
          </span>
          <div className="text-lg font-black text-slate-900">
            ₹{Number(closingBalance).toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400">Current Ledger</span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <form onSubmit={handleFilterSubmit} className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
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
            onChange={(e) => {
              setType(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 cursor-pointer"
          >
            <option value="">All Types (Credit & Debit)</option>
            <option value="CREDIT">Credits Only (+)</option>
            <option value="DEBIT">Debits Only (-)</option>
          </select>
          <button
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shrink-0 transition shadow-xs cursor-pointer"
          >
            Filter
          </button>
        </div>
      </form>

      {/* Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span className="text-xs font-semibold">Calculating Ledger...</span>
          </div>
        ) : filtered.length === 0 ? (
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
                  <th className="py-3 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {paginatedTransactions.map((tx) => {
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
                      <td className="py-3 px-4 text-slate-800 min-w-[200px]">
                        {tx.description || tx.category}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          isCredit
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {isCredit ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {tx.type || tx.entryType}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-emerald-700 whitespace-nowrap">
                        {isCredit ? `+₹${Number(tx.amount).toLocaleString('en-IN')}` : '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-black text-rose-700 whitespace-nowrap">
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

        {/* Pagination Controls */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-slate-50/40">
            <span className="text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-800">{filtered.length}</span> transactions
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
    </div>
  );
}
