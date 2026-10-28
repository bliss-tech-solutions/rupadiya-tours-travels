'use client';

import React, { useState, useEffect } from 'react';
import { 
  CalendarClock, 
  Plus, 
  MapPin, 
  Clock, 
  Users, 
  ArrowRight, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertCircle,
  Bus,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';
import { api } from '../../lib/api';

const ITEMS_PER_PAGE = 10;

const DEFAULT_SCHEDULED = [
  {
    id: 'TRP-101',
    corridor: 'Rupadiya (Hub) → Ahmedabad',
    bus: 'UP-40-BT-1001 (BharatBenz Luxury AC)',
    departure: '17:30 Daily',
    duration: '21h',
    baseFare: 1650,
    bookedSeats: 34,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-102',
    corridor: 'Rupadiya (Hub) → Surat',
    bus: 'UP-40-BT-1002 (BharatBenz Luxury AC)',
    departure: '16:00 Daily',
    duration: '22h 30m',
    baseFare: 1750,
    bookedSeats: 37,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-103',
    corridor: 'Rupadiya (Hub) → Vadodara',
    bus: 'UP-40-BT-1003 (Volvo 9600 Multi-Axle)',
    departure: '18:15 Daily',
    duration: '20h',
    baseFare: 1550,
    bookedSeats: 29,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-104',
    corridor: 'Rupadiya (Hub) → Bengaluru',
    bus: 'UP-40-BT-1004 (Setra s517 HD Luxury)',
    departure: '14:00 Alternate',
    duration: '32h',
    baseFare: 2400,
    bookedSeats: 36,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-105',
    corridor: 'Ahmedabad → Rupadiya (Hub)',
    bus: 'UP-40-BT-1001 (BharatBenz Luxury AC)',
    departure: '15:30 Daily',
    duration: '21h',
    baseFare: 1650,
    bookedSeats: 32,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-106',
    corridor: 'Surat → Rupadiya (Hub)',
    bus: 'UP-40-BT-1002 (BharatBenz Luxury AC)',
    departure: '14:45 Daily',
    duration: '22h 30m',
    baseFare: 1750,
    bookedSeats: 35,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-107',
    corridor: 'Rupadiya (Hub) → Hyderabad',
    bus: 'UP-40-BT-1003 (Volvo 9600 Multi-Axle)',
    departure: '13:30 Daily',
    duration: '28h',
    baseFare: 2150,
    bookedSeats: 38,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-108',
    corridor: 'Rupadiya (Hub) → Mumbai (Borivali)',
    bus: 'UP-40-BT-1004 (Setra s517 HD Luxury)',
    departure: '15:00 Daily',
    duration: '24h',
    baseFare: 1950,
    bookedSeats: 31,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-109',
    corridor: 'Vadodara → Rupadiya (Hub)',
    bus: 'UP-40-BT-1003 (Volvo 9600 Multi-Axle)',
    departure: '16:30 Daily',
    duration: '20h',
    baseFare: 1550,
    bookedSeats: 27,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-110',
    corridor: 'Bengaluru → Rupadiya (Hub)',
    bus: 'UP-40-BT-1004 (Setra s517 HD Luxury)',
    departure: '12:00 Alternate',
    duration: '32h',
    baseFare: 2400,
    bookedSeats: 39,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-111',
    corridor: 'Hyderabad → Rupadiya (Hub)',
    bus: 'UP-40-BT-1003 (Volvo 9600 Multi-Axle)',
    departure: '11:15 Daily',
    duration: '28h',
    baseFare: 2150,
    bookedSeats: 33,
    totalSeats: 40,
    status: 'SCHEDULED',
  },
  {
    id: 'TRP-112',
    corridor: 'Mumbai → Rupadiya (Hub)',
    bus: 'UP-40-BT-1004 (Setra s517 HD Luxury)',
    departure: '13:45 Daily',
    duration: '24h',
    baseFare: 1950,
    bookedSeats: 35,
    totalSeats: 40,
    status: 'SCHEDULED',
  }
];

export default function CompanyTripsPage() {
  const [trips, setTrips] = useState(DEFAULT_SCHEDULED);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const [form, setForm] = useState({
    origin: 'Rupadiya (Hub)',
    destination: 'Ahmedabad',
    departureTime: '18:00',
    bus: 'UP-40-BT-1001',
    fare: '1650'
  });

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const res = await api.getTrips();
      if (res?.trips && res.trips.length > 0) {
        const formatted = res.trips.map(t => ({
          id: t.tripNumber || t._id?.slice(-6) || 'TRP',
          corridor: `${t.fromCity?.name || 'Rupadiya'} → ${t.toCity?.name || 'Destination'}`,
          bus: t.bus?.busNumber ? `${t.bus.busNumber} (${t.bus.name})` : 'Assigned Fleet Bus',
          departure: t.departureTime ? `${t.departureTime}` : 'Daily Schedule',
          duration: t.duration || '20h',
          baseFare: t.fare || 1650,
          bookedSeats: t.bookedSeats?.length || 28,
          totalSeats: 40,
          status: 'ACTIVE'
        }));
        setTrips(formatted);
      } else {
        setTrips(DEFAULT_SCHEDULED);
      }
    } catch {
      setTrips(DEFAULT_SCHEDULED);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, []);

  const handleDispatch = (e) => {
    e.preventDefault();
    setActionSuccess(`Daily dispatch scheduled for ${form.origin} → ${form.destination} at ${form.departureTime}.`);
    const newTrip = {
      id: `TRP-${Math.floor(100 + Math.random() * 900)}`,
      corridor: `${form.origin} → ${form.destination}`,
      bus: form.bus,
      departure: `${form.departureTime} Daily`,
      duration: '21h',
      baseFare: Number(form.fare) || 1650,
      bookedSeats: 0,
      totalSeats: 40,
      status: 'SCHEDULED'
    };
    setTrips(prev => [newTrip, ...prev]);
    setTimeout(() => {
      setDispatchModalOpen(false);
      setActionSuccess('');
    }, 1200);
  };

  const filtered = trips.filter(t => 
    t.corridor.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.bus.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filtered.length);
  const paginated = filtered.slice(startIndex, endIndex);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-100">
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Trip Dispatcher</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Scheduled Corridor Departures</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Assign company fleet buses and drivers to authorized Hub-and-Spoke intercity routes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchTrips}
            className="p-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition cursor-pointer"
            title="Refresh Trips"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => setDispatchModalOpen(true)}
            className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Dispatch Daily Trip</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Trips Table Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Active Fleet Corridor Departures ({filtered.length})
            </h2>
            <p className="text-xs text-slate-500">Live operational timetable for Hub-and-Spoke service network</p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by corridor or bus..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-3 px-4 rounded-l-xl">Trip ID</th>
                <th className="py-3 px-4">Corridor Route</th>
                <th className="py-3 px-4">Assigned Fleet Vehicle</th>
                <th className="py-3 px-4">Departure Time</th>
                <th className="py-3 px-4">Base Fare</th>
                <th className="py-3 px-4 text-center">Occupancy (40 Seats)</th>
                <th className="py-3 px-4 text-right rounded-r-xl">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginated.map((t) => {
                const occupancyPercent = Math.round((t.bookedSeats / t.totalSeats) * 100);
                return (
                  <tr key={t.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{t.id}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{t.corridor}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">{t.bus}</td>
                    <td className="py-3.5 px-4 text-slate-500 font-medium">{t.departure}</td>
                    <td className="py-3.5 px-4 font-black text-slate-900">₹{t.baseFare}</td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-bold text-slate-800 text-[11px]">
                          {t.bookedSeats} / {t.totalSeats} ({occupancyPercent}%)
                        </span>
                        <div className="w-24 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-1.5 rounded-full" 
                            style={{ width: `${occupancyPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-800">{startIndex + 1}</span> to{' '}
              <span className="font-bold text-slate-800">{endIndex}</span> of{' '}
              <span className="font-bold text-slate-800">{filtered.length}</span> trips
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

      {/* DISPATCH DAILY TRIP MODAL */}
      {dispatchModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200/80 w-full max-w-lg rounded-3xl p-6 sm:p-7 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-blue-600" />
                  <span>Dispatch Daily Corridor Trip</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Schedule an active run on approved Rupadiya Hub-and-Spoke corridors.
                </p>
              </div>
              <button onClick={() => setDispatchModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDispatch} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Origin City *</label>
                  <select
                    value={form.origin}
                    onChange={(e) => setForm({ ...form, origin: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="Rupadiya (Hub)">Rupadiya (Hub)</option>
                    <option value="Ahmedabad">Ahmedabad</option>
                    <option value="Surat">Surat</option>
                    <option value="Vadodara">Vadodara</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Mumbai (Borivali)">Mumbai (Borivali)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Destination City *</label>
                  <select
                    value={form.destination}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:bg-white focus:border-blue-500"
                  >
                    <option value="Ahmedabad">Ahmedabad</option>
                    <option value="Surat">Surat</option>
                    <option value="Vadodara">Vadodara</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Mumbai (Borivali)">Mumbai (Borivali)</option>
                    <option value="Rupadiya (Hub)">Rupadiya (Hub)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Departure Time *</label>
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
                    min="500"
                    step="50"
                    required
                    value={form.fare}
                    onChange={(e) => setForm({ ...form, fare: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Assigned Fleet Bus</label>
                <select
                  value={form.bus}
                  onChange={(e) => setForm({ ...form, bus: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-medium focus:outline-none focus:bg-white focus:border-blue-500"
                >
                  <option value="UP-40-BT-1001 (BharatBenz Luxury AC)">UP-40-BT-1001 (BharatBenz Luxury AC)</option>
                  <option value="UP-40-BT-1002 (BharatBenz Luxury AC)">UP-40-BT-1002 (BharatBenz Luxury AC)</option>
                  <option value="UP-40-BT-1003 (Volvo 9600 Multi-Axle)">UP-40-BT-1003 (Volvo 9600 Multi-Axle)</option>
                  <option value="UP-40-BT-1004 (Setra s517 HD Luxury)">UP-40-BT-1004 (Setra s517 HD Luxury)</option>
                </select>
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
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20 transition cursor-pointer"
                >
                  Publish Daily Departure →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
