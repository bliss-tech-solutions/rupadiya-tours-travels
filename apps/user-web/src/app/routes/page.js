'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  MapPin, 
  ArrowRight, 
  Bus, 
  Clock, 
  Calendar, 
  ChevronDown, 
  Sparkles, 
  ShieldCheck, 
  Compass, 
  SlidersHorizontal,
  CheckCircle2
} from 'lucide-react';
import { ROUTE_GROUPS, HUB_CITY, SPOKE_CITIES } from '../../lib/routes';
import { getLocalDateString } from '../../lib/dateUtils';
import { useLanguage } from '../../context/LanguageContext';

export default function RoutePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const todayIso = getLocalDateString(new Date());

  const [selectedRouteFilter, setSelectedRouteFilter] = useState('ALL'); // 'ALL' | 'route-1-gujarat' | ...
  const [selectedCityId, setSelectedCityId] = useState('');
  const [travelDate, setTravelDate] = useState(todayIso);

  const handleCitySelect = (cityId) => {
    router.push(`/search?from=rupadiya&to=${cityId}&date=${travelDate}`);
  };

  const handleDropdownChange = (e) => {
    const val = e.target.value;
    if (!val) return;
    if (val.startsWith('group:')) {
      setSelectedRouteFilter(val.replace('group:', ''));
    } else {
      setSelectedCityId(val);
      router.push(`/search?from=rupadiya&to=${val}&date=${travelDate}`);
    }
  };

  const displayedGroups = selectedRouteFilter === 'ALL'
    ? ROUTE_GROUPS
    : ROUTE_GROUPS.filter(g => g.id === selectedRouteFilter);

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20">
      {/* Top Banner / Hero Header */}
      <div className="bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-3">
                <Compass className="w-3.5 h-3.5 text-emerald-600" />
                <span>Intercity Corridors & Network</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">
                Route Network & Destinations
              </h1>
              <p className="text-sm sm:text-base text-slate-600 mt-2 max-w-2xl">
                Fixed hub-and-spoke corridor services connecting <strong>Rupadiya Central Hub</strong> to 16 major economic hubs across Gujarat, Saurashtra, South India, and Maharashtra / Goa.
              </p>
            </div>

            {/* SCREEN 2: "Rupadiya to (drop-down button)" */}
            <div className="w-full md:w-auto bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-xs">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-sky-600" />
                <span>Rupadiya to (drop-down button)</span>
              </label>

              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <div className="relative flex-1 sm:w-72">
                  <select
                    value={selectedCityId}
                    onChange={handleDropdownChange}
                    className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl bg-white border border-slate-300 text-slate-800 font-bold text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 cursor-pointer"
                  >
                    <option value="">Rupadiya to: Select Destination...</option>
                    
                    <optgroup label="── Filter By Region ──">
                      <option value="group:ALL">All Routes (16 Cities)</option>
                      {ROUTE_GROUPS.map(g => (
                        <option key={g.id} value={`group:${g.id}`}>
                          {g.name}
                        </option>
                      ))}
                    </optgroup>

                    {ROUTE_GROUPS.map(g => (
                      <optgroup key={g.id} label={`── ${g.name} ──`}>
                        {g.cities.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.state}) · ₹{c.baseFare}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <input
                  type="date"
                  min={todayIso}
                  value={travelDate}
                  onChange={(e) => setTravelDate(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-800 text-xs font-bold shadow-xs focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  title="Travel Date"
                />
              </div>
            </div>
          </div>

          {/* Region Tabs Toolbar */}
          <div className="mt-8 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              onClick={() => setSelectedRouteFilter('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                selectedRouteFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>All 4 Routes</span>
            </button>

            {ROUTE_GROUPS.map(g => {
              const active = selectedRouteFilter === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => setSelectedRouteFilter(g.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition shrink-0 cursor-pointer ${
                    active
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{g.name}</span>
                  <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] ${active ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-500'}`}>
                    {g.cities.length}
                  </span>
                </button>
              );
            })}
          </div>

        </div>
      </div>

      {/* Main Grid: Matches Image 2 "Screen 2 - Route page" Exactly */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {displayedGroups.map((group) => (
            <div
              key={group.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col hover:border-slate-300 transition duration-200"
            >
              {/* Card Header matching Screen 2 title styling */}
              <div className="p-6 pb-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-emerald-800 tracking-tight">
                    {group.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 font-medium">
                    Central Corridor from Rupadiya Hub
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                  {group.cities.length} Destination{group.cities.length > 1 ? 's' : ''}
                </span>
              </div>

              {/* Cities List */}
              <div className="p-6 pt-4 flex-1 divide-y divide-slate-100">
                {group.cities.map((city) => (
                  <div
                    key={city.id}
                    onClick={() => handleCitySelect(city.id)}
                    className="py-3.5 first:pt-2 last:pb-2 flex items-center justify-between group cursor-pointer hover:bg-slate-50/80 -mx-3 px-3 rounded-xl transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full bg-slate-300 group-hover:bg-emerald-600 transition-colors shrink-0" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-800 group-hover:text-emerald-700 transition-colors">
                            {city.name}
                          </span>
                          <span className="text-xs text-slate-500 font-semibold">
                            ({city.state})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium mt-0.5">
                          <span>~{city.distanceKm} km</span>
                          <span>•</span>
                          <span>{city.duration}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 block uppercase font-semibold">Base Fare</span>
                        <span className="text-sm font-bold text-slate-900">
                          ₹{city.baseFare.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-600 flex items-center justify-center transition shadow-2xs">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Card Footer Action */}
              <div className="p-4 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">
                  Daily Express Sleeper & Seater Coach
                </span>
                <button
                  onClick={() => handleCitySelect(group.cities[0].id)}
                  className="font-bold text-emerald-800 hover:text-emerald-900 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Book {group.name.split(' - ')[1] || 'Route'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom Trust & Corridor Explanation Card */}
        <div className="mt-12 bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold shrink-0">
                <Bus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Official Hub-and-Spoke</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Direct connections strictly between Rupadiya and authorized spoke terminals with verified fleet buses.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Tariff Governance</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Transparent base fares regulated by Rupadiya Transport Association across all 35 franchise operators.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Scheduled Departures</h4>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Guaranteed daily evening services with online passenger seat sheets and real-time boarding locks.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

