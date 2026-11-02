'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ShieldAlert, ArrowRight, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('admin@rupadiya.test');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (searchParams && searchParams.get('reason') === 'session_expired') {
      setSessionExpired(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email.trim(), password);
      const user = res.user || res.data?.user;
      const token = res.accessToken || res.token || res.data?.token;

      if (!token) throw new Error('No authentication token received.');

      // Strict Role Check: Super Admin only!
      if (user?.role !== 'SUPER_ADMIN') {
        try {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          localStorage.removeItem('admin_login_time');
        } catch {}
        throw new Error(`Access Denied: Your account role is ${user?.role || 'UNKNOWN'}. This portal is strictly restricted to Super Admin.`);
      }

      if (token) {
        localStorage.setItem('admin_token', token);
      }
      if (user) {
        localStorage.setItem('admin_user', JSON.stringify(user));
      }
      localStorage.setItem('admin_login_time', Date.now().toString());

      router.push('/');
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify root credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/60 rounded-3xl border border-slate-200/90 sm:px-10">
      {sessionExpired && (
        <div className="mb-5 p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2.5">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Please sign in again.</span>
        </div>
      )}

      {error && (
        <div className="mb-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Super Admin Email</label>
          <div className="flex items-center gap-2.5 border border-slate-200 bg-slate-50 rounded-xl px-3.5 py-2.5 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition">
            <Mail className="w-4 h-4 text-slate-400" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs font-bold text-slate-900 focus:outline-none bg-transparent"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Root Security Password</label>
          <div className="flex items-center gap-2.5 border border-slate-200 bg-slate-50 rounded-xl px-3.5 py-2.5 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100 transition">
            <Lock className="w-4 h-4 text-slate-400" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-xs font-bold text-slate-900 focus:outline-none bg-transparent"
            />
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-black rounded-2xl shadow-lg shadow-blue-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-xs cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying Credentials...</span>
              </span>
            ) : (
              <>
                <span>Authenticate as Super Admin</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>

      </div>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-blue-500/25 mb-4">
          <ShieldAlert className="w-7 h-7" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-xs font-black uppercase tracking-wider mb-2">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Platform Super Admin</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Rupadiya Platform HQ</h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Universal Franchise Governance & Fleet Administration</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense fallback={
          <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center text-xs text-slate-400">
            Loading authentication portal...
          </div>
        }>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
