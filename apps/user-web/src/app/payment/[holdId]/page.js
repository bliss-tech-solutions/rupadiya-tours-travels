'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  ShieldCheck, 
  CheckCircle2, 
  Tag, 
  Lock, 
  Sparkles, 
  Clock, 
  ArrowRight
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/ui/Toast';
import { openRazorpayCheckout } from '../../../lib/razorpay';

export default function PaymentPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const holdId = params.holdId;

  const [checkoutData, setCheckoutData] = useState(null);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [allowedMethods, setAllowedMethods] = useState({ upi: true, card: true, netbanking: true, wallet: true });
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes timer
  const [insuranceOpted, setInsuranceOpted] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('rupadiya_checkout');
    if (!raw) {
      router.push('/');
      return;
    }
    const data = JSON.parse(raw);
    setCheckoutData(data);
    if (data.insuranceOpted !== undefined) {
      setInsuranceOpted(Boolean(data.insuranceOpted));
    }

    // Calculate remaining seconds if expiresAt is set
    if (data.expiresAt) {
      const exp = new Date(data.expiresAt).getTime();
      const diff = Math.floor((exp - Date.now()) / 1000);
      if (diff > 0) {
        setTimeLeft(diff);
      }
    }

    // Keep active hold in localStorage for homepage banner
    sessionStorage.setItem('rupadiya_active_hold', JSON.stringify({
      holdId: data.holdId,
      holdToken: data.holdId,
      tripId: data.tripId,
      selectedSeats: data.selectedSeats,
      totalPrice: data.totalPrice,
      expiresAt: data.expiresAt || new Date(Date.now() + 600 * 1000).toISOString(),
      routeLabel: `${data.trip?.route?.fromCity?.name || 'Rupaidiha'} → ${data.trip?.route?.toCity?.name || 'Ahmedabad'}`
    }));
  }, [router]);

  // Hold Countdown Timer (10 Minutes)
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          addToast('Your 10-minute seat hold has expired. Please select your seats again.', 'warning', 'Hold Expired');
          sessionStorage.removeItem('rupadiya_active_hold');
          sessionStorage.removeItem('rupadiya_checkout');
          router.push('/');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [addToast, router]);


  useEffect(() => {
    if (checkoutData) {
      const code = checkoutData.companyCode || checkoutData.trip?.companyCode || checkoutData.trip?.bus?.companyCode;
      api.getActivePaymentMethods(code)
        .then((res) => {
          if (res?.success && res.allowedMethods) {
            setAllowedMethods(res.allowedMethods);
          }
        })
        .catch((e) => console.warn('Could not load payment methods filter:', e));
    }
  }, [checkoutData]);

  if (!checkoutData) return null;

  const minutes = Math.floor(timeLeft / 60);
  const seconds = String(timeLeft % 60).padStart(2, '0');

  const baseFare = checkoutData.baseFare || 510;
  const seatsCount = checkoutData.selectedSeats?.length || 1;
  const baseTotal = seatsCount * baseFare;
  const gstAmount = checkoutData.gstAmount || Math.round(baseTotal * 0.05);
  const insuranceAmount = insuranceOpted ? (seatsCount * 5) : 0;
  const subtotal = baseTotal + gstAmount + insuranceAmount;
  const discount = appliedCoupon ? appliedCoupon.discount : 0;
  const finalTotal = Math.max(0, subtotal - discount);

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

  // Complete Payment & Confirm Ticket via Razorpay
  const handleConfirmPayment = async () => {
    setProcessing(true);
    try {
      const orderRes = await api.createPaymentOrder({
        amount: finalTotal,
        purpose: 'TICKET_BOOKING',
        metadata: {
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
          totalAmount: finalTotal,
          insuranceOpted,
          insuranceAmount,
          couponCode: appliedCoupon?.code || null,
        },
        notes: {
          tripId: checkoutData.tripId,
          seats: checkoutData.selectedSeats?.join(', ')
        }
      });

      if (!orderRes?.orderId) {
        throw new Error(orderRes?.error || 'Failed to initialize payment gateway order');
      }

      await openRazorpayCheckout({
        orderId: orderRes.orderId,
        allowedMethods,
        amount: finalTotal,
        currency: 'INR',
        keyId: orderRes.keyId,
        name: 'Rupadiya Intercity Bus',
        description: `Seats [${checkoutData.selectedSeats?.join(', ')}] Booking`,
        prefill: {
          name: checkoutData.passengers?.[0]?.name || 'Passenger',
          email: checkoutData.contactEmail || `${checkoutData.contactPhone}@rupadiya.com`,
          contact: checkoutData.contactPhone
        },
        onSuccess: async (rzpResponse) => {
          try {
            const verifyRes = await api.verifyPayment({
              orderId: rzpResponse.razorpay_order_id,
              paymentId: rzpResponse.razorpay_payment_id,
              signature: rzpResponse.razorpay_signature
            });

            if (verifyRes?.success) {
              const booking = verifyRes.bookingResult?.booking || verifyRes.bookingResult?.data?.booking || verifyRes.bookingResult;
              const cashbackCoupon = verifyRes.bookingResult?.cashbackCoupon || {
                code: 'NEXTTRIP150',
                title: 'Flat ₹150 Cashback Coupon',
                description: 'Valid on your next intercity bus or curated tour booking',
                discount: 150,
              };

              // Store confirmed booking and coupon in session
              sessionStorage.setItem('rupadiya_confirmed_ticket', JSON.stringify({
                booking,
                cashbackCoupon,
              }));

              // Clear active hold from storage
              sessionStorage.removeItem('rupadiya_active_hold');
              sessionStorage.removeItem('rupadiya_checkout');
              sessionStorage.removeItem('rupadiya_booking_flow');

              addToast('Payment confirmed! Your ticket is booked.', 'success', 'Booking Confirmed');
              const targetId = booking?.bookingId || booking?.pnr || checkoutData.holdId;
              router.push(`/ticket/${targetId}`);
            } else {
              addToast(verifyRes?.error || 'Payment signature verification failed.', 'error', 'Payment Verification');
            }
          } catch (vErr) {
            console.error(vErr);
            addToast(vErr.message || 'Error completing booking confirmation', 'error', 'Confirmation Error');
          } finally {
            setProcessing(false);
          }
        },
        onDismiss: () => {
          setProcessing(false);
        }
      });
    } catch (err) {
      console.error(err);
      addToast(err.message || 'Payment processing failed. Please try again.', 'error', 'Payment Error');
      setProcessing(false);
    }
  };

  const handleReleaseSeats = async () => {
    try {
      await api.releaseHold(checkoutData.holdId);
    } catch (e) {}
    sessionStorage.removeItem('rupadiya_active_hold');
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

            {/* 1. Promo Coupon Box (ON TOP) */}
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
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
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

            {/* 2. DIRECT RAZORPAY PAYMENT GATEWAY ELEMENT */}
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-sm space-y-6">
              
              {/* Header with Razorpay Gateway Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-bold tracking-wide uppercase flex items-center gap-1.5 border border-blue-200/60">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      Razorpay Payment Gateway
                    </span>
                    <span className="text-xs text-slate-400 font-medium">· Official Integration</span>
                  </div>
                  <h3 className="text-xl font-black text-slate-900">
                    Pay ₹{finalTotal} via Razorpay
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Razorpay manages all payment options automatically. Fast, 100% secure, and verified.
                  </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto bg-slate-50 border border-slate-200 px-3 py-2 rounded-2xl">
                  <Lock className="w-4 h-4 text-emerald-600" />
                  <div className="text-left">
                    <span className="text-[10px] font-bold text-slate-500 block uppercase leading-none">Security</span>
                    <span className="text-xs font-black text-slate-800">256-Bit SSL</span>
                  </div>
                </div>
              </div>

              {/* Simple Guidelines */}
              <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-5 space-y-3.5 text-xs">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Accepted Instruments:</span>
                    {allowedMethods.upi && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">UPI Instant</span>
                    )}
                    {allowedMethods.card && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold">Credit/Debit Cards</span>
                    )}
                    {allowedMethods.netbanking && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-bold">NetBanking</span>
                    )}
                    {allowedMethods.wallet && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold">Wallets</span>
                    )}
                  </div>
                  <p className="text-slate-600 leading-relaxed text-xs">
                    All enabled payment channels are handled automatically inside official 256-bit encrypted Razorpay Checkout.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-slate-700 font-medium">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>Instant PNR confirmation</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>RBI-regulated security</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-purple-600 flex-shrink-0" />
                    <span>Instant seat lock guarantee</span>
                  </div>
                </div>
              </div>

              {/* Direct Razorpay Launch CTA Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={processing}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-base shadow-xl shadow-blue-500/25 transition-all active:scale-[0.99] flex items-center justify-center gap-3 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {processing ? (
                    <span className="flex items-center gap-2.5">
                      <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Connecting to Razorpay & Confirming...</span>
                    </span>
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      <span>Pay ₹{finalTotal} with Razorpay</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
                <p className="text-center text-[11px] text-slate-400 mt-2.5">
                  Opens official Razorpay checkout. After payment verification, your ticket is booked instantly.
                </p>
              </div>

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
                    {checkoutData.trip?.route?.fromCity?.name || 'Rupaidiha'} → {checkoutData.trip?.route?.toCity?.name || 'Ahmedabad'}
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
                <div className="flex justify-between items-center text-slate-600 font-medium">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={insuranceOpted}
                      onChange={(e) => setInsuranceOpted(e.target.checked)}
                      className="w-3.5 h-3.5 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                    />
                    <span>Travel Insurance</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">₹5/pax</span>
                  </label>
                  <span className={`font-bold ${insuranceOpted ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {insuranceOpted ? `+₹${insuranceAmount} (Yes)` : '₹0 (No)'}
                  </span>
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
