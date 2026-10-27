'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Compass, 
  Clock, 
  MapPin, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../lib/api';

export default function ToursListPage() {
  const [tours, setTours] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.listTours();
        // res.data or res.tours
        const data = res.data || res.tours || [];
        setTours(data);
      } catch (err) {
        console.error('Failed to load tours:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20">
      {/* Hero Header */}
      <section className="bg-white border-b border-slate-200 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 text-sky-700 text-xs font-bold uppercase tracking-wider">
            <Compass className="w-3.5 h-3.5" />
            <span>Handpicked Experiential Tours</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold text-slate-900 tracking-tight">
            Discover Curated Escapes Across India
          </h1>
          <p className="text-sm sm:text-base text-slate-500 max-w-2xl mx-auto">
            From the white salt deserts of Kutch to the heritage palaces of Udaipur and the sun-soaked shores of Goa — luxury coach transit, curated stays, and local experiences included.
          </p>
        </div>
      </section>

      {/* Tours Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(n => (
              <div key={n} className="bg-white rounded-3xl h-96 animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {tours.map((tour) => {
              const tourImage = tour.thumbnail || tour.coverImage || tour.images?.[0] || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80';
              const price = tour.basePrice != null ? tour.basePrice.toLocaleString() : (tour.pricePerPerson || '4,999');
              const badge = tour.category || tour.badge || 'Curated Escape';
              const location = tour.destination && tour.state && tour.destination !== tour.state 
                ? `${tour.destination}, ${tour.state}` 
                : (tour.state || tour.destination || 'India');
              const tourLink = `/tours/${tour.tourId || tour._id}`;

              return (
                <div
                  key={tour._id || tour.tourId}
                  className="bg-white rounded-3xl overflow-hidden border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col group"
                >
                  {/* Tour Banner */}
                  <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
                    <img
                      src={tourImage}
                      alt={tour.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-4 left-4 text-xs font-bold px-3 py-1 rounded-full bg-slate-950 text-white shadow-md">
                      {badge}
                    </span>
                    <span className="absolute bottom-3 right-3 text-xs font-bold px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-md text-slate-800">
                      {tour.durationDays} Days / {tour.durationNights || tour.durationDays - 1} Nights
                    </span>
                  </div>

                  {/* Tour Details */}
                  <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 font-semibold mb-2">
                        <MapPin className="w-3.5 h-3.5 text-sky-500" />
                        <span>{location}</span>
                      </div>

                      <h3 className="text-xl font-bold text-slate-900 group-hover:text-sky-600 transition">
                        {tour.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-1.5 leading-relaxed">
                        {tour.subtitle || tour.shortDescription || tour.description}
                      </p>
                    </div>

                    {/* Inclusions summary */}
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      {tour.inclusions && tour.inclusions.length > 0 ? (
                        tour.inclusions.slice(0, 3).map((inc, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="truncate max-w-[120px]">{inc}</span>
                          </span>
                        ))
                      ) : (
                        <>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> AC Bus
                          </span>
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Hotel Stay
                          </span>
                        </>
                      )}
                    </div>

                    {/* Price & Book */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] text-slate-400 block font-medium">Starting from</span>
                        <div className="text-2xl font-bold text-slate-900">
                          ₹{price} <span className="text-xs font-normal text-slate-500">/person</span>
                        </div>
                      </div>

                      <Link
                        href={tourLink}
                        className="px-5 py-2.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-xs shadow-md shadow-sky-500/20 transition active:scale-95 flex items-center gap-1.5"
                      >
                        <span>Explore</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
