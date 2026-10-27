'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bus, Compass, Calendar, Ticket, User } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('rupadiya_user') : null;
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch (e) {}
    }
  }, []);

  // Hide bottom nav during active seat selection / checkout flows where full bottom action bar is present
  const hideOnPaths = ['/trips/', '/checkout/', '/payment/', '/boarding-points/'];
  const shouldHide = hideOnPaths.some((p) => pathname.includes(p));

  if (shouldHide) return null;

  const navItems = user
    ? [
        { label: t('bookBus'), shortLabel: 'Book', href: '/', icon: Bus },
        { label: t('discoverTours'), shortLabel: 'Tours', href: '/tours', icon: Compass },
        { label: t('myCalendar'), shortLabel: 'Calendar', href: '/calendar', icon: Calendar },
        { label: t('myTrips'), shortLabel: 'Trips', href: '/bookings', icon: Ticket },
        { label: t('profile'), shortLabel: 'Profile', href: '/profile', icon: User },
      ]
    : [
        { label: t('bookBus'), shortLabel: 'Book', href: '/', icon: Bus },
        { label: t('discoverTours'), shortLabel: 'Tours', href: '/tours', icon: Compass },
        { label: t('signIn'), shortLabel: 'Sign in', href: '/login', icon: User },
      ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 px-2 py-2 safe-bottom shadow-lg shadow-slate-900/10">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all ${
                isActive ? 'text-sky-600 font-bold scale-105' : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <item.icon className={`w-5 h-5 mb-0.5 ${isActive ? 'text-sky-500 stroke-[2.5]' : 'stroke-[1.8]'}`} />
              <span className="text-[10px] tracking-tight truncate max-w-[64px] text-center">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
