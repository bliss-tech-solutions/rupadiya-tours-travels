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
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Receipt className="w-3.5 h-3.5" />
            <span>State Compliance</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">GST & TCS Tax Compliance Statement</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Statutory 5% GST on passenger transport and Section 194-O (1% TCS on e-commerce operators).
          </p>
        </div>

        <button
          onClick={() => alert('Downloading GST GSTR-8 Audit Return Statement (JSON/CSV)...')}
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download GSTR-8 Return</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">GST Rate on Bus Passenger Service</span>
          <div className="text-3xl font-black text-slate-900">5.0%</div>
          <p className="text-xs text-slate-500">Without Input Tax Credit (ITC) as prescribed under Indian GST statutes.</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">TCS Section 194-O Withholding</span>
          <div className="text-3xl font-black text-emerald-700">1.0%</div>
          <p className="text-xs text-slate-500">Deducted on gross sales proceeds credited to non-corporate franchise operators.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
          Monthly Tax Withholding & Remittance Summary
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/90 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Tax Period</th>
                <th className="py-3 px-4 text-right">Gross Passenger Volume</th>
                <th className="py-3 px-4 text-right">GST (5%)</th>
                <th className="py-3 px-4 text-right">TCS Section 194-O (1%)</th>
                <th className="py-3 px-4 text-right">Net Remitted to Operators</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxSummaries.map((t, i) => (
                <tr key={i} className="hover:bg-slate-50/40 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">{t.period}</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">{t.grossBookings}</td>
                  <td className="py-3 px-4 text-right text-blue-700 font-bold">{t.gstAmount}</td>
                  <td className="py-3 px-4 text-right text-amber-700 font-bold">{t.tcs194O}</td>
                  <td className="py-3 px-4 text-right font-black text-emerald-700">{t.netRemitted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

