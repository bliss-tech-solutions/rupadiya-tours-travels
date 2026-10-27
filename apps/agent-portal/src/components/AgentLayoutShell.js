'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, Wallet } from 'lucide-react';
import AgentSidebar from './Sidebar';
import { api } from '../lib/api';

export default function AgentLayoutShell({ children }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);

  const fetchBalance = async () => {
    try {
      if (typeof api.getMyWallet === 'function') {
        const res = await api.getMyWallet();
        const bal = res?.data?.balance ?? res?.wallet?.availableBalance ?? res?.data?.availableBalance ?? res?.balance;
        if (bal != null) {
          setWalletBalance(bal);
          return;
        }
      }
    } catch (e) {}

    try {
      const dash = await api.getDashboard();
      const d = dash?.data || dash;
      const bal = d?.walletBalance ?? d?.wallet?.availableBalance;
      if (bal != null) setWalletBalance(bal);
    } catch (e) {}
  };

  useEffect(() => {
    fetchBalance();
    const handleWalletUpdate = () => fetchBalance();
    window.addEventListener('wallet-updated', handleWalletUpdate);
    return () => window.removeEventListener('wallet-updated', handleWalletUpdate);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-50 text-slate-900">{children}</main>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col md:flex-row">
      {/* Mobile Top Navbar (Visible on < md) */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs">
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
              <span className="text-sm font-bold text-slate-900">Rupadiya</span>
            </div>
          </div>
        </div>

        {/* Mobile Balance Pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800">
          <Wallet className="w-3.5 h-3.5 text-emerald-600" />
          <span>{walletBalance !== null ? `₹${Number(walletBalance).toLocaleString('en-IN')}` : '₹...'}</span>
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

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
        {children}
      </main>
    </div>
  );
}
