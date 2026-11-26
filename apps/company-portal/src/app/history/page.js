'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { History, Download, RefreshCw, Users, Building2, CalendarDays, Filter, Trophy } from 'lucide-react';
import { api } from '../../lib/api';

const money = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
const num = (n) => Number(n || 0).toLocaleString('en-IN');
const thisMonth = () => new Date().toISOString().slice(0, 7);

/** Shared filter state: month OR a custom from/to date range. */
function useWindow() {
  const [mode, setMode] = useState('month'); // 'month' | 'range'
  const [month, setMonth] = useState(thisMonth());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const params = useMemo(() => (mode === 'month' ? { month } : (from && to ? { from, to } : { month })), [mode, month, from, to]);
  return { mode, setMode, month, setMonth, from, setFrom, to, setTo, params };
}

function FilterBar({ win, extra }) {
  return (
    <div className="flex flex-wrap items-end gap-3 bg-white border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1">
        {[['month', 'By month'], ['range', 'Date range']].map(([k, l]) => (
          <button key={k} onClick={() => win.setMode(k)} aria-pressed={win.mode === k}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${win.mode === k ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>{l}</button>
        ))}
      </div>
      {win.mode === 'month' ? (
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Month</span>
          <input type="month" value={win.month} max={thisMonth()} onChange={(e) => win.setMonth(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500" />
        </label>
      ) : (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">From</span>
            <input type="date" value={win.from} max={win.to || undefined} onChange={(e) => win.setFrom(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">To</span>
            <input type="date" value={win.to} min={win.from || undefined} onChange={(e) => win.setTo(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 focus:outline-none focus:border-blue-500" />
          </label>
        </>
      )}
      {extra}
    </div>
  );
}

function Tile({ label, value, sub, accent }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200'}`}>
      <div className={`text-xs font-bold uppercase tracking-wide ${accent ? 'text-blue-100' : 'text-slate-500'}`}>{label}</div>
      <div className={`text-2xl font-black mt-1 ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      {sub ? <div className={`text-xs mt-0.5 ${accent ? 'text-blue-100' : 'text-slate-400'}`}>{sub}</div> : null}
    </div>
  );
}

function Spark({ series }) {
  const max = Math.max(1, ...series.map((s) => s.seats));
  if (!series.length) return <p className="text-sm text-slate-400">No bookings in this period.</p>;
  return (
    <div className="flex items-end gap-1 h-28">
      {series.map((s) => (
        <div key={s.date} className="flex-1 flex flex-col items-center justify-end group" title={`${s.date}: ${s.seats} seats`}>
          <div className="w-full bg-blue-500/80 group-hover:bg-blue-600 rounded-t transition-all" style={{ height: `${Math.max(3, (s.seats / max) * 100)}%` }} />
          <span className="text-[8px] text-slate-400 mt-1 rotate-0 truncate w-full text-center">{s.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function OwnHistory({ win }) {
  const [agentId, setAgentId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.getHistory({ ...win.params, agentId })
      .then((res) => setData(res?.history || null))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [win.params, agentId]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals || {};
  const agents = data?.agents || [];
  const selectedAgent = agents.find((a) => a.id === agentId);

  const exportXlsx = async () => {
    setBusy(true);
    try { await api.downloadHistory({ ...win.params, agentId }); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <FilterBar win={win} extra={(
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Agent</span>
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-800 bg-white focus:outline-none focus:border-blue-500 min-w-[180px]">
            <option value="">All agents (overall)</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.code ? ` · ${a.code}` : ''}</option>)}
          </select>
        </label>
      )} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-500">{data ? data.window.label : '—'}{selectedAgent ? ` · ${selectedAgent.name}` : ' · All agents'}</span>
        <div className="flex-1" />
        <button onClick={load} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        <button onClick={exportXlsx} disabled={busy || !data} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"><Download className="w-3.5 h-3.5" /> {busy ? 'Preparing…' : 'Export Excel'}</button>
      </div>

      {error ? <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">{error}</div> : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Seats booked" value={num(t.seats)} sub={`${num(t.tickets)} tickets`} accent />
        <Tile label="Ticket fare" value={money(t.ticketFare)} sub="Fare value (excl. fees)" />
        <Tile label="Collected" value={money(t.collected)} sub="Incl. taxes & fees" />
        <Tile label="Cancellations" value={num(t.cancellations)} sub={`${num(t.cancelledSeats)} seats`} />
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><CalendarDays className="w-4 h-4 text-blue-600" /><h3 className="font-bold text-slate-900">{data?.window.grain === 'month' ? 'By month' : 'Day by day'}</h3></div>
          {loading ? <p className="text-sm text-slate-400">Loading…</p> : <Spark series={data?.series || []} />}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3"><Users className="w-4 h-4 text-blue-600" /><h3 className="font-bold text-slate-900">By agent</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-400 text-xs uppercase"><th className="py-1.5 font-bold">Agent</th><th className="py-1.5 font-bold text-right">Tickets</th><th className="py-1.5 font-bold text-right">Seats</th><th className="py-1.5 font-bold text-right">Fare</th></tr></thead>
              <tbody>
                {(data?.byAgent || []).map((a) => (
                  <tr key={a.agentId || 'direct'} className="border-t border-slate-100">
                    <td className="py-2 font-semibold text-slate-800">{a.agentName}{a.agentCode ? <span className="text-slate-400 font-normal"> · {a.agentCode}</span> : null}</td>
                    <td className="py-2 text-right text-slate-600">{num(a.tickets)}</td>
                    <td className="py-2 text-right font-bold text-slate-900">{num(a.seats)}</td>
                    <td className="py-2 text-right text-slate-600">{money(a.ticketFare)}</td>
                  </tr>
                ))}
                {!loading && !(data?.byAgent || []).length ? <tr><td colSpan={4} className="py-4 text-center text-slate-400">No bookings in this period.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function NetworkHistory({ win, myCode }) {
  const [data, setData] = useState(null);
  const [resolvedCode, setResolvedCode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.getNetworkHistory(win.params)
      .then((res) => { setData(res?.history || null); if (res?.myCompanyCode) setResolvedCode(Number(res.myCompanyCode)); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [win.params]);

  useEffect(() => { load(); }, [load]);

  const t = data?.totals || {};
  const code = myCode || resolvedCode;
  const rows = (data?.companies || []).filter((c) => !onlyActive || c.seats > 0);

  const exportXlsx = async () => {
    setBusy(true);
    try { await api.downloadNetworkHistory(win.params); } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-5">
      <FilterBar win={win} extra={(
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 ml-1">
          <input type="checkbox" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} className="w-4 h-4 accent-blue-600" /> Only active
        </label>
      )} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-slate-500">{data ? data.window.label : '—'} · all companies</span>
        <div className="flex-1" />
        <button onClick={load} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        <button onClick={exportXlsx} disabled={busy || !data} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"><Download className="w-3.5 h-3.5" /> {busy ? 'Preparing…' : 'Export Excel'}</button>
      </div>

      {error ? <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">{error}</div> : null}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Total seats" value={num(t.seats)} sub={`${num(t.tickets)} tickets`} accent />
        <Tile label="Companies" value={num(t.companies)} sub={`${num(t.active)} active this period`} />
        <Tile label="Ticket fare" value={money(t.ticketFare)} sub="All companies" />
        <Tile label="Your rank" value={data ? `#${(data.companies.find((c) => c.companyCode === code)?.rank) || '—'}` : '—'} sub="By seats sold" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr className="text-left text-slate-500 text-xs uppercase">
              <th className="py-2.5 px-4 font-bold">#</th><th className="py-2.5 px-4 font-bold">Company</th>
              <th className="py-2.5 px-4 font-bold text-right">Tickets</th><th className="py-2.5 px-4 font-bold text-right">Seats</th><th className="py-2.5 px-4 font-bold text-right">Ticket fare</th>
            </tr></thead>
            <tbody>
              {rows.map((c) => {
                const mine = c.companyCode === code;
                return (
                  <tr key={c.companyCode} className={`border-t border-slate-100 ${mine ? 'bg-blue-50/70' : ''}`}>
                    <td className="py-2.5 px-4 font-bold text-slate-400">{c.rank <= 3 && c.seats > 0 ? <Trophy className={`w-4 h-4 inline ${c.rank === 1 ? 'text-amber-500' : c.rank === 2 ? 'text-slate-400' : 'text-amber-700'}`} /> : c.rank}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-800">{c.companyName}<span className="text-slate-400 font-normal"> · #{c.companyCode}</span>{mine ? <span className="ml-2 text-[10px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">You</span> : null}{c.status !== 'ACTIVE' ? <span className="ml-2 text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{c.status}</span> : null}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{num(c.tickets)}</td>
                    <td className="py-2.5 px-4 text-right font-black text-slate-900">{num(c.seats)}</td>
                    <td className="py-2.5 px-4 text-right text-slate-600">{money(c.ticketFare)}</td>
                  </tr>
                );
              })}
              {!loading && !rows.length ? <tr><td colSpan={5} className="py-6 text-center text-slate-400">No companies to show.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const [tab, setTab] = useState('own');
  const [myCode, setMyCode] = useState(null);
  const win = useWindow();

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('owner_user') || 'null');
      if (u?.companyCode) setMyCode(Number(u.companyCode));
    } catch (e) { /* ignore */ }
  }, []);

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-slate-200/80 pb-5">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
          <History className="w-3.5 h-3.5" /> Booking History
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Booking History</h1>
        <p className="text-sm text-slate-500 mt-1">Your bookings overall or by agent, and the whole network, filtered by month or date range. Export to Excel.</p>
      </div>

      <div className="flex gap-2">
        {[['own', 'My bookings', Building2], ['network', 'All companies', Users]].map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer ${tab === k ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      {tab === 'own' ? <OwnHistory win={win} /> : <NetworkHistory win={win} myCode={myCode} />}
    </div>
  );
}
