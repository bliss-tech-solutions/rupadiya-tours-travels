'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Bus as BusIcon, 
  MapPin, 
  Clock, 
  ShieldCheck, 
  Calendar, 
  Filter, 
  SlidersHorizontal,
  ChevronRight,
  Sparkles,
  Wind,
  Bed,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../lib/api';
import { SPOKE_CITIES, HUB_CITY } from '../../lib/routes';
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
    <div className="min-h-screen bg-[#F8FAFC] pb-16">
      {/* Top Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 md:top-20 z-30 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-slate-700 hover:text-slate-900 font-bold text-sm"
          >
            <ArrowLeft className="w-5 h-5 text-slate-500" />
            <span className="hidden sm:inline">{t('changeSearch') || 'Change Search'}</span>
            <span className="sm:hidden">Back</span>
          </button>

          <div className="text-center">
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              {getCityName(from)} <span className="text-sky-500">→</span> {getCityName(to)}
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Intercity Express Corridor
            </p>
          </div>

          <div className="w-16 text-right">
            <Link
              href="/calendar"
              className="text-xs font-bold text-sky-600 hover:text-sky-700 hidden sm:inline"
            >
              {t('myCalendar') || 'Calendar'}
            </Link>
          </div>
        </div>

        {/* 7-Day Horizontal Date Strip (Present & Future Only) */}
        <div className="max-w-4xl mx-auto px-4 pt-2 pb-3 overflow-x-auto flex items-center gap-2.5 no-scrollbar">
          {dateStrip.map((item) => {
            const isSelected = item.iso === selectedDate;
            return (
              <button
                key={item.iso}
                onClick={() => handleDateClick(item.iso)}
                className={`flex-shrink-0 w-16 py-2.5 rounded-2xl flex flex-col items-center justify-center transition-all ${
                  isSelected
                    ? 'bg-sky-500 text-white font-bold shadow-md shadow-sky-500/30 scale-105'
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

      <div className="max-w-4xl mx-auto px-4 pt-6">
        
        {/* Filter bar with 4 Options: AC Sleeper, Non-AC Sleeper, AC Seater, Non-AC Seater */}
        <div className="mb-6 space-y-3">
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

        {/* Bus List Cards matching Image 2 */}
        {!loading && filteredTrips.length > 0 && (
          <div className="space-y-4">
            {filteredTrips.map((trip) => {
              const availableSeats = trip.seats?.filter(s => s.status === 'AVAILABLE').length ?? 38;
              const depTime = formatTime(trip.departureTime, '06:00 PM');
              const arrTime = formatTime(trip.arrivalTime, '06:30 AM');
              const boardingPointName = trip.boardingPoints?.[0]?.name || 'Rupaidiha Border Main Stand';

              return (
                <div
                  key={trip._id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:shadow-md transition flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  {/* Left: Thumbnail & Route Metadata */}
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 overflow-hidden flex-shrink-0 relative">
                      <img
                        src="https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=150&auto=format&fit=crop&q=80"
                        alt="Coach"
                        className="w-full h-full object-cover opacity-90"
                      />
                      <span className="absolute bottom-1 right-1 text-[8px] font-bold text-white bg-black/60 px-1 rounded">
                        2+2
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {trip.bus?.name || 'Rupadiya Intercity Coach'}
                        </span>
                        {trip.companyName && (
                          <span className="block text-[11px] font-semibold text-slate-500">Operated by {trip.companyName}</span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                          {trip.bus?.busType || 'AC Seater 2+2'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Company #{trip.bus?.companyCode || '01'} · {trip.bus?.busNumber || 'UP-40-BT-1001'}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-slate-600 mt-2">
                        <div className="flex items-center gap-1 font-semibold text-slate-800">
                          <Clock className="w-3.5 h-3.5 text-sky-500" />
                          <span>{depTime}</span>
                          <span className="text-slate-400">→</span>
                          <span>{arrTime}</span>
                        </div>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center gap-1 text-slate-500">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span className="truncate max-w-[180px]">{boardingPointName}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Price & View Seats Button */}
                  <div className="flex items-center justify-between md:flex-col md:items-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <div className="text-left md:text-right">
                      <span className="text-[11px] font-medium text-slate-400 block">
                        {trip.minFare && trip.maxFare && trip.minFare !== trip.maxFare ? 'Starting from' : (t('farePerSeat') || 'Fare per seat')}
                      </span>
                      <div className="text-2xl font-bold text-slate-900">
                        ₹{trip.minFare || trip.baseFare}
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-600">
                        {availableSeats} {t('seatsLeft') || 'seats left'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleSelectSeat(trip._id)}
                      className="px-6 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition active:scale-95 flex items-center gap-1"
                    >
                      <span>{t('viewSeats') || 'View Seats'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
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
