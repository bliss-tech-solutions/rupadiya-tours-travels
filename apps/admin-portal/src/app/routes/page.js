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
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="border-b border-slate-800 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
          <Route className="w-3.5 h-3.5" />
          <span>Intercity Corridors</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">Hub-and-Spoke Routes & Base Fares</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Governed corridors between Rupadiya Central Hub and authorized spoke cities.
        </p>
      </div>

      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Authorized Bidirectional Corridors (6 Corridors / 12 Two-Way Trips)
          </h2>
          <span className="text-xs text-emerald-400 font-bold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Strictly Hub-Enforced
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                <th className="py-3 px-4">Corridor Name</th>
                <th className="py-3 px-4">Distance</th>
                <th className="py-3 px-4">Standard Duration</th>
                <th className="py-3 px-4">Frequency</th>
                <th className="py-3 px-4 text-right">Base Passenger Fare</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {routes.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/40 transition">
                  <td className="py-3 px-4 font-bold text-white flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-purple-400" />
                    <span>{r.name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-400">{r.distance}</td>
                  <td className="py-3 px-4 text-slate-400">{r.duration}</td>
                  <td className="py-3 px-4 text-slate-300 font-semibold">{r.frequency}</td>
                  <td className="py-3 px-4 text-right font-black text-white">
                    {editingId === r.id ? (
                      <input
                        type="number"
                        value={newFare}
                        onChange={(e) => setNewFare(e.target.value)}
                        className="w-24 p-1 rounded-lg bg-slate-900 border border-purple-500 text-right text-xs text-white"
                        autoFocus
                      />
                    ) : (
                      <span className="text-emerald-400">₹{r.baseFare}</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {editingId === r.id ? (
                      <button
                        onClick={() => handleSaveFare(r.id)}
                        className="p-1 rounded-lg bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => { setEditingId(r.id); setNewFare(String(r.baseFare)); }}
                        className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white"
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

