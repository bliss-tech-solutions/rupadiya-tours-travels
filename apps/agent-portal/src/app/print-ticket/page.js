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
import { downloadTicketPdf, fareLinesFrom } from '../../lib/pdfGenerator';
import TicketQr from '../../components/TicketQr';

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
  const [agentProfile, setAgentProfile] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('agent_user');
      if (raw) setAgentProfile(JSON.parse(raw));
    } catch (e) {}
  }, []);

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

  // PDF with the same details as the printed ticket.
  const handleDownloadPdf = () => {
    if (!ticket) return;
    const trip = ticket.trip || ticket.tripId || {};
    const bus = ticket.bus || ticket.busId || trip.busId || {};
    const route = ticket.route || ticket.routeId || trip.routeId || {};
    const dep = trip.departureTime || ticket.departureTime;
    const arr = trip.arrivalTime || ticket.arrivalTime;
    const t = (d) => {
      if (!d) return '';
      const x = new Date(d);
      return Number.isNaN(x.getTime()) ? String(d) : x.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' }).toUpperCase();
    };
    const day = (d) => {
      const x = new Date(d);
      return Number.isNaN(x.getTime()) ? (d || '') : x.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
    };
    const cash = ticket.paymentProvider === 'agent_cash';
    const fb = ticket.fareBreakdown || {};
    const agentCharge = Number(ticket.agentServiceCharge) > 0 && ticket.paymentChannel !== 'ONLINE' ? Number(ticket.agentServiceCharge) : 0;
    downloadTicketPdf({
      pnr: ticket.pnr || ticket.bookingId,
      status: ticket.status,
      qrToken: ticket.qrToken || null,
      bookedAt: ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
      fromCity: ticket.fromCity || trip.sourceCity || route.fromCity?.name || '',
      toCity: ticket.toCity || trip.destinationCity || route.toCity?.name || '',
      dateStr: ticket.departureDate || (dep ? day(dep) : ''),
      timeStr: (ticket.boardingPoint?.time && !/scheduled/i.test(ticket.boardingPoint.time)) ? ticket.boardingPoint.time : t(dep),
      arrTimeStr: (ticket.droppingPoint?.time && !/scheduled/i.test(ticket.droppingPoint.time)) ? ticket.droppingPoint.time : t(arr),
      boardingName: ticket.boardingPoint?.name || ticket.boardingLocation || '',
      droppingName: ticket.droppingPoint?.name || ticket.droppingLocation || '',
      busName: bus.name || bus.operatorName || '',
      companyName: bus.operatorName || '',
      busNumber: bus.busNumber || '',
      busModel: bus.busType || '',
      driverName: bus.driverName || bus.driverDetails?.name || '',
      driverPhone: bus.driverPhone || bus.driverDetails?.phone || '',
      amenities: bus.amenities || [],
      passengers: (ticket.passengers || []).map((p, idx) => ({ ...p, seatNumber: p.seatNumber || ticket.seatNumbers?.[idx] || String(idx + 1) })),
      seatsStr: (ticket.seatNumbers || []).join(', '),
      travelerName: ticket.contactDetails?.name || ticket.passengers?.[0]?.name || '',
      travelerPhone: ticket.contactDetails?.phone || '',
      travelerEmail: ticket.contactDetails?.email || '',
      emergencyContact: ticket.emergencyContact?.phone ? ticket.emergencyContact : null,
      fareBreakdown: fb,
      totalFare: Number(fb.totalPayable ?? ticket.totalAmount ?? 0) + agentCharge,
      totalLabel: cash ? 'Cash due to company office' : 'Total amount paid',
      agentServiceCharge: 0,
      fareLines: [...fareLinesFrom(fb), ...(agentCharge ? [['Agent service charge', agentCharge]] : [])],
      paymentProvider: ticket.paymentProvider === 'agent_wallet' ? 'Agent counter' : cash ? 'Cash' : 'Online payment',
      paymentReference: ticket.paymentReference || '',
      paymentStatus: cash
        ? (ticket.cashCollection?.status === 'RECEIVED' ? `Received by company office${ticket.cashCollection.receiptNo ? ` (receipt ${ticket.cashCollection.receiptNo})` : ''}` : 'NOT yet received - boarding not allowed')
        : (ticket.paymentStatus || ''),
      issuedBy: agentProfile ? `${agentProfile.agencyName || agentProfile.name || ''}${agentProfile.referralCode ? ` (${agentProfile.referralCode})` : ''}${agentProfile.phone ? ` | ${agentProfile.phone}` : ''}` : '',
      cancellationNote: ticket.status === 'CANCELLED' && ticket.cancellationDetails
        ? `Cancelled | Refund Rs. ${Number(ticket.cancellationDetails.refundAmount || 0).toLocaleString('en-IN')} | Fee Rs. ${Number(ticket.cancellationDetails.cancellationFee || 0).toLocaleString('en-IN')}`
        : ''
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

          /* Show only the printable ticket */
          #print-root, #print-root * {
            visibility: visible !important;
          }
          html, body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

          #print-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          #printable-ticket {
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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Print Ticket</h1>
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
              placeholder="Enter ticket PNR (e.g. RUP12345678)"
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

      {ticket && (
      <div id="print-root">
      {/* Printable ticket */}
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
              {ticket.qrToken && ticket.status !== 'CANCELLED' && (
                <div className="flex sm:justify-end mb-1">
                  <TicketQr value={ticket.qrToken} size={96} className="border border-slate-200 rounded-lg p-1 bg-white" />
                </div>
              )}
              <span className="text-[10px] text-slate-400 font-bold uppercase block tracking-wider">Confirmed PNR</span>
              <span className="text-lg font-black text-emerald-700">{ticket.pnr}</span>
              {ticket.status === 'CANCELLED' ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-300 mt-1">
                  <XCircle className="w-3 h-3 text-rose-600" />
                  <span>STATUS: CANCELLED — NOT VALID FOR TRAVEL</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 mt-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>STATUS: {ticket.status || 'CONFIRMED'}</span>
                </span>
              )}
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
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Dep: {ticket.boardingPoint?.time || ticket.departureTime || '—'}
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
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Arr: {ticket.droppingPoint?.time || ticket.arrivalTime || '—'}
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
                  {bus.busNumber || '—'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Coach Model & Class</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {bus.busType || '—'}
                </span>
                <span className="text-[10px] text-slate-500">Seating Layout: {bus.layoutType || '—'}</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Assigned Captain / Pilot</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {bus.driverName || bus.driverDetails?.name || 'Shared before departure'}
                </span>
                <span className="text-[10px] text-slate-600 flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-emerald-600" />
                  {bus.driverPhone || bus.driverDetails?.phone || '—'}
                </span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 uppercase font-semibold block">Total Seating Capacity</span>
                <span className="font-bold text-slate-800 mt-0.5 block">
                  {bus.totalSeats ? `${bus.totalSeats} seats` : '—'}
                </span>
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
                      <td className="py-2.5 px-3 font-bold text-slate-900">
                        {p.name}{p.isChild ? <span className="ml-1 text-[10px] font-semibold text-sky-700">(child)</span> : null}
                        {(p.infants || []).map((inf, i) => (
                          <div key={i} className="text-[10px] font-medium text-slate-500">+ Infant on lap: {inf.name} ({inf.age} yr, {inf.gender})</div>
                        ))}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{p.age ? `${p.age} yrs` : '—'} • {p.gender || '—'}</td>
                      <td className="py-2.5 px-3 font-mono font-black text-emerald-700 text-sm">
                        Seat: {p.seatNumber || ticket.seatNumbers?.[idx] || idx + 1}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold ${ticket.status === 'CANCELLED' ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {ticket.status === 'CANCELLED' ? 'Cancelled' : 'Confirmed'}
                      </td>
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
              <p>• <strong>Cancellation refund:</strong> more than 48 h before departure 90% · 24–48 h 75% · 12–24 h 50% · under 12 h none.</p>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 w-full sm:w-72 space-y-1 text-[11px] print-border">
              <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Fare details</span>
              {[
                [`Base fare (${ticket.fareBreakdown?.seatCount || (ticket.seatNumbers || []).length} × ₹${Number(ticket.fareBreakdown?.baseFare || 0).toLocaleString('en-IN')})`, ticket.fareBreakdown?.subtotal],
                ['GST (5%)', ticket.fareBreakdown?.gstAmount],
                ['Platform fee (5%)', ticket.fareBreakdown?.platformFee],
                [ticket.fareBreakdown?.gatewayFeeActual != null ? 'Payment gateway charge (actual)' : 'Payment gateway charge', ticket.fareBreakdown?.gatewayFeeActual ?? ticket.fareBreakdown?.gatewayFee],
                ['Travel protection', ticket.fareBreakdown?.insuranceAmount],
                ['Discount', ticket.fareBreakdown?.discountAmount ? -ticket.fareBreakdown.discountAmount : 0]
              ].filter(([, v]) => Number(v)).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 text-slate-600">
                  <span>{k}</span>
                  <span className="font-mono font-semibold text-slate-800">{Number(v) < 0 ? '−' : ''}₹{Math.abs(Number(v)).toLocaleString('en-IN')}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-1 border-t border-slate-200 text-slate-900 font-bold">
                <span>{ticket.paymentProvider === 'agent_cash' ? 'Cash due to company office' : 'Amount paid'}</span>
                <span className="font-mono">₹{Number(ticket.fareBreakdown?.totalPayable ?? ticket.totalAmount ?? 0).toLocaleString('en-IN')}</span>
              </div>
              {Number(ticket.agentServiceCharge) > 0 && ticket.paymentChannel !== 'ONLINE' && (
                <>
                  <div className="flex justify-between gap-3 text-slate-600">
                    <span>Agent service charge</span>
                    <span className="font-mono font-semibold text-slate-800">₹{Number(ticket.agentServiceCharge).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between gap-3 text-slate-900 font-black text-sm">
                    <span>Total paid</span>
                    <span className="font-mono">₹{Number(ticket.fareBreakdown?.customerTotal ?? (Number(ticket.fareBreakdown?.totalPayable || 0) + Number(ticket.agentServiceCharge))).toLocaleString('en-IN')}</span>
                  </div>
                </>
              )}
              <div className="pt-1 text-[10px] text-slate-500">
                Paid via {ticket.paymentProvider === 'agent_wallet' ? 'agent counter'
                  : ticket.paymentProvider === 'agent_cash' ? `cash (${ticket.cashCollection?.status === 'RECEIVED' ? `received by company office, receipt ${ticket.cashCollection.receiptNo}` : 'NOT yet received by company office — boarding not allowed'})`
                  : 'online payment'}
                {ticket.createdAt ? ` · Booked ${new Date(ticket.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
              </div>
              {ticket.emergencyContact?.phone && (
                <div className="text-[10px] text-slate-500">
                  Emergency contact: {ticket.emergencyContact.name} ({ticket.emergencyContact.relation}) · {ticket.emergencyContact.phone}
                </div>
              )}
              {agentProfile && (
                <div className="text-[10px] text-slate-500">
                  Issued by {agentProfile.agencyName || agentProfile.name}{agentProfile.referralCode ? ` (${agentProfile.referralCode})` : ''}{agentProfile.phone ? ` · ${agentProfile.phone}` : ''}
                </div>
              )}
              {ticket.status === 'CANCELLED' && ticket.cancellationDetails && (
                <div className="text-[10px] text-rose-700 font-semibold">
                  Cancelled · Refund ₹{Number(ticket.cancellationDetails.refundAmount || 0).toLocaleString('en-IN')} · Fee ₹{Number(ticket.cancellationDetails.cancellationFee || 0).toLocaleString('en-IN')}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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
