'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Banknote,
  Building2,
  Users,
  Bus,
  Route,
  Compass, 
  FileSpreadsheet, 
  UserCheck, 
  Receipt, 
  CreditCard,
  Landmark,
  MessageCircle,
  RotateCcw,
  LayoutDashboard,
  ChevronRight
} from 'lucide-react';
import { api, isPrimaryAdminSession } from '../lib/api';

export default function AdminSidebar() {
  const pathname = usePathname();
  const [pendingKyc, setPendingKyc] = useState(0);
  const [pendingRefunds, setPendingRefunds] = useState(0);
  const [isPrimary, setIsPrimary] = useState(false);
  useEffect(() => { setIsPrimary(isPrimaryAdminSession()); }, []);

  useEffect(() => {
    async function loadDash() {
      try {
        const res = await api.getDashboard();
        if (res?.success) {
          if (res.stats?.pendingKycCount != null) setPendingKyc(res.stats.pendingKycCount);
          if (res.stats?.pendingRefundsCount != null) setPendingRefunds(res.stats.pendingRefundsCount);
        }
      } catch (e) {}
    }
    loadDash();
  }, []);

  const navItems = [
    { label: 'Command Center', href: '/', icon: LayoutDashboard },
    { label: 'Companies Registry', href: '/companies', icon: Building2 },
    { label: 'Global Agents Directory', href: '/agents', icon: Users },
    { label: 'Fleet & Bus Management', href: '/fleet', icon: Bus },
    { label: 'Corridors & Fares', href: '/routes', icon: Route },
    { label: 'Tour Packages Manager', href: '/tours', icon: Compass },
    { label: 'Master Bookings Ledger', href: '/bookings', icon: FileSpreadsheet },
    { label: 'Refunds & Returns Desk', href: '/refunds', icon: RotateCcw, badge: pendingRefunds > 0 ? pendingRefunds : null },
    { label: 'KYC Approvals Queue', href: '/kyc', icon: UserCheck, badge: pendingKyc > 0 ? pendingKyc : null },
    { label: 'GST & TCS Tax Reports', href: '/tax', icon: Receipt },
    { label: 'Payment Gateway Rules', href: '/payment-methods', icon: CreditCard },
    { label: 'Finance & Reconciliation', href: '/finance', icon: Landmark },
    { label: 'Company Settlements', href: '/settlements', icon: Landmark },
    { label: 'Agent Withdrawals', href: '/withdrawals', icon: Banknote },
    { label: 'Live Journeys', href: '/journeys', icon: Bus },
    { label: 'WhatsApp & Messages', href: '/whatsapp', icon: MessageCircle },
    { label: 'Users Directory', href: '/users', icon: Users },
    ...(isPrimary ? [{ label: 'Admin Accounts', href: '/admins', icon: UserCheck }] : []),
  ];

  return (
    <aside className="w-full flex flex-col justify-between py-5 px-3 space-y-4 select-none">
      <div className="space-y-4">
        {/* Navigation Section */}
        <div className="px-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
            Platform Modules
          </span>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                    active
                      ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200/80 shadow-xs'
                      : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-600'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge != null ? (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                      {item.badge}
                    </span>
                  ) : active ? (
                    <ChevronRight className="w-3.5 h-3.5 text-blue-500" />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Platform Registry Info */}
      <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-semibold text-slate-800">Franchise Network</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-tight">
          Active Franchise Carriers Registry
        </p>
      </div>
    </aside>
  );
}
