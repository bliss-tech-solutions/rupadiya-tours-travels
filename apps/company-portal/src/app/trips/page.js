'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarClock, 
  Plus, 
  MapPin, 
  Clock, 
  Users, 
  ArrowRight, 
  ArrowLeftRight,
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Bus,
  ChevronLeft,
  ChevronRight,
  Printer,
  FileText,
  Lock,
  X,
  Calendar,
  ShieldCheck,
  Info,
  Filter,
  ArrowUpDown,
  UserCog,
  History
} from 'lucide-react';
import { api } from '../../lib/api';
import SeatFareEditor from '../../components/SeatFareEditor';
import { formatDeparture, formatDateTime, formatDate } from '../../lib/dateUtils';

const ITEMS_PER_PAGE = 10;

const ROUTE_GROUPS = [
  {
    id: 'route-1-gujarat',
    name: 'Route 1 - Gujarat',
    cities: [
      { id: 'himatnagar', name: 'Himatnagar', state: 'Gujarat', defaultFare: 1500 },
      { id: 'ahmedabad', name: 'Ahmedabad', state: 'Gujarat', defaultFare: 1650 },
      { id: 'baroda', name: 'Baroda', state: 'Gujarat', defaultFare: 1550 },
      { id: 'ankleshwar', name: 'Ankleshwar', state: 'Gujarat', defaultFare: 1650 },
      { id: 'surat', name: 'Surat', state: 'Gujarat', defaultFare: 1750 },
      { id: 'vapi', name: 'Vapi', state: 'Gujarat', defaultFare: 1850 }
    ]
  },
  {
    id: 'route-2-saurashtra',
    name: 'Route 2 - Saurashtra',
    cities: [
      { id: 'ambli-bopal', name: 'Ambli Bopal', state: 'Gujarat', defaultFare: 1680 },
      { id: 'chotila', name: 'Chotila', state: 'Gujarat', defaultFare: 1800 },
      { id: 'rajkot', name: 'Rajkot', state: 'Gujarat', defaultFare: 1900 },
      { id: 'jamnagar', name: 'Jamnagar', state: 'Gujarat', defaultFare: 2050 }
    ]
  },
  {
    id: 'route-3-south',
    name: 'Route 3 - South',
    cities: [
      { id: 'hyderabad', name: 'Hyderabad', state: 'Telangana', defaultFare: 2150 },
      { id: 'bangalore', name: 'Bangalore', state: 'Karnataka', defaultFare: 2400 }
    ]
  },
  {
    id: 'route-4-maharashtra-goa',
    name: 'Route 4 - Maharashtra / Goa',
    cities: [
      { id: 'nashik', name: 'Nashik', state: 'Maharashtra', defaultFare: 1800 },
      { id: 'mumbai', name: 'Mumbai', state: 'Maharashtra', defaultFare: 1950 },
      { id: 'pune', name: 'Pune', state: 'Maharashtra', defaultFare: 2050 },
      { id: 'goa', name: 'Goa', state: 'Goa', defaultFare: 2500 }
    ]
  }
];

const SPOKE_OPTIONS = ROUTE_GROUPS.flatMap(g => g.cities.map(c => ({
  ...c,
  routeGroupId: g.id,
  routeName: g.name
})));

