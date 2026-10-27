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
  ShieldCheck,
  TrendingUp,
  LayoutDashboard
} from 'lucide-react';

export default function CompanySidebar() {
  const pathname = usePathname();
  const [owner, setOwner] = useState(null);

  useEffect(() => {
    const raw = localStorage.getItem('owner_user');
    if (raw) {
      try { setOwner(JSON.parse(raw)); } catch (e) {}
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('owner_token');
    localStorage.removeItem('owner_user');
    window.location.href = '/login';
  };

  const navItems = [
    { label: 'Company Overview', href: '/', icon: LayoutDashboard },
    { label: 'Fleet Buses (2+2)', href: '/fleet', icon: Bus },
    { label: 'Trip Scheduler', href: '/trips', icon: CalendarClock },
    { label: 'Company Agents', href: '/agents', icon: Users },
    { label: 'Annual Targets & P&L', href: '/targets', icon: Target },
  ];

  return (
    <aside className="w-64 bg-[#0D131F] border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0">
      <div>
        {/* Brand */}
        <div className="p-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-lg shadow-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 block">
                Company Portal
              </span>
              <h2 className="text-sm font-black text-white">Company #01</h2>
            </div>
          </div>

          <div className="mt-4 p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Operator Franchise
            </span>
            <div className="text-xs font-bold text-white mt-0.5 truncate">
              Rupadiya Royal Travels
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1.5">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
                  active
                    ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-4 border-t border-slate-800 space-y-3">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-blue-950 border border-blue-700/50 flex items-center justify-center text-xs font-bold text-blue-300">
            {owner?.name ? owner.name[0].toUpperCase() : 'O'}
          </div>
          <div className="truncate">
            <div className="text-xs font-bold text-white truncate">{owner?.name || 'Franchise Owner'}</div>
            <div className="text-[10px] text-blue-400 font-medium">Company Code #01</div>
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

