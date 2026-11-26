'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatPhone } from '../../../lib/phone';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Download, 
  Share2, 
  CheckCircle2, 
  MapPin, 
  Calendar, 
  Clock, 
  Sparkles, 
  Copy,
  Check,
  Printer,
  Bus,
  ShieldCheck,
  User,
  CreditCard,
  PhoneCall,
  ChevronRight,
  Info,
  Tag
} from 'lucide-react';
import { useToast } from '../../../components/ui/Toast';
import { api } from '../../../lib/api';
import { downloadTicketPdf, fareLinesFrom } from '../../../lib/pdfGenerator';
import TicketQr from '../../../components/ui/TicketQr';
import { formatDate, formatTime } from '../../../lib/dateUtils';

export default function TicketConfirmationPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const bookingId = params.bookingId;

  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    // 1. Try to load from session storage
    const raw = typeof window !== 'undefined' ? sessionStorage.getItem('rupadiya_confirmed_ticket') : null;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (
          parsed?.booking?.bookingId === bookingId || 
          parsed?.booking?.pnr === bookingId ||
          parsed?.booking?.pnr?.toUpperCase() === bookingId?.toUpperCase() ||
          !bookingId || 
          parsed?.booking?._id === bookingId
        ) {
          setTicketData(parsed);
          setLoading(false);
          return;
        }
      } catch (e) {}
    }

    // 2. Otherwise fetch from backend API
    if (bookingId) {
      api.getBooking(bookingId)
        .then((res) => {
          if (res?.booking) {
            setTicketData({
              booking: res.booking,
              cashbackCoupon: {
                title: 'Flat ₹150 Cashback Coupon',
                code: 'NEXTTRIP150',
                description: 'Valid on your next intercity bus or tour booking.'
              }
            });
          }
        })
        .catch((err) => {
          console.warn('Could not fetch booking from API:', err);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [bookingId]);

  const booking = ticketData?.booking;
  const cashbackCoupon = ticketData?.cashbackCoupon;

  const travelerName = booking?.passengers?.[0]?.name || 'Traveler';
  const displayBookingId = booking?.bookingId || bookingId || 'RUP-7829-BK';
  
  const trip = booking?.trip || booking?.tripId || {};
  const bus = trip?.bus || booking?.busId || trip?.busId || {};
  const route = trip?.route || booking?.routeId || trip?.routeId || {};

  let rawFrom = route?.fromCity?.name || trip?.sourceCity || booking?.fromCity || 'Rupaidiha';
  if (rawFrom.toLowerCase() === 'rupadiya') rawFrom = 'Rupaidiha';
  const fromCity = rawFrom;
  const toCity = route?.toCity?.name || trip?.destinationCity || booking?.toCity || 'Ahmedabad';

  const busName = bus?.operatorName || bus?.name || 'Rupadiya Intercity Express';
  const busNumber = bus?.busNumber || bus?.registrationNumber || '—';
  const busModel = bus?.busType || '';
  
  const departureDate = trip?.departureTime || booking?.createdAt;
  const dateStr = departureDate 
    ? formatDate(departureDate, 'medium')
    : 'Thu, 29 Oct 2026';

  const timeStr = formatTime(booking?.boardingPoint?.time || trip?.departureTime, '05:30 PM');
  const arrTimeStr = formatTime(booking?.droppingPoint?.time || trip?.arrivalTime, 'Morning (Scheduled)');

  const seatsStr = (booking?.seatNumbers && booking.seatNumbers.length > 0)
    ? booking.seatNumbers.join(', ')
    : booking?.seats?.map(s => typeof s === 'string' ? s : s.seatNumber).filter(Boolean).join(', ')
    || booking?.passengers?.map(p => p.seatNumber).filter(Boolean).join(', ')
    || '1, 2';

  const passengerList = (booking?.passengers && booking.passengers.length > 0)
    ? booking.passengers
    : [{ name: travelerName, age: '—', gender: '—', seatNumber: seatsStr }];

  const boardingName = booking?.boardingPoint?.name || 'Rupaidiha Border Main Stand';
  const droppingName = booking?.droppingPoint?.name || `${route?.toCity?.name || 'Ahmedabad'} Central Bus Station`;
  const fb = booking?.fareBreakdown || {};
  const seatsList = (booking?.seatNumbers && booking.seatNumbers.length > 0)
    ? booking.seatNumbers
    : booking?.seats?.map(s => typeof s === 'string' ? s : s.seatNumber).filter(Boolean)
    || booking?.passengers?.map(p => p.seatNumber).filter(Boolean)
    || ['1'];
  const seatCount = seatsList.length || fb.seatCount || 1;

  // Final Total Paid
  const finalTotalPaid = Number(
    fb.totalPayable 
    ?? booking?.totalAmount 
    ?? booking?.totalFare 
    ?? booking?.totalPrice 
    ?? (booking?.passengers?.length ? booking.passengers.reduce((sum, p) => sum + (p.fare || 0), 0) : null)
    ?? 1733
  );
  const totalPaid = finalTotalPaid;
  const insuranceAmount = Number(booking?.insurancePremium ?? fb.insuranceAmount ?? (booking?.insuranceOpted ? seatCount * 28 : 0));
  const insuranceOpted = Boolean(booking?.insuranceOpted || insuranceAmount > 0);
  const platformFee = Number(fb.platformFee || 0);
  const gatewayFeeShown = Number(fb.gatewayFeeActual ?? fb.gatewayFee ?? 0);
  const insurancePerPax = Number(fb.insurancePerPassenger || 28);
  const showQr = Boolean(booking?.qrToken && booking?.status !== 'CANCELLED');

  // Real driver details only (no placeholders on the printed / PDF ticket).
  const realDriverName = bus?.driverName || bus?.driverDetails?.name || '';
  const realDriverPhone = bus?.driverPhone || bus?.driverDetails?.phone || '';
  const contactPhone = booking?.contactDetails?.phone || booking?.customerPhone || '';
  const contactEmail = booking?.contactDetails?.email || booking?.customerEmail || '';
  const operatorName = bus?.operatorName && bus?.operatorName !== bus?.name ? bus.operatorName : '';

  const discountAmount = Number(fb.discountAmount || 0);

  let subtotal = Number(fb.subtotal);
  let gstAmount = Number(fb.gstAmount);
  let baseFarePerSeat = Number(fb.baseFare);

  if (!subtotal || subtotal === finalTotalPaid) {
    // If subtotal is equal to finalTotalPaid (meaning GST was bundled in total)
    // 5% GST included: subtotal + gst = finalTotalPaid + discountAmount
    subtotal = Math.round((finalTotalPaid + discountAmount) / 1.05);
    gstAmount = (finalTotalPaid + discountAmount) - subtotal;
    baseFarePerSeat = Math.round(subtotal / seatCount);
  } else if (!gstAmount && gstAmount !== 0) {
    gstAmount = Math.max(0, (finalTotalPaid + discountAmount) - subtotal);
    baseFarePerSeat = baseFarePerSeat || Math.round(subtotal / seatCount);
  } else {
    baseFarePerSeat = baseFarePerSeat || Math.round(subtotal / seatCount);
  }

  // Same fare lines on screen print and PDF.
  const fareLines = Object.keys(fb).length
    ? fareLinesFrom({ ...fb, subtotal, gstAmount, baseFare: baseFarePerSeat, seatCount }, { insuranceAmount: insuranceOpted ? insuranceAmount : 0, discountAmount })
    : [['Base fare', subtotal], ['GST (5%)', gstAmount], ['Travel insurance', insuranceOpted ? insuranceAmount : 0], ['Discount', -discountAmount]].filter(([, v]) => Number(v));

  const paymentProvider = booking?.paymentProvider === 'razorpay' ? 'Razorpay Gateway' : (booking?.paymentProvider?.toUpperCase() || 'Razorpay Gateway');
  const paymentReference = booking?.paymentReference || booking?.paymentDetails?.paymentId || (booking?.paymentStatus === 'SUCCESS' ? `pay_${String(displayBookingId).replace(/\D/g, '') || '91283'}` : 'RZP-PAID');
  const paymentStatus = booking?.paymentStatus || 'SUCCESS';
  const paymentDateStr = booking?.createdAt 
    ? new Date(booking.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
    : 'Confirmed Instant Settlement';

  const copyCouponCode = () => {
    if (cashbackCoupon?.code) {
      navigator.clipboard.writeText(cashbackCoupon.code);
      setCopied(true);
      addToast(`Coupon code ${cashbackCoupon.code} copied!`, 'success', 'Copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Download the ticket as a PDF (same details as the printed ticket).
  const handleDownloadPdf = () => {
    try {
      setIsGeneratingPdf(true);
      downloadTicketPdf({
        pnr: booking?.pnr || displayBookingId,
        status: booking?.status,
        qrToken: showQr ? booking.qrToken : null,
        bookedAt: paymentDateStr,
        fromCity,
        toCity,
        dateStr,
        timeStr,
        arrTimeStr,
        boardingName,
        droppingName,
        busName: bus?.name || busName,
        companyName: operatorName,
        busNumber,
        busModel,
        driverName: realDriverName,
        driverPhone: realDriverPhone ? formatPhone(realDriverPhone) : '',
        amenities: bus?.amenities || [],
        seatsStr,
        passengers: passengerList,
        travelerName,
        travelerPhone: contactPhone ? formatPhone(contactPhone) : '',
        travelerEmail: contactEmail,
        emergencyContact: booking?.emergencyContact?.phone
          ? { ...booking.emergencyContact, phone: formatPhone(booking.emergencyContact.phone) }
          : null,
        fareLines: fareLines,
        totalFare: finalTotalPaid,
        paymentProvider,
        paymentReference,
        paymentStatus,
        filename: `Ticket-${displayBookingId}.pdf`
      });
      addToast(`Ticket-${displayBookingId}.pdf downloaded successfully!`, 'success', 'Ready');
    } catch (err) {
      console.error(err);
      addToast('Could not create the PDF here — opening print instead.', 'warning', 'Download');
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handlePrint = () => {
    const oldTitle = document.title;
    document.title = `Ticket-${displayBookingId}`;
    window.print();
    setTimeout(() => {
      document.title = oldTitle;
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Global Print-Only Stylesheet */}
      <style jsx global>{`
        @media print {
          html, body {
            background: #ffffff !important;
            color: #0f172a !important;
            margin: 0 !important;
            padding: 0 !important;
            font-size: 11pt !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide all UI layout chrome: navbars, sidebars, headers, footers, buttons */
          nav, aside, header, footer, .no-print, [role="navigation"] {
            display: none !important;
          }

          /* Hide surrounding web page elements */
          body * {
            visibility: hidden !important;
          }

          /* Show only the printable ticket and its child tree */
          #printable-ticket, #printable-ticket * {
            visibility: visible !important;
          }

          #printable-ticket {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            border: 2px solid #0f172a !important;
            border-radius: 14px !important;
            box-shadow: none !important;
            background: #ffffff !important;
          }

          @page {
            size: A4 portrait;
            margin: 8mm 10mm;
          }
        }
      `}</style>

      {/* Screen Interactive Container (Hidden during Print) */}
      <div className="no-print">
        {/* Top Navigation Bar */}
        <div className="bg-white border-b border-slate-200 sticky top-0 md:top-20 z-30 shadow-sm">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href="/bookings"
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition"
                title="Back to Trips"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-bold text-slate-900">
                    Bus Boarding Pass
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Confirmed</span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
                  Ticket ID: #{displayBookingId}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition"
                title="Print Pass"
              >
                <Printer className="w-4 h-4 text-slate-500" />
                <span>Print</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-600 text-white text-xs font-semibold shadow-sm transition active:scale-95"
              >
                <Download className="w-4 h-4" />
                <span>{isGeneratingPdf ? 'Generating...' : 'Download PDF'}</span>
              </button>

            <button
              onClick={() => addToast('Booking pass shared via SMS & WhatsApp', 'info')}
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-600 transition"
              title="Share Ticket"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-6">
        
        {/* Confirmed Greeting Banner */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 mb-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Dear {travelerName}, Your Booking is Confirmed!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Rupadiya Intercity Booking ID:{' '}
                <span className="font-bold text-sky-600 font-mono">#{displayBookingId}</span>
                {' '}· Ticket ready for travel
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <Link
              href="/calendar"
              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>View in Calendar</span>
            </Link>
          </div>
        </div>

        {/* ======================================================== */}
        {/* DESKTOP VIEW (Two-Column Layout for Large Screens)       */}
        {/* ======================================================== */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN (Notched Boarding Pass & Golden Coupon) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* NOTCHED BUS TICKET CARD (Visual Boarding Pass matching Image 2) */}
            <div id="printable-ticket-card" className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-100 overflow-hidden relative">
              
              {/* 1. Header Destination / Coach Bus Image */}
              <div className="relative h-48 w-full overflow-hidden bg-slate-900">
                <img
                  src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80"
                  alt="Luxury Coach"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                
                <div className="absolute bottom-3 left-5 right-5 text-white">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block mb-0.5">
                    Confirmed Boarding Pass
                  </span>
                  <h3 className="text-lg font-bold leading-tight">{busName}</h3>
                  <p className="text-xs text-slate-300 font-medium">{busModel}</p>
                </div>
              </div>

              {showQr && (
                <div className="flex flex-col items-center gap-1.5 pt-5">
                  <TicketQr value={booking.qrToken} size={150} className="border border-slate-200 rounded-2xl p-2 bg-white" />
                  <span className="text-[11px] font-semibold text-slate-500">Show this QR to the bus manager while boarding</span>
                </div>
              )}

              {/* 2. Middle Info Grid */}
              <div className="p-6 pt-5">
                <div className="grid grid-cols-3 gap-3 pb-4">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Date
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 block truncate">{dateStr}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Time
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-sky-600 block truncate">{timeStr}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Booking ID
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono block truncate">#{displayBookingId}</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-slate-100">
                  <div className="col-span-2 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Boarding Point
                    </span>
                    <span className="text-xs font-semibold text-slate-800 truncate block">
                      {boardingName}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                      Seats
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-sky-600 block truncate">{seatsStr}</span>
                  </div>
                </div>
              </div>

              {/* 3. Perforated Notch Seam (Left cutout + Dashed line + Right cutout) */}
              <div className="relative py-1 flex items-center">
                <div className="w-5 h-5 rounded-full bg-[#F8FAFC] -ml-2.5 border-r border-slate-200" />
                <div className="flex-1 border-t-2 border-dashed border-slate-200" />
                <div className="w-5 h-5 rounded-full bg-[#F8FAFC] -mr-2.5 border-l border-slate-200" />
              </div>

              {/* 4. High-contrast Ticket Barcode */}
              <div className="p-6 pt-4 flex flex-col items-center">
                <div className="w-full h-12 flex items-center justify-between gap-[2px] px-2 bg-white overflow-hidden">
                  {[3, 1, 4, 1, 2, 5, 1, 2, 4, 2, 1, 3, 5, 2, 1, 4, 2, 3, 1, 5, 2, 1, 3, 4, 1, 2, 4, 3, 1, 5, 2, 4].map((w, idx) => (
                    <div
                      key={idx}
                      style={{ width: `${w * 1.8}px` }}
                      className="h-full bg-slate-900 rounded-sm"
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono tracking-widest text-slate-400 mt-2">
                  * {displayBookingId} *
                </span>
              </div>
            </div>

            {/* Next-Trip Cashback Coupon */}
            <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 rounded-3xl p-5 text-slate-900 shadow-lg shadow-amber-500/15 relative overflow-hidden">
              <div className="flex items-start justify-between gap-3 relative z-10">
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <Sparkles className="w-3 h-3" />
                    <span>Next Trip Cashback</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-950">
                    {cashbackCoupon?.title || 'Flat ₹150 Cashback Coupon'}
                  </h3>
                  <p className="text-xs font-medium text-slate-800 mt-0.5">
                    {cashbackCoupon?.description || 'Valid on your next intercity bus or tour booking.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-black/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase text-slate-800">Coupon Code:</span>
                  <span className="text-sm font-bold font-mono tracking-wider bg-white px-2.5 py-1 rounded-lg shadow-sm border border-black/5">
                    {cashbackCoupon?.code || 'NEXTTRIP150'}
                  </span>
                </div>
                <button
                  onClick={copyCouponCode}
                  className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN (Detailed Journey Timeline, Passenger Table, Bus Specs, Fare Breakdown) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Journey Timeline & Schedule */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                    Travel Itinerary
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Journey Details & Route Timings
                  </h3>
                </div>
                <span className="px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold">
                  Direct Nonstop
                </span>
              </div>

              <div className="py-6 space-y-6">
                {/* Boarding Origin */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center font-bold text-xs">
                      A
                    </div>
                    <div className="w-0.5 h-12 bg-slate-200 my-1" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-400">Boarding Point</span>
                      <span className="text-xs font-bold text-sky-600">{timeStr}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{boardingName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Please report at least 15 minutes prior to bus departure.
                    </p>
                  </div>
                </div>

                {/* Dropping Destination */}
                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                      B
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-slate-400">Dropping Point</span>
                      <span className="text-xs font-bold text-slate-600">Next Morning</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 mt-0.5">{droppingName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Direct route with certified Rupadiya rest-stop halts.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Passenger & Seat Allocation Table */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                    Travelers ({booking?.passengers?.length || 1})
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Passenger & Seat Allocations
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <User className="w-4 h-4 text-slate-400" />
                  <span>Reserved Seats</span>
                </div>
              </div>

              <div className="mt-4 divide-y divide-slate-100">
                {(booking?.passengers && booking.passengers.length > 0) ? (
                  booking.passengers.map((p, idx) => (
                    <div key={idx} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{p.name}{p.isChild ? <span className="ml-1 text-[10px] text-sky-700">(child)</span> : null}</p>
                          <p className="text-xs text-slate-400">
                            {p.age ? `${p.age} years` : 'Adult'} · {p.gender ? p.gender.toUpperCase() : 'General'}
                          </p>
                          {(p.infants || []).map((inf, i) => (
                            <p key={i} className="text-[11px] text-sky-700">+ Infant on lap: {inf.name} ({inf.age} yr)</p>
                          ))}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                          Seat {p.seatNumber || (idx + 1)}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-xs">
                        1
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{travelerName}</p>
                        <p className="text-xs text-slate-400">Primary Passenger</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                        Seats [{seatsStr}]
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Bus Features & Amenities */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                    Coach Specifications
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    {busName}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Rupadiya Verified Fleet</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Air Conditioning</span>
                  <span className="text-xs font-bold text-slate-800">Climate Controlled</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Power Supply</span>
                  <span className="text-xs font-bold text-slate-800">USB at Every Seat</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Tracking</span>
                  <span className="text-xs font-bold text-slate-800">Live GPS Radar</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">Safety</span>
                  <span className="text-xs font-bold text-slate-800">Emergency SOS / CCTV</span>
                </div>
              </div>
            </div>

            {/* 4. Payment Receipt & Complete Fare Breakdown */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              {/* Receipt Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block mb-0.5">
                    Payment Receipt · Tax Invoice
                  </span>
                  <h3 className="text-base font-black text-slate-900">
                    Fare Breakdown & Payment Details
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 rounded-xl">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-xs font-bold text-emerald-800">
                    Payment Verified ({paymentProvider})
                  </span>
                </div>
              </div>

              {/* Detailed Line Items */}
              <div className="space-y-3 text-xs">
                {/* 1. Base Ticket Fare */}
                <div className="flex items-center justify-between text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-800 block">
                      Base Bus Ticket Fare ({seatCount} Seat{seatCount > 1 ? 's' : ''} × ₹{baseFarePerSeat})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Standard intercity passenger tariff
                    </span>
                  </div>
                  <span className="font-bold text-slate-900 text-sm">
                    ₹{subtotal.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* 2. Taxes & GST (5%) */}
                <div className="flex items-center justify-between text-slate-700">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">Taxes & GST (5%)</span>
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/60">
                        CGST 2.5% + SGST 2.5%
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Statutory Government Transportation Tax
                    </span>
                  </div>
                  <span className="font-bold text-emerald-700 text-sm">
                    +₹{gstAmount.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* Passenger Travel Protection Insurance */}
                <div className="flex items-center justify-between text-slate-700">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-800">Passenger Travel Insurance</span>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                        {insuranceOpted ? `✓ Covered (₹${insurancePerPax}/pax)` : 'Not Opted'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Accidental transit cover up to ₹2,00,000 for {seatCount} traveler(s)
                    </span>
                  </div>
                  <span className={`font-bold text-sm ${insuranceOpted ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {insuranceOpted ? `+₹${insuranceAmount.toLocaleString('en-IN')}` : '₹0'}
                  </span>
                </div>
                {platformFee > 0 && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-semibold text-slate-800">Platform fee (5%)</span>
                    <span className="font-bold text-sm text-slate-800">+₹{platformFee.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {gatewayFeeShown > 0 && (
                  <div className="flex items-center justify-between text-slate-700">
                    <span className="font-semibold text-slate-800">
                      Payment gateway charge{fb.gatewayFeeActual != null ? ' (actual Razorpay charge)' : ''}
                    </span>
                    <span className="font-bold text-sm text-slate-800">+₹{gatewayFeeShown.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {booking?.emergencyContact?.phone && (
                  <div className="text-[11px] text-slate-500">
                    Emergency contact: {booking.emergencyContact.name} ({booking.emergencyContact.relation}) · {booking.emergencyContact.phone}
                  </div>
                )}
                {/* 3. Promo / Coupon Discount (if applied) */}
                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-emerald-700 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200/60">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5" />
                      <span className="font-bold">Promo Coupon Discount Applied</span>
                    </div>
                    <span className="font-black text-sm">
                      -₹{discountAmount.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                {/* 4. Total Amount Paid */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-black text-slate-900 block">
                      Total Amount Paid
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Inclusive of all taxes & verified by gateway
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl sm:text-2xl font-black text-sky-600">
                      ₹{finalTotalPaid.toLocaleString('en-IN')}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-600 block uppercase tracking-wide">
                      Fully Settled · 0 Due
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. Cashback Reward Highlight */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                    <Sparkles className="w-4 h-4 text-amber-100" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                        Cashback Reward
                      </span>
                      <span className="font-bold text-amber-950">
                        {cashbackCoupon?.title || 'Flat ₹150 Cashback Voucher'}
                      </span>
                    </div>
                    <p className="text-amber-800/90 text-[11px] mt-0.5">
                      Earned on this booking! Use code <strong className="font-mono text-slate-900">{cashbackCoupon?.code || 'NEXTTRIP150'}</strong> on your next trip.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={copyCouponCode}
                  className="self-start sm:self-auto px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer flex-shrink-0"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Voucher'}</span>
                </button>
              </div>

              {/* 6. Gateway & Audit Meta Details */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Payment Method
                  </span>
                  <span className="font-bold text-slate-800 block truncate">
                    {paymentProvider}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Payment Reference
                  </span>
                  <span className="font-mono font-bold text-slate-800 block truncate" title={paymentReference}>
                    {paymentReference}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Status
                  </span>
                  <span className="font-bold text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    {paymentStatus}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 block mb-0.5">
                    Settlement Time
                  </span>
                  <span className="font-medium text-slate-700 block truncate">
                    {paymentDateStr}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions Bar on Desktop */}
            <div className="flex items-center justify-between gap-4 pt-2">
              <Link
                href="/"
                className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
              >
                ← Book Another Bus
              </Link>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrint}
                  className="px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4 text-slate-300" />
                  <span>Print Ticket</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  className="px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition active:scale-95 flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Ticket PDF</span>
                </button>

                <Link
                  href="/bookings"
                  className="px-6 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition"
                >
                  View All Trips
                </Link>
              </div>
            </div>

          </div>

        </div>

        {/* ======================================================== */}
        {/* MOBILE VIEW (Single Column Layout for Small Screens)     */}
        {/* ======================================================== */}
        <div className="block lg:hidden max-w-md mx-auto space-y-6">
          
          {/* NOTCHED BUS TICKET CARD (Mobile App layout matching Image 2) */}
          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-100 overflow-hidden relative">
            
            {/* Header Bus Photo */}
            <div className="relative h-44 w-full overflow-hidden bg-slate-900">
              <img
                src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80"
                alt="Luxury Coach"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
              
              <div className="absolute bottom-3 left-4 right-4 text-white">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-300 block mb-0.5">
                  Confirmed Boarding Pass
                </span>
                <h3 className="text-base font-bold leading-tight">{busName}</h3>
                <p className="text-xs text-slate-300 font-medium">{busModel}</p>
              </div>
            </div>

            {/* Middle Info Grid */}
            <div className="p-5 pt-4">
              <div className="grid grid-cols-3 gap-2 pb-4">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Date
                  </span>
                  <span className="text-xs font-bold text-slate-800 block truncate">{dateStr}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Time
                  </span>
                  <span className="text-xs font-bold text-sky-600 block truncate">{timeStr}</span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Booking ID
                  </span>
                  <span className="text-xs font-bold text-slate-800 font-mono block truncate">#{displayBookingId}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100">
                <div className="col-span-2 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Boarding Point
                  </span>
                  <span className="text-xs font-semibold text-slate-800 truncate block">
                    {boardingName}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                    Seats
                  </span>
                  <span className="text-xs font-bold text-sky-600 block truncate">{seatsStr}</span>
                </div>
              </div>
            </div>

            {/* Perforated Notch Seam */}
            <div className="relative py-1 flex items-center">
              <div className="w-5 h-5 rounded-full bg-[#F8FAFC] -ml-2.5 border-r border-slate-200" />
              <div className="flex-1 border-t-2 border-dashed border-slate-200" />
              <div className="w-5 h-5 rounded-full bg-[#F8FAFC] -mr-2.5 border-l border-slate-200" />
            </div>

            {/* Ticket Barcode */}
            <div className="p-5 pt-3 flex flex-col items-center">
              <div className="w-full h-12 flex items-center justify-between gap-[1.5px] px-2 bg-white overflow-hidden">
                {[3, 1, 4, 1, 2, 5, 1, 2, 4, 2, 1, 3, 5, 2, 1, 4, 2, 3, 1, 5, 2, 1, 3, 4, 1, 2, 4, 3, 1, 5, 2, 4].map((w, idx) => (
                  <div
                    key={idx}
                    style={{ width: `${w * 1.6}px` }}
                    className="h-full bg-slate-900 rounded-sm"
                  />
                ))}
              </div>
              <span className="text-[10px] font-mono tracking-widest text-slate-400 mt-2">
                * {displayBookingId} *
              </span>
            </div>
          </div>

          {/* Golden Cashback Coupon */}
          <div className="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 rounded-3xl p-5 text-slate-900 shadow-lg shadow-amber-500/15 relative overflow-hidden">
            <div className="flex items-start justify-between gap-3 relative z-10">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 text-amber-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                  <Sparkles className="w-3 h-3" />
                  <span>Next Trip Cashback</span>
                </div>
                <h3 className="text-base font-bold text-slate-950">
                  {cashbackCoupon?.title || 'Flat ₹150 Cashback Coupon'}
                </h3>
                <p className="text-xs font-medium text-slate-800 mt-0.5">
                  {cashbackCoupon?.description || 'Valid on your next intercity bus or tour booking.'}
                </p>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-black/10 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase text-slate-800">Code:</span>
                <span className="text-xs sm:text-sm font-bold font-mono tracking-wider bg-white px-2.5 py-1 rounded-lg shadow-sm border border-black/5">
                  {cashbackCoupon?.code || 'NEXTTRIP150'}
                </span>
              </div>
              <button
                onClick={copyCouponCode}
                className="px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Mobile Payment Receipt & Fare Breakdown */}
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                  Payment Receipt · Tax Invoice
                </span>
                <h3 className="text-sm font-black text-slate-900">
                  Fare Breakdown & Details
                </h3>
              </div>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                ✓ Verified
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between text-slate-700">
                <div>
                  <span className="font-semibold text-slate-800 block">
                    Base Fare ({seatCount} Seat{seatCount > 1 ? 's' : ''} × ₹{baseFarePerSeat})
                  </span>
                  <span className="text-[10px] text-slate-400">Intercity transit</span>
                </div>
                <span className="font-bold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
              </div>

              <div className="flex items-center justify-between text-slate-700">
                <div>
                  <span className="font-semibold text-slate-800 block">Taxes & GST (5%)</span>
                  <span className="text-[10px] text-slate-400">CGST 2.5% + SGST 2.5%</span>
                </div>
                <span className="font-bold text-emerald-700">+₹{gstAmount.toLocaleString('en-IN')}</span>
              </div>

              {discountAmount > 0 && (
                <div className="flex items-center justify-between text-emerald-700 bg-emerald-50 p-2 rounded-xl">
                  <span>Coupon Discount</span>
                  <span className="font-bold">-₹{discountAmount.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="pt-2.5 border-t border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-black text-slate-900 block">Total Amount Paid</span>
                  <span className="text-[10px] text-slate-400">Inclusive of all taxes</span>
                </div>
                <div className="text-right">
                  <span className="text-lg font-black text-sky-600">₹{finalTotalPaid.toLocaleString('en-IN')}</span>
                  <span className="text-[9px] font-bold text-emerald-600 block uppercase">0 Balance Due</span>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-[11px] font-bold text-amber-950">Earned ₹150 Cashback Voucher</span>
              </div>
              <span className="font-mono font-bold text-[11px] bg-white text-slate-900 px-2 py-0.5 rounded-lg border border-amber-300">
                {cashbackCoupon?.code || 'NEXTTRIP150'}
              </span>
            </div>

            <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-3 grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Gateway</span>
                <span className="font-bold text-slate-800 truncate block">{paymentProvider}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Reference</span>
                <span className="font-mono font-bold text-slate-800 truncate block">{paymentReference}</span>
              </div>
            </div>
          </div>

          {/* Mobile Action Buttons */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              onClick={handlePrint}
              className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-300" />
              <span>Print</span>
            </button>

            <button
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className="py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/25 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isGeneratingPdf ? 'Saving...' : 'PDF'}</span>
            </button>

            <Link
              href="/bookings"
              className="py-3.5 rounded-2xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-1 text-center"
            >
              <span>Details</span>
            </Link>
          </div>

          <div className="text-center pt-2">
            <Link
              href="/"
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Book Another Journey →
            </Link>
          </div>

        </div>

      </div>
      </div>

      {/* ======================================================== */}
      {/* PRINTABLE TICKET (visible only when printing)             */}
      {/* ======================================================== */}
      <div id="printable-ticket" className="hidden print:block bg-white text-slate-900 font-sans">
        {/* 1. Header */}
        <div className="flex items-center justify-between pb-3.5 border-b-2 border-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black text-lg">
              RUP
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-950 uppercase">
                Rupadiya Bus Samiti
              </h1>
              <p className="text-[11px] font-bold text-sky-700 tracking-wider uppercase">
                Passenger E-Ticket{operatorName ? ` · ${operatorName}` : ''}
              </p>
            </div>
          </div>
          <div className="text-right">
            {booking?.status === 'CANCELLED' ? (
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold uppercase mb-1">
                Cancelled · not valid for travel
              </span>
            ) : (
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase mb-1">
                ✓ {booking?.status || 'Confirmed'}
              </span>
            )}
            <p className="text-sm font-mono font-black text-slate-950">
              PNR: {booking?.pnr || displayBookingId}
            </p>
            <p className="text-[10px] text-slate-500 font-medium">
              Booked: {paymentDateStr}
            </p>
          </div>
        </div>

        {/* 2. Journey + QR */}
        <div className="my-3.5 flex items-stretch gap-3.5">
          <div className="flex-1 p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/80">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block mb-0.5">From</span>
                <span className="text-base font-black text-slate-950 uppercase block">{fromCity}</span>
                <span className="text-xs font-semibold text-slate-700 block mt-0.5">Departure: {timeStr}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800 block mb-0.5">To</span>
                <span className="text-base font-black text-slate-950 uppercase block">{toCity}</span>
                <span className="text-xs font-semibold text-slate-700 block mt-0.5">Arrival: {arrTimeStr}</span>
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-sky-200/80 flex items-center justify-between text-xs">
              <span><span className="text-[10px] font-bold uppercase text-slate-500">Date of journey: </span><b>{dateStr}</b></span>
              <span><span className="text-[10px] font-bold uppercase text-slate-500">Seat(s): </span><b className="text-sky-700">{seatsStr}</b></span>
            </div>
          </div>
          {showQr && (
            <div className="flex flex-col items-center justify-center">
              <TicketQr value={booking.qrToken} size={104} className="border border-slate-200 rounded-lg p-1 bg-white" />
              <span className="text-[9px] text-slate-500 mt-1">Show this QR while boarding</span>
            </div>
          )}
        </div>

        {/* 3. Bus details */}
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 mb-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Bus</span>
              <span className="text-sm font-bold text-slate-900">{bus?.name || busName}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Bus number</span>
              <span className="text-sm font-mono font-black text-slate-950 tracking-wider">{busNumber}</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Coach type</span>
              <span className="font-bold text-slate-800 block">{busModel}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Driver</span>
              <span className="font-bold text-slate-800 block">{realDriverName || 'Shared before departure'}</span>
              {realDriverPhone ? <span className="text-[10px] text-slate-600 font-mono font-semibold">{formatPhone(realDriverPhone)}</span> : null}
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-semibold block">Operator</span>
              <span className="font-bold text-slate-800 block">{operatorName || bus?.name || busName}</span>
            </div>
          </div>
          {Array.isArray(bus?.amenities) && bus.amenities.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-200/70 flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="font-bold uppercase text-slate-500 mr-1">Amenities:</span>
              {bus.amenities.map((am, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-800 font-medium">✓ {am}</span>
              ))}
            </div>
          )}
        </div>

        {/* 4. Boarding & dropping */}
        <div className="grid grid-cols-2 gap-3.5 mb-3.5">
          <div className="p-3 rounded-xl border border-slate-200 bg-white">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Boarding point</span>
            <span className="text-xs font-bold text-slate-900 block mb-1">{boardingName}</span>
            <div className="p-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[10px] font-bold">
              Please report 15 minutes before {timeStr}
            </div>
          </div>
          <div className="p-3 rounded-xl border border-slate-200 bg-white">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-0.5">Dropping point</span>
            <span className="text-xs font-bold text-slate-900 block mb-1">{droppingName}</span>
            <p className="text-[10px] text-slate-500 mt-1">
              Contact: {travelerName}{contactPhone ? ` · ${formatPhone(contactPhone)}` : ''}{contactEmail ? ` · ${contactEmail}` : ''}
            </p>
            {booking?.emergencyContact?.phone && (
              <p className="text-[10px] text-slate-500">
                Emergency: {booking.emergencyContact.name}{booking.emergencyContact.relation ? ` (${booking.emergencyContact.relation})` : ''} · {formatPhone(booking.emergencyContact.phone)}
              </p>
            )}
          </div>
        </div>

        {/* 5. Passengers */}
        <div className="mb-3.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Passengers ({passengerList.length})
            </span>
            <span className="text-xs font-mono font-bold text-sky-700">Seats: {seatsStr}</span>
          </div>
          <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-2 px-3">#</th>
                <th className="py-2 px-3">Passenger name</th>
                <th className="py-2 px-3">Age / Gender</th>
                <th className="py-2 px-3">Seat</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {passengerList.map((p, idx) => (
                <tr key={idx} className="text-slate-800">
                  <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-2 px-3 font-bold text-slate-900">
                    {p.name || `Passenger ${idx + 1}`}{p.isChild ? <span className="ml-1 text-[10px] text-sky-700">(child)</span> : null}
                    {(p.infants || []).map((inf, i) => (
                      <div key={i} className="text-[10px] font-medium text-slate-500">+ Infant on lap: {inf.name} ({inf.age} yr)</div>
                    ))}
                  </td>
                  <td className="py-2 px-3 text-slate-600">{p.age ? `${p.age} yrs` : '—'} / {p.gender ? String(p.gender).toUpperCase() : '—'}</td>
                  <td className="py-2 px-3 font-mono font-black text-sky-700">{p.seatNumber || seatsList[idx] || (idx + 1)}</td>
                  <td className={`py-2 px-3 text-right font-bold ${booking?.status === 'CANCELLED' ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {booking?.status === 'CANCELLED' ? 'Cancelled' : 'Confirmed'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 6. Fare details & payment */}
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 grid grid-cols-2 gap-4 mb-3.5 text-xs">
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Payment</span>
            <p><span className="text-slate-500">Paid via:</span> <b>{paymentProvider}</b></p>
            <p><span className="text-slate-500">Reference:</span> <span className="font-mono font-bold">{paymentReference}</span></p>
            <p><span className="text-slate-500">Status:</span> <b className="text-emerald-700">{paymentStatus}</b></p>
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Fare details</span>
            {fareLines.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 text-slate-600">
                <span>{k}</span>
                <span className="font-mono font-semibold text-slate-800">{Number(v) < 0 ? '−' : ''}₹{Math.abs(Number(v)).toLocaleString('en-IN')}</span>
              </div>
            ))}
            <div className="flex justify-between gap-3 pt-1 border-t border-slate-300 text-slate-950 font-black text-sm">
              <span>Total amount paid</span>
              <span className="font-mono">₹{finalTotalPaid.toLocaleString('en-IN')}</span>
            </div>
          </div>
        </div>

        {/* 7. Guidelines */}
        <div className="pt-2 border-t border-slate-200 text-[10px] text-slate-500 space-y-0.5">
          <p>• <strong>Reporting:</strong> reach the boarding point at least 15 minutes before departure.</p>
          <p>• <strong>ID proof:</strong> carry a valid government photo ID (Aadhaar / Voter ID / Driving Licence / Passport).</p>
          <p>• <strong>Boarding:</strong> show the QR code or tell the PNR to the bus manager.</p>
          <p>• <strong>Luggage:</strong> up to 2 pieces (20 kg) per passenger. Inflammable items are not allowed.</p>
          <p>• <strong>Cancellation refund:</strong> more than 48 h before departure 90% · 24–48 h 75% · 12–24 h 50% · under 12 h none.</p>
        </div>
      </div>
    </div>
  );
}
