'use client';

import React, { useState } from 'react';
import { Route, MapPin, Edit3, Check, ShieldCheck, AlertCircle } from 'lucide-react';

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState([
    { id: 'rup-amd', name: 'Rupadiya ↔ Ahmedabad', distance: '1,250 km', duration: '21h', baseFare: 1650, frequency: 'Daily' },
    { id: 'rup-sur', name: 'Rupadiya ↔ Surat', distance: '1,320 km', duration: '22h 30m', baseFare: 1750, frequency: 'Daily' },
    { id: 'rup-bdq', name: 'Rupadiya ↔ Vadodara', distance: '1,180 km', duration: '20h', baseFare: 1550, frequency: 'Daily' },
    { id: 'rup-blr', name: 'Rupadiya ↔ Bengaluru', distance: '1,980 km', duration: '32h', baseFare: 2400, frequency: 'Alternate' },
    { id: 'rup-hyd', name: 'Rupadiya ↔ Hyderabad', distance: '1,720 km', duration: '28h', baseFare: 2100, frequency: 'Daily' },
    { id: 'rup-bom', name: 'Rupadiya ↔ Mumbai', distance: '1,540 km', duration: '25h', baseFare: 1950, frequency: 'Daily' },
  ]);

  const [editingId, setEditingId] = useState(null);
  const [newFare, setNewFare] = useState('');

  const handleSaveFare = (id) => {
    const val = parseFloat(newFare);
    if (!val || val <= 0) return;

    setRoutes(prev => prev.map(r => r.id === id ? { ...r, baseFare: val } : r));
    setEditingId(null);
  };

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-slate-200/90 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
          <Route className="w-3.5 h-3.5" />
          <span>Intercity Corridors</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Hub-and-Spoke Routes & Base Fares</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Governed corridors between Rupadiya Central Hub and authorized spoke cities.
        </p>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200/90 pb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            Authorized Bidirectional Corridors (6 Corridors / 12 Two-Way Trips)
          </h2>
          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Strictly Hub-Enforced
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200/90 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Corridor Name</th>
                <th className="py-3 px-4">Distance</th>
                <th className="py-3 px-4">Standard Duration</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4 text-right">Base Passenger Fare</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {routes.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/40 transition">
                  <td className="py-3 px-4 font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-blue-600" />
                    <span>{r.name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{r.distance}</td>
                  <td className="py-3 px-4 text-slate-500">{r.duration}</td>
                  <td className="py-3 px-4 text-slate-700 font-semibold">{r.frequency}</td>
                  <td className="py-3 px-4 text-right font-black text-slate-900">
                    {editingId === r.id ? (
                      <input
                        type="number"
                        value={newFare}
                        onChange={(e) => setNewFare(e.target.value)}
                        className="w-24 p-1 rounded-lg bg-slate-50 border border-blue-600 text-right text-xs text-slate-900"
                        autoFocus
                      />
                    ) : (
                      <span className="text-emerald-700">₹{r.baseFare}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {editingId === r.id ? (
                      <button
                        onClick={() => handleSaveFare(r.id)}
                        className="p-1 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => { setEditingId(r.id); setNewFare(String(r.baseFare)); }}
                        className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 hover:text-slate-900 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
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

