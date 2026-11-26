'use client';

import React, { useState, useEffect } from 'react';
import { 
  Landmark, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Play, 
  ShieldCheck, 
  Layers, 
  Building2, 
  Users, 
  Wallet,
  Zap,
  ArrowRight
} from 'lucide-react';
import { api } from '../../lib/api';

export default function AdminFinancePage() {
  const [loading, setLoading] = useState(true);
  const [runningRecon, setRunningRecon] = useState(false);
  const [syncingPayouts, setSyncingPayouts] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Reconciliation Run settings modal
  const [reconDays, setReconDays] = useState(2);
  const [autoHeal, setAutoHeal] = useState(true);

  const fetchOverview = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getFinanceOverview();
      if (res?.success) {
        setData(res);
      } else {
        setError(res?.error || 'Failed to fetch financial overview.');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to finance reconciliation service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleRunReconciliation = async () => {
    setRunningRecon(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.runReconciliation({ days: reconDays, autoHeal });
      if (res?.success) {
        const issues = res.run?.counts?.issues || 0;
        const healed = res.run?.counts?.healed || 0;
        setSuccessMsg(`Reconciliation sweep completed. Checked ${res.run?.counts?.checked || 0} records; found ${issues} issue(s), auto-healed ${healed}.`);
        fetchOverview();
      } else {
        setError(res?.error || 'Reconciliation failed.');
      }
    } catch (err) {
      setError(err.message || 'Reconciliation sweep encountered an error.');
    } finally {
      setRunningRecon(false);
    }
  };

  const handleSyncPayouts = async () => {
    setSyncingPayouts(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await api.syncPayouts();
      if (res?.success) {
        setSuccessMsg(res.message || `Checked ${res.checked || 0} in-flight payouts; resolved ${res.resolved || 0}.`);
        fetchOverview();
      } else {
        setError(res?.error || 'Payout sync failed.');
      }
    } catch (err) {
      setError(err.message || 'Payout sync failed.');
    } finally {
      setSyncingPayouts(false);
    }
  };

  const lastRun = data?.lastRun;
  const history = data?.history || [];

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200">
            <Landmark className="w-3.5 h-3.5" />
            <span>Central Money Governance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Finance & Ledger Reconciliation</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time balance liabilities, RazorpayX direct disbursements, and automated ledger parity auto-heal.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleSyncPayouts}
            disabled={syncingPayouts || runningRecon}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer shadow-xs"
            title="Poll RazorpayX for pending/queued payouts"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-600 ${syncingPayouts ? 'animate-pulse' : ''}`} />
            <span>{syncingPayouts ? 'Syncing...' : 'Sync Payouts'}</span>
          </button>

          <button
            onClick={handleRunReconciliation}
            disabled={runningRecon || syncingPayouts}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-indigo-600/20 transition disabled:opacity-50 cursor-pointer"
          >
            {runningRecon ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Running Sweep...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Reconciliation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-24 text-center text-slate-400 flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
          <p className="text-xs font-semibold">Loading ledger liability metrics and gateway status...</p>
        </div>
      ) : (
        <>
          {/* KPI Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Total Wallet Liabilities */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Total Liabilities</span>
                <Wallet className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                ₹{Number(data?.totalWalletLiabilities || 0).toLocaleString('en-IN')}
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span>Avail: ₹{Number(data?.totalAvailable || 0).toLocaleString('en-IN')}</span>
                <span>Held: ₹{Number(data?.totalReserved || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            {/* RazorpayX Account Balance */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">RazorpayX Balance</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  data?.isSimulated ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {data?.isSimulated ? 'Simulated' : (data?.razorpayXConfigured ? 'Active' : 'Offline')}
                </span>
              </div>
              <div className="text-2xl font-black text-emerald-600">
                ₹{Number(data?.razorpayXBalance || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-slate-500 block">Bank balance for agent instant disbursements</span>
            </div>

            {/* Agent Wallets */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Agent Wallets</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-blue-600">
                ₹{Number(data?.agentWalletsTotal || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-slate-500 block">Earnings & deposits held across franchise agents</span>
            </div>

            {/* Company Wallets */}
            <div className="bg-white border border-slate-200/80 p-5 rounded-3xl shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Company Wallets</span>
                <Building2 className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-2xl font-black text-amber-600">
                ₹{Number(data?.companyWalletsTotal || 0).toLocaleString('en-IN')}
              </div>
              <span className="text-[11px] text-slate-500 block">Bus operator payout funding balances</span>
            </div>
          </div>

          {/* Reconciliation Details Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Last Run Summary & Discrepancies */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600" />
                    <span>Latest Reconciliation Report</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lastRun?.createdAt
                      ? `Executed on ${new Date(lastRun.createdAt).toLocaleString('en-IN')} (${lastRun.trigger})`
                      : 'No reconciliation run recorded yet.'}
                  </p>
                </div>

                {lastRun && (
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold self-start ${
                    lastRun.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    {lastRun.status}
                  </span>
                )}
              </div>

              {lastRun ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Checked Records</span>
                      <div className="text-lg font-black text-slate-800">{lastRun.counts?.checked || 0}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100">
                      <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Discrepancies</span>
                      <div className="text-lg font-black text-amber-700">{lastRun.counts?.issues || 0}</div>
                    </div>
                    <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
                      <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Auto-Healed</span>
                      <div className="text-lg font-black text-emerald-700">{lastRun.counts?.healed || 0}</div>
                    </div>
                  </div>

                  {/* Discrepancies Table / List */}
                  {lastRun.details?.discrepancies?.length > 0 ? (
                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-bold text-slate-700">Audit Discrepancies Log:</span>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {lastRun.details.discrepancies.map((d, idx) => (
                          <div key={idx} className="p-3 rounded-2xl border border-slate-200 bg-slate-50/70 text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold">
                              <span className="text-indigo-900">{d.type}</span>
                              <span className={`px-2 py-0.5 rounded text-[10px] ${
                                d.healed ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {d.healed ? 'Auto-Healed' : 'Review Needed'}
                              </span>
                            </div>
                            <p className="text-slate-600">{d.description}</p>
                            <div className="text-[11px] text-slate-400 font-mono">Action: {d.actionTaken}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center text-slate-400 text-xs flex flex-col items-center gap-1.5">
                      <CheckCircle2 className="w-7 h-7 text-emerald-500" />
                      <span className="font-semibold text-slate-700">Zero Inconsistencies Detected</span>
                      <span>All payment orders, booking tickets, and payouts match ledger balances 1:1.</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400 text-xs">
                  Click &ldquo;Run Reconciliation&rdquo; above to audit all gateway transactions against ledger entries.
                </div>
              )}
            </div>

            {/* Sweep Settings & 30-Day Ledger Volume */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-5">
              <h3 className="text-base font-bold text-slate-900">Sweep Parameters</h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Audit Window (Days)</label>
                  <select
                    value={reconDays}
                    onChange={(e) => setReconDays(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:bg-white"
                  >
                    <option value={1}>Last 24 Hours</option>
                    <option value={2}>Last 48 Hours (Recommended)</option>
                    <option value={7}>Last 7 Days</option>
                    <option value={30}>Last 30 Days</option>
                  </select>
                </div>

                <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex items-start gap-2.5">
                  <input
                    type="checkbox"
                    id="autoHealCheck"
                    checked={autoHeal}
                    onChange={(e) => setAutoHeal(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <label htmlFor="autoHealCheck" className="text-xs text-indigo-950 font-medium cursor-pointer">
                    <strong className="block font-bold">Safe Auto-Heal</strong>
                    Auto-credit captured uncredited deposits and finalize webhook-dropped processed payouts.
                  </label>
                </div>
              </div>

              {/* 30-Day Ledger Volume */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">30-Day Ledger Activity</span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-600">Total Credits</span>
                    <span className="font-black text-emerald-600">
                      +₹{Number(data?.ledgerSummary?.totalCredits || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-600">Total Debits</span>
                    <span className="font-black text-rose-600">
                      −₹{Number(data?.ledgerSummary?.totalDebits || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50">
                    <span className="text-slate-600">Transaction Entries</span>
                    <span className="font-bold text-slate-800">
                      {data?.ledgerSummary?.transactionCount || 0} rows
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Historical Runs Table */}
          {history.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-4">
              <h3 className="text-base font-bold text-slate-900">Historical Reconciliation Runs</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                      <th className="py-3 px-4 rounded-l-xl">Run Date</th>
                      <th className="py-3 px-4">Trigger</th>
                      <th className="py-3 px-4">Window</th>
                      <th className="py-3 px-4 text-center">Checked</th>
                      <th className="py-3 px-4 text-center">Issues</th>
                      <th className="py-3 px-4 text-center">Auto-Healed</th>
                      <th className="py-3 px-4 text-right rounded-r-xl">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((h) => (
                      <tr key={h._id} className="hover:bg-slate-50/80 transition">
                        <td className="py-3 px-4 font-bold text-slate-800">
                          {new Date(h.createdAt).toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">{h.trigger}</td>
                        <td className="py-3 px-4 text-slate-500">{h.days} Day(s)</td>
                        <td className="py-3 px-4 text-center font-bold text-slate-700">{h.counts?.checked || 0}</td>
                        <td className="py-3 px-4 text-center font-bold text-amber-600">{h.counts?.issues || 0}</td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-600">{h.counts?.healed || 0}</td>
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            h.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {h.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
