'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bus, 
  Search, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Clock,
  Phone,
  Building2,
  Calendar
} from 'lucide-react';
import { api } from '../../lib/api';

export default function AdminFleetCompliancePage() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'WARNINGS' | 'COMPLIANT'

  const fetchFleet = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getFleetCompliance();
      if (res?.success) {
        setBuses(res.buses || []);
      } else {
        setError(res?.error || 'Failed to fetch fleet compliance');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to fleet records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const filtered = buses.filter(b => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (
      b.busNumber?.toLowerCase().includes(q) ||
      b.name?.toLowerCase().includes(q) ||
      String(b.companyCode).includes(q) ||
      b.busType?.toLowerCase().includes(q)
    );

    if (!matchesSearch) return false;
    if (filterType === 'WARNINGS') return !b.isCompliant;
    if (filterType === 'COMPLIANT') return b.isCompliant;
    return true;
  });

  const totalBuses = buses.length;
  const warningCount = buses.filter(b => !b.isCompliant).length;
  const compliantCount = totalBuses - warningCount;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Bus className="w-3.5 h-3.5" />
            <span>Statutory Fleet Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Fleet & Document Compliance</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Section 5.8 Compliance Guard: Mandatory RC, Insurance, Route Permit, and Fitness monitoring with 30-day expiry alerts.
          </p>
        </div>

        <button
          onClick={fetchFleet}
          className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center gap-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
          <span>Refresh Fleet</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Fleet Buses</span>
          <div className="text-2xl font-black text-white">{totalBuses} Registered</div>
          <span className="text-[11px] text-slate-500">Across 33 franchise companies</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">30-Day Expiry Warnings</span>
          <div className="text-2xl font-black text-amber-400">{warningCount} Buses Alerted</div>
          <span className="text-[11px] text-slate-500">Papers expiring within 30 days or overdue</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Fully Compliant Fleet</span>
          <div className="text-2xl font-black text-emerald-400">{compliantCount} Buses Clean</div>
          <span className="text-[11px] text-slate-500">Authorized for corridor ticketing</span>
        </div>
      </div>

      {/* Fleet Table Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {[
              { key: 'ALL', label: `All Buses (${totalBuses})` },
              { key: 'WARNINGS', label: `⚠️ Expiry Warnings (${warningCount})` },
              { key: 'COMPLIANT', label: `✓ Compliant (${compliantCount})` },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilterType(f.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  filterType === f.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search bus number, type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
            <span className="text-xs">Analyzing fleet papers...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-500 text-xs space-y-2">
            <Bus className="w-8 h-8 mx-auto text-slate-600" />
            <p>No buses found matching your filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Bus Details</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">RC Expiry</th>
                  <th className="py-3 px-4">Insurance Expiry</th>
                  <th className="py-3 px-4">Permit Expiry</th>
                  <th className="py-3 px-4 text-center">Statutory Compliance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((b) => {
                  const docs = b.documents || {};
                  const warnings = b.complianceWarnings || [];

                  const formatDate = (dateStr) => {
                    if (!dateStr) return 'N/A';
                    return new Date(dateStr).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric'
                    });
                  };

                  return (
                    <tr key={b._id} className="hover:bg-slate-900/50 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-white text-sm">{b.busNumber}</div>
                        <div className="text-[11px] text-slate-400">{b.name} · {b.busType}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                          Code #{String(b.companyCode || 1).padStart(2, '0')}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {formatDate(docs.rcExpiry)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {formatDate(docs.insuranceExpiry)}
                      </td>
                      <td className="py-3.5 px-4 text-slate-300 font-mono">
                        {formatDate(docs.permitExpiry)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {warnings.length === 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>100% Compliant</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{warnings[0].doc} Expiring</span>
                          </span>
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
    </div>
  );
}

