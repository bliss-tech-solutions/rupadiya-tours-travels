'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Menu, X, Building2, Wallet } from 'lucide-react';
import CompanySidebar from './Sidebar';
import { api, isOwnerSessionValid, clearOwnerSession } from '../lib/api';

export default function CompanyLayoutShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [companyInfo, setCompanyInfo] = useState(null);

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

  // Load dashboard company info & wallet
  const fetchHeaderData = async () => {
    if (isLoginPage) return;
    try {
      const res = await api.getDashboard();
      if (res?.success) {
        setCompanyInfo(res);
        setWalletBalance(res.wallet?.availableBalance ?? 0);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!isLoginPage) {
      fetchHeaderData();
      const handleUpdate = () => fetchHeaderData();
      window.addEventListener('company-wallet-updated', handleUpdate);
      return () => window.removeEventListener('company-wallet-updated', handleUpdate);
    }
  }, [isLoginPage]);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (isLoginPage) {
    return <main className="min-h-screen bg-slate-50 text-slate-900">{children}</main>;
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

          <div className="flex items-center gap-2.5">
            {/* Live Wallet Balance Pill */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <div className="text-right">
                <div className="text-[10px] font-medium text-emerald-700 uppercase leading-none">Wallet</div>
                <div className="text-xs font-bold text-slate-900 leading-tight">
                  ₹{walletBalance !== null ? Number(walletBalance).toLocaleString('en-IN') : '...'}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content Body (Independently Vertically Scrollable, Full space utilization) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 w-full">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
