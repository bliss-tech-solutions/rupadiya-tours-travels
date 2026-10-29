'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, Building2, Phone, User, CheckCircle2, AlertCircle } from 'lucide-react';
import { api, saveOwnerSession, isOwnerSessionValid } from '../../lib/api';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isExpired = searchParams.get('expired') === '1';

  const [mode, setMode] = useState('LOGIN'); // 'LOGIN' | 'REGISTER'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Login form
  const [email, setEmail] = useState('owner@rupadiya.test');
  const [password, setPassword] = useState('Password123!');

  // Register form
  const [regData, setRegData] = useState({
    name: '',
    email: '',
    phone: '',
    password: 'Password123!',
    companyCode: '1',
    agencyName: ''
  });

  // Redirect if already logged in with valid session
  useEffect(() => {
    if (isOwnerSessionValid()) {
      router.push('/');
    }
  }, [router]);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email.trim(), password);
      const token = res.accessToken || res.token || res.data?.token;
      const user = res.user || res.data?.user;

      if (!token) throw new Error('No authentication token received.');

      // Verify user is COMPANY_OWNER or SUPER_ADMIN
      if (user.role !== 'COMPANY_OWNER' && user.role !== 'SUPER_ADMIN') {
        throw new Error(`Access restricted: Your account role is ${user.role}. This portal requires Company Owner privileges.`);
      }

      saveOwnerSession(token, user);
      router.push('/');
    } catch (err) {
      setError(err.message || 'Login authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        name: regData.name.trim(),
        email: regData.email.trim(),
        phone: regData.phone.trim(),
        password: regData.password,
        role: 'COMPANY_OWNER',
        companyCode: Number(regData.companyCode) || 1,
        agencyName: regData.agencyName.trim() || `Company #${regData.companyCode}`
      };

      await api.register(payload);
      setSuccessMsg('Franchise account registered successfully! You can now sign in.');
      setMode('LOGIN');
      setEmail(payload.email);
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-blue-500 selection:text-white">
      {/* Brand Header */}
      <div className="w-full max-w-md text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider mb-3">
          <Building2 className="w-4 h-4" />
          <span>Rupadiya Franchise Network</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Company Franchise Terminal</h1>
        <p className="text-xs text-slate-500 mt-1">
          Sign in to access your company dashboard and operations.
        </p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-xl shadow-slate-200/50 overflow-hidden">
        {/* Session Expired Banner */}
        {isExpired && (
          <div className="p-4 bg-amber-50 border-b border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Your session has expired. Please sign in again.</span>
          </div>
        )}

        {/* Mode Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 p-1.5 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode('LOGIN'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2.5 rounded-2xl transition cursor-pointer ${
              mode === 'LOGIN'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('REGISTER'); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2.5 rounded-2xl transition cursor-pointer ${
              mode === 'REGISTER'
                ? 'bg-white text-blue-700 shadow-xs'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Register Franchise
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-5">
          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'LOGIN' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Email Address</label>
                <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@rupadiya.test"
                    className="w-full text-slate-900 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Password</label>
                <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-100 transition">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full text-slate-900 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-2xl shadow-md shadow-blue-500/20 transition active:scale-[0.99] flex items-center justify-center gap-2 text-xs cursor-pointer"
              >
                {loading ? 'Authenticating...' : 'Sign In →'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Full Name *</label>
                  <div className="flex items-center gap-1.5 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 focus-within:bg-white focus-within:border-blue-600">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Patel"
                      value={regData.name}
                      onChange={(e) => setRegData({ ...regData, name: e.target.value })}
                      className="w-full text-slate-900 focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Company Code *</label>
                  <div className="flex items-center gap-1.5 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 focus-within:bg-white focus-within:border-blue-600">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="number"
                      min="1"
                      max="33"
                      required
                      value={regData.companyCode}
                      onChange={(e) => setRegData({ ...regData, companyCode: e.target.value })}
                      className="w-full text-slate-900 focus:outline-none bg-transparent font-bold"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Rupadiya Royal Intercity"
                  value={regData.agencyName}
                  onChange={(e) => setRegData({ ...regData, agencyName: e.target.value })}
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Email ID *</label>
                <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 focus-within:bg-white focus-within:border-blue-600">
                  <Mail className="w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="franchise@rupadiya.test"
                    value={regData.email}
                    onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                    className="w-full text-slate-900 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Phone Number *</label>
                <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 focus-within:bg-white focus-within:border-blue-600">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <input
                    type="tel"
                    required
                    placeholder="9876543210"
                    value={regData.phone}
                    onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                    className="w-full text-slate-900 focus:outline-none bg-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Password *</label>
                <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2 focus-within:bg-white focus-within:border-blue-600">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    value={regData.password}
                    onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                    className="w-full text-slate-900 focus:outline-none bg-transparent font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs transition active:scale-[0.99] flex items-center justify-center gap-2 text-xs mt-2 cursor-pointer"
              >
                {loading ? 'Registering...' : 'Register as Company Owner →'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CompanyLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-slate-400 text-xs">Loading franchise terminal...</div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
