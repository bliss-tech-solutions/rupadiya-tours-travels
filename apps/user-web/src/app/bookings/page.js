'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Ticket, 
  Clock, 
  MapPin, 
  Calendar, 
  ChevronRight, 
  Compass, 
  AlertCircle,
  Download,
  Bus
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatDate, formatTime } from '../../lib/dateUtils';

export default function MyBookingsHistoryPage() {
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [tourBookings, setTourBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bus'); // 'bus' | 'tours'

  useEffect(() => {
    async function loadData() {
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
          }
          if (tourRes.status === 'fulfilled') {
            const tList = tourRes.value.bookings || tourRes.value.data || [];
            setTourBookings(tList);
          }
        } else {
          // Check if session has a recently confirmed ticket for guest
          const confRaw = typeof window !== 'undefined' ? sessionStorage.getItem('rupadiya_confirmed_ticket') : null;
          if (confRaw) {
            try {
              const parsed = JSON.parse(confRaw);
              if (parsed.booking) {
                setBookings([parsed.booking]);
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
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Header */}
      <section className="bg-white border-b border-slate-200 py-10 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider mb-2">
              <Ticket className="w-3.5 h-3.5" />
              <span>Travel Dashboard</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              My Trips & Reservations
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Access your digital boarding passes, trip barcodes, and tour details anytime.
            </p>
          </div>

          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition self-start sm:self-auto"
          >
            + Book New Trip
          </Link>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 pt-8">
        {!user && bookings.length === 0 && !loading ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-10 sm:p-12 text-center max-w-md mx-auto shadow-sm my-6">
            <div className="w-16 h-16 rounded-3xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-4">
              <Ticket className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-1">View Your Trips</h3>
            <p className="text-xs text-slate-500 mb-6 leading-relaxed">
              Login with your mobile number to view all your digital tickets, booking history, and barcodes.
            </p>
            <Link
              href="/login?redirect=/bookings"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition active:scale-95"
            >
              <span>Login with Mobile OTP →</span>
            </Link>
          </div>
        ) : (
          <>
            {/* Tabs */}
            <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-6">
          <button
            onClick={() => setActiveTab('bus')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'bus'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <Bus className="w-4 h-4" />
            <span>Intercity Bus Tickets ({bookings.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('tours')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'tours'
                ? 'bg-sky-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Tour Escapes ({tourBookings.length})</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(n => (
              <div key={n} className="bg-white rounded-3xl h-36 border border-slate-200 animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'bus' ? (
          bookings.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto my-6">
              <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Bus Bookings Yet</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Ready for your journey? Explore routes from Rupaidiha to Ahmedabad, Surat, and more.
              </p>
              <Link
                href="/"
                className="px-6 py-3 rounded-2xl bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-500/20"
              >
                Search Buses
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {bookings.map((b) => {
                const trip = b.trip || b.tripId || {};
                const bus = trip.bus || trip.busId || b.bus || b.busId || {};
                const depTime = trip.departureTime || b.travelDate || b.createdAt;
                const date = depTime ? formatDate(depTime, 'medium') : 'Upcoming';
                const timeStr = formatTime(b.boardingPoint?.time || trip.departureTime, '05:30 PM');

                const seatList = (b.seatNumbers && b.seatNumbers.length > 0)
                  ? b.seatNumbers.join(', ')
                  : (b.seats && b.seats.length > 0)
                  ? b.seats.map(s => typeof s === 'string' ? s : s.seatNumber).filter(Boolean).join(', ')
                  : (b.passengers && b.passengers.length > 0)
                  ? b.passengers.map(p => p.seatNumber).filter(Boolean).join(', ')
                  : '1';

                const fare = b.fareBreakdown?.totalPayable 
                  ?? b.totalAmount 
                  ?? b.totalFare 
                  ?? b.totalPrice 
                  ?? (b.passengers?.length ? b.passengers.reduce((sum, p) => sum + (p.fare || 0), 0) : null)
                  ?? (trip.baseFare && (b.seatNumbers?.length || b.seats?.length) ? trip.baseFare * (b.seatNumbers?.length || b.seats?.length) : null)
                  ?? 850;

                return (
                  <div
                    key={b._id}
                    className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold font-mono text-sky-600 bg-sky-50 px-2 py-0.5 rounded truncate">
                          #{b.bookingId}
                        </span>
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          {b.status || 'CONFIRMED'}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-slate-900 truncate">
                        {bus.name || trip.bus?.name || 'Rupadiya Intercity Bus'}
                      </h3>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-sky-500" /> {date} · {timeStr}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {b.boardingPoint?.name || 'Rupaidiha Border Main Stand'}
                        </span>
                        <span>Seats: <strong className="text-slate-800">{seatList}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 flex-shrink-0">
                      <div className="text-sm font-bold text-slate-900">
                        ₹{fare}
                      </div>
                      <Link
                        href={`/ticket/${b.bookingId || b._id}`}
                        className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-1.5"
                      >
                        <span>View Pass</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          tourBookings.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center max-w-md mx-auto my-6">
              <Compass className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">No Tour Escapes Booked</h3>
              <p className="text-xs text-slate-500 mt-1 mb-6">
                Discover all-inclusive handpicked tours to Kutch, Udaipur, Goa, and Manali.
              </p>
              <Link
                href="/tours"
                className="px-6 py-3 rounded-2xl bg-sky-500 text-white font-bold text-xs shadow-md shadow-sky-500/20"
              >
                Explore Tours
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {tourBookings.map((tb) => (
                <div
                  key={tb._id}
                  className="bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded truncate">
                        #{tb.bookingId}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {tb.status || 'CONFIRMED'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 truncate">{tb.tour?.title || 'Tour Escape'}</h3>
                    <p className="text-xs text-slate-500">
                      Travel Date: {new Date(tb.travelDate).toLocaleDateString()} · {tb.numberOfTravelers} Travelers
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <div className="text-base font-bold text-slate-900">₹{tb.totalAmount}</div>
                    <span className="text-xs text-emerald-600 font-semibold">Confirmed</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
          </>
        )}
      </div>
    </div>
  );
}

