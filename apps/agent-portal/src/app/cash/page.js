'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, RefreshCw, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../../lib/api';

const fmt = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export default function AgentCashLedgerPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('PENDING');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getCashSummary();
      if (!res?.success) throw new Error(res?.error || 'Could not load cash ledger.');
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const onUpdate = () => load();
    window.addEventListener('wallet-updated', onUpdate);
    return () => window.removeEventListener('wallet-updated', onUpdate);
  }, []);

  const tickets = useMemo(() => (data?.tickets || []).filter((t) => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return t.cashStatus === 'PENDING' && t.status === 'CONFIRMED';
    return t.cashStatus === filter;
  }), [data, filter]);

  const totals = data?.totals || {};
  const limit = data?.policy?.agentCreditLimit || 0;
  const usedPct = limit ? Math.min(100, Math.round((totals.pendingHandover / limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">Cash (COD) Tickets</span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Cash Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">Cash you collected from customers and what is still to be handed to your company office.</p>
        </div>
        <button onClick={load} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Collected from customers', totals.collectedFromCustomers, 'text-slate-900'],
          ['Handed to company office', totals.handedOver, 'text-emerald-700'],
          ['Still to hand over', totals.pendingHandover, totals.pendingHandover > 0 ? 'text-amber-700' : 'text-slate-900'],
          ['Overdue (departing within 3 h)', totals.overdue, totals.overdue > 0 ? 'text-rose-600' : 'text-slate-900']
        ].map(([label, value, cls]) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="text-[11px] font-semibold text-slate-500">{label}</div>
            <div className={`text-xl font-bold mt-1 ${cls}`}>{fmt(value)}</div>
          </div>
        ))}
      </div>

      {limit > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between text-xs font-semibold text-slate-700">
            <span>Cash limit used</span>
            <span>{fmt(totals.pendingHandover)} of {fmt(limit)}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-2 ${usedPct >= 90 ? 'bg-rose-500' : usedPct >= 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${usedPct}%` }} />
          </div>
          <p className="text-[11px] text-slate-500">
            New cash tickets are blocked once unpaid cash reaches the limit, and close {data?.policy?.cutoffHours ?? 2} hour(s) before departure. Hand over the cash to keep selling.
          </p>
        </div>
      )}

      {totals.overdue > 0 && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Some buses leave soon and their cash is not at the office yet. Passengers on those tickets will not be allowed to board until the office receives it.
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[['PENDING', 'To hand over'], ['RECEIVED', 'Handed over'], ['ALL', 'All']].map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${filter === k ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {l}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-emerald-600" /></div>
        ) : tickets.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">No cash tickets here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">PNR</th>
                  <th className="py-2.5 px-3">Departure</th>
                  <th className="py-2.5 px-3">Seats</th>
                  <th className="py-2.5 px-3 text-right">Cash due</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tickets.map((t) => (
                  <tr key={t.bookingId} className={t.overdue ? 'bg-rose-50/50' : ''}>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{t.pnr}</td>
                    <td className="py-2.5 px-3 text-slate-600">{when(t.departureTime)}</td>
                    <td className="py-2.5 px-3 text-slate-600">{(t.seats || []).join(', ')}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">{fmt(t.amountDue)}</td>
                    <td className="py-2.5 px-3">
                      {t.cashStatus === 'RECEIVED' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-bold"><CheckCircle2 className="w-3.5 h-3.5" /> Received · {t.receiptNo}</span>
                      ) : t.cashStatus === 'CANCELLED' || t.status === 'CANCELLED' ? (
                        <span className="text-slate-400 font-bold">Cancelled</span>
                      ) : (
                        <span className={`inline-flex items-center gap-1 font-bold ${t.overdue ? 'text-rose-600' : 'text-amber-700'}`}>
                          <Clock className="w-3.5 h-3.5" /> {t.overdue ? 'Overdue — hand over now' : 'To hand over'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-slate-500 flex items-center gap-1.5"><Banknote className="w-3.5 h-3.5" /> Your service charge on cash tickets stays with you; only the amount shown is handed to the office.</p>
    </div>
  );
}
