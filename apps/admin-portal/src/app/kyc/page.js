'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  UserCheck, 
  ShieldCheck, 
  Check, 
  X, 
  FileText, 
  Eye, 
  RefreshCw, 
  AlertCircle, 
  Building2, 
  Search,
  Filter,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { api } from '../../lib/api';
import DocumentViewerModal from '../../components/DocumentViewerModal';
import ConfirmationModal from '../../components/ConfirmationModal';

export default function AdminKycQueuePage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('PENDING'); // 'PENDING' | 'VERIFIED' | 'REJECTED' | 'ALL'
  const [searchTerm, setSearchTerm] = useState('');
  const [approveDoc, setApproveDoc] = useState(null);

  // Document Viewer Modal
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docModalOpen, setDocModalOpen] = useState(false);

  // Rejection Modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [docToReject, setDocToReject] = useState(null);
  const [rejectReason, setRejectReason] = useState('Document illegible or credentials mismatch');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchKycQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const filter = statusFilter === 'ALL' ? '' : statusFilter;
      const res = await api.getPendingKyc(filter);
      if (res?.success) {
        setDocuments(res.documents || []);
      } else {
        setError(res?.error || 'Failed to fetch KYC queue');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to compliance service');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycQueue();
  }, [statusFilter]);

  const handleOpenApprove = (doc) => {
    setApproveDoc(doc);
  };

  const handleExecuteApprove = async () => {
    if (!approveDoc) return;
    setActionLoading(true);
    try {
      const res = await api.approveKyc(approveDoc._id, 'VERIFIED');
      if (res.success) {
        setActionSuccess('KYC document successfully verified!');
        setDocModalOpen(false);
        setApproveDoc(null);
        setTimeout(() => {
          setActionSuccess('');
          fetchKycQueue();
        }, 1000);
      } else {
        alert(res?.error || 'Failed to approve KYC');
      }
    } catch (err) {
      alert(err.message || 'Failed to approve KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!docToReject) return;
    setActionLoading(true);
    try {
      const res = await api.approveKyc(docToReject._id, 'REJECTED', rejectReason.trim());
      if (res.success) {
        setActionSuccess('KYC document rejected with audit note.');
        setRejectModalOpen(false);
        setDocModalOpen(false);
        setDocToReject(null);
        setTimeout(() => {
          setActionSuccess('');
          fetchKycQueue();
        }, 1000);
      }
    } catch (err) {
      alert(err.message || 'Failed to reject KYC');
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = documents.filter(doc => {
    const q = searchTerm.toLowerCase();
    const user = doc.userId || {};
    return (
      user.name?.toLowerCase().includes(q) ||
      user.email?.toLowerCase().includes(q) ||
      user.phone?.includes(q) ||
      doc.documentNumberMasked?.toLowerCase().includes(q) ||
      doc.documentType?.toLowerCase().includes(q) ||
      String(doc.companyCode).includes(q)
    );
  });

  const getDocTypeBadge = (type) => {
    if (type === 'NEPAL_CITIZENSHIP' || type === 'NEPAL_NATIONAL_ID') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">Nepal Nagarikta</span>;
    }
    if (type === 'AADHAAR') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">Aadhaar (UIDAI)</span>;
    }
    if (type === 'PAN') {
      return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">PAN Card</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-50 text-slate-700 border border-slate-200">{type}</span>;
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/90 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-bold uppercase tracking-wider mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Compliance Operations</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Agent KYC Approvals Queue</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Review and verify Aadhaar, PAN, and Nepali Nagarikta credentials before enabling withdrawal settlements and sub-agent recruiting.
          </p>
        </div>

        <button
          onClick={fetchKycQueue}
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-xs transition self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh Queue</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {['PENDING', 'VERIFIED', 'REJECTED', 'ALL'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                statusFilter === st
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
              }`}
            >
              {st === 'ALL' ? 'All Submissions' : st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by agent, phone, ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* KYC Submissions Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Submissions ({filtered.length} Records)
          </h2>
        </div>

        {loading ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500">Loading KYC submissions from database...</p>
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-3 px-4">Applicant Agent</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Document Type</th>
                  <th className="py-3 px-4">ID Number</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Document Preview</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((doc) => {
                  const user = doc.userId || {};
                  return (
                    <tr key={doc._id} className="hover:bg-slate-50/50 transition">
                      <td className="py-3.5 px-4">
                        <Link 
                          href={`/agents/${user._id}`} 
                          className="font-bold text-slate-900 hover:text-blue-700 transition block"
                        >
                          {user.name || 'Agent User'}
                        </Link>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {user.email || 'No email'} · {user.phone || 'No phone'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                        #{String(doc.companyCode || user.companyCode || 1).padStart(2, '0')}
                      </td>

                      <td className="py-3.5 px-4">
                        {getDocTypeBadge(doc.documentType)}
                      </td>

                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {doc.documentNumberMasked}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          doc.status === 'VERIFIED'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : doc.status === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {doc.status}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setDocModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Inspect Doc</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {doc.status === 'PENDING' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenApprove(doc)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] transition cursor-pointer shadow-xs"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDocToReject(doc);
                                  setRejectModalOpen(true);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-bold text-[10px] transition cursor-pointer"
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            <Link
                              href={`/agents/${user._id}`}
                              className="text-[11px] font-bold text-slate-500 hover:text-blue-700 transition flex items-center gap-0.5"
                            >
                              <span>Profile</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="w-10 h-10 text-slate-300 mx-auto" />
            <h4 className="text-xs font-bold text-slate-700">No {statusFilter.toLowerCase()} submissions found</h4>
            <p className="text-[11px] text-slate-400">
              When franchise agents submit Aadhaar, PAN, or Nepali Nagarikta, they will appear in this review queue.
            </p>
          </div>
        )}
      </div>

      {/* KYC Rejection Reason Modal */}
      {rejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <h3 className="text-sm font-bold text-rose-700 uppercase tracking-wider">
              Reject KYC Document
            </h3>
            <p className="text-xs text-slate-600">
              Specify the rejection reason so the agent can upload a valid, readable government credential.
            </p>
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Rejection Reason *</label>
                <textarea
                  required
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-rose-600"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Document Viewer Modal */}
      {selectedDoc && (
        <DocumentViewerModal
          isOpen={docModalOpen}
          onClose={() => setDocModalOpen(false)}
          documentType={selectedDoc.documentType}
          documentNumber={selectedDoc.documentNumberMasked}
          status={selectedDoc.status}
          fileUrl={selectedDoc.fileUrl}
          fileUrlBack={selectedDoc.fileUrlBack}
          onApprove={() => handleOpenApprove(selectedDoc)}
          onReject={() => {
            setDocToReject(selectedDoc);
            setRejectModalOpen(true);
          }}
        />
      )}

      {/* KYC Approval Confirmation Modal */}
      {approveDoc && (
        <ConfirmationModal
          isOpen={Boolean(approveDoc)}
          onClose={() => !actionLoading && setApproveDoc(null)}
          onConfirm={handleExecuteApprove}
          variant="success"
          icon={ShieldCheck}
          title={`Verify ${approveDoc.documentType} for ${approveDoc.agentName || 'Agent'}`}
          message="Confirming this document will mark the agent's KYC record as VERIFIED and authorize ticket issuance."
          confirmText="Approve KYC & Grant Verified Status"
          cancelText="Cancel"
          loading={actionLoading}
          details={[
            { label: 'Document Type', value: approveDoc.documentType, highlight: true },
            { label: 'Document Number', value: approveDoc.documentNumberMasked },
            { label: 'Agent Name', value: approveDoc.agentName || 'Franchise Partner' },
            { label: 'Franchise Company', value: `Company #${approveDoc.companyCode}` }
          ]}
        />
      )}

    </div>
  );
}
