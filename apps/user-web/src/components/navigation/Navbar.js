'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bus, Compass, Ticket, User, LogOut, Menu, X, Calendar } from 'lucide-react';
import LanguageSelector from './LanguageSelector';
import { useLanguage } from '../../context/LanguageContext';

export default function Navbar() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [user, setUser] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('rupadiya_user') : null;
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch (e) {}
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('rupadiya_token');
    localStorage.removeItem('rupadiya_user');
    setUser(null);
    window.location.href = '/';
  };

  const navLinks = user
    ? [
        { label: t('bookBus'), href: '/', icon: Bus },
        { label: t('discoverTours'), href: '/tours', icon: Compass },
        { label: t('myCalendar'), href: '/calendar', icon: Calendar },
        { label: t('myTrips'), href: '/bookings', icon: Ticket },
      ]
    : [
        { label: t('bookBus'), href: '/', icon: Bus },
        { label: t('discoverTours'), href: '/tours', icon: Compass },
      ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo matching NTT Travel brand */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-500 flex items-center justify-center text-white shadow-md shadow-sky-500/20 group-hover:bg-sky-600 transition">
              <Bus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 leading-none">NTT</span>
              <span className="text-[9px] sm:text-[10px] tracking-widest uppercase font-semibold text-slate-400 leading-tight">TRAVEL</span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-8">
            {navLinks.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`text-sm font-semibold transition-colors ${
                    active ? 'text-sky-600 font-bold' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Section: Language Selector + User Profile / Sign In */}
          <div className="flex items-center gap-2.5 sm:gap-4">
            
            {/* Language Selector (Always visible on desktop and mobile) */}
            <LanguageSelector variant="desktop" />

            {/* Desktop User Profile / Sign In */}
            <div className="hidden md:flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <Link
                    href="/profile"
                    className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium transition"
                    title="View Profile"
                  >
                    <div className="w-6 h-6 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold">
                      {user.name ? user.name[0].toUpperCase() : 'U'}
                    </div>
                    <span className="font-semibold">{user.name || 'Account'}</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    title="Sign out"
                    className="text-slate-400 hover:text-rose-600 p-1.5 transition"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-2 bg-slate-950 hover:bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-full transition shadow-sm"
                >
                  <span>{t('signIn')}</span>
                  <span className="text-slate-400">→</span>
                </Link>
              )}
            </div>

            {/* Mobile quick avatar / drawer toggle */}
            <div className="flex items-center gap-1.5 md:hidden">
              {user ? (
                <Link
                  href="/profile"
                  className="w-8 h-8 rounded-full bg-sky-500 text-white flex items-center justify-center text-xs font-bold shadow-sm"
                  title="Profile"
                >
                  {user.name ? user.name[0].toUpperCase() : 'U'}
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold"
                >
                  {t('signIn')}
                </Link>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}
