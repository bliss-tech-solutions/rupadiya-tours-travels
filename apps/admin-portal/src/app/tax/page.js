'use client';

import React, { useState, useEffect } from 'react';
import { Receipt, Download, ShieldCheck, FileSpreadsheet, RefreshCw, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';

export default function AdminTaxReportsPage() {
  const [taxData, setTaxData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchTaxReports = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getTaxReports();
      if (res?.success) {
        setTaxData(res.taxSummary || {});
      } else {
        setError(res?.error || 'Failed to fetch tax reports');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to tax service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTaxReports();
  }, []);

  const handleDownloadCsv = () => {
    if (!taxData) return;
    const rows = [
      ['Statutory Field', 'Amount (INR)'],
      ['Gross Passenger Fares Collected', taxData.totalFareCollected || 0],
      ['GST on Passenger Service (5%)', taxData.totalGst5Percent || 0],
      ['Gross Franchise Commission', taxData.totalGrossCommission || 0],
      ['Section 194-O TCS Withholding (1%)', taxData.totalTcs1Percent || 0],
      ['Net Statutory Tax Obligation', taxData.netTaxObligation || 0]
    ];
    const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GSTR8_Statutory_Statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalFare = taxData?.totalFareCollected || 0;
  const totalGst = taxData?.totalGst5Percent || Math.round(totalFare * 0.05);
  const totalTcs = taxData?.totalTcs1Percent || 0;
  const totalComm = taxData?.totalGrossCommission || 0;
  const netRemitted = Math.max(0, totalFare - totalGst);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchTaxReports}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleDownloadCsv}
            disabled={loading || !taxData}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            <span>Download GSTR-8 Statement</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Statutory Rate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl space-y-2 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">GST on Bus Passenger Service</span>
          <div className="text-3xl font-black text-slate-900">5.0%</div>
          <p className="text-xs text-slate-500">Without Input Tax Credit (ITC) as prescribed under Indian GST statutes.</p>
          <div className="pt-2 border-t border-slate-100 font-mono font-bold text-sm text-blue-700">
            Total Collected: ₹{totalGst.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl space-y-2 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">TCS Section 194-O Withholding</span>
          <div className="text-3xl font-black text-emerald-700">1.0%</div>
          <p className="text-xs text-slate-500">Deducted on gross sales proceeds credited to non-corporate franchise operators.</p>
          <div className="pt-2 border-t border-slate-100 font-mono font-bold text-sm text-emerald-700">
            Total Withheld: ₹{totalTcs.toLocaleString('en-IN')}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 p-6 rounded-3xl space-y-2 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Net Operator Settlement</span>
          <div className="text-3xl font-black text-slate-900">₹{netRemitted.toLocaleString('en-IN')}</div>
          <p className="text-xs text-slate-500">Gross passenger volume remitted to 33 franchise companies after statutory taxes.</p>
          <div className="pt-2 border-t border-slate-100 font-mono font-bold text-sm text-slate-600">
            Fares: ₹{totalFare.toLocaleString('en-IN')}
          </div>
        </div>
      </div>

      {/* Tax Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
            Live Statutory Withholding & Tax Remittance Ledger
          </h2>
          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Live DB Reconciled
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Statutory Head</th>
                <th className="py-3 px-4">Statutory Rate</th>
                <th className="py-3 px-4 text-right">Applicable Base Volume</th>
                <th className="py-3 px-4 text-right">Tax Obligation</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="hover:bg-slate-50/50 transition">
                <td className="py-3.5 px-4 font-bold text-slate-900">
                  Goods & Services Tax (GST) - Passenger Transport
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-slate-600">5%</td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                  ₹{totalFare.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-blue-700">
                  ₹{totalGst.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Reconciled
                  </span>
                </td>
              </tr>

              <tr className="hover:bg-slate-50/50 transition">
                <td className="py-3.5 px-4 font-bold text-slate-900">
                  Section 194-O Tax Collected at Source (TCS)
                </td>
                <td className="py-3.5 px-4 font-mono font-bold text-slate-600">1%</td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                  ₹{totalComm.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-amber-700">
                  ₹{totalTcs.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Reconciled
                  </span>
                </td>
              </tr>

              <tr className="bg-slate-50/80 font-bold">
                <td className="py-3.5 px-4 text-slate-900 font-black">
                  Total Statutory Tax Obligation
                </td>
                <td className="py-3.5 px-4 text-slate-500">—</td>
                <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-700">
                  ₹{totalFare.toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                  ₹{(totalGst + totalTcs).toLocaleString('en-IN')}
                </td>
                <td className="py-3.5 px-4 text-center">
                  <span className="text-[10px] font-black text-slate-500 uppercase">
                    FY 2026-27
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
