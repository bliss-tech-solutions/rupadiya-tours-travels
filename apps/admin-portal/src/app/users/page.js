'use client';

import React, { useEffect, useState } from 'react';
import { Users, Search, Download, RefreshCw, Lock } from 'lucide-react';
import { api } from '../../lib/api';

const ROLE_OPTIONS = ['', 'PASSENGER', 'AGENT', 'COMPANY_OWNER', 'BUS_MANAGER', 'SUPER_ADMIN'];
const ROLE_LABEL = {
  '': 'All roles',
  PASSENGER: 'Passengers',
  AGENT: 'Agents',
  COMPANY_OWNER: 'Company owners',
  BUS_MANAGER: 'Bus managers',
  SUPER_ADMIN: 'Super admins'
};

// Old phone-only accounts had a made-up "<mobile>@rupadiya.com" email; never show those.
const realEmail = (e) => Boolean(e) && !/^\+?\d{6,15}@(rupadiya\.com|guest\.rupadiya\.in)$/i.test(e);
const formatPhone = (p) => {
  const d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  if (d.length === 12 && d.startsWith('91')) return `+91 ${d.slice(2, 7)} ${d.slice(7)}`;
  return String(p).startsWith('+') ? p : `+${d}`;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [canExport, setCanExport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  const filters = () => ({ ...(role ? { role } : {}), ...(search.trim() ? { search: search.trim() } : {}) });

  const load = async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getUsers({ ...filters(), page: p, limit: 25 });
      if (!res?.success) throw new Error(res?.error || 'Could not load users.');
      setUsers(res.users || []);
      setTotal(res.total || 0);
      setPages(res.pages || 1);
      setCanExport(Boolean(res.canExport));
    } catch (e) {
      setError(e.message || 'Could not load users.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      await api.exportUsers(filters());
    } catch (e) {
      setError(e.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 border border-blue-200">
            <Users className="w-3.5 h-3.5" /> Platform Users
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Users Directory</h1>
          <p className="text-sm text-slate-500 mt-1">{total.toLocaleString('en-IN')} accounts across passengers, agents, companies and staff.</p>
        </div>
        {canExport ? (
          <button onClick={handleExport} disabled={exporting}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer">
            <Download className="w-4 h-4" /> {exporting ? 'Preparing…' : 'Download CSV'}
          </button>
        ) : (
          <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Only the primary admin can download user data
          </span>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
        <form
          onSubmit={(e) => { e.preventDefault(); setPage(1); load(1); }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <select value={role} onChange={(e) => setRole(e.target.value)} className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold">
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, phone or agent code"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:bg-white focus:outline-none focus:border-blue-500" />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer">Search</button>
        </form>

        {error && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{error}</div>}

        {loading ? (
          <div className="py-16 flex justify-center"><RefreshCw className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : users.length === 0 ? (
          <p className="py-12 text-center text-xs text-slate-500">No users match this filter.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-3">Name</th>
                  <th className="py-3 px-3">Contact</th>
                  <th className="py-3 px-3">Role</th>
                  <th className="py-3 px-3">Company</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-3 font-bold text-slate-900">
                      {u.name}
                      {u.referralCode && <div className="font-mono text-[10px] text-blue-700">{u.referralCode}</div>}
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {u.phone ? (
                        <a href={`tel:${u.phone}`} className="block font-mono font-bold text-slate-900 hover:text-blue-700">{formatPhone(u.phone)}</a>
                      ) : <span className="text-slate-400">No mobile</span>}
                      {realEmail(u.email) ? <div className="text-[11px] text-slate-500">{u.email}</div> : null}
                    </td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                        {u.role}{u.adminLevel === 'PRIMARY' ? ' · PRIMARY' : ''}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{u.companyCode ? `#${u.companyCode}` : '—'}</td>
                    <td className="py-3 px-3">
                      <span className={`text-[10px] font-bold ${u.isActive === false ? 'text-rose-600' : 'text-emerald-700'}`}>
                        {u.isActive === false ? 'Disabled' : 'Active'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
            <span className="text-slate-500">Page {page} of {pages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p); }} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 cursor-pointer">Previous</button>
              <button disabled={page >= pages} onClick={() => { const p = page + 1; setPage(p); load(p); }} className="px-3 py-1.5 rounded-lg border border-slate-200 disabled:opacity-40 cursor-pointer">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
