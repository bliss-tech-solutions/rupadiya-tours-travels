'use client';

import React, { useState, useEffect } from 'react';
import { 
  Route, 
  MapPin, 
  Edit3, 
  Check, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  CheckCircle2,
  Clock,
  ArrowRight
} from 'lucide-react';
import { api } from '../../lib/api';

export default function AdminRoutesPage() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedRouteGroup, setSelectedRouteGroup] = useState('ALL');

  const ROUTE_GROUPS = [
    { id: 'route-1-gujarat', name: 'Route 1 - Gujarat' },
    { id: 'route-2-saurashtra', name: 'Route 2 - Saurashtra' },
    { id: 'route-3-south', name: 'Route 3 - South' },
    { id: 'route-4-maharashtra-goa', name: 'Route 4 - Maharashtra / Goa' }
  ];

  const filteredRoutes = routes.filter(r => {
    if (selectedRouteGroup === 'ALL') return true;
    if (r.routeGroupId) return r.routeGroupId === selectedRouteGroup;
    const name = ((r.name || '') + (r.fromCity?.name || '') + (r.toCity?.name || '')).toLowerCase();
    if (selectedRouteGroup === 'route-1-gujarat') {
      return /himatnagar|ahmedabad|baroda|vadodara|ankleshwar|surat|vapi/.test(name);
    }
    if (selectedRouteGroup === 'route-2-saurashtra') {
      return /bopal|chotila|rajkot|jamnagar/.test(name);
    }
    if (selectedRouteGroup === 'route-3-south') {
      return /hyderabad|bangalore|bengaluru/.test(name);
    }
    if (selectedRouteGroup === 'route-4-maharashtra-goa') {
      return /nashik|mumbai|pune|goa/.test(name);
    }
    return true;
  });

  // Editing base fare state
  const [editingId, setEditingId] = useState(null);
  const [newFare, setNewFare] = useState('');
  const [savingFare, setSavingFare] = useState(false);

  // New corridor modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    fromCity: 'Rupadiya',
    toCity: '',
    distanceKm: '1200',
    durationHours: '20',
    baseFare: '1600'
  });
  const [createLoading, setCreateLoading] = useState(false);

  const fetchRoutes = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getRoutes();
      if (res?.success) {
        setRoutes(res.routes || res.data?.routes || []);
      } else {
        setError(res?.error || 'Failed to load routes from database');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to route service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  const handleSaveFare = async (id) => {
    const val = parseFloat(newFare);
    if (!val || val <= 0) return;

    setSavingFare(true);
    try {
      const res = await api.updateRouteFare(id, val);
      if (res.success) {
        setSuccessMsg('Base passenger fare updated successfully!');
        setEditingId(null);
        setTimeout(() => setSuccessMsg(''), 2500);
        fetchRoutes();
      }
    } catch (err) {
      alert(err.message || 'Failed to update corridor fare');
    } finally {
      setSavingFare(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.name || !createForm.toCity) return;
    setCreateLoading(true);
    try {
      const res = await api.createRoute({
        name: createForm.name.trim(),
        fromCity: { name: createForm.fromCity, state: 'Uttar Pradesh' },
        toCity: { name: createForm.toCity.trim(), state: 'India' },
        distanceKm: Number(createForm.distanceKm) || 1000,
        estimatedDurationHours: Number(createForm.durationHours) || 20,
        baseFare: Number(createForm.baseFare) || 1500
      });
      if (res.success) {
        setSuccessMsg(`Corridor ${createForm.name} created successfully!`);
        setCreateModalOpen(false);
        setCreateForm({
          name: '',
          fromCity: 'Rupadiya',
          toCity: '',
          distanceKm: '1200',
          durationHours: '20',
          baseFare: '1600'
        });
        setTimeout(() => setSuccessMsg(''), 2500);
        fetchRoutes();
      }
    } catch (err) {
      alert(err.message || 'Failed to create route');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Route className="w-3.5 h-3.5" />
            <span>Intercity Corridors</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Hub-and-Spoke Routes & Base Fares</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Governed corridors between Rupadiya Central Hub and authorized spoke cities with tariff governance.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchRoutes}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Corridor</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Routes Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Active Hub Corridors ({filteredRoutes.length} of {routes.length} Corridors)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Filter corridors by approved regional routes</p>
          </div>
          <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
            <ShieldCheck className="w-4 h-4" /> Strictly Hub-Enforced
          </span>
        </div>

        {/* Route Filter Tabs */}
        <div className="flex items-center gap-1.5 flex-wrap pb-1">
          <button
            type="button"
            onClick={() => setSelectedRouteGroup('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              selectedRouteGroup === 'ALL'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Corridors ({routes.length})
          </button>
          {ROUTE_GROUPS.map(g => {
            const count = routes.filter(r => {
              if (r.routeGroupId) return r.routeGroupId === g.id;
              const name = ((r.name || '') + (r.fromCity?.name || '') + (r.toCity?.name || '')).toLowerCase();
              if (g.id === 'route-1-gujarat') return /himatnagar|ahmedabad|baroda|vadodara|ankleshwar|surat|vapi/.test(name);
              if (g.id === 'route-2-saurashtra') return /bopal|chotila|rajkot|jamnagar/.test(name);
              if (g.id === 'route-3-south') return /hyderabad|bangalore|bengaluru/.test(name);
              if (g.id === 'route-4-maharashtra-goa') return /nashik|mumbai|pune|goa/.test(name);
              return false;
            }).length;

            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedRouteGroup(g.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  selectedRouteGroup === g.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{g.name}</span>
                <span className="ml-1.5 opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading corridors from database...</p>
          </div>
        ) : routes.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Corridor Name</th>
                  <th className="py-3 px-4">Distance</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4 text-right">Base Passenger Fare</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Fare Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRoutes.map((r) => (
                  <tr key={r._id || r.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <div className="font-bold text-slate-900">{r.name}</div>
                        <div className="text-[10px] text-slate-400 font-medium">
                          {r.fromCity?.name || 'Rupadiya'} ↔ {r.toCity?.name || r.name}
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {r.distanceKm ? `${r.distanceKm.toLocaleString('en-IN')} km` : '1,250 km'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      {r.estimatedDurationHours ? `${r.estimatedDurationHours}h` : '21h'}
                    </td>

                    <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                      {editingId === (r._id || r.id) ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            value={newFare}
                            onChange={(e) => setNewFare(e.target.value)}
                            className="w-24 p-1.5 rounded-lg bg-slate-50 border border-blue-600 text-right text-xs text-slate-900 font-bold focus:outline-none"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleSaveFare(r._id || r.id)}
                            disabled={savingFare}
                            className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition"
                            title="Save Fare"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-sm font-bold text-slate-900">
                          ₹{Number(r.baseFare || 0).toLocaleString('en-IN')}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {r.isActive !== false ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {editingId === (r._id || r.id) ? (
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="text-[11px] font-bold text-slate-400 hover:text-slate-600"
                        >
                          Cancel
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(r._id || r.id);
                            setNewFare(String(r.baseFare || 1500));
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 font-bold text-[11px] inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Fare</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Route className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No intercity routes configured in the database yet.</p>
          </div>
        )}
      </div>

      {/* Add Corridor Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Create Hub-and-Spoke Corridor
              </h3>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Corridor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rupadiya ↔ Pune"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Hub City</label>
                  <input
                    type="text"
                    disabled
                    value={createForm.fromCity}
                    className="w-full p-3 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-500 font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Destination Spoke City *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pune"
                    value={createForm.toCity}
                    onChange={(e) => setCreateForm({ ...createForm, toCity: e.target.value })}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Distance (km)</label>
                  <input
                    type="number"
                    value={createForm.distanceKm}
                    onChange={(e) => setCreateForm({ ...createForm, distanceKm: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Duration (hrs)</label>
                  <input
                    type="number"
                    value={createForm.durationHours}
                    onChange={(e) => setCreateForm({ ...createForm, durationHours: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Base Fare (₹)</label>
                  <input
                    type="number"
                    value={createForm.baseFare}
                    onChange={(e) => setCreateForm({ ...createForm, baseFare: e.target.value })}
                    className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition"
                >
                  {createLoading ? 'Saving...' : 'Create Corridor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
