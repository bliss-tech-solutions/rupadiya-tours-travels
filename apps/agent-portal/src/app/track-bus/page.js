'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Navigation, 
  Search, 
  Clock, 
  MapPin, 
  Calendar, 
  Users, 
  Ticket, 
  ShieldCheck, 
  RefreshCw, 
  AlertCircle,
  PhoneCall,
  CheckCircle2,
  Printer
} from 'lucide-react';
import { api } from '../../lib/api';

export default function TrackBusPage() {
  const [ticketNo, setTicketNo] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trackedTicket, setTrackedTicket] = useState(null);
  console.log('trackedTicket >>> ', trackedTicket);

  // Quick list of upcoming bookings issued by agent
  const [upcomingList, setUpcomingList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);

  const fetchUpcomingList = async () => {
    setLoadingList(true);
    try {
      const res = await api.getUpcomingTrips();
      if (res?.success) {
        setUpcomingList(res.data?.trips || res.trips || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    fetchUpcomingList();
  }, []);

  const handleTrackSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!ticketNo.trim()) {
      setError('Please enter a valid ticket number or PNR.');
      return;
    }

    setLoading(true);
    setError('');
    setTrackedTicket(null);

    try {
      const res = await api.searchTicket(ticketNo.trim());
      const b = res.booking || res.data || res;
      if (res.success && b && b.pnr) {
        setTrackedTicket(b);
      } else {
        setError(res.error || 'No upcoming ticket found matching this PNR.');
      }
    } catch (err) {
      setError(err.message || 'Error tracking ticket status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
          Live Dispatch & Boarding Desk
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Track a Bus</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Enter passenger ticket number to check upcoming journey status, reporting time, and bus dispatch
        </p>
      </div>

      {/* Ticket Lookup Form */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <form onSubmit={handleTrackSubmit} className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={ticketNo}
              onChange={(e) => setTicketNo(e.target.value)}
              placeholder="Enter Upcoming Ticket No. / PNR (e.g. BK_RUP_10001)"
              className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-500 uppercase shadow-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition active:scale-95 flex items-center justify-center gap-1.5 shadow-xs shrink-0"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Track Journey'}
          </button>
        </form>

        {error && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Tracked Ticket Status Result Card */}
      {trackedTicket && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-5 shadow-xs">
          {/* Status Bar */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Upcoming Ticket</span>
              <div className="text-base font-bold text-slate-900">PNR: #{trackedTicket.pnr}</div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              CONFIRMED • ON SCHEDULE
            </span>
          </div>

          {/* Route Card */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Boarding Stand</span>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {trackedTicket.trip?.sourceCity || trackedTicket.tripId?.sourceCity || trackedTicket.tripId?.fromCity?.name || 'Rupadiya'}
              </div>
              <div className="text-emerald-700 font-medium">
                {trackedTicket.boardingPoint?.location || trackedTicket.boardingPoint?.name || 'Main Stand'}
              </div>
              <div className="text-slate-500 flex items-center gap-1 mt-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Departure: {trackedTicket.trip?.departureTime || trackedTicket.tripId?.departureTime || '05:30 PM'}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center border-y md:border-y-0 md:border-x border-slate-200 py-2 md:py-0">
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Travel Date</span>
              <div className="text-xs font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {trackedTicket.trip?.departureDate || trackedTicket.tripId?.departureDate ? new Date(trackedTicket.trip?.departureDate || trackedTicket.tripId?.departureDate).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }) : 'Today'}
              </div>
              <span className="text-[10px] text-emerald-700 font-medium mt-1">Direct Non-Stop</span>
            </div>

            <div className="text-left md:text-right">
              <span className="text-[10px] text-slate-500 uppercase block font-semibold">Dropping Stand</span>
              <div className="text-sm font-bold text-slate-900 mt-0.5">
                {trackedTicket.trip?.destinationCity || trackedTicket.tripId?.destinationCity || trackedTicket.tripId?.toCity?.name  || 'Destination'}
              </div>
              <div className="text-slate-700 font-medium">
                {trackedTicket.droppingPoint?.location || trackedTicket.droppingPoint?.name || 'Central Stand'}
              </div>
              <div className="text-slate-500 flex items-center gap-1 mt-1 md:justify-end">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Arrival: {trackedTicket.trip?.arrivalTime || trackedTicket.tripId?.arrivalTime || 'Morning'}
              </div>
            </div>
          </div>

          {/* Details & Passenger Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase block">Assigned Seats</span>
              <span className="text-emerald-700 font-bold text-sm block mt-0.5">
                {trackedTicket.seats?.map(s => s.seatNumber || s).join(', ') || trackedTicket.seatNumbers?.join(', ') || 'N/A'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase block">Passenger</span>
              <span className="text-slate-900 font-bold block mt-0.5 truncate">
                {trackedTicket.passengers?.[0]?.name || trackedTicket.contactDetails?.name || 'Customer'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase block">Customer Mobile</span>
              <span className="text-slate-900 font-mono font-medium block mt-0.5">
                {trackedTicket.contactDetails?.phone || 'On Record'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
              <span className="text-[10px] text-slate-500 uppercase block">Coach Model</span>
              <span className="text-slate-900 font-bold block mt-0.5 truncate">
                {trackedTicket.bus?.name || 'Rupadiya Setra'}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <PhoneCall className="w-3.5 h-3.5 text-emerald-600" />
              <span>Helpline: +91 98765 43210</span>
            </div>

            <Link
              href={`/print-ticket`}
              className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs transition flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Boarding Pass</span>
            </Link>
          </div>
        </div>
      )}

      {/* Upcoming Scheduled Services List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Scheduled Upcoming Departures</h3>
            <p className="text-[11px] text-slate-500">Fleet schedules connecting Rupadiya Corridor</p>
          </div>
          <button
            onClick={fetchUpcomingList}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loadingList ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {upcomingList.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs">
            No upcoming departures scheduled for today.
          </div>
        ) : (
          <div className="space-y-2.5">
            {upcomingList.slice(0, 5).map((trip) => (
              <div
                key={trip._id}
                className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900">
                    {trip.sourceCity} → {trip.destinationCity}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Departure: <strong className="text-slate-800">{trip.departureTime || '05:30 PM'}</strong> • {trip.busId?.name || 'Rupadiya Express'}
                  </div>
                </div>

                <Link
                  href="/booking"
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg text-xs transition shadow-xs"
                >
                  Book on this Bus
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
