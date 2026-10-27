'use client';

import React, { useState } from 'react';
import { Building2, Plus, ShieldCheck, Search, Filter } from 'lucide-react';

export default function AdminCompaniesPage() {
  const [searchTerm, setSearchTerm] = useState('');

  // 33 Franchise Companies
  const companies = Array.from({ length: 33 }).map((_, i) => {
    const code = i + 1;
    return {
      code,
      name: code === 1 ? 'Rupadiya Royal Travels' : `Rupadiya Franchise Carrier #${String(code).padStart(2, '0')}`,
      status: 'ACTIVE',
      annualQuota: 12000,
      currentCarried: code === 1 ? 1420 : 0,
      assignedFleet: code === 1 ? 4 : 2,
    };
  });

  const filtered = companies.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(c.code).includes(searchTerm)
  );

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Master Franchise Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">33 Companies Registry</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete platform management for all 33 authorized operator companies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by code or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-white">
          Active Operator Companies ({filtered.length} of 33)
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Code</th>
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-4">Assigned Fleet</th>
                <th className="py-3 px-4">Passenger Quota Fulfillment</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filtered.map((c) => (
                <tr key={c.code} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-4 font-mono font-black text-purple-400">#{String(c.code).padStart(2, '0')}</td>
                  <td className="py-3 px-4 font-bold text-white">{c.name}</td>
                  <td className="py-3 px-4 text-slate-300">{c.assignedFleet} Buses (2+2)</td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-200">{c.currentCarried} / {c.annualQuota}</span>
                    <span className="text-[10px] text-slate-500 ml-2">({((c.currentCarried / c.annualQuota) * 100).toFixed(1)}%)</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
                      {c.status}
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

