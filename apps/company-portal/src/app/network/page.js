'use client';

import React, { useEffect, useState } from 'react';
import { Network, RefreshCw } from 'lucide-react';
import { api } from '../../lib/api';

const RANGES = [['1m', '1 month'], ['3m', '3 months'], ['6m', '6 months'], ['12m', '1 year']];

export default function NetworkStatsPage() {
  const [range, setRange] = useState('1m');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.getNetworkStats(range)
      .then((res) => { if (alive) setData(res); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [range]);

  const max = Math.max(1, ...(data?.companies || []).map((c) => c.seats));

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
            <Network className="w-3.5 h-3.5" /> All Companies
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Network Booking Counts</h1>
          <p className="text-sm text-slate-500 mt-1">Tickets and seats sold by each of the companies. Only counts are shown — no customer details.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGES.map(([k, l]) => (
            <button key={k} onClick={() => setRange(k)} aria-pressed={range === k}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${range === k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        {loading ? (
          <div className="py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold text-left">
                <th className="py-2.5 px-3">Rank</th>
                <th className="py-2.5 px-3">Company</th>
                <th className="py-2.5 px-3 w-1/2">Seats sold</th>
                <th className="py-2.5 px-3 text-right">Tickets</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(data?.companies || []).map((c) => {
                const mine = c.companyCode === data?.myCompanyCode;
                return (
                  <tr key={c.companyCode} className={mine ? 'bg-blue-50/70' : ''}>
                    <td className="py-2 px-3 font-bold text-slate-500">#{c.rank}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">
                      {c.companyName} <span className="text-slate-400">(#{c.companyCode})</span>{mine ? <span className="ml-1 text-blue-700 font-bold">· You</span> : null}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-2.5 rounded-full ${mine ? 'bg-blue-600' : 'bg-slate-400'}`} style={{ width: `${(c.seats / max) * 100}%` }} />
                        </div>
                        <span className="w-12 text-right font-bold">{c.seats}</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">{c.tickets}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
