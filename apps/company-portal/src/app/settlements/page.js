'use client';

import React, { useEffect, useState } from 'react';
import { Landmark, RefreshCw, Download } from 'lucide-react';
import { api } from '../../lib/api';

const fmt = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
const day = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function directionText(net) {
  if (net > 0) return { text: `RBS pays you ${fmt(net)}`, cls: 'text-emerald-700' };
  if (net < 0) return { text: `You pay RBS ${fmt(-net)}`, cls: 'text-rose-600' };
  return { text: 'Nothing due', cls: 'text-slate-600' };
}

export default function CompanySettlementsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getSettlements();
      if (!res?.success) throw new Error(res?.error || 'Could not load settlements.');
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const running = data?.running;
  const dir = directionText(running?.net || 0);

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200">
            <Landmark className="w-3.5 h-3.5" /> Rupadiya Bus Samiti
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Settlements with RBS</h1>
          <p className="text-sm text-slate-500 mt-1">
            RBS pays you the ticket fare (seat price only, no GST or fees) for every ticket on your buses. Cash your office collected from agents belongs to RBS and is deducted.
          </p>
        </div>
        <button onClick={load} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

      {running && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Not yet in a statement ({running.ticketCount} tickets)</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div><div className="text-slate-500">Ticket fares owed to you</div><div className="text-lg font-bold text-slate-900">{fmt(running.ticketFareOwed)}</div></div>
            <div><div className="text-slate-500">Cash held by your office (RBS money)</div><div className="text-lg font-bold text-slate-900">− {fmt(running.cashHeldByCompany)}</div></div>
            <div><div className="text-slate-500">Clawbacks (cancelled after settlement)</div><div className="text-lg font-bold text-slate-900">− {fmt(running.clawbacks)}</div></div>
            <div><div className="text-slate-500">Net</div><div className={`text-lg font-bold ${dir.cls}`}>{dir.text}</div></div>
          </div>
          {data.issuedUnpaidNet !== 0 && (
            <p className="text-xs text-slate-600">Issued statements awaiting payment: <strong>{directionText(data.issuedUnpaidNet).text}</strong></p>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Statements</h2>
        {loading ? (
          <div className="py-10 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-indigo-600" /></div>
        ) : !data?.statements?.length ? (
          <p className="py-8 text-center text-xs text-slate-500">RBS has not issued a statement for your company yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Statement</th>
                  <th className="py-2.5 px-3">Up to</th>
                  <th className="py-2.5 px-3 text-right">Fares</th>
                  <th className="py-2.5 px-3 text-right">Cash held</th>
                  <th className="py-2.5 px-3 text-right">Net</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.statements.map((s) => {
                  const d = directionText(s.net);
                  return (
                    <tr key={s._id}>
                      <td className="py-2.5 px-3 font-mono font-bold">{s.statementNo}</td>
                      <td className="py-2.5 px-3">{day(new Date(new Date(s.periodTo).getTime() - 1))}</td>
                      <td className="py-2.5 px-3 text-right">{fmt(s.ticketFareOwed)}</td>
                      <td className="py-2.5 px-3 text-right">{fmt(s.cashHeldByCompany)}</td>
                      <td className={`py-2.5 px-3 text-right font-bold ${d.cls}`}>{d.text}</td>
                      <td className="py-2.5 px-3">
                        {s.status === 'SETTLED'
                          ? <span className="text-emerald-700 font-bold">Settled · UTR {s.utrNumber}</span>
                          : <span className="text-amber-700 font-bold">Issued · awaiting payment</span>}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button onClick={() => api.downloadSettlement(s._id).catch((e) => setError(e.message))}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 font-bold flex items-center gap-1 ml-auto cursor-pointer">
                          <Download className="w-3.5 h-3.5" /> CSV
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
