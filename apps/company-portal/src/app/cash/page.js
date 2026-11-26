'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Banknote, RefreshCw, CheckCircle2, Printer, Settings2, Undo2 } from 'lucide-react';
import { api } from '../../lib/api';

const fmt = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export default function CashCollectionsPage() {
  const [status, setStatus] = useState('PENDING');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [revertFor, setRevertFor] = useState(null);
  const [revertReason, setRevertReason] = useState('');
  const [revertError, setRevertError] = useState('');
  const [reverting, setReverting] = useState(false);

  const load = async (s = status) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getCashTickets(s);
      if (!res?.success) throw new Error(res?.error || 'Could not load cash tickets.');
      setData(res);
      setPolicy((p) => p || res.policy);
      setSelected(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(status); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  // Group pending tickets by agent for quick "receive all from this agent".
  const byAgent = useMemo(() => {
    const map = new Map();
    for (const t of data?.tickets || []) {
      const key = t.agent?._id || 'unknown';
      if (!map.has(key)) map.set(key, { agent: t.agent, tickets: [], total: 0 });
      const g = map.get(key);
      g.tickets.push(t);
      if (t.cashStatus === 'PENDING') g.total += t.amountDue;
    }
    return [...map.values()];
  }, [data]);

  const selectedTickets = (data?.tickets || []).filter((t) => selected.has(t._id));
  const selectedTotal = selectedTickets.reduce((s, t) => s + t.amountDue, 0);

  const toggle = (id) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const receive = async () => {
    if (!selectedTickets.length) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await api.receiveCash(selectedTickets.map((t) => t._id));
      if (!res?.success) throw new Error(res?.error || 'Could not mark cash received.');
      setMessage(res.message);
      setReceipt({ receiptNo: res.receiptNo, totalAmount: res.totalAmount, tickets: selectedTickets.filter((t) => res.results.find((r) => r.ok && r.pnr === t.pnr)), at: new Date() });
      await load(status);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const revert = async () => {
    if (!revertFor) return;
    setReverting(true);
    setRevertError('');
    try {
      const res = await api.revertCash(revertFor._id, revertReason.trim());
      if (!res?.success) throw new Error(res?.error || 'Could not revert.');
      setRevertFor(null);
      setReceipt(null);
      setMessage(res.message);
      await load(status);
    } catch (e) {
      setRevertError(e.message);
    } finally {
      setReverting(false);
    }
  };

  const savePolicy = async (e) => {
    e.preventDefault();
    setSavingPolicy(true);
    try {
      const res = await api.saveCashPolicy(policy);
      setMessage(res?.message || 'Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingPolicy(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #cash-receipt, #cash-receipt * { visibility: visible !important; }
          #cash-receipt { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold uppercase tracking-wider mb-2 border border-amber-200">
            <Banknote className="w-3.5 h-3.5" /> Agent Cash (COD)
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Cash Collections</h1>
          <p className="text-sm text-slate-500 mt-1">Mark cash received when an agent pays at your office. Until then, passengers on that ticket cannot board.</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold text-slate-500">Pending at agents</div>
          <div className="text-2xl font-bold text-amber-700">{fmt(data?.totals?.pendingAmount)}</div>
          <div className="text-[11px] text-slate-500">{data?.totals?.pendingTickets || 0} ticket(s)</div>
        </div>
      </div>

      {message && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

      {receipt && (
        <div id="cash-receipt" className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-5 space-y-2">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs font-bold text-slate-500 uppercase">Cash Receipt</div>
              <div className="text-lg font-black text-slate-900">{receipt.receiptNo}</div>
              <div className="text-xs text-slate-500">{receipt.at.toLocaleString('en-IN')}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500">Received</div>
              <div className="text-xl font-black text-emerald-700">{fmt(receipt.totalAmount)}</div>
            </div>
          </div>
          <div className="text-xs text-slate-600">From agent: {receipt.tickets[0]?.agent?.name} ({receipt.tickets[0]?.agent?.referralCode})</div>
          <table className="w-full text-xs">
            <tbody>
              {receipt.tickets.map((t) => (
                <tr key={t._id} className="border-t border-slate-100">
                  <td className="py-1 font-mono">{t.pnr}</td>
                  <td className="py-1">{t.route}</td>
                  <td className="py-1">{when(t.departureTime)}</td>
                  <td className="py-1 text-right font-bold">{fmt(t.amountDue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500">This cash belongs to Rupadiya Bus Samiti and is adjusted in your settlement statement.</p>
          <button onClick={() => window.print()} className="print:hidden px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print receipt
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {[['PENDING', 'Pending'], ['RECEIVED', 'Received'], ['ALL', 'All']].map(([k, l]) => (
              <button key={k} onClick={() => setStatus(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${status === k ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {l}
              </button>
            ))}
          </div>
          {status === 'PENDING' && (
            <button onClick={receive} disabled={busy || !selectedTickets.length}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <CheckCircle2 className="w-4 h-4" /> {busy ? 'Saving…' : `Mark ${fmt(selectedTotal)} received (${selectedTickets.length})`}
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : byAgent.length === 0 ? (
          <p className="py-10 text-center text-xs text-slate-500">No cash tickets here.</p>
        ) : byAgent.map((g) => (
          <div key={g.agent?._id || 'unknown'} className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-900">{g.agent?.name || 'Agent'} <span className="font-mono text-blue-700">{g.agent?.referralCode}</span> · {g.agent?.phone}</span>
              {status === 'PENDING' && (
                <button onClick={() => setSelected(new Set(g.tickets.map((t) => t._id)))} className="text-blue-700 font-bold underline cursor-pointer">
                  Select all ({fmt(g.total)})
                </button>
              )}
            </div>
            <table className="w-full text-xs">
              <tbody className="divide-y divide-slate-100">
                {g.tickets.map((t) => {
                  const soon = t.departureTime && new Date(t.departureTime).getTime() - Date.now() < 3 * 3600000;
                  return (
                    <tr key={t._id} className={soon && t.cashStatus === 'PENDING' ? 'bg-rose-50/60' : ''}>
                      {status === 'PENDING' && (
                        <td className="py-2 px-3 w-8">
                          <input type="checkbox" className="accent-emerald-600" checked={selected.has(t._id)} onChange={() => toggle(t._id)} aria-label={`Select ${t.pnr}`} />
                        </td>
                      )}
                      <td className="py-2 px-3 font-mono font-bold">{t.pnr}</td>
                      <td className="py-2 px-3 text-slate-600">{t.route} · {t.busNumber}</td>
                      <td className={`py-2 px-3 ${soon ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>{when(t.departureTime)}</td>
                      <td className="py-2 px-3 text-slate-600">{(t.seats || []).join(', ')} · {t.leadPassenger}</td>
                      <td className="py-2 px-3 text-right font-bold">{fmt(t.amountDue)}</td>
                      <td className="py-2 px-3 text-right">
                        {t.cashStatus === 'RECEIVED' ? (
                          <div className="flex items-center justify-end gap-2">
                            <span className="text-emerald-700 font-bold">Received · {t.receiptNo}</span>
                            {t.status === 'CONFIRMED' && (
                              <button onClick={() => { setRevertFor(t); setRevertReason(''); setRevertError(''); }}
                                className="px-2 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold flex items-center gap-1 cursor-pointer" title="Marked received by mistake? Undo it.">
                                <Undo2 className="w-3.5 h-3.5" /> Revert
                              </button>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span className="text-amber-700 font-bold">Pending</span>
                            {t.lastRevert ? <div className="text-[10px] text-slate-500">Receipt {t.lastRevert.receiptNo} reverted {when(t.lastRevert.at)}</div> : null}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {revertFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => !reverting && setRevertFor(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl space-y-3" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <h3 className="text-lg font-bold text-slate-900">Revert cash receipt {revertFor.receiptNo}?</h3>
            <p className="text-sm text-slate-600">
              PNR <b className="font-mono">{revertFor.pnr}</b> goes back to <b>cash pending</b> ({fmt(revertFor.amountDue)}). Passengers can&apos;t board until you mark it received again, and the agent&apos;s commission for this ticket is held back until then.
            </p>
            <p className="text-[11px] text-slate-500">Only for a receipt marked by mistake. Not possible after a passenger has boarded or once the ticket is in a settlement statement.</p>
            <textarea value={revertReason} onChange={(e) => setRevertReason(e.target.value)} rows={2} autoFocus
              placeholder="Reason (e.g. selected wrong ticket, cash not actually received)"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500" />
            {revertError && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{revertError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setRevertFor(null)} disabled={reverting} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold cursor-pointer">Cancel</button>
              <button onClick={revert} disabled={reverting || revertReason.trim().length < 3}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold disabled:opacity-50 cursor-pointer">
                {reverting ? 'Reverting…' : 'Revert to pending'}
              </button>
            </div>
          </div>
        </div>
      )}

      {policy && (
        <form onSubmit={savePolicy} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><Settings2 className="w-4 h-4" /> Cash booking rules for your agents</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <label className="flex items-center gap-2 font-semibold text-slate-700">
              <input type="checkbox" className="accent-blue-600" checked={policy.enabled} onChange={(e) => setPolicy({ ...policy, enabled: e.target.checked })} />
              Allow cash (COD) tickets
            </label>
            <label className="space-y-1">
              <span className="font-bold text-slate-700 block">Stop cash bookings this many hours before departure</span>
              <input type="number" min="0" max="72" value={policy.cutoffHours} onChange={(e) => setPolicy({ ...policy, cutoffHours: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50" />
            </label>
            <label className="space-y-1">
              <span className="font-bold text-slate-700 block">Max unpaid cash per agent (₹)</span>
              <input type="number" min="0" step="500" value={policy.agentCreditLimit} onChange={(e) => setPolicy({ ...policy, agentCreditLimit: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50" />
            </label>
          </div>
          <button type="submit" disabled={savingPolicy} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold disabled:opacity-50 cursor-pointer">
            {savingPolicy ? 'Saving…' : 'Save rules'}
          </button>
        </form>
      )}
    </div>
  );
}
