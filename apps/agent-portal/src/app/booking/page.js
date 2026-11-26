'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import PhoneInput from '../../components/ui/PhoneInput';
import { formatPhone, isValidPhone, PHONE_ERROR } from '../../lib/phone';
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
  ChevronRight,
  X,
  Info,
  Check,
  Timer,
  Banknote,
  Baby,
  Plus,
  Trash2
} from 'lucide-react';
import { api } from '../../lib/api';
import { downloadTicketPdf } from '../../lib/pdfGenerator';
import { openRazorpayCheckout } from '../../lib/razorpay';

const HUB_CITY = 'Rupaidiha';

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

// Seat pairs used for the "ladies seat" rule (mirrors the server's Trip.getAdjacentSeatNumber).
function getAdjacentSeatCode(code) {
  const str = String(code || '').trim().toUpperCase();
  if (str.startsWith('L') || str.startsWith('U')) {
    const deck = str[0];
    const num = parseInt(str.slice(1), 10);
    const pairs = { 2: 3, 3: 2, 5: 6, 6: 5, 8: 9, 9: 8, 11: 12, 12: 11, 14: 15, 15: 14, 17: 18, 18: 17 };
    return pairs[num] ? `${deck}${pairs[num]}` : null;
  }
  const num = parseInt(str, 10);
  if (Number.isNaN(num) || num < 1) return null;
  const rem = (num - 1) % 4;
  if (rem === 0 || rem === 2) return String(num + 1);
  return String(num - 1);
}

const seatCodeOf = (s) => String(s?.seatNumber ?? s ?? '').trim();
const lc = (s) => seatCodeOf(s).toLowerCase();

