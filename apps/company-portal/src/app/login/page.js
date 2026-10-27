'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Building2, ArrowRight } from 'lucide-react';
import { api } from '../../lib/api';

export default function CompanyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('owner@rupadiya.test');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      const token = res.accessToken || res.token || res.data?.token;
      const user = res.user || res.data?.user;
      localStorage.setItem('owner_token', token);
      localStorage.setItem('owner_user', JSON.stringify(user));
      router.push('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090D16] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mx-auto shadow-lg shadow-blue-500/30 mb-3">
          <Building2 className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black text-white tracking-tight">Company Franchise Portal</h2>
        <p className="text-xs text-slate-400 mt-1">Authorized Access for Company Codes 1 to 33</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0D131F] py-8 px-6 shadow-2xl rounded-3xl border border-slate-800 sm:px-10">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Owner Email ID</label>
              <div className="flex items-center gap-2 border border-slate-700 bg-slate-950 rounded-xl px-3 py-2.5 focus-within:border-blue-500">
                <Mail className="w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs font-bold text-white focus:outline-none bg-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">Password</label>
              <div className="flex items-center gap-2 border border-slate-700 bg-slate-950 rounded-xl px-3 py-2.5 focus-within:border-blue-500">
                <Lock className="w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs font-bold text-white focus:outline-none bg-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-500/25 transition active:scale-[0.99] flex items-center justify-center gap-2 text-xs mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In as Company Owner →'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-800 text-center">
            <span className="text-[11px] text-slate-500 block mb-2">Prefilled Franchise Credentials</span>
            <button
              type="button"
              onClick={() => { setEmail('owner@rupadiya.test'); setPassword('Password123!'); }}
              className="px-3 py-1 rounded-lg bg-blue-500/10 text-blue-400 font-semibold text-xs"
            >
              owner@rupadiya.test (Company #01)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

