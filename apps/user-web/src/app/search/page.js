'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bus as BusIcon, ChevronRight, Wind, Bed } from 'lucide-react';
import { api } from '../../lib/api';
import { SPOKE_CITIES } from '../../lib/routes';
import { useToast } from '../../components/ui/Toast';
import { useLanguage } from '../../context/LanguageContext';
import { getLocalDateString, generateDateStrip, formatTime, formatDate } from '../../lib/dateUtils';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToast } = useToast();
  const { t } = useLanguage();

  const todayIso = getLocalDateString(new Date());

  const from = searchParams.get('from') || 'rupaidiha';
  const to = searchParams.get('to') || 'ahmedabad';
  const rawDate = searchParams.get('date') || todayIso;

  // Never allow selecting past dates
  const initialDate = rawDate < todayIso ? todayIso : rawDate;
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // 4 Filter options: 'all', 'ac_sleeper', 'non_ac_sleeper', 'ac_seater', 'non_ac_seater'
  const [busTypeFilter, setBusTypeFilter] = useState('all');
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // 7-day horizontal calendar strip anchored to local timezone dates
  const dateStrip = generateDateStrip(new Date(), 7);

  // Load scheduled trips from backend
  useEffect(() => {
    async function loadTrips() {
      setLoading(true);
      try {
        const res = await api.searchTrips(from, to, selectedDate);
        setTrips(res.data || []);
      } catch (err) {
        console.error(err);
        addToast(err.message || 'Failed to fetch departures for this date', 'error', 'Notice');
      } finally {
        setLoading(false);
      }
    }
    loadTrips();
  }, [from, to, selectedDate, addToast]);

  // Filter buses based on 4 options: ac_sleeper, non_ac_sleeper, ac_seater, non_ac_seater
  const filteredTrips = trips.filter(t => {
    if (busTypeFilter === 'all') return true;
    const busType = (t.bus?.busType || '').toLowerCase();
    const busName = (t.bus?.name || '').toLowerCase();
    const isSleeper = busType.includes('sleeper') || busName.includes('sleeper');
    const isSeater = !isSleeper;
    const isNonAc = busType.includes('non-ac') || busType.includes('non ac') || busName.includes('non-ac');
    const isAc = !isNonAc;

    if (busTypeFilter === 'ac_sleeper') return isSleeper && isAc;
    if (busTypeFilter === 'non_ac_sleeper') return isSleeper && isNonAc;
    if (busTypeFilter === 'ac_seater') return isSeater && isAc;
    if (busTypeFilter === 'non_ac_seater') return isSeater && isNonAc;
    return true;
  });

  const getCityName = (id) => {
    if (!id) return '';
    if (id === 'rupaidiha' || id === 'rupadiya') return 'Rupaidiha';
    const found = SPOKE_CITIES.find(s => s.id === id || s.alias?.includes(id));
    return found ? found.name : id;
  };

  const handleSelectSeat = (tripId) => {
    // Guest can view and select seats directly without prior login
    router.push(`/trips/${tripId}`);
  };

  const handleDateClick = (iso) => {
    if (iso < todayIso) {
      addToast('Past dates cannot be selected for travel.', 'warning', 'Invalid Date');
      return;
    }
    setSelectedDate(iso);
  };

  const filterOptions = [
    { id: 'all', label: t('allBuses') || 'All Buses', icon: BusIcon },
    { id: 'ac_sleeper', label: t('acSleeper') || 'AC Sleeper', icon: Bed },
    { id: 'non_ac_sleeper', label: t('nonAcSleeper') || 'Non-AC Sleeper', icon: Bed },
    { id: 'ac_seater', label: t('acSeater') || 'AC Seater', icon: Wind },
    { id: 'non_ac_seater', label: t('nonAcSeater') || 'Non-AC Seater', icon: BusIcon }
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 md:pb-16 overflow-x-clip">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 md:top-20 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 grid grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
          <button
            onClick={() => router.push('/')}
            aria-label={t('changeSearch') || 'Change Search'}
            className="flex items-center gap-1.5 text-slate-700 hover:text-slate-900 font-bold text-sm -ml-1 p-1 justify-self-start whitespace-nowrap"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
            <span className="hidden sm:inline">{t('changeSearch') || 'Change Search'}</span>
          </button>

          <div className="text-center min-w-0">
            <h1 className="text-sm sm:text-lg font-bold text-slate-900 truncate">
              {getCityName(from)} <span className="text-sky-500">→</span> {getCityName(to)}
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate">
              {formatDate(selectedDate, 'full') || 'Intercity Express Corridor'}
            </p>
          </div>

          <div className="w-7 sm:w-auto text-right">
            <Link
              href="/calendar"
              className="text-xs font-bold text-sky-600 hover:text-sky-700 hidden sm:inline whitespace-nowrap"
            >
              {t('myCalendar') || 'Calendar'}
            </Link>
          </div>
        </div>

        {/* 7-Day Horizontal Date Strip (Present & Future Only) */}
        <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-1.5 pb-2.5 sm:pb-3 overflow-x-auto flex items-center gap-2 sm:gap-2.5 no-scrollbar">
          {dateStrip.map((item) => {
            const isSelected = item.iso === selectedDate;
            return (
              <button
                key={item.iso}
                onClick={() => handleDateClick(item.iso)}
                aria-pressed={isSelected}
                className={`flex-shrink-0 w-[52px] sm:w-16 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/30'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <span className={`text-base font-bold ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                  {item.dayNum}
                </span>
                <span className={`text-[10px] font-bold tracking-wider ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>
                  {item.dayName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 pt-4 sm:pt-6">

        {/* Filter bar with 4 Options: AC Sleeper, Non-AC Sleeper, AC Seater, Non-AC Seater */}
        <div className="mb-4 sm:mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{t('availableBuses') || 'Available Bus List'}</h2>
              <p className="text-xs text-slate-500">
                {filteredTrips.length} departure{filteredTrips.length === 1 ? '' : 's'} found
              </p>
            </div>
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider hidden sm:inline">
              Filter by bus class
            </span>
          </div>

          {/* 4 Options Filter Chips Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {filterOptions.map((opt) => {
              const active = busTypeFilter === opt.id;
              const IconComp = opt.icon;
              return (
                <button
                  key={opt.id}
                  onClick={() => setBusTypeFilter(opt.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0 transition active:scale-95 ${
                    active
                      ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/20'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((n) => (
              <div key={n} className="bg-white rounded-3xl p-6 border border-slate-200 animate-pulse h-36" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredTrips.length === 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto my-8">
            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-4">
              <BusIcon className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">{t('noDepartures') || 'No departures matching this filter'}</h3>
            <p className="text-xs text-slate-500 mb-6">
              Try switching your filter to &quot;All Buses&quot; or selecting another future date.
            </p>
            <button
              onClick={() => setBusTypeFilter('all')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 text-white font-bold text-xs"
            >
              <span>Show All Buses</span>
            </button>
          </div>
        )}

        {/* Bus list */}
        {!loading && filteredTrips.length > 0 && (
          <div className="space-y-3 sm:space-y-4">
            {filteredTrips.map((trip) => (
              <BusCard key={trip._id} trip={trip} t={t} fromName={getCityName(from)} toName={getCityName(to)} onSelect={() => handleSelectSeat(trip._id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// "12h 30m" between two date-times (overnight journeys included); '' when unknown.
function journeyDuration(dep, arr) {
  const a = new Date(dep).getTime();
  const b = new Date(arr).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return '';
  const mins = Math.round((b - a) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`;
}

// Day label when the bus arrives on a later day ("+1 day").
function dayOffset(dep, arr) {
  const a = new Date(dep);
  const b = new Date(arr);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  const d0 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const d1 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.max(0, Math.round((d1 - d0) / 86400000));
}

/**
 * One bus in the results list. Mobile first: name + type, a departure → arrival timeline,
 * amenities, then price and the button (boarding / dropping points are chosen while booking).
 * On wider screens price/button move to the right.
 * Shows only real data (no placeholder bus number, seats or times).
 */
function BusCard({ trip, t, fromName, toName, onSelect }) {
  const seatsLeft = Number.isFinite(Number(trip.availableSeats))
    ? Number(trip.availableSeats)
    : (Array.isArray(trip.seats) ? trip.seats.filter((s) => s.status === 'AVAILABLE').length : null);
  const isFull = trip.isFull || seatsLeft === 0;
  const depTime = formatTime(trip.departureTime, '');
  const arrTime = formatTime(trip.arrivalTime, '');
  const duration = journeyDuration(trip.departureTime, trip.arrivalTime);
  const plusDays = dayOffset(trip.departureTime, trip.arrivalTime);
  const operator = trip.companyName && trip.companyName !== trip.bus?.name ? trip.companyName : '';
  const fare = trip.minFare || trip.baseFare;
  const fromPrice = trip.minFare && trip.maxFare && trip.minFare !== trip.maxFare;
  const amenities = Array.isArray(trip.bus?.amenities) ? trip.bus.amenities.slice(0, 3) : [];
  const fewLeft = seatsLeft != null && seatsLeft > 0 && seatsLeft <= 5;

  return (
    <article className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="p-4 sm:p-5 md:flex md:gap-6">
        <div className="min-w-0 flex-1">
          {/* Bus name, type and operator */}
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center flex-shrink-0">
              <BusIcon className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] sm:text-base font-bold text-slate-900 leading-snug break-words">
                {trip.bus?.name || 'Rupadiya Coach'}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {trip.bus?.busType && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
                    {trip.bus.busType}
                  </span>
                )}
                {trip.bus?.busNumber && (
                  <span className="text-[11px] font-semibold text-slate-500 font-mono whitespace-nowrap">{trip.bus.busNumber}</span>
                )}
              </div>
              {operator && (
                <p className="text-[11px] sm:text-xs text-slate-500 mt-1 break-words">
                  Operated by <span className="font-semibold text-slate-700">{operator}</span>
                </p>
              )}
            </div>
          </div>

          {/* Departure → arrival timeline */}
          <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap">{depTime || '--:--'}</div>
              <div className="text-[11px] sm:text-xs text-slate-500 truncate">{fromName}</div>
            </div>
            <div className="flex flex-col items-center px-1">
              <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 whitespace-nowrap">{duration || '—'}</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full border border-sky-500" />
                <span className="w-10 sm:w-16 border-t border-dashed border-slate-300" />
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
              </div>
            </div>
            <div className="min-w-0 text-right">
              <div className="text-base sm:text-lg font-bold text-slate-900 whitespace-nowrap">
                {arrTime || '--:--'}
                {plusDays > 0 && <sup className="ml-0.5 text-[10px] font-bold text-amber-600">+{plusDays}</sup>}
              </div>
              <div className="text-[11px] sm:text-xs text-slate-500 truncate">{toName}</div>
            </div>
          </div>

          {amenities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {amenities.map((a) => (
                <span key={a} className="px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200 text-[10px] font-semibold text-slate-600">{a}</span>
              ))}
            </div>
          )}
        </div>

        {/* Price + button: bottom bar on mobile, right column on desktop */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3 md:mt-0 md:pt-0 md:border-t-0 md:border-l md:pl-6 md:flex-col md:items-end md:justify-center md:w-48 md:flex-shrink-0">
          <div className="min-w-0 md:text-right">
            <span className="text-[10px] sm:text-[11px] font-medium text-slate-400 block">
              {fromPrice ? 'Starting from' : (t('farePerSeat') || 'Fare per seat')}
            </span>
            <div className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              ₹{Number(fare || 0).toLocaleString('en-IN')}
            </div>
            {seatsLeft != null && (
              <span className={`text-[11px] font-semibold ${isFull ? 'text-rose-600' : fewLeft ? 'text-amber-600' : 'text-emerald-600'}`}>
                {isFull ? 'Sold out' : `${seatsLeft} ${t('seatsLeft') || 'seats left'}`}
              </span>
            )}
          </div>
          <button
            onClick={onSelect}
            disabled={isFull}
            className="flex-shrink-0 px-4 sm:px-6 py-2.5 rounded-xl sm:rounded-2xl bg-sky-500 hover:bg-sky-600 disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm shadow-md shadow-sky-500/20 transition active:scale-95 flex items-center gap-1 whitespace-nowrap md:w-full md:justify-center"
          >
            <span>{isFull ? 'Sold out' : (t('viewSeats') || 'View Seats')}</span>
            {!isFull && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading trips...</p>
        </div>
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
