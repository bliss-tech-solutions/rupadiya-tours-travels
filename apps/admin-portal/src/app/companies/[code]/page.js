'use client';

import React, { useState, useEffect } from 'react';
import PhoneInput from '../../../components/ui/PhoneInput';
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
  AlertCircle, 
  CheckCircle2, 
  Phone, 
  Mail, 
  Calendar, 
  TrendingUp, 
  FileSpreadsheet,
  Edit3,
  MapPin,
  Award,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { api } from '../../../lib/api';

export default function AdminCompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const code = params?.code;

  const [companyData, setCompanyData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Company Details modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    city: 'Rupadiya',
    state: 'Uttar Pradesh',
    address: '',
    contactPhone: '',
    contactEmail: '',
    status: 'ACTIVE',
    targetPassengers: '12000'
  });
  const [editLoading, setEditLoading] = useState(false);

  // Re-assign owner modal
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Target update modal
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [targetQuota, setTargetQuota] = useState('12000');
  const [targetLoading, setTargetLoading] = useState(false);

  const fetchCompanyDetails = async () => {
    if (!code) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getCompanyByCode(code);
      if (res?.success) {
        setCompanyData(res);
        if (res.company) {
          setCompanyName(res.company.name || '');
          setEditForm({
            name: res.company.name || '',
            city: res.company.city || 'Rupadiya',
            state: res.company.state || 'Uttar Pradesh',
            address: res.company.address || '',
            contactPhone: res.company.contactPhone || '',
            contactEmail: res.company.contactEmail || '',
            status: res.company.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
            targetPassengers: String(res.company.annualTarget?.targetPassengers || 12000)
          });
          if (res.company.annualTarget?.targetPassengers) {
            setTargetQuota(String(res.company.annualTarget.targetPassengers));
          }
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

  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await api.updateCompany(code, {
        name: editForm.name.trim(),
        city: editForm.city.trim(),
        state: editForm.state.trim(),
        address: editForm.address.trim(),
        contactPhone: editForm.contactPhone.trim(),
        contactEmail: editForm.contactEmail.trim(),
        status: editForm.status,
        targetPassengers: Number(editForm.targetPassengers) || 12000
      });

      if (res?.success) {
        setActionSuccess(res.message || 'Company details updated successfully!');
        setTimeout(() => {
          setEditModalOpen(false);
          setActionSuccess('');
          fetchCompanyDetails();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to update company details');
    } finally {
      setEditLoading(false);
    }
  };

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
          <span>Back to Companies Registry</span>
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span className="text-sm font-bold">Company Not Found</span>
          </div>
          <p>{error || 'The requested company could not be found.'}</p>
        </div>
      </div>
    );
  }

  const { company, owner, buses = [], agents = [], stats = {} } = companyData;
  const targetPassengers = stats.targetPassengers || company?.annualTarget?.targetPassengers || 12000;
  const totalPassengers = stats.totalPassengers || 0;
  const progressPercent = stats.progressPercent || 0;
  const totalGMV = stats.totalGMV || 0;
  const rank = company.rank || company.companyCode;
  const shortCode = company.shortCode || `C${company.companyCode}`;

  return (
    <div className="w-full space-y-6">
      {/* Back button */}
      <div>
        <Link 
          href="/companies"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Companies Registry</span>
        </Link>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Top Company Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex flex-col items-center justify-center font-bold shadow-md shadow-blue-500/20 shrink-0">
            <span className="text-xs uppercase font-mono font-bold leading-none">{shortCode}</span>
            <span className="text-[10px] font-medium opacity-90 mt-1 leading-none">Code {company.companyCode}</span>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {company.name}
                </h1>
              </div>

              {/* Fixed Code Badge */}
              <span className="px-3 py-1 rounded-xl bg-blue-50 text-blue-800 border border-blue-200 font-mono font-bold text-xs tracking-wider">
                Code: {shortCode}
              </span>

              {/* Status Badge */}
              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                company.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {company.status || 'ACTIVE'}
              </span>

              {/* Owner Assignment Status */}
              <span className={`px-2.5 py-1 rounded-xl text-[10px] font-bold ${
                owner
                  ? 'bg-sky-50 text-sky-700 border border-sky-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {owner ? 'Assigned Owner' : 'Unassigned'}
              </span>
            </div>

            <p className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-2">
              <span>Universal Code: <strong className="font-mono text-blue-700">RUP-CO-{String(company.companyCode).padStart(2, '0')}</strong></span>
              <span className="text-slate-300">·</span>
              <span>Slug: <strong className="font-mono">{company.slug}</strong></span>
              {company.city && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="flex items-center gap-1 text-slate-600">
                    <MapPin className="w-3 h-3 text-slate-400" />
                    {company.city}{company.state ? `, ${company.state}` : ''}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          {/* EDIT DETAILS BUTTON */}
          <button
            onClick={() => setEditModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-blue-500/20"
          >
            <Edit3 className="w-4 h-4" />
            <span>Edit Company Details</span>
          </button>

          {/* UPDATE TARGET */}
          <button
            onClick={() => setTargetModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-xs"
          >
            <Target className="w-4 h-4 text-emerald-600" />
            <span>Quota ({Number(targetPassengers).toLocaleString('en-IN')})</span>
          </button>

          {/* ASSIGN OWNER */}
          <button
            onClick={() => setAssignModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-2 transition cursor-pointer"
          >
            <UserCheck className="w-4 h-4 text-blue-600" />
            <span>{owner ? 'Re-assign Owner' : 'Assign Owner'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Fleet Buses</span>
            <Bus className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{buses.length} Coaches</div>
          <p className="text-[11px] text-slate-500">Standardized 36 sleeper & 40 seater</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Franchise Agents</span>
            <Users className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{agents.length} Agents</div>
          <p className="text-[11px] text-slate-500">Recruited under Franchise #{code}</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Passengers Carried</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalPassengers.toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-emerald-600 font-bold">{progressPercent}% of annual target fulfilled</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-bold uppercase tracking-wider">Gross Bookings (GMV)</span>
            <FileSpreadsheet className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{Number(totalGMV).toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-500">Cumulative tickets volume</p>
        </div>
      </div>

      {/* Target Progress Bar */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              FY 2026-2027 Passenger Quota Fulfillment
            </h3>
          </div>
          <span className="text-xs font-bold text-blue-700">{totalPassengers} / {targetPassengers} pax ({progressPercent}%)</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden border border-slate-200/60">
          <div 
            className="bg-gradient-to-r from-blue-700 to-sky-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, progressPercent)}%` }}
          />
        </div>
      </div>

      {/* Middle Two-Column Grid: Company Information & Owner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Company Profile & Editable Settings */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              Franchise Profile & Contacts
            </h3>
            <button
              onClick={() => setEditModalOpen(true)}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-100">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Passenger Ranking</span>
              <div className="flex items-center justify-between mt-1">
                <span className="font-bold text-slate-900 text-sm">Rank #{rank}</span>
                <span className="font-mono font-bold text-blue-700 px-2.5 py-0.5 rounded-lg bg-white border border-blue-200 text-xs">
                  Fixed Code: {shortCode}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400" /> Contact Phone
              </span>
              <span className="font-bold text-slate-900 font-mono">{company.contactPhone || 'Not configured'}</span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" /> Official Email
              </span>
              <span className="font-bold text-slate-900">{company.contactEmail || 'Not configured'}</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
              <span className="text-slate-500 font-bold flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> Office / Hub Terminal Address
              </span>
              <p className="font-bold text-slate-900 pl-5">
                {company.address || `${company.city || 'Rupadiya'}, Uttar Pradesh`}
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-slate-500 font-bold">Dispatch Authorization</span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                company.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {company.status === 'ACTIVE' ? 'ACTIVE / DISPATCH ENABLED' : 'SUSPENDED'}
              </span>
            </div>
          </div>
        </div>

        {/* Center Column: Assigned Owner Details */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Company Owner
            </h3>
            {owner && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Active Account
              </span>
            )}
          </div>

          {owner ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-800 font-bold text-base flex items-center justify-center border border-blue-200">
                  {owner.name ? owner.name[0].toUpperCase() : 'O'}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{owner.name}</h4>
                  <p className="text-xs text-slate-500 font-medium">Franchise Administrator</p>
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
                    <Calendar className="w-3.5 h-3.5 text-slate-400" /> Role Binding
                  </span>
                  <span className="font-bold text-slate-700">COMPANY_OWNER</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center space-y-3 bg-amber-50/50 rounded-2xl border border-amber-200/60">
              <AlertCircle className="w-8 h-8 text-amber-600 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-900">No Owner Assigned</h4>
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

        {/* Right Column: Fleet Buses Preview */}
        <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
              <Bus className="w-4 h-4 text-blue-600" />
              Fleet Coaches ({buses.length})
            </h3>
            <Link
              href="/fleet"
              className="text-xs font-bold text-blue-700 hover:underline"
            >
              View Fleet
            </Link>
          </div>

          {buses.length > 0 ? (
            <div className="space-y-2 overflow-y-auto max-h-56 pr-1">
              {buses.map((bus) => (
                <div key={bus._id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-slate-900 block">{bus.registrationNumber}</span>
                    <span className="text-[10px] text-slate-500">{bus.layoutType || '36 Sleeper'} · {bus.totalSeats || 36} Seats</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {bus.status || 'ACTIVE'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <Bus className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs font-bold">No coaches assigned to this franchise yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Agents Roster Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            Franchise Booking Agents ({agents.length} Agents)
          </h3>
          <Link
            href="/agents"
            className="text-xs font-bold text-blue-700 hover:underline"
          >
            Manage Agents
          </Link>
        </div>

        {agents.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Agent Name</th>
                  <th className="py-2.5 px-3">Referral Code</th>
                  <th className="py-2.5 px-3">Contact</th>
                  <th className="py-2.5 px-3 text-right">Wallet Balance</th>
                  <th className="py-2.5 px-3 text-center">KYC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agents.map((agent) => (
                  <tr key={agent._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{agent.name}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{agent.referralCode || 'N/A'}</td>
                    <td className="py-2.5 px-3 text-slate-500">{agent.email} · {agent.phone}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      ₹{Number(agent.wallet?.availableBalance || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        agent.kycStatus === 'VERIFIED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {agent.kycStatus || 'PENDING'}
                      </span>
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

      {/* ============================================================== */}
      {/* EDIT COMPANY DETAILS MODAL */}
      {/* ============================================================== */}
      {editModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                  <span>Edit Franchise Company Details</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Update operator information, contacts, address, and target
                </p>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            {/* Fixed Ranking Banner */}
            <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-700 text-white font-mono font-bold text-sm">
                  {shortCode}
                </span>
                <div>
                  <span className="text-xs font-bold text-blue-900 block">
                    Fixed Code · Rank #{rank}
                  </span>
                  <span className="text-[10px] text-blue-700">
                    Master Passenger Ranking Slot (Fixed)
                  </span>
                </div>
              </div>
              <span className="text-[10px] uppercase font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-200">
                Code #{company.companyCode}
              </span>
            </div>

            <form onSubmit={handleUpdateCompany} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Franchise Company Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Office / Hub Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Contact Phone</label>
                  <PhoneInput size="sm" value={editForm.contactPhone} onChange={(v) => setEditForm(prev => ({ ...prev, contactPhone: v }))} />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Official Email</label>
                  <input
                    type="email"
                    value={editForm.contactEmail}
                    onChange={(e) => setEditForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Operating Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized to Dispatch & Book)</option>
                    <option value="SUSPENDED">SUSPENDED (Temporarily Blocked)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Annual Passenger Quota</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={editForm.targetPassengers}
                    onChange={(e) => setEditForm(prev => ({ ...prev, targetPassengers: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20 transition"
                >
                  {editLoading ? 'Saving...' : 'Save Company Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RE-ASSIGN OWNER MODAL */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-700" />
                  <span>{owner ? 'Re-assign Franchise Owner' : 'Assign Franchise Owner'}</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Rank #{rank} · Code: {shortCode}</p>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAssignOwner} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Company Display Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 font-semibold"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Owner Email ID *</label>
                <input
                  type="email"
                  required
                  placeholder="owner@rupadiya.test"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  The user with this email will be assigned COMPANY_OWNER role for Franchise #{code} ({shortCode}).
                </span>
              </div>

              <div className="pt-2 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {assignLoading ? 'Assigning...' : 'Save & Assign Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADJUST TARGET MODAL */}
      {targetModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-700" />
                  <span>Adjust Annual Quota Target</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Rank #{rank} · {company.name} ({shortCode})</p>
              </div>
              <button onClick={() => setTargetModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleUpdateTarget} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Annual Passenger Target Quota</label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={targetQuota}
                  onChange={(e) => setTargetQuota(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-emerald-700 font-bold text-lg focus:outline-none focus:border-blue-600"
                />
                <div className="grid grid-cols-4 gap-2 mt-2">
                  {['5000', '10000', '12000', '20000'].map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setTargetQuota(p)}
                      className={`py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                        targetQuota === p ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {Number(p).toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTargetModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={targetLoading}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20"
                >
                  {targetLoading ? 'Updating...' : 'Save Target Quota'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
