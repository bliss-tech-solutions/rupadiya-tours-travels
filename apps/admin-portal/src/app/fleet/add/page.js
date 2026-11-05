'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  'Charging Point',
  'WiFi',
  'Reading Light',
  'GPS Tracking',
  'Water Bottle',
  'Blanket',
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

export default function AddFleetCoachPage() {
  const router = useRouter();

  // Basic Details
  const [busNumber, setBusNumber] = useState('');
  const [name, setName] = useState('');
  const [operatorName, setOperatorName] = useState('Rupadiya Intercity Travels');
  const [companyCode, setCompanyCode] = useState(1);
  const [busType, setBusType] = useState('AC Sleeper (2+1)');
  const [makeModel, setMakeModel] = useState('BharatBenz / Volvo 9600 (2025)');

  // Driver Details
  const [driverName, setDriverName] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [driverLicense, setDriverLicense] = useState('');
  const [driverAltPhone, setDriverAltPhone] = useState('');

  // Amenities
  const [amenities, setAmenities] = useState([
    'Charging Point',
    'WiFi',
    'Reading Light',
    'GPS Tracking',
    'First Aid Box'
  ]);

  // Documents
  const [rcNumber, setRcNumber] = useState('');
  const [rcExpiry, setRcExpiry] = useState('2028-12-31');
  const [rcFileUrl, setRcFileUrl] = useState('');

  const [insurancePolicy, setInsurancePolicy] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('2027-06-30');
  const [insuranceFileUrl, setInsuranceFileUrl] = useState('');

  const [fitnessExpiry, setFitnessExpiry] = useState('2027-08-31');
  const [fitnessFileUrl, setFitnessFileUrl] = useState('');

  const [permitExpiry, setPermitExpiry] = useState('2027-10-31');
  const [permitFileUrl, setPermitFileUrl] = useState('');

  // Images
  const [images, setImages] = useState([
    'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
  ]);

  // Form State
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isSleeper = busType.toLowerCase().includes('sleeper');

  const toggleAmenity = (item) => {
    if (amenities.includes(item)) {
      setAmenities(amenities.filter((a) => a !== item));
    } else {
      setAmenities([...amenities, item]);
    }
  };

  const handleAddCoachImage = (url) => {
    if (url && !images.includes(url)) {
      setImages([...images, url]);
    }
  };

  const handleRemoveCoachImage = (indexToRemove) => {
    setImages(images.filter((_, idx) => idx !== indexToRemove));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!busNumber.trim()) {
      setError('Bus registration plate number is required (e.g. UP40-AT-7890)');
      return;
    }
    if (!name.trim()) {
      setError('Coach display name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        busNumber: busNumber.trim().toUpperCase(),
        name: name.trim(),
        operatorName: operatorName.trim(),
        companyCode: Number(companyCode),
        busType,
        driverDetails: {
          name: driverName.trim() || 'Assigned Fleet Pilot',
          phone: driverPhone.trim() || '+91 0000000000',
          licenseNumber: driverLicense.trim() || 'DL-UP40-COMMERCIAL',
          alternatePhone: driverAltPhone.trim() || ''
        },
        amenities,
        images: images.length > 0 ? images : [
          'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
        ],
        documents: {
          rcNumber: rcNumber.trim() || `RC-${busNumber.trim().toUpperCase()}`,
          rcExpiry: rcExpiry ? new Date(rcExpiry) : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          rcFileUrl: rcFileUrl || null,
          insurancePolicy: insurancePolicy.trim() || 'INS-NATIONAL-COMMERCIAL',
          insuranceExpiry: insuranceExpiry ? new Date(insuranceExpiry) : new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          insuranceFileUrl: insuranceFileUrl || null,
          fitnessCert: fitnessExpiry ? new Date(fitnessExpiry) : new Date(Date.now() + 240 * 24 * 60 * 60 * 1000),
          fitnessFileUrl: fitnessFileUrl || null,
          permitExpiry: permitExpiry ? new Date(permitExpiry) : new Date(Date.now() + 300 * 24 * 60 * 60 * 1000),
          permitFileUrl: permitFileUrl || null
        }
      };

      const res = await api.addBus(payload);
      if (res?.success) {
        router.push('/fleet');
      } else {
        setError(res?.error || 'Failed to induct coach into fleet registry');
      }
    } catch (err) {
      setError(err.message || 'Error occurred while saving coach');
    } finally {
      setSubmitting(false);
    }
  };

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

  const totalBerthsOrSeats = isSleeper ? 36 : 40;

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-slate-200/80 shadow-xs sticky top-0 z-30">
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/fleet"
              className="p-2 rounded-xl bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition"
              title="Back to Fleet"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold uppercase tracking-wider border border-blue-200">
                  Fleet Registration
                </span>
                <span className="text-xs text-slate-400 font-normal">· Clean Architectural Blueprint</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                Induct New Intercity Coach
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/fleet"
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </Link>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition cursor-pointer disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Coach...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Induct Coach to Fleet</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
          
          {/* Left Column (6 Cols on XL): Form Fields, Driver, Documents & Photos */}
          <div className="xl:col-span-6 space-y-6">
            
            {/* 1. Coach Core Identification */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Bus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Coach Specifications & Identity</h2>
                  <p className="text-xs text-slate-400">Registration plate, company allotment, and coach model</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Registration Plate Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. UP40-AT-7890"
                    value={busNumber}
                    onChange={(e) => setBusNumber(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-bold uppercase text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Official RTO Registration Number</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Coach Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rupadiya Royal Sleeper #04"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Brand or fleet identifier</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Assigned Fleet Company Code <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={companyCode}
                    onChange={(e) => setCompanyCode(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  >
                    {Array.from({ length: 33 }, (_, i) => i + 1).map((num) => (
                      <option key={num} value={num}>
                        Company #{num} (Rupadiya Operations Unit {num})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-slate-400 mt-1 block">Allotted to one of the 33 franchise companies</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Operator Brand Name
                  </label>
                  <input
                    type="text"
                    value={operatorName}
                    onChange={(e) => setOperatorName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">Operating entity label</span>
                </div>
              </div>

              {/* Layout Preset Selector */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-2">
                  Select Bus Seating Layout & Configuration <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {BUS_LAYOUT_PRESETS.map((p) => {
                    const isSelected = busType === p.type;
                    return (
                      <div
                        key={p.type}
                        onClick={() => setBusType(p.type)}
                        className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-slate-900">{p.title}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {p.seats} {p.category === 'SLEEPER' ? 'Berths' : 'Seats'}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-snug">{p.desc}</p>
                        </div>
                        <div className="mt-2.5 flex items-center gap-1.5 text-[10px] font-semibold text-blue-700">
                          {isSelected ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                              <span>Active Blueprint</span>
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

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                  Make, Chassis & Model Year
                </label>
                <input
                  type="text"
                  placeholder="e.g. BharatBenz 1624 Sleeper / Scania Metrolink (2025)"
                  value={makeModel}
                  onChange={(e) => setMakeModel(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* 2. Driver & Pilot Details */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center font-bold">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Lead Driver & Pilot Assignment</h2>
                  <p className="text-xs text-slate-400">Driver contact, commercial driving license, and emergency phone</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Lead Driver Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Rajesh Kumar Verma"
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Primary Mobile Number
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 0000000000"
                    value={driverPhone}
                    onChange={(e) => setDriverPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Commercial Heavy Transport DL #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UP402018004928"
                    value={driverLicense}
                    onChange={(e) => setDriverLicense(e.target.value.toUpperCase())}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold uppercase text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                    Emergency / Co-Driver Phone
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 9123456789"
                    value={driverAltPhone}
                    onChange={(e) => setDriverAltPhone(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>
            </div>

            {/* 3. Bus Compliance Documents with AWS S3 Upload */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Bus Documents & Compliance Certificates</h2>
                  <p className="text-xs text-slate-400">Upload RC, Commercial Insurance, Fitness & Permit</p>
                </div>
              </div>

              {/* 1. Vehicle RC Certificate */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase">1. Vehicle RC Certificate</span>
                  <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    Required for Trip Dispatch
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">RC Number</label>
                    <input
                      type="text"
                      placeholder="e.g. RC-UP40-AT-7890"
                      value={rcNumber}
                      onChange={(e) => setRcNumber(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold uppercase bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">RC Validity Expiry Date</label>
                    <input
                      type="date"
                      value={rcExpiry}
                      onChange={(e) => setRcExpiry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
                <FileUploadProgress
                  label="Upload Registration Certificate (RC PDF or Photo)"
                  folder="bus-documents"
                  fileUrl={rcFileUrl}
                  onUploadComplete={(url) => setRcFileUrl(url)}
                  onRemove={() => setRcFileUrl('')}
                />
              </div>

              {/* 2. Comprehensive Passenger Insurance */}
              <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 uppercase">2. Comprehensive Passenger Insurance</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Commercial Cover
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">Policy Number</label>
                    <input
                      type="text"
                      placeholder="e.g. POL-2026-98129-C"
                      value={insurancePolicy}
                      onChange={(e) => setInsurancePolicy(e.target.value.toUpperCase())}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold uppercase bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">Insurance Expiry Date</label>
                    <input
                      type="date"
                      value={insuranceExpiry}
                      onChange={(e) => setInsuranceExpiry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                </div>
                <FileUploadProgress
                  label="Upload Commercial Insurance Document"
                  folder="bus-documents"
                  fileUrl={insuranceFileUrl}
                  onUploadComplete={(url) => setInsuranceFileUrl(url)}
                  onRemove={() => setInsuranceFileUrl('')}
                />
              </div>

              {/* 3. Fitness Certificate & Permit in 2 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fitness */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-900 uppercase block">3. State Fitness Cert</span>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">Fitness Expiry Date</label>
                    <input
                      type="date"
                      value={fitnessExpiry}
                      onChange={(e) => setFitnessExpiry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <FileUploadProgress
                    label="Upload Fitness Cert"
                    folder="bus-documents"
                    fileUrl={fitnessFileUrl}
                    onUploadComplete={(url) => setFitnessFileUrl(url)}
                    onRemove={() => setFitnessFileUrl('')}
                  />
                </div>

                {/* Permit */}
                <div className="p-4 rounded-xl bg-slate-50/70 border border-slate-200 space-y-3">
                  <span className="text-xs font-bold text-slate-900 uppercase block">4. Intercity Permit</span>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">Permit Expiry Date</label>
                    <input
                      type="date"
                      value={permitExpiry}
                      onChange={(e) => setPermitExpiry(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:border-blue-600"
                    />
                  </div>
                  <FileUploadProgress
                    label="Upload Permit Doc"
                    folder="bus-documents"
                    fileUrl={permitFileUrl}
                    onUploadComplete={(url) => setPermitFileUrl(url)}
                    onRemove={() => setPermitFileUrl('')}
                  />
                </div>
              </div>
            </div>

            {/* 4. Coach Photos Gallery */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Coach Photo Gallery</h2>
                  <p className="text-xs text-slate-400">Exterior coach views, interior cabin, and sleeper berths</p>
                </div>
              </div>

              {/* Upload New Photo */}
              <FileUploadProgress
                label="Upload High-Resolution Coach Photo"
                description="Upload exterior or interior photos (PNG, JPG, WEBP)"
                folder="bus-photos"
                accept="image/*"
                fileUrl=""
                onUploadComplete={(url) => handleAddCoachImage(url)}
                onRemove={() => {}}
              />

              {/* Preview Grid */}
              <div>
                <span className="text-xs font-semibold text-slate-700 block mb-2">
                  Active Photos ({images.length})
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group rounded-xl overflow-hidden border border-slate-200 aspect-video bg-slate-100">
                      <img
                        src={img}
                        alt={`Coach preview ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveCoachImage(idx)}
                          className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition cursor-pointer"
                          title="Delete photo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {idx === 0 && (
                        <span className="absolute top-2 left-2 bg-blue-600 text-white text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded shadow">
                          Cover
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. Passenger Amenities */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Passenger Comfort & Safety Amenities</h2>
                  <p className="text-xs text-slate-400">Select standard amenities available on this coach</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {AVAILABLE_AMENITIES.map((amenity) => {
                  const checked = amenities.includes(amenity);
                  return (
                    <div
                      key={amenity}
                      onClick={() => toggleAmenity(amenity)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer transition select-none ${
                        checked
                          ? 'border-blue-600 bg-blue-50/60 text-blue-800'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                        checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {checked && <Check className="w-3 h-3" />}
                      </div>
                      <span className="truncate">{amenity}</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Right Column (6 Cols on XL): Pure Coach Layout Blueprint (No Fill / No Sold Seats) */}
          <div className="xl:col-span-6 xl:sticky xl:top-20 space-y-6">
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
                    {totalBerthsOrSeats} {isSleeper ? 'Berths Total' : 'Seats Total'}
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
                  <span className="font-medium">Assigned Carrier Unit:</span>
                  <span className="text-slate-900 font-bold">Company #{companyCode}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="font-medium">Configuration & Berths:</span>
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
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Registering Bus in Fleet...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Complete Coach Induction</span>
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
