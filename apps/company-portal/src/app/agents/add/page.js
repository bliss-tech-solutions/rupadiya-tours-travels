'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Users, 
  ShieldCheck, 
  FileText, 
  Wallet, 
  Building2, 
  Sparkles, 
  Check, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Phone,
  Mail,
  Lock,
  MapPin,
  CreditCard,
  Globe2
} from 'lucide-react';
import { api } from '../../../lib/api';
import FileUploadProgress from '../../../components/FileUploadProgress';

export default function AddFranchiseAgentPage() {
  const router = useRouter();

  // Basic Account Details
  const [name, setName] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('Password123!');
  const [initialWalletAmount, setInitialWalletAmount] = useState('10000');
  const [agentLevel, setAgentLevel] = useState('SILVER');
  const [customCashbackPercent, setCustomCashbackPercent] = useState('5.0');

  // Address
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Rupadiya');
  const [state, setState] = useState('Uttar Pradesh');

  // Nationality & KYC
  const [nationality, setNationality] = useState('INDIA'); // 'INDIA' | 'NEPAL'
  const [aadharNumber, setAadharNumber] = useState('');
  const [aadharFileUrl, setAadharFileUrl] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [panFileUrl, setPanFileUrl] = useState('');

  // Nepal specific
  const [nepalIdNumber, setNepalIdNumber] = useState('');
  const [nepalIdFileUrl, setNepalIdFileUrl] = useState('');
  const [nepalIdFileUrlBack, setNepalIdFileUrlBack] = useState('');

  // Banking Details
  const [bankAccountName, setBankAccountName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankIfsc, setBankIfsc] = useState('');
  const [bankUpiId, setBankUpiId] = useState('');
  const [bankName, setBankName] = useState('State Bank of India');

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLevelChange = (lvl) => {
    setAgentLevel(lvl);
    if (lvl === 'BRONZE') setCustomCashbackPercent('3.0');
    if (lvl === 'SILVER') setCustomCashbackPercent('5.0');
    if (lvl === 'GOLD') setCustomCashbackPercent('7.0');
    if (lvl === 'PLATINUM') setCustomCashbackPercent('10.0');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) return setError('Please enter agent primary contact name.');
    if (!email.trim() || !email.includes('@')) return setError('Please enter a valid agent email address.');
    if (!phone.trim() || phone.trim().length < 10) return setError('Please enter a valid 10-digit mobile number.');

    if (nationality === 'INDIA') {
      if (!aadharNumber.trim() && !panNumber.trim()) {
        return setError('Please provide at least Aadhaar or PAN number for Indian agent verification.');
      }
    } else {
      if (!nepalIdNumber.trim()) {
        return setError('Please provide Citizenship / National Identity Card number for Nepal agent.');
      }
    }

    setSubmitting(true);

    try {
      const payload = {
        name: name.trim(),
        agencyName: agencyName.trim() || `${name.trim()} Travels Counter`,
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        password: password.trim() || 'Password123!',
        initialWalletAmount: Number(initialWalletAmount) || 0,
        address: address.trim(),
        city: city.trim() || 'Rupadiya',
        state: state.trim() || 'Uttar Pradesh',
        nationality,
        agentLevel,
        customCashbackPercent: Number(customCashbackPercent) || 5.0,
        aadharNumber: nationality === 'INDIA' ? aadharNumber.trim() : '',
        aadharFileUrl: nationality === 'INDIA' ? aadharFileUrl : null,
        panNumber: nationality === 'INDIA' ? panNumber.trim().toUpperCase() : '',
        panFileUrl: nationality === 'INDIA' ? panFileUrl : null,
        nepalIdNumber: nationality === 'NEPAL' ? nepalIdNumber.trim() : '',
        nepalIdFileUrl: nationality === 'NEPAL' ? nepalIdFileUrl : null,
        nepalIdFileUrlBack: nationality === 'NEPAL' ? nepalIdFileUrlBack : null,
        bankDetails: {
          accountName: bankAccountName.trim() || name.trim(),
          accountNumber: bankAccountNumber.trim(),
          ifscCode: bankIfsc.trim().toUpperCase(),
          upiId: bankUpiId.trim(),
          bankName: bankName.trim() || 'State Bank of India'
        }
      };

      const res = await api.createAgent(payload);
      if (res?.success) {
        setSuccess(`Agent "${payload.name}" successfully onboarded with ID ${res.agent?._id ? String(res.agent._id).slice(-6) : 'assigned'}! Redirecting to agency roster...`);
        setTimeout(() => {
          router.push('/agents');
        }, 1500);
      } else {
        setError(res?.error || 'Failed to onboard franchise agent.');
      }
    } catch (err) {
      setError(err.message || 'Network error communicating with server.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6 pb-12">
      {/* Top Breadcrumb & Page Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/agents"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Franchise Agents</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
              Agency Onboarding
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Register New Franchise Agent Counter
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create an authorized booking agent terminal, configure commission tier, upload KYC documents, and allocate counter wallet balance.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Registration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Section 1: Agency & Personal Credentials */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Franchise Profile & Contact Details</h2>
              <p className="text-[11px] text-slate-500">Legal entity name and direct contact coordinates for booking dispatches.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Agent Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Agency / Counter Name</label>
              <input
                type="text"
                placeholder="e.g. Sharma Travels & Booking Counter"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Phone (Login & SMS) *</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="tel"
                  required
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  placeholder="agent@sharmatravels.in"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Initial Terminal Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Default password for first sign in</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Operating Hub / City</label>
              <input
                type="text"
                placeholder="Rupadiya / Nanpara / Bahraich"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Nationality & KYC Document Verification */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Nationality & Government KYC Verification</h2>
                <p className="text-[11px] text-slate-500">Cross-border identity validation supporting India & Nepal citizen credentials.</p>
              </div>
            </div>

            {/* Country Selector Toggle */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setNationality('INDIA')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  nationality === 'INDIA'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🇮🇳 Indian Resident (Aadhaar / PAN)</span>
              </button>
              <button
                type="button"
                onClick={() => setNationality('NEPAL')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                  nationality === 'NEPAL'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🇳🇵 Nepali Resident (Citizenship / National ID)</span>
              </button>
            </div>
          </div>

          {nationality === 'INDIA' ? (
            /* Indian KYC: Aadhaar & PAN */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* Aadhaar Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Aadhaar Card (12-Digit)</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    India UIDAI
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={14}
                  placeholder="1234 5678 9012"
                  value={aadharNumber}
                  onChange={(e) => setAadharNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    Aadhaar Card Front / PDF Upload (AWS S3)
                  </label>
                  <FileUploadProgress
                    folder="agent-kyc/aadhaar"
                    accept="image/*,application/pdf"
                    currentUrl={aadharFileUrl}
                    onUploadSuccess={(url) => setAadharFileUrl(url)}
                    onRemove={() => setAadharFileUrl('')}
                  />
                </div>
              </div>

              {/* PAN Card */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Permanent Account Number (PAN)</span>
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    Income Tax Dept
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  value={panNumber}
                  onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium uppercase bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5">
                    PAN Card Image Upload (AWS S3)
                  </label>
                  <FileUploadProgress
                    folder="agent-kyc/pan"
                    accept="image/*,application/pdf"
                    currentUrl={panFileUrl}
                    onUploadSuccess={(url) => setPanFileUrl(url)}
                    onRemove={() => setPanFileUrl('')}
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Nepali KYC: Citizenship / National ID (Rastriya Parichayapatra) */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">Citizenship / National ID No.</span>
                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    Nepal Govt
                  </span>
                </div>
                <input
                  type="text"
                  placeholder="e.g. 71-01-78-12345"
                  value={nepalIdNumber}
                  onChange={(e) => setNepalIdNumber(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500">
                  Enter Nagarikta (Citizenship) Certificate or Rastriya Parichayapatra ID.
                </p>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  National ID Front Document (AWS S3)
                </label>
                <FileUploadProgress
                  folder="agent-kyc/nepal-id-front"
                  accept="image/*,application/pdf"
                  currentUrl={nepalIdFileUrl}
                  onUploadSuccess={(url) => setNepalIdFileUrl(url)}
                  onRemove={() => setNepalIdFileUrl('')}
                />
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  National ID Back Document (AWS S3)
                </label>
                <FileUploadProgress
                  folder="agent-kyc/nepal-id-back"
                  accept="image/*,application/pdf"
                  currentUrl={nepalIdFileUrlBack}
                  onUploadSuccess={(url) => setNepalIdFileUrlBack(url)}
                  onRemove={() => setNepalIdFileUrlBack('')}
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 3: Commercial Terms & Commission Tier */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Sparkles className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Commission Tier & Counter Wallet Allocation</h2>
              <p className="text-[11px] text-slate-500">Select agent hierarchy level and provide initial counter float balance.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { id: 'BRONZE', name: 'Bronze Counter', rate: '3.0%', desc: 'Entry-level franchise counter' },
              { id: 'SILVER', name: 'Silver Partner', rate: '5.0%', desc: 'Standard authorized booking agent' },
              { id: 'GOLD', name: 'Gold Premier', rate: '7.0%', desc: 'High-volume hub booking partner' },
              { id: 'PLATINUM', name: 'Platinum Star', rate: '10.0%', desc: 'Master agent with priority allocation' }
            ].map((lvl) => (
              <div
                key={lvl.id}
                onClick={() => handleLevelChange(lvl.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition ${
                  agentLevel === lvl.id
                    ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-slate-900">{lvl.name}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    agentLevel === lvl.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {lvl.rate}
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">{lvl.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Commission Override Percentage (%)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="25"
                value={customCashbackPercent}
                onChange={(e) => setCustomCashbackPercent(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Initial Float Wallet Credit (₹)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={initialWalletAmount}
                  onChange={(e) => setInitialWalletAmount(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Counter balance automatically credited to agent ledger on registration.
              </span>
            </div>
          </div>
        </div>

        {/* Section 4: Settlement Banking Details */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-5 h-5 text-blue-600" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Settlement Bank & UPI Coordinates</h2>
              <p className="text-[11px] text-slate-500">Destination bank account for agent commission withdrawals and refunds.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bank Name</label>
              <input
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="State Bank of India / HDFC Bank"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account Holder Name</label>
              <input
                type="text"
                value={bankAccountName}
                onChange={(e) => setBankAccountName(e.target.value)}
                placeholder="As per bank passbook"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Account Number</label>
              <input
                type="text"
                value={bankAccountNumber}
                onChange={(e) => setBankAccountNumber(e.target.value)}
                placeholder="9876543210123"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">IFSC Code / Swift</label>
              <input
                type="text"
                value={bankIfsc}
                onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
                placeholder="SBIN0001234"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono uppercase font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">UPI ID (Instant Settlement)</label>
              <input
                type="text"
                value={bankUpiId}
                onChange={(e) => setBankUpiId(e.target.value)}
                placeholder="agent@okhdfcbank"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/agents"
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 transition flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95"
          >
            {submitting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Onboarding Franchise Agent...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Complete Agent Registration</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

