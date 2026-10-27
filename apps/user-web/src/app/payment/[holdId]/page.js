'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  ShieldCheck, 
  CreditCard, 
  QrCode, 
  CheckCircle2, 
  Tag, 
  Lock, 
  Sparkles, 
  Clock, 
  ArrowRight, 
  Zap, 
  Building2, 
  Smartphone,
  Check
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/ui/Toast';

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const holdId = params.holdId;

  const [checkoutData, setCheckoutData] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('upi'); // 'upi' | 'netbanking' | 'card' | 'demo'
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes timer

  // Form states for other payment options
  const [selectedBank, setSelectedBank] = useState('HDFC Bank');
  const [cardData, setCardData] = useState({
    number: '',
    name: '',
    expiry: '',
    cvv: ''
  });

  useEffect(() => {
    const raw = sessionStorage.getItem('rupadiya_checkout');
    if (!raw) {
      router.push('/');
      return;
    }
    const data = JSON.parse(raw);
    setCheckoutData(data);

    // Calculate remaining seconds if expiresAt is set
    if (data.expiresAt) {
      const exp = new Date(data.expiresAt).getTime();
      const diff = Math.floor((exp - Date.now()) / 1000);
      if (diff > 0) {
        setTimeLeft(diff);
      }
    }

    // Keep active hold in localStorage for homepage banner
    localStorage.setItem('rupadiya_active_hold', JSON.stringify({
      holdId: data.holdId,
      holdToken: data.holdId,
      tripId: data.tripId,
      selectedSeats: data.selectedSeats,
      totalPrice: data.totalPrice,
      expiresAt: data.expiresAt || new Date(Date.now() + 600 * 1000).toISOString(),
      routeLabel: `${data.trip?.route?.fromCity?.name || 'Rupadiya'} → ${data.trip?.route?.toCity?.name || 'Ahmedabad'}`
    }));
  }, [router]);

  // Hold Countdown Timer (10 Minutes)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          addToast('Your 10-minute seat hold has expired. Please select your seats again.', 'warning', 'Hold Expired');
          localStorage.removeItem('rupadiya_active_hold');
          sessionStorage.removeItem('rupadiya_checkout');
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [addToast, router]);

  if (!checkoutData) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = String(timeLeft % 60).padStart(2, '0');

  const baseFare = checkoutData.baseFare || 510;
  const seatsCount = checkoutData.selectedSeats?.length || 1;
  const baseTotal = seatsCount * baseFare;
  const gstAmount = checkoutData.gstAmount || Math.round(baseTotal * 0.05);
  const subtotal = checkoutData.totalPrice || (baseTotal + gstAmount);
  const discount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalTotal = Math.max(0, subtotal - discount);

  // Dynamic UPI Payment Link and Simple QR Code (UPI ID string hidden per user request)
  const merchantUpi = 'rupadiya.ticket@upi';
  const upiString = `upi://pay?pa=${encodeURIComponent(merchantUpi)}&pn=Rupadiya%20Intercity&am=${finalTotal}&cu=INR&tn=Ticket%20Booking%20Seats%20${(checkoutData.selectedSeats || []).join('-')}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&data=${encodeURIComponent(upiString)}`;

  const handleApplyCoupon = (e) => {
    e.preventDefault();
    const code = couponCode.trim().toUpperCase();
    if (code === 'RUPADIYA100') {
      setAppliedCoupon({ code: 'RUPADIYA100', discount: 100, label: 'Flat ₹100 Off' });
      addToast('Coupon RUPADIYA100 applied successfully! Saved ₹100.', 'success', 'Discount Applied');
    } else if (code === 'FIRSTTRIP') {
      const disc = Math.round(subtotal * 0.15);
      setAppliedCoupon({ code: 'FIRSTTRIP', discount: disc, label: '15% First Trip Off' });
      addToast(`Coupon FIRSTTRIP applied! Saved ₹${disc}.`, 'success', 'Discount Applied');
    } else {
      addToast('Invalid coupon code. Try "RUPADIYA100" or "FIRSTTRIP".', 'error', 'Invalid Code');
    }
  };

  // Complete Payment & Confirm Ticket
  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      const payload = {
        holdId: checkoutData.holdId,
        holdToken: checkoutData.holdId,
        tripId: checkoutData.tripId,
        selectedSeats: checkoutData.selectedSeats,
        seatNumbers: checkoutData.selectedSeats,
        passengers: checkoutData.passengers,
        boardingPoint: checkoutData.boardingPoint,
        droppingPoint: checkoutData.droppingPoint,
        contactPhone: checkoutData.contactPhone,
        contactEmail: checkoutData.contactEmail || `${checkoutData.contactPhone}@rupadiya.com`,
        primaryContact: {
          phone: checkoutData.contactPhone,
          email: checkoutData.contactEmail || `${checkoutData.contactPhone}@rupadiya.com`,
        },
        paymentProvider: paymentMethod === 'upi' ? 'upi_qr' : paymentMethod,
        paymentDetails: {
          status: 'SUCCESS',
          paymentId: `PAY_${paymentMethod.toUpperCase()}_${Date.now()}`
        },
        totalAmount: finalTotal,
        couponCode: appliedCoupon?.code || null,
      };

      const res = await api.confirmBooking(payload);
      const booking = res.data?.booking || res.booking || res.data;
      const cashbackCoupon = res.data?.cashbackCoupon || res.cashbackCoupon;

      // Store confirmed booking and coupon in session
      sessionStorage.setItem('rupadiya_confirmed_ticket', JSON.stringify({
        booking,
        cashbackCoupon: cashbackCoupon || {
          code: 'NEXTTRIP150',
          title: 'Flat ₹150 Cashback Coupon',
          description: 'Valid on your next intercity bus or curated tour booking',
          discount: 150,
        },
      }));

      // Clear active hold from storage
      localStorage.removeItem('rupadiya_active_hold');
      sessionStorage.removeItem('rupadiya_checkout');
      sessionStorage.removeItem('rupadiya_booking_flow');

      addToast('Payment confirmed! Your ticket is booked.', 'success', 'Booking Confirmed');
      const targetId = booking?.bookingId || booking?._id || checkoutData.holdId;
      router.push(`/ticket/${targetId}`);
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Payment processing failed. Please try again.', 'error', 'Payment Error');
    } finally {
      setProcessing(false);
    }
  };

  const handleReleaseSeats = async () => {
    try {
      await api.releaseHold(checkoutData.holdId);
    } catch (e) {}
    localStorage.removeItem('rupadiya_active_hold');
    sessionStorage.removeItem('rupadiya_checkout');
    sessionStorage.removeItem('rupadiya_booking_flow');
    addToast('Reservation cancelled and seats released.', 'info', 'Seats Released');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Sticky Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 md:top-20 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="p-2 rounded-full hover:bg-slate-100 text-slate-700 transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <h1 className="text-base font-black text-slate-900">Secure Payment</h1>
            <p className="text-xs text-slate-500">Step 4 of 4 · Complete booking</p>
          </div>
          <div className="w-9" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 mb-6 text-xs font-bold text-slate-400">
          <span className="text-emerald-600 flex items-center gap-1">✓ 1. Seats</span>
          <span className="text-emerald-600 flex items-center gap-1">✓ 2. Boarding Points</span>
          <span className="text-emerald-600 flex items-center gap-1">✓ 3. Travelers</span>
          <span className="text-sky-600 font-extrabold flex items-center gap-1">● 4. Payment</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7 cols): Timer Banner & Payment Options */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Live Hold Countdown Timer Card (10 Minutes) */}
            <div className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-3xl p-5 shadow-lg shadow-sky-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 animate-pulse text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full">
                      10-Min Seat Hold
                    </span>
                    <span className="text-xs text-sky-100 font-medium">Reserved exclusively</span>
                  </div>
                  <h3 className="text-sm font-bold mt-1">
                    Seats [{checkoutData.selectedSeats?.join(', ')}] locked for you
                  </h3>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black font-mono tracking-tight">
                  {minutes}:{seconds}
                </div>
                <span className="text-[10px] text-sky-100 font-medium">Time Remaining</span>
              </div>
            </div>

            {/* PAYMENT METHOD TABS (QR UPI, Net Banking, Credit/Debit, Instant Demo) */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-3 sm:p-4 shadow-sm">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                
                {/* 1. QR UPI Tab */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    paymentMethod === 'upi'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-900 ring-2 ring-sky-500/20 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-medium'
                  }`}
                >
                  <QrCode className={`w-5 h-5 ${paymentMethod === 'upi' ? 'text-sky-600' : 'text-slate-500'}`} />
                  <span className="text-xs">QR UPI</span>
                </button>

                {/* 2. Credit / Debit Tab */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    paymentMethod === 'card'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-900 ring-2 ring-sky-500/20 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-medium'
                  }`}
                >
                  <CreditCard className={`w-5 h-5 ${paymentMethod === 'card' ? 'text-sky-600' : 'text-slate-500'}`} />
                  <span className="text-xs">Credit / Debit</span>
                </button>

                {/* 3. Net Banking Tab */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('netbanking')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    paymentMethod === 'netbanking'
                      ? 'border-sky-500 bg-sky-50/70 text-sky-900 ring-2 ring-sky-500/20 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-medium'
                  }`}
                >
                  <Building2 className={`w-5 h-5 ${paymentMethod === 'netbanking' ? 'text-sky-600' : 'text-slate-500'}`} />
                  <span className="text-xs">Net Banking</span>
                </button>

                {/* 4. Instant Demo 1-Click Tab */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('demo')}
                  className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-1.5 ${
                    paymentMethod === 'demo'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500/20 font-bold'
                      : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white font-medium'
                  }`}
                >
                  <Zap className={`w-5 h-5 ${paymentMethod === 'demo' ? 'text-emerald-600' : 'text-slate-500'}`} />
                  <span className="text-xs">Instant Demo</span>
                </button>

              </div>
            </div>

            {/* TAB CONTENT 1: SIMPLE QR UPI PAYMENT (NO UPI ID DISPLAYED) */}
            {paymentMethod === 'upi' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm text-center">
                
                <h3 className="text-lg font-black text-slate-900 mb-1">
                  Scan QR Code to Pay ₹{finalTotal}
                </h3>
                <p className="text-xs text-slate-500 mb-6">
                  Simple & secure payment via any UPI app
                </p>

                {/* Simple QR Code Box (NO UPI ID string shown) */}
                <div className="inline-block p-4 sm:p-5 rounded-3xl bg-white border-2 border-slate-200 shadow-md mb-6">
                  <img
                    src={qrCodeUrl}
                    alt="Scan UPI QR Code"
                    className="w-48 h-48 sm:w-56 sm:h-56 mx-auto object-contain rounded-xl"
                  />
                </div>

                {/* STEP-BY-STEP PAYMENT PROCESS WITH BRAND BADGES */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 mb-6 text-left space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 text-center sm:text-left">
                    How to pay using QR code:
                  </h4>

                  {/* Step 1: Open Payment Apps */}
                  <div className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <div className="flex-1">
                      <p className="text-xs text-slate-700 font-semibold mb-2">
                        Open any UPI payment app on your smartphone:
                      </p>
                      
                      {/* App Badges: PhonePe, Google Pay, Paytm, BHIM */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* PhonePe */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#5f259f] text-white text-xs font-bold shadow-sm">
                          <span className="w-4 h-4 rounded-full bg-white/20 flex items-center justify-center text-[10px]">पे</span>
                          <span>PhonePe</span>
                        </div>

                        {/* Google Pay */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold shadow-sm">
                          <span className="text-[#4285F4] font-black">G</span>
                          <span className="text-slate-700">Pay</span>
                        </div>

                        {/* Paytm */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#002e6e] text-white text-xs font-bold shadow-sm">
                          <span className="text-[#00b9f5] font-black">pay</span>
                          <span>tm</span>
                        </div>

                        {/* BHIM UPI */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 text-white text-xs font-bold shadow-sm">
                          <span className="font-black text-amber-300">🇮🇳</span>
                          <span>BHIM UPI</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Step 2: Scan QR Code */}
                  <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
                    <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <p className="text-xs text-slate-700 font-semibold">
                      Scan the QR code shown above & verify amount <strong className="text-slate-900">₹{finalTotal}</strong>.
                    </p>
                  </div>

                  {/* Step 3: Complete Payment */}
                  <div className="flex items-start gap-3 pt-2 border-t border-slate-200/60">
                    <span className="w-5 h-5 rounded-full bg-sky-500 text-white text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <p className="text-xs text-slate-700 font-semibold">
                      Complete payment with your UPI PIN and click the confirmation button below.
                    </p>
                  </div>
                </div>

                {/* Direct App Link for Mobile Users */}
                <div className="space-y-3 max-w-sm mx-auto">
                  <a
                    href={upiString}
                    className="w-full py-3 px-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition active:scale-95"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Pay with Installed UPI App</span>
                  </a>

                  {/* Confirm Booking Button */}
                  <button
                    onClick={handleConfirmPayment}
                    disabled={processing}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer"
                  >
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Verifying Payment & Booking...
                      </span>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>I Have Paid with QR · Confirm Booking</span>
                      </>
                    )}
                  </button>
                </div>

              </div>
            )}

            {/* TAB CONTENT 2: CREDIT / DEBIT CARDS */}
            {paymentMethod === 'card' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Credit / Debit Card</h3>
                  <p className="text-xs text-slate-500">All major Visa, MasterCard, RuPay cards accepted</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Card Number</label>
                    <input
                      type="text"
                      maxLength={19}
                      placeholder="4532 •••• •••• 8901"
                      value={cardData.number}
                      onChange={(e) => setCardData({ ...cardData, number: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">Valid Thru (MM/YY)</label>
                      <input
                        type="text"
                        maxLength={5}
                        placeholder="12/28"
                        value={cardData.expiry}
                        onChange={(e) => setCardData({ ...cardData, expiry: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 block mb-1">CVV</label>
                      <input
                        type="password"
                        maxLength={4}
                        placeholder="•••"
                        value={cardData.cvv}
                        onChange={(e) => setCardData({ ...cardData, cvv: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Name on Card</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Sharma"
                      value={cardData.name}
                      onChange={(e) => setCardData({ ...cardData, name: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <button
                    onClick={handleConfirmPayment}
                    disabled={processing}
                    className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer mt-4"
                  >
                    {processing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Processing Card Payment...
                      </span>
                    ) : (
                      <span>Pay ₹{finalTotal} via Card →</span>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: NET BANKING */}
            {paymentMethod === 'netbanking' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">Net Banking</h3>
                  <p className="text-xs text-slate-500">Instant transfer from all major Indian banks</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2">
                  {['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Bank', 'Bank of Baroda'].map((bank) => (
                    <button
                      key={bank}
                      type="button"
                      onClick={() => setSelectedBank(bank)}
                      className={`p-3 rounded-xl border text-xs font-bold transition flex items-center gap-2 text-left ${
                        selectedBank === bank
                          ? 'border-sky-500 bg-sky-50 text-sky-900 ring-2 ring-sky-500/20'
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <Building2 className="w-4 h-4 text-sky-600 flex-shrink-0" />
                      <span className="truncate">{bank}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleConfirmPayment}
                  disabled={processing}
                  className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer mt-4"
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Redirecting to Bank...
                    </span>
                  ) : (
                    <span>Pay ₹{finalTotal} via {selectedBank} →</span>
                  )}
                </button>
              </div>
            )}

            {/* TAB CONTENT 4: INSTANT DEMO / TEST PAYMENT */}
            {paymentMethod === 'demo' && (
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Instant Demo / 1-Click Test</h3>
                    <p className="text-xs text-slate-500">Fast test route · Confirms booking immediately without opening other apps</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                    Test Mode
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Click the button below to simulate immediate payment confirmation and test the complete ticket generation, PDF pass, and calendar sync flow.
                </p>

                <button
                  onClick={handleConfirmPayment}
                  disabled={processing}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl shadow-lg shadow-emerald-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Confirming Test Booking...
                    </span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Instant Demo Payment (₹{finalTotal})</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Promo Coupon Box */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-sky-500" />
                <span>Apply Promo / Cashback Coupon</span>
              </h2>

              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. RUPADIYA100 or FIRSTTRIP"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold uppercase focus:outline-none focus:border-sky-500"
                />
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
                >
                  Apply
                </button>
              </form>

              {appliedCoupon && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between">
                  <span>{appliedCoupon.label} ({appliedCoupon.code})</span>
                  <span>-₹{appliedCoupon.discount}</span>
                </div>
              )}
            </div>

            {/* Cancel / Release */}
            <div className="text-center">
              <button
                onClick={handleReleaseSeats}
                className="text-xs font-bold text-slate-400 hover:text-rose-600 transition"
              >
                Cancel Booking & Release Seats
              </button>
            </div>
          </div>

          {/* Right Column (5 cols): Sticky Journey & Fare Summary */}
          <div className="hidden lg:block lg:col-span-5 sticky top-28 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">
                    Confirmed Corridor
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {checkoutData.trip?.route?.fromCity?.name || 'Rupadiya'} → {checkoutData.trip?.route?.toCity?.name || 'Ahmedabad'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {checkoutData.trip?.bus?.name || 'Rupadiya Intercity Bus'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-medium">Company</span>
                  <p className="text-sm font-bold text-slate-800">
                    #{checkoutData.trip?.bus?.companyCode || '01'}
                  </p>
                </div>
              </div>

              {/* Boarding & Dropping Points summary */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium block">Boarding:</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{checkoutData.boardingPoint?.name || 'Main Border Terminal'}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-medium block">Dropping:</span>
                  <span className="font-bold text-slate-800 mt-0.5 block">{checkoutData.droppingPoint?.name || 'Central Bus Terminal'}</span>
                </div>
              </div>

              {/* Passengers & Seats */}
              <div>
                <span className="text-xs font-semibold text-slate-600 block mb-2">Travelers:</span>
                <div className="space-y-1.5">
                  {checkoutData.passengers?.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="font-bold text-slate-800">{p.name || `Traveler ${idx + 1}`} ({p.age}y, {p.gender})</span>
                      <span className="font-mono font-bold text-sky-700 bg-sky-100/60 px-2 py-0.5 rounded-lg">Seat {p.seatNumber}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Phone Note */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs flex items-center justify-between">
                <span className="text-slate-500 font-medium">SMS Ticket To:</span>
                <span className="font-bold text-slate-900">+91 {checkoutData.contactPhone}</span>
              </div>

              {/* Fare Breakdown with 5% GST */}
              <div className="pt-2 border-t border-slate-100 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Base Fare ({seatsCount} Seat{seatsCount > 1 ? 's' : ''} × ₹{baseFare})</span>
                  <span className="font-bold text-slate-800">₹{baseTotal}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>GST & Govt. Taxes (5%)</span>
                  <span className="text-emerald-700 font-bold">+₹{gstAmount}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Coupon Discount</span>
                    <span>-₹{discount}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                  <span>Grand Total</span>
                  <span className="text-sky-600 font-black">₹{finalTotal}</span>
                </div>
              </div>

              {/* Next Trip Cashback Offer */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
                <Sparkles className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <span>You will earn an instant <strong>₹150 cashback coupon</strong> on completion!</span>
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Pass generated instantly upon payment confirmation</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
