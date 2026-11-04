'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Bus, 
  Search, 
  ShieldCheck, 
  AlertTriangle, 
  RefreshCw, 
  CheckCircle2, 
  Plus,
  Edit3,
  Trash2,
  Phone,
  Building2,
  Calendar,
  Sparkles,
  X,
  CreditCard,
  User,
  Check,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';

const BUS_LAYOUT_PRESETS = [
  {
    type: 'AC Sleeper (2+1)',
    category: 'SLEEPER',
    seats: 36,
    layout: '2+1',
    isAc: true,
    title: 'AC Sleeper (2+1)',
    desc: '36 Berths Total · 18 Lower Deck + 18 Upper Deck (1 Single Left + 2 Double Right)'
  },
  {
    type: 'Non-AC Sleeper (2+1)',
    category: 'SLEEPER',
    seats: 36,
    layout: '2+1',
    isAc: false,
    title: 'Non-AC Sleeper (2+1)',
    desc: '36 Berths Total · 18 Lower Deck + 18 Upper Deck (1 Single Left + 2 Double Right)'
  },
  {
    type: 'AC Seater (2+2)',
    category: 'SEATER',
    seats: 40,
    layout: '2+2',
    isAc: true,
    title: 'AC Seater (2+2)',
    desc: '40 Seats Total · 10 Rows (2 Left + 2 Right Luxury Pushback Seater)'
  },
  {
    type: 'Non-AC Seater (2+2)',
    category: 'SEATER',
    seats: 40,
    layout: '2+2',
    isAc: false,
    title: 'Non-AC Seater (2+2)',
    desc: '40 Seats Total · 10 Rows (2 Left + 2 Right Express Seater)'
  }
];

const AVAILABLE_AMENITIES = [
  'Charging Point',
  'WiFi',
  'Reading Light',
  'GPS Tracking',
  'Water Bottle',
  'Blanket',
  'First Aid Box',
  'Emergency Exit'
];