function newClientRef() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch (e) {}
  return `ref_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

const PANEL_STEPS = [
  { id: 'POINTS', label: 'Boarding & Dropping' },
  { id: 'PASSENGERS', label: 'Passengers' },
  { id: 'PAYMENT', label: 'Review & Pay' }
];

export default function AgentBookingPage() {
  // Page steps: 1 = search/results, 2 = seat selection + booking panel, 4 = confirmed
  const [step, setStep] = useState(1);
  // Right panel wizard: POINTS → PASSENGERS → PAYMENT
  const [panelStep, setPanelStep] = useState('POINTS');

  // Search parameters
  const [sourceCity, setSourceCity] = useState('Rupaidiha');
  const [destinationCity, setDestinationCity] = useState('Ahmedabad');
  const [travelDate, setTravelDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  // Customer details
  const [passengerDetails, setPassengerDetails] = useState([]);
  const [contactMobile, setContactMobile] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [insuranceOpted, setInsuranceOpted] = useState(false);
  const insurancePerPassenger = 28; // fixed ₹28 per passenger
  const [emergencyContact, setEmergencyContact] = useState({ name: '', phone: '', relation: '' });

  // Payment
  const [paymentMode, setPaymentMode] = useState('WALLET');
  const [walletBalance, setWalletBalance] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);
  const [agentSettings, setAgentSettings] = useState(null);
  const [quote, setQuote] = useState(null);

  // Hold + processing
  const [holdInfo, setHoldInfo] = useState(null); // { holdToken, seatNumbers, expiresAt }
  const [holdSecondsLeft, setHoldSecondsLeft] = useState(0);
  const [holdingSeats, setHoldingSeats] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Refs used inside WebSocket / timer callbacks (avoid stale closures)
  const myClientRefs = useRef(new Set());     // every clientRef this tab has sent
  const pendingHoldSeatsRef = useRef(null);   // seats of an in-flight hold request
  const holdRef = useRef(null);               // current active hold
  const tripIdRef = useRef(null);

  useEffect(() => { holdRef.current = holdInfo; }, [holdInfo]);
  useEffect(() => { tripIdRef.current = tripDetail?._id || selectedTrip?._id || null; }, [tripDetail?._id, selectedTrip?._id]);

  // In-app toast
  const [toast, setToast] = useState(null);
  const showToast = (message, type = 'info') => setToast({ message, type, id: Date.now() });
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const formatTimer = (totalSeconds) => {
    const s = Math.max(0, totalSeconds);
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const refreshTrip = async (tripId = tripIdRef.current) => {
    if (!tripId) return;
    try {
      const fresh = await api.getTrip(tripId);
      const t = fresh?.trip || fresh?.data;
      if (t?.seats) setTripDetail((prev) => (prev ? { ...prev, ...t } : t));
    } catch (e) {}
  };

  /**
   * Release the active hold (if any). `goTo` decides where the panel returns to.
   */
  const handleCancelHold = async (reasonMessage = '', goTo = 'PASSENGERS') => {
    const current = holdRef.current;
    holdRef.current = null;
    setHoldInfo(null);
    setHoldSecondsLeft(0);
    setQuote(null);
    setPayError('');
    setPanelStep(goTo);

    if (current?.holdToken) {
      try {
        await api.releaseHold(current.holdToken);
      } catch (e) {}
    }
    if (reasonMessage) showToast(reasonMessage, 'warning');
    refreshTrip();
  };

  // Single hold countdown, derived from the server's expiry (no drift).
  useEffect(() => {
    if (!holdInfo?.expiresAt) return;
    const expiry = new Date(holdInfo.expiresAt).getTime();
    const tick = () => {
      const left = Math.max(0, Math.round((expiry - Date.now()) / 1000));
      setHoldSecondsLeft(left);
      if (left <= 0) {
        clearInterval(timer);
        handleCancelHold('Seat hold expired. Seats were released — continue again to re-hold them.', 'PASSENGERS');
      }
    };
    const timer = setInterval(tick, 1000);
    tick();
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdInfo?.holdToken, holdInfo?.expiresAt]);

  // Release the hold if the agent closes / reloads the tab mid-checkout.
  useEffect(() => {
    const onUnload = () => {
      const h = holdRef.current;
      if (!h?.holdToken) return;
      try {
        const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';
        fetch(`${base}/bookings/hold/release`, {
          method: 'POST',
          keepalive: true,
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-rupadiya-client': 'agent-portal',
            ...(localStorage.getItem('agent_token') ? { Authorization: `Bearer ${localStorage.getItem('agent_token')}` } : {})
          },
          body: JSON.stringify({ holdToken: h.holdToken })
        });
      } catch (e) {}
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  useEffect(() => {
    async function loadAgent() {
      try {
        const [dashRes, setRes] = await Promise.all([
          api.getDashboard().catch(() => null),
          api.getSettings().catch(() => null)
        ]);
        if (dashRes?.success) {
          const d = dashRes.data || dashRes;
          setWalletBalance(d.walletBalance ?? d.wallet?.availableBalance ?? d.wallet?.balance ?? 0);
          setAgentProfile(d.agent);
        }
        if (setRes?.success) {
          setAgentSettings(setRes.data?.serviceCharges || setRes.settings);
        }
      } catch (e) {}
    }
    loadAgent();
    handleSearch(null, { sourceCity: 'Rupaidiha', destinationCity: 'Ahmedabad' });

    const handleWalletUpdate = () => loadAgent();
    window.addEventListener('wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep one passenger row per selected seat (preserve what was typed).
  useEffect(() => {
    setPassengerDetails((prev) => {
      const bySeat = new Map(prev.map((p) => [lc(p.seatNumber), p]));
      return selectedSeats.map((seat) => {
        const code = seatCodeOf(seat);
        const existing = bySeat.get(code.toLowerCase());
        return existing || { seatNumber: code, name: '', age: '', gender: '' };
      });
    });
    if (selectedSeats.length === 0) setPanelStep('POINTS');
  }, [selectedSeats]);

  const isHub = (city) => {
    if (!city) return false;
    const l = city.toLowerCase().trim();
    return l.includes('rupaidiha') || l.includes('rupadiya');
  };

  const handleSourceChange = (newSrc) => {
    setSourceCity(newSrc);
    if (newSrc === HUB_CITY) {
      if (destinationCity === HUB_CITY) setDestinationCity(SPOKE_CITIES[0]);
    } else {
      setDestinationCity(HUB_CITY);
    }
  };

  const handleDestinationChange = (newDst) => {
    setDestinationCity(newDst);
    if (newDst === HUB_CITY) {
      if (sourceCity === HUB_CITY) setSourceCity(SPOKE_CITIES[0]);
    } else {
      setSourceCity(HUB_CITY);
    }
  };

  const handleSwapCities = () => {
    let nextSrc, nextDst;
    if (isHub(sourceCity)) {
      nextSrc = isHub(destinationCity) ? SPOKE_CITIES[0] : destinationCity;
      nextDst = HUB_CITY;
    } else {
      nextDst = isHub(sourceCity) ? SPOKE_CITIES[0] : sourceCity;
      nextSrc = HUB_CITY;
    }
    setSourceCity(nextSrc);
    setDestinationCity(nextDst);
    handleSearch(null, { sourceCity: nextSrc, destinationCity: nextDst, travelDate });
  };

  const resetBookingDraft = () => {
    setSelectedSeats([]);
    setPassengerDetails([]);
    setQuote(null);
    setPayError('');
    setPanelStep('POINTS');
  };

  const handleSearch = async (e, overrideParams) => {
    if (e?.preventDefault) e.preventDefault();
    setSearching(true);
    setSearchError('');
    setSelectedTrip(null);
    setTripDetail(null);
    resetBookingDraft();

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

  const pointKey = (p) => (p ? `${p.name || p.location}` : '');
  const pointTime = (p, base) => {
    if (!p) return '';
    if (p.time) return p.time;
    if (base && Number.isFinite(Number(p.timeOffsetMinutes))) {
      return new Date(new Date(base).getTime() + Number(p.timeOffsetMinutes) * 60000)
        .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return base ? new Date(base).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';
  };

  const handleSelectTrip = async (trip) => {
    setSelectedTrip(trip);
    setLoadingTrip(true);
    resetBookingDraft();
    setBoardingPoint(null);
    setDroppingPoint(null);

    try {
      const res = await api.getTrip(trip._id);
      const t = res.trip || res.data?.trip || res.data || trip;
      setTripDetail(t);
      if (t.boardingPoints?.length === 1) {
        const bp = t.boardingPoints[0];
        setBoardingPoint({ name: bp.name || bp.location, time: pointTime(bp, t.departureTime) });
      }
      if (t.droppingPoints?.length === 1) {
        const dp = t.droppingPoints[0];
        setDroppingPoint({ name: dp.name || dp.location, time: pointTime(dp, t.arrivalTime) });
      }
      setStep(2);
    } catch (err) {
      showToast(err.message || 'Could not load seat layout for this bus.', 'warning');
    } finally {
      setLoadingTrip(false);
    }
  };

  /**
   * Reconcile the agent's current selection with fresh seat statuses.
   * Seats already secured by this tab's hold are never treated as conflicts.
   */
  const reconcileSelection = (unavailableLower, reason) => {
    if (holdRef.current) return; // our seats are held by us — nothing to reconcile
    const pending = pendingHoldSeatsRef.current;
    setSelectedSeats((prev) => {
      const lost = prev.filter((s) => unavailableLower.has(lc(s)) && !(pending && pending.has(lc(s))));
      if (lost.length === 0) return prev;
      showToast(
        `Seat ${lost.map(seatCodeOf).join(', ')} ${lost.length > 1 ? 'were' : 'was'} just ${reason} by another customer and removed from your selection.`,
        'warning'
      );
      return prev.filter((s) => !lost.includes(s));
    });
  };

  // Live WebSocket seat synchronisation + polling fallback
  useEffect(() => {
    const currentTripId = tripDetail?._id || selectedTrip?._id;
    if (step !== 2 || !currentTripId) return;

    let ws = null;
    let reconnectTimer = null;
    let isUnmounted = false;

    const applyStatus = (codes, status, onlyIf) => {
      const set = new Set(codes);
      setTripDetail((prev) => {
        if (!prev?.seats) return prev;
        return {
          ...prev,
          seats: prev.seats.map((s) => (set.has(lc(s)) && (!onlyIf || onlyIf(s)) ? { ...s, status } : s))
        };
      });
    };

    const connect = () => {
      try {
        const isSecure = window.location.protocol === 'https:';
        let host = window.location.hostname === 'localhost' ? 'localhost:4500' : window.location.host;
        if (process.env.NEXT_PUBLIC_API_URL) {
          try { host = new URL(process.env.NEXT_PUBLIC_API_URL).host; } catch (e) {}
        }
        ws = new WebSocket(`${isSecure ? 'wss' : 'ws'}://${host}/ws?room=trip:${currentTripId}`);

        ws.onopen = () => ws.send(JSON.stringify({ action: 'subscribe', room: `trip:${currentTripId}` }));

        ws.onmessage = (event) => {
          let parsed;
          try { parsed = JSON.parse(event.data); } catch (e) { return; }
          const { event: evtType, data } = parsed || {};
          if (!data || (data.tripId && String(data.tripId) !== String(currentTripId))) return;
          const codes = (data.seatNumbers || []).map((s) => String(s).trim().toLowerCase());
          if (codes.length === 0 && evtType !== 'SEAT_FARES_UPDATED') return;

          if (evtType === 'SEATS_HELD') {
            // Our own hold (sent with our clientRef) is not "another customer".
            const isOurs = data.clientRef && myClientRefs.current.has(data.clientRef);
            applyStatus(codes, 'HELD', (s) => s.status === 'AVAILABLE');
            if (!isOurs) reconcileSelection(new Set(codes), 'reserved');
          } else if (evtType === 'SEATS_RELEASED') {
            applyStatus(codes, 'AVAILABLE', (s) => s.status === 'HELD');
          } else if (evtType === 'SEAT_FARES_UPDATED') {
            // Company repriced seats: update labels live (an active hold keeps its locked price).
            const fareMap = new Map((data.seatFares || []).map((f) => [String(f.seatNumber).trim().toLowerCase(), f.fare]));
            setTripDetail((prev) => (prev?.seats
              ? { ...prev, seats: prev.seats.map((s) => (fareMap.has(lc(s)) ? { ...s, fare: fareMap.get(lc(s)) } : s)) }
              : prev));
          } else if (evtType === 'SEATS_BOOKED') {
            applyStatus(codes, 'BOOKED');
            const mine = holdRef.current?.seatNumbers?.map((s) => String(s).toLowerCase()) || [];
            const foreign = codes.filter((c) => !mine.includes(c));
            if (foreign.length) reconcileSelection(new Set(foreign), 'booked');
            refreshTrip(currentTripId); // pick up ladies-seat flags for neighbours
          }
        };

        ws.onclose = () => {
          if (!isUnmounted) reconnectTimer = setTimeout(connect, 3000);
        };
        ws.onerror = () => {
          try { ws.close(); } catch (e) {}
        };
      } catch (e) {}
    };

    connect();

    // Polling fallback (covers missed socket events and other API nodes)
    const pollTimer = setInterval(async () => {
      try {
        const res = await api.getTrip(currentTripId);
        const t = res.trip || res.data?.trip || res.data;
        if (!t?.seats) return;
        setTripDetail((prev) => (prev ? { ...prev, seats: t.seats } : t));
        const unavailable = new Set(t.seats.filter((s) => s.status !== 'AVAILABLE').map(lc));
        reconcileSelection(unavailable, 'booked');
      } catch (e) {}
    }, 8000);

    return () => {
      isUnmounted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(pollTimer);
      if (ws) {
        try { ws.close(); } catch (e) {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, tripDetail?._id, selectedTrip?._id]);

  const findSeat = (code) => tripDetail?.seats?.find((s) => lc(s) === String(code).trim().toLowerCase());

  // A seat is "ladies only" when its pair seat is booked by a female passenger.
  const isLadiesOnlySeat = (code) => {
    const seat = findSeat(code);
    if (seat?.ladiesOnly) return true;
    const adj = getAdjacentSeatCode(code);
    if (!adj) return false;
    const adjSeat = findSeat(adj);
    const g = adjSeat?.bookedGender || adjSeat?.passenger?.gender;
    return adjSeat?.status === 'BOOKED' && g === 'female';
  };

  const toggleSeat = (seat) => {
    if (holdInfo) {
      showToast('These seats are held for payment. Use "Change seats" to release them before selecting others.', 'info');
      return;
    }
    const seatId = seatCodeOf(seat);
    const isSelected = selectedSeats.some((s) => lc(s) === seatId.toLowerCase());
    if (isSelected) {
      setSelectedSeats(selectedSeats.filter((s) => lc(s) !== seatId.toLowerCase()));
      return;
    }
    if (seat.status && seat.status !== 'AVAILABLE') {
      showToast(`Seat ${seatId} is ${seat.status === 'HELD' ? 'being booked by another customer right now' : 'already booked'}.`, 'warning');
      return;
    }
    if (selectedSeats.length >= 6) {
      showToast('Maximum 6 seats can be booked in a single transaction.', 'warning');
      return;
    }
    if (isLadiesOnlySeat(seatId)) {
      showToast(`Seat ${seatId} is a ladies seat (next to a female passenger). It can only be booked for a female traveller.`, 'info');
    }
    setSelectedSeats([...selectedSeats, seat]);
  };

  const basePricePerSeat = tripDetail?.baseFare || tripDetail?.basePrice || selectedTrip?.baseFare || 0;

  
const seatVisual = (seatCode) => {
  const seat = findSeat(seatCode) || {
    seatNumber: seatCode,
    status: 'AVAILABLE',
    fare: basePricePerSeat
  };

  const isSelected = selectedSeats.some(
    (s) => lc(s) === String(seatCode).toLowerCase()
  );

  const status = String(seat.status || 'AVAILABLE').toUpperCase();
  const isHeld = status === 'HELD';

  const isBooked = ['BOOKED', 'LOCKED', 'BLOCKED'].includes(status);

  const gender = String(
    seat.bookedGender || seat.passenger?.gender || ''
  ).toLowerCase();

  const bookedMale = isBooked && gender === 'male';
  const bookedFemale = isBooked && gender === 'female';

  const ladiesOnly = !isBooked && !isHeld && isLadiesOnlySeat(seatCode);

  const seatPrice = seat.fare || seat.price || basePricePerSeat;

  let cls = '';

  if (isSelected) {
    cls = 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-300 shadow-sm';
  } else if (bookedFemale) {
    cls = 'bg-pink-100/40 text-pink-700 border-pink-300 cursor-not-allowed';
  } else if (bookedMale) {
    cls = 'bg-blue-100/40 text-sky-700 border-sky-300 cursor-not-allowed';
  } else if (isHeld) {
    cls = 'bg-amber-50 text-amber-700 border-amber-300 cursor-not-allowed';
  } else if (isBooked) {
    cls = 'bg-slate-200 text-slate-500 border-slate-300 cursor-not-allowed';
  } else if (ladiesOnly) {
    cls = ' text-pink-700 border-2 border-pink-400 hover:bg-pink-100';
  } else {
    cls = 'bg-white text-slate-800 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50';
  }

  let label = `₹${seatPrice}`;

  if (isSelected) label = 'Selected';
  else if (isHeld) label = 'On hold';
  else if (bookedFemale) label = 'Booked';
  else if (bookedMale) label = 'Booked';
  else if (isBooked) label = 'Booked';
  else if (ladiesOnly) label = 'Ladies';

  const title = `${seatCode} · ${
    isSelected ? 'Selected' :
    isHeld ? 'On hold by another customer' :
    bookedFemale ? 'Booked by female passenger' :
    bookedMale ? 'Booked by male passenger' :
    isBooked ? 'Booked / unavailable' :
    ladiesOnly ? 'Ladies only — female passenger' :
    'Available'
  }`;

  return {
    seat,
    isSelected,
    isUnavailable: isHeld || isBooked,
    bookedMale,
    bookedFemale,
    ladiesOnly,
    cls,
    label,
    title
  };
};


  const renderBerthCard = (seatCode) => {
    const v = seatVisual(seatCode);
    return (
      <button
        key={seatCode}
        type="button"
        disabled={v.isUnavailable && !v.isSelected}
        onClick={() => toggleSeat(v.seat)}
        className={`w-12 h-18 sm:w-14 sm:h-20 rounded-xl border flex flex-col justify-between p-1.5 text-left transition cursor-pointer relative ${v.cls}`}
        title={v.title}
        aria-label={v.title}
      >
        <span className="text-[10px] font-mono font-bold">{seatCode}</span>
        <div className={`w-6 h-1 rounded-full mx-auto my-0.5 ${v.isSelected ? 'bg-white/70' : 'bg-current opacity-30'}`} />
        <span className="text-[9px] font-bold truncate">{v.label}</span>
      </button>
    );
  };

  const renderSeaterButton = (seatCode) => {
    const v = seatVisual(seatCode);
    return (
      <button
        key={seatCode}
        type="button"
        disabled={v.isUnavailable && !v.isSelected}
        onClick={() => toggleSeat(v.seat)}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg border font-bold text-xs flex flex-col items-center justify-center transition cursor-pointer relative ${v.cls}`}
        title={v.title}
        aria-label={v.title}
      >
        <span>{seatCode}</span>
        <span className="text-[8px] font-normal leading-none mt-0.5">{v.label}</span>
      </button>
    );
  };

  // ----- Price (preview before hold; authoritative quote after hold) -----
  const seatCount = selectedSeats.length;
  const previewSubtotal = selectedSeats.reduce((sum, s) => sum + (Number(findSeat(seatCodeOf(s))?.fare) || basePricePerSeat), 0);
  const previewGst = Math.round(previewSubtotal * 0.05);
  const previewInsurance = insuranceOpted ? seatCount * insurancePerPassenger : 0;
  const previewPlatformFee = Math.round(previewSubtotal * 0.05);
  // Agent's own service charge (wallet / cash: collected in hand; online: collected through Razorpay).
  const settingsCharge = 0; // agent booking charge removed platform-wide
  // Razorpay charge (2.5%) applies only when the customer pays online; the server quote is authoritative.
  const previewGatewayFee = paymentMode === 'ONLINE'
    ? Math.round((previewSubtotal + previewGst + previewPlatformFee + previewInsurance) * 0.025)
    : 0;
  const fare = quote
    ? {
        subtotal: quote.subtotal,
        gstAmount: quote.gstAmount,
        platformFee: quote.platformFee || 0,
        gatewayFee: quote.gatewayFee || 0,
        insuranceAmount: quote.insuranceAmount,
        insurancePerPassenger: quote.insurancePerPassenger || 0,
        discountAmount: quote.discountAmount || 0,
        agentServiceCharge: quote.agentServiceCharge || 0,
        totalPayable: quote.totalPayable,
        customerTotal: quote.customerTotal ?? quote.totalPayable
      }
    : {
        subtotal: previewSubtotal,
        gstAmount: previewGst,
        platformFee: previewPlatformFee,
        gatewayFee: previewGatewayFee,
        insuranceAmount: previewInsurance,
        insurancePerPassenger: insuranceOpted ? insurancePerPassenger : 0,
        discountAmount: 0,
        agentServiceCharge: settingsCharge,
        totalPayable: previewSubtotal + previewGst + previewPlatformFee + previewInsurance + previewGatewayFee,
        customerTotal: previewSubtotal + previewGst + previewPlatformFee + previewInsurance + previewGatewayFee + settingsCharge
      };
  const serviceCharge = fare.agentServiceCharge;
  const customerTotal = fare.customerTotal;

  // ----- Step validation -----
  const validatePoints = () => {
    if (!boardingPoint?.name) return 'Please choose a boarding point.';
    if (!droppingPoint?.name) return 'Please choose a dropping point.';
    return '';
  };

  const validatePassengers = () => {
    for (const p of passengerDetails) {
      if (!p.name || p.name.trim().length < 2) return `Enter the full name for seat ${p.seatNumber}.`;
      const age = Number(p.age);
      if (!Number.isInteger(age) || age < 1 || age > 120) return `Enter a valid age for seat ${p.seatNumber}.`;
      if (!p.gender) return `Select the gender for seat ${p.seatNumber}.`;
      if (isLadiesOnlySeat(p.seatNumber) && p.gender !== 'female') {
        return `Seat ${p.seatNumber} is next to a female passenger and can only be booked for a female traveller. Change the gender or pick another seat.`;
      }
    }
    for (const p of passengerDetails) {
      for (const [i, inf] of (p.infants || []).entries()) {
        if (!inf.name || inf.name.trim().length < 2) return `Enter the name of infant ${i + 1} with seat ${p.seatNumber}.`;
        const a = Number(inf.age);
        if (!Number.isInteger(a) || a < 0 || a > 4) return `Infant ${i + 1} with seat ${p.seatNumber} must be under 5 (children 5+ need their own seat).`;
        if (!inf.gender) return `Select the gender of infant ${i + 1} with seat ${p.seatNumber}.`;
      }
    }
    if (!isValidPhone(contactMobile)) return `Customer mobile: ${PHONE_ERROR}`;
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) return 'Enter a valid customer email or leave it empty.';
    const ec = emergencyContact;
    if (ec.name || ec.phone || ec.relation) {
      if (ec.name.trim().length < 2) return 'Enter the emergency contact name.';
      if (!isValidPhone(ec.phone)) return `Emergency contact: ${PHONE_ERROR}`;
      if (ec.relation.trim().length < 2) return 'Enter the emergency contact relation (e.g. Father, Wife).';
    }
    return '';
  };

  const addInfant = (idx) => {
    setPassengerDetails((prev) => prev.map((p, i) => (i === idx ? { ...p, infants: [...(p.infants || []), { name: '', age: '', gender: '' }] } : p)));
  };
  const updateInfant = (idx, infIdx, field, value) => {
    setPassengerDetails((prev) => prev.map((p, i) => (i === idx
      ? { ...p, infants: (p.infants || []).map((inf, j) => (j === infIdx ? { ...inf, [field]: value } : inf)) }
      : p)));
  };
  const removeInfant = (idx, infIdx) => {
    setPassengerDetails((prev) => prev.map((p, i) => (i === idx ? { ...p, infants: (p.infants || []).filter((_, j) => j !== infIdx) } : p)));
  };

  const goToPassengers = () => {
    const err = validatePoints();
    if (err) {
      setPayError(err);
      return;
    }
    setPayError('');
    setPanelStep('PASSENGERS');
  };

  const updatePassenger = (idx, field, value) => {
    setPassengerDetails((prev) => {
      const next = prev.map((p) => ({ ...p }));
      if (field === 'gender' && value !== 'female' && isLadiesOnlySeat(next[idx].seatNumber)) {
        showToast(`Seat ${next[idx].seatNumber} is a ladies seat — only a female passenger can be booked on it.`, 'warning');
        return prev;
      }
      next[idx][field] = value;
      return next;
    });
  };

  const formattedPassengers = () => passengerDetails.map((p) => ({
    seatNumber: p.seatNumber,
    name: p.name.trim(),
    age: Number(p.age),
    gender: p.gender,
    infants: (p.infants || []).map((inf) => ({ name: inf.name.trim(), age: Number(inf.age), gender: inf.gender }))
  }));

  const emergencyPayload = () => (emergencyContact.name || emergencyContact.phone
    ? { name: emergencyContact.name.trim(), phone: emergencyContact.phone, relation: emergencyContact.relation.trim() }
    : null);

  // Re-quote whenever the payment option or insurance changes (gateway fee applies to online only).
  useEffect(() => {
    if (!holdInfo?.holdToken || !tripDetail?._id) return;
    let cancelled = false;
    api.getQuote({
      tripId: tripDetail._id,
      seatNumbers: holdInfo.seatNumbers,
      insuranceOpted,
      insurancePerPassenger,
      holdToken: holdInfo.holdToken,
      paymentChannel: paymentMode
    }).then((qr) => { if (!cancelled && qr?.quote) setQuote(qr.quote); }).catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMode, insuranceOpted, insurancePerPassenger, holdInfo?.holdToken]);

  /**
   * Passengers → Payment: hold the seats now (10 min) with the manifest,
   * so the server validates seat availability and the ladies-seat rule up-front.
   */
  const handleProceedToPayment = async () => {
    const err = validatePassengers();
    if (err) {
      setPayError(err);
      showToast(err, 'warning');
      return;
    }
    setPayError('');
    setHoldingSeats(true);

    const seatNums = selectedSeats.map(seatCodeOf);
    const clientRef = newClientRef();
    myClientRefs.current.add(clientRef);
    pendingHoldSeatsRef.current = new Set(seatNums.map((s) => s.toLowerCase()));

    try {
      const res = await api.holdSeats(tripDetail._id, seatNums, formattedPassengers(), clientRef);
      if (!res?.holdToken) throw new Error(res?.error || 'Could not hold the selected seats.');

      const hold = { holdToken: res.holdToken, seatNumbers: res.seatNumbers || seatNums, expiresAt: res.expiresAt };
      holdRef.current = hold;
      setHoldInfo(hold);

      let q = res.quote || null;
      try {
        const qr = await api.getQuote({ tripId: tripDetail._id, seatNumbers: hold.seatNumbers, insuranceOpted, insurancePerPassenger, holdToken: hold.holdToken, paymentChannel: paymentMode });
        if (qr?.quote) q = qr.quote;
      } catch (e) {}
      setQuote(q);
      setPanelStep('PAYMENT');
    } catch (e) {
      const msg = e.message || 'Selected seats are no longer available.';
      setPayError(msg);
      showToast(msg, 'warning');
      refreshTrip();
    } finally {
      pendingHoldSeatsRef.current = null;
      setHoldingSeats(false);
    }
  };

  const finishBooking = (booking, newWalletBalance) => {
    setConfirmedBooking(booking);
    holdRef.current = null;
    setHoldInfo(null);
    setStep(4);
    showToast(`Ticket issued · PNR ${booking?.pnr || ''}`, 'success');
    window.dispatchEvent(new Event('wallet-updated'));
    if (newWalletBalance !== undefined && newWalletBalance !== null) setWalletBalance(newWalletBalance);
  };

  const handleExecutePayment = async () => {
    if (!holdInfo?.holdToken) {
      setPayError('Seat hold is missing. Please continue from the passenger step again.');
      return;
    }
    if (paymentMode === 'WALLET' && Number(walletBalance || 0) < fare.totalPayable) {
      setPayError(`Insufficient wallet balance (₹${Number(walletBalance || 0).toLocaleString('en-IN')}). Required ₹${fare.totalPayable.toLocaleString('en-IN')}. Add money to your wallet or choose Online Payment.`);
      return;
    }

    setPaying(true);
    setPayError('');

    const common = {
      holdToken: holdInfo.holdToken,
      passengers: formattedPassengers(),
      contactPhone: contactMobile.trim(),
      contactEmail: contactEmail.trim(),
      boardingPoint,
      droppingPoint,
      insuranceOpted,
      insurancePerPassenger,
      emergencyContact: emergencyPayload(),
      agentServiceCharge: settingsCharge
    };

    try {
      if (paymentMode === 'WALLET' || paymentMode === 'CASH') {
        const res = await api.bookWithWallet({ ...common, paymentMode });
        if (!res?.success) throw new Error(res?.error || (paymentMode === 'CASH' ? 'Cash booking failed.' : 'Wallet payment failed.'));
        finishBooking(res.booking, res.walletBalance);
        if (paymentMode === 'CASH') showToast(res.message || 'Cash ticket issued. Hand the cash to your company office before departure.', 'info');
        setPaying(false);
        return;
      }

      // Online: customer pays the ticket fare through Razorpay.
      const orderRes = await api.createPaymentOrder({
        amount: fare.totalPayable,
        purpose: 'TICKET_BOOKING',
        metadata: common,
        notes: { corridor: `${sourceCity} to ${destinationCity}` }
      });
      if (!orderRes?.orderId) throw new Error(orderRes?.error || 'Failed to start online payment.');

      const methodsRes = await api.getActivePaymentMethods(tripDetail?.companyCode || agentProfile?.companyCode).catch(() => null);
      await openRazorpayCheckout({
        allowedMethods: methodsRes?.allowedMethods || null,
        orderId: orderRes.orderId,
        amount: orderRes.amount,
        currency: 'INR',
        keyId: orderRes.keyId,
        name: 'Rupadiya Ticket Booking',
        description: `Seats ${holdInfo.seatNumbers.join(', ')} · ${sourceCity} → ${destinationCity}`,
        prefill: {
          name: passengerDetails[0]?.name || 'Passenger',
          email: contactEmail.trim() || undefined,
          contact: contactMobile.trim()
        },
        onSuccess: async (rzp) => {
          try {
            const verifyRes = await api.verifyPayment({
              orderId: rzp.razorpay_order_id,
              paymentId: rzp.razorpay_payment_id,
              signature: rzp.razorpay_signature
            });
            const booking = verifyRes?.bookingResult;
            if (verifyRes?.success && booking) {
              finishBooking(booking);
            } else {
              throw new Error(verifyRes?.error || 'Payment verification failed.');
            }
          } catch (vErr) {
            setPayError(vErr.message || 'Payment verification failed.');
            showToast(vErr.message || 'Payment verification failed.', 'warning');
            refreshTrip();
          } finally {
            setPaying(false);
          }
        },
        onDismiss: () => setPaying(false)
      });
    } catch (err) {
      const msg = err.message || 'Payment failed.';
      setPayError(msg);
      showToast(msg, 'warning');
      setPaying(false);
      if (/expired|hold/i.test(msg)) handleCancelHold('', 'PASSENGERS');
    }
  };

  const handleDownloadPdf = () => {
    if (!confirmedBooking) return;
    const b = confirmedBooking;
    const trip = b.trip || b.tripId || tripDetail || {};
    const bus = b.bus || b.busId || tripDetail?.busId || tripDetail?.bus || {};
    const dep = trip.departureTime || tripDetail?.departureTime;
    downloadTicketPdf({
      bookingId: b.pnr,
      pnr: b.pnr,
      travelerName: b.passengers?.[0]?.name || 'Customer',
      contactPhone: b.contactDetails?.phone,
      contactEmail: b.contactDetails?.email,
      busName: bus.name || 'Rupadiya Intercity',
      busNumber: bus.busNumber,
      busModel: bus.busType,
      dateStr: dep ? new Date(dep).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : travelDate,
      timeStr: dep ? new Date(dep).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
      fromCity: tripDetail?.sourceCity || sourceCity,
      toCity: tripDetail?.destinationCity || destinationCity,
      seatsStr: (b.seatNumbers || []).join(', '),
      boardingName: b.boardingPoint?.name,
      droppingName: b.droppingPoint?.name,
      arrTimeStr: trip.arrivalTime || tripDetail?.arrivalTime ? new Date(trip.arrivalTime || tripDetail?.arrivalTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '',
      companyName: bus.operatorName || '',
      status: b.status,
      qrToken: b.qrToken || null,
      emergencyContact: b.emergencyContact?.phone ? b.emergencyContact : null,
      fareBreakdown: b.fareBreakdown || {},
      paymentProvider: b.paymentProvider === 'agent_wallet' ? 'Agent counter' : b.paymentProvider === 'agent_cash' ? 'Cash' : 'Online payment',
      totalLabel: b.paymentProvider === 'agent_cash' ? 'Cash due to company office' : 'Total amount paid',
      totalFare: Number(b.fareBreakdown?.totalPayable || 0),
      agentCode: agentProfile?.referralCode || '',
      agencyName: agentProfile?.agencyName || agentProfile?.name || 'Rupadiya Authorised Agent',
      passengers: b.passengers || []
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

  const panelIndex = PANEL_STEPS.findIndex((s) => s.id === panelStep);
  const tripDeparture = tripDetail?.departureTime ? new Date(tripDetail.departureTime) : null;

  return (
    <div className="space-y-6">
      {/* Floating In-App Toast */}
      {toast && (
        <div className="fixed top-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-xl p-4 shadow-2xl border border-slate-700 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          {toast.type === 'warning' ? (
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          ) : toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs font-medium leading-relaxed">
            {toast.message}
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white transition p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
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
                  {sourceCity === HUB_CITY ? (
                    <option value={HUB_CITY}>{HUB_CITY} (Hub)</option>
                  ) : (
                    ROUTE_GROUPS.map(g => (
                      <optgroup key={g.id} label={g.name}>
                        {g.cities.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </optgroup>
                    ))
                  )}
                </select>
              </div>

              {/* Swap Button (Responsive: Desktop & Mobile) */}
              <div className="sm:col-span-1 flex justify-center pb-1 sm:pb-2">
                <button
                  type="button"
                  onClick={handleSwapCities}
                  title="Swap Origin and Destination"
                  className="p-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-500 transition border border-slate-200 active:scale-95 flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span className="sm:hidden text-xs font-semibold">Swap Cities</span>
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
                const fare = trip.minFare || trip.baseFare || trip.basePrice;

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
              onClick={() => { if (holdInfo) handleCancelHold('', 'POINTS'); resetBookingDraft(); setStep(1); }}
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
            <div className="lg:col-span-7 bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Select Passenger Seats</h3>
                  <p className="text-[11px] text-slate-500">Select up to 6 seats. Seats update live as other customers book.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-500">Selected ({selectedSeats.length}):</span>{' '}
                  <strong className="text-emerald-700 font-bold text-sm">
                    {selectedSeats.length > 0 ? selectedSeats.map(seatCodeOf).join(', ') : 'None'}
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
                  <span>Booked</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-amber-50 border border-amber-200" />
                  <span>On hold (another customer)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-pink-100 border border-pink-300" />
                  <span>Booked by female</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 rounded bg-white border-2 border-pink-400" />
                  <span>Ladies seat</span>
                </div>
              </div>
            </div>

            {/* Booking Panel: Boarding/Dropping → Passengers → Review & Pay */}
            <div className="lg:col-span-5">
              {selectedSeats.length === 0 ? (
                <div className="h-full min-h-[360px] bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col items-center justify-center text-center shadow-xs">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 border border-emerald-100">
                    <BusIcon className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Select seats to start</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                    Pick up to 6 available seats on the layout. You will then choose boarding &amp; dropping points, add passenger details and review the fare before payment.
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-[11px] text-pink-600 font-medium">
                    <span className="w-2.5 h-2.5 rounded border border-pink-400" /> Pink-outlined seats are ladies seats
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden lg:sticky lg:top-4">
                  {/* Header + selected seats */}
                  <div className="px-5 pt-5 pb-3 border-b border-slate-100">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 truncate">
                          {tripDetail.sourceCity || sourceCity} → {tripDetail.destinationCity || destinationCity}
                        </h3>
                        <p className="text-[11px] text-slate-500">
                          {tripDeparture ? tripDeparture.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }) : travelDate}
                          {tripDeparture ? ` · ${tripDeparture.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1 justify-end max-w-[160px]">
                        {selectedSeats.map((s) => (
                          <span key={seatCodeOf(s)} className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${isLadiesOnlySeat(seatCodeOf(s)) ? 'bg-pink-100 text-pink-700' : 'bg-emerald-100 text-emerald-800'}`}>
                            {seatCodeOf(s)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stepper */}
                    <ol className="mt-4 grid grid-cols-3 gap-1.5" aria-label="Booking steps">
                      {PANEL_STEPS.map((ps, i) => {
                        const done = i < panelIndex;
                        const active = i === panelIndex;
                        return (
                          <li key={ps.id} className="flex flex-col gap-1">
                            <span className={`h-1 rounded-full ${done || active ? 'bg-emerald-600' : 'bg-slate-200'}`} />
                            <span className={`text-[10px] font-bold ${active ? 'text-emerald-700' : done ? 'text-slate-700' : 'text-slate-400'}`}>
                              {i + 1}. {ps.label}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* STEP A: Boarding & Dropping */}
                    {panelStep === 'POINTS' && (
                      <>
                        {[
                          { title: 'Boarding Point', list: tripDetail.boardingPoints || [], value: boardingPoint, set: setBoardingPoint, base: tripDetail.departureTime, city: tripDetail.sourceCity || sourceCity },
                          { title: 'Dropping Point', list: tripDetail.droppingPoints || [], value: droppingPoint, set: setDroppingPoint, base: tripDetail.arrivalTime, city: tripDetail.destinationCity || destinationCity }
                        ].map((grp) => (
                          <fieldset key={grp.title} className="space-y-2">
                            <legend className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {grp.title}
                            </legend>
                            {(grp.list.length ? grp.list : [{ name: `${grp.city} Main Bus Stand` }]).map((pt) => {
                              const name = pt.name || pt.location;
                              const time = pointTime(pt, grp.base);
                              const checked = pointKey(grp.value) === name;
                              return (
                                <label
                                  key={name}
                                  className={`flex items-start gap-3 p-2.5 rounded-xl border cursor-pointer transition ${checked ? 'border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500' : 'border-slate-200 hover:bg-slate-50'}`}
                                >
                                  <input
                                    type="radio"
                                    name={grp.title}
                                    checked={checked}
                                    onChange={() => grp.set({ name, time })}
                                    className="mt-0.5 accent-emerald-600"
                                  />
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-xs font-bold text-slate-900">{name}</span>
                                    {pt.landmark ? <span className="block text-[11px] text-slate-500">{pt.landmark}</span> : null}
                                  </span>
                                  {time ? <span className="text-xs font-bold text-slate-700 shrink-0">{time}</span> : null}
                                </label>
                              );
                            })}
                          </fieldset>
                        ))}

                        {payError && <PanelError message={payError} />}

                        <button
                          type="button"
                          onClick={goToPassengers}
                          className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          Continue to Passenger Details <ArrowRight className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* STEP B: Passenger information */}
                    {panelStep === 'PASSENGERS' && (
                      <>
                        <div className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>
                            <strong>{boardingPoint?.name}</strong> {boardingPoint?.time ? `(${boardingPoint.time})` : ''} → <strong>{droppingPoint?.name}</strong> {droppingPoint?.time ? `(${droppingPoint.time})` : ''}
                            <button type="button" onClick={() => { setPayError(''); setPanelStep('POINTS'); }} className="ml-1.5 text-emerald-700 font-bold underline cursor-pointer">Change</button>
                          </span>
                        </div>

                        <div className="space-y-2.5">
                          {passengerDetails.map((p, idx) => {
                            const ladies = isLadiesOnlySeat(p.seatNumber);
                            return (
                              <div key={p.seatNumber} className={`p-3 rounded-xl border space-y-2 ${ladies ? 'bg-pink-50/60 border-pink-200' : 'bg-slate-50 border-slate-200/80'}`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-800">
                                    Passenger {idx + 1} · Seat <span className="font-mono">{p.seatNumber}</span>
                                  </span>
                                  {ladies && (
                                    <span className="text-[10px] font-bold text-pink-700 bg-pink-100 border border-pink-200 px-1.5 py-0.5 rounded">Ladies seat</span>
                                  )}
                                </div>
                                <div className="grid grid-cols-12 gap-1.5">
                                  <input
                                    type="text"
                                    value={p.name}
                                    maxLength={60}
                                    onChange={(e) => updatePassenger(idx, 'name', e.target.value.replace(/[^a-zA-Z .'-]/g, ''))}
                                    placeholder="Full name"
                                    aria-label={`Passenger ${idx + 1} name`}
                                    className="col-span-8 w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                                  />
                                  <input
                                    type="number"
                                    inputMode="numeric"
                                    min="1"
                                    max="120"
                                    value={p.age}
                                    onChange={(e) => updatePassenger(idx, 'age', e.target.value.replace(/\D/g, '').slice(0, 3))}
                                    placeholder="Age"
                                    aria-label={`Passenger ${idx + 1} age`}
                                    className="col-span-4 w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={`Passenger ${idx + 1} gender`}>
                                  {[
                                    { v: 'male', l: 'Male' },
                                    { v: 'female', l: 'Female' },
                                    { v: 'other', l: 'Other' }
                                  ].map((g) => {
                                    const blocked = ladies && g.v !== 'female';
                                    const active = p.gender === g.v;
                                    return (
                                      <button
                                        key={g.v}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        disabled={blocked}
                                        onClick={() => updatePassenger(idx, 'gender', g.v)}
                                        title={blocked ? 'This seat is next to a female passenger — only female passengers can book it' : g.l}
                                        className={`py-1.5 rounded-lg border text-[11px] font-bold transition ${
                                          active
                                            ? (g.v === 'female' ? 'bg-pink-600 border-pink-600 text-white' : 'bg-emerald-600 border-emerald-600 text-white')
                                            : blocked
                                              ? 'bg-slate-100 border-slate-200 text-slate-300 cursor-not-allowed line-through'
                                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer'
                                        }`}
                                      >
                                        {g.l}
                                      </button>
                                    );
                                  })}
                                </div>
                                {ladies && (
                                  <p className="text-[10px] text-pink-700 leading-snug">
                                    The seat next to this one is booked by a female passenger, so a male passenger cannot be booked here. You can book it for a female traveller.
                                  </p>
                                )}
                                {Number(p.age) >= 5 && Number(p.age) <= 11 && (
                                  <p className="text-[10px] text-sky-700">Child passenger (5–11 yrs) · full seat fare</p>
                                )}
                                {(p.infants || []).map((inf, infIdx) => (
                                  <div key={infIdx} className="grid grid-cols-12 gap-1.5 items-center bg-white border border-slate-200 rounded-lg p-1.5">
                                    <Baby className="w-3.5 h-3.5 text-sky-600 col-span-1 mx-auto" />
                                    <input value={inf.name} maxLength={60} placeholder="Infant name"
                                      onChange={(e) => updateInfant(idx, infIdx, 'name', e.target.value.replace(/[^a-zA-Z .'-]/g, ''))}
                                      aria-label={`Infant ${infIdx + 1} name`}
                                      className="col-span-5 border border-slate-200 rounded-md px-2 py-1 text-[11px]" />
                                    <select value={inf.age} onChange={(e) => updateInfant(idx, infIdx, 'age', e.target.value)} aria-label="Infant age"
                                      className="col-span-2 border border-slate-200 rounded-md px-1 py-1 text-[11px]">
                                      <option value="">Age</option>
                                      {[0, 1, 2, 3, 4].map((a) => <option key={a} value={a}>{a} yr</option>)}
                                    </select>
                                    <select value={inf.gender} onChange={(e) => updateInfant(idx, infIdx, 'gender', e.target.value)} aria-label="Infant gender"
                                      className="col-span-3 border border-slate-200 rounded-md px-1 py-1 text-[11px]">
                                      <option value="">Gender</option>
                                      <option value="male">Boy</option>
                                      <option value="female">Girl</option>
                                    </select>
                                    <button type="button" onClick={() => removeInfant(idx, infIdx)} aria-label="Remove infant" className="col-span-1 text-rose-500 cursor-pointer">
                                      <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                    </button>
                                  </div>
                                ))}
                                {Number(p.age) >= 18 && (p.infants || []).length < 2 && (
                                  <button type="button" onClick={() => addInfant(idx)} className="text-[10px] font-bold text-sky-700 flex items-center gap-1 cursor-pointer">
                                    <Plus className="w-3 h-3" /> Add infant on lap (under 5, free)
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">
                              Customer Mobile <span className="text-rose-500">*</span>
                            </label>
                            <PhoneInput size="sm" value={contactMobile} onChange={setContactMobile} />
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-slate-700 block mb-1">Email (optional)</label>
                            <input
                              type="email"
                              value={contactEmail}
                              onChange={(e) => setContactEmail(e.target.value.trim())}
                              placeholder="customer@email.com"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        </div>

                        <fieldset className="border border-slate-200 rounded-xl p-3 space-y-2">
                          <legend className="text-[11px] font-bold text-slate-700 px-1">Emergency contact (recommended)</legend>
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1.5fr_1fr] gap-2">
                            <input value={emergencyContact.name} maxLength={60} placeholder="Name"
                              onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value.replace(/[^a-zA-Z .'-]/g, '') })}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs" />
                            <PhoneInput size="sm" value={emergencyContact.phone}
                              onChange={(v) => setEmergencyContact({ ...emergencyContact, phone: v })} />
                            <select value={emergencyContact.relation} onChange={(e) => setEmergencyContact({ ...emergencyContact, relation: e.target.value })}
                              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs">
                              <option value="">Relation</option>
                              {['Father', 'Mother', 'Husband', 'Wife', 'Son', 'Daughter', 'Brother', 'Sister', 'Friend', 'Other'].map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                          </div>
                        </fieldset>

                        <div className={`border rounded-xl p-3 transition space-y-2 ${insuranceOpted ? 'bg-emerald-50/80 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                          <label className="flex items-center justify-between gap-2 cursor-pointer">
                            <span className="flex items-center gap-2">
                              <ShieldCheck className={`w-4 h-4 ${insuranceOpted ? 'text-emerald-700' : 'text-slate-400'}`} />
                              <span>
                                <span className="block text-xs font-bold text-slate-900">Travel protection · ₹28 per passenger</span>
                                <span className="block text-[10px] text-slate-500">Accidental &amp; transit cover</span>
                              </span>
                            </span>
                            <input type="checkbox" checked={insuranceOpted} onChange={(e) => setInsuranceOpted(e.target.checked)} className="w-4 h-4 accent-emerald-600" />
                          </label>

                        </div>

                        {payError && <PanelError message={payError} />}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => { setPayError(''); setPanelStep('POINTS'); }}
                            className="px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            disabled={holdingSeats}
                            onClick={handleProceedToPayment}
                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {holdingSeats ? (
                              <><RefreshCw className="w-4 h-4 animate-spin" /> Holding seats…</>
                            ) : (
                              <>Hold Seats &amp; Review Fare <ArrowRight className="w-4 h-4" /></>
                            )}
                          </button>
                        </div>
                      </>
                    )}

                    {/* STEP C: Review, fare breakdown & payment (seats held) */}
                    {panelStep === 'PAYMENT' && holdInfo && (
                      <>
                        <div className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs ${holdSecondsLeft <= 60 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`} role="timer" aria-live="polite">
                          <span className="flex items-center gap-1.5 font-semibold">
                            <Timer className="w-4 h-4" />
                            Seats {holdInfo.seatNumbers.join(', ')} held for you
                          </span>
                          <span className="font-mono font-bold text-sm">{formatTimer(holdSecondsLeft)}</span>
                        </div>

                        <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200/80 text-xs">
                          <div className="p-2.5 flex justify-between gap-2">
                            <span className="text-slate-500">Boarding</span>
                            <span className="font-semibold text-slate-800 text-right">{boardingPoint?.name} {boardingPoint?.time ? `· ${boardingPoint.time}` : ''}</span>
                          </div>
                          <div className="p-2.5 flex justify-between gap-2">
                            <span className="text-slate-500">Dropping</span>
                            <span className="font-semibold text-slate-800 text-right">{droppingPoint?.name} {droppingPoint?.time ? `· ${droppingPoint.time}` : ''}</span>
                          </div>
                          {passengerDetails.map((p) => (
                            <div key={p.seatNumber} className="p-2.5 flex items-center justify-between gap-2">
                              <span className="flex items-center gap-2 min-w-0">
                                <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${p.gender === 'female' ? 'bg-pink-100 text-pink-700' : 'bg-emerald-100 text-emerald-800'}`}>{p.seatNumber}</span>
                                <span className="font-bold text-slate-800 truncate">{p.name}</span>
                              </span>
                              <span className="text-slate-500 capitalize text-[11px] shrink-0">{p.age} yrs · {p.gender}</span>
                            </div>
                          ))}
                          <div className="p-2.5 flex justify-between gap-2">
                            <span className="text-slate-500">Customer mobile</span>
                            <span className="font-semibold text-slate-800">{formatPhone(contactMobile)}</span>
                          </div>
                        </div>

                        {/* Fare breakdown (server quote) */}
                        <div className="rounded-xl border border-slate-200 p-3 space-y-1.5 text-xs">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Price breakdown</div>
                          <div className="flex justify-between text-slate-600">
                            <span>
                              {quote?.hasMixedFares
                                ? `Seat fares (${quote.seatFares.map((f) => `${f.seatNumber} ₹${f.fare}`).join(' + ')})`
                                : `Base fare (₹${Number(quote?.baseFare ?? basePricePerSeat).toLocaleString('en-IN')} × ${holdInfo.seatNumbers.length})`}
                            </span>
                            <span className="font-semibold text-slate-900">₹{fare.subtotal.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>GST (5%)</span>
                            <span className="font-semibold text-slate-900">₹{fare.gstAmount.toLocaleString('en-IN')}</span>
                          </div>
                          <div className="flex justify-between text-slate-600">
                            <span>Platform fee (5%)</span>
                            <span className="font-semibold text-slate-900">₹{fare.platformFee.toLocaleString('en-IN')}</span>
                          </div>
                          {fare.insuranceAmount > 0 && (
                            <div className="flex justify-between text-slate-600">
                              <span>Travel protection (₹{fare.insurancePerPassenger} × {holdInfo.seatNumbers.length})</span>
                              <span className="font-semibold text-slate-900">₹{fare.insuranceAmount.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          {fare.discountAmount > 0 && (
                            <div className="flex justify-between text-emerald-700">
                              <span>Discount</span>
                              <span className="font-semibold">−₹{fare.discountAmount.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          {paymentMode === 'ONLINE' && serviceCharge > 0 && (
                            <div className="flex justify-between text-slate-600">
                              <span>Agent service charge <span className="text-slate-400">(credited to your wallet)</span></span>
                              <span className="font-semibold text-slate-900">₹{serviceCharge.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          {paymentMode === 'ONLINE' && (
                            <div className="flex justify-between text-slate-600">
                              <span>Payment gateway charge (2.5%) <span className="text-slate-400">· actual Razorpay charge shown on ticket</span></span>
                              <span className="font-semibold text-slate-900">₹{fare.gatewayFee.toLocaleString('en-IN')}</span>
                            </div>
                          )}
                          <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-bold text-slate-900">
                            <span>{paymentMode === 'ONLINE' ? 'Customer pays online' : paymentMode === 'CASH' ? 'Hand over at company office' : 'Debited from your wallet'}</span>
                            <span className="text-emerald-700">₹{fare.totalPayable.toLocaleString('en-IN')}</span>
                          </div>
                          {paymentMode !== 'ONLINE' && serviceCharge > 0 && (
                            <>
                              <div className="flex justify-between text-slate-600 pt-1">
                                <span>Your service charge <span className="text-slate-400">(collect from customer)</span></span>
                                <span className="font-semibold text-slate-900">₹{serviceCharge.toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between text-slate-800 font-bold">
                                <span>Customer pays you</span>
                                <span>₹{customerTotal.toLocaleString('en-IN')}</span>
                              </div>
                            </>
                          )}
                        </div>

                        {/* Payment method */}
                        <div className="space-y-2">
                          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Payment option</div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {[
                              { id: 'WALLET', icon: Wallet, title: 'Agent Wallet', sub: `Balance ₹${walletBalance != null ? Number(walletBalance).toLocaleString('en-IN') : '…'}` },
                              { id: 'ONLINE', icon: CreditCard, title: 'Online (Razorpay)', sub: 'UPI · Card · Netbanking' },
                              { id: 'CASH', icon: Banknote, title: 'Cash (COD)', sub: 'Pay company office before boarding' }
                            ].map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => { setPaymentMode(m.id); setPayError(''); }}
                                aria-pressed={paymentMode === m.id}
                                className={`p-2.5 rounded-xl border text-left transition flex items-start gap-2 cursor-pointer ${paymentMode === m.id ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
                              >
                                <span className={`p-1.5 rounded-lg shrink-0 ${paymentMode === m.id ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                  <m.icon className="w-3.5 h-3.5" />
                                </span>
                                <span className="min-w-0">
                                  <span className="block text-xs font-bold text-slate-900 truncate">{m.title}</span>
                                  <span className="block text-[10px] text-slate-500 truncate">{m.sub}</span>
                                </span>
                              </button>
                            ))}
                          </div>
                          {paymentMode === 'WALLET' ? (
                            <div className={`text-[11px] flex justify-between px-1 ${Number(walletBalance || 0) < fare.totalPayable ? 'text-rose-600 font-semibold' : 'text-slate-500'}`}>
                              <span>{Number(walletBalance || 0) < fare.totalPayable ? 'Insufficient balance — add money or pay online' : 'Balance after this ticket'}</span>
                              <span className="font-bold">₹{Math.max(0, Number(walletBalance || 0) - fare.totalPayable).toLocaleString('en-IN')}</span>
                            </div>
                          ) : paymentMode === 'CASH' ? (
                            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                              Collect the cash from the customer and hand ₹{fare.totalPayable.toLocaleString('en-IN')} to your company office before departure.
                              Passengers on this ticket <strong>cannot board</strong> until the office marks it received. Your commission is credited after that.
                            </p>
                          ) : (
                            <p className="text-[11px] text-slate-500 px-1">The customer pays ₹{fare.totalPayable.toLocaleString('en-IN')} securely via Razorpay. Your commission is credited after the ticket is issued.</p>
                          )}
                        </div>

                        {payError && <PanelError message={payError} />}

                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={paying}
                            onClick={() => handleCancelHold('Seats released. You can edit the details and hold again.', 'PASSENGERS')}
                            className="px-3 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 text-slate-700 font-bold text-xs cursor-pointer"
                          >
                            Edit details
                          </button>
                          <button
                            type="button"
                            disabled={paying || (paymentMode === 'WALLET' && Number(walletBalance || 0) < fare.totalPayable)}
                            onClick={handleExecutePayment}
                            className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {paying ? (
                              <><RefreshCw className="w-4 h-4 animate-spin" /> Processing…</>
                            ) : paymentMode === 'ONLINE' ? (
                              <><CreditCard className="w-4 h-4" /> Pay ₹{fare.totalPayable.toLocaleString('en-IN')} Online</>
                            ) : paymentMode === 'CASH' ? (
                              <><Banknote className="w-4 h-4" /> Issue Cash Ticket (₹{fare.totalPayable.toLocaleString('en-IN')} due)</>
                            ) : (
                              <><Check className="w-4 h-4" /> Pay ₹{fare.totalPayable.toLocaleString('en-IN')} from Wallet</>
                            )}
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={paying}
                          onClick={() => { handleCancelHold('Seats released.', 'POINTS'); setSelectedSeats([]); }}
                          className="w-full text-[11px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          Change seats (releases the hold)
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Booking Confirmed */}
      {step === 4 && confirmedBooking && (
        <div className="max-w-lg mx-auto bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5 shadow-xs">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Ticket issued
            </span>
            <h2 className="text-2xl font-bold text-slate-900">PNR {confirmedBooking.pnr}</h2>
            <p className="text-xs text-slate-500">
              {tripDetail?.sourceCity || sourceCity} → {tripDetail?.destinationCity || destinationCity} · Seats {(confirmedBooking.seatNumbers || []).join(', ')}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-xs space-y-2">
            {[
              ['Boarding', `${confirmedBooking.boardingPoint?.name || '—'}${confirmedBooking.boardingPoint?.time ? ` · ${confirmedBooking.boardingPoint.time}` : ''}`],
              ['Dropping', `${confirmedBooking.droppingPoint?.name || '—'}${confirmedBooking.droppingPoint?.time ? ` · ${confirmedBooking.droppingPoint.time}` : ''}`],
              ['Passengers', (confirmedBooking.passengers || []).map((p) => `${p.name} (${p.seatNumber})`).join(', ')],
              ['Customer mobile', formatPhone(confirmedBooking.contactDetails?.phone || contactMobile)],
              ['Payment', confirmedBooking.paymentProvider === 'agent_wallet' ? 'Agent wallet'
                : confirmedBooking.paymentProvider === 'agent_cash' ? 'Cash — due at company office' : 'Online (Razorpay)'],
              ['Ticket fare', `₹${Number(confirmedBooking.fareBreakdown?.subtotal || 0).toLocaleString('en-IN')}`],
              ['GST + platform fee', `₹${(Number(confirmedBooking.fareBreakdown?.gstAmount || 0) + Number(confirmedBooking.fareBreakdown?.platformFee || 0)).toLocaleString('en-IN')}`],
              ...(Number(confirmedBooking.fareBreakdown?.gatewayFee) > 0
                ? [['Gateway charge', `₹${Number(confirmedBooking.fareBreakdown.gatewayFeeActual ?? confirmedBooking.fareBreakdown.gatewayFee).toLocaleString('en-IN')}`]]
                : []),
              [confirmedBooking.paymentProvider === 'agent_cash' ? 'Cash to hand over' : 'Amount paid', `₹${Number(confirmedBooking.fareBreakdown?.totalPayable || 0).toLocaleString('en-IN')}`],
              ...(Number(confirmedBooking.agentServiceCharge) > 0
                ? [['Service charge (collect)', `₹${Number(confirmedBooking.agentServiceCharge).toLocaleString('en-IN')}`]]
                : [])
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <span className="text-slate-500 shrink-0">{k}</span>
                <span className="font-semibold text-slate-800 text-right">{v}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <Link
              href={`/print-ticket?ticketId=${encodeURIComponent(confirmedBooking.pnr || '')}&pnr=${encodeURIComponent(confirmedBooking.pnr || '')}`}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print Ticket
            </Link>
            <button
              onClick={handleDownloadPdf}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" /> Download PDF
            </button>
          </div>

          <button
            onClick={() => {
              setStep(1);
              resetBookingDraft();
              setConfirmedBooking(null);
              setContactMobile('');
              setContactEmail('');
              setInsuranceOpted(false);
              setEmergencyContact({ name: '', phone: '', relation: '' });
              refreshTrip();
            }}
            className="text-xs text-slate-500 hover:text-slate-800 underline block mx-auto cursor-pointer"
          >
            Book another ticket
          </button>
        </div>
      )}
    </div>
  );
}

function PanelError({ message }) {
  return (
    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-semibold flex items-start gap-2" role="alert">
      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
}
