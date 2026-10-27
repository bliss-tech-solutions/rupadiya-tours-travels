'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  Printer, 
  Search, 
  Download, 
  Ticket, 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  ShieldCheck, 
  AlertCircle,
  XCircle,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { api } from '../../lib/api';
import { downloadTicketPdf } from '../../lib/pdfGenerator';

export default function PrintTicketPage() {
  const [pnr, setPnr] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!pnr.trim()) {
      setError('Please enter a PNR or Ticket Number');
      return;
    }

    setLoading(true);
    setError('');
    setTicket(null);

    try {
      const res = await api.searchTicket(pnr.trim());
      const bookingData = res.booking || res.data || res;
      if (res.success && bookingData && bookingData.pnr) {
        setTicket(bookingData);
      } else {
        setError(res.error || 'Ticket not found. Please verify the PNR number.');
      }
    } catch (err) {
      setError(err.message || 'Error looking up ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!ticket) return;
    const trip = ticket.trip || ticket.tripId || {};
    const bus = ticket.bus || ticket.busId || trip.busId || {};
    const agent = ticket.agentId || {};

    const seatsStr = ticket.seats?.map(s => s.seatNumber || s).join(', ') || ticket.seatNumbers?.join(', ') || 'N/A';
    const depDate = trip.departureDate ? new Date(trip.departureDate).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : 'Scheduled';

    downloadTicketPdf({
      bookingId: ticket.pnr,
      travelerName: ticket.passengers?.[0]?.name || ticket.contactDetails?.name || 'Customer',
      busName: bus.name || 'Rupadiya Intercity Express',
      busModel: `${bus.busType || 'AC Sleeper'} Coach`,
      dateStr: depDate,
      timeStr: trip.departureTime || '05:30 PM',
      seatsStr,
      boardingName: ticket.boardingPoint?.location || trip.sourceCity || 'Rupadiya Border',
      droppingName: ticket.droppingPoint?.location || trip.destinationCity || 'Destination Stand',
      totalFare: Number(ticket.pricing?.totalPrice || ticket.totalAmount || 0).toLocaleString('en-IN'),
      agentCode: agent.referralCode || 'RUP-MASTER',
      agencyName: agent.agencyName || agent.name || 'Rupadiya Authorized Partner',
      passengers: ticket.passengers || []
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Ticket Desk
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Print Ticket</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Enter the PNR ticket number to view, print, or download passenger boarding pass
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs print:hidden">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={pnr}
              onChange={(e) => setPnr(e.target.value)}
              placeholder="Enter PNR Number (e.g. BK_RUP_10001)"
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 uppercase shadow-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-2 shadow-xs shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Find Ticket'}
          </button>
        </form>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Ticket Preview Card */}
      {ticket && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between print:hidden">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Ticket PNR:</span>
              <span className="text-xs font-mono font-bold text-slate-900">#{ticket.pnr}</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-xs"
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>Print Ticket</span>
              </button>
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
            </div>
          </div>

          {/* Minimalist Light Ticket Layout */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:border-black print:m-0">
            {/* Top Pass Header */}
            <div className="bg-emerald-600 p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white text-emerald-800 flex items-center justify-center font-bold text-lg shadow-xs">
                  R
                </div>
                <div>
                  <h2 className="text-base font-bold tracking-tight">Rupadiya Intercity Express</h2>
                  <p className="text-xs text-emerald-100">Official Passenger Boarding Pass</p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-800/60 px-2 py-0.5 rounded text-white inline-block mb-1">
                  STATUS: {ticket.status}
                </span>
                <div className="text-xs font-mono font-bold text-white">PNR: #{ticket.pnr}</div>
              </div>
            </div>

            {/* Journey Grid */}
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">From Departure</span>
                  <div className="text-base font-bold text-slate-900">
                    {ticket.trip?.sourceCity || ticket.tripId?.sourceCity || 'Rupadiya'}
                  </div>
                  <div className="text-xs text-emerald-700 font-medium mt-0.5">
                    {ticket.boardingPoint?.location || 'Main Stand'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> {ticket.trip?.departureTime || ticket.tripId?.departureTime || '05:30 PM'}
                  </div>
                </div>

                <div className="flex flex-col items-center justify-center border-y md:border-y-0 md:border-x border-slate-200 py-3 md:py-0">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Travel Date</span>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    {ticket.trip?.departureDate || ticket.tripId?.departureDate ? new Date(ticket.trip?.departureDate || ticket.tripId?.departureDate).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    }) : 'Scheduled'}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1">Direct Express</span>
                </div>

                <div className="text-left md:text-right">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">To Destination</span>
                  <div className="text-base font-bold text-slate-900">
                    {ticket.trip?.destinationCity || ticket.tripId?.destinationCity || 'Destination'}
                  </div>
                  <div className="text-xs text-slate-700 font-medium mt-0.5">
                    {ticket.droppingPoint?.location || 'City Terminal'}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1 md:justify-end">
                    <Clock className="w-3.5 h-3.5" /> {ticket.trip?.arrivalTime || ticket.tripId?.arrivalTime || 'Next Day'}
                  </div>
                </div>
              </div>

              {/* Coach & Seat Details */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Coach</span>
                  <span className="text-slate-900 font-bold mt-0.5 block">
                    {ticket.bus?.name || ticket.trip?.busId?.name || 'Rupadiya Coach'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Seats</span>
                  <span className="text-emerald-700 font-bold mt-0.5 block">
                    {ticket.seats?.map(s => s.seatNumber || s).join(', ') || ticket.seatNumbers?.join(', ') || 'Assigned'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Total Fare Paid</span>
                  <span className="text-slate-900 font-bold mt-0.5 block">
                    ₹{Number(ticket.pricing?.totalPrice || ticket.totalAmount || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] text-slate-500 uppercase block font-semibold">Issuing Agent</span>
                  <span className="text-slate-900 font-bold mt-0.5 block truncate">
                    {ticket.agentId?.agencyName || 'Rupadiya Partner'}
                  </span>
                </div>
              </div>

              {/* Passenger List */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-600" /> Passenger Details
                </h4>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        <th className="py-2 px-3">Passenger Name</th>
                        <th className="py-2 px-3">Age / Gender</th>
                        <th className="py-2 px-3">Seat</th>
                        <th className="py-2 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(ticket.passengers || []).map((p, idx) => (
                        <tr key={idx} className="text-slate-800">
                          <td className="py-2 px-3 text-slate-400">{idx + 1}</td>
                          <td className="py-2 px-3 font-semibold">{p.name}</td>
                          <td className="py-2 px-3 text-slate-600">{p.age} yrs • {p.gender}</td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-700">
                            {p.seatNumber || ticket.seatNumbers?.[idx] || idx + 1}
                          </td>
                          <td className="py-2 px-3 text-right text-emerald-700 font-semibold">Confirmed</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Guidelines */}
              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1">
                <p>• Report at boarding point 15 minutes before scheduled departure.</p>
                <p>• Carry a valid Government Photo ID with this boarding pass.</p>
                <p>• 24/7 Helpline: +91 98765 43210.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
