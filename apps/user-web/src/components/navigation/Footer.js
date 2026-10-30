import React from 'react';
import Link from 'next/link';
import { Bus, Compass, Ticket, ShieldCheck, MapPin } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="hidden md:block bg-[#0B0F19] text-white pt-14 pb-10 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-start justify-between gap-10 pb-12 border-b border-slate-800">
          {/* Brand Column */}
          <div className="space-y-3 max-w-sm">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold tracking-tight text-white">Rupadiya</span>
              <span className="text-xs tracking-widest text-sky-400 font-bold uppercase">TRAVEL</span>
            </div>
            <p className="text-slate-400 text-sm leading-relaxed">
              Good journeys start here. Dedicated intercity network connecting Rupadiya Hub with Ahmedabad, Surat, Vadodara, Bengaluru, Hyderabad, and Mumbai.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Certified 33 Fleet Franchise Network</span>
            </div>
          </div>

          {/* Navigation Links matching the reference */}
          <div className="flex flex-wrap gap-10 sm:gap-16 text-sm">
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Services</span>
              <ul className="space-y-2.5">
                <li>
                  <Link href="/" className="flex items-center gap-2 text-slate-300 hover:text-white transition">
                    <Bus className="w-4 h-4 text-sky-400" />
                    <span>Bus tickets</span>
                  </Link>
                </li>
                <li>
                  <Link href="/tours" className="flex items-center gap-2 text-slate-300 hover:text-white transition">
                    <Compass className="w-4 h-4 text-emerald-400" />
                    <span>Tours</span>
                  </Link>
                </li>
                <li>
                  <Link href="/bookings" className="flex items-center gap-2 text-slate-300 hover:text-white transition">
                    <Ticket className="w-4 h-4 text-amber-400" />
                    <span>My bookings</span>
                  </Link>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Fixed Corridors</span>
              <ul className="space-y-1.5 text-xs text-slate-400">
                <li className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-400" /> Rupadiya ↔ Ahmedabad</li>
                <li className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-400" /> Rupadiya ↔ Vadodara</li>
                <li className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-400" /> Rupadiya ↔ Surat</li>
                <li className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-400" /> Rupadiya ↔ Bengaluru</li>
                <li className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-400" /> Rupadiya ↔ Hyderabad</li>
                <li className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-sky-400" /> Rupadiya ↔ Mumbai</li>
              </ul>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Portals</span>
              <ul className="space-y-2 text-xs text-slate-400">
                <li><a href="http://localhost:3002" target="_blank" rel="noreferrer" className="hover:text-sky-400 transition">Agent Portal →</a></li>
                <li><a href="https://rupadiya-tours-travels-ws19.vercel.app" target="_blank" rel="noreferrer" className="hover:text-sky-400 transition">Company Portal →</a></li>
               
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 Rupadiya Travel · Rupadiya Intercity Platform. All rights reserved.</p>
          <div className="flex gap-6">
            <span>GST & Tax Compliant</span>
            <span>Female Adjacent Safety Enforced</span>
            <span>Instant Cashback Enabled</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

