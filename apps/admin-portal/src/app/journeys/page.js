'use client';

import React, { useEffect, useState } from 'react';
import { Bus, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

const STATUS_STYLE = {
  SCHEDULED: 'bg-slate-100 text-slate-600',
  BOARDING: 'bg-amber-100 text-amber-700',
  DEPARTED: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-emerald-100 text-emerald-700',
  CANCELLED: 'bg-rose-100 text-rose-700'
};

export default function LiveJourneysPage() {
  const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }));
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async (d = date) => {
    setLoading(true);
    try {
      const res = await api.getJourneys(d);
      setTrips(res?.trips || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(date); }, [date]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live updates from bus-manager actions.
  useEffect(() => {
    let ws;
    try {
      const base = new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1');
      ws = new WebSocket(`${base.protocol === 'https:' ? 'wss' : 'ws'}://${base.host}/ws`);
      ws.onopen = () => {
        const token = localStorage.getItem('admin_token');
        if (token) ws.send(JSON.stringify({ action: 'auth', token }));
        ws.send(JSON.stringify({ action: 'subscribe', room: 'admin:all' }));
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.event === 'TRIP_JOURNEY_UPDATE' && msg.data?.tripId) {
            setTrips((prev) => prev.map((t) => (String(t._id) === msg.data.tripId ? { ...t, status: msg.data.status, counts: msg.data.counts } : t)));
          }
        } catch (e) { /* ignore */ }
      };
    } catch (e) { /* manual refresh still works */ }
    return () => { try { ws?.close(); } catch (e) { /* ignore */ } };
  }, []);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
            <Bus className="w-3.5 h-3.5" /> Bus Managers
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Live Journeys</h1>
          <p className="text-sm text-slate-500 mt-1">Boarding and drop progress reported by bus managers, updated live.</p>
        </div>
        <div className="flex gap-2">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 text-xs" />
          <button onClick={() => load()} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 overflow-x-auto">
        {loading ? (
          <div className="py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : trips.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">No trips on this date.</p>
        ) : (
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-2 px-3">Departure</th><th className="py-2 px-3">Company</th><th className="py-2 px-3">Route · Bus</th><th className="py-2 px-3">Manager</th>
                <th className="py-2 px-3 text-center">Boarded</th><th className="py-2 px-3 text-center">No-show</th><th className="py-2 px-3 text-center">Dropped</th>
                <th className="py-2 px-3 text-center">Cash pending</th><th className="py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {trips.map((t) => (
                <tr key={t._id}>
                  <td className="py-2 px-3 font-semibold">{new Date(t.departureTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</td>
                  <td className="py-2 px-3">{t.companyName}</td>
                  <td className="py-2 px-3">{t.route} <span className="font-mono text-slate-500">{t.busNumber}</span></td>
                  <td className="py-2 px-3">{t.manager ? `${t.manager.name} · ${t.manager.phone}` : <span className="text-rose-600 font-semibold">Not assigned</span>}</td>
                  <td className="py-2 px-3 text-center font-bold">{t.counts.boarded} / {t.counts.total}</td>
                  <td className="py-2 px-3 text-center">{t.counts.noShow}</td>
                  <td className="py-2 px-3 text-center">{t.counts.dropped}</td>
                  <td className={`py-2 px-3 text-center ${t.counts.cashPending ? 'text-rose-600 font-bold' : ''}`}>{t.counts.cashPending}</td>
                  <td className="py-2 px-3"><span className={`px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[t.status] || ''}`}>{t.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
