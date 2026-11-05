'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, 
  ArrowLeft, 
  Wallet, 
  ShieldCheck, 
  FileText, 
  Clock, 
  Phone, 
  Mail, 
  Building2, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  Ticket,
  Plus,
  Award,
  Lock,
  Unlock,
  ChevronRight
} from 'lucide-react';
import { api } from '../../../lib/api';
import DocumentViewerModal from '../../../components/DocumentViewerModal';
import ConfirmationModal from '../../../components/ConfirmationModal';

export default function CompanyAgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id;

  const [agentData, setAgentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Wallet top-up modal
  const [topupModalOpen, setTopupModalOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('5000');
  const [topupNote, setTopupNote] = useState('Counter working capital replenishment');
  const [topupLoading, setTopupLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  // Document Viewer Modal
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [docModalOpen, setDocModalOpen] = useState(false);

  const fetchAgentDetails = async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.getAgentById(id);
      if (res?.success) {
        setAgentData(res);
      } else {
        setError(res?.error || 'Failed to load agent profile');
      }
    } catch (err) {
      setError(err.message || 'Error connecting to database');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgentDetails();
  }, [id]);

  const handleTopup = async (e) => {
    e.preventDefault();
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) return;
    setTopupLoading(true);
    try {
      const res = await api.addAgentWallet(id, amount, topupNote.trim());
      if (res.success) {
        setActionSuccess(`₹${amount.toLocaleString('en-IN')} added to agent wallet successfully!`);
        setTimeout(() => {
          setTopupModalOpen(false);
          setActionSuccess('');
          fetchAgentDetails();
        }, 1200);
      }
    } catch (err) {
      alert(err.message || 'Failed to add funds to agent');
    } finally {
      setTopupLoading(false);
    }
  };

  const handleToggleStatus = () => {
    setShowStatusModal(true);
  };

  const handleExecuteToggleStatus = async () => {
    if (!agentData?.agent) return;
    const newStatus = !agentData.agent.isActive;
    setStatusLoading(true);
    try {
      const res = await api.toggleAgentStatus(id, newStatus);
      if (res.success) {
        setShowStatusModal(false);
        fetchAgentDetails();
      } else {
        alert(res?.error || 'Failed to update agent status');
      }
    } catch (err) {
      alert(err.message || 'Failed to update agent status');
    } finally {
      setStatusLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          Loading Agent Profile...
        </p>
      </div>
    );
  }

  if (error || !agentData) {
    return (
      <div className="w-full space-y-4">
        <Link 
          href="/agents"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Franchise Agents</span>
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-rose-600" />
            <span className="text-sm font-black">Agent Not Found</span>
          </div>
          <p>{error || 'This agent could not be found in your company registry.'}</p>
        </div>
      </div>
    );
  }

  const { agent, wallet, ledger = [], kycDocuments = [], bookings = [], stats = {} } = agentData;

  return (
    <div className="w-full space-y-6">
      {/* Back button */}
      <div>
        <Link 
          href="/agents"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-700 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Franchise Agents</span>
        </Link>
      </div>

      {/* Top Header Card */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-700 to-sky-600 text-white flex items-center justify-center font-black text-2xl shadow-lg shadow-blue-600/20 shrink-0">
            {agent.name ? agent.name[0].toUpperCase() : 'A'}
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {agent.name}
              </h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                agent.isActive !== false
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}>
                {agent.isActive !== false ? 'Active Franchise Agent' : 'Suspended'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                agent.kycStatus === 'VERIFIED'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                KYC: {agent.kycStatus || 'PENDING'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Agency: <span className="font-bold text-slate-800">{agent.agencyName || 'Counter Agency'}</span> · Email: <span className="font-bold text-slate-700">{agent.email}</span> · Phone: <span className="font-mono font-bold text-slate-700">{agent.phone || 'N/A'}</span> · Referral: <span className="font-mono font-bold text-blue-700">{agent.referralCode || 'N/A'}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto">
          <button
            onClick={handleToggleStatus}
            className={`px-4 py-2.5 rounded-xl border font-bold text-xs flex items-center gap-2 transition cursor-pointer ${
              agent.isActive !== false
                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            {agent.isActive !== false ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{agent.isActive !== false ? 'Suspend Agent' : 'Activate Agent'}</span>
          </button>

          <button
            onClick={() => setTopupModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-800 hover:to-sky-700 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer shadow-md shadow-blue-600/20"
          >
            <Wallet className="w-4 h-4" />
            <span>Add Wallet Funds</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Available Balance</span>
            <Wallet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">₹{Number(wallet.availableBalance || 0).toLocaleString('en-IN')}</div>
          <p className="text-[11px] text-slate-500">Working capital for ticket issuance</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Confirmed Bookings</span>
            <Ticket className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.totalBookings || bookings.length} Seats</div>
          <p className="text-[11px] text-slate-500">Issued for company buses</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Commission Tier</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{stats.commissionTier || 'TIER_1'}</div>
          <p className="text-[11px] text-emerald-600 font-bold">Standard tier commission rate</p>
        </div>

        <div className="bg-white border border-slate-200/90 p-5 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">KYC Compliance</span>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-slate-900">{agent.kycStatus || 'PENDING'}</div>
          <p className="text-[11px] text-slate-500">{kycDocuments.length} document(s) uploaded</p>
        </div>
      </div>

      {/* KYC Documents Section with Preview */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Identity Verification Records (Aadhaar / PAN / Nepali Nagarikta)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {kycDocuments.length} document(s)
          </span>
        </div>

        {kycDocuments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {kycDocuments.map((doc) => (
              <div 
                key={doc._id}
                className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {doc.documentType === 'NEPAL_CITIZENSHIP' ? 'Nepali Nagarikta (Citizenship)' : doc.documentType}
                    </span>
                    <div className="text-sm font-mono font-black text-slate-900 pt-1">
                      ID: {doc.documentNumberMasked}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Submitted: {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('en-IN') : 'Recent'}
                    </p>
                  </div>

                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    doc.status === 'VERIFIED'
                      ? 'bg-emerald-100 text-emerald-800'
                      : doc.status === 'REJECTED'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {doc.status}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/80">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDoc(doc);
                      setDocModalOpen(true);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-blue-700 font-bold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Inspect Document Details</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <FileText className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No identity documents submitted by this agent yet.</p>
          </div>
        )}
      </div>

      {/* Wallet Ledger Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Agent Wallet Ledger ({ledger.length} Recent Transactions)
            </h3>
          </div>
          <button
            onClick={() => setTopupModalOpen(true)}
            className="text-xs font-bold text-blue-700 hover:underline"
          >
            + Add Funds
          </button>
        </div>

        {ledger.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Amount</th>
                  <th className="py-2.5 px-3 text-right">Balance After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 text-slate-500 font-mono">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString('en-IN') : 'Recent'}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        item.entryType === 'CREDIT'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {item.entryType}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-800">
                      {item.description || item.transactionType || 'Balance Adjustment'}
                    </td>
                    <td className={`py-2.5 px-3 text-right font-black ${
                      item.entryType === 'CREDIT' ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {item.entryType === 'CREDIT' ? '+' : '-'}₹{Number(item.amount || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      ₹{Number(item.balanceAfter || 0).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No ledger transactions recorded yet.</p>
          </div>
        )}
      </div>

      {/* Bookings Issued Table */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4 text-blue-700" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Customer Tickets Issued ({bookings.length} Bookings)
            </h3>
          </div>
        </div>

        {bookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 uppercase text-[10px] font-bold">
                  <th className="py-2.5 px-3">PNR</th>
                  <th className="py-2.5 px-3">Passenger</th>
                  <th className="py-2.5 px-3">Seats</th>
                  <th className="py-2.5 px-3 text-right">Fare Paid</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-700">{b.pnr}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">
                      {b.passengerDetails?.[0]?.name || b.primaryPassengerName || 'Passenger'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {Array.isArray(b.seatNumbers) ? b.seatNumbers.join(', ') : '1 Seat'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-black text-slate-900">
                      ₹{Number(b.fareBreakdown?.totalPayable || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {b.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 space-y-2">
            <Ticket className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-bold">No customer ticket bookings issued by this agent yet.</p>
          </div>
        )}
      </div>

      {/* Topup Modal */}
      {topupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl space-y-4 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Add Funds to Agent Wallet
              </h3>
              <button onClick={() => setTopupModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            {actionSuccess ? (
              <div className="p-4 rounded-2xl bg-emerald-50 text-emerald-700 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>{actionSuccess}</span>
              </div>
            ) : (
              <form onSubmit={handleTopup} className="space-y-4 text-xs">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Top-up Amount (₹) *</label>
                  <input
                    type="number"
                    required
                    min="100"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600 font-bold font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Funds will be credited from company working capital to agent's available booking balance.
                  </p>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Transaction Note *</label>
                  <input
                    type="text"
                    required
                    value={topupNote}
                    onChange={(e) => setTopupNote(e.target.value)}
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTopupModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={topupLoading}
                    className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs shadow-md transition"
                  >
                    {topupLoading ? 'Processing...' : 'Confirm Top-up'}
                  </button>
                </div>
              </form>
            )}
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
        />
      )}

      {/* Agent Status Confirmation Modal */}
      {agentData?.agent && (
        <ConfirmationModal
          isOpen={showStatusModal}
          onClose={() => !statusLoading && setShowStatusModal(false)}
          onConfirm={handleExecuteToggleStatus}
          variant={agentData.agent.isActive ? 'warning' : 'success'}
          icon={agentData.agent.isActive ? Lock : Unlock}
          title={agentData.agent.isActive ? `Suspend Agent ${agentData.agent.name}?` : `Activate Agent ${agentData.agent.name}?`}
          message={agentData.agent.isActive 
            ? 'Suspending this agent will immediately revoke ticket booking capabilities and lock agent portal access.' 
            : 'Activating this agent will grant them full booking authority and access to the franchise portal.'}
          confirmText={agentData.agent.isActive ? 'Suspend Agent' : 'Activate Agent'}
          cancelText="Cancel"
          loading={statusLoading}
          details={[
            { label: 'Agent Name', value: agentData.agent.name, highlight: true },
            { label: 'Agency Code', value: agentData.agent.referralCode || 'AGT' },
            { label: 'Phone', value: agentData.agent.phone },
            { label: 'Current Status', value: agentData.agent.isActive ? 'Active' : 'Suspended' }
          ]}
        />
      )}

    </div>
  );
}

