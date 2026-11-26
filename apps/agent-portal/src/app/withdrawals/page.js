'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  Wallet,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronRight,
  X,
  CreditCard,
  Send,
  AlertTriangle,
  FileText,
  Lock,
  ArrowUpRight,
  Info
} from 'lucide-react';
import { api } from '../../lib/api';
import { useWallet } from '../../context/WalletContext';

// Standard Indian bank suggestions
const POPULAR_BANKS = [
  'State Bank of India (SBI)',
  'HDFC Bank',
  'ICICI Bank',
  'Punjab National Bank (PNB)',
  'Bank of Baroda',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Canara Bank',
  'Union Bank of India',
  'IndusInd Bank'
];

export default function AgentWithdrawalsPage() {
  const { balance: liveWalletBalance, refreshWallet } = useWallet();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Summary & Requests State
  const [withdrawals, setWithdrawals] = useState([]);
  const [summary, setSummary] = useState({
    totalEarnings: 0,
    withdrawnTotal: 0,
    pendingTotal: 0,
    withdrawableFromEarnings: 0,
    eligibleToWithdraw: 0,
    availableBalance: 0,
    reservedBalance: 0,
    kycStatus: 'NOT_SUBMITTED',
    bankDetails: {},
    hasPendingRequest: false
  });

  // Form State
  const [amount, setAmount] = useState('1000');
  const [method, setMethod] = useState('bank'); // 'bank' or 'upi'
  const [accountName, setAccountName] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [upiId, setUpiId] = useState('');
  const [saveDetails, setSaveDetails] = useState(true);

  // UI Filters & Modals
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [detailModalItem, setDetailModalItem] = useState(null);
  const [copiedText, setCopiedText] = useState('');

  const fetchWithdrawals = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);
    setError('');

    try {
      const res = await api.getMyWithdrawals();
      if (res?.success) {
        setWithdrawals(res.withdrawals || []);
        if (res.summary) {
          setSummary(res.summary);

          // Pre-fill form from saved bank details if available and form is blank
          const b = res.summary.bankDetails || {};
          if (b.accountName && !accountName) setAccountName(b.accountName);
          if (b.bankName && !bankName) setBankName(b.bankName);
          if (b.ifscCode && !ifscCode) setIfscCode(b.ifscCode);
          if (b.upiId && !upiId) setUpiId(b.upiId);
          if (b.accountNumberMasked && !accountNumber) {
            setAccountNumber(b.accountNumberMasked);
            setConfirmAccountNumber(b.accountNumberMasked);
          }
        }
      } else {
        setError(res?.error || 'Failed to fetch withdrawal details');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to payout service');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [accountName, bankName, ifscCode, upiId, accountNumber]);

  useEffect(() => {
    fetchWithdrawals();

    // Listen to real-time events for instant updates
    const handleWalletUpdated = () => fetchWithdrawals(true);
    window.addEventListener('wallet-updated', handleWalletUpdated);

    // Setup listener for WebSocket broadcasts
    const handleWsMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (['WITHDRAWAL_APPROVED', 'WITHDRAWAL_REJECTED', 'WITHDRAWAL_PAYOUT_FAILED', 'COMMISSION_EARNED'].includes(data.event)) {
          fetchWithdrawals(true);
          refreshWallet();
        }
      } catch (e) {}
    };

    window.addEventListener('message', handleWsMessage);

    return () => {
      window.removeEventListener('wallet-updated', handleWalletUpdated);
      window.removeEventListener('message', handleWsMessage);
    };
  }, [fetchWithdrawals, refreshWallet]);

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2500);
  };

  const validateForm = () => {
    const num = Number(amount);
    if (!num || isNaN(num) || num < 500) {
      setError('Minimum withdrawal amount is ₹500.');
      return false;
    }

    if (num > summary.eligibleToWithdraw) {
      setError(`Requested amount exceeds your available commission earnings of ₹${summary.eligibleToWithdraw.toLocaleString('en-IN')}.`);
      return false;
    }

    if (summary.kycStatus !== 'VERIFIED') {
      setError('Withdrawals require verified KYC status. Please complete verification first.');
      return false;
    }

    if (method === 'bank') {
      if (!accountName.trim() || accountName.trim().length < 2) {
        setError('Please enter a valid Account Holder Name.');
        return false;
      }
      if (!accountNumber.trim()) {
        setError('Please enter your Bank Account Number.');
        return false;
      }
      if (accountNumber !== confirmAccountNumber) {
        setError('Bank Account Number and Confirmation Account Number do not match.');
        return false;
      }
      const cleanIfsc = ifscCode.trim().toUpperCase();
      if (!cleanIfsc || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
        setError('Please enter a valid 11-digit IFSC Code (e.g. SBIN0001234, HDFC0001245).');
        return false;
      }
    } else if (method === 'upi') {
      const cleanUpi = upiId.trim();
      if (!cleanUpi || !/^[a-zA-Z0-9.\-_]{2,49}@[a-zA-Z]{2,49}$/.test(cleanUpi)) {
        setError('Please enter a valid UPI Virtual Payment Address (e.g. agent@okaxis, 0000000000@paytm).');
        return false;
      }
    }

    return true;
  };

  const handleOpenConfirm = (e) => {
    e.preventDefault();
    setError('');
    if (validateForm()) {
      setConfirmModalOpen(true);
    }
  };

  const handleExecuteWithdrawal = async () => {
    setSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      const payload = {
        amount: Number(amount),
        saveBankDetails: saveDetails,
        payoutDetails: method === 'bank' ? {
          method: 'bank',
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          ifscCode: ifscCode.trim().toUpperCase(),
          bankName: bankName.trim() || 'Partner Bank'
        } : {
          method: 'upi',
          accountName: accountName.trim() || 'Agent Partner',
          upiId: upiId.trim()
        }
      };

      const res = await api.requestWithdrawal(payload);
      if (res?.success) {
        setSuccessMsg(res.message || `Withdrawal request of ₹${Number(amount).toLocaleString('en-IN')} submitted! Funds are held in escrow awaiting company approval.`);
        setConfirmModalOpen(false);

        // Refresh global wallet and local state
        refreshWallet();
        window.dispatchEvent(new Event('wallet-updated'));
        fetchWithdrawals(true);

        // Scroll to top of table
        setTimeout(() => {
          setSuccessMsg('');
        }, 6000);
      } else {
        setError(res?.error || 'Failed to submit withdrawal request.');
        setConfirmModalOpen(false);
      }
    } catch (err) {
      setError(err.message || 'Error occurred while submitting withdrawal.');
      setConfirmModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  // Filtered History
  const filteredWithdrawals = withdrawals.filter(w => {
    const matchesFilter =
      statusFilter === 'ALL' ||
      w.status === statusFilter;

    const q = searchQuery.toLowerCase().trim();
    if (!q) return matchesFilter;

    const matchesSearch =
      (w._id && w._id.toLowerCase().includes(q)) ||
      (w.utrNumber && w.utrNumber.toLowerCase().includes(q)) ||
      (w.payoutDetails?.accountName && w.payoutDetails.accountName.toLowerCase().includes(q)) ||
      (w.payoutDetails?.bankName && w.payoutDetails.bankName.toLowerCase().includes(q)) ||
      (w.payoutDetails?.accountNumberMasked && w.payoutDetails.accountNumberMasked.toLowerCase().includes(q)) ||
      (w.payoutDetails?.upiId && w.payoutDetails.upiId.toLowerCase().includes(q)) ||
      (w.amount && w.amount.toString().includes(q));

    return matchesFilter && matchesSearch;
  });

  const isKycVerified = summary.kycStatus === 'VERIFIED';
  const OPEN_STATUSES = ['PENDING', 'PROCESSING', 'PAYOUT_FAILED'];
  const hasPendingRequest = summary.hasPendingRequest || withdrawals.some(w => OPEN_STATUSES.includes(w.status));
  const activePending = withdrawals.find(w => OPEN_STATUSES.includes(w.status));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. Header Banner */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider mb-2">
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Earnings Escrow & Payouts</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Commission Withdrawal</h1>
          <p className="text-xs text-slate-500 mt-1">
            Securely transfer your earned passenger booking commissions to your bank account via company-approved IMPS/NEFT.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchWithdrawals(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition cursor-pointer disabled:opacity-50"
            title="Refresh balance and history"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
          <Link
            href="/rewards"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-xs border border-emerald-200 transition"
          >
            <span>View Commissions</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* 2. Feedback Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Top KPI Metric Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Eligible to Withdraw (From Earnings) */}
        <div className="bg-white p-5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-50/20 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Available to Withdraw</span>
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{Number(summary.eligibleToWithdraw || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-1">
            Eligible net booking commission earnings
          </p>
        </div>

        {/* Card 2: Total Commission Earnings */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">All-Time Commissions</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{Number(summary.totalEarnings || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Cumulative cashback & referral credits
          </p>
        </div>

        {/* Card 3: Funds on Hold (Waiting for Company Approval) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">On Hold (Pending)</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl relative">
              <Clock className="w-4 h-4" />
              {summary.pendingTotal > 0 && (
                <span className="w-2 h-2 rounded-full bg-amber-500 absolute top-1 right-1 animate-ping" />
              )}
            </div>
          </div>
          <div className="text-2xl font-black text-amber-700">
            ₹{Number(summary.pendingTotal || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Escrow held awaiting company review
          </p>
        </div>

        {/* Card 4: Total Settled / Disbursed */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Settled & Disbursed</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            ₹{Number(summary.withdrawnTotal || 0).toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Paid directly to agent bank account
          </p>
        </div>
      </div>

      {/* 4. Verification Check Banners */}
      {!isKycVerified ? (
        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 shrink-0 mt-0.5">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-amber-900">
                KYC Verification Required for Bank Withdrawals
              </h3>
              <p className="text-xs text-amber-700 mt-0.5">
                Government financial compliance mandates verified identity documents (Aadhaar/PAN or Nepali Nagarikta) before releasing funds.
              </p>
              <div className="mt-2 text-[11px] font-semibold text-amber-800">
                Current Status: <span className="uppercase px-2 py-0.5 rounded bg-amber-200/60 font-mono">{summary.kycStatus || 'NOT_SUBMITTED'}</span>
              </div>
            </div>
          </div>
          <Link
            href="/kyc"
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-xs transition shrink-0"
          >
            Submit / Complete KYC
          </Link>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 px-4 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-900 font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Agent Verification Verified · Direct Company Settlement Enabled</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-200/70 text-emerald-800">
            KYC Verified
          </span>
        </div>
      )}

      {/* 5. Active Pending Request Callout */}
      {hasPendingRequest && activePending && (
        <div className="bg-white border-2 border-amber-300 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-900">Active Request Under Review by Company</h3>
              <span className="text-[11px] font-mono text-slate-500">#{activePending._id.slice(-6).toUpperCase()}</span>
            </div>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              On Hold (Escrow)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Requested Amount</span>
              <span className="text-base font-black text-slate-900">₹{Number(activePending.amount).toLocaleString('en-IN')}</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Payout Destination</span>
              <span className="font-semibold text-slate-800">
                {activePending.payoutDetails?.method === 'upi' ? 'UPI' : (activePending.payoutDetails?.bankName || 'Bank')}
              </span>
              <span className="text-[11px] text-slate-500 font-mono block">
                {activePending.payoutDetails?.accountNumberMasked || activePending.payoutDetails?.upiId}
              </span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-[10px] text-slate-400 block font-semibold uppercase">Request Date</span>
              <span className="text-slate-700">
                {new Date(activePending.createdAt).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="pt-2">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 mb-1.5">
              <span className="text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 1. Request Submitted
              </span>
              <span className="text-amber-700 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 animate-spin" /> 2. Funds on Escrow Hold
              </span>
              <span className="text-slate-400">3. Company Review</span>
              <span className="text-slate-400">4. Bank Disbursement</span>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex">
              <div className="bg-emerald-500 w-1/4 h-full" />
              <div className="bg-amber-500 w-1/4 h-full animate-pulse" />
              <div className="bg-slate-200 w-1/2 h-full" />
            </div>
          </div>

          <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              Your company manager has received this request. As soon as the company approves and settles the payout, the IMPS/NEFT reference (UTR) will appear in your ledger.
            </span>
          </p>
        </div>
      )}

      {/* 6. Main Action Grid: Form (Left) & Verification Security Notes (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form */}
        <div className="lg:col-span-7 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200/80 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span>Request Earnings Payout</span>
            </h2>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
              Min ₹500
            </span>
          </div>

          <form onSubmit={handleOpenConfirm} className="space-y-4">
            {/* Amount Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">Withdrawal Amount (₹) *</label>
                <span className="text-[11px] text-slate-500">
                  Max: <strong className="text-emerald-700">₹{Number(summary.eligibleToWithdraw || 0).toLocaleString('en-IN')}</strong>
                </span>
              </div>

              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="500"
                  max={summary.eligibleToWithdraw || 500}
                  step="100"
                  required
                  disabled={!isKycVerified || hasPendingRequest || summary.eligibleToWithdraw < 500}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="500"
                  className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-100 disabled:cursor-not-allowed"
                />
              </div>

              {/* Quick Preset Buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                {[500, 1000, 2000, 5000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    disabled={!isKycVerified || hasPendingRequest || preset > summary.eligibleToWithdraw}
                    onClick={() => setAmount(preset.toString())}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      Number(amount) === preset
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    ₹{preset.toLocaleString('en-IN')}
                  </button>
                ))}
                {summary.eligibleToWithdraw >= 500 && (
                  <button
                    type="button"
                    disabled={!isKycVerified || hasPendingRequest}
                    onClick={() => setAmount(summary.eligibleToWithdraw.toString())}
                    className="px-3 py-1 rounded-lg text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 transition cursor-pointer disabled:opacity-40"
                  >
                    All Available (₹{Number(summary.eligibleToWithdraw).toLocaleString('en-IN')})
                  </button>
                )}
              </div>
            </div>

            {/* Payout Method Toggle */}
            <div className="pt-2">
              <label className="text-xs font-bold text-slate-700 block mb-1.5">Payout Method</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMethod('bank')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                    method === 'bank'
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <Building2 className={`w-4 h-4 ${method === 'bank' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">Bank Account</div>
                    <div className="text-[10px] text-slate-500 font-medium">NEFT / IMPS Transfer</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod('upi')}
                  className={`p-3 rounded-xl border text-left flex items-center gap-2.5 transition cursor-pointer ${
                    method === 'upi'
                      ? 'border-emerald-600 bg-emerald-50/50 text-emerald-950 font-bold shadow-xs'
                      : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  <CreditCard className={`w-4 h-4 ${method === 'upi' ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <div>
                    <div className="text-xs font-bold">UPI VPA</div>
                    <div className="text-[10px] text-slate-500 font-medium">Instant VPA Settlement</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Method Specific Fields */}
            {method === 'bank' ? (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Beneficiary Account Holder Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Full name as per Bank Passbook"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    list="bank-suggestions"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. State Bank of India, HDFC Bank"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                  <datalist id="bank-suggestions">
                    {POPULAR_BANKS.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Bank Account Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
                      placeholder="9 to 18 digits"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Confirm Account Number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={confirmAccountNumber}
                      onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\s+/g, ''))}
                      placeholder="Re-enter Account Number"
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono font-bold focus:outline-none ${
                        confirmAccountNumber && accountNumber !== confirmAccountNumber
                          ? 'border-rose-300 bg-rose-50/50 text-rose-900'
                          : confirmAccountNumber && accountNumber === confirmAccountNumber
                          ? 'border-emerald-500 bg-emerald-50/30 text-slate-900'
                          : 'border-slate-300 text-slate-900 focus:border-emerald-600'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Bank IFSC Code <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-mono">11-character alphanumeric</span>
                  </div>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                    placeholder="e.g. SBIN0001234"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold uppercase text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 tracking-wider"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Account Holder Name
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Name as registered on UPI"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    UPI ID / VPA <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value.trim().toLowerCase())}
                    placeholder="e.g. mobile@upi, username@okhdfcbank"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                  />
                </div>
              </div>
            )}

            {/* Save details checkbox */}
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="saveDetails"
                checked={saveDetails}
                onChange={(e) => setSaveDetails(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
              />
              <label htmlFor="saveDetails" className="text-xs text-slate-600 cursor-pointer select-none">
                Save these verified bank details for future commission payouts
              </label>
            </div>

            {/* Escrow explainer */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <div className="font-bold text-slate-800 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Escrow Hold Policy</span>
              </div>
              <p>
                When you submit, ₹{Number(amount || 0).toLocaleString('en-IN')} is reserved from your withdrawable earnings. Your parent company owner verifies the request and disburses the money. Once approved, the UTR code will be recorded in your statement.
              </p>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={
                !isKycVerified ||
                hasPendingRequest ||
                summary.eligibleToWithdraw < 500 ||
                Number(amount) > summary.eligibleToWithdraw ||
                Number(amount) < 500 ||
                submitting
              }
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-98"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {hasPendingRequest
                  ? 'Request Already In Review'
                  : !isKycVerified
                  ? 'KYC Verification Required'
                  : summary.eligibleToWithdraw < 500
                  ? 'Insufficient Withdrawable Earnings'
                  : `Submit Payout Request (₹${Number(amount || 0).toLocaleString('en-IN')})`}
              </span>
            </button>
          </form>
        </div>

        {/* Right Column: Security, Verification & Process Details */}
        <div className="lg:col-span-5 space-y-4">
          {/* Box 1: Why Escrow Hold? */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Withdrawal Rules & Guidelines</span>
            </h3>

            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <strong className="text-slate-800">Earned Profit Only:</strong> Withdrawals can only be initiated from accrued ticket commissions and override bonuses. Deposited wallet balance for booking cannot be cashed out.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <strong className="text-slate-800">Escrow Hold:</strong> When requested, the money is placed on hold (reserved) in your double-entry ledger so it is not double-spent on tickets.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <strong className="text-slate-800">Company Approval:</strong> Your partner bus operator reviews the bank account name against your KYC and authorizes the payout.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <strong className="text-slate-800">Disbursement & UTR:</strong> Once approved, the payment is dispatched via IMPS/NEFT with an official Unique Transaction Reference (UTR) for tax compliance.
                </div>
              </div>
            </div>
          </div>

          {/* Box 2: Verified Bank Account on File */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-blue-600" />
              <span>Current Bank Account on Record</span>
            </h3>

            {summary.bankDetails?.accountNumberMasked || summary.bankDetails?.ifscCode ? (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Account Name:</span>
                  <span className="font-bold text-slate-900">{summary.bankDetails.accountName || 'On Record'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Bank Name:</span>
                  <span className="font-semibold text-slate-800">{summary.bankDetails.bankName || 'Verified Bank'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Account:</span>
                  <span className="font-mono font-bold text-slate-900">{summary.bankDetails.accountNumberMasked}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">IFSC:</span>
                  <span className="font-mono font-bold text-slate-900">{summary.bankDetails.ifscCode}</span>
                </div>
                {summary.bankDetails.upiId && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">UPI ID:</span>
                    <span className="font-mono text-emerald-700">{summary.bankDetails.upiId}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500 text-center">
                No bank account previously saved. Enter your beneficiary details on the left form to register for payouts.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 7. Live Withdrawal Request History & Audit Ledger */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-600" />
              <span>Withdrawal Request History & Settlement Ledger</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Live status, approval milestones, and official banking UTR disbursement codes.
            </p>
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { key: 'ALL', label: 'All Requests' },
              { key: 'PENDING', label: 'On Hold (Pending)' },
              { key: 'PROCESSING', label: 'Payment Processing' },
              { key: 'PAYOUT_FAILED', label: 'Payout Failed' },
              { key: 'APPROVED', label: 'Approved & Settled' },
              { key: 'REJECTED', label: 'Rejected (Refunded)' }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  statusFilter === tab.key
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Request ID, UTR number, bank, or amount..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
          />
        </div>

        {/* History Table */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs flex flex-col items-center gap-2">
            <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
            <span>Loading withdrawal history...</span>
          </div>
        ) : filteredWithdrawals.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs space-y-1">
            <p className="font-semibold text-slate-600">No withdrawal records found.</p>
            <p className="text-[11px]">
              {withdrawals.length === 0
                ? 'Submit your first withdrawal request above to begin cashing out your commission earnings.'
                : 'No requests matched your filter criteria.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-3">Date & Request ID</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Payout Destination</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">UTR / Settlement Info</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWithdrawals.map((w) => {
                  const p = w.payoutDetails || {};
                  const isApproved = w.status === 'APPROVED';
                  const isPending = ['PENDING', 'PROCESSING', 'PAYOUT_FAILED'].includes(w.status);
                  const isRejected = w.status === 'REJECTED';

                  return (
                    <tr key={w._id} className="hover:bg-slate-50/70 transition">
                      {/* Date & ID */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {new Date(w.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="font-mono text-[10px] text-slate-400">
                          #{w._id.slice(-8).toUpperCase()} · {new Date(w.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-3">
                        <span className="text-sm font-black text-slate-900">
                          ₹{Number(w.amount).toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Destination */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-800">
                          {p.method === 'upi' ? 'UPI Transfer' : (p.bankName || 'Bank Transfer')}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {p.accountNumberMasked || p.upiId || 'Direct Account'}
                        </div>
                        {p.ifscCode && (
                          <div className="text-[10px] font-mono text-slate-400">
                            IFSC: {p.ifscCode}
                          </div>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {isPending && <Clock className="w-3 h-3 animate-spin text-amber-600" />}
                          {isApproved && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                          {isRejected && <AlertCircle className="w-3 h-3 text-rose-600" />}
                          <span>
                            {w.status === 'PROCESSING'
                              ? 'Payment under processing'
                              : w.status === 'PAYOUT_FAILED'
                              ? 'Payment failed — being retried'
                              : isPending
                              ? 'On Hold (Escrow)'
                              : isApproved
                              ? 'Disbursed to Bank'
                              : 'Rejected (Refunded)'}
                          </span>
                        </span>
                      </td>

                      {/* UTR / Notes */}
                      <td className="py-3.5 px-3">
                        {isApproved ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <span className="font-mono font-bold text-slate-900 text-[11px]">
                                {w.utrNumber || 'SETTLED'}
                              </span>
                              {w.utrNumber && (
                                <button
                                  onClick={() => handleCopy(w.utrNumber)}
                                  className="text-slate-400 hover:text-slate-600 p-0.5"
                                  title="Copy UTR"
                                >
                                  {copiedText === w.utrNumber ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                            <span className="text-[10px] text-emerald-700 block">
                              IMPS Disbursement Confirmed
                            </span>
                          </div>
                        ) : isRejected ? (
                          <div className="text-[11px] text-rose-700">
                            <span className="font-semibold block truncate max-w-[200px]" title={w.rejectionReason}>
                              {w.rejectionReason || 'Rejected by Company'}
                            </span>
                            <span className="text-[10px] text-slate-400">Funds refunded to wallet</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Waiting for Company Approval
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <button
                          onClick={() => setDetailModalItem(w)}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                        >
                          View Receipt
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 8. Confirmation Modal Before Request Submission */}
      {confirmModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Confirm Withdrawal Request</h3>
                  <p className="text-[11px] text-slate-500">Review payout details prior to escrow reservation</p>
                </div>
              </div>
              <button
                onClick={() => setConfirmModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center border-b border-slate-200/60 pb-2">
                <span className="text-slate-500 font-medium">Withdrawal Amount:</span>
                <span className="text-base font-black text-slate-900">₹{Number(amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Payout Method:</span>
                <span className="font-bold text-slate-800">{method === 'bank' ? 'Bank Transfer (IMPS)' : 'UPI Transfer'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Beneficiary Name:</span>
                <span className="font-semibold text-slate-800">{accountName}</span>
              </div>
              {method === 'bank' ? (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Bank Name:</span>
                    <span className="font-semibold text-slate-800">{bankName || 'Partner Bank'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">Account Number:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {accountNumber.length > 4 ? `XXXX-XXXX-${accountNumber.slice(-4)}` : accountNumber}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500 font-medium">IFSC Code:</span>
                    <span className="font-mono font-bold text-slate-900">{ifscCode}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">UPI ID:</span>
                  <span className="font-mono font-bold text-emerald-700">{upiId}</span>
                </div>
              )}
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                ₹{Number(amount).toLocaleString('en-IN')} will be held in escrow from your commission earnings. Your company manager will verify and approve disbursement.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteWithdrawal}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <span>Confirm & Hold Funds</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Receipt / Audit Details Modal */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Official Settlement Voucher</h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    ID: #{detailModalItem._id}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDetailModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Voucher Amount Strip */}
            <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">Payout Amount</span>
                <span className="text-2xl font-black text-emerald-400">₹{Number(detailModalItem.amount).toLocaleString('en-IN')}</span>
              </div>
              <div className="text-right">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                  detailModalItem.status === 'APPROVED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : ['PENDING', 'PROCESSING'].includes(detailModalItem.status)
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                }`}>
                  {detailModalItem.status}
                </span>
                <span className="text-[10px] text-slate-400 block mt-1">
                  {detailModalItem.payoutDetails?.method === 'upi' ? 'UPI Payout' : 'IMPS Bank Transfer'}
                </span>
              </div>
            </div>

            {/* Detailed Table */}
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Beneficiary Holder:</span>
                <span className="font-bold text-slate-900">{detailModalItem.payoutDetails?.accountName || 'Agent'}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Destination Account:</span>
                <span className="font-mono font-bold text-slate-900">
                  {detailModalItem.payoutDetails?.accountNumberMasked || detailModalItem.payoutDetails?.upiId}
                </span>
              </div>
              {detailModalItem.payoutDetails?.bankName && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Bank Name:</span>
                  <span className="font-semibold text-slate-800">{detailModalItem.payoutDetails.bankName}</span>
                </div>
              )}
              {detailModalItem.payoutDetails?.ifscCode && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">IFSC Code:</span>
                  <span className="font-mono font-bold text-slate-900">{detailModalItem.payoutDetails.ifscCode}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Submission Date:</span>
                <span className="text-slate-700">
                  {new Date(detailModalItem.createdAt).toLocaleString('en-IN')}
                </span>
              </div>
              {detailModalItem.utrNumber && (
                <div className="flex justify-between py-1.5 border-b border-slate-100 bg-emerald-50/50 px-2 rounded-lg">
                  <span className="text-emerald-900 font-bold">Banking UTR Reference:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-black text-emerald-800">{detailModalItem.utrNumber}</span>
                    <button
                      onClick={() => handleCopy(detailModalItem.utrNumber)}
                      className="text-emerald-600 hover:text-emerald-800"
                      title="Copy UTR"
                    >
                      {copiedText === detailModalItem.utrNumber ? (
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              )}
              {detailModalItem.reviewedAt && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Reviewed / Disbursed At:</span>
                  <span className="text-slate-700">
                    {new Date(detailModalItem.reviewedAt).toLocaleString('en-IN')}
                  </span>
                </div>
              )}
              {detailModalItem.rejectionReason && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-1">
                  <span className="text-rose-800 font-bold block text-xs">Rejection Note from Company:</span>
                  <p className="text-rose-700 text-[11px]">{detailModalItem.rejectionReason}</p>
                  <span className="text-[10px] text-slate-500 block pt-1">
                    * The reserved amount has been credited back to your available wallet balance.
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-400 font-mono">
                Rupadiya Escrow Protocol v2.4
              </span>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition cursor-pointer"
              >
                Close Voucher
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
