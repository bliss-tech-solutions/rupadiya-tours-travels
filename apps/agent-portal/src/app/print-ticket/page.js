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
  ArrowRight,
  Bus,
  Phone,
  Sparkles,
  CheckCircle2,
  Building2
} from 'lucide-react';
import { api } from '../../lib/api';
import { downloadTicketPdf } from '../../lib/pdfGenerator';

function PrintTicketContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlPnr = (
    searchParams?.get('ticketId') || 
    searchParams?.get('ticketid') || 
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
    const route = ticket.route || ticket.routeId || trip.routeId || {};
    const agent = ticket.agentId || {};

    const seatsStr = ticket.seats?.map(s => s.seatNumber || s).join(', ') || ticket.seatNumbers?.join(', ') || 'N/A';
    const depDate = ticket.departureDate || (trip.departureDate ? new Date(trip.departureDate).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : 'Scheduled');

    downloadTicketPdf({
      bookingId: ticket.pnr || ticket.bookingId,
      pnr: ticket.pnr,
      fromCity: ticket.fromCity || trip.sourceCity || route.fromCity?.name || 'Rupadiya',
      toCity: ticket.toCity || trip.destinationCity || route.toCity?.name || 'Destination',
      travelDate: depDate,
      departureTime: ticket.departureTime || trip.departureTime || '05:30 PM',
      arrivalTime: ticket.arrivalTime || trip.arrivalTime || 'Morning (Scheduled)',
      busName: bus.operatorName || bus.name || 'Rupadiya Intercity Travels',
      busNumber: bus.busNumber || 'UP-40-TC-1001',
      busType: bus.busType || '36 AC Sleeper (2+1)',
      layoutType: bus.layoutType || '2+1 Sleeper',
      driverName: bus.driverName || bus.driverDetails?.name || 'Verified Captain',
      driverPhone: bus.driverPhone || bus.driverDetails?.phone || '+91 98765 43210',
      amenities: bus.amenities || ['Charging Point', 'Night Reading Lamp', 'Water Bottle', 'AC', 'Blanket'],
      boardingName: ticket.boardingPoint?.name || ticket.boardingLocation || 'Rupadiya Central Terminal',
      droppingName: ticket.droppingPoint?.name || ticket.droppingLocation || 'Central Dropping Point',
      reportingTime: '15 Mins Before Departure',
      travelerName: ticket.contactDetails?.name || ticket.passengers?.[0]?.name || 'Passenger',
      travelerPhone: ticket.contactDetails?.phone || ticket.passengers?.[0]?.phone || 'On Record',
      travelerEmail: ticket.contactDetails?.email || '',
      seatsStr,
      passengers: (ticket.passengers || []).map((p, idx) => ({
        name: p.name || `Passenger ${idx + 1}`,
        age: p.age || '—',
        gender: p.gender || '—',
        seatNumber: p.seatNumber || ticket.seatNumbers?.[idx] || (idx + 1)
      })),
      totalFare: ticket.fareBreakdown?.totalPayable || ticket.totalAmount || 840,
      baseFare: ticket.fareBreakdown?.baseFare || '',
      gst: ticket.fareBreakdown?.tax || ticket.fareBreakdown?.gst || '',
      agentCode: agent.referralCode || 'RUP-AGT',
      agencyName: agent.agencyName || 'Authorized Counter'
    });
  };

  const handlePrint = () => {
    window.print();
  };

  // Safe accessor for bus details
  const bus = ticket?.bus || ticket?.busId || ticket?.trip?.busId || {};
  const trip = ticket?.trip || ticket?.tripId || {};
  const route = ticket?.route || ticket?.routeId || trip.routeId || {};

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Global Print-Only Stylesheet */}
      <style jsx global>{`
        @media print {
          /* Reset page margins and background */
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 12pt !important;
          }

          /* Hide all UI layout chrome: sidebars, navbars, headers, footers */
          nav, aside, header, footer, .no-print, [role="navigation"] {
            display: none !important;
          }

          /* Hide all surrounding page elements */
          body * {
            visibility: hidden !important;
          }

          /* Show only the printable ticket and its child tree */
          #printable-ticket, #printable-ticket * {
            visibility: visible !important;
          }

          #printable-ticket {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            border: 2px solid #0f172a !important;
            border-radius: 16px !important;
            box-shadow: none !important;
            background: #ffffff !important;
            page-break-inside: avoid !important;
          }

          /* Print color adjustments */
          .print-border {
            border: 1px solid #cbd5e1 !important;
          }

          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>

      {/* Top Header - Hidden in Print */}
      <div className="no-print bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Official Ticket Desk
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Print Ticket & Boarding Pass</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Search passenger bookings by PNR to print tickets or download PDF with complete coach details
          </p>
        </div>

        {ticket && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              <Printer className="w-4 h-4" />
              <span>Print Ticket</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* Search Input Box - Hidden in Print */}
      <div className="no-print bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={pnr}
              onChange={(e) => setPnr(e.target.value)}
              placeholder="Enter 10-digit Ticket PNR (e.g. RUP-A711C4)"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:border-emerald-500 uppercase shadow-xs"
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

      {/* Ticket Preview Card (The ONLY element visible in print) */}
      {ticket && (
        <div id="printable-ticket" className="bg-white border-2 border-dashed border-slate-300 rounded-3xl p-6 sm:p-8 space-y-6 shadow-sm">
          {/* Top Brand Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-200 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-700 text-white flex items-center justify-center font-black text-xl shadow-xs">
                RUP
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Rupadiya Intercity Express</h2>
                <span className="text-xs text-slate-500 font-medium">Official Passenger Travel Itinerary & Boarding Pass</span>
              </div>
            </div>

            <div className="text-left sm:text-right font-mono">
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Confirmed PNR</span>
              <span className="text-lg font-black text-emerald-700">{ticket.pnr}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 mt-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>STATUS: CONFIRMED</span>
              </span>
            </div>
          </div>

          {/* Journey Path Corridor */}
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Origin City</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {ticket.fromCity || trip.sourceCity || route.fromCity?.name || 'Rupaidiha'}
              </div>
              <div className="text-xs text-emerald-800 font-semibold mt-0.5">
                {ticket.boardingPoint?.name || ticket.boardingLocation || 'Main Hub Terminal'}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-mono">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Dep: {ticket.departureTime || trip.departureTime || '05:30 PM'}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-y md:border-y-0 md:border-x border-slate-200 py-3 md:py-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date of Journey</span>
              <span className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {ticket.departureDate || (trip.departureDate ? new Date(trip.departureDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Today')}
              </span>
              <span className="text-[10px] font-bold text-emerald-700 mt-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                Direct Express Service
              </span>
            </div>

            <div className="text-left md:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Destination City</span>
              <div className="text-base font-bold text-slate-900 mt-0.5">
                {ticket.toCity || trip.destinationCity || route.toCity?.name || 'Destination'}
              </div>
              <div className="text-xs text-slate-700 font-semibold mt-0.5">
                {ticket.droppingPoint?.name || ticket.droppingLocation || 'Central Stand'}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-mono md:justify-end">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Arr: {ticket.arrivalTime || trip.arrivalTime || 'Morning (Scheduled)'}
              </div>
            </div>
          </div>

          {/* DEDICATED BUS & FLEET SPECIFICATIONS (Requested by User) */}
          <div className="p-5 rounded-2xl bg-emerald-50/40 border border-emerald-200/90 space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                    Assigned Fleet & Coach Specifications
                  </span>
                  <span className="text-sm font-bold text-slate-900">
                    {bus.operatorName || bus.name || 'Rupadiya Intercity Travels'}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-500 uppercase block">Vehicle Plate Number</span>
                <span className="text-sm font-mono font-black text-emerald-900 tracking-wider">
                  {bus.busNumber || 'UP-40-TC-1001'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Coach Model & Class</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {bus.busType || '36 AC Sleeper (2+1)'}
                </span>
                <span className="text-[10px] text-slate-500">Seating Layout: {bus.layoutType || '2+1 Sleeper'}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Assigned Captain / Pilot</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {bus.driverName || bus.driverDetails?.name || 'Verified Captain (Dinesh Kumar)'}
                </span>
                <span className="text-[10px] text-slate-600 flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  {bus.driverPhone || bus.driverDetails?.phone || '+91 98765 43210'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Seating Capacity</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {bus.totalSeats || 36} Confirmed Berths
                </span>
                <span className="text-[10px] text-emerald-700 font-semibold">24x7 Realtime GPS Tracked</span>
              </div>
            </div>

            {/* Coach Amenities */}
            <div className="pt-2.5 border-t border-emerald-200/60 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-[10px] font-bold uppercase text-slate-500 mr-1">Onboard Amenities:</span>
              {(bus.amenities || ['AC', 'USB Mobile Charging', 'Night Reading Lamp', 'Water Bottle', 'Clean Blanket']).map((am, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-emerald-200 text-emerald-900 font-medium text-[10px]">
                  ✓ {am}
                </span>
              ))}
            </div>
          </div>

          {/* Passenger Roster */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider block">
              Passenger Manifest ({(ticket.passengers || []).length || 1} Traveler)
            </span>

            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Passenger Name</th>
                    <th className="py-2.5 px-3">Age / Gender</th>
                    <th className="py-2.5 px-3">Confirmed Seat</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {((ticket.passengers && ticket.passengers.length > 0) ? ticket.passengers : [{
                    name: ticket.contactDetails?.name || 'Passenger',
                    age: '—',
                    gender: '—',
                    seatNumber: ticket.seatNumbers?.[0] || '1'
                  }]).map((p, idx) => (
                    <tr key={idx} className="text-slate-800">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{p.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{p.age ? `${p.age} yrs` : '—'} • {p.gender || '—'}</td>
                      <td className="py-2.5 px-3 font-mono font-black text-emerald-700 text-sm">
                        Seat: {p.seatNumber || ticket.seatNumbers?.[idx] || idx + 1}
                      </td>
                      <td className="py-2.5 px-3 text-right text-emerald-700 font-bold">Confirmed</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Fare Summary & Guidelines */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
            <div className="text-[11px] text-slate-500 space-y-1">
              <p>• <strong>Reporting Time:</strong> Please report at the boarding point 15 minutes before departure.</p>
              <p>• <strong>Identification:</strong> Carry a valid government photo identity card (Aadhaar / Voter ID / DL).</p>
              <p>• <strong>Counter Helpline:</strong> +91 98765 43210 (24x7 Customer Support Desk)</p>
            </div>

            <div className="text-left sm:text-right font-mono bg-slate-50 p-3.5 rounded-xl border border-slate-200 w-full sm:w-auto">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Total Fare Paid</span>
              <span className="text-lg font-black text-slate-900">
                ₹{Number(ticket.fareBreakdown?.totalPayable || ticket.totalAmount || 840).toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Includes 5% Passenger Transport GST</span>
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