function getNext7Days() {
  const days = [];
  const now = new Date();
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let i = 0; i <= 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    let label = '';
    if (i === 0) label = 'Today';
    else if (i === 1) label = 'Tomorrow';
    else label = `+${i} Days`;
    
    const formattedShort = `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
    days.push({
      dateStr,
      label,
      formattedShort,
      fullDate: d
    });
  }
  return days;
}

export default function CompanyTripsPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');
  const [dispatching, setDispatching] = useState(false);

  // Filters State
  const [dateFilter, setDateFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'TOMORROW' | 'UPCOMING_7' | 'EXPIRED' | 'CUSTOM'
  const [customDate, setCustomDate] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'SCHEDULED' | 'BOARDING' | 'DEPARTED'
  const [sortBy, setSortBy] = useState('CREATED_DESC'); // 'CREATED_DESC' (Latest Created First) | 'DEP_ASC' | 'DEP_DESC'

  // Seat price editor (company only)
  const [fareEditorTripId, setFareEditorTripId] = useState(null);

  // Bus managers (assign per trip; live journey status)
  const [managers, setManagers] = useState([]);
  const [assigningTripId, setAssigningTripId] = useState(null);
  const [managerModalTrip, setManagerModalTrip] = useState(null);
  useEffect(() => {
    api.getManagers().then((res) => setManagers((res?.managers || []).filter((m) => m.isActive !== false))).catch(() => {});
  }, []);

  const handleAssignManager = async (trip, managerId) => {
    setAssigningTripId(trip.rawTripId);
    setActionError('');
    try {
      const res = await api.assignTripManager(trip.rawTripId, managerId || null);
      setActionSuccess(res?.message || 'Bus manager updated.');
      fetchTrips();
    } catch (e) {
      setActionError(e.message || 'Could not assign bus manager.');
    } finally {
      setAssigningTripId(null);
    }
  };

  // Seat Sheet Manifest Modal State
  const [manifestModalOpen, setManifestModalOpen] = useState(false);
  const [manifestData, setManifestData] = useState(null);
  const [manifestLoading, setManifestLoading] = useState(false);
  const [chartPreparingId, setChartPreparingId] = useState(null);

  // Fleet buses for dispatch selection
  const [fleetBuses, setFleetBuses] = useState([]);
  const [loadingBuses, setLoadingBuses] = useState(false);

  const next7Days = getNext7Days();
  const minDateStr = next7Days[0].dateStr;
  const maxDateStr = next7Days[next7Days.length - 1].dateStr;

  // Dispatch Form State
  const [direction, setDirection] = useState('OUTBOUND'); // 'OUTBOUND': Rupadiya -> Spoke, 'INBOUND': Spoke -> Rupadiya
  const [selectedSpoke, setSelectedSpoke] = useState('Ahmedabad');
  const [selectedRouteGroup, setSelectedRouteGroup] = useState('ALL');
  const [form, setForm] = useState({
    departureDate: minDateStr,
    departureTime: '18:00',
    busId: '',
    fare: '1650'
  });

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const res = await api.getTrips();
      if (res?.trips && Array.isArray(res.trips)) {
        const now = new Date();
        const formatted = res.trips.map(t => {
          const totSeats = t.totalSeats ?? 36;
          const bkSeats = t.bookedSeats ?? 0;
          const occ = t.occupancyRate ?? (totSeats > 0 ? Math.round((bkSeats / totSeats) * 100) : 0);
          const depTime = new Date(t.departureTime);
          const isExpired = !isNaN(depTime.getTime()) && depTime < now;

          return {
            id: t.tripNumber || `TRP-${String(t._id || t.id).slice(-4).toUpperCase()}`,
            rawTripId: t.rawTripId || t._id,
            chartPrepared: Boolean(t.chartPrepared),
            chartPreparedAt: t.chartPreparedAt,
            corridor: t.corridor || `${t.fromCity || 'Rupadiya'} → ${t.toCity || 'Destination'}`,
            bus: t.bus || (t.busNumber ? `${t.busNumber} (${t.busName || 'Fleet Coach'})` : 'Assigned Fleet Bus'),
            departureTime: t.departureTime,
            departure: formatDeparture(t.departureTime),
            createdAt: t.createdAt,
            duration: t.duration || '20h',
            baseFare: t.baseFare || t.fare || 1650,
            bookedSeats: bkSeats,
            totalSeats: totSeats,
            occupancyRate: occ,
            isExpired,
            status: isExpired && !t.chartPrepared ? 'DEPARTED' : (t.chartPrepared ? 'BOARDING' : (t.status || 'SCHEDULED'))
          };
        });
        setTrips(formatted);
      } else {
        setTrips([]);
      }
    } catch (err) {
      console.warn('Failed to fetch trips:', err);
      setTrips([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFleet = async () => {
    setLoadingBuses(true);
    try {
      const res = await api.getFleet();
      if (res?.buses && Array.isArray(res.buses)) {
        setFleetBuses(res.buses);
        if (res.buses.length > 0 && !form.busId) {
          setForm(prev => ({ ...prev, busId: res.buses[0]._id }));
        }
      }
    } catch (err) {
      console.warn('Failed to load fleet buses:', err);
    } finally {
      setLoadingBuses(false);
    }
  };

  useEffect(() => {
    fetchTrips();
    fetchFleet();
  }, []);

  // Update default fare when selected spoke city changes
  useEffect(() => {
    const matched = SPOKE_OPTIONS.find(s => s.name.toLowerCase() === selectedSpoke.toLowerCase());
    if (matched) {
      setForm(prev => ({ ...prev, fare: String(matched.defaultFare) }));
    }
  }, [selectedSpoke]);

  const handleSwapDirection = () => {
    setDirection(prev => (prev === 'OUTBOUND' ? 'INBOUND' : 'OUTBOUND'));
  };

  const handleOriginChange = (val) => {
    if (val === 'Rupadiya' || val === 'Rupadiya (Hub)') {
      setDirection('OUTBOUND');
    } else {
      setSelectedSpoke(val);
      setDirection('INBOUND');
    }
  };

  const handleDestinationChange = (val) => {
    if (val === 'Rupadiya' || val === 'Rupadiya (Hub)') {
      setDirection('INBOUND');
    } else {
      setSelectedSpoke(val);
      setDirection('OUTBOUND');
    }
  };

  const handlePrepareChart = async (trip) => {
    if (!trip.rawTripId) return;

    // Frontend validation: do not allow preparing chart if trip departure has passed
    if (trip.isExpired || new Date(trip.departureTime) < new Date()) {
      setActionError('Cannot prepare chart for an expired departure.');
      return;
    }

    setChartPreparingId(trip.rawTripId);
    setActionError('');
    try {
      const res = await api.prepareSeatChart(trip.rawTripId);
      if (res?.success) {
        setActionSuccess(`Seat chart manifest generated! Trip status changed to BOARDING.`);
        await fetchTrips();
      } else {
        setActionError(res?.error || 'Failed to prepare seat chart.');
      }
    } catch (err) {
      setActionError(err.message || 'Error preparing chart.');
    } finally {
      setChartPreparingId(null);
    }
  };

  const handleOpenManifest = async (trip) => {
    if (!trip.rawTripId) return;
    setManifestLoading(true);
    setManifestModalOpen(true);
    setManifestData(null);
    try {
      const res = await api.getSeatChart(trip.rawTripId);
      if (res?.success) {
        setManifestData(res);
      } else {
        setActionError(res?.error || 'Could not fetch live seat chart manifest.');
      }
    } catch (err) {
      console.error('Seat chart fetch error:', err);
      setActionError(err.message || 'Error fetching seat chart.');
    } finally {
      setManifestLoading(false);
    }
  };

  const handleDispatch = async (e) => {
    e.preventDefault();
    if (!form.busId) {
      setActionError('Please select an assigned fleet coach.');
      return;
    }

    setDispatching(true);
    setActionError('');
    setActionSuccess('');

    const originCity = direction === 'OUTBOUND' ? 'Rupadiya' : selectedSpoke;
    const destCity = direction === 'OUTBOUND' ? selectedSpoke : 'Rupadiya';

    try {
      const payload = {
        origin: originCity,
        destination: destCity,
        departureDate: form.departureDate,
        departureTime: form.departureTime,
        busId: form.busId,
        baseFare: Number(form.fare) || 1650
      };

      const res = await api.scheduleTrip(payload);
      if (res?.success) {
        setActionSuccess(res.message || `Trip successfully dispatched for ${originCity} → ${destCity} on ${form.departureDate}.`);
        setDispatchModalOpen(false);
        await fetchTrips();
      } else {
        setActionError(res?.error || 'Failed to dispatch trip.');
      }
    } catch (err) {
      setActionError(err.message || 'Server error while scheduling trip.');
    } finally {
      setDispatching(false);
    }
  };

  // Filter & Sort Calculation
  const { filteredTrips, stats } = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tom = new Date(now);
    tom.setDate(tom.getDate() + 1);
    const tomStr = tom.toISOString().split('T')[0];
    const in7Days = new Date(now);
    in7Days.setDate(in7Days.getDate() + 7);

    let todayCount = 0;
    let upcomingCount = 0;
    let expiredCount = 0;

    trips.forEach(t => {
      const dep = new Date(t.departureTime);
      const depDateStr = !isNaN(dep.getTime()) ? dep.toISOString().split('T')[0] : '';
      if (!isNaN(dep.getTime())) {
        if (dep < now) expiredCount++;
        else upcomingCount++;
        if (depDateStr === todayStr) todayCount++;
      }
    });

    const filtered = trips.filter(t => {
      // 1. Text Search
      const matchesSearch = 
        t.corridor.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.bus.toLowerCase().includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const dep = new Date(t.departureTime);
      const depDateStr = !isNaN(dep.getTime()) ? dep.toISOString().split('T')[0] : '';
      const isPast = !isNaN(dep.getTime()) && dep < now;

      // 2. Status Filter
      if (statusFilter === 'SCHEDULED' && (t.status !== 'SCHEDULED' || isPast)) return false;
      if (statusFilter === 'BOARDING' && t.status !== 'BOARDING') return false;
      if (statusFilter === 'DEPARTED' && !isPast && t.status !== 'DEPARTED') return false;

      // 3. Date Filter
      if (dateFilter === 'TODAY' && depDateStr !== todayStr) return false;
      if (dateFilter === 'TOMORROW' && depDateStr !== tomStr) return false;
      if (dateFilter === 'UPCOMING_7' && (dep < now || dep > in7Days)) return false;
      if (dateFilter === 'EXPIRED' && !isPast) return false;
      if (dateFilter === 'CUSTOM' && customDate && depDateStr !== customDate) return false;

      return true;
    });

    // 4. Sorting (Default: Latest Created First)
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'CREATED_DESC') {
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated;
      }
      if (sortBy === 'DEP_ASC') {
        const aDep = a.departureTime ? new Date(a.departureTime).getTime() : 0;
        const bDep = b.departureTime ? new Date(b.departureTime).getTime() : 0;
        return aDep - bDep;
      }
      if (sortBy === 'DEP_DESC') {
        const aDep = a.departureTime ? new Date(a.departureTime).getTime() : 0;
        const bDep = b.departureTime ? new Date(b.departureTime).getTime() : 0;
        return bDep - aDep;
      }
      return 0;
    });

    return {
      filteredTrips: sorted,
      stats: {
        total: trips.length,
        today: todayCount,
        upcoming: upcomingCount,
        expired: expiredCount
      }
    };
  }, [trips, searchTerm, dateFilter, customDate, statusFilter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredTrips.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredTrips.length);
  const paginated = filteredTrips.slice(startIndex, endIndex);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-100">
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Company Trips & Departures</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Scheduled Corridor Departures</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your company's own fleet runs. Dispatched trips display latest created first with date filters.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTrips}
            disabled={loading}
            className="p-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
            title="Refresh Trips"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={() => {
              setActionError('');
              setDispatchModalOpen(true);
            }}
            className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Dispatch Daily Trip</span>
          </button>
        </div>
      </div>

      {/* KPI Counters Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div 
          onClick={() => { setDateFilter('ALL'); setStatusFilter('ALL'); }}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            dateFilter === 'ALL' && statusFilter === 'ALL' 
              ? 'bg-blue-50/80 border-blue-200 shadow-xs' 
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase text-slate-500">Total Own Trips</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">All company records</div>
        </div>

        <div 
          onClick={() => { setDateFilter('TODAY'); setStatusFilter('ALL'); }}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            dateFilter === 'TODAY' 
              ? 'bg-emerald-50/80 border-emerald-200 shadow-xs' 
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase text-emerald-700">Departing Today</div>
          <div className="text-2xl font-black text-emerald-800 mt-1">{stats.today}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Today's departures</div>
        </div>

        <div 
          onClick={() => { setDateFilter('UPCOMING_7'); setStatusFilter('ALL'); }}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            dateFilter === 'UPCOMING_7' 
              ? 'bg-sky-50/80 border-sky-200 shadow-xs' 
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase text-sky-700">Next 7 Days</div>
          <div className="text-2xl font-black text-sky-800 mt-1">{stats.upcoming}</div>
          <div className="text-[10px] text-sky-600 mt-0.5">Active upcoming runs</div>
        </div>

        <div 
          onClick={() => { setDateFilter('EXPIRED'); setStatusFilter('ALL'); }}
          className={`p-4 rounded-2xl border transition cursor-pointer ${
            dateFilter === 'EXPIRED' 
              ? 'bg-slate-100 border-slate-300 shadow-xs' 
              : 'bg-white border-slate-200 hover:bg-slate-50'
          }`}
        >
          <div className="text-[11px] font-bold uppercase text-slate-500">Departed / Expired</div>
          <div className="text-2xl font-black text-slate-700 mt-1">{stats.expired}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Chart locking closed</div>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess('')} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError('')} className="text-rose-600 hover:text-rose-800">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Trips Table Card with Date & Status Filter Bar */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        
        {/* Interactive Filter Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          
          {/* Date Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-500 uppercase mr-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Date:</span>
            </span>

            {[
              { id: 'ALL', label: 'All Dates' },
              { id: 'TODAY', label: 'Today' },
              { id: 'TOMORROW', label: 'Tomorrow' },
              { id: 'UPCOMING_7', label: 'Next 7 Days' },
              { id: 'EXPIRED', label: 'Expired / Past' }
            ].map(tab => {
              const active = dateFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setDateFilter(tab.id);
                    setCustomDate('');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    active 
                      ? 'bg-blue-600 text-white shadow-xs' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            {/* Custom Single Date Input Filter */}
            <div className="flex items-center gap-1.5 ml-1">
              <input
                type="date"
                value={customDate}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setDateFilter(e.target.value ? 'CUSTOM' : 'ALL');
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition ${
                  dateFilter === 'CUSTOM'
                    ? 'border-blue-600 bg-blue-50 text-blue-900 ring-2 ring-blue-100'
                    : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
                title="Filter by specific departure date"
              />
              {customDate && (
                <button
                  onClick={() => {
                    setCustomDate('');
                    setDateFilter('ALL');
                  }}
                  className="p-1 rounded-lg hover:bg-slate-200 text-slate-400"
                  title="Clear date filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Sort Selector & Search */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            
            {/* Sort Dropdown */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-slate-900 font-bold focus:outline-none cursor-pointer"
              >
                <option value="CREATED_DESC">Latest Created First</option>
                <option value="DEP_ASC">Departure: Soonest First</option>
                <option value="DEP_DESC">Departure: Furthest First</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search corridor or coach..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 transition"
              />
            </div>
          </div>

        </div>

        {/* Trips Table */}
        {loading ? (
          <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
            <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
            <span className="text-xs font-bold">Loading live company trips...</span>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 flex flex-col items-center justify-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Bus className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">No Trips Match the Selected Filters</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">
                {searchTerm || dateFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'No departures match your filter query. Reset date filter to view all trips.'
                  : 'Your company has not dispatched any trips yet. Click below to schedule a run.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(dateFilter !== 'ALL' || searchTerm || statusFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setDateFilter('ALL');
                    setCustomDate('');
                    setStatusFilter('ALL');
                    setSearchTerm('');
                  }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition"
                >
                  Clear Filters
                </button>
              )}
              <button
                type="button"
                onClick={() => setDispatchModalOpen(true)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
              >
                + Dispatch Daily Trip
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4 rounded-l-xl">Trip ID</th>
                  <th className="py-3 px-4">Corridor Route</th>
                  <th className="py-3 px-4">Assigned Fleet Vehicle</th>
                  <th className="py-3 px-4">Departure Schedule</th>
                  <th className="py-3 px-4">Base Fare</th>
                  <th className="py-3 px-4 text-center">Occupancy</th>
                  <th className="py-3 px-4 text-center">Chart Status</th>
                  <th className="py-3 px-4">Bus Manager</th>
                  <th className="py-3 px-4 text-right rounded-r-xl">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((t) => {
                  const occupancyPercent = t.occupancyRate ?? Math.round((t.bookedSeats / (t.totalSeats || 1)) * 100);
                  const occColor = occupancyPercent >= 80 ? 'bg-emerald-500' : occupancyPercent >= 50 ? 'bg-blue-500' : 'bg-amber-500';
                  
                  const depDate = new Date(t.departureTime);
                  const isPast = t.isExpired || depDate < new Date();
                  const todayStr = new Date().toISOString().split('T')[0];
                  const depDateStr = !isNaN(depDate.getTime()) ? depDate.toISOString().split('T')[0] : '';
                  const isToday = depDateStr === todayStr;

                  return (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        {t.id}
                        {t.createdAt && (
                          <span className="block text-[9px] text-slate-400 font-normal">
                            Added: {new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">{t.corridor}</td>
                      <td className="py-3.5 px-4 text-slate-600 font-medium">{t.bus}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          {isPast ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                              DEPARTED
                            </span>
                          ) : isToday ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              TODAY
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              {depDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                          <span className="text-slate-800 font-bold text-xs">
                            {t.departure}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {t.minFare && t.maxFare && t.minFare !== t.maxFare
                          ? <>₹{t.minFare}–₹{t.maxFare}</>
                          : <>₹{t.minFare || t.baseFare}</>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="font-bold text-slate-800 text-[11px]">
                            {t.bookedSeats} / {t.totalSeats} ({occupancyPercent}%)
                          </span>
                          <div className="w-20 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className={`${occColor} h-1.5 rounded-full`}
                              style={{ width: `${Math.min(100, occupancyPercent)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {isPast ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                            <span>Closed</span>
                          </span>
                        ) : t.chartPrepared ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-200">
                            <Lock className="w-3 h-3 text-blue-600" />
                            <span>Prepared</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200">
                            <span>Open</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4">
                        {t.tripStatus === 'DEPARTED' ? (
                          <div className="text-[11px] space-y-1">
                            <div className="font-semibold text-slate-800">{t.manager?.name || '—'}</div>
                            <div className="text-blue-700 font-bold">On the road</div>
                            <button onClick={() => setManagerModalTrip(t)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-blue-200 text-blue-700 font-bold cursor-pointer">
                              <UserCog className="w-3 h-3" /> Change / handover
                            </button>
                          </div>
                        ) : t.tripStatus === 'COMPLETED' || isPast ? (
                          <div className="text-[11px] space-y-1">
                            <span className="text-slate-500">{t.manager?.name || '—'}</span>
                            <button onClick={() => setManagerModalTrip(t)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 text-slate-600 font-bold cursor-pointer">
                              <History className="w-3 h-3" /> Timeline
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <select
                              value={t.manager?._id || ''}
                              disabled={assigningTripId === t.rawTripId}
                              onChange={(e) => handleAssignManager(t, e.target.value)}
                              aria-label="Assign bus manager"
                              className="max-w-[140px] px-2 py-1 rounded-lg border border-slate-200 bg-white text-[11px] font-semibold"
                            >
                              <option value="">Not assigned</option>
                              {managers.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                            </select>
                            <button onClick={() => setManagerModalTrip(t)}
                              className="block text-[10px] text-slate-500 hover:text-blue-700 font-semibold cursor-pointer">
                              Change / timeline
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPast ? (
                            <span 
                              className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-400 font-bold text-[10px] border border-slate-200 select-none"
                              title="Departure date has passed. Chart preparation is not active."
                            >
                              Departure Passed
                            </span>
                          ) : !t.chartPrepared ? (
                            <button
                              type="button"
                              onClick={() => handlePrepareChart(t)}
                              disabled={chartPreparingId === t.rawTripId}
                              className="px-2.5 py-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] shadow-xs flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                              title="Generate seat chart & activate boarding"
                            >
                              <FileText className="w-3 h-3" />
                              <span>{chartPreparingId === t.rawTripId ? 'Preparing...' : 'Prepare Chart'}</span>
                            </button>
                          ) : (
                            <span className="px-2 py-1 text-[10px] font-bold text-blue-700 bg-blue-50 rounded-lg">
                              Chart Locked
                            </span>
                          )}
                          {!isPast && !t.chartPrepared && (
                            <button
                              type="button"
                              onClick={() => setFareEditorTripId(t.rawTripId)}
                              className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[10px] border border-emerald-200 flex items-center gap-1 transition cursor-pointer"
                              title="Change prices of selected seats (e.g. upper vs lower berths)"
                            >
                              <span>₹ Seat Prices</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenManifest(t)}
                            className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                            title="View and print passenger manifest chart"
                          >
                            <Printer className="w-3 h-3" />
                            <span>Seat Sheet</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
        {filteredTrips.length > ITEMS_PER_PAGE && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-800">{filteredTrips.length}</span> trips
            </span>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                const pageNum = i + 1;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-xl font-bold transition ${
                      currentPage === pageNum
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition font-medium flex items-center gap-1"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DISPATCH DAILY TRIP MODAL (Supports any date up to next 7 days & Rupadiya direction toggle) */}
      {dispatchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200/90 w-full max-w-5xl rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-blue-600" />
                  <span>Dispatch Daily Corridor Trip</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Schedule active departures for today or any date up to the next 7 days.
                </p>
              </div>
              <button 
                onClick={() => setDispatchModalOpen(false)} 
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatch} className="space-y-4 text-xs">
              
              {/* Departure Date Selection with Quick Pills */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-bold flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    <span>Departure Date (Up to Next 7 Days) *</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-medium">Select specific date</span>
                </div>

                {/* Quick Date Pills */}
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {next7Days.map((d) => {
                    const isSelected = form.departureDate === d.dateStr;
                    return (
                      <button
                        type="button"
                        key={d.dateStr}
                        onClick={() => setForm({ ...form, departureDate: d.dateStr })}
                        className={`p-1.5 rounded-xl border text-center transition ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-[9px] uppercase tracking-wider block opacity-90">{d.label}</div>
                        <div className="text-[11px] font-bold">{d.formattedShort}</div>
                      </button>
                    );
                  })}
                </div>

                <input
                  type="date"
                  required
                  min={minDateStr}
                  max={maxDateStr}
                  value={form.departureDate}
                  onChange={(e) => setForm({ ...form, departureDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              {/* Corridor Route with Fixed Rupadiya & Dynamic Opposite Options */}
              <div className="p-3.5 rounded-2xl bg-blue-50/60 border border-blue-100 space-y-3">
                
                {/* Route Selection Filter */}
                <div>
                  <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
                    <span>Select Route Corridor *</span>
                    <span className="text-[10px] text-blue-600 lowercase font-medium">filters destination dropdown</span>
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedRouteGroup('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                        selectedRouteGroup === 'ALL'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      All Routes (16 Cities)
                    </button>
                    {ROUTE_GROUPS.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          setSelectedRouteGroup(g.id);
                          const firstCity = g.cities[0];
                          if (firstCity) {
                            setSelectedSpoke(firstCity.name);
                            setForm(prev => ({ ...prev, fare: String(firstCity.defaultFare) }));
                          }
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          selectedRouteGroup === g.id
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {g.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-blue-100/60">
                  <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>Corridor Direction</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleSwapDirection}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 text-[10px] font-bold hover:bg-blue-100 transition shadow-2xs cursor-pointer"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span>Swap Direction</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                  {/* Origin Field */}
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">
                      Origin {direction === 'OUTBOUND' ? '(Fixed Hub)' : '(Spoke City)'} *
                    </label>
                    <select
                      value={direction === 'OUTBOUND' ? 'Rupadiya (Hub)' : selectedSpoke}
                      onChange={(e) => handleOriginChange(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      {direction === 'OUTBOUND' ? (
                        <option value="Rupadiya (Hub)">Rupadiya (Hub)</option>
                      ) : (
                        (selectedRouteGroup === 'ALL'
                          ? ROUTE_GROUPS
                          : ROUTE_GROUPS.filter(g => g.id === selectedRouteGroup)
                        ).map(g => (
                          <optgroup key={g.id} label={g.name}>
                            {g.cities.map(s => (
                              <option key={s.id} value={s.name}>
                                {s.name} ({s.state}) · ₹{s.defaultFare}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Destination Field */}
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">
                      Destination {direction === 'INBOUND' ? '(Fixed Hub)' : '(Spoke City)'} *
                    </label>
                    <select
                      value={direction === 'INBOUND' ? 'Rupadiya (Hub)' : selectedSpoke}
                      onChange={(e) => handleDestinationChange(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-500 shadow-2xs"
                    >
                      {direction === 'INBOUND' ? (
                        <option value="Rupadiya (Hub)">Rupadiya (Hub)</option>
                      ) : (
                        (selectedRouteGroup === 'ALL'
                          ? ROUTE_GROUPS
                          : ROUTE_GROUPS.filter(g => g.id === selectedRouteGroup)
                        ).map(g => (
                          <optgroup key={g.id} label={g.name}>
                            {g.cities.map(s => (
                              <option key={s.id} value={s.name}>
                                {s.name} ({s.state}) · ₹{s.defaultFare}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      )}
                    </select>
                  </div>
                </div>

                <div className="text-[11px] text-blue-700 flex items-center gap-1 font-medium">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Approved Corridor: <strong>{direction === 'OUTBOUND' ? 'Rupadiya' : selectedSpoke}</strong> → <strong>{direction === 'OUTBOUND' ? selectedSpoke : 'Rupadiya'}</strong>
                  </span>
                </div>
              </div>

              {/* Time & Base Fare */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                    <span>Departure Time *</span>
                  </label>
                  <input
                    type="time"
                    required
                    value={form.departureTime}
                    onChange={(e) => setForm({ ...form, departureTime: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Standard Passenger Fare (₹) *</label>
                  <input
                    type="number"
                    min="300"
                    step="50"
                    required
                    value={form.fare}
                    onChange={(e) => setForm({ ...form, fare: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Assigned Fleet Bus */}
              <div>
                <label className="text-slate-700 font-bold block mb-1 flex items-center gap-1">
                  <Bus className="w-3.5 h-3.5 text-blue-600" />
                  <span>Assigned Fleet Vehicle *</span>
                </label>
                {loadingBuses ? (
                  <div className="p-2.5 bg-slate-50 rounded-xl text-slate-400 text-xs flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Loading company fleet coaches...</span>
                  </div>
                ) : fleetBuses.length === 0 ? (
                  <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-center justify-between">
                    <span>No fleet buses found under your company.</span>
                    <a href="/fleet/add" className="font-bold underline text-amber-800">+ Add Bus</a>
                  </div>
                ) : (
                  <select
                    value={form.busId}
                    required
                    onChange={(e) => setForm({ ...form, busId: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-blue-500"
                  >
                    {fleetBuses.map((b) => (
                      <option key={b._id} value={b._id}>
                        {b.busNumber} — {b.name || 'Fleet Coach'} ({b.busType || '2+2 Seater'})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dispatching || fleetBuses.length === 0}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {dispatching ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Scheduling Trip...</span>
                    </>
                  ) : (
                    <span>Confirm & Dispatch Trip →</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE SEAT SHEET MANIFEST MODAL (Shows Real Live Details & Real Vacant State) */}
      {manifestModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200/90 w-full max-w-4xl rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:p-0">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-4 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold">
                  <Printer className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                      Official Passenger Manifest
                    </span>
                    <span className="text-xs text-slate-400 font-medium">· Live Seat Sheet Manifest</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Seat Sheet Chart · Departure Manifest
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Sheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManifestModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {manifestLoading ? (
              <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
                <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                <span className="text-xs font-bold">Loading live seat chart manifest from database...</span>
              </div>
            ) : manifestData ? (
              <div className="space-y-6 print:space-y-4">
                
                {/* Print Banner / Key Details */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Corridor Route</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {manifestData.trip?.route?.fromCity?.name || 'Rupadiya'} → {manifestData.trip?.route?.toCity?.name || 'Destination'}
                    </span>
                    <span className="text-[10px] font-bold text-blue-700 block mt-0.5">
                      {formatDeparture(manifestData.trip?.departureTime)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Assigned Coach</span>
                    <span className="font-bold text-blue-700">
                      {manifestData.trip?.bus?.busNumber || 'Fleet Vehicle'}
                    </span>
                    <span className="text-[10px] text-slate-500 block truncate">
                      {manifestData.trip?.bus?.busType || 'Luxury Coach'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Driver In-Charge</span>
                    <span className="font-bold text-slate-800">
                      {manifestData.trip?.bus?.driverName || 'Assigned Driver'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500 block">
                      {manifestData.trip?.bus?.driverPhone || '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Chart Status</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] border mt-0.5 ${
                      manifestData.trip?.chartPrepared
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {manifestData.trip?.chartPrepared ? (
                        <>
                          <Lock className="w-3 h-3 text-blue-600" />
                          <span>Chart Prepared</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Open for Booking</span>
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Live Occupancy</span>
                    <span className="font-bold text-emerald-700 text-sm">
                      {manifestData.summary?.bookedSeats} / {manifestData.summary?.totalSeats} ({manifestData.summary?.occupancyRate || 0}%)
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 block">
                      ₹{Number(manifestData.summary?.totalCollected || 0).toLocaleString('en-IN')} collected
                    </span>
                  </div>
                </div>

                {/* If 0 seats booked, show clear live status banner */}
                {manifestData.summary?.bookedSeats === 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>
                      <strong>Live Status:</strong> No passengers booked yet for this departure. All {manifestData.summary?.totalSeats} seats are currently vacant.
                    </span>
                  </div>
                )}

                {/* Manifest Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                        <th className="py-2.5 px-3">Seat #</th>
                        <th className="py-2.5 px-3">Deck</th>
                        <th className="py-2.5 px-3">Passenger Name</th>
                        <th className="py-2.5 px-3">Age / Gender</th>
                        <th className="py-2.5 px-3">PNR</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Boarding Point</th>
                        <th className="py-2.5 px-3 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(manifestData.manifest || []).map((row, idx) => (
                        <tr 
                          key={idx}
                          className={row.status === 'CONFIRMED' ? 'bg-white hover:bg-slate-50' : 'bg-slate-50/50 text-slate-400'}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-blue-900">
                            {row.seatNumber}
                          </td>
                          <td className="py-2 px-3 text-[10px] font-bold text-slate-500">
                            {row.deck || 'LOWER'}
                          </td>
                          <td className={`py-2 px-3 ${row.status === 'CONFIRMED' ? 'font-bold text-slate-900' : 'italic text-slate-400'}`}>
                            {row.passengerName}
                          </td>
                          <td className="py-2 px-3 text-slate-600">
                            {row.age && row.age !== '—' ? `${row.age}y / ${String(row.gender).toUpperCase()}` : '—'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">
                            {row.pnr}
                          </td>
                          <td className="py-2 px-3 font-mono text-[11px] text-slate-600">
                            {row.contactPhone}
                          </td>
                          <td className="py-2 px-3 text-slate-700 font-medium">
                            {row.boardingPoint}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <span className={`px-2 py-0.5 rounded-md text-[9px] font-bold ${
                              row.status === 'CONFIRMED' 
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer notes */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2 border-t border-slate-100">
                  <span>• Generated via Rupadiya Intercity Automated Dispatch Authority</span>
                  <span className="font-semibold text-rose-600">
                    ⚠️ Cutoff Locked: Cancellation fee is 85% post-chart preparation.
                  </span>
                </div>

              </div>
            ) : null}

          </div>
        </div>
      )}
      {fareEditorTripId && (
        <SeatFareEditor
          tripId={fareEditorTripId}
          onClose={() => setFareEditorTripId(null)}
          onSaved={(msg) => {
            setActionSuccess(msg || 'Seat prices updated.');
            fetchTrips();
          }}
        />
      )}
      {managerModalTrip && (
        <ManagerTimelineModal
          trip={managerModalTrip}
          managers={managers}
          onClose={() => setManagerModalTrip(null)}
          onSaved={(msg) => { setManagerModalTrip(null); setActionSuccess(msg || 'Bus manager updated.'); fetchTrips(); }}
        />
      )}
    </div>
  );
}

/**
 * Change a trip's bus manager — including a mid-route handover at a stop — and show the
 * timeline of who managed the bus from where on the trip's day.
 */
function ManagerTimelineModal({ trip, managers, onClose, onSaved }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [managerId, setManagerId] = useState('');
  const [handoverPoint, setHandoverPoint] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () => api.getTripManagerTimeline(trip.rawTripId).then((res) => { setData(res); setManagerId(res.currentManagerId || ''); }).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [trip.rawTripId]);

  const editable = ['SCHEDULED', 'BOARDING', 'DEPARTED'].includes(data?.trip?.status);
  const midRoute = data?.trip?.status === 'DEPARTED';
  const needsHandover = midRoute || (data?.timeline?.length || 0) > 0;
  const changed = managerId && managerId !== (data?.currentManagerId || '');

  const save = async () => {
    if (!changed) { setErr('Pick a different manager to change.'); return; }
    if (needsHandover && !handoverPoint) { setErr('Select the stop where the new manager takes over.'); return; }
    setBusy(true); setErr('');
    try {
      const res = await api.assignTripManager(trip.rawTripId, { managerId, handoverPoint: needsHandover ? handoverPoint : undefined, note: note.trim() || undefined });
      if (res?.success === false) throw new Error(res.error);
      onSaved(res?.message);
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={busy ? undefined : onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <h3 className="text-base font-bold text-slate-900">Trip manager</h3>
            {data ? <p className="text-xs text-slate-500">{data.trip.route} · {data.trip.busNumber} · {new Date(data.trip.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p> : null}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 cursor-pointer"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <div className="p-5 space-y-4">
          {err ? <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{err}</div> : null}

          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase mb-2 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Manager timeline</div>
            {!data ? <p className="text-xs text-slate-400">Loading…</p> : !data.timeline.length ? (
              <p className="text-xs text-slate-400">No manager assigned yet.</p>
            ) : (
              <div className="space-y-0">
                {data.timeline.map((seg, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-600 mt-1.5" />
                      {i < data.timeline.length - 1 && <div className="w-0.5 flex-1 bg-slate-200" />}
                    </div>
                    <div className="pb-3">
                      <div className="text-sm font-bold text-slate-800">{seg.managerName}</div>
                      <div className="text-xs text-slate-500">{seg.from} → {seg.until}</div>
                      {seg.note ? <div className="text-[11px] text-slate-400 italic">“{seg.note}”</div> : null}
                      <div className="text-[10px] text-slate-400">{new Date(seg.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}{seg.assignedBy ? ` · by ${seg.assignedBy}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {editable && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase">{midRoute ? 'Hand over to another manager' : 'Assign / change manager'}</div>
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">Bus manager</label>
                <select value={managerId} onChange={(e) => setManagerId(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold">
                  <option value="">Not assigned</option>
                  {managers.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
              </div>
              {changed && needsHandover && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Takes over at stop *</label>
                  <select value={handoverPoint} onChange={(e) => setHandoverPoint(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold">
                    <option value="">Select the handover stop</option>
                    {(data?.stops || []).map((s) => <option key={s.id || s.name} value={s.name}>{s.name}</option>)}
                  </select>
                  <p className="text-[10px] text-slate-400 mt-1">The passenger-facing timeline records from where each manager runs the bus.</p>
                </div>
              )}
              {changed && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Note (optional)</label>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. driver change at depot" className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
                </div>
              )}
              <button onClick={save} disabled={busy || !changed} className="w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold cursor-pointer disabled:opacity-50">
                {busy ? 'Saving…' : midRoute ? 'Hand over bus' : 'Save manager'}
              </button>
            </div>
          )}
          {!editable && data ? <p className="text-xs text-slate-400 border-t border-slate-100 pt-4">This trip is {String(data.trip.status).toLowerCase()} — the manager can no longer be changed.</p> : null}
        </div>
      </div>
    </div>
  );
}
