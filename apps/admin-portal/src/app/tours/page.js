'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Compass, Plus, Trash2, MapPin, CheckCircle2, Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../lib/api';

const ITEMS_PER_PAGE = 10;

export default function AdminToursPage() {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
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

  const totalPages = Math.ceil(tours.length / ITEMS_PER_PAGE) || 1;
  const paginatedTours = tours.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

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
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Compass className="w-3.5 h-3.5" />
            <span>Curated Escapes</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">Handpicked Tour Packages Manager</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time MongoDB tour catalog with accurate package pricing, dates, and inclusions.
          </p>
        </div>

        <Link
          href="/tours/add"
          className="px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-md shadow-blue-500/20 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Publish New Tour Package</span>
        </Link>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="bg-white border border-slate-200/90 rounded-3xl h-64 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {paginatedTours.map((tour) => {
            const price = tour.basePrice != null ? tour.basePrice : 4999;
            const location = tour.destination && tour.state && tour.destination !== tour.state 
              ? `${tour.destination}, ${tour.state}` 
              : (tour.state || tour.destination || 'India');

            return (
              <div
                key={tour._id || tour.tourId}
                className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 hover:border-blue-200 transition flex flex-col justify-between shadow-xs"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded">
                        {tour.category || 'Curated Escape'}
                      </span>
                      <h3 className="text-lg font-black text-slate-900 mt-1.5">{tour.title}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>{location}</span>
                        <span>·</span>
                        <span>{tour.durationDays} Days / {tour.durationNights || tour.durationDays - 1} Nights</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(tour._id || tour.tourId)}
                      title="Deactivate Tour"
                      className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-xs text-slate-500 mt-2.5 line-clamp-2">
                    {tour.subtitle || 'All-inclusive experiential escape across India.'}
                  </p>

                  {/* Inclusions */}
                  <div className="pt-3 mt-3 border-t border-slate-100 space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Package Inclusions</span>
                    {(tour.inclusions || []).slice(0, 3).map((inc, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                        <span>{inc}</span>
                      </div>
                    ))}
                  </div>

                  {/* Departure Dates Count */}
                  {tour.departureDates && tour.departureDates.length > 0 && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 pt-2">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>{tour.departureDates.length} upcoming scheduled departure{tour.departureDates.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-medium">Base Package Price</span>
                    <span className="text-xl font-black text-slate-900">
                      ₹{price.toLocaleString()} <span className="text-xs text-slate-500 font-normal">/ traveler</span>
                    </span>
                  </div>
                  <span className="text-xs text-emerald-700 font-bold px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200">
                    Active in DB
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 10-Item Pagination Controls */}
        {tours.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, tours.length)}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{tours.length}</strong> tour packages
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl font-bold transition ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </>
    )}

      {/* New Tour Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Publish New Handpicked Tour</h3>
            
            <form onSubmit={handleAddTour} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Tour Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kaziranga Jungle Expedition"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Destination *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kaziranga"
                    value={newDestination}
                    onChange={(e) => setNewDestination(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Assam"
                    value={newState}
                    onChange={(e) => setNewState(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Days</label>
                  <input
                    type="number"
                    value={newDurationDays}
                    onChange={(e) => setNewDurationDays(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Nights</label>
                  <input
                    type="number"
                    value={newDurationNights}
                    onChange={(e) => setNewDurationNights(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Price / Person (₹)</label>
                  <input
                    type="number"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Category Badge</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900"
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-md shadow-blue-500/20"
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
