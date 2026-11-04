'use client';

import React, { useState, useEffect } from 'react';
import { 
  User, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  CreditCard, 
  Save, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Building2,
  FileText,
  Lock
} from 'lucide-react';
import { api } from '../../lib/api';
import { useWallet } from '../../context/WalletContext';

export default function AgentProfilePage() {
  const { updateUser } = useWallet();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Editable Form Field: ONLY NAME
  const [name, setName] = useState('');

  // Read-only / Locked Fields (created by Company Owner)
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [agencyName, setAgencyName] = useState('');
  const [agentCode, setAgentCode] = useState('');
  const [companyCode, setCompanyCode] = useState('');

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getProfile();
      const p = res.profile || res.data || res;
      if (p) {
        setName(p.name || '');
        setEmail(p.email || '');
        setPhone(p.phone || '');
        setAddress(typeof p.address === 'string' ? p.address : p.address?.street || '');
        setCity(p.city || p.address?.city || '');
        setState(p.state || p.address?.state || '');
        setPanNumber(p.panNumber || '');
        setAadharNumber(p.aadharNumber || '');
        setAgencyName(p.agencyName || '');
        setAgentCode(p.agentCode || p.referralCode || 'AGT01L1T0001');
        setCompanyCode(p.companyCode || 1);
      }
    } catch (err) {
      setError(err.message || 'Error loading profile details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your full name');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Agent is strictly allowed to update their Name only
      const payload = {
        name: name.trim()
      };

      const res = await api.updateProfile(payload);
      if (res?.success) {
        setSuccess('Profile name updated successfully.');
        // Update global context so Topbar, Sidebar, and layouts reflect new name immediately
        updateUser({ name: name.trim() });
        setTimeout(() => setSuccess(''), 4000);
      } else {
        setError(res?.error || 'Failed to update profile');
      }
    } catch (err) {
      setError(err.message || 'Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-500 gap-2">
        <RefreshCw className="w-7 h-7 animate-spin text-emerald-600" />
        <span className="text-xs font-semibold uppercase tracking-wider">Loading Agent Profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Agent Identity & Terminal Credentials
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Agent Profile</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Your counter credentials provisioned by franchise transport partner
          </p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 px-3.5 py-1.5 rounded-xl border border-emerald-200 shrink-0 self-start sm:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-emerald-800">Verified Terminal</span>
        </div>
      </div>

      {/* Security Governance Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div className="text-xs text-amber-900 space-y-0.5">
          <span className="font-bold block">Company-Managed Account Policy</span>
          <p className="text-[11px] text-amber-800">
            Because this booking agent terminal was provisioned and authorized by your Company Owner, legal records (Phone, Email, KYC documents, and Franchise assignment) are locked. You may update your Operator Display Name below. For other updates, please contact your company owner.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Main Profile Form */}
      <div className="bg-white p-6 sm:p-8 rounded-2xl border border-slate-200/80 shadow-xs">
        <form onSubmit={handleSave} className="space-y-6">
          {/* Identity Header Strip */}
          <div className="flex items-center gap-4 pb-5 border-b border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center font-bold text-xl shrink-0">
              {name ? name[0].toUpperCase() : 'A'}
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{name || 'Agent User'}</h3>
              <p className="text-xs text-slate-500">
                12-Char Referral Code: <strong className="font-mono text-emerald-700 tracking-wider">{agentCode}</strong>
              </p>
            </div>
          </div>

          {/* 1. Editable Display Name */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>1. Editable Information</span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Operator Editable
              </span>
            </h4>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Full Display Name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your Full Name"
                  className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                This name appears on printed passenger tickets and the agent terminal header.
              </span>
            </div>
          </div>

          {/* 2. Locked Contact & Owner-Provisioned Information */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>2. Verified Contact Information</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Locked by Owner
              </span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Mobile Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    disabled
                    value={phone}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-slate-600 cursor-not-allowed"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Email Address</label>
                <div className="relative">
                  <input
                    type="email"
                    disabled
                    value={email}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-600 cursor-not-allowed"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          {/* 3. Agency & Location Details (Locked) */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>3. Agency & Regional Location</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Locked by Owner
              </span>
            </h4>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Agency Business Name</label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={agencyName || 'Rupadiya Intercity Counter'}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-600 cursor-not-allowed"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">Operating City</label>
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      value={city || 'Rupadiya Corridor'}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-600 cursor-not-allowed"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-500 block mb-1">State / Province</label>
                  <div className="relative">
                    <input
                      type="text"
                      disabled
                      value={state || 'Uttar Pradesh'}
                      className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium text-slate-600 cursor-not-allowed"
                    />
                    <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 4. Tax Identification Documents (Locked) */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span>4. Verified KYC & Tax Documents</span>
              <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" /> Locked by Owner
              </span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">PAN Card Number</label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={panNumber || 'ABCDE1234F'}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-slate-600 cursor-not-allowed uppercase"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 block mb-1">Aadhaar / National ID</label>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    value={aadharNumber || 'XXXX-XXXX-9821'}
                    className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono font-medium text-slate-600 cursor-not-allowed"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>
            </div>
          </div>

          {/* Submit Action */}
          <div className="pt-4 flex items-center justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 active:scale-98"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving Name...' : 'Save Name Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
