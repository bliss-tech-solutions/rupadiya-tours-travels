'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  ShieldAlert, 
  Building2, 
  Users,
  Bus,
  Route, 
  Compass, 
  FileSpreadsheet, 
  UserCheck, 
  Receipt, 
  LogOut,
  LayoutDashboard,
  ShieldCheck
} from 'lucide-react';
import { api } from '../lib/api';

export default function AdminSidebar() {
  const pathname = usePathname();
  const [admin, setAdmin] = useState(null);
  const [pendingKyc, setPendingKyc] = useState(0);

  useEffect(() => {
    const raw = localStorage.getItem('admin_user');
    if (raw) {
      try { setAdmin(JSON.parse(raw)); } catch (e) {}
    }

    async function loadDash() {
      try {
        const res = await api.getDashboard();
        if (res?.success && res.stats?.pendingKycCount != null) {
          setPendingKyc(res.stats.pendingKycCount);
        }
      } catch (e) {}
    }
    loadDash();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    window.location.href = '/login';
  };

  const navItems = [
    { label: 'Command Center', href: '/', icon: LayoutDashboard },
    { label: '33 Companies Registry', href: '/companies', icon: Building2 },
    { label: 'Global Agents Directory', href: '/agents', icon: Users },
    { label: 'Fleet & Paper Compliance', href: '/fleet', icon: Bus },
    { label: 'Corridors & Fares', href: '/routes', icon: Route },
    { label: 'Tour Packages Manager', href: '/tours', icon: Compass },
    { label: 'Master Bookings Ledger', href: '/bookings', icon: FileSpreadsheet },
    { label: 'KYC Approvals Queue', href: '/kyc', icon: UserCheck, badge: pendingKyc > 0 ? pendingKyc : null },
    { label: 'GST & TCS Tax Reports', href: '/tax', icon: Receipt },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between h-screen sticky top-0 shrink-0">
      <div>
        {/* Brand */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black shadow-lg shadow-purple-500/20">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block">
                Super Admin
              </span>
              <h2 className="text-sm font-black text-white">Platform HQ</h2>
            </div>
          </div>

          <div className="mt-4 p-2.5 rounded-xl bg-purple-950/40 border border-purple-800/40 text-center">
            <span className="text-[10px] font-bold text-purple-300 uppercase tracking-wider">
              33 Companies Registry
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-210px)]">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-purple-600 text-white font-black shadow-md shadow-purple-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                {item.badge != null && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-slate-950">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-purple-950 border border-purple-700/50 flex items-center justify-center text-xs font-bold text-purple-300">
            {admin?.name ? admin.name[0].toUpperCase() : 'A'}
          </div>
          <div className="truncate">
            <div className="text-xs font-bold text-white truncate">{admin?.name || 'Platform Administrator'}</div>
            <div className="text-[10px] text-purple-400 font-medium">Root Super Admin</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 text-xs font-bold transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
