'use client';

import React, { useCallback, useEffect, useState } from 'react';
import PhoneInput from '../../components/ui/PhoneInput';
import { isValidPhone } from '../../lib/phone';
import {
  MessageCircle, RefreshCw, Power, Send, Save, RotateCcw, CheckCircle2, AlertTriangle, QrCode,
  Smartphone, Server, Clock, CheckCheck, Check, XCircle, Hourglass, BarChart3, FileText, Settings, Unplug, Loader2, Mail
} from 'lucide-react';
import { api } from '../../lib/api';

const EVENT_LABEL = {
  BOOKING_CONFIRMED: 'Ticket booked',
  BOOKING_CANCELLED: 'Ticket cancelled',
  REFUND_PROCESSED: 'Refund processed',
  CASH_RECEIVED: 'Agent cash received',
  PASSENGER_BOARDED: 'Passenger boarded',
  TRIP_STARTED: 'Journey started',
  PASSENGER_DROPPED: 'Passenger dropped (thank you)',
  TRIP_COMPLETED: 'Journey completed',
  PAYOUT_PAID: 'Agent payout paid',
  JOURNEY_POINT_CHANGED: 'Boarding / drop stop changed',
  TEST_MESSAGE: 'Test message'
};
const PLACEHOLDERS = '{{name}} {{pnr}} {{from}} {{to}} {{date}} {{time}} {{seats}} {{boarding}} {{boardingTime}} {{dropping}} {{busNumber}} {{companyName}} {{amount}} {{refundAmount}} {{ticketUrl}} {{bookUrl}} {{receiptNo}} {{utr}} {{boarded}} {{noShow}} {{total}} {{dropped}} {{managerName}} {{infants}} {{changeText}} {{reason}} {{managerPhone}}';

const TABS = [
  ['connection', 'Connection', QrCode],
  ['counts', 'Message counts', BarChart3],
  ['templates', 'Templates', FileText],
  ['settings', 'Settings', Settings]
];

const STATUS_STYLE = {
  CONNECTED: ['Connected', 'bg-emerald-100 text-emerald-700 border-emerald-200', 'bg-emerald-500'],
  QR: ['Waiting for scan', 'bg-amber-100 text-amber-800 border-amber-200', 'bg-amber-500'],
  CONNECTING: ['Connecting…', 'bg-blue-100 text-blue-700 border-blue-200', 'bg-blue-500'],
  DISCONNECTED: ['Disconnected', 'bg-slate-100 text-slate-600 border-slate-200', 'bg-slate-400'],
  LOGGED_OUT: ['Not linked', 'bg-rose-100 text-rose-700 border-rose-200', 'bg-rose-500']
};

const num = (n) => Number(n || 0).toLocaleString('en-IN');
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—');
const dayLabel = (key) => {
  const d = new Date(`${key}T00:00:00`);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
};
const since = (d) => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ${Math.floor((s % 3600) / 60)} min`;
  return `${Math.floor(s / 86400)} day(s)`;
};

function wsUrl() {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4500/api/v1';
  try {
    const u = new URL(base);
    return `${u.protocol === 'https:' ? 'wss' : 'ws'}://${u.host}/ws`;
  } catch {
    return 'ws://localhost:4500/ws';
  }
}

