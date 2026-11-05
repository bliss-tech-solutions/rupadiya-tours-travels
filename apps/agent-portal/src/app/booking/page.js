'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Ticket, 
  MapPin, 
  Calendar, 
  Search, 
  Clock, 
  Users, 
  Wallet, 
  CheckCircle2, 
  Download, 
  Printer, 
  AlertCircle, 
  RefreshCw,
  ArrowRight,
  ArrowLeftRight,
  CreditCard,
  Building2,
  Bus as BusIcon,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';
import { downloadTicketPdf } from '../../lib/pdfGenerator';
import { openRazorpayCheckout } from '../../lib/razorpay';

const HUB_CITY = 'Rupadiya';

const ROUTE_GROUPS = [
  {
    id: 'route-1-gujarat',
    name: 'Route 1 - Gujarat',
    cities: ['Himatnagar', 'Ahmedabad', 'Baroda', 'Ankleshwar', 'Surat', 'Vapi']
  },
  {
    id: 'route-2-saurashtra',
    name: 'Route 2 - Saurashtra',
    cities: ['Ambli Bopal', 'Chotila', 'Rajkot', 'Jamnagar']
  },
  {
    id: 'route-3-south',
    name: 'Route 3 - South',
    cities: ['Hyderabad', 'Bangalore']
  },
  {
    id: 'route-4-maharashtra-goa',
    name: 'Route 4 - Maharashtra / Goa',
    cities: ['Nashik', 'Mumbai', 'Pune', 'Goa']
  }
];

const SPOKE_CITIES = ROUTE_GROUPS.flatMap(g => g.cities);
const ALL_CITIES = [HUB_CITY, ...SPOKE_CITIES];

