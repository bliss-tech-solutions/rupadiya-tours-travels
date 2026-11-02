'use client';

import Link from 'next/link';
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
  Users, 
  ChevronLeft, 
  ChevronRight, 
  PlusCircle,
  MapPin,
  Phone,
  Mail,
  Award
} from 'lucide-react';
import { api } from '../../lib/api';

const ITEMS_PER_PAGE = 10;

export default function AdminCompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'UNASSIGNED'
  const [currentPage, setCurrentPage] = useState(1);

  // Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedComp, setSelectedComp] = useState(null);

  // Edit Company Details Form
  const [editForm, setEditForm] = useState({
    companyCode: 1,
    rank: 1,
    shortCode: '',
    name: '',
    city: '',
    state: '',
    address: '',
    contactPhone: '',
    contactEmail: '',
    status: 'ACTIVE',
    targetPassengers: '12000'
  });

  // New Company & Owner state
  const [newCompCode, setNewCompCode] = useState('1');
  const [newCompName, setNewCompName] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerPassword, setNewOwnerPassword] = useState('Owner@12345');
  const [newTarget, setNewTarget] = useState('12000');

  // Form states
  const [ownerEmail, setOwnerEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [targetQuota, setTargetQuota] = useState('12000');
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

  const handleOpenEditModal = (c) => {
    setSelectedComp(c);
    setEditForm({
      companyCode: c.companyCode,
      rank: c.rank || c.companyCode,
      shortCode: c.shortCode || `C${c.companyCode}`,
      name: c.name || '',
      city: c.city || 'Rupadiya',
      state: c.state || 'Uttar Pradesh',
      address: c.address || '',
      contactPhone: c.contactPhone || '',
      contactEmail: c.contactEmail || '',
      status: c.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE',
      targetPassengers: String(c.annualTarget?.targetPassengers || 12000)
    });
    setEditModalOpen(true);
  };

  const handleUpdateCompanySubmit = async (e) => {
    e.preventDefault();
    if (!selectedComp) return;

    setSubmitting(true);
    try {
      const res = await api.updateCompany(selectedComp.companyCode, {
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
        setSuccessMsg(res.message || 'Company details updated successfully!');
        setTimeout(() => {
          setEditModalOpen(false);
          setSelectedComp(null);
          setSuccessMsg('');
          fetchCompanies();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to update company details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCompanyWithOwner = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createCompanyWithOwner({
        companyCode: Number(newCompCode),
        name: newCompName.trim(),
        city: newCity.trim(),
        address: newAddress.trim(),
        ownerName: newOwnerName.trim(),
        ownerEmail: newOwnerEmail.trim(),
        ownerPhone: newOwnerPhone.trim(),
        ownerPassword: newOwnerPassword,
        targetPassengers: Number(newTarget) || 12000
      });
      if (res?.success) {
        setSuccessMsg(res.message || 'Company and Owner registered successfully!');
        setTimeout(() => {
          setCreateModalOpen(false);
          setNewCompName('');
          setNewCity('');
          setNewAddress('');
          setNewOwnerName('');
          setNewOwnerEmail('');
          setNewOwnerPhone('');
          setSuccessMsg('');
          fetchCompanies();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to create company and owner');
    } finally {
      setSubmitting(false);
    }
  };

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

  const filtered = companies.filter(c => {
    const matchesSearch = 
      c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
      String(c.companyCode).includes(searchTerm) ||
      String(c.rank).includes(searchTerm) ||
      c.shortCode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ownerId?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.ownerId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'ACTIVE') return c.status === 'ACTIVE';
    if (statusFilter === 'SUSPENDED') return c.status === 'SUSPENDED';
    if (statusFilter === 'UNASSIGNED') return !c.ownerId;

    return true;
  });

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1;
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const assignedCount = companies.filter(c => c.ownerId != null).length;
  const activeCount = companies.filter(c => c.status === 'ACTIVE').length;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Master Franchise Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            34 Companies Registry (Passenger Ranking)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            Fixed franchise rankings (Rank 1: <strong className="text-slate-800">Ntt</strong> to Rank 34: <strong className="text-slate-800">Ott</strong>). Admin can manage and edit franchise display names, contact phone/email, address, active status, and passenger quotas.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition shadow-md shadow-blue-500/20"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register Franchise Slot</span>
          </button>
          <button
            onClick={fetchCompanies}
            className="px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200/90 hover:bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-2 cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-bold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/60 text-rose-700 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-3xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Fixed Ranking Hierarchy</span>
            <Award className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">34 Franchise Codes</div>
          <span className="text-[11px] text-slate-500 font-medium">Rank 1 (#01 Ntt) to Rank 34 (#34 Ott)</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-3xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Assigned Franchise Owners</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">{assignedCount} Assigned</div>
          <span className="text-[11px] text-slate-500 font-medium">{34 - assignedCount} slots pending assignment</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-3xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Status</span>
            <Building2 className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{activeCount} / 34 Active</div>
          <span className="text-[11px] text-slate-500 font-medium">Default Quota: 12,000 pax / company</span>
        </div>
      </div>

      {/* Companies Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Franchise Passenger Ranking Directory ({filtered.length} of 34)
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click &quot;Edit Details&quot; to update company profile, contacts, city, or status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Status Filters */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
              {[
                { id: 'ALL', label: 'All 34' },
                { id: 'ACTIVE', label: 'Active' },
                { id: 'SUSPENDED', label: 'Suspended' },
                { id: 'UNASSIGNED', label: 'Unassigned' }
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer text-[11px] ${
                    statusFilter === f.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search rank, code (e.g. Ntt), name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-600 font-medium"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-500 flex flex-col items-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-bold">Loading 34 companies registry...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200/90 text-slate-500 uppercase text-[10px] font-bold tracking-wider">
                  <th className="py-3 px-3 text-center">Rank</th>
                  <th className="py-3 px-3">Fixed Code</th>
                  <th className="py-3 px-4">Franchise Company Name</th>
                  <th className="py-3 px-4">Assigned Franchise Owner</th>
                  <th className="py-3 px-4 text-right">Annual Target</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((c) => {
                  const owner = c.ownerId;
                  const target = c.annualTarget?.targetPassengers || 12000;
                  const rank = c.rank || c.companyCode;
                  const shortCode = c.shortCode || `C${c.companyCode}`;

                  return (
                    <tr key={c.companyCode} className="hover:bg-slate-50/60 transition">
                      {/* Rank Column */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-xl font-black text-xs ${
                          rank <= 3
                            ? 'bg-amber-100 text-amber-800 border border-amber-300 font-extrabold shadow-2xs'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {rank}
                        </span>
                      </td>

                      {/* Fixed Code Column */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2.5 py-1 rounded-lg font-mono font-black text-xs bg-blue-50 text-blue-700 border border-blue-200 tracking-wider">
                            {shortCode}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            #{String(c.companyCode).padStart(2, '0')}
                          </span>
                        </div>
                      </td>

                      {/* Company Name & Location */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{c.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{c.city || 'Rupadiya'}{c.state ? `, ${c.state}` : ''}</span>
                          {c.contactPhone && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-500">{c.contactPhone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Owner Details */}
                      <td className="py-3.5 px-4">
                        {owner ? (
                          <div>
                            <div className="font-semibold text-slate-900">{owner.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{owner.email} · {owner.phone}</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Target */}
                      <td className="py-3.5 px-4 text-right font-black text-slate-900">
                        {target.toLocaleString('en-IN')} <span className="text-[10px] text-slate-500 font-normal">pax/yr</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-3 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          c.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {c.status || 'ACTIVE'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* EDIT DETAILS BUTTON */}
                          <button
                            onClick={() => handleOpenEditModal(c)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] border border-slate-200 hover:border-blue-200 transition flex items-center gap-1 cursor-pointer"
                            title="Edit Company Details (Name, Phone, City, Status)"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Edit Details</span>
                          </button>

                          {/* VIEW DETAILS BUTTON */}
                          <Link
                            href={`/companies/${c.companyCode}`}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs transition flex items-center gap-1"
                          >
                            <span>Profile</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>

                          {/* ASSIGN OWNER */}
                          <button
                            onClick={() => {
                              setSelectedComp(c);
                              setOwnerEmail(c.ownerId?.email || '');
                              setCompanyName(c.name || '');
                              setAssignModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/90 transition cursor-pointer"
                            title={c.ownerId ? 'Edit Owner Assignment' : 'Assign Owner'}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>

                          {/* ADJUST TARGET */}
                          <button
                            onClick={() => {
                              setSelectedComp(c);
                              setTargetQuota(String(c.annualTarget?.targetPassengers || 12000));
                              setTargetModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200/90 transition cursor-pointer"
                            title="Adjust Annual Quota Target"
                          >
                            <Target className="w-3.5 h-3.5 text-emerald-600" />
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

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-slate-500 font-medium">
              Showing <strong className="text-slate-900 font-bold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</strong> to{' '}
              <strong className="text-slate-900 font-bold">{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)}</strong> of{' '}
              <strong className="text-slate-900 font-bold">{filtered.length}</strong> franchise companies
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-xl font-bold transition cursor-pointer ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-bold flex items-center gap-1 transition cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* EDIT COMPANY DETAILS MODAL (Admin can edit all except fixed code) */}
      {/* ============================================================== */}
      {editModalOpen && selectedComp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                  <span>Edit Franchise Company Details</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Update operator information, contact details, city, and annual quota
                </p>
              </div>
              <button 
                onClick={() => setEditModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Fixed Ranking Banner (Immutable) */}
            <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-700 text-white font-mono font-black text-sm">
                  {editForm.shortCode}
                </span>
                <div>
                  <span className="text-xs font-bold text-blue-900 block">
                    Fixed Code · Rank #{editForm.rank}
                  </span>
                  <span className="text-[10px] text-blue-700">
                    Master Passenger Ranking Code (Permanent)
                  </span>
                </div>
              </div>
              <span className="text-[10px] uppercase font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-blue-200">
                Code #{editForm.companyCode}
              </span>
            </div>

            <form onSubmit={handleUpdateCompanySubmit} className="space-y-3.5 text-xs">
              {/* Company Display Name */}
              <div>
                <label className="text-slate-700 font-bold block mb-1">Franchise Company Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                  placeholder="e.g. Ntt Travels & Logistics"
                />
              </div>

              {/* City & State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Headquarters City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="e.g. Rupadiya / Lucknow"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">State</label>
                  <input
                    type="text"
                    value={editForm.state}
                    onChange={(e) => setEditForm(prev => ({ ...prev, state: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="Uttar Pradesh"
                  />
                </div>
              </div>

              {/* Office Address */}
              <div>
                <label className="text-slate-700 font-bold block mb-1">Office / Terminal Address</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                  placeholder="Transport Nagar, Terminal Slot #1, Rupadiya"
                />
              </div>

              {/* Contact Phone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    value={editForm.contactPhone}
                    onChange={(e) => setEditForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="+91 9876543210"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Official Email</label>
                  <input
                    type="email"
                    value={editForm.contactEmail}
                    onChange={(e) => setEditForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="contact@company.rupadiya.test"
                  />
                </div>
              </div>

              {/* Status & Annual Target */}
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
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20 transition"
                >
                  {submitting ? 'Saving Changes...' : 'Save Company Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE / INITIALIZE COMPANY MODAL */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-700" />
                  <span>Register Franchise Slot & Owner</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Initialize one of the 34 passenger ranking franchise codes</p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateCompanyWithOwner} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Company Code (1 to 34) *</label>
                  <input
                    type="number"
                    min="1"
                    max="34"
                    required
                    placeholder="1 to 34"
                    value={newCompCode}
                    onChange={(e) => setNewCompCode(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Company Display Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ntt Travels & Logistics"
                    value={newCompName}
                    onChange={(e) => setNewCompName(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Rupadiya"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Annual Quota Target</label>
                  <input
                    type="number"
                    min="1000"
                    step="1000"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-2.5">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-2">Franchise Owner Account</span>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 font-bold block mb-1">Owner Full Name *</label>
                      <input
                        type="text"
                        required
                        placeholder="Owner Name"
                        value={newOwnerName}
                        onChange={(e) => setNewOwnerName(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="text-slate-700 font-bold block mb-1">Owner Phone *</label>
                      <input
                        type="tel"
                        required
                        placeholder="9876543210"
                        value={newOwnerPhone}
                        onChange={(e) => setNewOwnerPhone(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 font-bold block mb-1">Owner Email *</label>
                      <input
                        type="email"
                        required
                        placeholder="owner@rupadiya.test"
                        value={newOwnerEmail}
                        onChange={(e) => setNewOwnerEmail(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <div>
                      <label className="text-slate-700 font-bold block mb-1">Password *</label>
                      <input
                        type="text"
                        required
                        value={newOwnerPassword}
                        onChange={(e) => setNewOwnerPassword(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-3 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20"
                >
                  {submitting ? 'Registering...' : 'Register Company & Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN OWNER MODAL */}
      {assignModalOpen && selectedComp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-700" />
                  <span>Assign Franchise Owner</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Rank #{selectedComp.rank || selectedComp.companyCode} · Code: {selectedComp.shortCode || `C${selectedComp.companyCode}`}
                </p>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAssignOwnerSubmit} className="space-y-4 text-xs">
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
                  The user with this email will be assigned COMPANY_OWNER role for Franchise #{selectedComp.companyCode} ({selectedComp.shortCode}).
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
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-blue-500/20"
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
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-slate-200 w-full max-w-md rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Target className="w-5 h-5 text-emerald-700" />
                  <span>Adjust Annual Quota Target</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Rank #{selectedComp.rank || selectedComp.companyCode} · {selectedComp.name} ({selectedComp.shortCode})
                </p>
              </div>
              <button onClick={() => setTargetModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleTargetSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Annual Passenger Target Quota</label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={targetQuota}
                  onChange={(e) => setTargetQuota(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-emerald-700 font-black text-lg focus:outline-none focus:border-blue-600"
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
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 cursor-pointer shadow-md shadow-emerald-500/20"
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
