'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Clock, 
  ShieldCheck, 
  User, 
  Phone, 
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Lock
} from 'lucide-react';
import { api } from '../../../lib/api';
import { useToast } from '../../../components/ui/Toast';
import { formatDate, formatTime } from '../../../lib/dateUtils';

export default function CheckoutPassengerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const holdId = params.holdId;

  const [checkoutData, setCheckoutData] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [contactPhone, setContactPhone] = useState('');
  const [insuranceOpted, setInsuranceOpted] = useState(true);
  const [submittingHold, setSubmittingHold] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('rupadiya_booking_flow') || sessionStorage.getItem('rupadiya_checkout');
    if (!raw) {
      router.push('/');
      return;
    }
    const data = JSON.parse(raw);
    setCheckoutData(data);

    // Initialize passenger array for each selected seat
    const initialPassengers = (data.selectedSeats || []).map((seatNumber) => ({
      seatNumber,
      name: '',
      age: '',
      gender: 'male',
    }));
    setPassengers(initialPassengers);

    // Try prefilling contact from logged in user if available
    const userRaw = localStorage.getItem('rupadiya_user');
    if (userRaw) {
      try {
        const u = JSON.parse(userRaw);
        if (u.phone) setContactPhone(u.phone);
        if (initialPassengers.length > 0 && u.name && u.name !== 'Traveler') {
          initialPassengers[0].name = u.name;
        }
      } catch (e) {}
    }
  }, [router]);

  if (!checkoutData) {
    return null;
  }

  // Exact Fare & 5% GST Calculation Breakdown
  const baseFare = checkoutData.baseFare || 510;
  const seatsCount = checkoutData.selectedSeats?.length || 1;
  const baseTotal = seatsCount * baseFare;
  const gstAmount = Math.round(baseTotal * 0.05); // 5% GST
  const insuranceAmount = insuranceOpted ? (seatsCount * 5) : 0; // ₹5/passenger
  const totalPayable = baseTotal + gstAmount + insuranceAmount;

  // Helper: check if two seats are side-by-side in Sleeper or Seater
  const areSeatsSideBySide = (seatA, seatB) => {
    if (!seatA || !seatB) return false;
    const strA = seatA.toString();
    const strB = seatB.toString();

    // Sleeper (L1..L18, U1..U18)
    if (strA.startsWith('L') || strA.startsWith('U') || strB.startsWith('L') || strB.startsWith('U')) {
      const deckA = strA[0];
      const deckB = strB[0];
      if (deckA !== deckB) return false;
      const numA = parseInt(strA.replace(/\D/g, ''), 10);
      const numB = parseInt(strB.replace(/\D/g, ''), 10);
      const min = Math.min(numA, numB);
      const max = Math.max(numA, numB);
      // Double berths are (2, 3), (5, 6), (8, 9), (11, 12), (14, 15), (17, 18)
      return (
        (min === 2 && max === 3) ||
        (min === 5 && max === 6) ||
        (min === 8 && max === 9) ||
        (min === 11 && max === 12) ||
        (min === 14 && max === 15) ||
        (min === 17 && max === 18)
      );
    }

    // Seater (2+2)
    const numA = parseInt(strA, 10);
    const numB = parseInt(strB, 10);
    if (isNaN(numA) || isNaN(numB)) return false;
    const min = Math.min(numA, numB);
    const max = Math.max(numA, numB);
    const rowA = Math.floor((numA - 1) / 4);
    const rowB = Math.floor((numB - 1) / 4);
    if (rowA !== rowB) return false;
    const offsetMin = (min - 1) % 4;
    return (offsetMin === 0 && max === min + 1) || (offsetMin === 2 && max === min + 1);
  };

  // Check if adjacent seat is booked by female
  const isAdjacentFemale = (seatNumber) => {
    if (!seatNumber) return false;
    const str = seatNumber.toString();
    let adjNum = null;

    if (str.startsWith('L') || str.startsWith('U')) {
      const deck = str[0];
      const num = parseInt(str.replace(/\D/g, ''), 10);
      const pairs = {
        2: 3, 3: 2,
        5: 6, 6: 5,
        8: 9, 9: 8,
        11: 12, 12: 11,
        14: 15, 15: 14,
        17: 18, 18: 17
      };
      if (pairs[num]) {
        adjNum = `${deck}${pairs[num]}`;
      }
    } else {
      const num = parseInt(str, 10);
      if (!isNaN(num)) {
        const offset = (num - 1) % 4;
        if (offset === 0) adjNum = (num + 1).toString();
        if (offset === 1) adjNum = (num - 1).toString();
        if (offset === 2) adjNum = (num + 1).toString();
        if (offset === 3) adjNum = (num - 1).toString();
      }
    }

    if (!adjNum) return false;
    const adj = checkoutData.trip?.seats?.find(
      (s) => s.seatNumber === adjNum || s.seatNumber === adjNum.replace(/\D/g, '')
    );
    return adj?.status === 'BOOKED' && adj?.passenger?.gender === 'female';
  };

  const handlePassengerChange = (index, field, value) => {
    setPassengers((prev) => {
      const updated = [...prev];
      const p = { ...updated[index], [field]: value };

      // Female safety preference check
      if (field === 'gender' && value === 'male') {
        if (isAdjacentFemale(p.seatNumber)) {
          addToast(
            `Seat ${p.seatNumber} is adjacent to an already booked female passenger. For safety & comfort, only female travelers can book this seat.`,
            'error',
            'Female Preference Enforced'
          );
          p.gender = 'female';
        }
      }

      updated[index] = p;
      return updated;
    });
  };

  const handleProceedToPayment = async (e) => {
    e.preventDefault();

    // Validations
    for (const p of passengers) {
      if (!p.name.trim()) {
        addToast(`Please enter traveler name for Seat ${p.seatNumber}.`, 'warning', 'Missing Details');
        return;
      }
      if (!p.age || parseInt(p.age, 10) < 1 || parseInt(p.age, 10) > 120) {
        addToast(`Please enter a valid age for Seat ${p.seatNumber}.`, 'warning', 'Missing Details');
        return;
      }
      if (p.gender === 'male' && isAdjacentFemale(p.seatNumber)) {
        addToast(
          `Seat ${p.seatNumber} cannot be booked by a male passenger due to adjacent female seat reservation policy.`,
          'error',
          'Policy Warning'
        );
        return;
      }
    }

    if (passengers.length === 2) {
      const isSideBySide = areSeatsSideBySide(passengers[0].seatNumber, passengers[1].seatNumber);
      const isMixedGender = passengers[0].gender !== passengers[1].gender;
      if (isMixedGender && !isSideBySide) {
        addToast(
          `Seats [${passengers[0].seatNumber}, ${passengers[1].seatNumber}] are not side-by-side. Mixed male and female booking is only allowed for side-by-side seats. Please book male with male, or female with female.`,
          'error',
          'Gender Seating Policy'
        );
        return;
      }
    }

    if (!contactPhone || contactPhone.length < 10) {
      addToast('Please enter a valid 10-digit mobile number for ticket SMS updates.', 'warning', 'Contact Info');
      return;
    }

    setSubmittingHold(true);
    try {
      // Hold seats atomically on backend when proceeding to payment
      const holdRes = await api.holdSeats(checkoutData.tripId, checkoutData.selectedSeats, {
        passengers,
        boardingPoint: checkoutData.boardingPoint?.name,
        droppingPoint: checkoutData.droppingPoint?.name,
        contactPhone
      });

      const actualHoldId = holdRes.holdToken || holdRes.data?.holdToken || holdRes.data?.holdId || holdRes.holdId || 'HOLD_' + Date.now();
      const expiresAt = holdRes.expiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const finalCheckoutData = {
        ...checkoutData,
        holdId: actualHoldId,
        holdToken: actualHoldId,
        passengers,
        contactPhone,
        contactEmail: `${contactPhone}@rupadiya.com`,
        baseFare,
        baseTotal,
        gstAmount,
        insuranceOpted,
        insuranceAmount,
        totalPrice: totalPayable,
        expiresAt,
        routeLabel: `${checkoutData.trip?.route?.fromCity?.name || 'Rupadiya'} → ${checkoutData.trip?.route?.toCity?.name || 'Ahmedabad'}`
      };

      // Store in session and localStorage for homepage active hold banner
      sessionStorage.setItem('rupadiya_checkout', JSON.stringify(finalCheckoutData));
      localStorage.setItem('rupadiya_active_hold', JSON.stringify(finalCheckoutData));

      addToast('Seats reserved! 10-minute payment timer started.', 'success', 'Seats Locked');
      router.push(`/payment/${actualHoldId}`);
    } catch (err) {
      addToast(err.message || 'Could not hold seats. Someone may have just selected them.', 'error', 'Hold Failed');
    } finally {
      setSubmittingHold(false);
    }
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
            <h1 className="text-base font-black text-slate-900">Passenger Information</h1>
            <p className="text-xs text-slate-500">Step 3 of 4 · Enter traveler details</p>
          </div>
          <div className="w-9" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between px-2 mb-6 text-xs font-bold text-slate-400">
          <span className="text-emerald-600 flex items-center gap-1">✓ 1. Seats</span>
          <span className="text-emerald-600 flex items-center gap-1">✓ 2. Boarding Points</span>
          <span className="text-sky-600 font-extrabold flex items-center gap-1">● 3. Travelers</span>
          <span>○ 4. Payment</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7 cols): Passenger Form & Contact */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Informative Guarantee Card */}
            <div className="bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-200 rounded-3xl p-4 sm:p-5 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500 text-white flex items-center justify-center flex-shrink-0 shadow-md shadow-sky-500/20">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-sky-900 uppercase tracking-wider">Fast Traveler Details</h2>
                  <p className="text-xs text-sky-700 font-medium">
                    Seats <span className="font-bold text-slate-900">[{checkoutData.selectedSeats.join(', ')}]</span> will be locked for 10 minutes on next step.
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 text-[10px] font-bold">
                  {checkoutData.selectedSeats?.length} Seat{checkoutData.selectedSeats?.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <form id="passenger-form" onSubmit={handleProceedToPayment} className="space-y-6">
              {/* Passenger Details Cards */}
              {passengers.map((passenger, index) => {
                const adjFemale = isAdjacentFemale(passenger.seatNumber);
                return (
                  <div
                    key={passenger.seatNumber}
                    className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-sky-500 text-white text-xs font-black flex items-center justify-center">
                          {passenger.seatNumber}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900">
                          Passenger {index + 1} · Seat {passenger.seatNumber}
                        </h3>
                      </div>
                      {adjFemale && (
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Female Safety Preference
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                      {/* Name */}
                      <div className="sm:col-span-6">
                        <label className="text-xs font-bold text-slate-600 block mb-1.5">
                          Full Name (as on Govt ID) *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Rahul Sharma"
                          value={passenger.name}
                          onChange={(e) => handlePassengerChange(index, 'name', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                        />
                      </div>

                      {/* Age */}
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-slate-600 block mb-1.5">
                          Age *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="120"
                          placeholder="28"
                          value={passenger.age}
                          onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-sky-500"
                        />
                      </div>

                      {/* Gender */}
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-slate-600 block mb-1.5">
                          Gender *
                        </label>
                        <select
                          value={passenger.gender}
                          onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                          className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-sky-500 bg-white"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Primary Contact Details Card - Phone only, no email per user request */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Phone className="w-4 h-4 text-sky-500" />
                  <span>Contact Mobile Number for Ticket & Pass SMS</span>
                </h3>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">
                    10-Digit Mobile Number *
                  </label>
                  <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-sky-500 max-w-sm">
                    <span className="text-xs font-bold text-slate-400">+91</span>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-sm font-bold focus:outline-none bg-transparent"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Your bus ticket link will be sent here. When you sign in with this number later, your trips will be waiting for you.
                  </p>
                </div>
              </div>

              {/* Mobile Fare & GST Calculation Breakdown */}
              <div className="lg:hidden bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-2.5 text-xs">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                  Fare Calculation & Taxes
                </h4>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Base Fare ({seatsCount} Seat{seatsCount > 1 ? 's' : ''} × ₹{baseFare})</span>
                  <span className="font-bold text-slate-800">₹{baseTotal}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>GST & Govt. Taxes (5%)</span>
                  <span className="font-bold text-emerald-700">+₹{gstAmount}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span>Travel Insurance</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">₹5/pax</span>
                  </div>
                  <span className={`font-bold ${insuranceOpted ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {insuranceOpted ? `+₹${insuranceAmount}` : '₹0 (Not Opted)'}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total Payable Amount</span>
                  <span className="text-sky-600">₹{totalPayable}</span>
                </div>
              </div>

              {/* Mobile Proceed Button */}
              <div className="lg:hidden">
                <button
                  type="submit"
                  disabled={submittingHold}
                  className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-base cursor-pointer"
                >
                  {submittingHold ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Locking Seats & Loading Payment...
                    </span>
                  ) : (
                    <>
                      <span>Proceed to Payment (₹{totalPayable})</span>
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column (5 cols): Sticky Summary Sidebar */}
          <div className="hidden lg:block lg:col-span-5 sticky top-28 space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-5">
              
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 bg-sky-50 px-2.5 py-1 rounded-full">
                    Step 3 of 4
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2">
                    {checkoutData.trip?.route?.fromCity?.name || 'Rupadiya'} → {checkoutData.trip?.route?.toCity?.name || 'Ahmedabad'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {checkoutData.trip?.bus?.name || 'Rupadiya Intercity Bus'}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400 font-medium">Seats</span>
                  <p className="text-sm font-bold text-slate-800">
                    [{checkoutData.selectedSeats?.join(', ')}]
                  </p>
                </div>
              </div>

              {/* Boarding Point */}
              {checkoutData.boardingPoint && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 font-medium">Boarding Point:</span>
                    <span className="font-bold text-sky-600">{formatTime(checkoutData.boardingPoint.time)}</span>
                  </div>
                  <span className="font-bold text-slate-800 mt-0.5 block">{checkoutData.boardingPoint.name}</span>
                </div>
              )}

              {/* Price Breakdown with 5% GST Calculation */}
              <div className="pt-2 border-t border-slate-100 space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Base Fare ({seatsCount} Seat{seatsCount > 1 ? 's' : ''} × ₹{baseFare})</span>
                  <span className="font-bold text-slate-800">₹{baseTotal}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>GST & Govt. Taxes (5%)</span>
                  <span className="text-emerald-700 font-bold">+₹{gstAmount}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span>Passenger Insurance</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">₹5/pax</span>
                  </div>
                  <span className={`font-bold ${insuranceOpted ? 'text-emerald-700' : 'text-slate-400'}`}>
                    {insuranceOpted ? `+₹${insuranceAmount}` : '₹0'}
                  </span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                  <span>Total Payable</span>
                  <span className="text-sky-600 font-black">₹{totalPayable}</span>
                </div>
              </div>

              {/* Desktop Submit Button linked to form */}
              <button
                type="submit"
                form="passenger-form"
                disabled={submittingHold}
                className="w-full py-4 bg-sky-500 hover:bg-sky-600 text-white font-bold rounded-2xl shadow-md shadow-sky-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-sm cursor-pointer"
              >
                {submittingHold ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Locking Seats...
                  </span>
                ) : (
                  <span>Proceed to Payment (₹{totalPayable}) →</span>
                )}
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-1">
                <Clock className="w-3.5 h-3.5 text-sky-500" />
                <span>10-minute countdown starts on payment screen</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
