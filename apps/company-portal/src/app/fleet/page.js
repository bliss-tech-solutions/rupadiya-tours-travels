'use client';

import React, { useState, useEffect } from 'react';
import { 
  Bus, 
  Plus, 
  ShieldCheck, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  Phone, 
  User, 
  Trash2,
  Edit,
  X,
  CreditCard,
  Image as ImageIcon,
  Check,
  Building2,
  Layers,
  Sparkles
} from 'lucide-react';
import { api } from '../../lib/api';

const BUS_LAYOUT_OPTIONS = [
  {
    type: 'AC Sleeper (2+1)',
    category: 'SLEEPER',
    isAc: true,
    totalSeats: 36,
    layoutType: '2+1',
    label: 'AC Sleeper (2+1)',
    badge: '36 Berths · 2+1 Upper/Lower',
    desc: 'Upper & Lower decks · 1 Left Single + 2 Right Double berths'
  },
  {
    type: 'Non-AC Sleeper (2+1)',
    category: 'SLEEPER',
    isAc: false,
    totalSeats: 36,
    layoutType: '2+1',
    label: 'Non-AC Sleeper (2+1)',
    badge: '36 Berths · 2+1 Upper/Lower',
    desc: 'Upper & Lower decks · 1 Left Single + 2 Right Double berths'
  },
  {
    type: 'AC Seater (2+2)',
    category: 'SEATER',
    isAc: true,
    totalSeats: 40,
    layoutType: '2+2',
    label: 'AC Seater (2+2)',
    badge: '40 Seats · 2+2 Coach',
    desc: '10 Rows · 2 Left + Aisle + 2 Right Pushback Seats'
  },
  {
    type: 'Non-AC Seater (2+2)',
    category: 'SEATER',
    isAc: false,
    totalSeats: 40,
    layoutType: '2+2',
    label: 'Non-AC Seater (2+2)',
    badge: '40 Seats · 2+2 Coach',
    desc: '10 Rows · 2 Left + Aisle + 2 Right Standard Coach Seats'
  }
];

const AVAILABLE_AMENITIES = [
  'Air Conditioning',
  'High-Speed WiFi',
  'Charging Point',
  'Blanket & Pillow',
  'Reading Light',
  'Water Bottle',
  'GPS Live Tracking',
  'Emergency Exit'
];

const DEFAULT_DUMMY_IMAGES = [
  'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=800&auto=format&fit=crop&q=80'
];

