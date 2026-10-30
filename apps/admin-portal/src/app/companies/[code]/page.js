'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Building2, 
  ArrowLeft, 
  Bus, 
  Users, 
  Target, 
  UserCheck, 
  RefreshCw, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Wallet,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  TrendingUp,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../../../lib/api';

export default function AdminCompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = params?.code;

  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Re-assign owner modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Target update modal
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targetQuota, setTargetQuota] = useState('10000');
  const [targetLoading, setTargetLoading] = useState(false);

  const fetchCompanyDetails = async () => {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getCompanyByCode(code);
      if (res?.success) {
        setCompanyData(res);
        if (res.company?.name) setCompanyName(res.company.name);
        if (res.company?.annualTarget?.targetPassengers) {
          setTargetQuota(String(res.company.annualTarget.targetPassengers));
        }
      } else {
        setError(res?.error || `Failed to load Company #${code}`);
      }
    } catch (err) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyDetails();
  }, [code]);

  const handleAssignOwner = async (e) => {
    e.preventDefault();
    if (!ownerEmail.trim()) return;
    setAssignLoading(true);
    try {
      const res = await api.assignCompanyOwner(code, {
        ownerEmail: ownerEmail.trim(),
        companyName: companyName.trim() || undefined
      });
      if (res.success) {
        setActionSuccess(res.message || 'Owner assigned successfully!');
        setTimeout(() => {
          setAssignModalOpen(false);
          setActionSuccess('');
          fetchCompanyDetails();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to assign owner');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUpdateTarget = async (e) => {
    e.preventDefault();
    setTargetLoading(true);
    try {
      const res = await api.updateCompanyTarget(code, Number(targetQuota));
      if (res.success) {
        setActionSuccess(res.message || 'Quota updated successfully!');
        setTimeout(() => {
          setTargetModalOpen(false);
          setActionSuccess('');
          fetchCompanyDetails();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to update target');
    } finally {
      setTargetLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Loading Company #{String(code).padStart(2, '0')} Profile...
        </p>
      </div>
    );
  }

  if (error || !companyData) {
    return (
      <div className="w-full space-y-4">
        <Link 
          href="/companies"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to 33 Companies Registry</span>
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span className="text-sm font-black">Company Not Found</span>
          </div>
          <p>{error || 'The requested company could not be found.'}</p>
        </div>
      </div>
    );
  }

  const { company, owner, buses = [], agents = [], stats = {} } = companyData;
  const targetPassengers = stats.targetPassengers || 10000;
  const totalPassengers = stats.totalPassengers || 0;
  const progressPercent = stats.progressPercent || 0;
  const totalGMV = stats.totalGMV || 0;

  return (
    <div className="w-full space-y-6">
      {/* Back button */}
      <div>
        <Link 
          href="/companies"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to 33 Companies Registry</span>
        </Link>
      </div>

      {/* Top Company Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-600 text-white flex items-center justify-center font-black text-xl shadow-lg shadow-blue-600/20 shrink-0">
            #{String(code).padStart(2, '0')}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {company.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                company.ownerId
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {company.ownerId ? 'Active Franchise' : 'Unassigned Owner'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Universal Platform Code: <span className="font-mono font-bold text-blue-700">RUP-CO-{String(code).padStart(2, '0')}</span> · Slug: {company.slug}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <button
            onClick={() => setTargetModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Target className="w-4 h-4 text-slate-500" />
            <span>Update Quota ({targetPassengers.toLocaleString('en-IN')})</span>
          </button>
          <button
            onClick={() => setAssignModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/20"
          >
            <UserCheck className="w-4 h-4" />
            <span>{owner ? 'Re-assign Owner' : 'Assign Owner'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Fleet Buses</span>
            <Bus className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{buses.length} Coaches</div>
          <p className="text-[11px] text-slate-500">Standardized 36 sleeper & 40 seater</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Franchise Agents</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{agents.length} Agents</div>
          <p className="text-[11px] text-slate-500">Recruited under Franchise #{code}</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Passengers Carried</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{totalPassengers.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-emerald-600 font-bold">{progressPercent}% of annual target fulfilled</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Gross Bookings (GMV)</span>
            <FileSpreadsheet className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">₹{Number(totalGMV).toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-500">Cumulative tickets volume</p>
        </div>
      </div>

      {/* Target Progress Bar */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              FY 2026-2027 Passenger Quota Fulfillment
            </h3>
          </div>
          <span className="text-xs font-black text-blue-700">{totalPassengers} / {targetPassengers} pax ({progressPercent}%)</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/60">
          <div 
            className="bg-gradient-to-r from-blue-700 to-sky-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Assigned Owner Details */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-600" />
              Company Owner
            </h3>
            {owner && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Verified
              </span>
            )}
          </div>

          {owner ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 font-black text-base flex items-center justify-center border border-blue-200">
                  {owner.name ? owner.name[0].toUpperCase() : 'O'}
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">{owner.name}</h4>
                  <p className="text-xs text-slate-500 font-medium">Company Administrator</p>
                </div>
              </div>

              <div className="space-y-2.5 pt-2 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-bold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" /> Email
                  </span>
                  <span className="font-bold text-slate-900">{owner.email}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-bold flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone
                  </span>
                  <span className="font-bold text-slate-900 font-mono">{owner.phone || 'N/A'}</span>
                </div>

                <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-slate-400 font-bold flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Assigned Since
                  </span>
                  <span className="font-bold text-slate-700">
                    {owner.createdAt ? new Date(owner.createdAt).toLocaleDateString('en-IN') : 'Standard'}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center space-y-3 bg-amber-50/50 rounded-2xl border border-amber-200/60">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-xs font-black text-amber-900">No Owner Assigned</h4>
                <p className="text-[11px] text-amber-700">
                  Assign a registered user as Company Owner to grant them administrative rights over this franchise.
                </p>
              </div>
              <button
                onClick={() => setAssignModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
              >
                Assign Owner Now
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Fleet Buses Table */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Bus className="w-4 h-4 text-blue-600" />
              Fleet Roster ({buses.length} Coaches)
            </h3>
            <Link
              href="/fleet/add"
              className="text-xs font-bold text-blue-700 hover:underline"
            >
              + Add Bus
            </Link>
          </div>

          {buses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                    <th className="py-2.5 px-3">Coach Registration</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Capacity</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {buses.map((bus) => (
                    <tr key={bus._id} className="hover:bg-slate-50/50 transition">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{bus.registrationNumber}</td>
                      <td className="py-2.5 px-3 text-slate-600 font-bold">{bus.layoutType || bus.busType || '36 Sleeper'}</td>
                      <td className="py-2.5 px-3 text-slate-600">{bus.totalSeats || 36} Berths/Seats</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {bus.status || 'ACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 space-y-2">
              <Bus className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold">No buses enrolled for Company #{code} yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Agents Roster Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Franchise Agents ({agents.length} Agents)
          </h3>
          <Link
            href="/agents"
            className="text-xs font-bold text-blue-700 hover:underline"
          >
            Manage All Agents →
          </Link>
        </div>

        {agents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Agent Name</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Referral Code</th>
                  <th className="py-3 px-4 text-right">Wallet Balance</th>
                  <th className="py-3 px-4 text-center">KYC Status</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((ag) => (
                  <tr key={ag._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{ag.name}</div>
                      <div className="text-[10px] text-slate-400">{ag.email}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{ag.phone || 'N/A'}</td>
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">{ag.referralCode || 'N/A'}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      ₹{Number(ag.wallet?.availableBalance || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        ag.kycStatus === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {ag.kycStatus || 'PENDING'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Link
                        href={`/agents/${ag._id}`}
                        className="px-3 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] transition inline-flex items-center gap-1"
                      >
                        <span>View Profile</span>
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No agents registered under Company #{code} yet.</p>
          </div>
        )}
      </div>

      {/* Assign Owner Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Assign Owner to Company #{code}
              </h3>
              <button 
                onClick={() => setAssignModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            {actionSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{actionSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleAssignOwner} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Company Trade Name</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={`e.g. Rupadiya Transporters Co. #${code}`}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Owner Account Email *</label>
                  <input
                    type="email"
                    required
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="Enter owner user email"
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    The user account will be granted COMPANY_OWNER privileges and assigned to this franchise.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAssignModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assignLoading}
                    className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition"
                  >
                    {assignLoading ? 'Saving...' : 'Confirm Assignment'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Target Quota Modal */}
      {targetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Update Annual Quota
              </h3>
              <button 
                onClick={() => setTargetModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 font-bold"
              >
                ✕
              </button>
            </div>

            {actionSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{actionSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleUpdateTarget} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Annual Passenger Commitment</label>
                  <input
                    type="number"
                    required
                    min="100"
                    value={targetQuota}
                    onChange={(e) => setTargetQuota(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-bold"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Required annual passenger target under the Rupadiya Hub platform governance contract.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTargetModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={targetLoading}
                    className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition"
                  >
                    {targetLoading ? 'Saving...' : 'Update Target'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

