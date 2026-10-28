'use client';

import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, DollarSign, Calendar, Download, RefreshCw, BarChart3, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';

export default function CompanyTargetsPage() {
  const [data, setData] = useState(null);
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [dashRes, repRes] = await Promise.all([
          api.getDashboard().catch(() => null),
          api.getReports().catch(() => null)
        ]);
        if (dashRes?.success) setData(dashRes);
        if (repRes?.success) setReports(repRes);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const code = data?.companyCode || 1;
  const companyName = data?.company?.name || `Company #${String(code).padStart(2, '0')}`;
  const stats = data?.stats || {};
  const targetPassengers = stats.targetPassengers || 10000;
  const totalPassengers = stats.totalPassengers || 0;
  const progressPercent = stats.targetProgressPercent || Math.min(100, Math.round((totalPassengers / targetPassengers) * 100));
  const totalRevenue = stats.totalRevenue || (reports?.totalRevenue || 0);
  const totalGst = reports?.totalGst || Math.round(totalRevenue * 0.05);
  const netGross = totalRevenue - totalGst;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-100">
            <Target className="w-3.5 h-3.5" />
            <span>Quota & Performance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Annual Target & Revenue Statement</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Platform quota compliance: {targetPassengers.toLocaleString('en-IN')} annual passenger commitment for {companyName}.
          </p>
        </div>

        <button
          onClick={() => alert('Exporting Financial P&L Statement (CSV)...')}
          className="px-5 py-3 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-xs transition flex items-center gap-2 self-start sm:self-auto cursor-pointer"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Export P&L Report</span>
        </button>
      </div>

      {/* Target Progress Card */}
      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              FY 2026-2027 Passenger Quota Fulfillment
            </h2>
            <div className="text-3xl font-black text-slate-900 mt-1">
              {totalPassengers.toLocaleString('en-IN')} <span className="text-base text-slate-400 font-normal">/ {targetPassengers.toLocaleString('en-IN')} Passengers</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-blue-600">{progressPercent}%</span>
            <span className="text-[11px] text-slate-400 block font-medium">Annual target</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden border border-slate-200">
          <div 
            className="bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500 h-full rounded-full transition-all duration-700" 
            style={{ width: `${Math.max(2, progressPercent)}%` }} 
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Rupadiya Franchise Franchise SLA: Active
          </span>
          <span className="font-semibold text-slate-700">
            {Math.max(0, targetPassengers - totalPassengers).toLocaleString('en-IN')} remaining to goal
          </span>
        </div>
      </div>

      {/* Revenue Statement Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Ticket Revenue</span>
          <div className="text-2xl font-black text-emerald-600">₹{totalRevenue.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-slate-500 block">Gross receipts from passenger bookings</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">GST (5%) Obligation</span>
          <div className="text-2xl font-black text-amber-600">₹{totalGst.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-slate-500 block">Statutory tax collected for department</span>
        </div>

        <div className="bg-white border border-slate-200/80 p-6 rounded-3xl shadow-xs space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Company Gross</span>
          <div className="text-2xl font-black text-blue-600">₹{netGross.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-slate-500 block">Net operational receipts after tax</span>
        </div>
      </div>
    </div>
  );
}
