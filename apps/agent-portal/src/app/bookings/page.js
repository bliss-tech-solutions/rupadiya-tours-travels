'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { 
  Ticket, 
  Search, 
  Filter, 
  Download, 
  Printer, 
  Eye, 
  X, 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  ShieldCheck, 
  Navigation, 
  XCircle, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Copy, 
  Check, 
  CreditCard,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { api } from '../../lib/api';
import { downloadTicketPdf } from '../../lib/pdfGenerator';
import { useWallet } from '../../context/WalletContext';

export default function AgentBookingsPage() {
  const { agent } = useWallet();
  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState({ totalBookings: 0, confirmedCount: 0, cancelledCount: 0, totalGrossSales: 0 });
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Detail Modal State
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [copiedPnr, setCopiedPnr] = useState(null);

  const fetchBookings = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getBookings({
        page: targetPage,
        limit: 15,
        status,
        search: search.trim(),
        startDate,
        endDate
      });

      if (res?.success) {
        setBookings(res.bookings || []);
        if (res.pagination) setPagination(res.pagination);
        if (res.stats) setStats(res.stats);
      } else {
        setError(res?.error || 'Failed to load bookings');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to booking service');
    } finally {
      setLoading(false);
    }
  }, [status, search, startDate, endDate]);

  useEffect(() => {
    fetchBookings(1);
  }, [fetchBookings]);

  const handleCopyPnr = (pnr) => {
    navigator.clipboard.writeText(pnr);
    setCopiedPnr(pnr);
    setTimeout(() => setCopiedPnr(null), 2000);
  };

  const handleDownloadPdf = (b) => {
    const seatsStr = (b.seatNumbers || []).join(', ') || 'N/A';
    const primaryTraveler = b.passengers?.[0]?.name || b.contactDetails?.name || 'Customer';

    downloadTicketPdf({
      bookingId: b.pnr || b.bookingId,
      travelerName: primaryTraveler,
      busName: b.bus?.name || 'Rupadiya Intercity Travels',
      busModel: `${b.bus?.busType || 'AC Sleeper'} (${b.bus?.busNumber || 'UP-40-BT-1001'})`,
      dateStr: b.departureDate || 'Scheduled',
      timeStr: b.departureTime || '05:30 PM',
      seatsStr,
      boardingName: b.boardingPoint?.name || b.boardingLocation || b.fromCity || 'Rupadiya Stand',
      droppingName: b.droppingPoint?.name || b.droppingLocation || b.toCity || 'Destination Stand',
      totalFare: Number(b.totalAmount || b.fareBreakdown?.totalPayable || 0).toLocaleString('en-IN'),
      agentCode: agent?.referralCode || 'RUP-AGENT',
      agencyName: agent?.agencyName || agent?.name || 'Rupadiya Authorized Counter',
      passengers: b.passengers || []
    });
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[11px] font-bold uppercase tracking-wider border border-emerald-200">
              <Ticket className="w-3.5 h-3.5 text-emerald-600" />
              <span>Counter Operations</span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Booking History & Details
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            View, print, track, and manage all passenger tickets issued from your terminal
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchBookings(pagination.page)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
            title="Refresh bookings"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/booking"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer"
          >
            <Ticket className="w-4 h-4" />
            <span>Book New Ticket</span>
          </Link>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Tickets</span>
            <Ticket className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            {stats.totalBookings.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Issued across all dates</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Confirmed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2">
            {stats.confirmedCount.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">Active traveler tickets</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Cancelled</span>
            <XCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2">
            {stats.cancelledCount.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-rose-700 font-medium mt-0.5 block">Refunded to agent wallet</span>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Gross Booking Sales</span>
            <TrendingUp className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2">
            ₹{stats.totalGrossSales.toLocaleString('en-IN')}
          </div>
          <span className="text-[10px] text-blue-600 font-medium mt-0.5 block">Total counter volume</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by PNR, Booking ID, Passenger name, or Phone..."
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-emerald-600 bg-slate-50/50"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 shrink-0 w-full md:w-auto">
            {['ALL', 'CONFIRMED', 'CANCELLED'].map((st) => (
              <button
                key={st}
                onClick={() => setStatus(st)}
                className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  status === st
                    ? 'bg-white text-emerald-800 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st === 'ALL' ? 'All Tickets' : st === 'CONFIRMED' ? 'Confirmed' : 'Cancelled'}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Row */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-100 text-xs font-medium text-slate-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <span>To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:border-emerald-600"
            />
          </div>
          {(startDate || endDate || search) && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setSearch(''); }}
              className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer ml-auto"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Bookings List Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2 text-slate-400">
            <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
            <span className="text-xs font-semibold uppercase tracking-wider">Loading Counter Tickets...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-500 mx-auto" />
            <p className="text-xs font-bold text-rose-700">{error}</p>
            <button
              onClick={() => fetchBookings(1)}
              className="px-4 py-2 bg-rose-100 text-rose-800 rounded-xl text-xs font-bold hover:bg-rose-200 transition cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <Ticket className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Bookings Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {search || status !== 'ALL' || startDate
                ? 'No tickets match your filter criteria. Try clearing search filters.'
                : 'You have not issued any tickets yet from this terminal.'}
            </p>
            <Link
              href="/booking"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition"
            >
              <Ticket className="w-4 h-4" />
              <span>Book Your First Ticket</span>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3 px-4">PNR / Ticket</th>
                  <th className="py-3 px-4">Travel Route</th>
                  <th className="py-3 px-4">Departure Time</th>
                  <th className="py-3 px-4">Passengers & Seats</th>
                  <th className="py-3 px-4">Fare Paid</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {bookings.map((b) => {
                  const isConfirmed = b.status === 'CONFIRMED';
                  return (
                    <tr key={b._id || b.bookingId} className="hover:bg-slate-50/70 transition">
                      {/* PNR & Booking ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-900 text-xs">
                            {b.pnr}
                          </span>
                          <button
                            onClick={() => handleCopyPnr(b.pnr)}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                            title="Copy PNR"
                          >
                            {copiedPnr === b.pnr ? (
                              <Check className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          #{b.bookingId}
                        </span>
                      </td>

                      {/* Travel Route */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">
                          {b.fromCity} → {b.toCity}
                        </div>
                        <span className="text-[10px] text-slate-500 block truncate max-w-[150px]">
                          {b.bus?.name || 'Rupadiya Express'} ({b.bus?.busType || 'AC Sleeper'})
                        </span>
                      </td>

                      {/* Departure Date & Time */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-800 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{b.departureDate}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{b.departureTime}</span>
                        </span>
                      </td>

                      {/* Passengers & Seats */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1 flex-wrap">
                          {(b.seatNumbers || []).map((seat) => (
                            <span
                              key={seat}
                              className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-mono font-bold text-[10px] border border-emerald-200"
                            >
                              {seat}
                            </span>
                          ))}
                        </div>
                        <span className="text-[10px] text-slate-600 block truncate max-w-[180px] mt-1 font-semibold">
                          {b.passengers?.[0]?.name}
                          {(b.passengers?.length || 0) > 1 && ` +${b.passengers.length - 1} more`}
                        </span>
                      </td>

                      {/* Fare Paid */}
                      <td className="py-3 px-4">
                        <span className="font-black text-slate-900 text-xs">
                          ₹{Number(b.totalAmount || b.fareBreakdown?.totalPayable || 0).toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-slate-400 block">Agent Wallet</span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isConfirmed
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isConfirmed ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Confirmed</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3" />
                              <span>Cancelled</span>
                            </>
                          )}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Print / PDF Download */}
                          <button
                            onClick={() => handleDownloadPdf(b)}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 transition cursor-pointer"
                            title="Download Ticket PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          {/* View Details */}
                          <button
                            onClick={() => setSelectedBooking(b)}
                            className="p-1.5 rounded-lg border border-blue-200 bg-blue-50/60 text-blue-700 hover:bg-blue-100 transition cursor-pointer"
                            title="View Full Details"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Track Bus */}
                          <Link
                            href={`/track-bus?pnr=${b.pnr}`}
                            className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-100 transition"
                            title="Track Coach"
                          >
                            <Navigation className="w-3.5 h-3.5" />
                          </Link>

                          {/* Cancel Shortcut (if active) */}
                          {isConfirmed && (
                            <Link
                              href={`/cancel-ticket?pnr=${b.pnr}`}
                              className="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 transition"
                              title="Cancel Ticket"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => fetchBookings(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => fetchBookings(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Ticket Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-xs">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block">
                  Passenger Boarding Pass
                </span>
                <h3 className="text-base font-black text-slate-900">
                  PNR: {selectedBooking.pnr}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs text-slate-700">
              {/* Corridor & Bus View */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-sm font-black text-slate-900">
                  <span>{selectedBooking.fromCity}</span>
                  <span className="text-slate-400">→</span>
                  <span>{selectedBooking.toCity}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{selectedBooking.bus?.name} ({selectedBooking.bus?.busType})</span>
                  <span className="font-mono font-bold text-slate-700">{selectedBooking.bus?.busNumber}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] pt-1 text-slate-600 border-t border-slate-200/60">
                  <span>Departure: {selectedBooking.departureDate} at {selectedBooking.departureTime}</span>
                  <span>Arrival: {selectedBooking.arrivalTime}</span>
                </div>
              </div>

              {/* Boarding and Dropping Points */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Boarding Point</span>
                  <div className="font-bold text-slate-800 text-xs">{selectedBooking.boardingPoint?.name}</div>
                  <div className="text-[11px] text-slate-500">Time: {selectedBooking.boardingPoint?.time}</div>
                  {selectedBooking.boardingPoint?.landmark && (
                    <div className="text-[10px] text-slate-400">Landmark: {selectedBooking.boardingPoint.landmark}</div>
                  )}
                </div>

                <div className="p-3 rounded-xl border border-slate-200 bg-white space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block">Dropping Point</span>
                  <div className="font-bold text-slate-800 text-xs">{selectedBooking.droppingPoint?.name}</div>
                  <div className="text-[11px] text-slate-500">Time: {selectedBooking.droppingPoint?.time}</div>
                  {selectedBooking.droppingPoint?.landmark && (
                    <div className="text-[10px] text-slate-400">Landmark: {selectedBooking.droppingPoint.landmark}</div>
                  )}
                </div>
              </div>

              {/* Passengers List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-900 block">
                  Passenger Roster ({selectedBooking.passengers?.length || 0})
                </span>
                <div className="space-y-1.5">
                  {(selectedBooking.passengers || []).map((p, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-mono font-bold text-[11px]">
                          {p.seatNumber}
                        </span>
                        <div>
                          <span className="font-bold text-slate-800 block">{p.name}</span>
                          <span className="text-[10px] text-slate-500 capitalize">{p.gender}, Age {p.age}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Fare Breakdown */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Base Ticket Fare</span>
                  <span className="font-mono">₹{selectedBooking.fareBreakdown?.baseFare || 0}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span>Goods & Services Tax (GST 5%)</span>
                  <span className="font-mono">₹{selectedBooking.fareBreakdown?.tax || 0}</span>
                </div>
                {selectedBooking.fareBreakdown?.insurance > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span>Passenger Travel Insurance</span>
                    <span className="font-mono">₹{selectedBooking.fareBreakdown.insurance}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm font-black text-slate-900 pt-2 border-t border-slate-200">
                  <span>Total Amount Paid</span>
                  <span className="font-mono text-emerald-700">₹{selectedBooking.totalAmount}</span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
              <Link
                href={`/track-bus?pnr=${selectedBooking.pnr}`}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-emerald-700 transition"
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Track Bus</span>
              </Link>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownloadPdf(selectedBooking)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download PDF Pass</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

