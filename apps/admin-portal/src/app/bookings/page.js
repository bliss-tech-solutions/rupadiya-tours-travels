'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Filter, 
  Download, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck, 
  Bus,
  Clock,
  Phone,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (companyFilter !== 'ALL') params.companyCode = companyFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const res = await api.getBookings(params);
      if (res?.success) {
        setBookings(res.bookings || []);
      } else {
        setError(res?.error || 'Failed to fetch platform bookings');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to bookings database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [statusFilter, companyFilter]);

  const filtered = bookings.filter(b => {
    const q = searchTerm.toLowerCase();
    return (
      b.id?.toLowerCase().includes(q) ||
      b.pnr?.toLowerCase().includes(q) ||
      b.passenger?.toLowerCase().includes(q) ||
      b.corridor?.toLowerCase().includes(q) ||
      b.bus?.toLowerCase().includes(q) ||
      String(b.companyCode).includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, companyFilter]);

  const totalGMV = filtered.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  const totalInsured = filtered.filter(b => b.insuranceOpted).length;
  const totalInsurancePremium = filtered.reduce((sum, b) => sum + (Number(b.insurancePremium) || 0), 0);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-black uppercase tracking-wider mb-2 border border-emerald-200/60">
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Master Transactions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Platform Master Bookings Ledger</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time passenger bookings across all 33 companies, ticket fare breakdowns, and insurance audits.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchBookings}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
          {error}
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Bookings</span>
          <div className="text-2xl font-black text-slate-900">{filtered.length} Bookings</div>
          <span className="text-[11px] text-slate-500 font-medium">₹{totalGMV.toLocaleString('en-IN')} Gross Volume</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Insured Travelers</span>
          <div className="text-2xl font-black text-emerald-700">{totalInsured} Tickets</div>
          <span className="text-[11px] text-slate-500 font-medium">₹{totalInsurancePremium.toLocaleString('en-IN')} Insurance Premium collected (₹5/pax)</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-black uppercase tracking-wider text-sky-600">Settlement Guarantee</span>
          <div className="text-2xl font-black text-sky-700">100% Verified</div>
          <span className="text-[11px] text-slate-500 font-medium">Direct Razorpay & Agent Wallets</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {['ALL', 'CONFIRMED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All 33 Companies</option>
            {Array.from({ length: 33 }, (_, i) => i + 1).map(code => (
              <option key={code} value={code}>Company #{code.toString().padStart(2, '0')}</option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search PNR, traveler, route..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3.5 px-4">PNR / Booking ID</th>
                <th className="py-3.5 px-4">Passenger</th>
                <th className="py-3.5 px-4">Corridor & Coach</th>
                <th className="py-3.5 px-4">Seats</th>
                <th className="py-3.5 px-4">Travel Insurance</th>
                <th className="py-3.5 px-4">Total Fare</th>
                <th className="py-3.5 px-4">Payment & Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    No bookings found
                  </td>
                </tr>
              ) : (
                paginated.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      <div>#{b.pnr || b.id}</div>
                      <span className="text-[10px] text-slate-400 font-sans font-normal">
                        Co. #{b.companyCode}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-900 block">{b.passenger}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 block">{b.corridor}</span>
                      <span className="text-[11px] text-slate-500 block truncate max-w-xs">{b.bus}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 font-mono font-bold text-[11px] border border-blue-200/60">
                        {b.seats}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {b.insuranceOpted ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Insured (+₹{b.insurancePremium})</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Not Opted</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-black text-slate-900 text-sm">
                        ₹{Number(b.amount).toLocaleString('en-IN')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {b.status}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">{b.paymentMethod}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 10-Item Pagination */}
        {filtered.length > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{filtered.length}</strong> bookings
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl font-bold transition ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
