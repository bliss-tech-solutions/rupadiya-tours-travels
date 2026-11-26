'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Banknote, RefreshCw, CheckCircle2, XCircle, Building2, Landmark, Smartphone, AlertTriangle, Clock, Zap, FileText } from 'lucide-react';
import { api } from '../../lib/api';

const money = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
const when = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true }) : '—');
const maskAcct = (a) => (a ? `••••${String(a).slice(-4)}` : '');

const TABS = [
  ['AWAITING', 'Awaiting payment', Clock],
  ['DISBURSING', 'In progress', Zap],
  ['PAYOUT_FAILED', 'Failed', AlertTriangle],
  ['APPROVED', 'Paid', CheckCircle2],
  ['REJECTED', 'Rejected', XCircle],
  ['all', 'All', FileText]
];

export default function AdminWithdrawalsPage() {
  const [tab, setTab] = useState('AWAITING');
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({});
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [payFor, setPayFor] = useState(null);   // withdrawal being paid
  const [rejectFor, setRejectFor] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    setError('');
    api.getWithdrawals({ status: tab })
      .then((res) => { setRows(res.withdrawals || []); setStats(res.stats || {}); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.getWithdrawalPayoutConfig().then(setConfig).catch(() => {}); }, []);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 4000); };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200">
            <Banknote className="w-3.5 h-3.5" /> Agent Payouts
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Withdrawals — pay agents</h1>
          <p className="text-sm text-slate-500 mt-1">Companies approve agent withdrawals after verifying KYC. You pay them here — online via RazorpayX, or manually with a UTR.</p>
        </div>
        <div className="flex items-center gap-3">
          {config && (
            <div className={`px-3 py-2 rounded-xl text-xs font-bold border ${config.razorpayXConfigured ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
              {config.razorpayXConfigured ? `Razorpay payouts · ${money(config.razorpayXBalance)}` : config.onlineAvailable ? 'Razorpay payouts: test mode' : 'Razorpay payouts not set up — manual UTR only'}
            </div>
          )}
          <button onClick={load} className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-indigo-200 bg-indigo-600 text-white p-4">
          <div className="text-xs font-bold uppercase text-indigo-100">Awaiting your payment</div>
          <div className="text-2xl font-black mt-1">{stats.awaitingCount || 0}</div>
          <div className="text-xs text-indigo-100 mt-0.5">{money(stats.awaitingAmount)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {TABS.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k}
            className={`px-3.5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer ${tab === k ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
            <Icon className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>

      {toast ? <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-semibold">{toast}</div> : null}
      {error ? <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold">{error}</div> : null}

      <div className="space-y-3">
        {loading && !rows.length ? <div className="text-center text-slate-400 py-10">Loading…</div> : null}
        {!loading && !rows.length ? <div className="text-center text-slate-400 py-10 bg-white rounded-2xl border border-slate-200">No withdrawals here.</div> : null}
        {rows.map((w) => (
          <WithdrawalCard key={w._id} w={w} onPay={() => setPayFor(w)} onReject={() => setRejectFor(w)} />
        ))}
      </div>

      {payFor && (
        <PayModal w={payFor} config={config} onClose={() => setPayFor(null)}
          onDone={(msg) => { setPayFor(null); flash(msg); load(); }} />
      )}
      {rejectFor && (
        <RejectModal w={rejectFor} onClose={() => setRejectFor(null)}
          onDone={(msg) => { setRejectFor(null); flash(msg); load(); }} />
      )}
    </div>
  );
}

function StatusPill({ w }) {
  const map = {
    PENDING: ['Awaiting company approval', 'bg-slate-100 text-slate-600'],
    PROCESSING: w.processingStage === 'AWAITING_ADMIN_PAYMENT' ? ['Awaiting your payment', 'bg-indigo-100 text-indigo-700'] : ['Payment in progress', 'bg-blue-100 text-blue-700'],
    PAYOUT_FAILED: ['Payout failed', 'bg-rose-100 text-rose-700'],
    APPROVED: ['Paid', 'bg-emerald-100 text-emerald-700'],
    REJECTED: ['Rejected', 'bg-slate-200 text-slate-600']
  };
  const [label, cls] = map[w.status] || [w.status, 'bg-slate-100 text-slate-600'];
  return <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>{label}</span>;
}

function WithdrawalCard({ w, onPay, onReject }) {
  const agent = w.agentId || {};
  const payable = w.status === 'PROCESSING' && w.processingStage === 'AWAITING_ADMIN_PAYMENT';
  const retryable = w.status === 'PAYOUT_FAILED';
  const upi = w.payoutDetails?.method === 'upi';
  return (
    <div className={`bg-white rounded-2xl border p-4 sm:p-5 ${payable ? 'border-indigo-300' : 'border-slate-200'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl font-black text-slate-900">{money(w.amount)}</span>
            <StatusPill w={w} />
          </div>
          <div className="text-sm text-slate-600 mt-1 font-semibold">{agent.name || 'Agent'}{agent.referralCode ? ` · ${agent.referralCode}` : ''}</div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5"><Building2 className="w-3.5 h-3.5" /> {w.companyName} · #{w.companyCode}</div>
        </div>
        <div className="text-right text-xs text-slate-500">
          <div>Requested {when(w.createdAt)}</div>
          {w.approvals?.company?.at ? <div className="text-emerald-600 font-semibold">Company approved {when(w.approvals.company.at)}</div> : null}
          {agent.kycStatus ? <div className={`font-semibold ${agent.kycStatus === 'VERIFIED' ? 'text-emerald-600' : 'text-amber-600'}`}>KYC {agent.kycStatus}</div> : null}
        </div>
      </div>

      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-xl p-3 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700 mb-1">{upi ? <Smartphone className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />} {upi ? 'UPI payout' : 'Bank payout'}</div>
          {upi ? (
            <div className="text-slate-600 font-mono">{w.payoutDetails?.upiId || agent.bankDetails?.upiId || '—'}</div>
          ) : (
            <div className="text-slate-600">
              <div className="font-semibold">{w.payoutDetails?.accountName || agent.bankDetails?.accountName || '—'}</div>
              <div className="font-mono">{maskAcct(w.payoutDetails?.accountNumber || w.payoutDetails?.accountNumberMasked)} · {w.payoutDetails?.ifscCode || agent.bankDetails?.ifscCode || ''}</div>
              <div>{w.payoutDetails?.bankName || agent.bankDetails?.bankName || ''}</div>
            </div>
          )}
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
          {w.utrNumber ? <div>Paid · UTR <span className="font-mono font-bold text-slate-800">{w.utrNumber}</span> {w.disbursedAt ? `· ${when(w.disbursedAt)}` : ''}</div> : null}
          {w.approvals?.admin?.at ? <div>Paid by {w.approvals.admin.name || 'admin'} ({w.approvals.admin.mode}) {when(w.approvals.admin.at)}</div> : null}
          {w.payout?.failureReason && retryable ? <div className="text-rose-600 font-semibold">{w.payout.failureReason}</div> : null}
          {!w.utrNumber && !retryable && payable ? <div className="text-indigo-600 font-semibold">Company funded this — pay the agent now.</div> : null}
        </div>
      </div>

      {(payable || retryable) && (
        <div className="mt-3 flex gap-2 justify-end">
          <button onClick={onReject} className="px-3.5 py-2 rounded-xl border border-rose-200 text-rose-600 text-sm font-bold flex items-center gap-1 cursor-pointer"><XCircle className="w-4 h-4" /> Reject</button>
          <button onClick={onPay} className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center gap-1 cursor-pointer"><Banknote className="w-4 h-4" /> {retryable ? 'Retry payment' : 'Pay agent'}</button>
        </div>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-slate-900 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function PayModal({ w, config, onClose, onDone }) {
  const live = Boolean(config?.razorpayXConfigured);
  const onlineAvailable = Boolean(config?.onlineAvailable ?? live);
  const [mode, setMode] = useState(live ? 'online' : 'manual');
  const [utr, setUtr] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const dest = w.payoutDetails?.method === 'upi' ? 'UPI ID' : 'bank account';
  const blocked = mode === 'online' && !onlineAvailable;

  const submit = async () => {
    if (blocked) return;
    if (mode === 'manual' && !/^[A-Z0-9]{6,30}$/.test(utr)) { setErr('Enter the bank UTR / reference number (6-30 letters or digits).'); return; }
    setBusy(true); setErr('');
    try {
      const res = await api.payWithdrawal(w._id, { mode, utrNumber: mode === 'manual' ? utr : undefined });
      if (res.success === false) { setErr(res.error || 'Payout failed.'); setBusy(false); return; }
      onDone(res.message || 'Payout done.');
    } catch (e) { setErr(e.message); setBusy(false); }
  };

  const Option = ({ value, icon: Icon, title, sub }) => (
    <button type="button" onClick={() => { setMode(value); setErr(''); }} aria-pressed={mode === value}
      className={`flex-1 p-3 rounded-xl border-2 text-left cursor-pointer ${mode === value ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300'}`}>
      <div className={`flex items-center gap-1.5 text-sm font-bold ${mode === value ? 'text-indigo-700' : 'text-slate-700'}`}><Icon className="w-4 h-4" /> {title}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
    </button>
  );

  return (
    <Modal title={`Pay ${money(w.amount)} to ${w.agentId?.name || 'agent'}`} onClose={busy ? () => {} : onClose}>
      <div className="flex gap-2 mb-4">
        <Option value="online" icon={Zap} title="Razorpay" sub={live ? 'Instant payout' : onlineAvailable ? 'Test mode' : 'Not set up'} />
        <Option value="manual" icon={FileText} title="Manual + UTR" sub="Paid from bank" />
      </div>

      {mode === 'online' ? (
        <div className="mb-4 text-sm">
          {live ? (
            <p className="text-slate-500">Razorpay (RazorpayX) will transfer {money(w.amount)} to the agent's {dest} right now. Balance: {money(config?.razorpayXBalance)}.</p>
          ) : onlineAvailable ? (
            <p className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">Test mode: no real money moves. Add RAZORPAYX_ACCOUNT_NUMBER in the API .env to pay agents through Razorpay for real.</p>
          ) : (
            <p className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
              Razorpay payouts are not set up on the server{config?.razorpayKeysConfigured ? ' (the RazorpayX account number is missing)' : ''}. Add RAZORPAYX_ACCOUNT_NUMBER in the API .env, or pay manually and enter the UTR.
            </p>
          )}
        </div>
      ) : (
        <div className="mb-4">
          <p className="text-sm text-slate-500 mb-2">Send {money(w.amount)} to the agent's {dest} from your bank, then enter the UTR.</p>
          <input value={utr} onChange={(e) => setUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase())} placeholder="UTR / reference number" autoFocus maxLength={30}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-semibold focus:outline-none focus:border-indigo-500" />
        </div>
      )}

      {err ? <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold mb-3">{err}</div> : null}
      <div className="flex gap-2">
        <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold cursor-pointer">Cancel</button>
        <button onClick={submit} disabled={busy || blocked} className="flex-[1.5] py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? 'Paying…' : mode === 'online' ? `Pay ${money(w.amount)} via Razorpay` : `Mark ${money(w.amount)} paid`}
        </button>
      </div>
    </Modal>
  );
}

function RejectModal({ w, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    setBusy(true); setErr('');
    try { const res = await api.rejectWithdrawal(w._id, reason.trim()); onDone(res.message || 'Rejected.'); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Modal title={`Reject ${money(w.amount)} withdrawal`} onClose={busy ? () => {} : onClose}>
      <p className="text-sm text-slate-500 mb-3">The agent's reserved balance and the company's funding are both refunded.</p>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reason (optional)"
        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-rose-500 mb-3" />
      {err ? <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold mb-3">{err}</div> : null}
      <div className="flex gap-2">
        <button onClick={onClose} disabled={busy} className="flex-1 py-2.5 rounded-xl border border-slate-200 text-sm font-bold cursor-pointer">Cancel</button>
        <button onClick={submit} disabled={busy} className="flex-1 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-bold cursor-pointer disabled:opacity-60">{busy ? 'Rejecting…' : 'Reject & refund'}</button>
      </div>
    </Modal>
  );
}