export default function AdminFleetManagementPage() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL'); // 'ALL' | 'SLEEPER' | 'SEATER' | 'WARNINGS'
  const [companyFilter, setCompanyFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Modals
  const [inductModalOpen, setInductModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedBus, setSelectedBus] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Induct Form State
  const [formData, setFormData] = useState({
    busNumber: '',
    name: '',
    operatorName: 'Rupadiya Intercity Travels',
    companyCode: 1,
    busType: 'AC Sleeper (2+1)',
    driverName: '',
    driverPhone: '',
    driverLicense: '',
    driverAltPhone: '',
    amenities: ['Charging Point', 'WiFi', 'Reading Light', 'GPS Tracking', 'First Aid Box'],
    imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
  });

  const fetchFleet = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getFleet();
      if (res?.success) {
        setBuses(res.buses || []);
      } else {
        setError(res?.error || 'Failed to fetch fleet registry');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to fleet database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const handleInductSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        busNumber: formData.busNumber.trim().toUpperCase(),
        name: formData.name.trim(),
        operatorName: formData.operatorName.trim(),
        companyCode: Number(formData.companyCode),
        busType: formData.busType,
        driverDetails: {
          name: formData.driverName.trim() || 'Assigned Pilot',
          phone: formData.driverPhone.trim() || '+91 9876500000',
          licenseNumber: formData.driverLicense.trim() || 'DL-UP40-VALID',
          alternatePhone: formData.driverAltPhone.trim() || ''
        },
        amenities: formData.amenities,
        images: [formData.imageUrl || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80']
      };

      const res = await api.addBus(payload);
      if (res?.success) {
        setSuccessMsg(res.message || 'Coach successfully inducted into fleet!');
        setInductModalOpen(false);
        setFormData({
          busNumber: '',
          name: '',
          operatorName: 'Rupadiya Intercity Travels',
          companyCode: 1,
          busType: 'AC Sleeper (2+1)',
          driverName: '',
          driverPhone: '',
          driverLicense: '',
          driverAltPhone: '',
          amenities: ['Charging Point', 'WiFi', 'Reading Light', 'GPS Tracking', 'First Aid Box'],
          imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
        });
        fetchFleet();
      } else {
        setError(res?.error || 'Could not induct coach');
      }
    } catch (err) {
      setError(err.message || 'Error inducting coach');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBus) return;
    setSubmitting(true);
    setError('');

    try {
      const payload = {
        name: formData.name,
        operatorName: formData.operatorName,
        busType: formData.busType,
        companyCode: Number(formData.companyCode),
        driverDetails: {
          name: formData.driverName,
          phone: formData.driverPhone,
          licenseNumber: formData.driverLicense,
          alternatePhone: formData.driverAltPhone
        },
        amenities: formData.amenities,
        images: [formData.imageUrl]
      };

      const res = await api.updateBus(selectedBus._id, payload);
      if (res?.success) {
        setSuccessMsg(res.message || 'Coach details updated successfully!');
        setEditModalOpen(false);
        setSelectedBus(null);
        fetchFleet();
      } else {
        setError(res?.error || 'Failed to update coach');
      }
    } catch (err) {
      setError(err.message || 'Error updating coach');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCoach = async () => {
    if (!selectedBus) return;
    setSubmitting(true);
    setError('');

    try {
      const res = await api.deleteBus(selectedBus._id);
      if (res?.success) {
        setSuccessMsg(res.message || 'Coach decommissioned from fleet');
        setDeleteModalOpen(false);
        setSelectedBus(null);
        fetchFleet();
      } else {
        setError(res?.error || 'Failed to delete coach');
      }
    } catch (err) {
      setError(err.message || 'Error deleting coach');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (bus) => {
    setSelectedBus(bus);
    setFormData({
      busNumber: bus.busNumber || '',
      name: bus.name || '',
      operatorName: bus.operatorName || 'Rupadiya Intercity Travels',
      companyCode: bus.companyCode || 1,
      busType: bus.busType || 'AC Sleeper (2+1)',
      driverName: bus.driverDetails?.name || '',
      driverPhone: bus.driverDetails?.phone || '',
      driverLicense: bus.driverDetails?.licenseNumber || '',
      driverAltPhone: bus.driverDetails?.alternatePhone || '',
      amenities: bus.amenities || ['Charging Point', 'WiFi', 'Reading Light'],
      imageUrl: bus.images?.[0] || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
    });
    setEditModalOpen(true);
  };

  const toggleAmenity = (amenity) => {
    setFormData(prev => {
      const current = prev.amenities || [];
      if (current.includes(amenity)) {
        return { ...prev, amenities: current.filter(a => a !== amenity) };
      } else {
        return { ...prev, amenities: [...current, amenity] };
      }
    });
  };

  // Filter logic
  const filteredBuses = buses.filter(b => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = (
      b.busNumber?.toLowerCase().includes(q) ||
      b.name?.toLowerCase().includes(q) ||
      b.operatorName?.toLowerCase().includes(q) ||
      b.driverDetails?.name?.toLowerCase().includes(q) ||
      String(b.companyCode).includes(q)
    );

    if (!matchesSearch) return false;

    if (companyFilter !== 'ALL' && Number(b.companyCode) !== Number(companyFilter)) {
      return false;
    }

    if (categoryFilter === 'SLEEPER') {
      return (b.category === 'SLEEPER' || b.busType?.toLowerCase().includes('sleeper') || b.totalSeats === 36);
    }
    if (categoryFilter === 'SEATER') {
      return (b.category === 'SEATER' || b.busType?.toLowerCase().includes('seater') || b.totalSeats === 40);
    }
    if (categoryFilter === 'WARNINGS') {
      return !b.isCompliant;
    }

    return true;
  });

  const totalPages = Math.ceil(filteredBuses.length / ITEMS_PER_PAGE) || 1;
  const paginatedBuses = filteredBuses.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter, companyFilter]);

  const totalBuses = buses.length;
  const sleeperCount = buses.filter(b => b.totalSeats === 36 || b.category === 'SLEEPER' || b.busType?.toLowerCase().includes('sleeper')).length;
  const seaterCount = buses.filter(b => b.totalSeats === 40 || b.category === 'SEATER' || b.busType?.toLowerCase().includes('seater')).length;
  const warningCount = buses.filter(b => !b.isCompliant).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200/60">
            <Bus className="w-3.5 h-3.5" />
            <span>Master Fleet Authority</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Universal Fleet & Driver Registry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Standardized 36-berth Sleepers (2+1) and 40-seat Seaters (2+2) across all 33 franchise companies.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchFleet}
            className="px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/fleet/add"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Induct New Coach</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Active Fleet</span>
          <div className="text-2xl font-bold text-slate-900">{totalBuses} Coaches</div>
          <span className="text-[11px] text-slate-500 font-medium">Platform wide registry</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">36-Berth Sleepers</span>
          <div className="text-2xl font-bold text-sky-700">{sleeperCount} Coaches</div>
          <span className="text-[11px] text-slate-500 font-medium">18 Lower + 18 Upper (2+1)</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">40-Seat Seaters</span>
          <div className="text-2xl font-bold text-blue-700">{seaterCount} Coaches</div>
          <span className="text-[11px] text-slate-500 font-medium">10 Rows (2+2 Luxury)</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Compliance Warnings</span>
          <div className="text-2xl font-bold text-amber-700">{warningCount} Alerts</div>
          <span className="text-[11px] text-slate-500 font-medium">Papers expiring in 30 days</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            { key: 'ALL', label: `All Fleet (${totalBuses})` },
            { key: 'SLEEPER', label: `36 Sleepers (${sleeperCount})` },
            { key: 'SEATER', label: `40 Seaters (${seaterCount})` },
            { key: 'WARNINGS', label: `⚠️ Expiry Alerts (${warningCount})` }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setCategoryFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                categoryFilter === f.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <select
            value={companyFilter}
            onChange={(e) => setCompanyFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
          >
            <option value="ALL">All 33 Companies</option>
            {Array.from({ length: 33 }, (_, i) => i + 1).map(code => (
              <option key={code} value={code}>Company Code #{code.toString().padStart(2, '0')}</option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search plate, driver, model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 transition"
            />
          </div>
        </div>
      </div>

      {/* Fleet Cards Grid */}
      {filteredBuses.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3">
          <Bus className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">No buses found matching your criteria</h3>
          <p className="text-xs text-slate-500">Try modifying your search or click "Induct New Coach" to register a bus.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedBuses.map((bus) => {
              const isSleeper = bus.totalSeats === 36 || bus.category === 'SLEEPER' || bus.busType?.toLowerCase().includes('sleeper');
              const driver = bus.driverDetails || {};
              const imgUrl = bus.images?.[0] || 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80';

            return (
              <div
                key={bus._id}
                className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Bus Image Banner */}
                  <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
                    <img
                      src={imgUrl}
                      alt={bus.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-slate-900 font-mono font-bold text-xs shadow-sm border border-black/5">
                        {bus.busNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-bold text-[10px]">
                        Co. #{bus.companyCode}
                      </span>
                    </div>

                    <div className="absolute top-3 right-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        isSleeper ? 'bg-sky-100 text-sky-900' : 'bg-blue-100 text-blue-900'
                      }`}>
                        {isSleeper ? '36 Sleeper' : '40 Seater'}
                      </span>
                    </div>

                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <h3 className="text-base font-bold truncate">{bus.name}</h3>
                      <p className="text-xs text-slate-200 truncate">{bus.operatorName || 'Rupadiya Travels'}</p>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 space-y-4">
                    {/* Coach Layout Spec */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Configuration</span>
                        <span className="font-bold text-slate-900">
                          {isSleeper ? '36 Berths (18 Lower + 18 Upper)' : '40 Seats (10 Rows 2+2)'}
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${bus.isAc !== false ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                        {bus.isAc !== false ? 'AC Coach' : 'Non-AC'}
                      </span>
                    </div>

                    {/* Driver Card */}
                    <div className="p-3.5 rounded-2xl bg-blue-50/50 border border-blue-200/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-600" />
                          Assigned Pilot / Driver
                        </span>
                        {driver.licenseNumber && (
                          <span className="text-[10px] font-mono text-blue-800 bg-blue-100 px-1.5 py-0.2 rounded font-semibold">
                            {driver.licenseNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900">{driver.name || 'Assigned Driver'}</span>
                        {driver.phone && (
                          <a
                            href={`tel:${driver.phone}`}
                            className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 font-mono"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{driver.phone}</span>
                          </a>
                        )}
                      </div>
                    </div>

                    {/* Amenities Chips */}
                    <div className="flex flex-wrap gap-1.5">
                      {(bus.amenities || ['WiFi', 'Charging Point']).slice(0, 4).map((a, i) => (
                        <span key={i} className="px-2 py-0.5 bg-slate-100 rounded-lg text-[10px] font-semibold text-slate-600">
                          {a}
                        </span>
                      ))}
                      {(bus.amenities?.length || 0) > 4 && (
                        <span className="px-2 py-0.5 bg-slate-100 rounded-lg text-[10px] font-bold text-slate-400">
                          +{bus.amenities.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] font-bold">
                    {bus.isCompliant ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Compliant</span>
                      </span>
                    ) : (
                      <span className="text-amber-700 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span>Paper Alert</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(bus)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      title="Edit Coach Details"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => { setSelectedBus(bus); setDeleteModalOpen(true); }}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                      title="Decommission Coach"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* 10-Item Pagination Controls */}
        {filteredBuses.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filteredBuses.length)}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{filteredBuses.length}</strong> coaches
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition"
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
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </>
    )}

      {/* INDUCT COACH MODAL */}
      {inductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                  Fleet Induction
                </span>
                <h3 className="text-xl font-bold text-slate-900">Induct New Bus to Fleet</h3>
              </div>
              <button
                onClick={() => setInductModalOpen(false)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInductSubmit} className="space-y-5">
              {/* 1. Layout Preset Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">
                  1. Select Coach Layout Configuration *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BUS_LAYOUT_PRESETS.map((p) => {
                    const isSelected = formData.busType === p.type;
                    return (
                      <div
                        key={p.type}
                        onClick={() => setFormData({ ...formData, busType: p.type })}
                        className={`p-3.5 rounded-2xl border transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/80 border-blue-600 ring-2 ring-blue-600/20'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-slate-900">{p.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.category === 'SLEEPER' ? 'bg-sky-100 text-sky-900' : 'bg-blue-100 text-blue-900'
                          }`}>
                            {p.seats} Seats
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-tight">{p.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Franchise Company Assignment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Franchise Company Code *
                  </label>
                  <select
                    value={formData.companyCode}
                    onChange={(e) => setFormData({ ...formData, companyCode: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  >
                    {Array.from({ length: 33 }, (_, i) => i + 1).map(code => (
                      <option key={code} value={code}>Company Code #{code.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Registration Plate Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UP-40-BT-1010"
                    value={formData.busNumber}
                    onChange={(e) => setFormData({ ...formData, busNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* 3. Bus Service Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Coach / Service Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rupadiya Royal Sleeper"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Operator / Travels Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rupadiya Intercity Travels"
                    value={formData.operatorName}
                    onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* 4. Driver Information */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-3">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">
                  Assigned Pilot / Driver Profile
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-blue-950 block mb-1">Driver Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikram Yadav"
                      value={formData.driverName}
                      onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-blue-950 block mb-1">Driver Mobile Phone *</label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 9876500001"
                      value={formData.driverPhone}
                      onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-blue-950 block mb-1">Commercial Driving License *</label>
                    <input
                      type="text"
                      required
                      placeholder="DL-UP40-2016001"
                      value={formData.driverLicense}
                      onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value.toUpperCase() })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs font-mono font-semibold text-slate-900 uppercase focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-blue-950 block mb-1">Alternate / Emergency Contact</label>
                    <input
                      type="tel"
                      placeholder="+91 9876500011"
                      value={formData.driverAltPhone}
                      onChange={(e) => setFormData({ ...formData, driverAltPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
              </div>

              {/* 5. Amenities Multi-select */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-2">Coach Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_AMENITIES.map((amenity) => {
                    const active = (formData.amenities || []).includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => toggleAmenity(amenity)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                          active
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {active && <Check className="w-3.5 h-3.5" />}
                        <span>{amenity}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setInductModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Inducting Coach...' : 'Confirm Fleet Induction →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT COACH MODAL */}
      {editModalOpen && selectedBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block">
                  Modify Coach
                </span>
                <h3 className="text-xl font-bold text-slate-900">Edit {selectedBus.busNumber}</h3>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="p-2 rounded-full hover:bg-slate-100 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Coach / Service Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Operator Name</label>
                <input
                  type="text"
                  value={formData.operatorName}
                  onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200/80 space-y-3">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider block">Driver Details</span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-blue-950 block mb-1">Name</label>
                    <input
                      type="text"
                      value={formData.driverName}
                      onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs font-semibold text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-blue-950 block mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.driverPhone}
                      onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-blue-200 text-xs font-semibold text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteModalOpen && selectedBus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-4 shadow-2xl border border-slate-200 text-center">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Decommission Coach?</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to decommission coach <strong className="font-mono text-slate-900">{selectedBus.busNumber}</strong> from Company #{selectedBus.companyCode}? This will remove it from scheduling and ticketing.
            </p>
            <div className="pt-2 flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteCoach}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition"
              >
                {submitting ? 'Deleting...' : 'Confirm Decommission'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
