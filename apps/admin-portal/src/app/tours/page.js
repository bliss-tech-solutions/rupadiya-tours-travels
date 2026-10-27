'use client';

import React, { useState, useEffect } from 'react';
import { Compass, Plus, Trash2, MapPin, CheckCircle2, Clock, Calendar } from 'lucide-react';
import { api } from '../../lib/api';

export default function AdminToursPage() {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDestination, setNewDestination] = useState('');
  const [newState, setNewState] = useState('');
  const [newDurationDays, setNewDurationDays] = useState('3');
  const [newDurationNights, setNewDurationNights] = useState('2');
  const [newPrice, setNewPrice] = useState('4999');
  const [newCategory, setNewCategory] = useState('Popular');
  const [newThumbnail, setNewThumbnail] = useState('https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80');

  const fetchTours = async () => {
    try {
      const res = await api.listTours();
      const list = res.data || res.tours || [];
      setTours(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTours();
  }, []);

  const handleAddTour = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    try {
      const slug = newTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const payload = {
        tourId: slug || `tour-${Date.now()}`,
        title: newTitle,
        subtitle: `Curated ${newDurationDays} days experiential escape to ${newDestination || 'India'}`,
        category: newCategory,
        destination: newDestination || 'India',
        state: newState || newDestination,
        durationDays: parseInt(newDurationDays, 10) || 3,
        durationNights: parseInt(newDurationNights, 10) || 2,
        basePrice: parseFloat(newPrice) || 4999,
        thumbnail: newThumbnail,
        images: [newThumbnail],
        inclusions: [
          'AC Luxury Coach Travel (Return)',
          'Resort / Deluxe Tent Stay',
          'Daily Breakfast & Dinner',
          'Sightseeing & Entry Permits'
        ],
        exclusions: ['Personal Shopping', 'Emergency Expenses'],
        departureDates: [
          new Date(Date.now() + 5 * 24 * 3600 * 1000),
          new Date(Date.now() + 12 * 24 * 3600 * 1000)
        ],
        maxGroupSize: 30,
        isActive: true
      };

      await api.createTour(payload);
      setModalOpen(false);
      setNewTitle('');
      fetchTours();
    } catch (err) {
      alert(err.message || 'Failed to create tour package');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to deactivate this tour package?')) return;
    try {
      await api.deleteTour(id);
      fetchTours();
    } catch (err) {
      alert(err.message || 'Failed to deactivate tour');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Curated Escapes</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">Handpicked Tour Packages Manager</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time MongoDB tour catalog with accurate package pricing, dates, and inclusions.
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-purple-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Publish New Tour Package</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-slate-950 border border-slate-800 rounded-3xl h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tours.map((tour) => {
            const price = tour.basePrice != null ? tour.basePrice : 4999;
            const location = tour.destination && tour.state && tour.destination !== tour.state 
              ? `${tour.destination}, ${tour.state}` 
              : (tour.state || tour.destination || 'India');

            return (
              <div
                key={tour._id || tour.tourId}
                className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4 hover:border-slate-700 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                        {tour.category || 'Curated Escape'}
                      </span>
                      <h3 className="text-lg font-black text-white mt-1.5">{tour.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium mt-1">
                        <MapPin className="w-3.5 h-3.5 text-purple-400" />
                        <span>{location}</span>
                        <span>·</span>
                        <span>{tour.durationDays} Days / {tour.durationNights || tour.durationDays - 1} Nights</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(tour._id || tour.tourId)}
                      title="Deactivate Tour"
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-400 mt-2.5 line-clamp-2">
                    {tour.subtitle || 'All-inclusive experiential escape across India.'}
                  </p>

                  {/* Inclusions */}
                  <div className="pt-3 mt-3 border-t border-slate-800/80 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Package Inclusions</span>
                    {(tour.inclusions || []).slice(0, 3).map((inc, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                        <span>{inc}</span>
                      </div>
                    ))}
                  </div>

                  {/* Departure Dates Count */}
                  {tour.departureDates && tour.departureDates.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
                      <Calendar className="w-3.5 h-3.5 text-purple-400" />
                      <span>{tour.departureDates.length} upcoming scheduled departure{tour.departureDates.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-medium">Base Package Price</span>
                    <span className="text-xl font-black text-white">
                      ₹{price.toLocaleString()} <span className="text-xs text-slate-400 font-normal">/ traveler</span>
                    </span>
                  </div>
                  <span className="text-xs text-emerald-400 font-bold px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    Active in DB
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* New Tour Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white">Publish New Handpicked Tour</h3>
            
            <form onSubmit={handleAddTour} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Tour Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kaziranga Jungle Expedition"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Destination *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kaziranga"
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Assam"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Days</label>
                  <input
                    type="number"
                    value={newDurationDays}
                    onChange={(e) => setNewDurationDays(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Nights</label>
                  <input
                    type="number"
                    value={newDurationNights}
                    onChange={(e) => setNewDurationNights(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Price / Person (₹)</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Category Badge</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white"
                >
                  <option value="Popular">Popular</option>
                  <option value="Culture">Culture</option>
                  <option value="Best seller">Best seller</option>
                  <option value="Adventure">Adventure</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                >
                  Save & Publish to MongoDB
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
