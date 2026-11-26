'use client';

import React, { useEffect, useState } from 'react';
import { BarChart3, Download, RefreshCw, Printer } from 'lucide-react';
import { api } from '../../lib/api';

const fmt = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
const RANGES = [['1m', '1 month'], ['3m', '3 months'], ['6m', '6 months'], ['12m', '1 year']];

export default function CompanyReportsPage() {
  const [range, setRange] = useState('1m');
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api.getReportSummary(range)
      .then((res) => { if (alive) setReport(res?.report || null); })
      .catch((e) => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [range]);

  const t = report?.totals || {};
  const maxMonth = Math.max(1, ...(report?.byMonth || []).map((m) => m.ticketFare));

  return (
    <div className="w-full space-y-6">
      <style jsx global>{`@media print { aside, nav, header, .no-print { display: none !important; } }`}</style>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
            <BarChart3 className="w-3.5 h-3.5" /> Company Report
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          {report && (
            <p className="text-sm text-slate-500 mt-1">
              {new Date(report.period.from).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} – {new Date(report.period.to).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          {RANGES.map(([k, l]) => (
            <button key={k} onClick={() => setRange(k)} aria-pressed={range === k}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${range === k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {l}
            </button>
          ))}
          <button onClick={() => api.downloadReport(range).catch((e) => setError(e.message))}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={() => window.print()} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print / PDF
          </button>
        </div>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

      {loading ? (
        <div className="py-16 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-blue-600" /></div>
      ) : report && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              ['Tickets', t.tickets?.toLocaleString('en-IN')],
              ['Seats sold', t.seats?.toLocaleString('en-IN')],
              ['Ticket fares (your revenue)', fmt(t.ticketFare)],
              ['Occupancy', `${report.occupancy.rate}%`],
              ['GST collected', fmt(t.gst)],
              ['Cancellations', `${t.cancellations} · refunds ${fmt(t.refunds)}`],
              ['Cancellation fees', fmt(t.cancellationFees)],
              ['Trips run', report.occupancy.trips]
            ].map(([label, value]) => (
              <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4">
                <div className="text-[11px] font-semibold text-slate-500">{label}</div>
                <div className="text-lg font-bold text-slate-900 mt-1">{value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h2 className="text-sm font-bold text-slate-900 mb-3">Ticket fares by month</h2>
              {report.byMonth.length === 0 ? <p className="text-xs text-slate-500">No bookings in this period.</p> : (
                <div className="space-y-2">
                  {report.byMonth.map((m) => (
                    <div key={m.month} className="grid grid-cols-12 items-center gap-2 text-xs">
                      <span className="col-span-2 font-mono text-slate-600">{m.month}</span>
                      <div className="col-span-7 h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-3 bg-blue-600 rounded-full" style={{ width: `${(m.ticketFare / maxMonth) * 100}%` }} />
                      </div>
                      <span className="col-span-3 text-right font-semibold text-slate-800">{fmt(m.ticketFare)} · {m.tickets}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h2 className="text-sm font-bold text-slate-900 mb-3">By payment type</h2>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {report.byChannel.map((c) => (
                    <tr key={c.channel}>
                      <td className="py-2 font-semibold">{c.channel === 'ONLINE' ? 'Online (Razorpay)' : c.channel === 'WALLET' ? 'Agent wallet' : 'Agent cash (COD)'}</td>
                      <td className="py-2 text-right">{c.tickets} tickets</td>
                      <td className="py-2 text-right font-bold">{fmt(c.ticketFare)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h2 className="text-sm font-bold text-slate-900 mb-3">Top routes</h2>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {report.byRoute.map((r) => (
                    <tr key={r.route}><td className="py-2">{r.route}</td><td className="py-2 text-right">{r.seats} seats</td><td className="py-2 text-right font-bold">{fmt(r.ticketFare)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <h2 className="text-sm font-bold text-slate-900 mb-3">Top agents</h2>
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-100">
                  {report.byAgent.length === 0 ? <tr><td className="py-2 text-slate-500">No agent bookings.</td></tr> : report.byAgent.map((a) => (
                    <tr key={`${a.agentCode}-${a.agentName}`}><td className="py-2">{a.agentName} <span className="font-mono text-blue-700">{a.agentCode}</span></td><td className="py-2 text-right">{a.seats} seats</td><td className="py-2 text-right font-bold">{fmt(a.ticketFare)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
