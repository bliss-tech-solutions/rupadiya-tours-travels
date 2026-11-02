'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  ReceiptText,
  Printer,
  XCircle,
  Gift,
  Ticket,
  Navigation,
  User,
  Sliders,
  LogOut,
  Wallet,
  ShieldCheck,
  X,
  Network,
  ClipboardList
} from 'lucide-react';
import { api } from '../lib/api';
import { useWallet } from '../context/WalletContext';

export default function AgentSidebar({ isOpen, onClose }) {
  const pathname = usePathname();
  const { balance: walletBalance, agent: contextAgent } = useWallet();
  const [localAgent, setLocalAgent] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('agent_user');
      if (raw) setLocalAgent(JSON.parse(raw));
    } catch (e) {}
  }, []);

  const agent = contextAgent || localAgent;

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    try {
      localStorage.removeItem('agent_token');
      localStorage.removeItem('agent_user');
    } catch {}
    window.location.href = '/login';
  };

  const menuItems = [
    { label: 'Dashboard', href: '/', icon: LayoutDashboard },
    { label: 'Make Deposit', href: '/deposit', icon: PlusCircle },
    { label: 'Deposit History', href: '/deposit-history', icon: History },
    { label: 'Statement', href: '/statement', icon: ReceiptText },
    { label: 'Print Ticket', href: '/print-ticket', icon: Printer },
    { label: 'Cancel Ticket', href: '/cancel-ticket', icon: XCircle },
    { label: 'My Rewards', href: '/rewards', icon: Gift },
    { label: 'Referral Network', href: '/network', icon: Network },
    { label: 'Booking', href: '/booking', icon: Ticket },
    { label: 'Booking History', href: '/bookings', icon: ClipboardList },
    { label: 'Track a Bus', href: '/track-bus', icon: Navigation },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/settings', icon: Sliders },
    { label: 'Logout', isAction: true, onClick: handleLogout, icon: LogOut },
  ];

  const agentCode = agent?.referralCode || agent?.agentCode || 'AGT01L1T0001';
  const displayName = agent?.name || agent?.agencyName || 'Rupadiya Partner';

  return (
    <aside
      className={`fixed md:sticky top-0 inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col justify-between h-screen shrink-0 select-none shadow-sm md:shadow-none transition-transform duration-200 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Brand Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                R
              </div>
              <div className="truncate">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block leading-none">
                  Agent Terminal
                </span>
                <h2 className="text-sm font-bold text-slate-900 truncate mt-0.5" suppressHydrationWarning>{displayName}</h2>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Agent Code & Live Balance Card */}
          <div className="mt-3.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
              <span className="font-medium flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" /> Wallet Balance
              </span>
              <span className="bg-emerald-100/80 text-emerald-800 font-bold px-1.5 py-0.5 rounded text-[10px]" suppressHydrationWarning>
                {agentCode}
              </span>
            </div>
            <div className="text-xl font-bold text-slate-900 tracking-tight" suppressHydrationWarning>
              {walletBalance !== null ? `₹${Number(walletBalance).toLocaleString('en-IN')}` : '₹...'}
            </div>
          </div>
        </div>

        {/* Menu Items Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {menuItems.map((item) => {
            if (item.isAction) {
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    onClose();
                    item.onClick();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition text-rose-600 hover:bg-rose-50 text-left cursor-pointer"
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            }

            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition ${
                  active
                    ? 'bg-emerald-600 text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-medium'
                }`}
              >
                <item.icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Profile Mini-Bar */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/60">
        <div className="flex items-center gap-2.5 px-1 py-1">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 border border-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0" suppressHydrationWarning>
            {agent?.name ? agent.name[0].toUpperCase() : 'A'}
          </div>
          <div className="truncate text-left flex-1">
            <div className="text-xs font-semibold text-slate-900 truncate" suppressHydrationWarning>{agent?.name || 'Authorized Agent'}</div>
            <div className="text-[10px] text-emerald-700 font-medium flex items-center gap-1" suppressHydrationWarning>
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> {agent?.agentLevel || 'Verified Partner'}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
