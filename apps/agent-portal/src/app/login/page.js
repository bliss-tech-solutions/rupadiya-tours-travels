'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../../lib/api';

export default function AgentLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('agent@rupadiya.test');
  const [password, setPassword] = useState('Password123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.login(email, password);
      const user = res.user || res.data?.user;
      const token = res.accessToken || res.token || res.data?.accessToken || res.data?.token;
      if (token) { localStorage.setItem('agent_token', token); }
      if (user) {
        localStorage.setItem('agent_user', JSON.stringify(user));
      }
      router.push('/');
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto shadow-sm mb-3 font-bold text-xl">
          R
        </div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Agent Booking Terminal</h2>
        <p className="text-xs text-slate-500 mt-1">Authorized Rupadiya Network Franchise Portal</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-200/80 sm:px-10 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Agent Email ID</label>
              <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-emerald-500">
                <Mail className="w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Password</label>
              <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-emerald-500">
                <Lock className="w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs font-semibold text-slate-900 focus:outline-none bg-transparent"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs transition active:scale-98 flex items-center justify-center gap-2 text-xs mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In to Terminal →'}
            </button>
          </form>

          <div className="pt-4 border-t border-slate-100 text-center">
            <span className="text-[11px] text-slate-400 block mb-2">Prefilled Agent Credentials (₹15,000 Initial Wallet)</span>
            <button
              type="button"
              onClick={() => { setEmail('agent@rupadiya.test'); setPassword('Password123!'); }}
              className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-semibold text-xs border border-emerald-200"
            >
              agent@rupadiya.test
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
