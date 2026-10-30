'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Menu, X, Building2, Wallet, RefreshCw } from 'lucide-react';
import { useCompanyWallet } from '../context/CompanyWalletContext';
import CompanySidebar from './Sidebar';
import RealtimeNotificationListener from './RealtimeNotificationListener';
import { api, isOwnerSessionValid, clearOwnerSession } from '../lib/api';

export default function CompanyLayoutShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { balance: walletBalance, companyInfo, companyCode: contextCode, loading: walletLoading, refreshWallet } = useCompanyWallet();

  // Check 24-hour session validity on mount & route change (silent background verification)
  useEffect(() => {
    if (!isLoginPage) {
      if (!isOwnerSessionValid()) {
        clearOwnerSession();
        router.push('/login?expired=1');
        return;
      }

      const interval = setInterval(() => {
        if (!isOwnerSessionValid()) {
          clearOwnerSession();
          router.push('/login?expired=1');
        }
      }, 60000); // Check every 60s silently

      return () => clearInterval(interval);
    }
  }, [pathname, isLoginPage, router]);



  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-50 text-slate-900">{children}</main>;
  }

  if (typeof window !== 'undefined' && !isOwnerSessionValid()) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const code = companyInfo?.companyCode || 1;
  const companyName = companyInfo?.company?.name || `Company #${String(code).padStart(2, '0')}`;

  return (
    <div className="h-screen w-full bg-slate-50 text-slate-900 flex flex-col lg:flex-row overflow-hidden">
      {/* Desktop Fixed Sidebar (Stable width, independently scrollable) */}
      <div className="hidden lg:flex w-64 lg:w-72 shrink-0 h-screen overflow-y-auto border-r border-slate-200/80 bg-white">
        <CompanySidebar />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* Mobile Drawer */}
      <div className={`fixed inset-y-0 left-0 w-72 bg-white z-50 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Navigation Menu</span>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="h-[calc(100vh-60px)] overflow-y-auto">
          <CompanySidebar onNavigate={() => setMobileMenuOpen(false)} />
        </div>
      </div>

      {/* Right Content Area (Exact device height with vertical scrollable content body) */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-hidden bg-slate-50">
        {/* Top Navbar Header */}
        <header className="shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4 z-30 shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition"
              aria-label="Open sidebar menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-xs">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-sm hidden sm:inline-block">
                  {companyName}
                </span>
                <span className="inline-flex sm:ml-2 items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 font-mono">
                  Code #{String(code).padStart(2, '0')}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live Wallet Balance Pill */}
            <Link
              href="/"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100/70 text-emerald-800 transition shadow-2xs group cursor-pointer"
              title="Click to view company dashboard / add funds"
            >
              <Wallet className="w-4 h-4 text-emerald-600" />
              <div className="text-right">
                <div className="text-[10px] font-medium text-emerald-700 uppercase leading-none">Company Wallet</div>
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  {walletBalance !== null ? `₹${Number(walletBalance).toLocaleString('en-IN')}` : '₹...'}
                </div>
              </div>
            </Link>

            <button
              type="button"
              onClick={() => refreshWallet()}
              disabled={walletLoading}
              className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition cursor-pointer"
              title="Refresh Wallet Balance"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${walletLoading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
          </div>
        </header>

        {/* Page Content Body (Independently Vertically Scrollable, Full space utilization for responsive xl/2xl displays) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full">
          <div className="w-full max-w-[1720px] mx-auto px-1 sm:px-2 lg:px-4">
            {children}
          </div>
        </main>
      </div>
      <RealtimeNotificationListener companyCode={contextCode} />
    </div>
  );
}