export default function CompanyFleetPage() {
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBusId, setEditingBusId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    busNumber: '',
    name: '',
    operatorName: 'Rupadiya Intercity Travels',
    busType: 'AC Sleeper (2+1)',
    totalSeats: 36,
    layoutType: '2+1',
    driverName: 'Vikram Singh',
    driverPhone: '9876543210',
    driverLicense: 'DL-UP40-201800123',
    alternatePhone: '9876543211',
    amenities: ['Charging Point', 'Reading Light', 'Blanket', 'Water Bottle'],
    status: 'ACTIVE'
  });

  const fetchFleet = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getFleet();
      if (res?.success) {
        setBuses(res.buses || []);
      } else {
        setError(res?.error || 'Failed to fetch fleet roster');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to fleet records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
  }, []);

  const openAddModal = () => {
    setEditingBusId(null);
    setFormData({
      busNumber: '',
      name: '',
      operatorName: 'Rupadiya Intercity Travels',
      busType: 'AC Sleeper (2+1)',
      totalSeats: 36,
      layoutType: '2+1',
      driverName: 'Vikram Singh',
      driverPhone: '9876543210',
      driverLicense: 'DL-UP40-201800123',
      alternatePhone: '9876543211',
      amenities: ['Charging Point', 'Reading Light', 'Blanket', 'Water Bottle'],
      status: 'ACTIVE'
    });
    setError('');
    setActionSuccess('');
    setModalOpen(true);
  };

  const openEditModal = (bus) => {
    setEditingBusId(bus._id || bus.id);
    setFormData({
      busNumber: bus.busNumber || '',
      name: bus.name || '',
      operatorName: bus.operatorName || 'Rupadiya Intercity Travels',
      busType: bus.busType || 'AC Sleeper (2+1)',
      totalSeats: bus.totalSeats || 36,
      layoutType: bus.layoutType || '2+1',
      driverName: bus.driverDetails?.name || bus.managerContact?.name || '',
      driverPhone: bus.driverDetails?.phone || bus.managerContact?.phone || '',
      driverLicense: bus.driverDetails?.licenseNumber || '',
      alternatePhone: bus.driverDetails?.alternatePhone || '',
      amenities: bus.amenities || [],
      status: bus.status || 'ACTIVE'
    });
    setError('');
    setActionSuccess('');
    setModalOpen(true);
  };

  const handleLayoutSelect = (opt) => {
    setFormData(prev => ({
      ...prev,
      busType: opt.type,
      totalSeats: opt.totalSeats,
      layoutType: opt.layoutType
    }));
  };

  const toggleAmenity = (item) => {
    setFormData(prev => {
      const exists = prev.amenities.includes(item);
      return {
        ...prev,
        amenities: exists 
          ? prev.amenities.filter(a => a !== item)
          : [...prev.amenities, item]
      };
    });
  };

  const handleSaveBus = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setActionSuccess('');

    try {
      const payload = {
        busNumber: formData.busNumber.trim().toUpperCase(),
        name: formData.name.trim(),
        operatorName: formData.operatorName.trim() || 'Rupadiya Intercity Travels',
        busType: formData.busType,
        totalSeats: formData.totalSeats,
        layoutType: formData.layoutType,
        amenities: formData.amenities,
        driverDetails: {
          name: formData.driverName.trim(),
          phone: formData.driverPhone.trim(),
          licenseNumber: formData.driverLicense.trim(),
          alternatePhone: formData.alternatePhone.trim()
        },
        managerContact: {
          name: formData.driverName.trim(),
          phone: formData.driverPhone.trim()
        },
        images: DEFAULT_DUMMY_IMAGES,
        status: formData.status
      };

      let res;
      if (editingBusId) {
        res = await api.updateBus(editingBusId, payload);
      } else {
        res = await api.addBus(payload);
      }

      if (res?.success) {
        setActionSuccess(editingBusId 
          ? `Coach ${payload.busNumber} updated successfully.`
          : `Coach ${payload.busNumber} inducted successfully into your fleet.`);
        setTimeout(() => {
          setModalOpen(false);
          setActionSuccess('');
          fetchFleet();
        }, 1000);
      } else {
        setError(res?.error || 'Failed to save bus details');
      }
    } catch (err) {
      setError(err.message || 'Error saving bus details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBus = async (bus) => {
    if (!confirm(`Are you sure you want to remove bus ${bus.busNumber} (${bus.name}) from your active fleet?`)) return;
    try {
      const res = await api.deleteBus(bus._id || bus.id);
      if (res?.success) {
        setActionSuccess(`Bus ${bus.busNumber} removed.`);
        fetchFleet();
      } else {
        setError(res?.error || 'Failed to delete bus');
      }
    } catch (err) {
      setError(err.message || 'Error deleting bus');
    }
  };

  const sleeperCount = buses.filter(b => b.busType?.toLowerCase().includes('sleeper') || b.layoutType === '2+1').length;
  const seaterCount = buses.filter(b => b.busType?.toLowerCase().includes('seater') || b.layoutType === '2+2').length;

  return (
    <div className="w-full space-y-6">
      {/* Top Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1">
            Company Fleet & Driver Roster
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Manage Fleet & Travels</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your standardized 36-seat sleeper and 40-seat seater coaches, driver credentials, and operations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchFleet}
            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600 transition cursor-pointer"
            title="Refresh Fleet"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-2 shadow-xs cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>+ Induct New Bus</span>
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Total Fleet</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">{buses.length} Coaches</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">36-Seat Sleepers</span>
          <span className="text-xl font-bold text-emerald-700 mt-1 block">{sleeperCount} Buses (2+1)</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">40-Seat Seaters</span>
          <span className="text-xl font-bold text-blue-700 mt-1 block">{seaterCount} Buses (2+2)</span>
        </div>
        <div className="bg-white border border-slate-200/80 p-4 rounded-xl shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 block">Active Status</span>
          <span className="text-xl font-bold text-purple-700 mt-1 block">
            {buses.filter(b => b.status === 'ACTIVE').length} Ready
          </span>
        </div>
      </div>

      {/* Fleet Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2">
          <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
          <span className="text-xs font-medium">Loading fleet roster...</span>
        </div>
      ) : buses.length === 0 ? (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-12 text-center text-slate-500 shadow-xs space-y-3">
          <Bus className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="text-base font-bold text-slate-900">No buses in company fleet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Induct your first 36-seat sleeper or 40-seat seater coach to schedule passenger routes.
          </p>
          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
          >
            + Induct First Bus
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {buses.map((bus) => {
            const isSleeper = bus.busType?.toLowerCase().includes('sleeper') || bus.layoutType === '2+1';
            const driver = bus.driverDetails || bus.managerContact || {};
            const thumbImg = (bus.images && bus.images.length > 0) ? bus.images[0] : DEFAULT_DUMMY_IMAGES[0];

            return (
              <div
                key={bus._id || bus.id}
                className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition flex flex-col justify-between"
              >
                <div>
                  {/* Photo Header */}
                  <div className="h-32 bg-slate-100 relative overflow-hidden">
                    <img 
                      src={thumbImg} 
                      alt={bus.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />
                    
                    <div className="absolute top-2.5 left-2.5">
                      <span className="px-2 py-0.5 rounded bg-white/95 text-slate-900 font-mono font-bold text-xs tracking-wider shadow-xs">
                        {bus.busNumber}
                      </span>
                    </div>

                    <div className="absolute top-2.5 right-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        bus.status === 'ACTIVE'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-amber-500 text-white'
                      }`}>
                        {bus.status || 'ACTIVE'}
                      </span>
                    </div>

                    <div className="absolute bottom-2 left-2.5 right-2.5 text-white">
                      <div className="text-[11px] font-semibold text-white/80">{bus.operatorName || 'Rupadiya Travels'}</div>
                      <h3 className="text-sm font-bold truncate">{bus.name}</h3>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3 text-xs">
                    {/* Layout Specification */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-200/60">
                      <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-blue-600" />
                        {bus.busType}
                      </span>
                      <span className="font-bold text-slate-900 px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px]">
                        {isSleeper ? '36 Berths (2+1)' : '40 Seats (2+2)'}
                      </span>
                    </div>

                    {/* Driver Information */}
                    <div className="space-y-1.5 pt-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assigned Driver</div>
                      <div className="flex items-center justify-between text-slate-800">
                        <span className="font-bold flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          {driver.name || 'Assigned Driver'}
                        </span>
                        <a href={`tel:${driver.phone}`} className="text-blue-600 hover:underline font-mono text-[11px] flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {driver.phone || '+91 9876543210'}
                        </a>
                      </div>
                      {driver.licenseNumber && (
                        <div className="text-[10px] font-mono text-slate-500">
                          License: <strong className="text-slate-700">{driver.licenseNumber}</strong>
                        </div>
                      )}
                    </div>

                    {/* Amenities Chips */}
                    {bus.amenities?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {bus.amenities.slice(0, 4).map((a, i) => (
                          <span key={i} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
                            {a}
                          </span>
                        ))}
                        {bus.amenities.length > 4 && (
                          <span className="text-[10px] text-slate-400 font-bold px-1 py-0.5">
                            +{bus.amenities.length - 4} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-medium">
                    RC: Verified Active
                  </span>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(bus)}
                      className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDeleteBus(bus)}
                      className="p-1.5 rounded-lg bg-white hover:bg-rose-50 border border-slate-200 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                      title="Delete Bus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* INDUCT / EDIT BUS MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-xl rounded-2xl p-6 sm:p-7 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Bus className="w-5 h-5 text-blue-600" />
                  <span>{editingBusId ? 'Edit Coach Information' : 'Induct New Coach into Fleet'}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select standardized sleeper/seater layout and enter vehicle & driver details.
                </p>
              </div>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBus} className="space-y-4 text-xs">
              {/* 1. SELECT BUS LAYOUT TYPE (Sleeper 36 vs Seater 40) */}
              <div className="space-y-2">
                <label className="text-slate-800 font-bold block">1. Select Coach Layout Type *</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {BUS_LAYOUT_OPTIONS.map((opt) => {
                    const isSelected = formData.busType === opt.type;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => handleLayoutSelect(opt)}
                        className={`p-3 rounded-xl border text-left transition flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/70 border-blue-500 text-slate-900 ring-1 ring-blue-500'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-xs">{opt.label}</span>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                        </div>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded self-start mb-1">
                          {opt.badge}
                        </span>
                        <span className="text-[10px] text-slate-500">{opt.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. BUS DETAILS */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-slate-800 font-bold block">2. Coach & Travels Identification</label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 font-medium block mb-1">Registration / Plate Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="UP-40-BT-1009"
                      value={formData.busNumber}
                      onChange={(e) => setFormData({ ...formData, busNumber: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 uppercase font-mono font-bold focus:outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-medium block mb-1">Bus Model / Service Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rupadiya Royal Express"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-600 font-medium block mb-1">Operator / Travels Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rupadiya Intercity Travels"
                    value={formData.operatorName}
                    onChange={(e) => setFormData({ ...formData, operatorName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              {/* 3. DRIVER & CREW DETAILS */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-slate-800 font-bold block">3. Driver & Crew Information</label>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 font-medium block mb-1">Primary Driver Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Vikram Singh"
                      value={formData.driverName}
                      onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-medium block mb-1">Driver Phone Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="9876543210"
                      value={formData.driverPhone}
                      onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-600 font-medium block mb-1">Driving License Number</label>
                    <input
                      type="text"
                      placeholder="DL-UP40-201800123"
                      value={formData.driverLicense}
                      onChange={(e) => setFormData({ ...formData, driverLicense: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 uppercase font-mono focus:outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 font-medium block mb-1">Conductor / Alternate Phone</label>
                    <input
                      type="tel"
                      placeholder="9876543211"
                      value={formData.alternatePhone}
                      onChange={(e) => setFormData({ ...formData, alternatePhone: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* 4. AMENITIES */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-slate-800 font-bold block">4. Passenger Amenities</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_AMENITIES.map((item) => {
                    const active = formData.amenities.includes(item);
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => toggleAmenity(item)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
                          active
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {item} {active ? '✓' : '+'}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 5. DUMMY IMAGES NOTE */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
                <ImageIcon className="w-5 h-5 text-slate-400 shrink-0" />
                <div className="text-[11px] text-slate-500">
                  <strong className="text-slate-800">Photos Attached:</strong> Standard HD coach exterior & interior photos are automatically linked for passenger app browsing.
                </div>
              </div>

              {/* ACTION BUTTONS */}
              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                >
                  {submitting ? 'Saving...' : editingBusId ? 'Update Coach →' : 'Induct Coach →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
