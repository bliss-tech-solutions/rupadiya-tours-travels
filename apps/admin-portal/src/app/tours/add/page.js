'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Compass, 
  MapPin, 
  Calendar, 
  Clock, 
  DollarSign, 
  Sparkles, 
  Plus, 
  Trash2, 
  Check, 
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Utensils
} from 'lucide-react';
import { api } from '../../../lib/api';
import FileUploadProgress from '../../../components/FileUploadProgress';

const TOUR_CATEGORIES = [
  'Pilgrimage & Spiritual',
  'Heritage & Culture',
  'Wildlife & Safari',
  'Himalayan Adventure',
  'Leisure & Scenic',
  'Popular Gateway'
];

export default function AddTourPackagePage() {
  const router = useRouter();

  // Basic Info
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [category, setCategory] = useState('Pilgrimage & Spiritual');
  const [destination, setDestination] = useState('');
  const [state, setState] = useState('Uttar Pradesh');
  const [durationDays, setDurationDays] = useState(3);
  const [durationNights, setDurationNights] = useState(2);
  const [maxGroupSize, setMaxGroupSize] = useState(30);

  // Pricing
  const [basePrice, setBasePrice] = useState(4999);
  const [childPrice, setChildPrice] = useState(3499);

  // Departure Dates
  const [departureDates, setDepartureDates] = useState([
    new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0],
    new Date(Date.now() + 14 * 24 * 3600 * 1000).toISOString().split('T')[0]
  ]);
  const [newDateInput, setNewDateInput] = useState('');

  // Day-by-Day Itinerary
  const [itinerary, setItinerary] = useState([
    {
      day: 1,
      title: 'Arrival & Boarding from Rupadiya Hub',
      description: 'Morning pickup by AC Luxury Coach. Scenic countryside transit with refreshing breakfast and tea break. Evening check-in at destination hotel.',
      meals: ['Breakfast', 'Dinner']
    },
    {
      day: 2,
      title: 'Guided Heritage & Sightseeing Exploration',
      description: 'Full day sightseeing tour with certified local guide. Visit ancient shrines, architectural marvels, and authentic cultural bazaars.',
      meals: ['Breakfast', 'Lunch', 'Dinner']
    },
    {
      day: 3,
      title: 'Morning Spiritual Darshan & Return Journey',
      description: 'Early morning temple darshan / river Aarti. Post-breakfast return journey to Rupadiya Hub with memorable journey moments.',
      meals: ['Breakfast']
    }
  ]);

  // Inclusions & Exclusions
  const [inclusions, setInclusions] = useState([
    'AC Luxury Coach Transportation (Return)',
    'Resort / Deluxe Heritage Hotel Accommodation',
    'Daily Buffet Breakfast and Gourmet Dinner',
    'Guided Sightseeing & Monument Entry Passes',
    'Toll Taxes, State Permits and Driver Allowances'
  ]);
  const [newInclusion, setNewInclusion] = useState('');

  const [exclusions, setExclusions] = useState([
    'Personal Shopping, Laundry and Alcoholic Beverages',
    'Emergency Medical or Evacuation Expenses',
    'Any camera/video charges levied by monuments'
  ]);
  const [newExclusion, setNewExclusion] = useState('');

  // Media
  const [thumbnail, setThumbnail] = useState(
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
  );
  const [images, setImages] = useState([
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
  ]);

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Departure Date Handlers
  const handleAddDepartureDate = () => {
    if (newDateInput && !departureDates.includes(newDateInput)) {
      setDepartureDates([...departureDates, newDateInput]);
      setNewDateInput('');
    }
  };

  const handleRemoveDepartureDate = (dateToRemove) => {
    setDepartureDates(departureDates.filter(d => d !== dateToRemove));
  };

  // Itinerary Handlers
  const handleAddItineraryDay = () => {
    const nextDayNum = itinerary.length + 1;
    setItinerary([
      ...itinerary,
      {
        day: nextDayNum,
        title: `Day ${nextDayNum} Sightseeing & Experiences`,
        description: 'Guided excursion to local landmarks, scenic viewpoints, and authentic experiences.',
        meals: ['Breakfast', 'Dinner']
      }
    ]);
  };

  const handleRemoveItineraryDay = (indexToRemove) => {
    const updated = itinerary.filter((_, idx) => idx !== indexToRemove)
      .map((item, idx) => ({ ...item, day: idx + 1 }));
    setItinerary(updated);
  };

  const handleUpdateItineraryField = (index, field, value) => {
    const updated = [...itinerary];
    updated[index][field] = value;
    setItinerary(updated);
  };

  const handleToggleMeal = (dayIndex, mealName) => {
    const day = { ...itinerary[dayIndex] };
    const meals = day.meals || [];
    if (meals.includes(mealName)) {
      day.meals = meals.filter(m => m !== mealName);
    } else {
      day.meals = [...meals, mealName];
    }
    const updated = [...itinerary];
    updated[dayIndex] = day;
    setItinerary(updated);
  };

  // Inclusions & Exclusions Handlers
  const handleAddInclusion = () => {
    if (newInclusion.trim()) {
      setInclusions([...inclusions, newInclusion.trim()]);
      setNewInclusion('');
    }
  };

  const handleRemoveInclusion = (idx) => {
    setInclusions(inclusions.filter((_, i) => i !== idx));
  };

  const handleAddExclusion = () => {
    if (newExclusion.trim()) {
      setExclusions([...exclusions, newExclusion.trim()]);
      setNewExclusion('');
    }
  };

  const handleRemoveExclusion = (idx) => {
    setExclusions(exclusions.filter((_, i) => i !== idx));
  };

  // Media Handlers
  const handleAddTourImage = (url) => {
    if (url && !images.includes(url)) {
      setImages([...images, url]);
      if (!thumbnail) setThumbnail(url);
    }
  };

  const handleRemoveTourImage = (idx) => {
    setImages(images.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Tour package title is required');
      return;
    }
    if (!destination.trim()) {
      setError('Destination city or region is required');
      return;
    }

    setSubmitting(true);
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const payload = {
        tourId: slug || `tour-${Date.now()}`,
        title: title.trim(),
        subtitle: subtitle.trim() || `Curated ${durationDays} days experiential escape to ${destination}`,
        category,
        destination: destination.trim(),
        state: state.trim() || destination.trim(),
        durationDays: Number(durationDays),
        durationNights: Number(durationNights),
        basePrice: Number(basePrice),
        childPrice: Number(childPrice),
        maxGroupSize: Number(maxGroupSize),
        thumbnail: thumbnail || images[0],
        images: images.length > 0 ? images : [thumbnail],
        departureDates: departureDates.map(d => new Date(d)),
        itinerary,
        inclusions,
        exclusions,
        isActive: true
      };

      const res = await api.createTour(payload);
      if (res?.success || res?.tour || res?.data) {
        router.push('/tours');
      } else {
        setError(res?.error || 'Failed to create tour package');
      }
    } catch (err) {
      setError(err.message || 'Error occurred while publishing tour');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-blue-100 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/tours"
              className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition"
              title="Back to Tours"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-200">
                  Tour Package Builder
                </span>
                <span className="text-xs text-slate-400 font-medium">· Dedicated Publisher</span>
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Create & Publish Curated Tour
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/tours"
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing Tour...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Publish Package</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-bold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (7 Cols): Tour Details Form */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* 1. Core Package Metadata */}
            <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Package Title & Categorization</h2>
                  <p className="text-xs text-slate-400">Destination, category, duration, and marketing hook</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Package Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ayodhya Ram Mandir & Varanasi Ganga Aarti Spiritual Trail"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Subtitle / Teaser Summary
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3 Days of transcendent spirituality, luxury travel, and sacred darshan"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-blue-600"
                  >
                    {TOUR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Destination City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ayodhya & Varanasi"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    State / Territory
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Uttar Pradesh"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Duration (Days)</label>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={durationDays}
                    onChange={(e) => setDurationDays(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Duration (Nights)</label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    value={durationNights}
                    onChange={(e) => setDurationNights(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Max Group Size</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={maxGroupSize}
                    onChange={(e) => setMaxGroupSize(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* 2. Pricing & Commercials */}
            <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Package Pricing & Passenger Tariff</h2>
                  <p className="text-xs text-slate-400">All-inclusive per-passenger fare breakdown</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                  <span className="text-[11px] font-bold text-emerald-900 uppercase">Adult Base Fare (₹)</span>
                  <input
                    type="number"
                    min="500"
                    step="50"
                    required
                    value={basePrice}
                    onChange={(e) => setBasePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-emerald-300 text-lg font-bold text-emerald-900 focus:outline-none focus:border-emerald-600"
                  />
                  <span className="text-[10px] text-emerald-700 block font-medium">Standard adult per-head tariff</span>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/50 border border-blue-200 space-y-2">
                  <span className="text-[11px] font-bold text-blue-900 uppercase">Child Fare (5-12 Years) (₹)</span>
                  <input
                    type="number"
                    min="0"
                    step="50"
                    value={childPrice}
                    onChange={(e) => setChildPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-blue-300 text-lg font-bold text-blue-900 focus:outline-none focus:border-blue-600"
                  />
                  <span className="text-[10px] text-blue-700 block font-medium">Discounted seat tariff for children</span>
                </div>
              </div>
            </div>

            {/* 3. Scheduled Departure Dates */}
            <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Upcoming Departure Dates</h2>
                  <p className="text-xs text-slate-400">Available fixed-departure dates for this curated escape</p>
                </div>
              </div>

              <div className="flex gap-2">
                <input
                  type="date"
                  value={newDateInput}
                  onChange={(e) => setNewDateInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-blue-600"
                />
                <button
                  type="button"
                  onClick={handleAddDepartureDate}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Date</span>
                </button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {departureDates.map((dateStr, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-bold flex items-center gap-2"
                  >
                    <span>{new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDepartureDate(dateStr)}
                      className="text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Day-by-Day Itinerary Builder */}
            <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Day-by-Day Journey Itinerary</h2>
                    <p className="text-xs text-slate-400">Step-by-step itinerary schedule with meal inclusions</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddItineraryDay}
                  className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs border border-purple-200 flex items-center gap-1 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Day</span>
                </button>
              </div>

              <div className="space-y-4">
                {itinerary.map((dayItem, index) => (
                  <div key={index} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-0.5 rounded-full bg-blue-600 text-white font-mono font-bold text-[10px] uppercase">
                        Day {dayItem.day}
                      </span>
                      {itinerary.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItineraryDay(index)}
                          className="text-rose-600 hover:text-rose-700 text-xs font-bold flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Day Title</label>
                      <input
                        type="text"
                        value={dayItem.title}
                        onChange={(e) => handleUpdateItineraryField(index, 'title', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-700 block mb-1">Activities & Excursions</label>
                      <textarea
                        rows={2}
                        value={dayItem.description}
                        onChange={(e) => handleUpdateItineraryField(index, 'description', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    {/* Meal Inclusions */}
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1">
                        <Utensils className="w-3 h-3 text-amber-600" />
                        <span>Included Meals for Day {dayItem.day}</span>
                      </span>
                      <div className="flex gap-2">
                        {['Breakfast', 'Lunch', 'Dinner'].map((meal) => {
                          const hasMeal = (dayItem.meals || []).includes(meal);
                          return (
                            <button
                              key={meal}
                              type="button"
                              onClick={() => handleToggleMeal(index, meal)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition ${
                                hasMeal
                                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {hasMeal ? `✓ ${meal}` : `+ ${meal}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 5. Inclusions & Exclusions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Inclusions */}
              <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  What is Included
                </h3>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. AC Sleeper Coach Travel"
                    value={newInclusion}
                    onChange={(e) => setNewInclusion(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddInclusion}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1.5 pt-1">
                  {inclusions.map((item, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-emerald-50 text-emerald-900 text-xs flex items-center justify-between">
                      <span className="truncate">✓ {item}</span>
                      <button type="button" onClick={() => handleRemoveInclusion(idx)} className="text-emerald-700 hover:text-rose-600 ml-2">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exclusions */}
              <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                  What is Excluded
                </h3>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. Personal Expenses"
                    value={newExclusion}
                    onChange={(e) => setNewExclusion(e.target.value)}
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-blue-600"
                  />
                  <button
                    type="button"
                    onClick={handleAddExclusion}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 text-white font-bold text-xs"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-1.5 pt-1">
                  {exclusions.map((item, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-rose-50 text-rose-900 text-xs flex items-center justify-between">
                      <span className="truncate">✕ {item}</span>
                      <button type="button" onClick={() => handleRemoveExclusion(idx)} className="text-rose-700 hover:text-rose-900 ml-2">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 6. Photos & Thumbnail with AWS S3 Upload */}
            <div className="bg-white rounded-3xl border border-blue-100 p-6 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Tour Photos & Hero Cover</h2>
                  <p className="text-xs text-slate-400">High-resolution gallery pictures uploaded to S3 storage</p>
                </div>
              </div>

              <FileUploadProgress
                label="Upload Tour Scenic Photo"
                description="Upload destination or itinerary attraction photo (PNG, JPG, WEBP)"
                folder="tour-photos"
                accept="image/*"
                fileUrl=""
                onUploadComplete={(url) => handleAddTourImage(url)}
                onRemove={() => {}}
              />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                {images.map((img, idx) => (
                  <div key={idx} className="relative group rounded-2xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                    <img src={img} alt={`Tour preview ${idx + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => setThumbnail(img)}
                        className="px-2 py-1 rounded bg-blue-600 text-white text-[10px] font-bold"
                      >
                        Set Cover
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTourImage(idx)}
                        className="p-1 rounded bg-rose-600 text-white"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {thumbnail === img && (
                      <span className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded shadow">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column (5 Cols): Live Package Summary Preview Card */}
          <div className="lg:col-span-5 sticky top-24 space-y-6">
            <div className="bg-white rounded-3xl border border-blue-200/80 p-6 shadow-lg shadow-blue-500/5 space-y-5">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Live Package Preview
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200">
                  {category}
                </span>
              </div>

              {/* Cover Card Preview */}
              <div className="rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 relative aspect-video">
                <img
                  src={thumbnail || images[0]}
                  alt="Tour cover"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="text-base font-bold truncate">{title || 'Tour Package Title'}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-200 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>{destination || 'Destination'}, {state}</span>
                    <span>·</span>
                    <span>{durationDays}D / {durationNights}N</span>
                  </div>
                </div>
              </div>

              {/* Price Details */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 font-bold">Base Adult Fare:</span>
                  <span className="text-xl font-bold text-blue-900">₹{basePrice.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Child Fare:</span>
                  <span className="font-bold text-slate-800">₹{childPrice.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Departures:</span>
                  <span className="font-bold text-slate-800">{departureDates.length} Upcoming Dates</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Itinerary:</span>
                  <span className="font-bold text-slate-800">{itinerary.length} Days Planned</span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white font-bold text-sm shadow-xl shadow-blue-500/20 transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Publishing Tour Package...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Publish Tour Package</span>
                  </>
                )}
              </button>

            </div>
          </div>

        </form>
      </div>
    </div>
  );
}

