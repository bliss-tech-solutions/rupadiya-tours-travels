'use client';

import Link from 'next/link';
import PhoneInput from '../../components/ui/PhoneInput';
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  UserCheck, 
  Target, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Edit3,
  ChevronLeft, 
  ChevronRight, 
  PlusCircle,
  MapPin,
  Coins
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
    shortCode: '',
    name: '',
    shareCapital: 0,
    city: '',
    state: '',
    address: '',
    contactPhone: '',
    contactEmail: '',
    status: 'ACTIVE',
    targetPassengers: '12000'
  });

  // New Company & Owner state
  const [newCompCode, setNewCompCode] = useState('');
  const [newShortCode, setNewShortCode] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [newShareCapital, setNewShareCapital] = useState('0');
  const [newCity, setNewCity] = useState('');
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
      shortCode: c.shortCode || '',
      name: c.name || '',
      shareCapital: c.shareCapital || 0,
      city: c.city || 'Rupadiya',
      state: c.state || 'Uttar Pradesh',
      address: c.address || '',
      contactPhone: c.contactPhone || '',
      contactEmail: c.contactEmail || '',
      status: c.status || 'ACTIVE',
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
        name: editForm.name,
        shortCode: editForm.shortCode,
        shareCapital: Number(editForm.shareCapital) || 0,
        city: editForm.city,
        state: editForm.state,
        address: editForm.address,
        contactPhone: editForm.contactPhone,
        contactEmail: editForm.contactEmail,
        status: editForm.status,
        targetPassengers: Number(editForm.targetPassengers) || 12000
      });

      if (res?.success) {
        setSuccessMsg(`Franchise carrier ${editForm.shortCode || editForm.name} updated successfully.`);
        setEditModalOpen(false);
        fetchCompanies();
      } else {
        alert(res?.error || 'Failed to update company details');
      }
    } catch (err) {
      alert(err.message || 'Network error updating company');
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
        companyName: companyName.trim()
      });
      if (res?.success) {
        setSuccessMsg(`Owner ${ownerEmail} assigned to ${selectedComp.shortCode || selectedComp.name} successfully.`);
        setAssignModalOpen(false);
        fetchCompanies();
      } else {
        alert(res?.error || 'Failed to assign owner');
      }
    } catch (err) {
      alert(err.message || 'Error assigning owner');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTargetSubmit = async (e) => {
    e.preventDefault();
    if (!selectedComp || !targetQuota) return;
    setSubmitting(true);
    try {
      const res = await api.updateCompanyTarget(selectedComp.companyCode, Number(targetQuota));
      if (res?.success) {
        setSuccessMsg(`Target for ${selectedComp.shortCode || selectedComp.name} updated to ${Number(targetQuota).toLocaleString('en-IN')} pax.`);
        setTargetModalOpen(false);
        fetchCompanies();
      } else {
        alert(res?.error || 'Failed to update target');
      }
    } catch (err) {
      alert(err.message || 'Error updating target');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateCompanyWithOwner = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.createCompanyWithOwner({
        companyCode: Number(newCompCode) || undefined,
        shortCode: newShortCode.trim().toUpperCase(),
        name: newCompName.trim(),
        shareCapital: Number(newShareCapital) || 0,
        city: newCity.trim() || 'Rupadiya',
        targetPassengers: Number(newTarget) || 12000,
        ownerName: newOwnerName.trim(),
        ownerEmail: newOwnerEmail.trim(),
        ownerPhone: newOwnerPhone.trim(),
        ownerPassword: newOwnerPassword
      });

      if (res?.success) {
        setSuccessMsg(`Franchise carrier ${newShortCode || newCompName} registered successfully.`);
        setCreateModalOpen(false);
        setNewCompCode('');
        setNewShortCode('');
        setNewCompName('');
        setNewShareCapital('0');
        setNewCity('');
        setNewOwnerName('');
        setNewOwnerEmail('');
        setNewOwnerPhone('');
        fetchCompanies();
      } else {
        alert(res?.error || 'Failed to create company');
      }
    } catch (err) {
      alert(err.message || 'Error registering company');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter & Search Logic
  const filtered = useMemo(() => {
    return companies.filter(c => {
      if (statusFilter === 'ACTIVE' && c.status !== 'ACTIVE') return false;
      if (statusFilter === 'SUSPENDED' && c.status !== 'SUSPENDED') return false;
      if (statusFilter === 'UNASSIGNED' && c.ownerId != null) return false;

      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase().trim();
      const name = (c.name || '').toLowerCase();
      const shortCode = (c.shortCode || '').toLowerCase();
      const codeStr = String(c.companyCode || '');
      const city = (c.city || '').toLowerCase();
      const ownerEmail = (c.ownerId?.email || '').toLowerCase();
      const ownerName = (c.ownerId?.name || '').toLowerCase();
      const phone = (c.contactPhone || '').toLowerCase();

      return (
        name.includes(term) ||
        shortCode.includes(term) ||
        codeStr.includes(term) ||
        city.includes(term) ||
        ownerEmail.includes(term) ||
        ownerName.includes(term) ||
        phone.includes(term)
      );
    });
  }, [companies, statusFilter, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(start, start + ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const assignedCount = companies.filter(c => c.ownerId != null).length;
  const activeCount = companies.filter(c => c.status === 'ACTIVE').length;
  const totalCapital = companies.reduce((sum, c) => sum + (c.shareCapital || 0), 0);

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <Building2 className="w-3.5 h-3.5" />
            <span>Master Franchise Registry</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Companies Registry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-3xl">
            Directory of affiliated franchise carriers, codes, profiles, share capital details, and assigned operators.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
          <button
            onClick={() => {
              const highest = companies.reduce((max, c) => Math.max(max, c.companyCode || 0), 0);
              setNewCompCode(String(highest + 1));
              setCreateModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center gap-2 cursor-pointer transition shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Register Franchise Slot</span>
          </button>
          <button
            onClick={fetchCompanies}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-200/90 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-2 cursor-pointer transition shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200/60 text-rose-700 text-xs font-semibold flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary KPI Cards - Responsive Grid for md, lg, xl */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Franchise Carriers</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{companies.length} Carriers</div>
          <span className="text-[11px] text-slate-500 font-medium">Franchise Network Registry</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Share Capital </span>
            <Coins className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">₹{totalCapital.toLocaleString('en-IN')}</div>
          <span className="text-[11px] text-slate-500 font-medium">Cumulated Network Capital</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assigned Operators</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-blue-700">{assignedCount} Assigned</div>
          <span className="text-[11px] text-slate-500 font-medium">{Math.max(0, companies.length - assignedCount)} slots unassigned</span>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl space-y-1 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Active Status</span>
            <Building2 className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700">{activeCount} / {companies.length} Active</div>
          <span className="text-[11px] text-slate-500 font-medium">Authorized to Dispatch & Book</span>
        </div>
      </div>

      {/* Companies Table Card */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Franchise Carriers Directory ({filtered.length} of {companies.length})
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Click &quot;Edit Details&quot; to update company profile, share capital, contacts, or status.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Status Filters */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
              {[
                { id: 'ALL', label: `All (${companies.length})` },
                { id: 'ACTIVE', label: 'Active' },
                { id: 'SUSPENDED', label: 'Suspended' },
                { id: 'UNASSIGNED', label: 'Unassigned' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    statusFilter === tab.id
                      ? 'bg-white text-blue-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search code, name, city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 bg-slate-50/50"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
            <span className="text-xs font-semibold">Loading companies registry...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 border border-dashed border-slate-200 rounded-2xl space-y-1">
            <Building2 className="w-8 h-8 text-slate-300 mx-auto" />
            <div className="text-sm font-semibold">No franchise carriers found</div>
            <p className="text-xs text-slate-400">Try adjusting your search or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-full -mx-5 sm:mx-0">
            <table className="w-full text-left text-xs min-w-[950px]">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/60 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 w-32">Company Code</th>
                  <th className="py-3 px-4 min-w-[280px]">Carrier & Company Name</th>
                  <th className="py-3 px-4 w-40 text-right">Capital</th>
                  <th className="py-3 px-4 min-w-[190px]">Assigned Operator</th>
                  <th className="py-3 px-4 text-right w-28">Annual Quota</th>
                  <th className="py-3 px-4 text-center w-24">Status</th>
                  <th className="py-3 px-4 text-right w-44">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginated.map((c) => {
                  const owner = c.ownerId;
                  const target = c.annualTarget?.targetPassengers || 12000;
                  const shortCode = c.shortCode || `C${c.companyCode}`;

                  return (
                    <tr key={c.companyCode} className="hover:bg-slate-50/60 transition">
                      {/* Company Code Column (No #01, No rank) */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-blue-50 text-blue-700 border border-blue-200 tracking-wider">
                            {shortCode}
                          </span>
                        </div>
                      </td>

                      {/* Company Name (English + Nepali + City/Contacts) */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900 text-sm">
                          {c.name}
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
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

                      {/* Share Capital  Column */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="font-bold text-slate-900 font-mono text-sm">
                          ₹{Number(c.shareCapital || 0).toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">Capital</span>
                      </td>

                      {/* Owner Details */}
                      <td className="py-3.5 px-4">
                        {owner ? (
                          <div>
                            <div className="font-semibold text-slate-900">{owner.name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{owner.email} · {owner.phone}</div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Target */}
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900">
                        {target.toLocaleString('en-IN')} <span className="text-[10px] text-slate-500 font-normal">pax</span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
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
                            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-semibold text-[11px] border border-slate-200 hover:border-blue-200 transition flex items-center gap-1 cursor-pointer"
                            title="Edit Company Details"
                          >
                            <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                            <span>Edit</span>
                          </button>

                          {/* VIEW DETAILS BUTTON */}
                          <Link
                            href={`/companies/${c.companyCode}`}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-2xs transition flex items-center gap-1"
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
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center gap-1 transition cursor-pointer"
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
                    className={`w-8 h-8 rounded-xl font-semibold transition cursor-pointer ${
                      currentPage === page
                        ? 'bg-blue-600 text-white shadow-xs'
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
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold flex items-center gap-1 transition cursor-pointer"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* EDIT COMPANY DETAILS MODAL */}
      {/* ============================================================== */}
      {editModalOpen && selectedComp && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                  <span>Edit Franchise Carrier Details</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Update operator information, capital, contact details, city, and quota
                </p>
              </div>
              <button 
                onClick={() => setEditModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Code Badge */}
            <div className="p-3 bg-blue-50 border border-blue-200/80 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-blue-700 text-white font-mono font-bold text-sm">
                  {editForm.shortCode}
                </span>
                <div>
                  <span className="text-xs font-semibold text-blue-900 block">
                    Franchise Code {editForm.companyCode}
                  </span>
                  <span className="text-[10px] text-blue-700">
                    Network Carrier Identifier
                  </span>
                </div>
              </div>
            </div>

            <form onSubmit={handleUpdateCompanySubmit} className="space-y-3.5 text-xs">
              {/* Company Display Name & Short Code */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-slate-700 font-semibold block mb-1">Company English Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-medium focus:outline-none focus:border-blue-600"
                    placeholder="e.g. Bageshwari Darshan Tours and Travels"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Short Code *</label>
                  <input
                    type="text"
                    required
                    value={editForm.shortCode}
                    onChange={(e) => setEditForm(prev => ({ ...prev, shortCode: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
                    placeholder="BDTT"
                  />
                </div>
              </div>

              {/* Share Capital */}
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Share Capital</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={editForm.shareCapital}
                  onChange={(e) => setEditForm(prev => ({ ...prev, shareCapital: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
                  placeholder="650000"
                />
              </div>

              {/* City & State */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Headquarters City</label>
                  <input
                    type="text"
                    value={editForm.city}
                    onChange={(e) => setEditForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                    placeholder="Rupadiya"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">State</label>
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
                <label className="text-slate-700 font-semibold block mb-1">Office / Terminal Address</label>
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
                  <label className="text-slate-700 font-semibold block mb-1">Contact Phone</label>
                  <PhoneInput size="sm" value={editForm.contactPhone} onChange={(v) => setEditForm(prev => ({ ...prev, contactPhone: v }))} />
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Official Email</label>
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
                  <label className="text-slate-700 font-semibold block mb-1">Operating Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-blue-600 cursor-pointer"
                  >
                    <option value="ACTIVE">ACTIVE (Authorized to Dispatch & Book)</option>
                    <option value="SUSPENDED">SUSPENDED (Temporarily Blocked)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Annual Passenger Quota</label>
                  <input
                    type="number"
                    min="1000"
                    step="500"
                    value={editForm.targetPassengers}
                    onChange={(e) => setEditForm(prev => ({ ...prev, targetPassengers: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 cursor-pointer shadow-sm transition"
                >
                  {submitting ? 'Saving Changes...' : 'Save Company Details'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* REGISTER NEW FRANCHISE CARRIER MODAL */}
      {/* ============================================================== */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white border border-slate-200 w-full max-w-lg rounded-3xl p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-700" />
                  <span>Register Franchise Carrier & Owner</span>
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Initialize a new franchise carrier in the network registry</p>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleCreateCompanyWithOwner} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Code Number *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    placeholder="e.g. 36"
                    value={newCompCode}
                    onChange={(e) => setNewCompCode(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Short Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. NEWTT"
                    value={newShortCode}
                    onChange={(e) => setNewShortCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">Headquarters</label>
                  <input
                    type="text"
                    placeholder="Rupadiya"
                    value={newCity}
                    onChange={(e) => setNewCity(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Company English Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Himalayan Express Tours and Travels"
                  value={newCompName}
                  onChange={(e) => setNewCompName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Share Capital</label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="100000"
                  value={newShareCapital}
                  onChange={(e) => setNewShareCapital(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 font-mono font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="border-t border-slate-100 pt-2.5">
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block mb-2">Franchise Owner Account</span>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 font-semibold block mb-1">Owner Full Name *</label>
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
                      <label className="text-slate-700 font-semibold block mb-1">Owner Phone *</label>
                      <PhoneInput size="sm" required value={newOwnerPhone} onChange={(v) => setNewOwnerPhone(v)} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 font-semibold block mb-1">Owner Email *</label>
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
                      <label className="text-slate-700 font-semibold block mb-1">Password *</label>
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {submitting ? 'Registering...' : 'Register Company & Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ASSIGN OWNER MODAL */}
      {/* ============================================================== */}
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
                  Code: {selectedComp.shortCode || `C${selectedComp.companyCode}`} · {selectedComp.name}
                </p>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleAssignOwnerSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Company Display Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600 font-medium"
                />
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">Owner Email ID *</label>
                <input
                  type="email"
                  required
                  placeholder="owner@rupadiya.test"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 focus:outline-none focus:border-blue-600"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  The user with this email will be assigned COMPANY_OWNER role for Franchise {selectedComp.shortCode || selectedComp.companyCode}.
                </span>
              </div>

              <div className="pt-2 flex gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 cursor-pointer shadow-sm"
                >
                  {submitting ? 'Binding...' : 'Save & Assign Owner'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* ADJUST TARGET MODAL */}
      {/* ============================================================== */}
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
                  {selectedComp.shortCode || `Code ${selectedComp.companyCode}`} · {selectedComp.name}
                </p>
              </div>
              <button onClick={() => setTargetModalOpen(false)} className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer">✕</button>
            </div>

            <form onSubmit={handleTargetSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">Annual Passenger Target Quota</label>
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
                      className={`py-1 rounded-lg text-xs font-semibold border transition cursor-pointer ${
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
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold disabled:opacity-50 cursor-pointer shadow-sm"
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
