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
  Sparkles,
  CreditCard,
  QrCode,
  Building2
} from 'lucide-react';
import { api } from '../../lib/api';
import { downloadTicketPdf } from '../../lib/pdfGenerator';

const CITIES = [
  'Rupadiya',
  'Ahmedabad',
  'Surat',
  'Vadodara',
  'Bengaluru',
  'Hyderabad',
  'Mumbai'
];

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

  useEffect(() => {
    async function loadAgent() {
      try {
        const [dashRes, setRes] = await Promise.all([
          api.getDashboard().catch(() => null),
          api.getSettings().catch(() => null)
        ]);
        if (dashRes?.success) {
          const d = dashRes.data || dashRes;
          setWalletBalance(d.walletBalance ?? d.wallet?.availableBalance);
          setAgentProfile(d.agent);
        }
        if (setRes?.success) {
          const s = setRes.data?.serviceCharges || setRes.settings;
          setAgentSettings(s);
        }
      } catch (e) {}
    }
    loadAgent();
    handleSearch();

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

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    setSearching(true);
    setSearchError('');
    setSelectedTrip(null);
    setTripDetail(null);
    setSelectedSeats([]);

    try {
      const res = await api.searchTrips(sourceCity, destinationCity, travelDate);
      if (res?.success) {
        setTrips(res.data?.trips || res.trips || []);
      } else {
        setSearchError(res?.error || 'No trips scheduled for this date');
      }
    } catch (err) {
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
      const t = res.data?.trip || res.trip;
      if (t) {
        setTripDetail(t);
        if (t.boardingPoints?.length) setBoardingPoint(t.boardingPoints[0]);
        if (t.droppingPoints?.length) setDroppingPoint(t.droppingPoints[0]);
        setStep(2); // Go to seat selection
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTrip(false);
    }
  };

  const toggleSeat = (seat) => {
    if (seat.status && seat.status !== 'AVAILABLE') return;
    const isSelected = selectedSeats.some(s => (s.seatNumber || s) === (seat.seatNumber || seat));
    if (isSelected) {
      setSelectedSeats(selectedSeats.filter(s => (s.seatNumber || s) !== (seat.seatNumber || seat)));
    } else {
      if (selectedSeats.length >= 6) {
        alert('Maximum 6 seats can be booked in a single transaction.');
        return;
      }
      setSelectedSeats([...selectedSeats, seat]);
    }
  };

  // Price calculations
  const seatCount = selectedSeats.length;
  const basePricePerSeat = tripDetail?.basePrice || selectedTrip?.basePrice || 750;
  const subtotal = seatCount * basePricePerSeat;
  const gstAmount = Math.round(subtotal * 0.05); // 5% GST
  const serviceCharge = Math.min(200, Number(agentSettings?.bookingCharge || 20) * (agentSettings?.bookingChargeType === 'FIXED' ? 1 : 1));
  const grandTotal = subtotal + gstAmount + serviceCharge;

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
      setPayError(`Insufficient Wallet Balance (₹${Number(walletBalance).toLocaleString('en-IN')}). Required: ₹${grandTotal.toLocaleString('en-IN')}. Please Make Deposit first.`);
      return;
    }

    setPaying(true);
    setPayError('');

    try {
      const payload = {
        tripId: tripDetail._id,
        seatNumbers: selectedSeats.map(s => s.seatNumber || s),
        passengers: passengerDetails,
        contactDetails: {
          name: contactName || passengerDetails[0]?.name || 'Passenger',
          phone: contactMobile.trim(),
          email: contactEmail.trim() || 'passenger@rupadiya.test'
        },
        boardingPoint,
        droppingPoint,
        serviceCharge,
        paymentMethod: paymentMode // 'WALLET' or 'ONLINE'
      };

      const res = await api.bookWithWallet(payload);
      if (res?.success) {
        setConfirmedBooking(res.data?.booking || res.booking);
        setStep(4);
        window.dispatchEvent(new Event('wallet-updated'));
        try {
          if (typeof api.getMyWallet === 'function') {
            const w = await api.getMyWallet();
            const bal = w?.data?.balance ?? w?.wallet?.availableBalance ?? w?.data?.availableBalance ?? w?.balance;
            if (bal != null) setWalletBalance(bal);
          }
        } catch (e) {}
      } else {
        setPayError(res?.error || 'Payment and booking authorization failed.');
      }
    } catch (err) {
      setPayError(err.message || 'Transaction error during ticket issuance');
    } finally {
      setPaying(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!confirmedBooking) return;
    const bus = tripDetail?.busId || {};
    const seatsStr = confirmedBooking.seats?.map(s => s.seatNumber || s).join(', ') || 'N/A';
    const depDate = tripDetail?.departureDate ? new Date(tripDetail.departureDate).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }) : travelDate;

    downloadTicketPdf({
      bookingId: confirmedBooking.pnr,
      travelerName: confirmedBooking.passengers?.[0]?.name || confirmedBooking.contactDetails?.name || 'Customer',
      busName: bus.name || 'Rupadiya Intercity Express',
      busModel: `${bus.busType || 'AC Sleeper'} Coach`,
      dateStr: depDate,
      timeStr: tripDetail?.departureTime || '05:30 PM',
      seatsStr,
      boardingName: confirmedBooking.boardingPoint?.location || tripDetail?.sourceCity,
      droppingName: confirmedBooking.droppingPoint?.location || tripDetail?.destinationCity,
      totalFare: Number(confirmedBooking.pricing?.totalPrice || confirmedBooking.totalAmount || grandTotal).toLocaleString('en-IN'),
      agentCode: agentProfile?.agentCode || agentProfile?.referralCode || 'RUP-MASTER',
      agencyName: agentProfile?.agencyName || agentProfile?.name || 'Rupadiya Authorized Partner',
      passengers: confirmedBooking.passengers || []
    });
  };

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
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
            <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-4">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">From City</label>
                <select
                  value={sourceCity}
                  onChange={(e) => setSourceCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                >
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="sm:col-span-4">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">To Destination</label>
                <select
                  value={destinationCity}
                  onChange={(e) => setDestinationCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                >
                  {CITIES.filter(c => c !== sourceCity).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Journey Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={searching}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search Buses'}
                </button>
              </div>
            </form>

            {searchError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Results List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Available Buses ({trips.length}) — {sourceCity} to {destinationCity} on {travelDate}
            </h3>

            {trips.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 text-xs space-y-2">
                <Ticket className="w-8 h-8 mx-auto text-slate-300" />
                <p className="font-semibold text-slate-600">No scheduled departures found for this corridor on {travelDate}.</p>
                <p className="text-[11px] text-slate-400">Please choose another travel date or corridor.</p>
              </div>
            ) : (
              trips.map((trip) => {
                const bus = trip.busId || {};
                const availableCount = trip.availableSeatsCount ?? trip.seats?.filter(s => s.status === 'AVAILABLE')?.length ?? 24;
                return (
                  <div
                    key={trip._id}
                    className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition shadow-xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">{bus.name || 'Rupadiya Intercity Express'}</span>
                        <span className="text-[10px] bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded">
                          {bus.busType || 'AC Sleeper (2+1)'}
                        </span>
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded border border-emerald-200">
                          {availableCount} Seats Available
                        </span>
                      </div>

                      <div className="flex items-center gap-6 text-xs text-slate-700">
                        <div>
                          <span className="text-base font-bold text-slate-900">{trip.departureTime || '05:30 PM'}</span>
                          <div className="text-[11px] text-slate-500">{trip.sourceCity}</div>
                        </div>
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] text-slate-400">Nonstop Direct</span>
                          <div className="w-16 h-0.5 bg-slate-200 relative my-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 absolute right-0 -top-0.5" />
                          </div>
                        </div>
                        <div>
                          <span className="text-base font-bold text-slate-900">{trip.arrivalTime || '08:30 AM'}</span>
                          <div className="text-[11px] text-slate-500">{trip.destinationCity}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center md:flex-col md:items-end justify-between gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase font-semibold block md:text-right">Starting from</span>
                        <div className="text-xl font-bold text-emerald-700 md:text-right">
                          ₹{Number(trip.basePrice || 750).toLocaleString('en-IN')}
                        </div>
                      </div>

                      <button
                        onClick={() => handleSelectTrip(trip)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-xs"
                      >
                        Select Seats →
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
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
            >
              ← Back to Bus Results
            </button>
            <span className="text-xs text-slate-600 font-medium">
              {tripDetail.sourceCity} → {tripDetail.destinationCity} • {tripDetail.busId?.name}
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

              {/* SLEEPER 2+1 LAYOUT */}
              {tripDetail.busId?.busType?.toLowerCase().includes('sleeper') ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Lower Deck */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                      <span>Lower Deck</span>
                      <span className="text-[10px] text-slate-400">Front →</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {tripDetail.seats
                        .filter(s => s.seatNumber?.startsWith('L'))
                        .map((seat) => {
                          const isSelected = selectedSeats.some(s => (s.seatNumber || s) === seat.seatNumber);
                          const isBooked = seat.status === 'BOOKED' || seat.status === 'LOCKED';
                          const isFemale = seat.gender === 'female';

                          return (
                            <button
                              key={seat.seatNumber}
                              disabled={isBooked}
                              onClick={() => toggleSeat(seat)}
                              className={`h-16 rounded-xl border flex flex-col justify-between p-2 text-left transition ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                                  : isBooked
                                  ? isFemale
                                    ? 'bg-pink-50 border-pink-200 text-pink-600/70 cursor-not-allowed'
                                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500 hover:bg-emerald-50/40'
                              }`}
                            >
                              <span className="text-[10px] font-mono font-bold">{seat.seatNumber}</span>
                              <span className="text-[10px] font-bold">
                                {isBooked ? 'Sold' : `₹${seat.price || tripDetail.basePrice}`}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Upper Deck */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                      <span>Upper Deck</span>
                      <span className="text-[10px] text-slate-400">Upper Berths</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {tripDetail.seats
                        .filter(s => s.seatNumber?.startsWith('U'))
                        .map((seat) => {
                          const isSelected = selectedSeats.some(s => (s.seatNumber || s) === seat.seatNumber);
                          const isBooked = seat.status === 'BOOKED' || seat.status === 'LOCKED';
                          const isFemale = seat.gender === 'female';

                          return (
                            <button
                              key={seat.seatNumber}
                              disabled={isBooked}
                              onClick={() => toggleSeat(seat)}
                              className={`h-16 rounded-xl border flex flex-col justify-between p-2 text-left transition ${
                                isSelected
                                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-xs'
                                  : isBooked
                                  ? isFemale
                                    ? 'bg-pink-50 border-pink-200 text-pink-600/70 cursor-not-allowed'
                                    : 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                  : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500 hover:bg-emerald-50/40'
                              }`}
                            >
                              <span className="text-[10px] font-mono font-bold">{seat.seatNumber}</span>
                              <span className="text-[10px] font-bold">
                                {isBooked ? 'Sold' : `₹${seat.price || tripDetail.basePrice}`}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                /* SEATER 2+2 LAYOUT */
                <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 max-w-md mx-auto">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200 text-xs font-bold text-slate-700 uppercase">
                    <span>Coach Seating (2+2)</span>
                    <span className="text-[10px] text-slate-400">Front →</span>
                  </div>

                  <div className="grid grid-cols-4 gap-2.5">
                    {tripDetail.seats.map((seat, i) => {
                      const isSelected = selectedSeats.some(s => (s.seatNumber || s) === (seat.seatNumber || seat));
                      const isBooked = seat.status === 'BOOKED' || seat.status === 'LOCKED';
                      return (
                        <button
                          key={seat.seatNumber || i}
                          disabled={isBooked}
                          onClick={() => toggleSeat(seat)}
                          className={`h-12 rounded-xl border flex flex-col justify-between p-1.5 text-left transition ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                              : isBooked
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : 'bg-white border-slate-200 text-slate-800 hover:border-emerald-500'
                          } ${i % 4 === 1 ? 'mr-3' : ''}`}
                        >
                          <span className="text-[10px] font-mono font-bold">{seat.seatNumber}</span>
                          <span className="text-[9px] font-bold">{isBooked ? 'Sold' : `₹${seat.price || tripDetail.basePrice}`}</span>
                        </button>
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
            <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs flex flex-col justify-between">
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
                disabled={selectedSeats.length === 0}
                onClick={() => setStep(3)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold rounded-xl text-xs transition active:scale-95 shadow-xs flex items-center justify-center gap-2"
              >
                <span>Continue to Passenger & Payment ({selectedSeats.length} Seats)</span>
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
              className="text-xs text-slate-600 hover:text-slate-900 font-semibold"
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
                    value={boardingPoint?.location || ''}
                    onChange={(e) => {
                      const pt = tripDetail.boardingPoints?.find(p => p.location === e.target.value);
                      if (pt) setBoardingPoint(pt);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    {tripDetail.boardingPoints?.map((bp, i) => (
                      <option key={i} value={bp.location}>
                        {bp.location} ({bp.time})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Dropping Point</label>
                  <select
                    value={droppingPoint?.location || ''}
                    onChange={(e) => {
                      const pt = tripDetail.droppingPoints?.find(p => p.location === e.target.value);
                      if (pt) setDroppingPoint(pt);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                  >
                    {tripDetail.droppingPoints?.map((dp, i) => (
                      <option key={i} value={dp.location}>
                        {dp.location} ({dp.time})
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
                    value={contactMobile}
                    onChange={(e) => setContactMobile(e.target.value)}
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

            {/* 3. Payment Mode (Wallet vs Online) */}
            <div className="space-y-3 pt-3 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">3. Select Payment Method</h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Deduct from Wallet */}
                <button
                  type="button"
                  onClick={() => setPaymentMode('WALLET')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-2.5 ${
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

                {/* Online Payment */}
                <button
                  type="button"
                  onClick={() => setPaymentMode('ONLINE')}
                  className={`p-3.5 rounded-xl border text-left transition flex items-start gap-2.5 ${
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
                    <div className="text-[11px] text-slate-500 mt-0.5">UPI, Card, Net Banking</div>
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
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition active:scale-98 shadow-xs flex items-center justify-center gap-2"
              >
                {paying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Authorizing Payment...
                  </>
                ) : (
                  <>Confirm & Issue Ticket (₹{grandTotal.toLocaleString('en-IN')}) →</>
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
              {tripDetail?.sourceCity} → {tripDetail?.destinationCity} • Seats: {confirmedBooking.seats?.map(s => s.seatNumber || s).join(', ') || confirmedBooking.seatNumbers?.join(', ')}
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
              <span className="font-medium text-slate-700">{confirmedBooking.boardingPoint?.location || boardingPoint?.location}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
            <button
              onClick={handleDownloadPdf}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
            <Link
              href={`/print-ticket`}
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
            className="text-xs text-slate-500 hover:text-slate-800 underline pt-2 block mx-auto"
          >
            Issue Another Customer Ticket
          </button>
        </div>
      )}
    </div>
  );
}