export default function WhatsappAdminPage() {
  const [tab, setTab] = useState('connection');
  const [status, setStatus] = useState(null);
  const [wa, setWa] = useState(null);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.getWhatsappStatus();
      setStatus(res);
      setWa(res.whatsapp);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Live QR / status over the admin-only WebSocket room (reconnects if the socket drops).
  useEffect(() => {
    let ws;
    let timer;
    let closed = false;
    const open = () => {
      try {
        ws = new WebSocket(wsUrl());
        ws.onopen = () => {
          const token = localStorage.getItem('admin_token');
          if (token) ws.send(JSON.stringify({ action: 'auth', token }));
          ws.send(JSON.stringify({ action: 'subscribe', room: 'admin:all' }));
        };
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data);
            if (msg.event === 'WHATSAPP_STATUS') {
              setWa(msg.data);
              if (msg.data?.status === 'CONNECTED') loadStatus();
            }
          } catch (e) { /* ignore */ }
        };
        ws.onclose = () => { if (!closed) timer = setTimeout(open, 5000); };
      } catch (e) { /* polling fallback below */ }
    };
    open();
    return () => { closed = true; clearTimeout(timer); try { ws?.close(); } catch (e) { /* ignore */ } };
  }, [loadStatus]);

  // Polling fallback: fast while linking, slow otherwise (keeps counts and status fresh).
  useEffect(() => {
    const linking = wa && ['QR', 'CONNECTING'].includes(wa.status);
    const t = setInterval(loadStatus, linking ? 3000 : 20000);
    return () => clearInterval(t);
  }, [wa, loadStatus]);

  const run = async (key, fn, ok) => {
    setBusy(key);
    setError('');
    setMessage('');
    try {
      const res = await fn();
      if (res?.success === false) throw new Error(res.error);
      setMessage(res?.message || ok || 'Done.');
      return res;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setBusy('');
    }
  };

  const st = STATUS_STYLE[wa?.status] || STATUS_STYLE.DISCONNECTED;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2 border border-emerald-200">
            <MessageCircle className="w-3.5 h-3.5" /> Rupadiya Bus Samiti WhatsApp
          </div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp &amp; Messages</h1>
          <p className="text-sm text-slate-500 mt-1">Link the RBS WhatsApp number once by scanning the QR. Ticket, cancellation, boarding and journey messages then go out automatically.</p>
        </div>
        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold ${st[1]}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${st[2]} ${wa?.status === 'CONNECTED' ? 'animate-pulse' : ''}`} />
          {st[0]}{wa?.status === 'CONNECTED' && wa.connectedNumber ? ` · +${wa.connectedNumber}` : ''}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer ${tab === k ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      {message && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">{error}</div>}

      {tab === 'connection' && <ConnectionSection wa={wa} status={status} busy={busy} run={run} reload={loadStatus} setWa={setWa} onShowCounts={() => setTab('counts')} />}
      {tab === 'counts' && <CountsSection busy={busy} run={run} />}
      {tab === 'templates' && <TemplatesSection busy={busy} run={run} setError={setError} />}
      {tab === 'settings' && <SettingsSection status={status} busy={busy} run={run} reload={loadStatus} />}
    </div>
  );
}

// ---------------------------------------------------------------- Connection

function QrCountdown({ qrAt }) {
  const [left, setLeft] = useState(20);
  useEffect(() => {
    const tick = () => setLeft(Math.max(0, 20 - Math.floor((Date.now() - new Date(qrAt).getTime()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [qrAt]);
  return <span className="tabular-nums">{left > 0 ? `New code in ${left}s` : 'Refreshing code…'}</span>;
}

function Detail({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
      <Icon className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
      <div className="w-36 shrink-0 text-xs text-slate-500">{label}</div>
      <div className={`text-sm font-semibold break-words min-w-0 ${tone || 'text-slate-800'}`}>{value ?? '—'}</div>
    </div>
  );
}

function ConnectionSection({ wa, status, busy, run, reload, setWa, onShowCounts }) {
  const [testPhone, setTestPhone] = useState('');
  const connected = wa?.status === 'CONNECTED';
  const linking = wa?.status === 'QR' || wa?.status === 'CONNECTING';
  const today = status?.today || {};

  const connect = async () => {
    const res = await run('connect', () => api.connectWhatsapp());
    if (res?.whatsapp) setWa(res.whatsapp);
    reload();
  };
  const unlink = async () => {
    if (!window.confirm('Unlink the RBS WhatsApp number? Messages wait in the queue until you scan a new QR.')) return;
    await run('logout', () => api.logoutWhatsapp(), 'WhatsApp unlinked.');
    reload();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* QR / link card */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 h-fit">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><QrCode className="w-4 h-4 text-emerald-600" /> Link WhatsApp</h2>

        {wa?.status === 'QR' && wa.qr ? (
          <div className="text-center space-y-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={wa.qr} alt="WhatsApp link QR code" width={260} height={260} className="mx-auto border-4 border-emerald-500 rounded-2xl p-2 bg-white" />
            <div className="text-xs text-amber-700 font-bold flex items-center justify-center gap-1.5"><Hourglass className="w-3.5 h-3.5" /> {wa.qrAt ? <QrCountdown qrAt={wa.qrAt} /> : 'Waiting for scan'}</div>
            <ol className="text-left text-xs text-slate-600 space-y-1 bg-slate-50 rounded-xl p-3">
              <li>1. Open <b>WhatsApp</b> on the RBS phone.</li>
              <li>2. Tap <b>Settings → Linked devices → Link a device</b>.</li>
              <li>3. Point the phone at this code. This page updates by itself.</li>
            </ol>
          </div>
        ) : wa?.status === 'CONNECTING' ? (
          <div className="py-10 text-center text-blue-700 text-sm font-semibold flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin" />
            {wa?.device?.linkedAt && Date.now() - new Date(wa.device.linkedAt).getTime() < 120000
              ? <>QR scanned on {wa.device.phone} — finishing setup…</>
              : 'Connecting to WhatsApp…'}
          </div>
        ) : connected ? (
          <div className="py-6 text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center"><CheckCircle2 className="w-9 h-9 text-emerald-600" /></div>
            <div className="text-base font-bold text-slate-900">Connected{wa.name ? ` as ${wa.name}` : ''}</div>
            <div className="text-sm text-slate-500">+{wa.connectedNumber}{wa.device?.phone ? ` · ${wa.device.phone}` : ''}</div>
            <p className="text-xs text-emerald-700">Messages go out about one every 3 seconds.</p>
          </div>
        ) : (
          <div className="py-6 text-center space-y-2">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center"><Unplug className="w-8 h-8 text-slate-400" /></div>
            <p className="text-sm text-slate-600">{wa?.lastError || (status?.hasSavedSession ? 'The number is linked but not connected right now.' : 'No WhatsApp number is linked yet.')}</p>
            <p className="text-xs text-slate-400">Messages wait in the queue (up to 24 hours) until WhatsApp is connected.</p>
          </div>
        )}

        <div className="flex flex-wrap w-full mx-auto gap-2">
          {!connected && !linking && (
            <button onClick={connect} disabled={Boolean(busy)} className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer">
              {busy === 'connect' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
              {status?.hasSavedSession ? 'Reconnect' : 'Show QR to link'}
            </button>
          )}
          {(connected || status?.hasSavedSession || linking) && (
            <button onClick={unlink} disabled={Boolean(busy)} className="px-4 py-2.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-sm font-bold cursor-pointer disabled:opacity-50">
              {linking && !status?.hasSavedSession ? 'Cancel' : 'Logout'}
            </button>
          )}
          <button onClick={reload} aria-label="Refresh" className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-bold flex items-center gap-1 cursor-pointer"><RefreshCw className="w-4 h-4" /></button>
        </div>

        {connected && (
          <form onSubmit={(e) => { e.preventDefault(); run('test', () => api.testWhatsapp(testPhone)); }} className="pt-3 border-t border-slate-100 space-y-1.5">
            <label className="text-[11px] font-bold text-slate-600 block">Send a test message</label>
            <div className="flex gap-2">
              <PhoneInput size="sm" className="flex-1" value={testPhone} onChange={setTestPhone} />
              <button type="submit" disabled={Boolean(busy) || !isValidPhone(testPhone)} className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                {busy === 'test' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Test
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Connection details */}
      <div className="lg:col-span-7 space-y-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2"><Smartphone className="w-4 h-4 text-emerald-600" /> Connection details</h2>
          <Detail icon={Power} label="Status" value={(STATUS_STYLE[wa?.status] || STATUS_STYLE.DISCONNECTED)[0]} tone={connected ? 'text-emerald-700' : wa?.status === 'LOGGED_OUT' ? 'text-rose-600' : undefined} />
          <Detail icon={Smartphone} label="Linked number" value={wa?.connectedNumber ? `+${wa.connectedNumber}` : status?.hasSavedSession ? 'Linked (offline)' : 'Not linked'} />
          <Detail icon={MessageCircle} label="WhatsApp name" value={wa?.name || '—'} />
          <Detail icon={Clock} label="Connected since" value={wa?.connectedAt ? `${when(wa.connectedAt)} (${since(wa.connectedAt)})` : '—'} />
          <Detail icon={Server} label="Sending server" value={status?.senderInstance ? 'This server is sending messages' : 'This server is not the sender — press Reconnect to send from here'} tone={status?.senderInstance ? 'text-emerald-700' : 'text-amber-700'} />
          <Detail icon={RotateCcw} label="Auto-reconnect" value={wa?.autoReconnect ? `On${wa?.reconnectAttempts ? ` (retry ${wa.reconnectAttempts})` : ''}` : 'Off'} />
          <Detail icon={AlertTriangle} label="Last disconnect" value={wa?.lastDisconnectAt ? `${when(wa.lastDisconnectAt)} — ${wa.lastDisconnectReason || ''}` : '—'} />
          <Detail icon={Mail} label="Email copies" value={status?.emailConfigured ? 'SMTP configured' : 'SMTP not configured (email copies skipped)'} tone={status?.emailConfigured ? 'text-emerald-700' : 'text-amber-700'} />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2"><Smartphone className="w-4 h-4 text-emerald-600" /> Linked device</h2>
          {wa?.device ? (
            <>
              <Detail icon={Smartphone} label="Phone" value={`${wa.device.phone}${wa?.connectedNumber ? ` · +${wa.connectedNumber}` : ''}`} />
              <Detail icon={Server} label="Device slot" value={wa.device.deviceId != null ? `Linked device #${wa.device.deviceId}` : '—'} />
              <Detail icon={Clock} label="Linked on" value={wa.device.linkedAt ? `${when(wa.device.linkedAt)} (${since(wa.device.linkedAt)} ago)` : 'Before this update'} />
              <Detail icon={QrCode} label="Shown on the phone as" value={wa.device.shownOnPhoneAs} />
              <p className="text-[11px] text-slate-500 mt-2">To check or remove it from the phone: WhatsApp → Settings → Linked devices → “{wa.device.shownOnPhoneAs}”.</p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No phone is linked yet. Scan the QR to link the RBS WhatsApp number.</p>
          )}
        </div>

        <button onClick={onShowCounts} className="w-full text-left bg-white border border-slate-200 rounded-2xl p-5 hover:border-emerald-300 cursor-pointer">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-emerald-600" /> Today</h2>
            <span className="text-xs font-bold text-emerald-700">Full history →</span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-center">
            <MiniStat label="Sent" value={today.sent} tone="text-slate-900" />
            <MiniStat label="Delivered" value={today.delivered} tone="text-emerald-700" />
            <MiniStat label="Read" value={today.read} tone="text-blue-700" />
            <MiniStat label="Waiting" value={status?.queue?.pending} tone="text-amber-700" />
            <MiniStat label="Failed" value={today.failed} tone="text-rose-600" />
          </div>
        </button>
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone, display }) {
  return (
    <div className="bg-slate-50 rounded-xl py-2.5">
      <div className={`text-xl font-black ${tone}`}>{display ?? num(value)}</div>
      <div className="text-[11px] font-semibold text-slate-500">{label}</div>
    </div>
  );
}

