'use client';

import React, { useState } from 'react';
import { FileSpreadsheet, Search, Filter, Download, CheckCircle2 } from 'lucide-react';

export default function AdminBookingsPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const sampleBookings = [
    {
      id: 'RUP-7829-BK',
      passenger: 'Rahul Sharma (+91 9876543210)',
      corridor: 'Rupadiya → Ahmedabad',
      bus: 'UP-40-BT-1001 (Company #01)',
      seats: '1, 2',
      amount: 3300,
      paymentMethod: 'Agent Wallet (AGT-9281)',
      status: 'CONFIRMED',
      date: '2026-10-27 10:15',
    },
    {
      id: 'RUP-7828-BK',
      passenger: 'Neha Verma (+91 9876543211)',
      corridor: 'Rupadiya → Surat',
      bus: 'UP-40-BT-1002 (Company #01)',
      seats: '4',
      amount: 1750,
      paymentMethod: 'Online UPI',
      status: 'CONFIRMED',
      date: '2026-10-27 09:40',
    },
    {
      id: 'RUP-7827-BK',
      passenger: 'Pooja Tiwari (+91 9876543212)',
      corridor: 'Ahmedabad → Rupadiya',
      bus: 'UP-40-BT-1001 (Company #01)',
      seats: '9, 10',
      amount: 3300,
      paymentMethod: 'Agent Wallet',
      status: 'CONFIRMED',
      date: '2026-10-26 18:22',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Master Transactions</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Platform Master Bookings Ledger</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time audit record of passenger bookings across all 33 companies and agent wallets.
          </p>
        </div>

        <button
          onClick={() => alert('Exporting platform master bookings (CSV)...')}
          className="px-5 py-3 rounded-2xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center gap-2"
        >
          <Download className="w-4 h-4 text-slate-400" />
          <span>Export Master CSV</span>
        </button>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          Confirmed Intercity Passenger Tickets
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Booking ID</th>
                <th className="py-3 px-4">Lead Passenger</th>
                <th className="py-3 px-4">Corridor & Company</th>
                <th className="py-3 px-4">Seats</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {sampleBookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-4 font-mono font-bold text-purple-400">#{b.id}</td>
                  <td className="py-3 px-4 font-bold text-white">{b.passenger}</td>
                  <td className="py-3 px-4 text-slate-300">{b.corridor} · <span className="text-slate-500">{b.bus}</span></td>
                  <td className="py-3 px-4 font-bold text-emerald-400">{b.seats}</td>
                  <td className="py-3 px-4 text-slate-400">{b.paymentMethod}</td>
                  <td className="py-3 px-4 text-right font-black text-white">₹{b.amount}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

