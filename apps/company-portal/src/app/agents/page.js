'use client';

import React from 'react';
import { Users, Phone, MapPin, Ticket, TrendingUp } from 'lucide-react';

export default function CompanyAgentsPage() {
  const companyAgents = [
    { name: 'Rupadiya Border Agency (Main)', code: 'AGT-01-01', phone: '+91 9876501001', bookingsThisMonth: 142, revenue: '₹2,34,300', status: 'Active' },
    { name: 'Nanpara Express Ticket Counter', code: 'AGT-01-02', phone: '+91 9876501002', bookingsThisMonth: 89, revenue: '₹1,46,850', status: 'Active' },
    { name: 'Bahraich City Booking Point', code: 'AGT-01-03', phone: '+91 9876501003', bookingsThisMonth: 76, revenue: '₹1,25,400', status: 'Active' },
    { name: 'Ahmedabad Geeta Mandir Spoke Desk', code: 'AGT-01-04', phone: '+91 9876501004', bookingsThisMonth: 64, revenue: '₹1,05,600', status: 'Active' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Users className="w-3.5 h-3.5" />
          <span>Agency Network</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Company #01 Authorized Agents</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Authorized agent counters and online affiliates booking tickets for Company #01 fleet buses.
        </p>
      </div>

      <div className="bg-[#0D131F] border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          Active Agency Counters
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Agency Name</th>
                <th className="py-3 px-4">Agent Code</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4 text-center">Month Bookings</th>
                <th className="py-3 px-4 text-right">Gross Revenue</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {companyAgents.map((ag) => (
                <tr key={ag.code} className="hover:bg-slate-900/60 transition">
                  <td className="py-3 px-4 font-bold text-white">{ag.name}</td>
                  <td className="py-3 px-4 font-mono text-blue-400">{ag.code}</td>
                  <td className="py-3 px-4 text-slate-400">{ag.phone}</td>
                  <td className="py-3 px-4 text-center font-bold text-slate-200">{ag.bookingsThisMonth}</td>
                  <td className="py-3 px-4 text-right font-black text-emerald-400">{ag.revenue}</td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      {ag.status}
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

