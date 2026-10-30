'use client';

import React, { useState, useEffect } from 'react';
import { 
  FileCheck2, 
  ShieldCheck, 
  Upload, 
  AlertCircle, 
  Check, 
  Building2, 
  FileText, 
  RefreshCw,
  Clock,
  AlertTriangle,
  XCircle,
  Eye,
  CheckCircle2
} from 'lucide-react';
import { api } from '../../lib/api';
import FileUploadProgress from '../../components/FileUploadProgress';

export default function AgentKycPage() {
  const [kycData, setKycData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form states
  const [nationality, setNationality] = useState('INDIA'); // 'INDIA' | 'NEPAL'
  const [documentType, setDocumentType] = useState('AADHAAR');
  const [documentNumber, setDocumentNumber] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [fileUrlBack, setFileUrlBack] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Toggle form view if already submitted
  const [showReuploadForm, setShowReuploadForm] = useState(false);

  const fetchKycStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getKycStatus();
      if (res?.success) {
        setKycData(res);
      } else {
        setError(res?.error || 'Failed to fetch KYC records');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to compliance server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKycStatus();
  }, []);

  // Update default document type when nationality changes
  useEffect(() => {
    if (nationality === 'NEPAL') {
      setDocumentType('NEPAL_CITIZENSHIP');
    } else {
      setDocumentType('AADHAAR');
    }
    setDocumentNumber('');
    setFileUrl('');
    setFileUrlBack('');
  }, [nationality]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!documentNumber.trim()) {
      setError('Please provide a valid document number');
      return;
    }
    if (!fileUrl) {
      setError('Please upload the front side of your identity document (Max 1MB)');
      return;
    }
    if (nationality === 'NEPAL' && !fileUrlBack) {
      setError('Nepali Nagarikta requires both Front and Back sides to be uploaded');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await api.uploadKyc({
        documentType,
        documentNumber: documentNumber.trim(),
        fileUrl,
        fileUrlBack: fileUrlBack || undefined
      });

      if (res?.success) {
        setSuccessMsg('Government credentials uploaded successfully and queued for review.');
        setShowReuploadForm(false);
        setDocumentNumber('');
        setFileUrl('');
        setFileUrlBack('');
        fetchKycStatus();
      } else {
        throw new Error(res?.error || 'Submission failed');
      }
    } catch (err) {
      setError(err.message || 'Failed to submit KYC document');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-sky-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Checking Compliance Status...
        </p>
      </div>
    );
  }

  const overallStatus = kycData?.overallStatus || 'NOT_SUBMITTED';
  const documents = kycData?.documents || [];
  const latestDoc = documents[0];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800 pb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-500/10 text-sky-400 text-xs font-bold uppercase tracking-wider mb-2">
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>Verification & Compliance</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-white">KYC & Agency Verification</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Mandatory government identity compliance for authorized ticket counters in India and Nepal.
        </p>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* KYC Status Banner */}
      {overallStatus === 'VERIFIED' ? (
        <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-3xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <ShieldCheck className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Verification Status: VERIFIED</h3>
              <p className="text-xs text-emerald-400">
                Your government identity credentials are verified and approved by Platform Compliance.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shrink-0">
            Compliant
          </span>
        </div>
      ) : overallStatus === 'PENDING' ? (
        <div className="bg-amber-500/10 border border-amber-500/30 p-6 rounded-3xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <Clock className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Verification Status: UNDER REVIEW</h3>
              <p className="text-xs text-amber-400">
                Your documents have been submitted and are currently awaiting Super Admin review.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-xs uppercase tracking-wider shrink-0">
            Pending
          </span>
        </div>
      ) : overallStatus === 'REJECTED' ? (
        <div className="bg-rose-500/10 border border-rose-500/30 p-6 rounded-3xl space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center font-black shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Verification Status: REJECTED</h3>
                <p className="text-xs text-rose-400">
                  Please review the compliance note below and re-upload valid credentials.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReuploadForm(true)}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
            >
              Re-upload Document
            </button>
          </div>
          {latestDoc?.rejectionReason && (
            <div className="p-3 rounded-2xl bg-slate-900 border border-rose-900/60 text-xs text-rose-300">
              <span className="font-bold text-rose-200">Rejection Reason:</span> {latestDoc.rejectionReason}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 text-slate-400 flex items-center justify-center font-black">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Verification Required</h3>
              <p className="text-xs text-slate-400">
                Upload your Indian Aadhaar/PAN or Nepali Nagarikta to unlock unrestricted withdrawals.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submitted Documents History Card */}
      {documents.length > 0 && !showReuploadForm && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">
              Submitted Identity Records ({documents.length})
            </h2>
            {overallStatus !== 'VERIFIED' && (
              <button
                onClick={() => setShowReuploadForm(true)}
                className="text-xs font-bold text-sky-400 hover:text-sky-300 transition"
              >
                + Submit Another Document
              </button>
            )}
          </div>

          <div className="space-y-3">
            {documents.map((doc) => (
              <div 
                key={doc._id}
                className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-white">
                      {doc.documentType === 'NEPAL_CITIZENSHIP' ? 'Nepali Nagarikta (Citizenship)' : doc.documentType}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      doc.status === 'VERIFIED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : doc.status === 'REJECTED'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    }`}>
                      {doc.status}
                    </span>
                  </div>
                  <p className="text-xs font-mono text-slate-400">
                    ID: {doc.documentNumberMasked} · Submitted on {new Date(doc.createdAt).toLocaleDateString('en-IN')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-xs flex items-center gap-1.5 border border-slate-700"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Front</span>
                    </a>
                  )}
                  {doc.fileUrlBack && (
                    <a
                      href={doc.fileUrlBack}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sky-400 font-bold text-xs flex items-center gap-1.5 border border-slate-700"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KYC Upload Form (Shown when no documents or re-uploading) */}
      {(documents.length === 0 || showReuploadForm) && (
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Upload Identity Credentials
            </h2>
            {documents.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReuploadForm(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            )}
          </div>

          {/* Country Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">Operating Country / Jurisdiction *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setNationality('INDIA')}
                className={`p-3.5 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  nationality === 'INDIA'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>🇮🇳 India Operations</span>
              </button>
              <button
                type="button"
                onClick={() => setNationality('NEPAL')}
                className={`p-3.5 rounded-2xl border text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                  nationality === 'NEPAL'
                    ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <span>🇳🇵 Nepal Cross-Border</span>
              </button>
            </div>
          </div>

          {/* Document Type Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Document Type *</label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-sky-500"
              >
                {nationality === 'INDIA' ? (
                  <>
                    <option value="AADHAAR">Aadhaar Card (UIDAI)</option>
                    <option value="PAN">PAN Card (Income Tax Dept)</option>
                  </>
                ) : (
                  <>
                    <option value="NEPAL_CITIZENSHIP">Nepali Nagarikta (Citizenship Card)</option>
                    <option value="NEPAL_NATIONAL_ID">Nepal National Identity Card (Rastriya Parichayapatra)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                {documentType === 'AADHAAR' ? '12-Digit Aadhaar Number *' :
                 documentType === 'PAN' ? '10-Character PAN Number *' :
                 'Citizenship / Nagarikta Number *'}
              </label>
              <input
                type="text"
                required
                placeholder={
                  documentType === 'AADHAAR' ? 'e.g. 5432 9876 1234' :
                  documentType === 'PAN' ? 'e.g. ABCDE1234F' :
                  'e.g. 64-01-78-12345'
                }
                value={documentNumber}
                onChange={(e) => setDocumentNumber(e.target.value.toUpperCase())}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* File Uploads (Strict Max 1MB Enforced) */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            <div>
              <FileUploadProgress
                label={nationality === 'NEPAL' ? 'Nagarikta Front Side (Max 1MB) *' : 'Document Front Side (Max 1MB) *'}
                description="Upload clear photo or scan of front side (Max 1MB: JPG, PNG, WEBP, PDF)"
                fileUrl={fileUrl}
                onUploadComplete={(url) => setFileUrl(url)}
                onRemove={() => setFileUrl('')}
                required
              />
            </div>

            <div>
              <FileUploadProgress
                label={nationality === 'NEPAL' ? 'Nagarikta Back Side (Max 1MB) *' : 'Document Back Side (Optional, Max 1MB)'}
                description="Upload clear photo or scan of back side (Max 1MB: JPG, PNG, WEBP, PDF)"
                fileUrl={fileUrlBack}
                onUploadComplete={(url) => setFileUrlBack(url)}
                onRemove={() => setFileUrlBack('')}
                required={nationality === 'NEPAL'}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-sky-600/20 transition cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Submitting to Compliance Engine...' : 'Submit Credentials for Review'}
          </button>
        </form>
      )}

    </div>
  );
}
