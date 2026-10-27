'use client';

import React, { useState } from 'react';
import { Bus, Plus, ShieldCheck, AlertCircle, Wrench, Calendar, Check } from 'lucide-react';

export default function CompanyFleetPage() {
  const [buses, setBuses] = useState([
    {
      id: 'b1',
      busNumber: 'UP-40-BT-1001',
      name: 'Rupadiya Intercity Express',
      busType: 'BharatBenz Luxury AC',
      totalSeats: 40,
      layout: '2+2',
      status: 'ACTIVE',
      rcExpiry: '2027-10-20',
      insuranceExpiry: '2027-04-15',
      driverContact: 'Dinesh Yadav (+91 9876500001)',
    },
    {
      id: 'b2',
      busNumber: 'UP-40-BT-1002',
      name: 'Surat Diamond Cruiser',
      busType: 'BharatBenz Luxury AC',
      totalSeats: 40,
      layout: '2+2',
      status: 'ACTIVE',
      rcExpiry: '2027-11-05',
      insuranceExpiry: '2027-05-10',
      driverContact: 'Ramesh Yadav (+91 9876500002)',
    },
    {
      id: 'b3',
      busNumber: 'UP-40-BT-1003',
      name: 'Rupadiya Overland Express',
      busType: 'Volvo 9600 Multi-Axle',
      totalSeats: 40,
      layout: '2+2',
      status: 'ACTIVE',
      rcExpiry: '2027-09-12',
      insuranceExpiry: '2027-03-22',
      driverContact: 'Dinesh Kumar (+91 9876500003)',
    },
    {
      id: 'b4',
      busNumber: 'UP-40-BT-1004',
      name: 'Setra Intercity Cruiser',
      busType: 'Setra s517 HD Luxury',
      totalSeats: 40,
      layout: '2+2',
      status: 'ACTIVE',
      rcExpiry: '2027-12-01',
      insuranceExpiry: '2027-06-30',
      driverContact: 'Sunil Singh (+91 9876500004)',
    },
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Bus className="w-3.5 h-3.5" />
            <span>Fleet Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Company #01 Fleet Buses</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            All buses operate on fixed 40-seat (2+2) layout with mandatory fitness, RC, and passenger insurance.
          </p>
        </div>

        <button
          onClick={() => alert('New bus induction submitted to Platform Compliance for approval.')}
          className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Induct New Bus</span>
        </button>
      </div>

      {/* Buses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {buses.map((bus) => (
          <div
            key={bus.id}
            className="bg-[#0D131F] border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-slate-700 transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                  {bus.busNumber}
                </span>
                <h3 className="text-base font-black text-white mt-1.5">{bus.name}</h3>
                <p className="text-xs text-slate-400 font-medium">{bus.busType}</p>
              </div>

              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
                {bus.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs">
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Total Capacity</span>
                <span className="font-bold text-slate-200">{bus.totalSeats} Seats ({bus.layout})</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 font-medium block">Driver / Manager</span>
                <span className="font-bold text-slate-200 truncate block">{bus.driverContact}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> RC Expiry: {bus.rcExpiry}
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Ins: {bus.insuranceExpiry}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

