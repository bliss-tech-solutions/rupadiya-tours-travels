'use client';

import React, { useEffect, useState } from 'react';
import PhoneInput from '../../components/ui/PhoneInput';
import { ShieldCheck, UserPlus, RefreshCw, Lock } from 'lucide-react';
import { api, isPrimaryAdminSession } from '../../lib/api';

export default function AdminAccountsPage() {
  const [isPrimary, setIsPrimary] = useState(null);
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [resetFor, setResetFor] = useState(null);
  const [resetPassword, setResetPassword] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getAdmins();
      if (!res?.success) throw new Error(res?.error || 'Could not load admins.');
      setAdmins(res.admins || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const primary = isPrimaryAdminSession();
    setIsPrimary(primary);
    if (primary) load();
    else setLoading(false);
  }, []);

  const run = async (fn, okMessage) => {
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const res = await fn();
      if (res?.success === false) throw new Error(res.error || 'Request failed.');
      setMessage(res?.message || okMessage);
      await load();
      return true;
    } catch (e) {
      setError(e.message || 'Request failed.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const ok = await run(() => api.createAdmin(form), 'Admin created.');
    if (ok) setForm({ name: '', email: '', phone: '', password: '' });
  };

  if (isPrimary === false) {
    return (
      <div className="max-w-md mx-auto mt-16 p-6 bg-white border border-slate-200 rounded-2xl text-center space-y-2">
        <Lock className="w-8 h-8 text-slate-400 mx-auto" />
        <h1 className="text-lg font-bold text-slate-900">Primary admin only</h1>
        <p className="text-sm text-slate-500">Only the main Rupadiya Bus Samiti account can manage super admin accounts.</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-6">
      <div className="border-b border-slate-200/80 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold uppercase tracking-wider mb-2 border border-indigo-200">
          <ShieldCheck className="w-3.5 h-3.5" /> Primary Admin
        </div>
        <h1 className="text-2xl font-bold text-slate-900">Admin Accounts</h1>
        <p className="text-sm text-slate-500 mt-1">
          Super admins you create can manage buses, trips, tickets and finance, but cannot download user data or manage admins.
        </p>
      </div>

      {message && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">{message}</div>}
      {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form onSubmit={handleCreate} className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5"><UserPlus className="w-4 h-4" /> New super admin</h2>
          {[
            ['name', 'Full name', 'text'],
            ['email', 'Email', 'email'],
            ['phone', 'Mobile (India / Nepal)', 'tel'],
            ['password', 'Temporary password', 'password']
          ].map(([key, label, type]) => (
            <div key={key}>
              <label className="text-[11px] font-bold text-slate-700 block mb-1">{label}</label>
              {key === 'phone' ? (
                <PhoneInput size="sm" required value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              ) : (
              <input type={type} required value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-indigo-500" />
              )}
            </div>
          ))}
          <p className="text-[10px] text-slate-500">Password: 10+ characters with upper case, lower case and a number.</p>
          <button type="submit" disabled={saving} className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer">
            {saving ? 'Saving…' : 'Create admin'}
          </button>
        </form>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5">
          {loading ? (
            <div className="py-12 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-indigo-600" /></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {admins.map((a) => (
                <div key={a._id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {a.name}{' '}
                      <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${a.adminLevel === 'PRIMARY' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                        {a.adminLevel || 'STANDARD'}
                      </span>
                      {a.isActive === false && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">Disabled</span>}
                    </div>
                    <div className="text-xs text-slate-500">{a.email} · {a.phone}</div>
                  </div>
                  {a.adminLevel !== 'PRIMARY' && (
                    <div className="flex flex-wrap gap-2">
                      <button disabled={saving} onClick={() => run(() => api.updateAdmin(a._id, { isActive: a.isActive === false }), 'Updated.')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${a.isActive === false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
                        {a.isActive === false ? 'Enable' : 'Disable'}
                      </button>
                      {resetFor === a._id ? (
                        <form className="flex gap-1.5" onSubmit={async (e) => {
                          e.preventDefault();
                          const ok = await run(() => api.updateAdmin(a._id, { password: resetPassword }), 'Password reset.');
                          if (ok) { setResetFor(null); setResetPassword(''); }
                        }}>
                          <input type="password" required value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="New password"
                            className="px-2 py-1.5 rounded-lg border border-slate-200 text-[11px]" />
                          <button type="submit" className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold cursor-pointer">Save</button>
                        </form>
                      ) : (
                        <button onClick={() => { setResetFor(a._id); setResetPassword(''); }}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200 bg-white cursor-pointer">Reset password</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
