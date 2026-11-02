'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, Wallet, PlusCircle, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import AgentSidebar from './Sidebar';
import RealtimeAgentListener from './RealtimeNotificationListener';
import { useWallet } from '../context/WalletContext';
import { isAgentSessionValid, api } from '../lib/api';

export default function AgentLayoutShell({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { balance, loading, refreshWallet, agent } = useWallet();

  // Close mobile drawer when route changes and verify agent session
  useEffect(() => {
    setMobileMenuOpen(false);
    if (!isLoginPage && typeof window !== 'undefined') {
      api.me().then(res => {
        if (res?.user && res.user.role !== 'AGENT') {
          try {
            localStorage.removeItem('agent_token');
            localStorage.removeItem('agent_user');
          } catch {}
          window.location.href = '/login?reason=unauthorized_role';
        }
      }).catch(() => {});
    }
  }, [pathname, isLoginPage]);

  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-50 text-slate-900">{children}</main>;
  }

  if (typeof window !== 'undefined' && !isAgentSessionValid()) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const agentCode = agent?.referralCode || agent?.agentCode || 'RUP-AGT';
  const displayName = agent?.name || agent?.agencyName || 'Rupadiya Partner';

  return (
    <div className="h-screen w-full bg-slate-50 text-slate-900 flex flex-col md:flex-row overflow-hidden">
      {/* Mobile Top Navbar (Visible on < md) */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 -ml-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition active:scale-95"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              R
            </div>
            <div>
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block leading-none">
                Agent Terminal
              </span>
              <span className="text-xs font-bold text-slate-900 truncate max-w-[120px] block" suppressHydrationWarning>
                {displayName}
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Balance Pill & Quick Topup */}
        <div className="flex items-center gap-2">
          <Link
            href="/deposit"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600" />
            <span suppressHydrationWarning>{balance !== null ? `₹${Number(balance).toLocaleString('en-IN')}` : '₹...'}</span>
          </Link>
          <Link
            href="/deposit"
            className="p-1.5 rounded-lg bg-emerald-600 text-white shadow-xs"
            title="Make Deposit"
          >
            <PlusCircle className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Backdrop overlay for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar (Responsive drawer on mobile, static on desktop) */}
      <AgentSidebar
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />

      {/* Right Area (Desktop Top Bar + Scrollable Content Body) */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-slate-50">
        
        {/* Desktop Sticky Top Navigation Bar */}
        <header className="hidden md:flex shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-6 lg:px-8 py-3.5 items-center justify-between gap-4 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 font-mono" suppressHydrationWarning>
                {agentCode}
              </span>
              <span className="text-sm font-bold text-slate-900" suppressHydrationWarning>
                {displayName}
              </span>
            </div>
            <div className="hidden lg:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Verified Counter</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Wallet Balance Badge with Animated Pulse */}
            <Link
              href="/deposit"
              className="flex items-center gap-3 px-3.5 py-1.5 rounded-xl bg-emerald-50/90 border border-emerald-200 hover:bg-emerald-100/70 text-emerald-800 transition shadow-2xs group cursor-pointer"
              title="Click to view ledger or make deposit"
            >
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Wallet className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider leading-none">
                  Wallet Balance
                </div>
                <div className="text-sm font-black text-slate-900 leading-tight" suppressHydrationWarning>
                  {balance !== null ? `₹${Number(balance).toLocaleString('en-IN')}` : '₹...'}
                </div>
              </div>
            </Link>

            {/* Quick "+ Deposit" Button */}
            <Link
              href="/deposit"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition active:scale-98"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Deposit</span>
            </Link>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => refreshWallet()}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Refresh Wallet Balance"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </header>

        {/* Main Content Area (Full responsive space utilization on XL & large screens) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full">
          <div className="w-full max-w-[1720px] mx-auto px-1 sm:px-2 lg:px-4">
            {children}
          </div>
        </main>
      </div>
      <RealtimeAgentListener />
    </div>
  );
}
