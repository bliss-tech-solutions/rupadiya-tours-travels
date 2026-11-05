'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Bus, 
  ShieldCheck, 
  User, 
  FileText, 
  Image as ImageIcon, 
  Sparkles, 
  Check, 
  Trash2,
  CheckCircle2,
  AlertCircle,
  Layers
} from 'lucide-react';
import { api } from '../../../lib/api';
import FileUploadProgress from '../../../components/FileUploadProgress';

const BUS_LAYOUT_PRESETS = [
  {
    type: 'AC Sleeper (2+1)',
    category: 'SLEEPER',
    seats: 36,
    layout: '2+1',
    isAc: true,
    title: 'AC Sleeper (2+1)',
    desc: '36 Berths Total · 18 Lower Deck + 18 Upper Deck (1 Left Single + 2 Right Double)'
  },
  {
    type: 'Non-AC Sleeper (2+1)',
    category: 'SLEEPER',
    seats: 36,
    layout: '2+1',
    isAc: false,
    title: 'Non-AC Sleeper (2+1)',
    desc: '36 Berths Total · 18 Lower Deck + 18 Upper Deck (1 Left Single + 2 Right Double)'
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
  'Air Conditioning',
  'Charging Point',
  'High-Speed WiFi',
  'Reading Light',
  'GPS Live Tracking',
  'Water Bottle',
  'Blanket & Pillow',
  'First Aid Box',
  'Emergency Exit'
];

function SteeringWheelIcon({ className = 'w-7 h-7 text-slate-400' }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <circle cx="12" cy="12" r="9.5" />
      <circle cx="12" cy="12" r="2.8" />
      <line x1="12" y1="2.5" x2="12" y2="9.2" />
      <line x1="4.5" y1="16.5" x2="9.6" y2="13.6" />
      <line x1="19.5" y1="16.5" x2="14.4" y2="13.6" />
    </svg>
  );
}

// Clean unfilled Sleeper Berth Card (Pure Layout Blueprint, No Fill / No Sold)
function SleeperBerthCard({ id, label }) {
  return (
    <div className="flex flex-col items-center select-none">
      <div
        title={`Berth ${id} (${label})`}
        className="w-11 sm:w-12 h-20 sm:h-22 rounded-xl flex flex-col justify-between p-1.5 transition border-2 border-emerald-600 bg-emerald-50/20 hover:bg-emerald-50/50 relative shadow-2xs cursor-default"
      >
        {/* Berth ID */}
        <span className="text-[10px] font-bold text-emerald-800 self-start leading-none">
          {id}
        </span>

        {/* Bottom Pillow Cushion Bar */}
        <div className="w-full h-2.5 rounded-sm bg-emerald-100/90 border border-emerald-200/80" />
      </div>

      {/* Label underneath */}
      <span className="text-[10px] mt-1 text-center font-medium text-slate-500 leading-none">
        {label || id}
      </span>
    </div>
  );
}

// Clean unfilled Seater Chair Card (Pure Layout Blueprint, No Fill / No Sold)
function SeaterChairCard({ id, label }) {
  return (
    <div className="flex flex-col items-center select-none">
      <div
        title={`Seat ${id} (${label})`}
        className="w-9 sm:w-10 h-13 sm:h-14 rounded-lg flex flex-col justify-between items-center p-1 transition border-2 border-emerald-600 bg-emerald-50/20 hover:bg-emerald-50/50 relative shadow-2xs cursor-default"
      >
        {/* Top Headrest Cushion */}
        <div className="w-5 h-1.5 rounded-full bg-emerald-100/90 border border-emerald-200/80" />

        {/* Seat Number in middle */}
        <span className="text-[10px] font-bold text-emerald-800 leading-none">
          {id}
        </span>

        {/* Subtle base bar */}
        <div className="w-full h-1 rounded-xs bg-emerald-100/60" />
      </div>

      {/* Label underneath */}
      <span className="text-[10px] mt-1 text-center font-medium text-slate-500 leading-none">
        {label || id}
      </span>
    </div>
  );
}

function FleetAddContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editBusId = searchParams.get('edit');

  const [loading, setLoading] = useState(Boolean(editBusId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form Fields
  const [busNumber, setBusNumber] = useState('');
  const [name, setName] = useState('');
  const [operatorName, setOperatorName] = useState('Rupadiya Intercity Travels');
  const [busType, setBusType] = useState('AC Sleeper (2+1)');
  const [totalSeats, setTotalSeats] = useState(36);
  const [layoutType, setLayoutType] = useState('2+1');
  const [status, setStatus] = useState('ACTIVE');
  const [amenities, setAmenities] = useState([
    'Charging Point',
    'High-Speed WiFi',
    'Reading Light',
    'Blanket & Pillow',
    'GPS Live Tracking'
  ]);

  // Driver Details
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [alternatePhone, setAlternatePhone] = useState('');

  // Images
  const [images, setImages] = useState([
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
  ]);

  // Documents
  const [rcUrl, setRcUrl] = useState('');
  const [insuranceUrl, setInsuranceUrl] = useState('');
  const [fitnessUrl, setFitnessUrl] = useState('');

  // Load existing bus if editing
  useEffect(() => {
    if (!editBusId) return;

    async function loadBusForEdit() {
      setLoading(true);
      setError('');
      try {
        const res = await api.getFleet();
        if (res?.buses) {
          const found = res.buses.find(b => String(b._id) === editBusId || String(b.id) === editBusId);
          if (found) {
            setBusNumber(found.busNumber || '');
            setName(found.name || '');
            setOperatorName(found.operatorName || 'Rupadiya Intercity Travels');
            setBusType(found.busType || 'AC Sleeper (2+1)');
            setTotalSeats(found.totalSeats || 36);
            setLayoutType(found.layoutType || '2+1');
            setStatus(found.status || 'ACTIVE');
            if (Array.isArray(found.amenities) && found.amenities.length > 0) {
              setAmenities(found.amenities);
            }
            if (found.driverDetails) {
              setDriverName(found.driverDetails.name || '');
              setDriverPhone(found.driverDetails.phone || '');
              setDriverLicense(found.driverDetails.licenseNumber || '');
              setAlternatePhone(found.driverDetails.alternatePhone || '');
            }
            if (Array.isArray(found.images) && found.images.length > 0) {
              setImages(found.images);
            }
            if (found.documents) {
              setRcUrl(found.documents.rcUrl || '');
              setInsuranceUrl(found.documents.insuranceUrl || '');
              setFitnessUrl(found.documents.fitnessUrl || '');
            }
          } else {
            setError('Bus not found in your company fleet roster.');
          }
        }
      } catch (err) {
        setError(err.message || 'Failed to load bus for editing');
      } finally {
        setLoading(false);
      }
    }

    loadBusForEdit();
  }, [editBusId]);

  const handleSelectPreset = (preset) => {
    setBusType(preset.type);
    setTotalSeats(preset.seats);
    setLayoutType(preset.layout);
  };

  const toggleAmenity = (item) => {
    setAmenities(prev => 
      prev.includes(item) ? prev.filter(a => a !== item) : [...prev, item]
    );
  };

  const handleAddImage = (url) => {
    if (url && !images.includes(url)) {
      setImages(prev => [...prev, url]);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    setImages(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!busNumber.trim()) return setError('Please provide valid coach vehicle registration number.');
    if (!name.trim()) return setError('Please provide coach model display name.');

    setSubmitting(true);
    try {
      const payload = {
        busNumber: busNumber.trim().toUpperCase(),
        name: name.trim(),
        operatorName: operatorName.trim() || 'Rupadiya Intercity Travels',
        busType,
        totalSeats: Number(totalSeats),
        layoutType,
        amenities,
        driverDetails: {
          name: driverName.trim() || 'Assigned Fleet Pilot',
          phone: driverPhone.trim() || '+91 0000000000',
          licenseNumber: driverLicense.trim() || 'DL-UP40-COMMERCIAL',
          alternatePhone: alternatePhone.trim() || ''
        },
        managerContact: {
          name: driverName.trim() || 'Operations Dispatch',
          phone: driverPhone.trim() || '+91 0000000000'
        },
        images: images.length > 0 ? images : [
          'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
        ],
        documents: {
          rcUrl: rcUrl || null,
          insuranceUrl: insuranceUrl || null,
          fitnessUrl: fitnessUrl || null
        },
        status
      };

      let res;
      if (editBusId) {
        res = await api.updateBus(editBusId, payload);
      } else {
        res = await api.addBus(payload);
      }

      if (res?.success) {
        setSuccess(editBusId 
          ? `Coach ${payload.busNumber} updated successfully! Redirecting...`
          : `Coach ${payload.busNumber} successfully inducted into your fleet! Redirecting...`);
        setTimeout(() => {
          router.push('/fleet');
        }, 1200);
      } else {
        setError(res?.error || 'Failed to save coach details');
      }
    } catch (err) {
      setError(err.message || 'Network error saving bus details');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-500 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold">Retrieving Coach Credentials...</span>
      </div>
    );
  }

  const isSleeper = busType.includes('Sleeper') || layoutType === '2+1';

  // Sleeper Berth Generation (18 Lower + 18 Upper = 36 Total)
  const lowerRows = Array.from({ length: 6 }, (_, idx) => {
    const single = `L${idx * 3 + 1}`;
    const double1 = `L${idx * 3 + 2}`;
    const double2 = `L${idx * 3 + 3}`;
    return { single, double1, double2, rowIndex: idx };
  });

  const upperRows = Array.from({ length: 6 }, (_, idx) => {
    const single = `U${idx * 3 + 1}`;
    const double1 = `U${idx * 3 + 2}`;
    const double2 = `U${idx * 3 + 3}`;
    return { single, double1, double2, rowIndex: idx };
  });

  // Seater Rows Generation (10 rows x 4 seats = 40 Total)
  const seaterRows = Array.from({ length: 10 }, (_, idx) => {
    const s1 = `S${idx * 4 + 1}`;
    const s2 = `S${idx * 4 + 2}`;
    const s3 = `S${idx * 4 + 3}`;
    const s4 = `S${idx * 4 + 4}`;
    return { s1, s2, s3, s4, rowIndex: idx };
  });

  return (
    <div className="w-full space-y-6 pb-16">
      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/fleet"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Fleet Roster</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
              {editBusId ? 'Edit Fleet Coach' : 'Fleet Induction'}
            </span>
            <span className="text-xs text-slate-400 font-normal">· Clean Architectural Blueprint</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight mt-1">
            {editBusId ? `Edit Coach — ${busNumber || 'Vehicle'}` : 'Induct New Long-Haul Coach'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-normal">
            Configure coach seating layout blueprint, commercial driver credentials, AWS S3 photos, and compliance certificates.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/fleet"
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs shadow-xs transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Coach...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{editBusId ? 'Update Coach Details' : 'Induct Coach to Fleet'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Responsive 2-Column Grid: Form Inputs on Left, Pure Blueprint Layout on Right */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* Left Column (6 Cols on XL): Coach Specifications, Driver, Documents & Photos */}
        <div className="xl:col-span-6 space-y-6">
          
          {/* 1. Layout Preset Selection */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">1. Standardized Seating Layout Blueprint</h2>
                <p className="text-[11px] text-slate-500">Choose between standardized 36-berth sleeper or 40-seat coach configurations.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {BUS_LAYOUT_PRESETS.map((preset) => {
                const isSelected = busType === preset.type;
                return (
                  <div
                    key={preset.type}
                    onClick={() => handleSelectPreset(preset)}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition relative flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-slate-900">{preset.title}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {preset.seats} {preset.category === 'SLEEPER' ? 'Berths' : 'Seats'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug font-normal">{preset.desc}</p>
                    </div>
                    <div className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-blue-700">
                      {isSelected ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                          <span>Active Layout</span>
                        </>
                      ) : (
                        <span className="text-slate-400">Click to switch layout</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Coach Specifications & Identification */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                <Bus className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">2. Coach Registration & Identity</h2>
                <p className="text-[11px] text-slate-500">Government registration plate number and brand display name.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Registration Plate Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. UP-40-BT-1001"
                  value={busNumber}
                  onChange={(e) => setBusNumber(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold uppercase focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Coach Model & Brand *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BharatBenz 1624 Sleeper (2025)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Operator Display Name</label>
                <input
                  type="text"
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="Rupadiya Intercity Travels"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Operational Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium bg-white focus:ring-1 focus:ring-blue-600 focus:outline-none"
                >
                  <option value="ACTIVE">ACTIVE (Dispatched in Schedules)</option>
                  <option value="MAINTENANCE">MAINTENANCE (Temporarily Grounded)</option>
                  <option value="INACTIVE">INACTIVE (Deregistered)</option>
                </select>
              </div>
            </div>

            {/* Passenger Amenities */}
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-700 mb-2">On-Board Passenger Amenities</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {AVAILABLE_AMENITIES.map((amenity) => {
                  const active = amenities.includes(amenity);
                  return (
                    <button
                      type="button"
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`p-2 rounded-xl text-xs font-medium transition flex items-center gap-2 cursor-pointer border ${
                        active
                          ? 'border-blue-600 bg-blue-50/60 text-blue-800'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                        active ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {active && <Check className="w-2.5 h-2.5" />}
                      </div>
                      <span className="truncate">{amenity}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. Driver Coordinates */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">3. Lead Driver & Pilot Assignment</h2>
                <p className="text-[11px] text-slate-500">Commercial heavy vehicle driver contact details for manifests.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Lead Driver Name</label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="e.g. Vikram Singh"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Driver Phone Number</label>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+91 0000000000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Commercial License Number</label>
                <input
                  type="text"
                  value={driverLicense}
                  onChange={(e) => setDriverLicense(e.target.value.toUpperCase())}
                  placeholder="e.g. DL-UP40-201800123"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium uppercase focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Alternate / Emergency Phone</label>
                <input
                  type="tel"
                  value={alternatePhone}
                  onChange={(e) => setAlternatePhone(e.target.value)}
                  placeholder="+91 9123456789"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-1 focus:ring-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* 4. Coach Photo Gallery  */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">4. Coach Photos (AWS S3 Upload)</h2>
                <p className="text-[11px] text-slate-500">Exterior coach view and cabin photos displayed on booking portal.</p>
              </div>
            </div>

            <FileUploadProgress
              label="Upload Coach Photo (PNG, JPG, WEBP)"
              folder="fleet-buses"
              accept="image/*"
              fileUrl=""
              onUploadComplete={(url) => handleAddImage(url)}
              onRemove={() => {}}
            />

            {images.length > 0 && (
              <div className="space-y-2 pt-2">
                <span className="text-xs font-semibold text-slate-700">Active Coach Photos ({images.length})</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((imgUrl, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-video">
                      <img src={imgUrl} alt={`Bus ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition shadow-xs hover:bg-rose-700 cursor-pointer"
                        title="Remove Photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {idx === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 bg-blue-600 text-white text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded shadow">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5. Bus Documents Compliance  */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900">5. Vehicle Compliance & Legal Documents</h2>
                <p className="text-[11px] text-slate-500">Upload RC Certificate, Commercial Insurance, and Fitness Certificate.</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <span className="text-xs font-semibold text-slate-800">Vehicle Registration Certificate (RC)</span>
                <FileUploadProgress
                  label="Upload RC Document (PDF / Image)"
                  folder="fleet-docs/rc"
                  fileUrl={rcUrl}
                  onUploadComplete={(url) => setRcUrl(url)}
                  onRemove={() => setRcUrl('')}
                />
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <span className="text-xs font-semibold text-slate-800">Commercial Passenger Insurance Policy</span>
                <FileUploadProgress
                  label="Upload Insurance Document (PDF / Image)"
                  folder="fleet-docs/insurance"
                  fileUrl={insuranceUrl}
                  onUploadComplete={(url) => setInsuranceUrl(url)}
                  onRemove={() => setInsuranceUrl('')}
                />
              </div>

              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                <span className="text-xs font-semibold text-slate-800">State Transport Fitness Certificate</span>
                <FileUploadProgress
                  label="Upload Fitness Cert (PDF / Image)"
                  folder="fleet-docs/fitness"
                  fileUrl={fitnessUrl}
                  onUploadComplete={(url) => setFitnessUrl(url)}
                  onRemove={() => setFitnessUrl('')}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column (6 Cols on XL): Pure Coach Layout Blueprint (No Fill / No Sold Seats) */}
        <div className="xl:col-span-6 xl:sticky xl:top-6 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs space-y-5">
            
            {/* Header: Title & Total Capacity */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 block">
                  Coach Floor Plan Blueprint
                </span>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  {busType}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-normal">
                  {isSleeper ? 'Lower & Upper Deck side-by-side chassis layout' : '40-Seat luxury pushback coach blueprint'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                  {totalSeats} {isSleeper ? 'Berths Total' : 'Seats Total'}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200">
                  Layout Blueprint
                </span>
              </div>
            </div>

            {/* Clean Blueprint Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-4.5 rounded-xs border-2 border-emerald-600 bg-white flex flex-col justify-end p-0.5">
                    <div className="w-full h-1 bg-emerald-100 rounded-2xs" />
                  </div>
                  <span className="text-slate-600 font-medium text-[11px]">
                    {isSleeper ? 'Sleeper Berth' : 'Pushback Seat'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <SteeringWheelIcon className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-600 font-medium text-[11px]">Driver Pilot</span>
                </div>

                <div className="flex items-center gap-1 text-slate-500 font-medium text-[11px]">
                  <span>Emergency Exit</span>
                  <span>◀</span>
                </div>
              </div>

              <span className="text-[11px] text-slate-400 font-normal">
                {isSleeper ? '18 Lower + 18 Upper Decks' : '10 Rows (2+2 Layout)'}
              </span>
            </div>

            {/* Blueprint Chassis Content */}
            {isSleeper ? (
              /* ==========================================================
                 SLEEPER BLUEPRINT: Side-by-Side Lower Deck & Upper Deck
                 Pure Layout: All 36 Berths Unfilled, Numbered & Labelled
                 ========================================================== */
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 items-start bg-slate-50/50 p-3 sm:p-4 rounded-2xl border border-slate-200/80">
                
                {/* 1. LOWER DECK CHASSIS */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col">
                  {/* Top Header: 'Lower deck' title on Left, Steering Wheel on Right */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 tracking-tight">Lower deck</h4>
                      <span className="text-[10px] text-slate-400 font-normal">18 Berths (L1 - L18)</span>
                    </div>
                    <SteeringWheelIcon className="w-8 h-8 text-slate-400 shrink-0" />
                  </div>

                  {/* Lower Deck Berths Layout */}
                  <div className="flex items-start justify-between gap-1 sm:gap-2">
                    
                    {/* Left Column: 1 Single Berth per row (6 rows) */}
                    <div className="flex flex-col gap-3.5">
                      {lowerRows.map((row) => (
                        <SleeperBerthCard
                          key={row.single}
                          id={row.single}
                          label="Single"
                        />
                      ))}
                    </div>

                    {/* Center Aisle with Vertical Emergency Exit */}
                    <div className="flex-1 flex flex-col items-center justify-center self-stretch py-4 select-none">
                      <div className="flex items-center gap-1.5 [writing-mode:vertical-rl] rotate-180 text-[9px] text-slate-400 font-medium tracking-widest">
                        <span>Emergency Exit</span>
                        <span className="text-[8px]">◀</span>
                      </div>
                    </div>

                    {/* Right Column: 2 Double Berths per row (6 rows) */}
                    <div className="flex flex-col gap-3.5">
                      {lowerRows.map((row) => (
                        <div key={row.rowIndex} className="flex items-center gap-2">
                          <SleeperBerthCard
                            id={row.double1}
                            label="Aisle"
                          />
                          <SleeperBerthCard
                            id={row.double2}
                            label="Window"
                          />
                        </div>
                      ))}
                    </div>

                  </div>
                </div>

                {/* 2. UPPER DECK CHASSIS */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col">
                  {/* Top Header: 'Upper deck' title on Left */}
                  <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 tracking-tight">Upper deck</h4>
                      <span className="text-[10px] text-slate-400 font-normal">18 Berths (U1 - U18)</span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                      Upper Deck
                    </span>
                  </div>

                  {/* Upper Deck Berths Layout */}
                  <div className="flex items-start justify-between gap-1 sm:gap-2">
                    
                    {/* Left Column: 1 Single Berth per row (6 rows) */}
                    <div className="flex flex-col gap-3.5">
                      {upperRows.map((row) => (
                        <SleeperBerthCard
                          key={row.single}
                          id={row.single}
                          label="Single"
                        />
                      ))}
                    </div>

                    {/* Center Aisle with Vertical Emergency Exit */}
                    <div className="flex-1 flex flex-col items-center justify-center self-stretch py-4 select-none">
                      <div className="flex items-center gap-1.5 [writing-mode:vertical-rl] rotate-180 text-[9px] text-slate-400 font-medium tracking-widest">
                        <span>Emergency Exit</span>
                        <span className="text-[8px]">◀</span>
                      </div>
                    </div>

                    {/* Right Column: 2 Double Berths per row (6 rows) */}
                    <div className="flex flex-col gap-3.5">
                      {upperRows.map((row) => (
                        <div key={row.rowIndex} className="flex items-center gap-2">
                          <SleeperBerthCard
                            id={row.double1}
                            label="Aisle"
                          />
                          <SleeperBerthCard
                            id={row.double2}
                            label="Window"
                          />
                        </div>
                      ))}
                    </div>

                  </div>
                </div>

              </div>
            ) : (
              /* ==========================================================
                 SEATER BLUEPRINT: 40 Pushback Seats (10 Rows x 2+2)
                 Pure Layout: All 40 Seats Unfilled, Numbered & Labelled
                 ========================================================== */
              <div className="bg-slate-50/50 p-4 sm:p-5 rounded-2xl border border-slate-200/80 max-w-xl mx-auto">
                <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col space-y-4">
                  
                  {/* Front Cabin: Passenger Door on Left, Steering Wheel on Right */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium">
                      <span>🚪 Passenger Entry Door</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Driver Cabin</span>
                      <SteeringWheelIcon className="w-8 h-8 text-slate-400 shrink-0" />
                    </div>
                  </div>

                  {/* 10 Rows of 2+2 Pushback Seats */}
                  <div className="space-y-3">
                    <div className="text-[10px] font-medium text-slate-400 flex items-center justify-between px-2">
                      <span>Left Window & Aisle (2x)</span>
                      <span>Aisle</span>
                      <span>Right Aisle & Window (2x)</span>
                    </div>

                    {seaterRows.map((row) => (
                      <div key={row.rowIndex} className="flex items-center justify-between gap-2 sm:gap-4">
                        {/* Left 2 Seats */}
                        <div className="flex items-center gap-2">
                          <SeaterChairCard
                            id={row.s1}
                            label="Window"
                          />
                          <SeaterChairCard
                            id={row.s2}
                            label="Aisle"
                          />
                        </div>

                        {/* Center Aisle */}
                        <div className="flex-1 flex flex-col items-center justify-center select-none text-[9px] text-slate-300 font-bold">
                          {row.rowIndex === 4 ? (
                            <div className="flex items-center gap-1 [writing-mode:vertical-rl] rotate-180 text-[8px] text-slate-400 tracking-wider">
                              <span>Emergency Exit</span>
                              <span>◀</span>
                            </div>
                          ) : (
                            <span>·</span>
                          )}
                        </div>

                        {/* Right 2 Seats */}
                        <div className="flex items-center gap-2">
                          <SeaterChairCard
                            id={row.s3}
                            label="Aisle"
                          />
                          <SeaterChairCard
                            id={row.s4}
                            label="Window"
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Rear Emergency Exit Window */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-medium">
                    <span>Rear Coach Engine</span>
                    <span className="text-rose-600 flex items-center gap-1 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" /> Emergency SOS Window
                    </span>
                  </div>

                </div>
              </div>
            )}

            {/* Coach Summary Box */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200/80 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Registration Plate:</span>
                <span className="text-slate-900 font-bold">{busNumber || 'UP40-XXXX'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Coach Model:</span>
                <span className="text-slate-900 font-semibold">{name || 'Intercity Coach'}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span className="font-medium">Seating Capacity:</span>
                <span className="text-emerald-700 font-bold">
                  {isSleeper ? '36 Berths Total (18 Lower + 18 Upper)' : '40 Pushback Seats Total (10 Rows 2+2)'}
                </span>
              </div>
            </div>

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Coach Details...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{editBusId ? 'Update Coach Details' : 'Induct Coach Into Fleet'}</span>
                </>
              )}
            </button>

          </div>
        </div>

      </form>
    </div>
  );
}

export default function CompanyFleetAddOrEditPage() {
  return (
    <Suspense fallback={
      <div className="py-24 text-center text-slate-500 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-semibold">Loading Coach Form...</span>
      </div>
    }>
      <FleetAddContent />
    </Suspense>
  );
}
