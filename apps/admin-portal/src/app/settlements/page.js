'use client';

import React, { useEffect, useState } from 'react';
import { Landmark, RefreshCw, Download, FileCheck2 } from 'lucide-react';
import { api } from '../../lib/api';

const fmt = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
const PRESETS = [['LAST_WEEK', 'Last week'], ['THIS_WEEK', 'This week'], ['LAST_MONTH', 'Last month'], ['THIS_MONTH', 'This month']];

function netLabel(net) {
  if (net > 0) return { text: `RBS pays ${fmt(net)}`, cls: 'text-rose-600' };
  if (net < 0) return { text: `Company pays ${fmt(-net)}`, cls: 'text-emerald-700' };
  return { text: 'Nil', cls: 'text-slate-500' };
}

export default function AdminSettlementsPage() {
  const [preset, setPreset] = useState('LAST_WEEK');
  const [preview, setPreview] = useState(null);
  const [statements, setStatements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [settleFor, setSettleFor] = useState(null);
  const [utr, setUtr] = useState('');

  const load = async (p = preset) => {
    setLoading(true);
    setError('');
    try {
      const [pv, list] = await Promise.all([api.previewSettlements({ preset: p }), api.getSettlementList()]);
      setPreview(pv);
      setStatements(list?.settlements || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(preset); }, [preset]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fn();
      if (res?.success === false) throw new Error(res.error);
      setMessage(res?.message || 'Done.');
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200">
            <Landmark className="w-3.5 h-3.5" /> RBS ↔ Companies
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Company Settlements</h1>
          <p className="text-sm text-slate-500 mt-1">
            Each company is owed the ticket fare (no GST / fees) of every confirmed ticket on its buses. Cash collected by company offices is RBS money and is netted off.
            A statement includes every unsettled ticket up to the period end, so nothing is missed or counted twice.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([k, l]) => (
            <button key={k} onClick={() => setPreset(k)} aria-pressed={preset === k}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${preset === k ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{l}</button>
          ))}
        </div>
      </div>

      {message && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">
            Unsettled up to {preview?.period?.to ? new Date(new Date(preview.period.to).getTime() - 1).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '…'}
          </h2>
          {preview?.totals && (
            <span className="text-xs text-slate-600">RBS pays <strong className="text-rose-600">{fmt(preview.totals.rbsPays)}</strong> · RBS receives <strong className="text-emerald-700">{fmt(preview.totals.rbsReceives)}</strong></span>
          )}
        </div>
        {loading ? (
          <div className="py-10 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-indigo-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-2 px-3">Company</th><th className="py-2 px-3 text-right">Tickets</th><th className="py-2 px-3 text-right">Fares owed</th>
                  <th className="py-2 px-3 text-right">Cash held</th><th className="py-2 px-3 text-right">Clawbacks</th><th className="py-2 px-3 text-right">Net</th><th className="py-2 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(preview?.companies || []).map((c) => {
                  const n = netLabel(c.net);
                  return (
                    <tr key={c.companyCode} className={c.ticketCount === 0 && c.clawbacks === 0 ? 'text-slate-400' : ''}>
                      <td className="py-2 px-3 font-semibold">{c.companyName} <span className="text-slate-400">#{c.companyCode}</span></td>
                      <td className="py-2 px-3 text-right">{c.ticketCount}</td>
                      <td className="py-2 px-3 text-right">{fmt(c.ticketFareOwed)}</td>
                      <td className="py-2 px-3 text-right">{fmt(c.cashHeldByCompany)}</td>
                      <td className="py-2 px-3 text-right">{fmt(c.clawbacks)}</td>
                      <td className={`py-2 px-3 text-right font-bold ${n.cls}`}>{n.text}</td>
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {(c.ticketCount > 0 || c.clawbacks > 0) && (
                          <>
                            <button onClick={() => api.downloadSettlementPreview({ preset, companyCode: c.companyCode }).catch((e) => setError(e.message))}
                              className="px-2 py-1 rounded-lg border border-slate-200 font-bold mr-1 cursor-pointer"><Download className="w-3 h-3 inline" /> CSV</button>
                            <button disabled={busy} onClick={() => run(() => api.issueSettlement({ preset, companyCode: c.companyCode }))}
                              className="px-2 py-1 rounded-lg bg-indigo-600 text-white font-bold disabled:opacity-50 cursor-pointer">Issue statement</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
        <h2 className="text-sm font-bold text-slate-900">Issued statements</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-2 px-3">Statement</th><th className="py-2 px-3">Company</th><th className="py-2 px-3 text-right">Net</th><th className="py-2 px-3">Status</th><th className="py-2 px-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statements.map((s) => {
                const n = netLabel(s.net);
                return (
                  <tr key={s._id}>
                    <td className="py-2 px-3 font-mono font-bold">{s.statementNo}</td>
                    <td className="py-2 px-3">{s.companyName}</td>
                    <td className={`py-2 px-3 text-right font-bold ${n.cls}`}>{n.text}</td>
                    <td className="py-2 px-3">
                      {s.status === 'SETTLED' ? <span className="text-emerald-700 font-bold">Settled · {s.utrNumber}</span>
                        : s.status === 'VOID' ? <span className="text-slate-400 font-bold">Void</span>
                        : <span className="text-amber-700 font-bold">Issued</span>}
                    </td>
                    <td className="py-2 px-3 text-right whitespace-nowrap">
                      <button onClick={() => api.downloadStatement(s._id).catch((e) => setError(e.message))} className="px-2 py-1 rounded-lg border border-slate-200 font-bold mr-1 cursor-pointer">CSV</button>
                      {s.status === 'ISSUED' && (
                        settleFor === s._id ? (
                          <span className="inline-flex gap-1">
                            <input value={utr} onChange={(e) => setUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))} placeholder="UTR" className="px-2 py-1 rounded-lg border border-slate-200 w-28" />
                            <button disabled={busy} onClick={async () => { if (await run(() => api.settleStatement(s._id, { utrNumber: utr }))) { setSettleFor(null); setUtr(''); } }}
                              className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold cursor-pointer"><FileCheck2 className="w-3 h-3 inline" /> Save</button>
                          </span>
                        ) : (
                          <>
                            <button onClick={() => { setSettleFor(s._id); setUtr(''); }} className="px-2 py-1 rounded-lg bg-emerald-600 text-white font-bold mr-1 cursor-pointer">Mark settled</button>
                            <button disabled={busy} onClick={() => { if (window.confirm('Void this statement? Its tickets become unsettled again.')) run(() => api.voidStatement(s._id)); }}
                              className="px-2 py-1 rounded-lg border border-rose-200 text-rose-700 font-bold cursor-pointer">Void</button>
                          </>
                        )
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
