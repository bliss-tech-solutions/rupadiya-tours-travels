'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  XCircle, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Clock,
  Calendar,
  Wallet,
  ArrowRight
} from 'lucide-react';
import { api } from '../../lib/api';

function CancelTicketContent() {
  const searchParams = useSearchParams();
  const initialPnr = searchParams.get('pnr') || '';

  const [pnr, setPnr] = useState(initialPnr);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [cancellationResult, setCancellationResult] = useState(null);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!pnr.trim()) {
      setError('Please enter a ticket number or PNR');
      return;
    }

    setLoading(true);
    setError('');
    setTicket(null);
    setCancellationResult(null);

    try {
      const res = await api.searchTicket({
        q: pnr.trim(),
        fromDate: fromDate || undefined,
        toDate: toDate || undefined
      });

      const bookingData = res.booking || res.data || res;
      if (res.success && bookingData && bookingData.pnr) {
        setTicket(bookingData);
      } else {
        setError(res.error || 'Ticket not found matching PNR and date range.');
      }
    } catch (err) {
      setError(err.message || 'Error looking up ticket');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialPnr) {
      handleSearch();
    }
  }, [initialPnr]);

  const computePolicy = () => {
    if (!ticket) return { feePercent: 10, refundPercent: 90, tier: '>= 24 Hours' };
    const trip = ticket.trip || ticket.tripId || {};
    const depTimeStr = trip.departureDate || new Date().toISOString();
    const depTime = new Date(depTimeStr).getTime();
    const now = Date.now();
    const hoursRemaining = (depTime - now) / (1000 * 60 * 60);

    if (hoursRemaining >= 24) {
      return { feePercent: 10, refundPercent: 90, tier: 'Standard (More than 24h prior)' };
    } else if (hoursRemaining >= 12) {
      return { feePercent: 25, refundPercent: 75, tier: '12 to 24 Hours prior' };
    } else if (hoursRemaining >= 4) {
      return { feePercent: 50, refundPercent: 50, tier: '4 to 12 Hours prior' };
    } else {
      return { feePercent: 100, refundPercent: 0, tier: 'Within 4 Hours (Non-refundable)' };
    }
  };

  const policy = computePolicy();
  const originalFare = Number(ticket?.pricing?.totalPrice || ticket?.totalAmount || 0);
  const cancellationFee = Math.round((originalFare * policy.feePercent) / 100);
  const netRefund = Math.max(0, originalFare - cancellationFee);

  const handleConfirmCancel = async () => {
    if (!confirm(`Confirm cancellation of ticket #${ticket.pnr}? Refund of ₹${netRefund} will be credited to your agent wallet.`)) {
      return;
    }

    setCancelling(true);
    setError('');

    try {
      const res = await api.cancelTicket({
        bookingId: ticket.pnr,
        pnr: ticket.pnr,
        reason: 'Customer requested cancellation'
      });

      if (res.success) {
        setCancellationResult(res.data || res);
        window.dispatchEvent(new Event('wallet-updated'));
      } else {
        setError(res.error || 'Cancellation request failed');
      }
    } catch (err) {
      setError(err.message || 'Error processing ticket cancellation');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs">
        <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 block mb-1">
          Ticket Cancellation Desk
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Cancel Ticket</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Find ticket by PNR and travel date range to process cancellation and receive wallet refund
        </p>
      </div>

      {/* Cancellation Success State */}
      {cancellationResult ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              Ticket Cancelled Successfully
            </span>
            <h2 className="text-2xl font-bold text-slate-900 mt-2">
              Refund Credited: ₹{Number(cancellationResult.refundAmount ?? netRefund).toLocaleString('en-IN')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              PNR: <strong className="font-mono text-slate-800">#{cancellationResult.pnr || ticket?.pnr}</strong>
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Seats Released:</span>
              <span className="text-emerald-700 font-bold">{cancellationResult.seatsReleased?.join(', ') || 'All Seats'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Cancellation Fee:</span>
              <span className="text-rose-700 font-bold">₹{Number(cancellationResult.cancellationFee ?? cancellationFee).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Credited to Agent Wallet:</span>
              <span className="text-slate-900 font-bold">₹{Number(cancellationResult.refundAmount ?? netRefund).toLocaleString('en-IN')}</span>
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <Link
              href="/statement"
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs transition text-center shadow-xs"
            >
              View Wallet Statement
            </Link>
            <button
              onClick={() => {
                setTicket(null);
                setCancellationResult(null);
                setPnr('');
              }}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition text-center"
            >
              Cancel Another Ticket
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Search Form with PNR + Date Range (From - To) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Ticket No / PNR <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={pnr}
                      onChange={(e) => setPnr(e.target.value)}
                      placeholder="e.g. BK_RUP_10001"
                      className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:outline-none focus:border-rose-500 uppercase"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    From Date
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-none focus:border-rose-500"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs transition active:scale-95 flex items-center gap-2 shadow-xs"
                >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Find Ticket'}
                </button>
              </div>
            </form>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Ticket Information & Policy Breakdown */}
          {ticket && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
              {ticket.status === 'CANCELLED' ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <XCircle className="w-5 h-5 shrink-0" />
                  <span>This ticket has already been cancelled.</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-slate-500">Ticket Found</span>
                      <div className="text-base font-bold text-slate-900">PNR: #{ticket.pnr}</div>
                      <div className="text-xs text-slate-600">
                        {ticket.trip?.sourceCity || ticket.tripId?.sourceCity} → {ticket.trip?.destinationCity || ticket.tripId?.destinationCity} • Seats: {ticket.seats?.map(s => s.seatNumber || s).join(', ') || ticket.seatNumbers?.join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-slate-500">Original Fare</span>
                      <div className="text-lg font-bold text-slate-900">₹{originalFare.toLocaleString('en-IN')}</div>
                    </div>
                  </div>

                  {/* Policy Card */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-600" /> Cancellation Policy Tier
                      </span>
                      <span className="text-[10px] bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded border border-amber-200">
                        {policy.tier}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Deduction Fee</span>
                        <span className="text-rose-700 font-bold">{policy.feePercent}% (₹{cancellationFee})</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Refund %</span>
                        <span className="text-emerald-700 font-bold">{policy.refundPercent}%</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="text-[10px] text-slate-500 block">Net Refund</span>
                        <span className="text-slate-900 font-bold">₹{netRefund.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={handleConfirmCancel}
                    className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition active:scale-98 flex items-center justify-center gap-2 shadow-xs"
                  >
                    {cancelling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" /> Processing Cancellation...
                      </>
                    ) : (
                      <>Confirm Cancellation & Refund ₹{netRefund.toLocaleString('en-IN')} to Wallet →</>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function CancelTicketPage() {
  return (
    <Suspense fallback={
      <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
        <RefreshCw className="w-6 h-6 animate-spin text-rose-600" />
        <span className="text-xs font-semibold">Loading Cancellation Desk...</span>
      </div>
    }>
      <CancelTicketContent />
    </Suspense>
  );
}