// ---------------------------------------------------------------- Counts

function CountsSection({ busy, run }) {
  const [days, setDays] = useState(7);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      setData(await api.getWhatsappStats(days));
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const t = data?.today || {};
  const maxDay = Math.max(1, ...(data?.history || []).map((d) => d.total));
  const failedToday = (t.failed || 0) + (t.expired || 0);

  return (
    <div className="space-y-5">
      {err ? <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">{err}</div> : null}

      {/* Today */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <h2 className="text-sm font-bold text-slate-900">Today{data?.today?.date ? ` · ${new Date(`${data.today.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}</h2>
          <div className="flex gap-2">
            {failedToday > 0 && (
              <button onClick={() => run('retry', () => api.retryFailedWhatsapp(24)).then(load)} disabled={Boolean(busy)}
                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50">
                <RotateCcw className="w-3.5 h-3.5" /> Retry failed (24 h)
              </button>
            )}
            <button onClick={load} className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <BigStat icon={MessageCircle} label="Messages today" value={t.total} tone="text-slate-900" bg="bg-slate-50" />
          <BigStat icon={Check} label="Sent" value={t.sent} sub={t.total ? `${pct(t.sent, t.total)} of today` : ''} tone="text-slate-900" bg="bg-slate-50" />
          <BigStat icon={CheckCheck} label="Delivered" value={t.delivered} sub={t.sent ? `${pct(t.delivered, t.sent)} of sent` : ''} tone="text-emerald-700" bg="bg-emerald-50" />
          <BigStat icon={CheckCheck} label="Read" value={t.read} sub={t.sent ? `${pct(t.read, t.sent)} of sent` : ''} tone="text-blue-700" bg="bg-blue-50" />
          <BigStat icon={Hourglass} label="Waiting in queue" value={data?.queue?.waiting} sub={data?.queue?.oldestWaitingAt ? `oldest ${since(data.queue.oldestWaitingAt)}` : ''} tone="text-amber-700" bg="bg-amber-50" />
          <BigStat icon={XCircle} label="Failed / expired" value={failedToday} tone="text-rose-600" bg="bg-rose-50" />
        </div>
        {data?.email?.today ? <p className="text-xs text-slate-500 mt-3">Email copies today: {num(data.email.sentToday)} sent of {num(data.email.today)}.</p> : null}
      </div>

      {/* Today by message type */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-3">Today by message type</h2>
        {!(data?.byEventToday || []).length ? (
          <p className="text-sm text-slate-400">No WhatsApp messages today yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
                <th className="py-2 font-bold">Message</th><th className="py-2 font-bold">To</th>
                <th className="py-2 font-bold text-right">Sent</th><th className="py-2 font-bold text-right">Delivered</th><th className="py-2 font-bold text-right">Read</th><th className="py-2 font-bold text-right">Waiting</th><th className="py-2 font-bold text-right">Failed</th>
              </tr></thead>
              <tbody>
                {data.byEventToday.map((r) => (
                  <tr key={`${r.event}-${r.audience}`} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-semibold text-slate-800">{EVENT_LABEL[r.event] || r.event}</td>
                    <td className="py-2 text-slate-500 capitalize">{String(r.audience || '').toLowerCase()}</td>
                    <td className="py-2 text-right font-bold">{num(r.sent)}</td>
                    <td className="py-2 text-right text-emerald-700 font-bold">{num(r.delivered)}</td>
                    <td className="py-2 text-right text-blue-700">{num(r.read)}</td>
                    <td className="py-2 text-right text-amber-700">{num(r.waiting)}</td>
                    <td className="py-2 text-right text-rose-600">{num(r.failed + r.expired)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* History */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-bold text-slate-900">History (counts per day)</h2>
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)} aria-pressed={days === d}
                className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${days === d ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}>{d} days</button>
            ))}
          </div>
        </div>

        {data?.totals && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4 text-center">
            <MiniStat label={`Sent (${data.totals.days} d)`} value={data.totals.sent} tone="text-slate-900" />
            <MiniStat label="Delivered" value={data.totals.delivered} tone="text-emerald-700" />
            <MiniStat label="Read" value={data.totals.read} tone="text-blue-700" />
            <MiniStat label="Failed / expired" value={data.totals.failed + data.totals.expired} tone="text-rose-600" />
            <MiniStat label="Delivery rate" display={pct(data.totals.delivered, data.totals.sent)} tone="text-slate-900" />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100">
              <th className="py-2 font-bold">Day</th><th className="py-2 font-bold w-1/3">Volume</th>
              <th className="py-2 font-bold text-right">Total</th><th className="py-2 font-bold text-right">Sent</th><th className="py-2 font-bold text-right">Delivered</th><th className="py-2 font-bold text-right">Read</th><th className="py-2 font-bold text-right">Failed</th>
            </tr></thead>
            <tbody>
              {(data?.history || []).map((d) => (
                <tr key={d.date} className={`border-b border-slate-50 last:border-0 ${d.total ? '' : 'text-slate-300'}`}>
                  <td className="py-2 font-semibold whitespace-nowrap">{dayLabel(d.date)}</td>
                  <td className="py-2 pr-3">
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                      <div className="bg-emerald-500 h-full" style={{ width: `${(d.delivered / maxDay) * 100}%` }} title={`${d.delivered} delivered`} />
                      <div className="bg-slate-400 h-full" style={{ width: `${(Math.max(0, d.sent - d.delivered) / maxDay) * 100}%` }} title={`${Math.max(0, d.sent - d.delivered)} sent, not yet delivered`} />
                      <div className="bg-rose-400 h-full" style={{ width: `${((d.failed + d.expired) / maxDay) * 100}%` }} title={`${d.failed + d.expired} failed`} />
                    </div>
                  </td>
                  <td className="py-2 text-right font-bold">{num(d.total)}</td>
                  <td className="py-2 text-right">{num(d.sent)}</td>
                  <td className="py-2 text-right text-emerald-700 font-semibold">{num(d.delivered)}</td>
                  <td className="py-2 text-right text-blue-700">{num(d.read)}</td>
                  <td className="py-2 text-right text-rose-600">{num(d.failed + d.expired)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-emerald-500" /> Delivered</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-slate-400" /> Sent, not yet delivered</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-rose-400" /> Failed / expired</span>
        </div>
      </div>
    </div>
  );
}

function BigStat({ icon: Icon, label, value, sub, tone, bg }) {
  return (
    <div className={`${bg} rounded-2xl p-3.5`}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500"><Icon className="w-3.5 h-3.5" /> {label}</div>
      <div className={`text-2xl font-black mt-1 ${tone}`}>{num(value)}</div>
      {sub ? <div className="text-[11px] text-slate-500">{sub}</div> : null}
    </div>
  );
}

// ---------------------------------------------------------------- Templates

function TemplatesSection({ busy, run, setError }) {
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState('');

  useEffect(() => { api.getTemplates().then((r) => setTemplates(r?.templates || [])).catch((e) => setError(e.message)); }, [setError]);

  const open = async (t) => {
    setEditing({ ...t });
    const r = await api.previewTemplate({ body: t.body, subject: t.subject }).catch(() => null);
    setPreview(r?.preview || '');
  };
  const save = async () => {
    const res = await run('template', () => api.saveTemplate(editing.key, { body: editing.body, subject: editing.subject, enabled: editing.enabled }), 'Template saved.');
    if (res?.template) setTemplates((prev) => prev.map((t) => (t.key === res.template.key ? res.template : t)));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-2 max-h-[60vh] overflow-y-scroll">
        <h2 className="text-sm font-bold text-slate-900 mb-1">Message templates</h2>
        {templates.map((t) => (
          <button key={t.key} onClick={() => open(t)}
            className={`w-full text-left p-2.5 rounded-xl border text-xs cursor-pointer ${editing?.key === t.key ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
            <div className="font-bold text-slate-900">{EVENT_LABEL[t.event] || t.event}</div>
            <div className="text-slate-500">To {t.audience.toLowerCase()} · {t.channel === 'EMAIL' ? 'Email' : 'WhatsApp'}{t.enabled ? '' : ' · OFF'}</div>
          </button>
        ))}
      </div>
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5">
        {!editing ? <p className="text-sm text-slate-400">Pick a template on the left to edit it.</p> : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">{EVENT_LABEL[editing.event] || editing.event} → {editing.audience.toLowerCase()} ({editing.channel})</span>
              <label className="flex items-center gap-1.5 text-xs font-semibold">
                <input type="checkbox" className="accent-emerald-600" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} /> Send this message
              </label>
            </div>
            {editing.channel === 'EMAIL' && (
              <input value={editing.subject || ''} onChange={(e) => setEditing({ ...editing, subject: e.target.value })} placeholder="Email subject"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs" />
            )}
            <textarea value={editing.body} rows={11} onChange={(e) => setEditing({ ...editing, body: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs font-mono" />
            <p className="text-[10px] text-slate-500 break-words">Placeholders: {PLACEHOLDERS}</p>
            <div className="flex gap-2">
              <button onClick={async () => { const r = await api.previewTemplate({ body: editing.body, subject: editing.subject }).catch(() => null); setPreview(r?.preview || ''); }}
                className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold cursor-pointer">Preview</button>
              <button onClick={save} disabled={Boolean(busy)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer">
                <Save className="w-3.5 h-3.5" /> Save template
              </button>
            </div>
            {preview && <pre className="whitespace-pre-wrap text-xs bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-slate-800">{preview}</pre>}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- Settings

function SettingsSection({ status, busy, run, reload }) {
  const [adminPhones, setAdminPhones] = useState('');
  useEffect(() => { setAdminPhones((status?.adminNotifyPhones || []).join(', ')); }, [status]);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 max-w-2xl space-y-4">
      <form onSubmit={async (e) => { e.preventDefault(); await run('phones', () => api.saveAdminNotifyPhones(adminPhones.split(',')), 'Admin numbers saved.'); reload(); }} className="space-y-1.5">
        <label className="text-sm font-bold text-slate-900 block">RBS admin numbers</label>
        <p className="text-xs text-slate-500">These numbers get journey started / completed summaries and boarding-stop changes. Separate with commas; India or Nepal (+977).</p>
        <div className="flex gap-2">
          <input value={adminPhones} onChange={(e) => setAdminPhones(e.target.value.replace(/[^\d, +]/g, ''))} placeholder="9876543210, +9779812345678"
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm" />
          <button type="submit" disabled={Boolean(busy)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold cursor-pointer disabled:opacity-50">Save</button>
        </div>
      </form>
      {!status?.emailConfigured && (
        <p className="text-xs text-amber-700 flex items-start gap-1.5 pt-3 border-t border-slate-100"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> Email (SMTP) is not configured on the server, so email copies of tickets are skipped. Set SMTP_HOST / SMTP_USER / SMTP_PASS in the API environment.</p>
      )}
    </div>
  );
}
