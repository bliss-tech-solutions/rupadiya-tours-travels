'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  User, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Save, 
  LogOut, 
  Calendar, 
  Ticket, 
  Sparkles, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Compass
} from 'lucide-react';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

export default function UserProfilePage() {
  const router = useRouter();
  const { addToast } = useToast();

  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bookingsCount, setBookingsCount] = useState(0);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('rupadiya_user') : null;
    const token = typeof window !== 'undefined' ? localStorage.getItem('rupadiya_token') : null;

    if (!token || !raw) {
      setLoading(false);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      setUser(parsed);
      setName(parsed.name || '');
      setPhone(parsed.phone || '');
      setEmail(parsed.email || '');
    } catch (e) {}

    // Load fresh profile & bookings count
    Promise.allSettled([
      api.me(),
      api.getMyBookings()
    ])
      .then(([meRes, bookingsRes]) => {
        if (meRes.status === 'fulfilled' && meRes.value?.user) {
          const freshUser = meRes.value.user;
          setUser(freshUser);
          setName(freshUser.name || '');
          setPhone(freshUser.phone || '');
          setEmail(freshUser.email || '');
          localStorage.setItem('rupadiya_user', JSON.stringify(freshUser));
        }
        if (bookingsRes.status === 'fulfilled') {
          const list = bookingsRes.value.bookings || bookingsRes.value.data || [];
          setBookingsCount(list.length);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!name.trim()) {
      addToast('Please enter your full name', 'warning');
      return;
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      addToast('Please enter a valid 10-digit mobile number', 'warning');
      return;
    }

    try {
      setSaving(true);
      const res = await api.updateProfile({
        name: name.trim(),
        phone: cleanPhone
      });

      if (res?.success) {
        const updatedUser = res.user || { ...user, name: name.trim(), phone: cleanPhone };
        setUser(updatedUser);
        localStorage.setItem('rupadiya_user', JSON.stringify(updatedUser));
        addToast('Profile updated successfully!', 'success', 'Saved');
      } else {
        addToast(res?.error || 'Failed to update profile', 'error');
      }
    } catch (err) {
      addToast(err?.message || 'Error updating profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('rupadiya_token');
    localStorage.removeItem('rupadiya_user');
    addToast('Signed out successfully', 'info');
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500">Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 max-w-md w-full text-center shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-sky-50 text-sky-500 flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Sign in to View Profile</h2>
          <p className="text-xs text-slate-500 leading-relaxed mb-6">
            Please log in to manage your passenger details, view ticket history, and update your mobile number.
          </p>
          <Link
            href="/login?redirect=/profile"
            className="w-full py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm shadow-md shadow-sky-500/20 transition active:scale-95 inline-block"
          >
            Sign in to Rupadiya Travel
          </Link>
        </div>
      </div>
    );
  }

  const initial = (name || user.name || 'U')[0].toUpperCase();

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 md:top-20 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition"
              title="Home"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-base sm:text-lg font-bold text-slate-900">
              My Profile
            </h1>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-semibold transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-6 space-y-6">
        
        {/* Profile Card Banner */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center text-2xl font-bold shadow-lg shadow-sky-500/20 flex-shrink-0">
              {initial}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">
                  {name || user.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                  Active
                </span>
              </div>
              <p className="text-xs text-slate-500 font-mono mt-0.5">
                {email || user.email}
              </p>
              <p className="text-xs text-sky-600 font-semibold mt-1">
                Passenger Account · Rupadiya Intercity Traveler
              </p>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-3 self-stretch sm:self-auto border-t sm:border-t-0 sm:border-l border-slate-100 pt-4 sm:pt-0 sm:pl-6">
            <Link
              href="/bookings"
              className="p-3 rounded-2xl bg-slate-50 hover:bg-sky-50 transition border border-slate-100 group text-center"
            >
              <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-sky-600 block">
                Total Trips
              </span>
              <span className="text-lg font-bold text-slate-900 group-hover:text-sky-600">
                {bookingsCount}
              </span>
            </Link>

            <Link
              href="/calendar"
              className="p-3 rounded-2xl bg-slate-50 hover:bg-sky-50 transition border border-slate-100 group text-center"
            >
              <span className="text-[10px] font-bold uppercase text-slate-400 group-hover:text-sky-600 block">
                Travel Calendar
              </span>
              <span className="text-lg font-bold text-slate-900 group-hover:text-sky-600">
                Active
              </span>
            </Link>
          </div>
        </div>

        {/* Profile Edit Form Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
          <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600 block">
                Account Details
              </span>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                Edit Personal Information
              </h3>
            </div>
            <span className="text-xs text-slate-400">
              Synced with tickets
            </span>
          </div>

          <form onSubmit={handleSave} className="space-y-5">
            {/* Full Name */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm font-semibold text-slate-900 transition pl-11"
                  required
                />
                <User className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Name appears on your boarding pass and official passenger manifest.
              </p>
            </div>

            {/* Mobile Number */}
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Mobile Number (10 Digits)
              </label>
              <div className="relative">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-slate-400 text-sm font-semibold border-r border-slate-200 pr-2">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-bold text-slate-600">+91</span>
                </div>
                <input
                  type="tel"
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="9876543210"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 text-sm font-semibold text-slate-900 transition pl-20 tracking-wider"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Used for boarding gate SMS alerts and trip notifications.
              </p>
            </div>

            {/* Email Address (Read-only for security) */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 block">
                  Email Address
                </label>
                <span className="text-[10px] font-semibold text-slate-400 uppercase">
                  Verified Login Email
                </span>
              </div>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  disabled
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-500 cursor-not-allowed pl-11"
                />
                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                To update your login email, contact Rupadiya Travel Helpdesk.
              </p>
            </div>

            {/* Save Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-sky-500 hover:bg-sky-600 text-white font-bold text-sm shadow-md shadow-sky-500/25 transition active:scale-95 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving Changes...' : 'Save Profile Changes'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Quick Travel Links Card */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-3">
            Quick Navigation
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link
              href="/bookings"
              className="p-4 rounded-2xl border border-slate-100 hover:border-sky-300 hover:bg-sky-50/50 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition">
                  <Ticket className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">My Trips</h4>
                  <p className="text-[11px] text-slate-400">View boarding passes</p>
                </div>
              </div>
            </Link>

            <Link
              href="/calendar"
              className="p-4 rounded-2xl border border-slate-100 hover:border-sky-300 hover:bg-sky-50/50 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Travel Calendar</h4>
                  <p className="text-[11px] text-slate-400">Monthly schedule</p>
                </div>
              </div>
            </Link>

            <Link
              href="/tours"
              className="p-4 rounded-2xl border border-slate-100 hover:border-sky-300 hover:bg-sky-50/50 transition flex items-center justify-between group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center group-hover:bg-sky-500 group-hover:text-white transition">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800">Handpicked Tours</h4>
                  <p className="text-[11px] text-slate-400">Explore holiday packages</p>
                </div>
              </div>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

