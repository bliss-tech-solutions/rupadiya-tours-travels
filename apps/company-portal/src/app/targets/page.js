'use client';

import React from 'react';
import { Target, TrendingUp, DollarSign, Calendar, Download } from 'lucide-react';

export default function CompanyTargetsPage() {
  const pnlMonthly = [
    { month: 'Oct 2026 (MTD)', passengers: 371, grossRevenue: '₹6,12,150', fuelTransit: '₹2,14,000', netSurplus: '₹3,98,150' },
    { month: 'Sep 2026', passengers: 540, grossRevenue: '₹8,91,000', fuelTransit: '₹3,10,000', netSurplus: '₹5,81,000' },
    { month: 'Aug 2026', passengers: 509, grossRevenue: '₹8,39,850', fuelTransit: '₹2,95,000', netSurplus: '₹5,44,850' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Target className="w-3.5 h-3.5" />
            <span>Quota & Performance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Annual Target & Revenue Statement</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Platform quota compliance: 12,000 annual passenger target commitment for Company Code #01.
          </p>
        </div>

        <button
          onClick={() => alert('Exporting Financial P&L Statement (CSV)...')}
          className="px-5 py-3 rounded-2xl bg-slate-900 border border-slate-700 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-2"
        >
          <Download className="w-4 h-4 text-slate-400" />
          <span>Export P&L Report</span>
        </button>
      </div>

      {/* Target Progress Card */}
      <div className="bg-[#0D131F] border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
              FY 2026-2027 Passenger Quota Fulfillment
            </h2>
            <div className="text-3xl font-black text-white mt-1">
              1,420 <span className="text-base text-slate-400 font-normal">/ 12,000 Passengers</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-3xl font-black text-blue-400">11.8%</span>
            <span className="text-[10px] text-slate-500 block">Annual target</span>
          </div>
        </div>

        <div className="w-full bg-slate-900 h-4 rounded-full overflow-hidden border border-slate-800">
          <div className="bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-400 h-full rounded-full" style={{ width: '11.8%' }} />
        </div>
      </div>

      {/* Monthly Financial Breakdown */}
      <div className="bg-[#0D131F] border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          Monthly P&L Statement (Company Code #01)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Period</th>
                <th className="py-3 px-4 text-center">Passengers Carried</th>
                <th className="py-3 px-4 text-right">Gross Ticket Sales</th>
                <th className="py-3 px-4 text-right">Fuel & Toll Transit Costs</th>
                <th className="py-3 px-4 text-right">Net Operational Surplus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {pnlMonthly.map((p, i) => (
                <tr key={i} className="hover:bg-slate-900/60 transition">
                  <td className="py-3 px-4 font-bold text-white">{p.month}</td>
                  <td className="py-3 px-4 text-center font-bold text-blue-400">{p.passengers}</td>
                  <td className="py-3 px-4 text-right font-black text-white">{p.grossRevenue}</td>
                  <td className="py-3 px-4 text-right text-slate-400">{p.fuelTransit}</td>
                  <td className="py-3 px-4 text-right font-black text-emerald-400">{p.netSurplus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

