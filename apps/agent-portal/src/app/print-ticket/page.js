'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
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

function PrintTicketContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPnr = (
    searchParams?.get('pnr') || 
    searchParams?.get('prn') || 
    searchParams?.get('ticketNo') || 
    searchParams?.get('q') || 
    ''
  ).trim();

  const [pnr, setPnr] = useState(urlPnr || '');
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');

  const performLookup = useCallback(async (pnrValue) => {
    const q = (pnrValue || '').trim();
    if (!q) return;

    setLoading(true);
    setError('');
    setTicket(null);

    try {
      const res = await api.searchTicket(q);
      const bookingData = res.booking || res.data || res;
      if (res?.success && bookingData && bookingData.pnr) {
        setTicket(bookingData);
      } else {
        setError(res?.error || `Ticket not found for PNR "${q}". Please verify the PNR number.`);
      }
    } catch (err) {
      setError(err.message || 'Error looking up ticket');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (urlPnr) {
      setPnr(urlPnr);
      performLookup(urlPnr);
    }
  }, [urlPnr, performLookup]);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    const cleanPnr = pnr.trim();
    if (!cleanPnr) {
      setError('Please enter a PNR or Ticket Number');
      return;
    }

    try {
      router.replace(`/print-ticket?pnr=${encodeURIComponent(cleanPnr)}`);
    } catch {}

    performLookup(cleanPnr);
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
      pnr: ticket.pnr,
      travelDate: depDate,
      departureTime: trip.departureTime || '05:30 PM',
      fromCity: trip.sourceCity || trip.fromCity?.name || 'Rupadiya',
      toCity: trip.destinationCity || trip.toCity?.name || 'Destination',
      busName: bus.name || 'Rupadiya Super Express',
      busType: bus.busType || bus.layoutType || '36 Sleeper 2+2 AC',
      registrationNumber: bus.registrationNumber || 'UP-40-TC-1001',
      boardingPoint: ticket.boardingPoint?.name || ticket.boardingPoint?.location || 'Rupadiya Main Hub Stand',
      droppingPoint: ticket.droppingPoint?.name || ticket.droppingPoint?.location || 'Central Dropping Point',
      reportingTime: '15 Mins Before Departure',
      contactName: ticket.contactDetails?.name || 'Passenger',
      contactPhone: ticket.contactDetails?.phone || 'On Record',
      contactEmail: ticket.contactDetails?.email || 'N/A',
      seats: seatsStr,
      passengers: (ticket.passengers || []).map((p, idx) => ({
        name: p.name || `Passenger ${idx + 1}`,
        age: p.age || '—',
        gender: p.gender || '—',
        seatNumber: p.seatNumber || ticket.seatNumbers?.[idx] || (idx + 1)
      })),
      fare: {
        baseFare: ticket.fareBreakdown?.baseFare || (ticket.totalFare ? ticket.totalFare - 50 : 800),
        gst: ticket.fareBreakdown?.gstAmount || 40,
        serviceCharge: ticket.fareBreakdown?.serviceCharge || 0,
        total: ticket.fareBreakdown?.totalPayable || ticket.totalFare || 840
      },
      agentCode: agent.referralCode || 'RUP-AGT',
      agentAgency: agent.agencyName || 'Authorized Counter'
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Official Ticket Desk
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Print Ticket & Boarding Pass</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Search passenger bookings by PNR to print thermal slips or download PDF tickets
          </p>
        </div>

        {ticket && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Input Box */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={pnr}
              onChange={(e) => setPnr(e.target.value)}
              placeholder="Enter 10-digit Ticket PNR (e.g. RUP-A711C4)"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 uppercase shadow-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Find Ticket'}
          </button>
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Ticket Preview Card */}
      {ticket && (
        <div id="printable-ticket" className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Top Brand Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-xs">
                R
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Rupadiya Super Express</h2>
                <span className="text-[10px] text-slate-500 font-medium">Passenger Travel Itinerary & Boarding Pass</span>
              </div>
            </div>

            <div className="text-left sm:text-right font-mono">
              <span className="text-[10px] text-slate-400 font-semibold uppercase block">Confirmed PNR</span>
              <span className="text-base font-black text-emerald-700">{ticket.pnr}</span>
            </div>
          </div>

          {/* Journey Path */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">From City</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {ticket.trip?.sourceCity || ticket.tripId?.sourceCity || ticket.tripId?.fromCity?.name || 'Rupadiya'}
              </div>
              <div className="text-xs text-emerald-700 font-medium mt-0.5">
                {ticket.boardingPoint?.name || ticket.boardingPoint?.location || 'Main Hub Terminal'}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Dep: {ticket.trip?.departureTime || ticket.tripId?.departureTime || '05:30 PM'}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-y md:border-y-0 md:border-x border-slate-200 py-3 md:py-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date of Journey</span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {ticket.trip?.departureDate || ticket.tripId?.departureDate ? new Date(ticket.trip?.departureDate || ticket.tripId?.departureDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Today'}
              </span>
              <span className="text-[10px] font-medium text-emerald-700 mt-1">Confirmed Corridor</span>
            </div>

            <div className="text-left md:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">To City</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {ticket.trip?.destinationCity || ticket.tripId?.destinationCity || ticket.tripId?.toCity?.name || 'Destination'}
              </div>
              <div className="text-xs text-slate-700 font-medium mt-0.5">
                {ticket.droppingPoint?.name || ticket.droppingPoint?.location || 'Central Stand'}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-mono md:justify-end">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Arr: {ticket.trip?.arrivalTime || ticket.tripId?.arrivalTime || 'Morning'}
              </div>
            </div>
          </div>

          {/* Passenger Roster */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Passenger Manifest ({(ticket.passengers || []).length} Traveler)
            </span>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Passenger Name</th>
                    <th className="py-2.5 px-3">Age / Gender</th>
                    <th className="py-2.5 px-3">Seat</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(ticket.passengers || []).map((p, idx) => (
                    <tr key={idx} className="text-slate-800">
                      <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-semibold">{p.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{p.age} yrs • {p.gender}</td>
                      <td className="py-2.5 px-3 font-mono font-bold text-emerald-700">
                        {p.seatNumber || ticket.seatNumbers?.[idx] || idx + 1}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-semibold">Confirmed</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fare Summary & Guidelines */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <p>• Reporting Time: 15 minutes prior to scheduled departure.</p>
              <p>• Government photo identity card required during travel.</p>
              <p>• Support: +91 98765 43210 (24x7 Counter Desk)</p>
            </div>

            <div className="text-left sm:text-right font-mono bg-slate-50 p-3 rounded-xl border border-slate-200 w-full sm:w-auto">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total Fare Paid</span>
              <span className="text-base font-black text-slate-900">
                ₹{Number(ticket.fareBreakdown?.totalPayable || ticket.totalFare || 800).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PrintTicketPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto py-16 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500">Loading ticket printer...</p>
      </div>
    }>
      <PrintTicketContent />
    </Suspense>
  );
}
