'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Building2, 
  Bus, 
  CalendarClock, 
  Users, 
  Target, 
  LogOut,
  LayoutDashboard,
  CreditCard,
  Award,
  Banknote,
  Landmark,
  BarChart3,
  History,
  Network,
  UserCog
} from 'lucide-react';
import { api, clearOwnerSession, isOwnerSessionValid } from '../lib/api';
import { useCompanyWallet } from '../context/CompanyWalletContext';
import { getFranchiseByCode } from '../lib/companies';

export default function CompanySidebar({ onNavigate }) {
  const pathname = usePathname();
  const [owner, setOwner] = useState(null);
  const [companyData, setCompanyData] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem('owner_user');
    if (raw) {
      if (!isOwnerSessionValid()) return;
      try { setOwner(JSON.parse(raw)); } catch (e) {}
    }

    async function loadDash() {
      if (!isOwnerSessionValid()) return;
      try {
        const res = await api.getDashboard();
        if (res?.success) {
          setCompanyData(res);
        }
      } catch (e) {}
    }
    loadDash();
  }, []);

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    clearOwnerSession();
    window.location.href = '/login';
  };

  const code = companyData?.companyCode || owner?.companyCode || 1;
  const staticSpec = getFranchiseByCode(code);
  const company = companyData?.company || owner?.company || staticSpec;
  const shortCode = company?.shortCode || staticSpec?.shortCode || '';
  const companyName = company?.name || staticSpec?.name || 'Franchise Carrier';
  const pendingWdCount = companyData?.stats?.pendingWithdrawalsCount || 0;

  const navItems = [
    { label: 'Company Overview', href: '/', icon: LayoutDashboard },
    { label: 'Company Agents', href: '/agents', icon: Users },
    { label: 'Tiers & Agent Levels', href: '/levels', icon: Award },
    { label: 'Withdrawal Requests', href: '/withdrawals', icon: CreditCard, badge: pendingWdCount > 0 ? pendingWdCount : null },
    { label: 'Fleet Buses (2+2)', href: '/fleet', icon: Bus },
    { label: 'Trip Scheduler', href: '/trips', icon: CalendarClock },
    { label: 'Bus Managers', href: '/managers', icon: UserCog },
    { label: 'Cash Collections', href: '/cash', icon: Banknote },
    { label: 'Settlements with RBS', href: '/settlements', icon: Landmark },
    { label: 'Reports', href: '/reports', icon: BarChart3 },
    { label: 'Booking History', href: '/history', icon: History },
    { label: 'Network (33 Companies)', href: '/network', icon: Network },
    { label: 'Annual Targets & P&L', href: '/targets', icon: Target },
    { label: 'Agent Payment Rules', href: '/payment-methods', icon: CreditCard },
  ];

  return (
    <aside className="w-full h-full bg-white flex flex-col justify-between select-none">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shadow-blue-500/20 shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="truncate">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 block">
                Company Portal
              </span>
              <div className="flex items-center gap-1.5 truncate mt-0.5">
                {shortCode && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200 shrink-0">
                    {shortCode}
                  </span>
                )}
                <h2 className="text-xs font-bold text-slate-900 truncate" title={companyName}>
                  {companyName}
                </h2>
              </div>
            </div>
          </div>

          <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider block">
              Carrier Entity
            </span>
            <div className="text-xs font-semibold text-slate-800 mt-0.5 truncate" title={companyName}>
              {companyName}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onNavigate && onNavigate()}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs transition cursor-pointer ${
                  active
                    ? 'bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-semibold'
                }`}
              >
                <div className="flex items-center gap-3 font-semibold">
                  <item.icon className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge != null && (
                  <span className="px-2 py-0.5 font-semibold rounded-full text-[10px] bg-amber-100 text-amber-800 border border-amber-200">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer User Info & Logout Button */}
      <div className="p-4 border-t border-slate-100 space-y-3 bg-slate-50/50">
        <div className="flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-xs font-semibold text-blue-700 shrink-0">
            {owner?.name ? owner.name[0].toUpperCase() : 'O'}
          </div>
          <div className="truncate flex-1">
            <div className="text-xs font-semibold text-slate-900 truncate">{owner?.name || 'Franchise Owner'}</div>
            <div className="text-[10px] text-slate-500 font-normal truncate">{shortCode ? `${shortCode} Operator` : `${companyName} Operator`}</div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 text-xs font-medium transition shadow-2xs cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
