'use client';

import React, { useState } from 'react';
import { CalendarClock, Plus, MapPin, Clock, Users, ArrowRight } from 'lucide-react';

export default function CompanyTripsPage() {
  const scheduledTrips = [
    {
      id: 'TRP-101',
      corridor: 'Rupadiya (Hub) → Ahmedabad',
      bus: 'UP-40-BT-1001 (BharatBenz)',
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
      bus: 'UP-40-BT-1002 (BharatBenz)',
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
      bus: 'UP-40-BT-1003 (Volvo 9600)',
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
      bus: 'UP-40-BT-1004 (Setra s517)',
      departure: '14:00 Alternate',
      duration: '32h',
      baseFare: 2400,
      bookedSeats: 36,
      totalSeats: 40,
      status: 'SCHEDULED',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Trip Dispatcher</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Scheduled Corridor Departures</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Assign company fleet buses and drivers to authorized Hub-and-Spoke intercity routes.
          </p>
        </div>

        <button
          onClick={() => alert('Trip scheduler modal opened.')}
          className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Dispatch Daily Trip</span>
        </button>
      </div>

      <div className="bg-[#0D131F] border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          Active Scheduled Fleet Departures (Next 14 Days)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Trip ID</th>
                <th className="py-3 px-4">Corridor</th>
                <th className="py-3 px-4">Assigned Bus</th>
                <th className="py-3 px-4">Departure Time</th>
                <th className="py-3 px-4">Base Fare</th>
                <th className="py-3 px-4 text-center">Occupancy (40 Seats)</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {scheduledTrips.map((t) => (
                <tr key={t.id} className="hover:bg-slate-900/60 transition">
                  <td className="py-3 px-4 font-mono font-bold text-blue-400">{t.id}</td>
                  <td className="py-3 px-4 font-bold text-white">{t.corridor}</td>
                  <td className="py-3 px-4 text-slate-300">{t.bus}</td>
                  <td className="py-3 px-4 text-slate-400">{t.departure}</td>
                  <td className="py-3 px-4 font-black text-white">₹{t.baseFare}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="font-bold text-emerald-400">
                      {t.bookedSeats} / {t.totalSeats} ({Math.round((t.bookedSeats / t.totalSeats) * 100)}%)
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 text-[10px] font-bold">
                      {t.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

