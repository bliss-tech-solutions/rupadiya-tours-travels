'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  MapPin, 
  Clock, 
  Ticket, 
  ChevronLeft, 
  ChevronRight, 
  Bus, 
  ShieldCheck, 
  User, 
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { api } from '../../lib/api';
import { getLocalDateString, formatDate, formatTime } from '../../lib/dateUtils';

export default function UserTravelCalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [tourBookings, setTourBookings] = useState([]);
  
  // Current view month & selected date
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateIso, setSelectedDateIso] = useState(() => getLocalDateString(new Date()));

  useEffect(() => {
    async function loadUserBookings() {
      setLoading(true);
      try {
        const userRes = await api.me().catch(() => null);
        if (userRes?.user) {
          setUser(userRes.user);
          const [busRes, tourRes] = await Promise.allSettled([
            api.getMyBookings(),
            api.getMyTourBookings()
          ]);
          if (busRes.status === 'fulfilled') {
            const list = busRes.value.bookings || busRes.value.data || [];
            setBookings(list);

            if (list.length > 0) {
              const firstB = list[0];
              const t = firstB.trip || firstB.tripId || {};
              const timeVal = t.departureTime || firstB.travelDate || firstB.createdAt;
              if (timeVal) {
                const tripIso = getLocalDateString(new Date(timeVal));
                setSelectedDateIso(tripIso);
                setCurrentDate(new Date(timeVal));
              }
            }
          }
          if (tourRes.status === 'fulfilled') {
            const tList = tourRes.value.bookings || tourRes.value.data || [];
            setTourBookings(tList);
          }
        } else {
          const confRaw = typeof window !== 'undefined' ? sessionStorage.getItem('rupadiya_confirmed_ticket') : null;
          if (confRaw) {
            try {
              const parsed = JSON.parse(confRaw);
              if (parsed.booking) {
                const b = parsed.booking;
                setBookings([b]);
                const t = b.trip || b.tripId || {};
                const timeVal = t.departureTime || b.travelDate || b.createdAt;
                if (timeVal) {
                  const tripIso = getLocalDateString(new Date(timeVal));
                  setSelectedDateIso(tripIso);
                  setCurrentDate(new Date(timeVal));
                }
              }
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadUserBookings();
  }, []);

  // Map trips by date (YYYY-MM-DD)
  const tripsByDate = {};
  bookings.forEach(b => {
    const trip = b.trip || b.tripId || {};
    const depTime = trip.departureTime || b.travelDate || b.createdAt;
    if (depTime) {
      const iso = getLocalDateString(new Date(depTime));
      if (!tripsByDate[iso]) tripsByDate[iso] = [];
      tripsByDate[iso].push({ ...b, type: 'bus' });
    }
  });

  tourBookings.forEach(tb => {
    const dateVal = tb.departureDate || tb.travelDate || tb.createdAt;
    if (dateVal) {
      const iso = getLocalDateString(new Date(dateVal));
      if (!tripsByDate[iso]) tripsByDate[iso] = [];
      tripsByDate[iso].push({ ...tb, type: 'tour' });
    }
  });

  // Calendar matrix calculations for current view month
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Prev / next month navigation
  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Selected date trips
  const selectedTrips = tripsByDate[selectedDateIso] || [];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Top Sticky Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 md:top-20 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-bold text-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
            <span>Home</span>
          </button>
          <div className="text-center">
            <h1 className="text-base sm:text-lg font-bold text-slate-900">My Travel Calendar</h1>
            <p className="text-xs text-slate-500">Your personalized journey schedule & booking dates</p>
          </div>
          <div className="w-16" />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Unauthenticated with no tickets State */}
        {!user && bookings.length === 0 && !loading && (
          <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-sm my-6">
            <div className="w-16 h-16 rounded-3xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <CalendarIcon className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">View Your Travel Dates</h2>
            <p className="text-xs sm:text-sm text-slate-500 mb-6 leading-relaxed">
              Sign in with your mobile number to view all your scheduled bus trips and tickets on the calendar.
            </p>
            <Link
              href="/login?redirect=/calendar"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm shadow-lg shadow-sky-500/25 transition active:scale-95"
            >
              <span>Login with Mobile OTP</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Calendar View (shown when user is authenticated or has booked tickets) */}
        {(user || bookings.length > 0) && (
          <>
            {/* Calendar Controls & Month Card */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-6 shadow-sm">
              {/* Month Header with Navigation */}
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                    Travel Itinerary
                  </span>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                    {monthNames[month]} {year}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={prevMonth}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 transition"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <span key={d} className="text-[11px] font-bold text-slate-400 uppercase tracking-wider py-1">
                    {d}
                  </span>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1 sm:gap-2">
                {/* Empty padding slots for days before 1st of month */}
                {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-16 sm:h-20 rounded-2xl bg-slate-50/50 opacity-40" />
                ))}

                {/* Actual Month Days */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const dayNum = i + 1;
                  const dayDate = new Date(year, month, dayNum);
                  const iso = getLocalDateString(dayDate);
                  const trips = tripsByDate[iso] || [];
                  const hasTrips = trips.length > 0;
                  const isSelected = selectedDateIso === iso;

                  return (
                    <button
                      key={iso}
                      onClick={() => setSelectedDateIso(iso)}
                      className={`h-12 sm:h-16 md:h-20 p-1 sm:p-2 rounded-xl sm:rounded-2xl border transition-all text-left flex flex-col justify-between relative group ${
                        isSelected
                          ? 'border-sky-500 bg-sky-50/70 ring-2 ring-sky-500/20 shadow-sm'
                          : hasTrips
                          ? 'border-emerald-300 bg-emerald-50/40 hover:border-emerald-400'
                          : 'border-slate-100 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-[11px] sm:text-sm font-bold ${
                          isSelected ? 'text-sky-600' : hasTrips ? 'text-emerald-700' : 'text-slate-700'
                        }`}>
                          {dayNum}
                        </span>
                        {hasTrips && (
                          <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500" />
                        )}
                      </div>

                      {/* Trips Badge */}
                      {hasTrips ? (
                        <div className="mt-auto overflow-hidden w-full">
                          <span className="inline-block px-1 py-0.5 rounded bg-emerald-500 text-white text-[8px] sm:text-[10px] font-bold shadow-sm truncate max-w-full leading-none">
                            {trips.length} {trips.length === 1 ? 'Trip' : 'Trips'}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300 opacity-0 group-hover:opacity-100 transition">
                          -
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Date Trip Details Section */}
            <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold flex-shrink-0">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      Journeys on {formatDate(selectedDateIso, 'medium')}
                    </h3>
                    <p className="text-[11px] sm:text-xs text-slate-400 font-medium">
                      {selectedTrips.length} scheduled reservation{selectedTrips.length === 1 ? '' : 's'} on this date
                    </p>
                  </div>
                </div>

                <Link
                  href="/"
                  className="px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-bold transition flex items-center gap-1 flex-shrink-0"
                >
                  <span>+ Book</span>
                </Link>
              </div>

              {/* Trip Cards for Selected Date */}
              {selectedTrips.length > 0 ? (
                <div className="space-y-4">
                  {selectedTrips.map((item, idx) => {
                    const isBus = item.type === 'bus';
                    const trip = item.trip || item.tripId || item;
                    const bus = trip.bus || trip.busId || item.bus || item.busId || {};
                    
                    const depTime = formatTime(item.boardingPoint?.time || trip.departureTime || item.createdAt, '05:30 PM');
                    
                    const seatNumbers = (item.seatNumbers && item.seatNumbers.length > 0)
                      ? item.seatNumbers.join(', ')
                      : (item.seats && item.seats.length > 0)
                      ? item.seats.map(s => typeof s === 'string' ? s : s.seatNumber).filter(Boolean).join(', ')
                      : (item.passengers?.map(p => p.seatNumber).filter(Boolean).join(', '))
                      || '1';

                    const bookingId = item.bookingId || item._id;
                    const fare = item.fareBreakdown?.totalPayable 
                      ?? item.totalAmount 
                      ?? item.totalFare 
                      ?? item.totalPrice 
                      ?? (item.passengers?.length ? item.passengers.reduce((sum, p) => sum + (p.fare || 0), 0) : null)
                      ?? (trip.baseFare && (item.seatNumbers?.length || item.seats?.length) ? trip.baseFare * (item.seatNumbers?.length || item.seats?.length) : null)
                      ?? 850;

                    return (
                      <div
                        key={idx}
                        className="p-4 sm:p-5 rounded-2xl border border-slate-200 hover:border-sky-300 transition-all bg-gradient-to-r from-white to-slate-50/50 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              {item.status || 'CONFIRMED'}
                            </span>
                            <span className="text-xs font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded truncate">
                              #{item.bookingId || item.pnr || 'RUP-TKT'}
                            </span>
                          </div>

                          <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                            {bus.name || trip.bus?.name || 'Rupadiya Intercity Express'}
                          </h4>

                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-slate-500 pt-1">
                            <span className="flex items-center gap-1 font-semibold text-slate-800">
                              <Clock className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />
                              <span>{depTime}</span>
                            </span>
                            <span>·</span>
                            <span className="flex items-center gap-1 truncate max-w-full">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{item.boardingPoint?.name || 'Rupaidiha Border Main Stand'}</span>
                            </span>
                            <span>·</span>
                            <span className="font-bold text-slate-800">
                              Seats [{seatNumbers}]
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                          <div className="text-left md:text-right">
                            <span className="text-[10px] text-slate-400 font-medium block">Total Paid</span>
                            <span className="text-sm font-bold text-slate-900">₹{fare}</span>
                          </div>
                          <Link
                            href={`/ticket/${bookingId}`}
                            className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition active:scale-95 flex items-center gap-1.5"
                          >
                            <Ticket className="w-3.5 h-3.5" />
                            <span>View Boarding Pass</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                    <Bus className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800">No journeys on this date</h4>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1 mb-4">
                    Click any highlighted calendar date above with a trip badge to view your ticket and departure details.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-500 text-white font-bold text-xs shadow-sm hover:bg-sky-600 transition"
                  >
                    <span>Search & Book Buses</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
