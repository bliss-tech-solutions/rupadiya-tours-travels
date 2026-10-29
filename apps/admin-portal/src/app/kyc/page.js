'use client';

import React, { useState } from 'react';
import { UserCheck, ShieldCheck, Check, X, FileText } from 'lucide-react';

export default function AdminKycQueuePage() {
  const [agents, setAgents] = useState([
    {
      id: 'kyc-1',
      name: 'Rupadiya Express Travel Services',
      owner: 'Ramesh Sharma',
      phone: '+91 9876543210',
      pan: 'ABCDE1234F',
      aadhaar: '9876 5432 1098',
      submittedDate: '2026-10-26',
      status: 'VERIFIED',
    },
    {
      id: 'kyc-2',
      name: 'Nanpara Bus Agency',
      owner: 'Pooja Tiwari',
      phone: '+91 9876501002',
      pan: 'FGHIJ5678K',
      aadhaar: '1234 5678 9012',
      submittedDate: '2026-10-27',
      status: 'PENDING',
    },
  ]);

  const handleAction = (id, newStatus) => {
    setAgents(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
  };

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-slate-200/90 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
          <UserCheck className="w-3.5 h-3.5" />
          <span>Compliance Operations</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Agent KYC Approvals Queue</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Review legal identity credentials before enabling wallet withdrawal settlements and sub-agent recruiting.
        </p>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
          Agent Verification Submissions
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/90 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Agency / Counter</th>
                <th className="py-3 px-4">Proprietor</th>
                <th className="py-3 px-4">PAN Number</th>
                <th className="py-3 px-4">Aadhaar (UIDAI)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Verification Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agents.map((ag) => (
                <tr key={ag.id} className="hover:bg-slate-50/40 transition">
                  <td className="py-3 px-4 font-bold text-slate-900">{ag.name}</td>
                  <td className="py-3 px-4 text-slate-700">{ag.owner} ({ag.phone})</td>
                  <td className="py-3 px-4 font-mono font-bold text-blue-700">{ag.pan}</td>
                  <td className="py-3 px-4 font-mono text-slate-500">{ag.aadhaar}</td>
                  <td className="py-3 px-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      ag.status === 'VERIFIED'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {ag.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    {ag.status === 'PENDING' ? (
                      <div className="flex justify-center gap-2">
                        <button
                          onClick={() => handleAction(ag.id, 'VERIFIED')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(ag.id, 'REJECTED')}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[10px] hover:bg-rose-100 cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-medium">Approved by Super Admin</span>
                    )}
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

