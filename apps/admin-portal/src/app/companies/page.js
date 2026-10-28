'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  UserCheck, 
  Target, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Edit3,
  Bus,
  Users
} from 'lucide-react';
import { api } from '../../lib/api';

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState(null);

  // Form states
  const [ownerEmail, setOwnerEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [targetQuota, setTargetQuota] = useState('10000');
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchCompanies = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getCompanies();
      if (res?.success) {
        setCompanies(res.companies || []);
      } else {
        setError(res?.error || 'Failed to fetch companies registry');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const handleAssignOwnerSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComp || !ownerEmail) return;

    setSubmitting(true);
    try {
      const res = await api.assignCompanyOwner(selectedComp.companyCode, {
        ownerEmail: ownerEmail.trim(),
        companyName: companyName.trim() || undefined
      });
      if (res.success) {
        setSuccessMsg(res.message || 'Owner assigned successfully!');
        setTimeout(() => {
          setAssignModalOpen(false);
          setSelectedComp(null);
          setOwnerEmail('');
          setCompanyName('');
          setSuccessMsg('');
          fetchCompanies();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to assign owner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTargetSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComp) return;

    setSubmitting(true);
    try {
      const res = await api.updateCompanyTarget(selectedComp.companyCode, Number(targetQuota));
      if (res.success) {
        setSuccessMsg(res.message || 'Target updated successfully!');
        setTimeout(() => {
          setTargetModalOpen(false);
          setSelectedComp(null);
          setSuccessMsg('');
          fetchCompanies();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to update target');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = companies.filter(c => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    String(c.companyCode).includes(searchTerm) ||
    c.ownerId?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const assignedCount = companies.filter(c => c.ownerId != null).length;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Master Franchise Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">33 Companies Registry</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Complete platform management, franchise ownership binding, and annual passenger quota controls for all 33 operator codes.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={fetchCompanies}
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 font-bold text-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-purple-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Company Codes</span>
          <div className="text-2xl font-black text-white">33 Franchise Slots</div>
          <span className="text-[11px] text-slate-500">Fixed Codes 1 to 33</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Franchise Owners</span>
          <div className="text-2xl font-black text-purple-400">{assignedCount} Assigned</div>
          <span className="text-[11px] text-slate-500">{33 - assignedCount} slots pending assignment</span>
        </div>

        <div className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Default Annual Quota</span>
          <div className="text-2xl font-black text-emerald-400">10,000 / Company</div>
          <span className="text-[11px] text-slate-500">Yearly passenger commitment</span>
        </div>
      </div>

      {/* Companies Table Card */}
      <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-white">
            Franchise Directory ({filtered.length} of 33)
          </h2>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by code, company name, owner..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
            <span className="text-xs">Loading 33 companies registry...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Franchise Company Name</th>
                  <th className="py-3 px-4">Assigned Franchise Owner</th>
                  <th className="py-3 px-4 text-right">Annual Target</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filtered.map((c) => {
                  const owner = c.ownerId;
                  const target = c.annualTarget?.targetPassengers || 10000;
                  return (
                    <tr key={c.companyCode} className="hover:bg-slate-900/50 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-purple-400 text-sm">
                        #{String(c.companyCode).padStart(2, '0')}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-white text-sm">{c.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">slug: {c.slug || `comp-${c.companyCode}`}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {owner ? (
                          <div>
                            <div className="font-semibold text-white">{owner.name}</div>
                            <div className="text-[10px] text-slate-400">{owner.email} · {owner.phone}</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-slate-500 border border-slate-800">
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right font-black text-slate-200">
                        {target.toLocaleString('en-IN')} <span className="text-[10px] text-slate-500 font-normal">pax/yr</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}>
                          {c.status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedComp(c);
                              setOwnerEmail(c.ownerId?.email || '');
                              setCompanyName(c.name || '');
                              setAssignModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 font-bold text-[11px] border border-purple-500/30 transition flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{c.ownerId ? 'Edit Owner' : 'Assign Owner'}</span>
                          </button>

                          <button
                            onClick={() => {
                              setSelectedComp(c);
                              setTargetQuota(String(c.annualTarget?.targetPassengers || 10000));
                              setTargetModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                            title="Adjust Annual Target"
                          >
                            <Target className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ASSIGN OWNER MODAL */}
      {assignModalOpen && selectedComp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-purple-400" />
                  <span>Assign Franchise Owner</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Company Code #{String(selectedComp.companyCode).padStart(2, '0')}</p>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-500 hover:text-white text-sm">✕</button>
            </div>

            <form onSubmit={handleAssignOwnerSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Company Display Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-300 font-bold block mb-1">Owner Email ID *</label>
                <input
                  type="email"
                  required
                  placeholder="owner1@rupadiya.test"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-purple-500"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  The user with this email will be assigned COMPANY_OWNER role for Code #{selectedComp.companyCode}.
                </span>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Binding...' : 'Save & Assign Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST TARGET MODAL */}
      {targetModalOpen && selectedComp && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-400" />
                  <span>Adjust Annual Quota Target</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">Code #{selectedComp.companyCode} · {selectedComp.name}</p>
              </div>
              <button onClick={() => setTargetModalOpen(false)} className="text-slate-500 hover:text-white text-sm">✕</button>
            </div>

            <form onSubmit={handleTargetSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-bold block mb-1">Annual Passenger Target Quota</label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={targetQuota}
                  onChange={(e) => setTargetQuota(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-black text-lg focus:outline-none focus:border-purple-500"
                />
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {['2000', '5000', '10000', '15000'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTargetQuota(p)}
                      className={`py-1 rounded-lg text-xs font-bold border transition ${
                        targetQuota === p ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-950 text-slate-400 border-slate-800'
                      }`}
                    >
                      {Number(p).toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setTargetModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold disabled:opacity-50"
                >
                  {submitting ? 'Updating...' : 'Save Target Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