export default function AgentBookingPage() {
  // Steps: 1. SEARCH/RESULTS, 2. SEATS, 3. DETAILS_AND_PAY, 4. CONFIRMED
  const [step, setStep] = useState(1);

  // Search parameters
  const [sourceCity, setSourceCity] = useState('Rupadiya');
  const [destinationCity, setDestinationCity] = useState('Ahmedabad');
  const [travelDate, setTravelDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Results
  const [trips, setTrips] = useState([]);
  const [upcomingTrips, setUpcomingTrips] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Selected trip & seat map
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripDetail, setTripDetail] = useState(null);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [selectedSeats, setSelectedSeats] = useState([]);

  // Boarding & Dropping
  const [boardingPoint, setBoardingPoint] = useState(null);
  const [droppingPoint, setDroppingPoint] = useState(null);

  // Customer Details
  const [passengerDetails, setPassengerDetails] = useState([]);
  const [contactName, setContactName] = useState('');
  const [contactMobile, setContactMobile] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [insuranceOpted, setInsuranceOpted] = useState(false);

  // Payment Mode: 'WALLET' | 'ONLINE'
  const [paymentMode, setPaymentMode] = useState('WALLET');

  // Agent State
  const [walletBalance, setWalletBalance] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);
  const [agentSettings, setAgentSettings] = useState(null);

  // Payment Processing
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState(null);
  const [holdToken, setHoldToken] = useState(null);
  const [holdingSeats, setHoldingSeats] = useState(false);

  useEffect(() => {
    async function loadAgent() {
      try {
        const [dashRes, setRes] = await Promise.all([
          api.getDashboard().catch(() => null),
          api.getSettings().catch(() => null)
        ]);
        if (dashRes?.success) {
          const d = dashRes.data || dashRes;
          setWalletBalance(d.walletBalance ?? d.wallet?.availableBalance ?? d.wallet?.balance);
          setAgentProfile(d.agent);
        }
        if (setRes?.success) {
          const s = setRes.data?.serviceCharges || setRes.settings;
          setAgentSettings(s);
        }
      } catch (e) {}
    }
    loadAgent();
    handleSearch(null, { sourceCity: 'Rupadiya', destinationCity: 'Ahmedabad' });

    const handleWalletUpdate = () => loadAgent();
    window.addEventListener('wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
  }, []);

  // Sync passengers with selected seats
  useEffect(() => {
    setPassengerDetails((prev) => {
      const next = [];
      selectedSeats.forEach((seat, idx) => {
        const existing = prev[idx] || {};
        next.push({
          seatNumber: seat.seatNumber || seat,
          name: existing.name || '',
          age: existing.age || '25',
          gender: existing.gender || 'male'
        });
      });
      return next;
    });
  }, [selectedSeats]);

  const handleSourceChange = (newSrc) => {
    setSourceCity(newSrc);
    if (newSrc === HUB_CITY) {
      if (destinationCity === HUB_CITY) {
        setDestinationCity(SPOKE_CITIES[0]);
      }
    } else {
      setDestinationCity(HUB_CITY);
    }
  };

  const handleDestinationChange = (newDst) => {
    setDestinationCity(newDst);
    if (newDst !== HUB_CITY && sourceCity !== HUB_CITY) {
      setSourceCity(HUB_CITY);
    }
  };

  const handleSwapCities = () => {
    const nextSrc = destinationCity;
    const nextDst = sourceCity;
    setSourceCity(nextSrc);
    setDestinationCity(nextDst);
    handleSearch(null, { sourceCity: nextSrc, destinationCity: nextDst, travelDate });
  };

  const handleSearch = async (e, overrideParams) => {
    if (e?.preventDefault) e.preventDefault();
    setSearching(true);
    setSearchError('');
    setSelectedTrip(null);
    setTripDetail(null);
    setSelectedSeats([]);

    const src = overrideParams?.sourceCity || sourceCity;
    const dst = overrideParams?.destinationCity || destinationCity;
    const date = overrideParams?.travelDate || travelDate;

    try {
      const res = await api.searchTrips(src, dst, date);
      if (res?.success) {
        const foundTrips = Array.isArray(res.data) ? res.data : (res.data?.trips || res.trips || []);
        setTrips(foundTrips);
        setUpcomingTrips(res.upcomingTrips || res.data?.upcomingTrips || []);
      } else {
        setTrips([]);
        setUpcomingTrips([]);
        setSearchError(res?.error || 'No trips scheduled for this date');
      }
    } catch (err) {
      setTrips([]);
      setUpcomingTrips([]);
      setSearchError(err.message || 'Error searching bus schedules');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectTrip = async (trip) => {
    setSelectedTrip(trip);
    setLoadingTrip(true);
    setSelectedSeats([]);

    try {
      const res = await api.getTrip(trip._id);
      const t = res.trip || res.data?.trip || res.data || trip;
      if (t) {
        setTripDetail(t);
        if (t.boardingPoints?.length) {
          const bp = t.boardingPoints[0];
          setBoardingPoint({ name: bp.name || bp.location, time: bp.time || '05:30 PM' });
        } else {
          setBoardingPoint({ name: `${t.sourceCity || sourceCity} Main Terminal`, time: '05:30 PM' });
        }

        if (t.droppingPoints?.length) {
          const dp = t.droppingPoints[0];
          setDroppingPoint({ name: dp.name || dp.location, time: dp.time || '08:30 AM' });
        } else {
          setDroppingPoint({ name: `${t.destinationCity || destinationCity} Central Drop Point`, time: '08:30 AM' });
        }
        setStep(2); // Go to seat selection
      }
    } catch (err) {
      console.error(err);
      setTripDetail(trip);
      setStep(2);
    } finally {
      setLoadingTrip(false);
    }
  };

  const toggleSeat = (seat) => {
    if (seat.status && seat.status !== 'AVAILABLE') return;
    const seatId = seat.seatNumber || seat;
    const isSelected = selectedSeats.some(s => (s.seatNumber || s) === seatId);
    if (isSelected) {
      setSelectedSeats(selectedSeats.filter(s => (s.seatNumber || s) !== seatId));
    } else {
      if (selectedSeats.length >= 6) {
        alert('Maximum 6 seats can be booked in a single transaction.');
        return;
      }
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  const renderBerthCard = (seatCode) => {
    const seat = tripDetail?.seats?.find(s => s.seatNumber === seatCode) || {
      seatNumber: seatCode,
      status: 'AVAILABLE',
      fare: basePricePerSeat
    };
    const isSelected = selectedSeats.some(s => (s.seatNumber || s) === seatCode);
    const isHeld = seat.status === 'HELD';
    const isBooked = seat.status === 'BOOKED' || seat.status === 'LOCKED' || seat.status === 'BLOCKED' || isHeld;
    const isFemale = seat.gender === 'female' || seat.category === 'FEMALE_ONLY' || seat.passenger?.gender === 'female';
    const seatPrice = seat.fare || seat.price || basePricePerSeat;

    let buttonClass = '';
    if (isSelected) {
      buttonClass = 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs ring-2 ring-emerald-400';
    } else if (isHeld) {
      buttonClass = 'bg-amber-50 border-amber-300 text-amber-700 cursor-not-allowed';
    } else if (isBooked) {
      buttonClass = isFemale
        ? 'bg-pink-50 border-pink-200 text-pink-600/70 cursor-not-allowed'
        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed';
    } else {
      buttonClass = 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500 hover:bg-emerald-50/40';
    }

    return (
      <button
        key={seatCode}
        type="button"
        disabled={isBooked}
        onClick={() => toggleSeat(seat)}
        className={`w-12 h-18 sm:w-14 sm:h-20 rounded-xl border flex flex-col justify-between p-1.5 text-left transition cursor-pointer relative ${buttonClass}`}
        title={`${seatCode} · ${isHeld ? 'Held (Reserved)' : isBooked ? 'Booked' : isSelected ? 'Selected' : 'Available'}`}
      >
        <span className="text-[10px] font-mono font-bold">{seatCode}</span>
        
        {/* Pillow / Headrest indicator */}
        <div className={`w-6 h-1 rounded-full mx-auto my-0.5 ${
          isSelected ? 'bg-white/70' : isHeld ? 'bg-amber-300' : isBooked ? 'bg-slate-300' : 'bg-emerald-100'
        }`} />

        <span className="text-[9px] font-bold truncate">
          {isHeld ? 'Held' : isBooked ? 'Sold' : `₹${seatPrice}`}
        </span>
      </button>
    );
  };

  const renderSeaterButton = (seatCode) => {
    const seat = tripDetail?.seats?.find(s => s.seatNumber === seatCode) || {
      seatNumber: seatCode,
      status: 'AVAILABLE',
      fare: basePricePerSeat
    };
    const isSelected = selectedSeats.some(s => (s.seatNumber || s) === seatCode);
    const isHeld = seat.status === 'HELD';
    const isBooked = seat.status === 'BOOKED' || seat.status === 'LOCKED' || seat.status === 'BLOCKED' || isHeld;
    const isFemale = seat.gender === 'female' || seat.category === 'FEMALE_ONLY' || seat.passenger?.gender === 'female';
    const seatPrice = seat.fare || seat.price || basePricePerSeat;

    let buttonClass = '';
    if (isSelected) {
      buttonClass = 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs ring-1 ring-emerald-400';
    } else if (isHeld) {
      buttonClass = 'bg-amber-50 border-amber-300 text-amber-700 cursor-not-allowed';
    } else if (isBooked) {
      buttonClass = isFemale
        ? 'bg-pink-50 border-pink-200 text-pink-600/70 cursor-not-allowed'
        : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed';
    } else {
      buttonClass = 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500';
    }

    return (
      <button
        key={seatCode}
        type="button"
        disabled={isBooked}
        onClick={() => toggleSeat(seat)}
        className={`w-11 h-11 rounded-xl border flex flex-col justify-between p-1 text-left transition cursor-pointer ${buttonClass}`}
        title={`${seatCode} · ${isHeld ? 'Held (Reserved)' : isBooked ? 'Booked' : isSelected ? 'Selected' : 'Available'}`}
      >
        <span className="text-[10px] font-mono font-bold">{seatCode}</span>
        <span className="text-[9px] font-bold truncate">
          {isHeld ? 'Held' : isBooked ? 'Sold' : `₹${seatPrice}`}
        </span>
      </button>
    );
  };

  // Price calculations
  const seatCount = selectedSeats.length;
  const basePricePerSeat = tripDetail?.baseFare || tripDetail?.basePrice || selectedTrip?.baseFare || selectedTrip?.basePrice || 1650;
  const subtotal = selectedSeats.reduce((sum, s) => sum + (s.fare || s.price || basePricePerSeat), 0);
  const gstAmount = Math.round(subtotal * 0.05); // 5% GST
  const serviceCharge = Math.min(200, Number(agentSettings?.bookingCharge || 20) * (agentSettings?.bookingChargeType === 'FIXED' ? 1 : 1));
  const insuranceAmount = insuranceOpted ? (seatCount * 5) : 0;
  const grandTotal = subtotal + gstAmount + serviceCharge + insuranceAmount;

  const handleProceedToDetails = async () => {
    if (selectedSeats.length === 0) return;
    setHoldingSeats(true);
    setSearchError('');
    try {
      const seatNums = selectedSeats.map(s => s.seatNumber || s);
      const res = await api.holdSeats(tripDetail._id, seatNums);
      if (res && res.success !== false) {
        const token = res.holdToken || res.data?.holdToken || res.data?.holdId || res.holdId;
        setHoldToken(token);
        setStep(3);
      } else {
        const conflict = (res?.conflictingSeats || res?.conflictedSeats || []).join(', ');
        setSearchError(`Seats ${conflict ? `[${conflict}]` : ''} are already held or booked. Please choose available seats.`);
        try {
          const fresh = await api.getTrip(tripDetail._id);
          if (fresh?.data) setTripDetail(fresh.data);
        } catch (_) {}
      }
    } catch (err) {
      setSearchError(err.message || 'Selected seats are no longer available. Please select different seats.');
      try {
        const fresh = await api.getTrip(tripDetail._id);
        if (fresh?.data) setTripDetail(fresh.data);
      } catch (_) {}
    } finally {
      setHoldingSeats(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!contactMobile || contactMobile.trim().length < 10) {
      setPayError('Please enter a valid 10-digit customer mobile number.');
      return;
    }

    if (passengerDetails.some(p => !p.name?.trim())) {
      setPayError('Please fill in passenger names for all selected seats.');
      return;
    }

    if (paymentMode === 'WALLET' && walletBalance < grandTotal) {
      setPayError(`Insufficient Wallet Balance (₹${Number(walletBalance).toLocaleString('en-IN')}). Required: ₹${grandTotal.toLocaleString('en-IN')}. Please Make Deposit or pay via Online Gateway.`);
      return;
    }

    setPaying(true);
    setPayError('');

    try {
      const seatNums = selectedSeats.map(s => s.seatNumber || s);
      const formattedPassengers = passengerDetails.map(p => ({
        seatNumber: p.seatNumber,
        name: p.name.trim(),
        age: Number(p.age || 25),
        gender: p.gender || 'male',
        fare: basePricePerSeat
      }));

      const bpName = boardingPoint?.name || boardingPoint?.location || `${sourceCity} Main Station`;
      const bpTime = boardingPoint?.time || '05:30 PM';
      const dpName = droppingPoint?.name || droppingPoint?.location || `${destinationCity} Terminal`;
      const dpTime = droppingPoint?.time || '08:30 AM';

      const payload = {
        tripId: tripDetail._id,
        seatNumbers: seatNums,
        selectedSeats: seatNums,
        passengers: formattedPassengers,
        holdToken,
        contactDetails: {
          name: contactName || passengerDetails[0]?.name || 'Passenger',
          phone: contactMobile.trim(),
          email: contactEmail.trim() || 'passenger@rupadiya.test'
        },
        contactPhone: contactMobile.trim(),
        contactEmail: contactEmail.trim() || 'passenger@rupadiya.test',
        boardingPoint: { name: bpName, time: bpTime },
        droppingPoint: { name: dpName, time: dpTime },
        insuranceOpted,
        insuranceAmount,
        serviceCharge,
        agentServiceFee: serviceCharge,
        paymentMethod: paymentMode
      };

      if (paymentMode === 'WALLET') {
        const res = await api.bookWithWallet(payload);
        if (res?.success) {
          const confirmed = res.booking || res.data?.booking || res.data;
          setConfirmedBooking(confirmed);
          setStep(4);
          window.dispatchEvent(new Event('wallet-updated'));
          if (res.walletBalance !== undefined) {
            setWalletBalance(res.walletBalance);
          } else {
            try {
              const dashRes = await api.getDashboard();
              if (dashRes?.success) setWalletBalance(dashRes.data?.walletBalance ?? dashRes.data?.wallet?.availableBalance);
            } catch (e) {}
          }
        } else {
          setPayError(res?.error || 'Wallet payment authorization failed.');
        }
        setPaying(false);
      } else {
        // ONLINE CUSTOMER PAYMENT VIA RAZORPAY
        const orderRes = await api.createPaymentOrder({
          amount: grandTotal,
          purpose: 'TICKET_BOOKING',
          metadata: {
            holdToken,
            tripId: tripDetail._id,
            seatNumbers: seatNums,
            selectedSeats: seatNums,
            passengers: formattedPassengers,
            boardingPoint: { name: bpName, time: bpTime },
            droppingPoint: { name: dpName, time: dpTime },
            contactPhone: contactMobile.trim(),
            contactEmail: contactEmail.trim() || 'passenger@rupadiya.test',
            referralCode: agentProfile?.referralCode
          },
          notes: {
            corridor: `${sourceCity} to ${destinationCity}`,
            agentName: agentProfile?.name || 'Agent'
          }
        });

        if (!orderRes?.orderId) {
          throw new Error(orderRes?.error || 'Failed to initialize payment gateway order');
        }

        const methodsRes = await api.getActivePaymentMethods(agentProfile?.companyCode || 1).catch(() => null);
        await openRazorpayCheckout({
          allowedMethods: methodsRes?.allowedMethods || null,
          orderId: orderRes.orderId,
          amount: grandTotal,
          currency: 'INR',
          keyId: orderRes.keyId,
          name: 'Rupadiya Ticket Booking',
          description: `Seats: [${seatNums.join(', ')}] · ${sourceCity} → ${destinationCity}`,
          prefill: {
            name: contactName || passengerDetails[0]?.name || 'Passenger',
            email: contactEmail.trim() || 'passenger@rupadiya.test',
            contact: contactMobile.trim()
          },
          onSuccess: async (rzpResponse) => {
            try {
              const verifyRes = await api.verifyPayment({
                orderId: rzpResponse.razorpay_order_id,
                paymentId: rzpResponse.razorpay_payment_id,
                signature: rzpResponse.razorpay_signature
              });

              if (verifyRes?.success) {
                const confirmed = verifyRes.bookingResult?.booking || verifyRes.bookingResult?.data?.booking || verifyRes.bookingResult;
                setConfirmedBooking(confirmed);
                setStep(4);
                window.dispatchEvent(new Event('wallet-updated'));
              } else {
                setPayError(verifyRes?.error || 'Online payment verification failed.');
              }
            } catch (vErr) {
              setPayError(vErr.message || 'Error verifying ticket payment');
            } finally {
              setPaying(false);
            }
          },
          onDismiss: () => {
            setPaying(false);
          }
        });
      }
    } catch (err) {
      setPayError(err.message || 'Transaction error during ticket issuance');
      setPaying(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!confirmedBooking) return;
    const bus = tripDetail?.busId || tripDetail?.bus || {};
    const seatsStr = confirmedBooking.seats?.map(s => s.seatNumber || s).join(', ') || confirmedBooking.seatNumbers?.join(', ') || 'N/A';
    const depDate = tripDetail?.departureTime ? new Date(tripDetail.departureTime).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : travelDate;
    const depTime = tripDetail?.departureTime ? new Date(tripDetail.departureTime).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) : '05:30 PM';

    downloadTicketPdf({
      bookingId: confirmedBooking.pnr,
      travelerName: confirmedBooking.passengers?.[0]?.name || confirmedBooking.contactDetails?.name || 'Customer',
      busName: bus.name || 'Rupadiya Intercity Express',
      busModel: `${bus.busType || 'AC Sleeper'} Coach`,
      dateStr: depDate,
      timeStr: depTime,
      seatsStr,
      boardingName: confirmedBooking.boardingPoint?.name || confirmedBooking.boardingPoint?.location || tripDetail?.sourceCity || sourceCity,
      droppingName: confirmedBooking.droppingPoint?.name || confirmedBooking.droppingPoint?.location || tripDetail?.destinationCity || destinationCity,
      totalFare: Number(confirmedBooking.fareBreakdown?.totalPayable || confirmedBooking.pricing?.totalPrice || confirmedBooking.totalAmount || grandTotal).toLocaleString('en-IN'),
      agentCode: agentProfile?.agentCode || agentProfile?.referralCode || 'RUP-MASTER',
      agencyName: agentProfile?.agencyName || agentProfile?.name || 'Rupadiya Authorized Partner',
      passengers: confirmedBooking.passengers || []
    });
  };

  // 4 quick date buttons
  const quickDates = [
    { label: 'Today', offset: 0 },
    { label: 'Tomorrow', offset: 1 },
    { label: '+2 Days', offset: 2 },
    { label: '+3 Days', offset: 3 }
  ].map(({ label, offset }) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return {
      label,
      iso: d.toISOString().split('T')[0],
      display: d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
    };
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Ticket Booking Desk
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Book Bus Ticket</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Intercity express booking with seat selection and instant wallet or online checkout
          </p>
        </div>

        <div className="flex items-center gap-2.5 bg-slate-50 px-4 py-2 rounded-xl border border-slate-200 shrink-0">
          <Wallet className="w-4 h-4 text-emerald-600" />
          <div>
            <span className="text-[10px] text-slate-500 font-medium block">Agent Wallet</span>
            <span className="text-sm font-bold text-slate-900">
              {walletBalance !== null ? `₹${Number(walletBalance).toLocaleString('en-IN')}` : '₹...'}
            </span>
          </div>
        </div>
      </div>

      {/* STEP 1: Search & Available Bus List */}
      {step === 1 && (
        <div className="space-y-6">
          {/* Search Form Card */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* From City */}
              <div className="sm:col-span-4">
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" /> From City
                </label>
                <select
                  value={sourceCity}
                  onChange={(e) => handleSourceChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={HUB_CITY}>{HUB_CITY} (Hub)</option>
                  {ROUTE_GROUPS.map(g => (
                    <optgroup key={g.id} label={g.name}>
                      {g.cities.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Swap Button (Desktop) */}
              <div className="hidden sm:flex sm:col-span-1 justify-center pb-2">
                <button
                  type="button"
                  onClick={handleSwapCities}
                  title="Swap Origin and Destination"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 transition border border-slate-200 active:scale-95"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>
              </div>

              {/* To City */}
              <div className="sm:col-span-3">
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-sky-600" /> To Destination
                </label>
                <select
                  value={destinationCity}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                >
                  {sourceCity === HUB_CITY ? (
                    ROUTE_GROUPS.map(g => (
                      <optgroup key={g.id} label={g.name}>
                        {g.cities.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </optgroup>
                    ))
                  ) : (
                    <option value={HUB_CITY}>{HUB_CITY} (Hub)</option>
                  )}
                </select>
              </div>

              {/* Journey Date */}
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" /> Journey Date
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Search Submit */}
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={searching}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : (
                    <>
                      <Search className="w-4 h-4" /> Search Buses
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* Quick Date Pills */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-bold text-slate-400 mr-1">Quick Select:</span>
              {quickDates.map((q) => {
                const isActive = travelDate === q.iso;
                return (
                  <button
                    key={q.iso}
                    type="button"
                    onClick={() => {
                      setTravelDate(q.iso);
                      handleSearch(null, { travelDate: q.iso });
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white font-bold shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    }`}
                  >
                    {q.label} ({q.display})
                  </button>
                );
              })}
            </div>

            {searchError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Available Buses ({trips.length}) — {sourceCity} to {destinationCity} on {travelDate}
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Corridor: {sourceCity} ⇄ {destinationCity}
              </span>
            </div>

            {trips.length === 0 ? (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center text-slate-400 text-xs space-y-2">
                  <Ticket className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-semibold text-slate-600">No scheduled departures found for this corridor on {travelDate}.</p>
                  <p className="text-[11px] text-slate-400">Please choose another travel date or select one of the available dates below.</p>
                </div>

                {upcomingTrips.length > 0 && (
                  <div className="bg-white border border-emerald-200 rounded-2xl p-5 shadow-xs space-y-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">
                          Next Available Departures on this Corridor ({sourceCity} → {destinationCity}):
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Click any upcoming departure to load seats and proceed with booking:
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1">
                      {upcomingTrips.map((uTrip) => {
                        const uDate = new Date(uTrip.departureTime).toISOString().split('T')[0];
                        const uDateStr = new Date(uTrip.departureTime).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
                        const uTimeStr = new Date(uTrip.departureTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                        const busName = uTrip.busId?.name || uTrip.bus?.name || 'Rupadiya Express';
                        const fareVal = uTrip.baseFare || uTrip.basePrice || 1650;

                        return (
                          <button
                            key={uTrip._id}
                            type="button"
                            onClick={() => {
                              setTravelDate(uDate);
                              handleSearch(null, { travelDate: uDate });
                            }}
                            className="p-3 rounded-xl border border-slate-200 hover:border-emerald-500 bg-slate-50 hover:bg-emerald-50/50 text-left transition flex items-center justify-between group cursor-pointer"
                          >
                            <div>
                              <div className="text-xs font-bold text-slate-900 group-hover:text-emerald-700">
                                {uDateStr} • {uTimeStr}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                {busName} · <strong className="text-slate-800">₹{fareVal}</strong>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-0.5 transition">
                              View →
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              trips.map((trip) => {
                const bus = trip.busId || trip.bus || {};
                const availableCount = trip.availableSeatsCount ?? trip.availableSeats ?? trip.seats?.filter(s => s.status === 'AVAILABLE')?.length ?? 38;
                const depTimeStr = trip.departureTime 
                  ? new Date(trip.departureTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) 
                  : '05:30 PM';
                const arrTimeStr = trip.arrivalTime 
                  ? new Date(trip.arrivalTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) 
                  : '08:30 AM';
                const fromCityName = trip.sourceCity || trip.route?.fromCity?.name || trip.routeId?.fromCity?.name || sourceCity;
                const toCityName = trip.destinationCity || trip.route?.toCity?.name || trip.routeId?.toCity?.name || destinationCity;
                const fare = trip.baseFare || trip.basePrice || 1650;

                return (
                  <div
                    key={trip._id}
                    className="bg-white border border-slate-200/80 hover:border-emerald-300 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {bus.name || 'Rupadiya Intercity Express'}
                        </span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded">
                          {bus.busType || 'AC Sleeper (2+1)'}
                        </span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">
                          {availableCount} Seats Available
                        </span>
                      </div>

                      <div className="flex items-center gap-6 text-xs text-slate-700">
                        <div>
                          <span className="text-base font-bold text-slate-900">{depTimeStr}</span>
                          <div className="text-[11px] text-slate-500 font-medium">{fromCityName}</div>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-slate-400">Nonstop Direct</span>
                          <div className="w-16 h-0.5 bg-slate-200 relative my-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 absolute right-0 -top-0.5" />
                          </div>
                        </div>
                        <div>
                          <span className="text-base font-bold text-slate-900">{arrTimeStr}</span>
                          <div className="text-[11px] text-slate-500 font-medium">{toCityName}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center md:flex-col md:items-end justify-between gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block md:text-right">Starting from</span>
                        <div className="text-xl font-bold text-emerald-700 md:text-right">
                          ₹{Number(fare).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectTrip(trip)}
                        disabled={loadingTrip}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-xs flex items-center gap-1.5 cursor-pointer"
                      >
                        {loadingTrip ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                        <span>Select Seats →</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* STEP 2: Live Seat Selection */}
      {step === 2 && tripDetail && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(1)}
              className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              ← Back to Bus Results
            </button>
            <span className="text-xs text-slate-600 font-semibold">
              {tripDetail.sourceCity || sourceCity} → {tripDetail.destinationCity || destinationCity} • {tripDetail.busId?.name || tripDetail.bus?.name || 'Express Coach'}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Seat Map */}
            <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Select Passenger Seats</h3>
                  <p className="text-[11px] text-slate-500">Click to select up to 6 seats.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Selected ({selectedSeats.length}):</span>{' '}
                  <strong className="text-emerald-700 font-bold text-sm">
                    {selectedSeats.length > 0 ? selectedSeats.map(s => s.seatNumber || s).join(', ') : 'None'}
                  </strong>
                </div>
              </div>

              {/* SLEEPER 2+1 LAYOUT (36 Berths: 18 Lower + 18 Upper, 1 Left + 2 Right) */}
              {(tripDetail.busId?.busType?.toLowerCase().includes('sleeper') || 
                tripDetail.bus?.busType?.toLowerCase().includes('sleeper') || 
                tripDetail.layoutType === '2+1' || 
                tripDetail.seats?.some(s => s.deck === 'UPPER' || s.seatNumber?.startsWith('U'))) ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Lower Deck (18 berths: 6 rows of 1 Left + 2 Right) */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                      <span>Lower Deck (18 Berths)</span>
                      <span className="text-[10px] text-slate-400">Driver Cabin →</span>
                    </div>

                    <div className="space-y-3">
                      {[
                        { rowIdx: 1, left: 'L1', right: ['L2', 'L3'] },
                        { rowIdx: 2, left: 'L4', right: ['L5', 'L6'] },
                        { rowIdx: 3, left: 'L7', right: ['L8', 'L9'] },
                        { rowIdx: 4, left: 'L10', right: ['L11', 'L12'] },
                        { rowIdx: 5, left: 'L13', right: ['L14', 'L15'] },
                        { rowIdx: 6, left: 'L16', right: ['L17', 'L18'] }
                      ].map((row) => (
                        <div key={`lower-row-${row.rowIdx}`} className="flex items-center justify-between gap-2">
                          {/* Single Berth Left */}
                          <div>
                            {renderBerthCard(row.left)}
                          </div>

                          {/* Aisle Walkway */}
                          <div className="w-5 text-center text-[10px] text-slate-300 font-mono select-none">
                            |
                          </div>

                          {/* Double Berths Right */}
                          <div className="flex items-center gap-2">
                            {row.right.map(code => renderBerthCard(code))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Upper Deck (18 berths: 6 rows of 1 Left + 2 Right) */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                      <span>Upper Deck (18 Berths)</span>
                      <span className="text-[10px] text-slate-400">Upper Berths →</span>
                    </div>

                    <div className="space-y-3">
                      {[
                        { rowIdx: 1, left: 'U1', right: ['U2', 'U3'] },
                        { rowIdx: 2, left: 'U4', right: ['U5', 'U6'] },
                        { rowIdx: 3, left: 'U7', right: ['U8', 'U9'] },
                        { rowIdx: 4, left: 'U10', right: ['U11', 'U12'] },
                        { rowIdx: 5, left: 'U13', right: ['U14', 'U15'] },
                        { rowIdx: 6, left: 'U16', right: ['U17', 'U18'] }
                      ].map((row) => (
                        <div key={`upper-row-${row.rowIdx}`} className="flex items-center justify-between gap-2">
                          {/* Single Berth Left */}
                          <div>
                            {renderBerthCard(row.left)}
                          </div>

                          {/* Aisle Walkway */}
                          <div className="w-5 text-center text-[10px] text-slate-300 font-mono select-none">
                            |
                          </div>

                          {/* Double Berths Right */}
                          <div className="flex items-center gap-2">
                            {row.right.map(code => renderBerthCard(code))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* SEATER 2+2 LAYOUT (40 Seats: 10 Rows of 2 Left + 2 Right) */
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 max-w-md mx-auto">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                    <span>Coach Seating (2+2) · 40 Seats</span>
                    <span className="text-[10px] text-slate-400">Driver Cabin →</span>
                  </div>

                  <div className="space-y-2.5">
                    {Array.from({ length: 10 }, (_, r) => {
                      const s1 = String(r * 4 + 1);
                      const s2 = String(r * 4 + 2);
                      const s3 = String(r * 4 + 3);
                      const s4 = String(r * 4 + 4);
                      return (
                        <div key={`seater-row-${r + 1}`} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {renderSeaterButton(s1)}
                            {renderSeaterButton(s2)}
                          </div>
                          <div className="w-6 text-center text-[10px] text-slate-300 font-mono select-none">
                            Aisle
                          </div>
                          <div className="flex items-center gap-2">
                            {renderSeaterButton(s3)}
                            {renderSeaterButton(s4)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded border border-slate-300 bg-white" />
                  <span>Available</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-emerald-600" />
                  <span>Selected</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200" />
                  <span>Already Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-pink-100 border border-pink-200" />
                  <span>Female Booked</span>
                </div>
              </div>
            </div>

            {/* Fare & Proceed Summary */}
            <div className="lg:col-span-4 h-fit bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs flex flex-col justify-between">
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-slate-900">Journey Summary</h3>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Seats Selected:</span>
                    <span className="font-bold text-slate-900">{selectedSeats.length}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Base Fare:</span>
                    <span className="font-bold text-slate-900">₹{subtotal.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST (5%):</span>
                    <span className="font-bold text-slate-900">₹{gstAmount.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <span>Travel Insurance:</span>
                      <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded">₹5/pax</span>
                    </div>
                    <span className={`font-bold ${insuranceOpted ? 'text-emerald-700' : 'text-slate-400'}`}>
                      {insuranceOpted ? `+₹${insuranceAmount.toLocaleString('en-IN')}` : '₹0 (Not Opted)'}
                    </span>
                  </div>
                  {serviceCharge > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Agency Convenience Fee:</span>
                      <span className="font-bold text-slate-900">₹{serviceCharge.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                    <span>Total Amount:</span>
                    <span className="text-emerald-700 font-bold">₹{grandTotal.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              <button
                disabled={selectedSeats.length === 0 || holdingSeats}
                onClick={handleProceedToDetails}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{holdingSeats ? 'Locking Seats...' : `Continue to Passenger & Payment (${selectedSeats.length} Seats)`}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: Onboarding/Drop + Customer Details + Payment Mode (Wallet vs Online) */}
      {step === 3 && tripDetail && (
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStep(2)}
              className="text-xs text-slate-600 hover:text-slate-900 font-bold flex items-center gap-1 cursor-pointer"
            >
              ← Back to Seat Selection
            </button>
            <span className="text-xs text-slate-500 font-medium">
              Step 2 of 2: Boarding, Details & Payment
            </span>
          </div>

          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-6 shadow-xs">
            {/* 1. Onboarding & Drop Selection */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900">1. Select Boarding & Dropping Point</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Boarding Point</label>
                  <select
                    value={boardingPoint?.name || boardingPoint?.location || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = tripDetail.boardingPoints?.find(p => (p.name || p.location) === val);
                      if (found) setBoardingPoint({ name: found.name || found.location, time: found.time || '05:30 PM' });
                      else setBoardingPoint({ name: val, time: '05:30 PM' });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    {(tripDetail.boardingPoints?.length ? tripDetail.boardingPoints : [
                      { name: `${sourceCity} Main Bus Stand`, time: '05:30 PM' },
                      { name: `${sourceCity} Bypass Circle`, time: '06:00 PM' }
                    ]).map((bp, i) => (
                      <option key={i} value={bp.name || bp.location}>
                        {bp.name || bp.location} {bp.time ? `(${bp.time})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Dropping Point</label>
                  <select
                    value={droppingPoint?.name || droppingPoint?.location || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = tripDetail.droppingPoints?.find(p => (p.name || p.location) === val);
                      if (found) setDroppingPoint({ name: found.name || found.location, time: found.time || '08:30 AM' });
                      else setDroppingPoint({ name: val, time: '08:30 AM' });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    {(tripDetail.droppingPoints?.length ? tripDetail.droppingPoints : [
                      { name: `${destinationCity} Central Bus Station`, time: '08:30 AM' },
                      { name: `${destinationCity} Highway Drop Point`, time: '09:00 AM' }
                    ]).map((dp, i) => (
                      <option key={i} value={dp.name || dp.location}>
                        {dp.name || dp.location} {dp.time ? `(${dp.time})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* 2. Customer Passenger Details */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">2. Passenger Information</h3>

              <div className="space-y-3">
                {passengerDetails.map((p, idx) => (
                  <div key={idx} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-emerald-800 block">
                      Passenger {idx + 1} (Seat: {p.seatNumber})
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <div className="sm:col-span-6">
                        <input
                          type="text"
                          required
                          value={p.name}
                          onChange={(e) => {
                            const updated = [...passengerDetails];
                            updated[idx].name = e.target.value;
                            setPassengerDetails(updated);
                          }}
                          placeholder="Full Name"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={p.age}
                          onChange={(e) => {
                            const updated = [...passengerDetails];
                            updated[idx].age = e.target.value;
                            setPassengerDetails(updated);
                          }}
                          placeholder="Age"
                          className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <select
                          value={p.gender}
                          onChange={(e) => {
                            const updated = [...passengerDetails];
                            updated[idx].gender = e.target.value;
                            setPassengerDetails(updated);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer Contact */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Customer Mobile Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={contactMobile}
                    onChange={(e) => setContactMobile(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile (for SMS ticket)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Email ID (Optional)</label>
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Travel Insurance Card with Explicit Checkbox */}
            <div className={`border rounded-xl p-4 transition-all duration-200 ${
              insuranceOpted 
                ? 'bg-emerald-50/80 border-emerald-300 ring-1 ring-emerald-400' 
                : 'bg-white border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    insuranceOpted ? 'bg-emerald-600 text-white shadow-xs' : 'bg-slate-100 text-slate-500'
                  }`}>
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                      <span>Passenger Travel Protection Insurance</span>
                      <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">₹5/pax</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Accidental hospitalization up to ₹2,00,000 & emergency medical transit for {selectedSeats.length} seat(s).
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Status</span>
                    <span className={`text-xs font-bold ${insuranceOpted ? 'text-emerald-700' : 'text-slate-500'}`}>
                      {insuranceOpted ? `+₹${insuranceAmount} (Yes)` : '₹0 (No)'}
                    </span>
                  </div>

                  <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold cursor-pointer transition select-none ${
                    insuranceOpted
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
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

            {/* 3. Payment Mode (Wallet vs Online) */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">3. Select Payment Method</h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Deduct from Wallet */}
                <button
                  type="button"
                  onClick={() => setPaymentMode('WALLET')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                    paymentMode === 'WALLET'
                      ? 'bg-emerald-50/80 border-emerald-500 text-slate-900 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${paymentMode === 'WALLET' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Wallet className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Deduct from Wallet</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Bal: ₹{walletBalance != null ? Number(walletBalance).toLocaleString('en-IN') : '...'}
                    </div>
                  </div>
                </button>

                {/* Online Payment via Razorpay */}
                <button
                  type="button"
                  onClick={() => setPaymentMode('ONLINE')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-2.5 cursor-pointer ${
                    paymentMode === 'ONLINE'
                      ? 'bg-emerald-50/80 border-emerald-500 text-slate-900 ring-1 ring-emerald-500'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className={`p-2 rounded-lg ${paymentMode === 'ONLINE' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold">Online Payment</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Razorpay Gateway (Auto UPI / Cards)</div>
                  </div>
                </button>
              </div>

              {payError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{payError}</span>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex justify-between items-center text-xs">
                <span className="text-slate-600 font-medium">Total Amount Payable:</span>
                <span className="text-base font-bold text-slate-900">₹{grandTotal.toLocaleString('en-IN')}</span>
              </div>

              <button
                type="button"
                disabled={paying}
                onClick={handleConfirmBooking}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition active:scale-98 shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {paying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Authorizing Payment...
                  </>
                ) : paymentMode === 'ONLINE' ? (
                  <>Pay Online</>
                ) : (
                  <>Deduct & Issue Ticket (₹{grandTotal.toLocaleString('en-IN')}) →</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Booking Confirmed Screen */}
      {step === 4 && confirmedBooking && (
        <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Ticket Issued Successfully
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">
              PNR: #{confirmedBooking.pnr}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {tripDetail?.sourceCity || sourceCity} → {tripDetail?.destinationCity || destinationCity} • Seats: {confirmedBooking.seats?.map(s => s.seatNumber || s).join(', ') || confirmedBooking.seatNumbers?.join(', ')}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Paid Amount:</span>
              <span className="font-bold text-slate-900">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Mode:</span>
              <span className="font-semibold text-slate-800">{paymentMode === 'WALLET' ? 'Agent Wallet' : 'Online Gateway'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Passenger Mobile:</span>
              <span className="font-semibold text-slate-800">{confirmedBooking.contactDetails?.phone || contactMobile}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Boarding Point:</span>
              <span className="font-medium text-slate-700">{confirmedBooking.boardingPoint?.name || confirmedBooking.boardingPoint?.location || boardingPoint?.name}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={handleDownloadPdf}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <Link
              href={`/print-ticket?ticketId=${encodeURIComponent(confirmedBooking.pnr || confirmedBooking.bookingId || '')}&pnr=${encodeURIComponent(confirmedBooking.pnr || confirmedBooking.bookingId || '')}`}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Print Pass</span>
            </Link>
          </div>

          <button
            onClick={() => {
              setStep(1);
              setSelectedSeats([]);
              setConfirmedBooking(null);
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline pt-2 block mx-auto cursor-pointer"
          >
            Issue Another Customer Ticket
          </button>
        </div>
      )}
    </div>
  );
}
