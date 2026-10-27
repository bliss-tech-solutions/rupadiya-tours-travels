'use client';

import React from 'react';
import { Receipt, Download, ShieldCheck, FileSpreadsheet } from 'lucide-react';

export default function AdminTaxReportsPage() {
  const taxSummaries = [
    { period: 'October 2026', grossBookings: '₹28,50,000', gstAmount: '₹1,42,500', tcs194O: '₹28,500', netRemitted: '₹26,79,000' },
    { period: 'September 2026', grossBookings: '₹42,10,000', gstAmount: '₹2,10,500', tcs194O: '₹42,100', netRemitted: '₹39,57,400' },
    { period: 'August 2026', grossBookings: '₹39,80,000', gstAmount: '₹1,99,000', tcs194O: '₹39,800', netRemitted: '₹37,41,200' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Receipt className="w-3.5 h-3.5" />
            <span>State Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">GST & TCS Tax Compliance Statement</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Statutory 5% GST on passenger transport and Section 194-O (1% TCS on e-commerce operators).
          </p>
        </div>

        <button
          onClick={() => alert('Downloading GST GSTR-8 Audit Return Statement (JSON/CSV)...')}
          className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-purple-600/20"
        >
          <Download className="w-4 h-4" />
          <span>Download GSTR-8 Return</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">GST Rate on Bus Passenger Service</span>
          <div className="text-3xl font-black text-white">5.0%</div>
          <p className="text-xs text-slate-400">Without Input Tax Credit (ITC) as prescribed under Indian GST statutes.</p>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">TCS Section 194-O Withholding</span>
          <div className="text-3xl font-black text-emerald-400">1.0%</div>
          <p className="text-xs text-slate-400">Deducted on gross sales proceeds credited to non-corporate franchise operators.</p>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          Monthly Tax Withholding & Remittance Summary
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Tax Period</th>
                <th className="py-3 px-4 text-right">Gross Passenger Volume</th>
                <th className="py-3 px-4 text-right">GST (5%)</th>
                <th className="py-3 px-4 text-right">TCS Section 194-O (1%)</th>
                <th className="py-3 px-4 text-right">Net Remitted to Operators</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {taxSummaries.map((t, i) => (
                <tr key={i} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-4 font-bold text-white">{t.period}</td>
                  <td className="py-3 px-4 text-right font-black text-white">{t.grossBookings}</td>
                  <td className="py-3 px-4 text-right text-purple-400 font-bold">{t.gstAmount}</td>
                  <td className="py-3 px-4 text-right text-amber-400 font-bold">{t.tcs194O}</td>
                  <td className="py-3 px-4 text-right font-black text-emerald-400">{t.netRemitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

