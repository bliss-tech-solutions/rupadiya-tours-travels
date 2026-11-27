'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PhoneInput from '../../../components/ui/PhoneInput';
import { isValidPhone, PHONE_ERROR } from '../../../lib/phone';
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

import { seatFareList, sumFares, fareLineLabel } from '../../../lib/fares';

// Helper: check if two seats are side-by-side in Sleeper or Seater
function areSeatsSideBySide(seatA, seatB) {
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
}

// Check if adjacent seat is booked by female.
function isAdjacentFemale(seatNumber, seats = []) {
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
  const adj = (seats || []).find(
    (s) => s.seatNumber === adjNum || s.seatNumber === adjNum.replace(/\D/g, '')
  );
  return adj?.status === 'BOOKED' && adj?.passenger?.gender === 'female';
}

export default function CheckoutPassengerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const holdId = params.holdId;

  const [checkoutData, setCheckoutData] = useState(null);
  const [passengers, setPassengers] = useState([]);
  const [contactPhone, setContactPhone] = useState('');
  const [insuranceOpted, setInsuranceOpted] = useState(false);
  const insurancePerPassenger = 28; // fixed ₹28 per passenger
  const [contactEmail, setContactEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState({ name: '', phone: '', relation: '' });
  const [submittingHold, setSubmittingHold] = useState(false);

  useEffect(() => {
    // Seats already held for payment in this tab (hold still running): go back to the payment
    // page instead of holding again, which would restart the 10-minute timer.
    try {
      const paying = JSON.parse(sessionStorage.getItem('rupadiya_checkout') || 'null');
      if (paying?.holdId && paying.expiresAt && new Date(paying.expiresAt).getTime() > Date.now() + 5000) {
        router.replace(`/payment/${paying.holdId}`);
        return;
      }
    } catch (e) { /* ignore bad session data */ }

    const raw = sessionStorage.getItem('rupadiya_booking_flow') || sessionStorage.getItem('rupadiya_checkout');
    if (!raw) {
      router.push('/');
      return;
    }
    const data = JSON.parse(raw);
    setCheckoutData(data);

    // Initialize passenger array for each selected seat. Seats beside an already-booked female
    // passenger are female-only, so default their gender to female.
    const initialPassengers = (data.selectedSeats || []).map((seatNumber) => ({
      seatNumber,
      name: '',
      age: '',
      gender: isAdjacentFemale(seatNumber, data.trip?.seats) ? 'female' : 'male',
      infants: [],
    }));
    setPassengers(initialPassengers);

    // Try prefilling contact from logged in user if available
    const userRaw = localStorage.getItem('rupadiya_user');
    if (userRaw) {
      try {
        const u = JSON.parse(userRaw);
        if (u.phone) setContactPhone(u.phone);
        if (u.email && !/@guest\.|@rupadiya\.(test|com)$/i.test(u.email)) setContactEmail(u.email);
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
  const seatFares = (checkoutData.seatFares && checkoutData.seatFares.length)
    ? checkoutData.seatFares
    : seatFareList(checkoutData.selectedSeats || [], checkoutData.trip?.seats || [], baseFare);
  const baseTotal = sumFares(seatFares);
  const gstAmount = Math.round(baseTotal * 0.05); // 5% GST
  const platformFee = Math.round(baseTotal * 0.05); // 5% platform fee
  const insuranceAmount = insuranceOpted ? (seatsCount * insurancePerPassenger) : 0; // fixed ₹28 per passenger
  const gatewayFee = Math.round((baseTotal + gstAmount + platformFee + insuranceAmount) * 0.025); // 2.5% online payment charge (estimate)
  const totalPayable = baseTotal + gstAmount + platformFee + insuranceAmount + gatewayFee;

  const updateInfant = (pIdx, iIdx, field, value) => setPassengers((prev) => prev.map((p, i) => (i === pIdx
    ? { ...p, infants: (p.infants || []).map((inf, j) => (j === iIdx ? { ...inf, [field]: value } : inf)) }
    : p)));
  const addInfant = (pIdx) => setPassengers((prev) => prev.map((p, i) => (i === pIdx ? { ...p, infants: [...(p.infants || []), { name: '', age: '', gender: '' }] } : p)));
  const removeInfant = (pIdx, iIdx) => setPassengers((prev) => prev.map((p, i) => (i === pIdx ? { ...p, infants: (p.infants || []).filter((_, j) => j !== iIdx) } : p)));

  const checkAdjacentFemale = (seatNumber) => isAdjacentFemale(seatNumber, checkoutData?.trip?.seats);

  const handlePassengerChange = (index, field, value) => {
    setPassengers((prev) => {
      const updated = [...prev];
      const p = { ...updated[index], [field]: value };

      // Female safety preference check
      if (field === 'gender' && value === 'male') {
        if (checkAdjacentFemale(p.seatNumber)) {
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
      if (p.gender === 'male' && checkAdjacentFemale(p.seatNumber)) {
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

    for (const p of passengers) {
      for (const [i, inf] of (p.infants || []).entries()) {
        const a = Number(inf.age);
        if (!inf.name || inf.name.trim().length < 2 || !Number.isInteger(a) || a < 0 || a > 4 || !inf.gender) {
          addToast(`Complete infant ${i + 1} details for seat ${p.seatNumber} (name, age under 5, gender).`, 'warning', 'Infant Details');
          return;
        }
      }
    }

    if (!isValidPhone(contactPhone)) {
      addToast(PHONE_ERROR, 'warning', 'Contact Info');
      return;
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      addToast('Please enter a valid email address or leave it empty.', 'warning', 'Contact Info');
      return;
    }
    const ec = emergencyContact;
    if (ec.name || ec.phone || ec.relation) {
      if (ec.name.trim().length < 2 || !isValidPhone(ec.phone) || ec.relation.trim().length < 2) {
        addToast('Complete the emergency contact (name, mobile number, relation) or leave it empty.', 'warning', 'Emergency Contact');
        return;
      }
    }

    setSubmittingHold(true);
    try {
      // Hold seats atomically on backend when proceeding to payment
      const cleanPassengers = passengers.map((p) => ({
        ...p,
        infants: (p.infants || []).map((inf) => ({ name: inf.name.trim(), age: Number(inf.age), gender: inf.gender }))
      }));
      const holdRes = await api.holdSeats(checkoutData.tripId, checkoutData.selectedSeats, {
        passengers: cleanPassengers,
        boardingPoint: checkoutData.boardingPoint?.name,
        droppingPoint: checkoutData.droppingPoint?.name,
        contactPhone
      });

      const actualHoldId = holdRes.holdToken || holdRes.data?.holdToken || holdRes.data?.holdId || holdRes.holdId;
      if (!actualHoldId) throw new Error(holdRes?.error || 'Could not hold the selected seats.');
      // Prices are locked by the server at hold time — use them from here on.
      const lockedQuote = holdRes.quote || null;
      const lockedSeatFares = lockedQuote?.seatFares?.length ? lockedQuote.seatFares : seatFares;
      const lockedBaseTotal = lockedQuote?.subtotal ?? baseTotal;
      const lockedGst = lockedQuote?.gstAmount ?? Math.round(lockedBaseTotal * 0.05);
      const expiresAt = holdRes.expiresAt || new Date(Date.now() + 10 * 60 * 1000).toISOString();

      const finalCheckoutData = {
        ...checkoutData,
        holdId: actualHoldId,
        holdToken: actualHoldId,
        passengers: cleanPassengers,
        contactPhone,
        contactEmail: contactEmail.trim(),
        emergencyContact: (emergencyContact.name || emergencyContact.phone) ? {
          name: emergencyContact.name.trim(), phone: emergencyContact.phone, relation: emergencyContact.relation.trim()
        } : null,
        baseFare,
        seatFares: lockedSeatFares,
        baseTotal: lockedBaseTotal,
        gstAmount: lockedGst,
        insuranceOpted,
        insurancePerPassenger,
        insuranceAmount,
        totalPrice: totalPayable,
        expiresAt,
        routeLabel: `${checkoutData.trip?.route?.fromCity?.name || 'Rupaidiha'} → ${checkoutData.trip?.route?.toCity?.name || 'Ahmedabad'}`
      };

      // Store in session and localStorage for homepage active hold banner
      sessionStorage.setItem('rupadiya_checkout', JSON.stringify(finalCheckoutData));
      sessionStorage.setItem('rupadiya_active_hold', JSON.stringify(finalCheckoutData));

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
                const adjFemale = checkAdjacentFemale(passenger.seatNumber);
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

                      {/* Gender — a seat beside a booked female passenger is female-only. */}
                      <div className="sm:col-span-3">
                        <label className="text-xs font-bold text-slate-600 block mb-1.5">
                          Gender *
                        </label>
                        {adjFemale ? (
                          <div
                            title="This seat is next to a booked female passenger, so it can only be booked for a female traveller."
                            className="w-full px-3 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-700 flex items-center gap-1.5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                            Female only
                          </div>
                        ) : (
                          <select
                            value={passenger.gender}
                            onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-sky-500 bg-white"
                          >
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                          </select>
                        )}
                      </div>
                    </div>

                    {Number(passenger.age) >= 5 && Number(passenger.age) <= 11 && (
                      <p className="text-[11px] text-sky-700 font-semibold">Child (5–11 years) · needs own seat at full fare</p>
                    )}

                    {(passenger.infants || []).map((inf, iIdx) => (
                      <div key={iIdx} className="grid grid-cols-12 gap-2 items-center bg-sky-50/60 border border-sky-100 rounded-2xl p-3">
                        <span className="col-span-12 text-[11px] font-bold text-sky-800">Infant {iIdx + 1} on lap (under 5, free, no seat)</span>
                        <input value={inf.name} placeholder="Infant name" maxLength={60}
                          onChange={(e) => updateInfant(index, iIdx, 'name', e.target.value)}
                          className="col-span-12 sm:col-span-6 px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white" />
                        <select value={inf.age} onChange={(e) => updateInfant(index, iIdx, 'age', e.target.value)}
                          className="col-span-5 sm:col-span-2 px-2 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                          <option value="">Age</option>
                          {[0, 1, 2, 3, 4].map((a) => <option key={a} value={a}>{a} yr</option>)}
                        </select>
                        <select value={inf.gender} onChange={(e) => updateInfant(index, iIdx, 'gender', e.target.value)}
                          className="col-span-5 sm:col-span-3 px-2 py-2 rounded-xl border border-slate-200 text-sm bg-white">
                          <option value="">Gender</option>
                          <option value="male">Boy</option>
                          <option value="female">Girl</option>
                        </select>
                        <button type="button" onClick={() => removeInfant(index, iIdx)} className="col-span-2 sm:col-span-1 text-xs font-bold text-rose-600">
                          Remove
                        </button>
                      </div>
                    ))}
                    {Number(passenger.age) >= 18 && (passenger.infants || []).length < 2 && (
                      <button type="button" onClick={() => addInfant(index)} className="text-xs font-bold text-sky-600 hover:text-sky-800">
                        + Add infant travelling on lap (under 5 years)
                      </button>
                    )}
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
                    Mobile Number (India / Nepal) *
                  </label>
                  <PhoneInput required value={contactPhone} onChange={setContactPhone} className="max-w-sm" />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Your ticket is sent to this number on WhatsApp. When you sign in with this number later, your trips will be waiting for you.
                  </p>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1.5">
                    Email (optional) — we also email your ticket
                  </label>
                  <input
                    type="email"
                    placeholder="you@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value.trim())}
                    className="w-full max-w-sm px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Emergency contact */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">Emergency Contact (recommended)</h3>
                <p className="text-[11px] text-slate-500">Someone we can call if there is an emergency during your journey.</p>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_1fr] gap-3">
                  <input value={emergencyContact.name} placeholder="Name" maxLength={60}
                    onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm" />
                  <PhoneInput value={emergencyContact.phone}
                    onChange={(v) => setEmergencyContact({ ...emergencyContact, phone: v })} />
                  <select value={emergencyContact.relation} onChange={(e) => setEmergencyContact({ ...emergencyContact, relation: e.target.value })}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white">
                    <option value="">Relation</option>
                    {['Father', 'Mother', 'Husband', 'Wife', 'Son', 'Daughter', 'Brother', 'Sister', 'Friend', 'Other'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Travel Protection Insurance Card with Explicit Checkbox */}
              <div className={`rounded-3xl border p-5 sm:p-6 transition-all duration-200 ${
                insuranceOpted 
                  ? 'bg-emerald-50/70 border-emerald-300 ring-1 ring-emerald-400/80 shadow-xs' 
                  : 'bg-white border-slate-200/90 shadow-sm'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 mt-0.5 ${
                      insuranceOpted ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-bold text-slate-900">Passenger Travel Protection Insurance</h3>
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                          ₹{insurancePerPassenger} / passenger
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Comprehensive cover including accidental hospitalization up to ₹2,00,000, 24x7 emergency medical assistance & baggage loss for {seatsCount} traveler{seatsCount > 1 ? 's' : ''}.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Insurance</span>
                      <span className={`text-xs font-bold ${insuranceOpted ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {insuranceOpted ? `+₹${insuranceAmount} (Yes)` : '₹0 (No)'}
                      </span>
                    </div>

                    <label className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-bold cursor-pointer transition select-none ${
                      insuranceOpted 
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20' 
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}>
                      <input
                        type="checkbox"
                        checked={insuranceOpted}
                        onChange={(e) => setInsuranceOpted(e.target.checked)}
                        className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer accent-emerald-600"
                      />
                      <span>{insuranceOpted ? 'Yes, Covered' : 'No, Skip'}</span>
                    </label>
                  </div>
                </div>

              </div>

                            {/* Mobile Fare & GST Calculation Breakdown */}
              <div className="lg:hidden bg-white rounded-3xl border border-slate-200 p-5 shadow-sm space-y-2.5 text-xs">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">
                  Fare Calculation & Taxes
                </h4>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>{fareLineLabel(seatFares)}</span>
                  <span className="font-bold text-slate-800">₹{baseTotal}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>GST & Govt. Taxes (5%)</span>
                  <span className="font-bold text-emerald-700">+₹{gstAmount}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Platform fee (5%)</span>
                  <span className="font-bold text-slate-800">+₹{platformFee}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Payment gateway charge (2.5%, est.)</span>
                  <span className="font-bold text-slate-800">+₹{gatewayFee}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span>Travel Insurance</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">₹{insurancePerPassenger}/pax</span>
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
                    {checkoutData.trip?.route?.fromCity?.name || 'Rupaidiha'} → {checkoutData.trip?.route?.toCity?.name || 'Ahmedabad'}
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
                  <span>{fareLineLabel(seatFares)}</span>
                  <span className="font-bold text-slate-800">₹{baseTotal}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>GST & Govt. Taxes (5%)</span>
                  <span className="text-emerald-700 font-bold">+₹{gstAmount}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Platform fee (5%)</span>
                  <span className="font-bold text-slate-800">+₹{platformFee}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Payment gateway charge (2.5%, est.)</span>
                  <span className="font-bold text-slate-800">+₹{gatewayFee}</span>
                </div>
                <div className="flex justify-between text-slate-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span>Passenger Insurance</span>
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.2 rounded">₹{insurancePerPassenger}/pax</span>
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
