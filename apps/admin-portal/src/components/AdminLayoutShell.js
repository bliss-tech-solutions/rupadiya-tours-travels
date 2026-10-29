'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import AdminSidebar from './Sidebar';
import { ShieldAlert, LogOut, Clock, Menu, X, User } from 'lucide-react';
import { api, isAdminSessionValid } from '../lib/api';

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 Hours

export default function AdminLayoutShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [admin, setAdmin] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const isLoginPage = pathname === '/login';

  useEffect(() => {
    setMounted(true);
    if (isLoginPage) return;

    try {
      localStorage.removeItem('admin_token'); // Clean legacy token
    } catch {}

    const userRaw = localStorage.getItem('admin_user');
    if (userRaw) {
      try { setAdmin(JSON.parse(userRaw)); } catch (e) {}
    }

    async function checkSession() {
      try {
        const res = await api.me();
        if (res?.user) {
          setAdmin(res.user);
          localStorage.setItem('admin_user', JSON.stringify(res.user));
        } else {
          router.push('/login?reason=session_expired');
        }
      } catch (err) {
        router.push('/login?reason=session_expired');
      }
    }

    checkSession();
  }, [pathname, isLoginPage, router]);

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    localStorage.removeItem('admin_login_time');
    window.location.href = '/login';
  };

  if (!mounted && !isLoginPage) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isLoginPage) {
    return <main className="min-h-screen bg-[#F8FAFC]">{children}</main>;
  }

  if (typeof window !== 'undefined' && !isAdminSessionValid()) {
    router.push('/login');
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#F8FAFC] flex flex-col overflow-hidden">
      {/* Top Header */}
      <header className="shrink-0 bg-white border-b border-slate-200/90 z-30 shadow-xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-sky-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
                    Super Admin HQ
                  </span>
                  <span className="text-xs font-bold text-slate-400 hidden sm:inline">· Rupadiya Platform</span>
                </div>
                <h1 className="text-sm font-black text-slate-900 leading-tight">Universal Governance Center</h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200/60 text-xs font-bold text-blue-800">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>24hr Active Session</span>
            </div>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 font-black text-xs flex items-center justify-center border border-blue-300">
                {admin?.name ? admin.name[0].toUpperCase() : 'A'}
              </div>
              <div className="hidden md:block text-left">
                <span className="text-xs font-bold text-slate-900 block leading-none">{admin?.name || 'Super Admin'}</span>
                <span className="text-[10px] text-slate-400 font-medium">Root Access (33 Companies)</span>
              </div>
              <button
                onClick={handleLogout}
                title="Sign Out"
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer ml-1"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container with Sidebar + Content */}
      <div className="flex-1 flex w-full overflow-hidden">
        {/* Desktop Sidebar (Exact device height below header, independently scrollable) */}
        <div className="hidden lg:flex flex-col w-64 shrink-0 h-full overflow-y-auto border-r border-slate-200/90 bg-white">
          <AdminSidebar />
        </div>

        {/* Mobile Slide-out Sidebar */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs" onClick={() => setMobileMenuOpen(false)} />
            <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-200 shadow-2xl z-50 flex flex-col">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-black uppercase text-blue-700">Navigation</span>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto" onClick={() => setMobileMenuOpen(false)}>
                <AdminSidebar />
              </div>
            </div>
          </div>
        )}

        {/* Right Scrollable Content div (Full responsive width on XL & 2XL devices) */}
        <main className="flex-1 h-full p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          <div className="w-full max-w-[1720px] mx-auto px-1 sm:px-2 lg:px-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

